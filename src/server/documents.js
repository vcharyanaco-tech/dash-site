/**
 * ============================================================
 * India Post Dashboard — Node port
 * documents.js
 * Document management: attachments linked to records, stored
 * on local disk under data/uploads (port of Documents.gs; the
 * DriveFileId becomes a local file_key served via GET /files/:key).
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { db } = require('./db');
const { NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } = require('./config');
const { uuid_, now_, runWithLock_ } = require('./helpers');
const { resolveRecord_ } = require('./records');
const auth = require('./auth');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
const MAX_UPLOAD_BYTES = Number(process.env.DASH_MAX_UPLOAD_BYTES || 25 * 1024 * 1024);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png'
]);

function ensureUploadsDir_() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function sanitizeFileName_(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'document';
}

function docRecordFromRow_(row) {
  return {
    id: String(row.id || ''),
    recordRow: Number(row.record_row) || 0,
    recordId: String(row.record_id || ''),
    fileName: String(row.file_name || ''),
    driveFileId: String(row.file_key || ''),
    mimeType: String(row.mime_type || ''),
    size: Number(row.size) || 0,
    uploadedBy: String(row.uploaded_by || '').toLowerCase(),
    uploadedAt: row.uploaded_at ? Number(row.uploaded_at) : 0,
    keep: row.keep ? 1 : 0
  };
}

function getAllDocuments(token) {
  auth.requireLogin(token);
  const rows = db.prepare('SELECT * FROM documents ORDER BY uploaded_at DESC').all();
  return rows.map(docRecordFromRow_);
}

// Resolve a record from either its stable record_id UUID or its physical row.
// Row-number arguments are resolved to the physical row before querying so a
// uuid- or row-keyed call always lands on the same record. If the record cannot
// be resolved (e.g. a legacy document whose parent row has since been pruned)
// the raw numeric row value is kept so row-keyed lookups stay backward
// compatible; unrecoverable inputs still fall back to 0.
function resolveRow_(rowOrId) {
  const resolved = resolveRecord_(rowOrId);
  if (resolved) return Number(resolved.row);
  const n = Number(rowOrId);
  return isFinite(n) && n >= 1 ? n : 0;
}

function getRecordDocuments_(rowOrId) {
  const rows = db.prepare('SELECT * FROM documents WHERE record_row = ? ORDER BY uploaded_at DESC').all(resolveRow_(rowOrId));
  return rows.map(docRecordFromRow_);
}

function addDocument_(recordRow, recordId, fileName, fileKey, mimeType, size, uploadedBy) {
  const id = uuid_();
  const now = Date.now();
  db.prepare(
    'INSERT INTO documents (id, record_row, record_id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, recordRow, recordId, fileName, fileKey, mimeType, size, uploadedBy, now);
  return { id: id, recordRow: recordRow, fileName: fileName, driveFileId: fileKey };
}

function deleteDocument_(docId) {
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(String(docId));
  if (!row) return false;
  const fileKey = String(row.file_key || '');
  if (fileKey) {
    const p = path.join(UPLOADS_DIR, fileKey);
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (err) {
      console.error('Failed to delete document file: ' + err.message);
    }
    // Remove the KV copy too so a deleted attachment can't resurrect on redeploy.
    try { require('./data-sync').deleteRemoteFile('uploads', fileKey); } catch (err) {}
  }
  db.prepare('DELETE FROM documents WHERE id = ?').run(String(docId));
  try { require('./data-sync').requestBackup(); } catch (err) {}
  return true;
}

function getRecordDocuments(recordRow, token) {
  auth.requireLogin(token);
  return getRecordDocuments_(recordRow);
}

function uploadDocument(recordRow, recordId, fileName, base64, mimeType, token) {
  const user = auth.requireEditor(token);
  const safeName = sanitizeFileName_(fileName);
  const declaredMime = String(mimeType || '').toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.has(declaredMime)) throw new Error('Unsupported document type.');
  const encoded = String(base64 || '').trim();
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
    throw new Error('Invalid file content.');
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length) throw new Error('Empty file content.');
  if (bytes.length > MAX_UPLOAD_BYTES) throw new Error('File exceeds the ' + Math.round(MAX_UPLOAD_BYTES / 1024 / 1024) + ' MB limit.');

  const record = resolveRecord_(recordId || recordRow);
  if (!record) throw new Error('Record not found.');

  return runWithLock_(function () {
    ensureUploadsDir_();
    const fileKey = uuid_();
    const target = path.join(UPLOADS_DIR, fileKey);
    fs.writeFileSync(target, bytes);

    const rowNum = Number(record.row) || 0;
    // Anchor the document to the record's stable UUID (never the legacy
    // numeric row-derived id) so it follows the record through renumbering.
    const doc = addDocument_(rowNum, String(record.record_id || ''), safeName, fileKey, declaredMime, bytes.length, user.email);

    try {
      require('./notifications').notifyStaffLocked_(NOTIFICATION_TYPES.RECORD, 'Document added', 'Document "' + safeName + '" was added to record #' + rowNum + ' by ' + user.email + '.', '', user.email, { priority: NOTIFICATION_PRIORITY.NORMAL, recordRow: rowNum });
    } catch (err) {}

    return doc;
  });
}

function deleteDocument(docId, token) {
  const user = auth.requireEditor(token);
  const docRow = db.prepare('SELECT record_row FROM documents WHERE id = ?').get(String(docId));
  const ok = deleteDocument_(String(docId));
  if (!ok) throw new Error('Document not found.');
  try {
    require('./notifications').notifyStaffLocked_(NOTIFICATION_TYPES.RECORD, 'Document removed', 'A document (' + String(docId) + ') was removed by ' + user.email + '.', '', user.email, { priority: NOTIFICATION_PRIORITY.NORMAL, recordRow: docRow ? Number(docRow.record_row) || 0 : 0 });
  } catch (err) {}
  return { success: true };
}

/** Toggle a document's retention exemption. keep=1 protects the attachment
 *  from the DASH_RETENTION_DAYS prune sweep (data-sync.enforceRetention_). */
function setDocumentKeep(docId, keep, token) {
  const user = auth.requireEditor(token);
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(String(docId));
  if (!row) throw new Error('Document not found.');
  const keepVal = keep ? 1 : 0;
  db.prepare('UPDATE documents SET keep = ? WHERE id = ?').run(keepVal, String(docId));
  try { require('./data-sync').requestBackup(); } catch (err) {}
  try {
    require('./notifications').notifyStaffLocked_(
      NOTIFICATION_TYPES.RECORD,
      keepVal ? 'Document kept' : 'Document un-kept',
      (keepVal ? 'A document (' + String(docId) + ') was flagged to be kept (exempt from retention) by ' : 'A document (' + String(docId) + ') was un-kept (retention applies again) by ') + user.email + '.',
      '',
      user.email
    );
  } catch (err) {}
  return { success: true, keep: keepVal, id: String(docId) };
}

/* Resolves a file_key to { path, meta } or null. Used by the GET /files/:key route. */
function resolveDocumentFile(fileKey) {
  const key = String(fileKey || '');
  const row = db.prepare('SELECT * FROM documents WHERE file_key = ?').get(key);
  const submissionRow = row ? null : db.prepare('SELECT * FROM submission_attachments WHERE file_key = ?').get(key);
  const instructionRow = row || submissionRow ? null : db.prepare('SELECT * FROM instruction_attachments WHERE file_key = ?').get(key);
  const sourceRow = row || submissionRow || instructionRow;
  if (!sourceRow) return null;
  auth.requireLogin(arguments.length > 1 ? arguments[1] : '');
  if (!/^[a-f0-9]{32}$/i.test(String(sourceRow.file_key || ''))) return null;
  ensureUploadsDir_();
  const p = path.join(UPLOADS_DIR, String(sourceRow.file_key));
  if (!fs.existsSync(p)) return null;
  return {
    path: p,
    meta: row ? docRecordFromRow_(row) : {
      id: String(sourceRow.id || ''), recordRow: 0, recordId: '', fileName: String(sourceRow.file_name || ''),
      driveFileId: String(sourceRow.file_key || ''), mimeType: String(sourceRow.mime_type || ''),
      size: Number(sourceRow.size) || 0, uploadedBy: String(sourceRow.uploaded_by || '').toLowerCase(),
      uploadedAt: Number(sourceRow.uploaded_at || 0), keep: 0,
      isSubmissionAttachment: !!submissionRow,
      isInstructionAttachment: !!instructionRow
    }
  };
}

module.exports = {
  UPLOADS_DIR,
  getAllDocuments,
  getRecordDocuments,
  uploadDocument,
  deleteDocument,
  setDocumentKeep,
  resolveDocumentFile
};

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
const { NOTIFICATION_TYPES } = require('./config');
const { uuid_, now_, runWithLock_ } = require('./helpers');
const auth = require('./auth');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');

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
    uploadedAt: row.uploaded_at ? Number(row.uploaded_at) : 0
  };
}

function getRecordDocuments_(recordRow) {
  const rows = db.prepare('SELECT * FROM documents WHERE record_row = ? ORDER BY uploaded_at DESC').all(Number(recordRow) || 0);
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
  }
  db.prepare('DELETE FROM documents WHERE id = ?').run(String(docId));
  return true;
}

function getRecordDocuments(recordRow, token) {
  auth.requireLogin(token);
  return getRecordDocuments_(Number(recordRow) || 0);
}

function uploadDocument(recordRow, recordId, fileName, base64, mimeType, token) {
  const user = auth.requireLogin(token);
  const safeName = sanitizeFileName_(fileName);
  const bytes = Buffer.from(String(base64 || ''), 'base64');
  if (!bytes.length) throw new Error('Empty file content.');

  return runWithLock_(function () {
    ensureUploadsDir_();
    const fileKey = uuid_();
    const target = path.join(UPLOADS_DIR, fileKey);
    fs.writeFileSync(target, bytes);

    const rowNum = Number(recordRow) || 0;
    const doc = addDocument_(rowNum, String(recordId || ''), safeName, fileKey, String(mimeType || 'application/octet-stream'), bytes.length, user.email);

    try {
      require('./notifications').notifyStaffLocked_(NOTIFICATION_TYPES.RECORD, 'Document added', 'Document "' + safeName + '" was added to record #' + rowNum + ' by ' + user.email + '.', '', user.email);
    } catch (err) {}

    return doc;
  });
}

function deleteDocument(docId, token) {
  const user = auth.requireLogin(token);
  const ok = deleteDocument_(String(docId));
  if (!ok) throw new Error('Document not found.');
  try {
    require('./notifications').notifyStaffLocked_(NOTIFICATION_TYPES.RECORD, 'Document removed', 'A document (' + String(docId) + ') was removed by ' + user.email + '.', '', user.email);
  } catch (err) {}
  return { success: true };
}

/* Resolves a file_key to { path, meta } or null. Used by the GET /files/:key route. */
function resolveDocumentFile(fileKey) {
  const row = db.prepare('SELECT * FROM documents WHERE file_key = ?').get(String(fileKey || ''));
  if (!row) return null;
  ensureUploadsDir_();
  const p = path.join(UPLOADS_DIR, String(row.file_key));
  if (!fs.existsSync(p)) return null;
  return {
    path: p,
    meta: docRecordFromRow_(row)
  };
}

module.exports = {
  UPLOADS_DIR,
  getRecordDocuments,
  uploadDocument,
  deleteDocument,
  resolveDocumentFile
};

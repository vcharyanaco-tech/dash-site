/**
 * ============================================================
 * India Post Dashboard — Node port
 * instruction-entries.js
 * "Last meeting instructions" with the same feature set as a card update:
 * dated text entries with timestamp + office, optional attachments, and a
 * list view. Manageable by admins/editors only. Each mutation mirrors the
 * joined entry text (newest first) onto records.last_meeting_instructions so
 * cards, presentation slides, print and the sheet sync keep reading the plain
 * column unchanged.
 * ============================================================
 */

const { db } = require('./db');
const { CONFIG, ACTIONS } = require('./config');
const { uuid_, formatDate_, runWithLock_ } = require('./helpers');
const auth = require('./auth');
const fs = require('fs');
const path = require('path');
const documents = require('./documents');

const INSTRUCTION_MAX_FILE_BYTES = 1024 * 1024;
const INSTRUCTION_UPLOADS_DIR = documents.UPLOADS_DIR;

function entryFromRow_(row) {
  return {
    id: String(row.id || ''),
    cardRow: row.card_row,
    cardId: String(row.card_id || ''),
    email: String(row.email || '').toLowerCase(),
    text: String(row.text || ''),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachments: db.prepare('SELECT id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at FROM instruction_attachments WHERE entry_id = ? ORDER BY uploaded_at ASC')
      .all(String(row.id || '')).map(function (a) {
        return { id: String(a.id || ''), fileName: String(a.file_name || ''), fileKey: String(a.file_key || ''), mimeType: String(a.mime_type || ''), size: Number(a.size) || 0, uploadedBy: String(a.uploaded_by || ''), uploadedAt: Number(a.uploaded_at || 0) };
      })
  };
}

function visibleEntry_(row) {
  const e = entryFromRow_(row);
  e.office = require('./submissions').officeForEmail(e.email);
  const created = Number(row.created_at) || 0;
  e.createdAt = created ? formatDate_(new Date(created), 'dd.MM.yyyy HH:mm') : '';
  const updated = Number(row.updated_at) || 0;
  e.updatedAt = updated ? formatDate_(new Date(updated), 'dd.MM.yyyy HH:mm') : e.createdAt;
  e.isOwner = !e.email;
  return e;
}

function entriesForCard_(cardRow, user) {
  const rows = db.prepare('SELECT * FROM instruction_entries WHERE card_row = ? ORDER BY created_at DESC').all(Number(cardRow));
  return rows.map(visibleEntry_);
}

/** Recompute records.last_meeting_instructions as the joined entry text
 *  (newest first). An empty entry set clears the column (entries are now the
 *  source of truth for the field). */
function recomputeRecordInstructions_(cardRow) {
  const n = Number(cardRow);
  const entries = db.prepare('SELECT text FROM instruction_entries WHERE card_row = ? ORDER BY created_at DESC').all(n);
  const joined = entries.map(function (e) { return String(e.text || '').trim(); }).filter(Boolean).join('\n\n');
  db.prepare('UPDATE records SET last_meeting_instructions = ?, updated_at = ? WHERE row = ?').run(joined, Date.now(), n);
}

function validateAttachment_(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;
  const name = String(attachment.fileName || attachment.name || '').trim().slice(0, 200);
  const mime = String(attachment.mimeType || attachment.type || 'application/octet-stream').trim().toLowerCase() || 'application/octet-stream';
  const encoded = String(attachment.base64 || attachment.fileBytes || '').trim();
  if (!name) throw new Error('Attachment file name is required.');
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) throw new Error('Invalid attachment content.');
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length) throw new Error('Attachment is empty.');
  if (bytes.length > INSTRUCTION_MAX_FILE_BYTES) throw new Error('Attachment exceeds the 1 MB limit.');
  return { name: name.replace(/[\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'attachment', mime: mime.slice(0, 200), bytes: bytes };
}

function saveAttachment_(entryId, attachment, email) {
  const file = validateAttachment_(attachment);
  if (!file) return null;
  fs.mkdirSync(INSTRUCTION_UPLOADS_DIR, { recursive: true });
  const fileKey = uuid_();
  fs.writeFileSync(path.join(INSTRUCTION_UPLOADS_DIR, fileKey), file.bytes);
  const id = uuid_();
  db.prepare('INSERT INTO instruction_attachments (id, entry_id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, String(entryId), file.name, fileKey, file.mime, file.bytes.length, email, Date.now());
  return { id: id, fileName: file.name, fileKey: fileKey, mimeType: file.mime, size: file.bytes.length, uploadedBy: email, uploadedAt: Date.now() };
}

function deleteAttachments_(entryId) {
  db.prepare('SELECT file_key FROM instruction_attachments WHERE entry_id = ?').all(String(entryId)).forEach(function (r) {
    try { fs.unlinkSync(path.join(INSTRUCTION_UPLOADS_DIR, String(r.file_key || ''))); } catch (err) {}
    try { require('./data-sync').deleteRemoteFile('uploads', String(r.file_key || '')); } catch (err) {}
  });
  db.prepare('DELETE FROM instruction_attachments WHERE entry_id = ?').run(String(entryId));
}

function assertText_(content) {
  if (!content) throw new Error('Write the instructions before saving.');
  if (content.length > CONFIG.SUBMISSIONS.MAX_TEXT_LENGTH) {
    throw new Error('Instructions are too long (max ' + CONFIG.SUBMISSIONS.MAX_TEXT_LENGTH + ' characters).');
  }
}

function requestBackup_() {
  try { require('./data-sync').requestBackup(); } catch (err) {}
}

/* ============================================================
 * Public API (token-gated, admin/editor only)
 * ============================================================ */

function getInstructionEntries(cardRow, token) {
  const user = auth.requireEditor(token);
  return entriesForCard_(cardRow, user);
}

function addInstructionEntry(cardRow, cardId, text, attachment, token) {
  const user = auth.requireEditor(token);
  cardRow = Number(cardRow);
  if (!cardRow || isNaN(cardRow) || cardRow <= 0) throw new Error('Invalid record reference.');
  const content = String(text || '').trim();
  assertText_(content);
  validateAttachment_(attachment);

  return runWithLock_(function () {
    if (!db.prepare('SELECT 1 FROM records WHERE row = ?').get(cardRow)) throw new Error('Record not found.');
    const id = uuid_();
    const now = Date.now();
    db.prepare('INSERT INTO instruction_entries (id, card_row, card_id, email, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, cardRow, String(cardId || ''), user.email, content, now, now);
    if (attachment) saveAttachment_(id, attachment, user.email);
    recomputeRecordInstructions_(cardRow);
    try { require('./audit').logAudit_(ACTIONS.SUBMISSION_ADD, cardRow, { id: id, cardRow: cardRow, text: content }, user.email); } catch (err) {}
    requestBackup_();
    return entriesForCard_(cardRow, user);
  });
}

function updateInstructionEntry(entryId, text, attachment, token) {
  const user = auth.requireEditor(token);
  const content = String(text || '').trim();
  assertText_(content);
  validateAttachment_(attachment);

  return runWithLock_(function () {
    const rec = db.prepare('SELECT * FROM instruction_entries WHERE id = ?').get(String(entryId));
    if (!rec) throw new Error('Instruction entry not found.');
    db.prepare('UPDATE instruction_entries SET text = ?, updated_at = ? WHERE id = ?').run(content, Date.now(), String(rec.id));
    if (attachment) saveAttachment_(String(rec.id), attachment, user.email);
    recomputeRecordInstructions_(rec.card_row);
    try { require('./audit').logAudit_(ACTIONS.SUBMISSION_UPDATE, rec.card_row, { id: String(entryId), text: content }, user.email); } catch (err) {}
    requestBackup_();
    return entriesForCard_(rec.card_row, user);
  });
}

function deleteInstructionEntry(entryId, token) {
  const user = auth.requireEditor(token);
  return runWithLock_(function () {
    const rec = db.prepare('SELECT * FROM instruction_entries WHERE id = ?').get(String(entryId));
    if (!rec) throw new Error('Instruction entry not found.');
    deleteAttachments_(String(rec.id));
    db.prepare('DELETE FROM instruction_entries WHERE id = ?').run(String(rec.id));
    recomputeRecordInstructions_(rec.card_row);
    try { require('./audit').logAudit_(ACTIONS.SUBMISSION_DELETE, rec.card_row, { id: String(entryId), text: rec.text }, user.email); } catch (err) {}
    requestBackup_();
    return entriesForCard_(rec.card_row, user);
  });
}

module.exports = {
  getInstructionEntries,
  addInstructionEntry,
  updateInstructionEntry,
  deleteInstructionEntry,
  recomputeRecordInstructions_,
  requestBackup: requestBackup_
};
/**
 * ============================================================
 * India Post Dashboard — Node port
 * submissions.js
 * Viewer/editor updates submitted against dashboard records
 * (port of Submissions.gs against the 'submissions' table).
 * ============================================================
 */

const { db } = require('./db');
const { CONFIG, ROLES, ACTIONS, NOTIFICATION_PRIORITY } = require('./config');
const { uuid_, now_, formatDate_, runWithLock_ } = require('./helpers');
const auth = require('./auth');
const fs = require('fs');
const path = require('path');
const documents = require('./documents');

const SUBMISSION_MAX_FILE_BYTES = 1024 * 1024;
const SUBMISSION_UPLOADS_DIR = documents.UPLOADS_DIR;

function submissionRecordFromRow_(row) {
  return {
    id: String(row.id || ''),
    cardRow: row.card_row,
    cardId: String(row.card_id || ''),
    email: String(row.email || '').toLowerCase(),
    text: String(row.text || ''),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lockedBy: String(row.locked_by || ''),
    lockedAt: row.locked_at,
    displayed: !!row.displayed,
    readAt: row.read_at || 0,
    attachments: db.prepare('SELECT id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at FROM submission_attachments WHERE submission_id = ? ORDER BY uploaded_at ASC').all(String(row.id || '')).map(function (a) {
      return { id: String(a.id || ''), fileName: String(a.file_name || ''), fileKey: String(a.file_key || ''), mimeType: String(a.mime_type || ''), size: Number(a.size) || 0, uploadedBy: String(a.uploaded_by || ''), uploadedAt: Number(a.uploaded_at || 0) };
    })
  };
}

function readSubmissionRows_() {
  return db.prepare('SELECT * FROM submissions').all().map(submissionRecordFromRow_);
}

/** Office of the user who posted a submission (users.office). Users may carry
 *  several emails in one row (comma-separated), so match any of them.
 *  Returns '' when unknown — the client falls back to the email. */
function officeForEmail_(email) {
  const wanted = String(email || '').trim().toLowerCase();
  if (!wanted) return '';
  const rows = db.prepare('SELECT email, office FROM users').all();
  for (let i = 0; i < rows.length; i++) {
    const parts = String(rows[i].email || '').split(',').map(function (p) { return p.trim().toLowerCase(); });
    if (parts.indexOf(wanted) !== -1) return String(rows[i].office || '');
  }
  return '';
}

function findSubmissionRecord_(id) {
  const rows = readSubmissionRows_();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) return rows[i];
  }
  return null;
}

function submissionLocked_(rec) {
  return !!rec && String(rec.lockedBy || '').trim() !== '';
}

function canEditSubmission_(user, rec) {
  if (user.role === ROLES.ADMIN) return true;
  const locked = submissionLocked_(rec);
  if (user.role === ROLES.EDITOR) {
    return !locked || auth.getUserRole(rec.lockedBy) !== ROLES.ADMIN;
  }
  if (locked) return false;
  return String(rec.email || '').toLowerCase() === String(user.email || '').toLowerCase();
}

function assertCanEditSubmission_(user, rec) {
  if (canEditSubmission_(user, rec)) return;
  if (submissionLocked_(rec)) {
    if (auth.getUserRole(rec.lockedBy) === ROLES.ADMIN) {
      throw new Error('This submission was locked by an admin and can only be changed by an admin.');
    }
    throw new Error('This submission is locked and cannot be edited.');
  }
  throw new Error('You can only edit your own submissions.');
}

function formatDateTime_(value) {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(Number(value));
  if (isNaN(d.getTime())) return String(value).trim();
  return formatDate_(d, 'dd.MM.yyyy HH:mm');
}

function visibleSubmission_(rec, user) {
  const locked = submissionLocked_(rec);
  const lockRole = locked ? auth.getUserRole(rec.lockedBy) : '';
  const isAdmin = user.role === ROLES.ADMIN;
  const isEditorUser = isAdmin || user.role === ROLES.EDITOR;
  const adminLocked = locked && lockRole === ROLES.ADMIN;

  return {
    id: rec.id,
    cardRow: rec.cardRow,
    cardId: rec.cardId,
    email: rec.email,
    office: officeForEmail_(rec.email),
    text: rec.text,
    createdAt: formatDateTime_(rec.createdAt),
    updatedAt: formatDateTime_(rec.updatedAt),
    lockedBy: rec.lockedBy,
    lockedAt: formatDateTime_(rec.lockedAt),
    lockRole: lockRole,
    isOwner: String(rec.email || '').toLowerCase() === String(user.email || '').toLowerCase(),
    locked: locked,
    displayed: rec.displayed,
    editable: canEditSubmission_(user, rec),
    canLock: isEditorUser && !locked,
    canUnlock: isEditorUser && locked && (isAdmin || lockRole !== ROLES.ADMIN)
  };
}

function submissionsForCard_(cardRow, user) {
  const rows = readSubmissionRows_();

  const filtered = (cardRow !== undefined && cardRow !== null && cardRow !== '')
    ? rows.filter(function (r) { return Number(r.cardRow) === Number(cardRow); })
    : rows;

  return filtered
    .slice()
    .sort(function (a, b) {
      const ta = Number(a.createdAt) || 0;
      const tb = Number(b.createdAt) || 0;
      return tb - ta;
    })
    .map(function (rec) { return visibleSubmission_(rec, user); });
}

function cardExists_(cardRow) {
  const data = require('./records').getData();
  return (data.items || []).some(function (item) { return Number(item.row) === Number(cardRow); });
}

function getSubmissionOverview_(user) {
  const counts = {};
  const flash = {};
  const displayed = [];

  readSubmissionRows_().forEach(function (rec) {
    const key = Number(rec.cardRow);
    counts[key] = (counts[key] || 0) + 1;
    // Flash while the admin has not read this card's updates (read_at unset);
    // the counter itself keeps showing the total either way.
    if (!rec.readAt) flash[key] = true;
    if (rec.displayed) {
      // With a user present the entries carry the submission id plus the
      // per-user permission flags so the card/detail can render the same
      // Edit/Lock/Delete/Display actions the modal offers. Without a user
      // (headless tests, legacy callers) keep the minimal display shape.
      if (user) {
        displayed.push(visibleSubmission_(rec, user));
      } else {
        displayed.push({
          cardRow: key,
          email: rec.email,
          office: officeForEmail_(rec.email),
          text: rec.text,
          createdAt: formatDateTime_(rec.createdAt)
        });
      }
    }
  });

  return { counts: counts, flash: flash, displayed: displayed };
}

/* ============================================================
 * Public API (token-gated)
 * ============================================================ */

function getSubmissions(token, cardRow) {
  const user = auth.requireLogin(token);
  // An admin reading a card's update list marks its submissions as read so
  // the counter badge stops flashing; the count itself is unaffected.
  if (user.role === ROLES.ADMIN && cardRow !== undefined && cardRow !== null && cardRow !== '') {
    db.prepare('UPDATE submissions SET read_at = ? WHERE card_row = ? AND read_at = 0')
      .run(Date.now(), Number(cardRow));
  }
  return submissionsForCard_(cardRow, user);
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
  if (bytes.length > SUBMISSION_MAX_FILE_BYTES) throw new Error('Attachment exceeds the 1 MB limit.');
  return { name: name.replace(/[\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'attachment', mime: mime.slice(0, 200), bytes: bytes };
}

function saveSubmissionAttachment_(submissionId, attachment, email) {
  const file = validateAttachment_(attachment);
  if (!file) return null;
  fs.mkdirSync(SUBMISSION_UPLOADS_DIR, { recursive: true });
  const fileKey = uuid_();
  fs.writeFileSync(path.join(SUBMISSION_UPLOADS_DIR, fileKey), file.bytes);
  const id = uuid_();
  db.prepare('INSERT INTO submission_attachments (id, submission_id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, String(submissionId), file.name, fileKey, file.mime, file.bytes.length, email, Date.now());
  return { id: id, fileName: file.name, fileKey: fileKey, mimeType: file.mime, size: file.bytes.length, uploadedBy: email, uploadedAt: Date.now() };
}

function deleteSubmissionAttachments_(submissionId) {
  const rows = db.prepare('SELECT file_key FROM submission_attachments WHERE submission_id = ?').all(String(submissionId));
  rows.forEach(function (r) {
    try { fs.unlinkSync(path.join(SUBMISSION_UPLOADS_DIR, String(r.file_key || ''))); } catch (err) {}
    try { require('./data-sync').deleteRemoteFile('uploads', String(r.file_key || '')); } catch (err) {}
  });
  db.prepare('DELETE FROM submission_attachments WHERE submission_id = ?').run(String(submissionId));
}

function addSubmission(cardRow, cardId, text, attachment, token) {
  const user = auth.requireLogin(token);
  cardRow = Number(cardRow);
  if (!cardRow || isNaN(cardRow) || cardRow <= 0) throw new Error('Invalid record reference.');
  const content = String(text || '').trim();
  if (!content) throw new Error('Write your update before submitting.');
  validateAttachment_(attachment);
  if (content.length > CONFIG.SUBMISSIONS.MAX_TEXT_LENGTH) {
    throw new Error('Submission is too long (max ' + CONFIG.SUBMISSIONS.MAX_TEXT_LENGTH + ' characters).');
  }

  return runWithLock_(function () {
    if (!cardExists_(cardRow)) throw new Error('Record not found.');

    const id = uuid_();
    const now = Date.now();
    db.prepare(
      'INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, locked_by, locked_at, displayed) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, cardRow, String(cardId || ''), user.email, content, now, now, '', null, 0);
    if (attachment) saveSubmissionAttachment_(id, attachment, user.email);

    try { require('./audit').logAudit_(ACTIONS.SUBMISSION_ADD, cardRow, { id: id, cardRow: cardRow, text: content }, user.email); } catch (err) {}
    try {
      require('./notifications').notifyStaffLocked_('submission', 'New submission', 'Update submitted on record #' + cardRow + ' by ' + user.email + '.', '', user.email, { priority: NOTIFICATION_PRIORITY.HIGH, recordRow: Number(cardRow) });
    } catch (err) {}
    try { require('./automation').evaluate_('SUBMISSION_CREATED', { id: id, key: id, email: user.email, recordRow: Number(cardRow), message: 'New submission on record #' + cardRow }); } catch (err) {}
    try { require('./data-sync').requestBackup(); } catch (err) {}
    return submissionsForCard_(cardRow, user);
  });
}

function updateSubmission(submissionId, text, attachment, token) {
  const user = auth.requireLogin(token);
  const content = String(text || '').trim();
  validateAttachment_(attachment);
  if (!content) throw new Error('Write your update before saving.');
  if (content.length > CONFIG.SUBMISSIONS.MAX_TEXT_LENGTH) {
    throw new Error('Submission is too long (max ' + CONFIG.SUBMISSIONS.MAX_TEXT_LENGTH + ' characters).');
  }

  return runWithLock_(function () {
    const rec = findSubmissionRecord_(submissionId);
    if (!rec) throw new Error('Submission not found.');
    assertCanEditSubmission_(user, rec);

    db.prepare('UPDATE submissions SET text = ?, updated_at = ? WHERE id = ?').run(content, Date.now(), rec.id);
    if (attachment) saveSubmissionAttachment_(rec.id, attachment, user.email);

    try { require('./audit').logAudit_(ACTIONS.SUBMISSION_UPDATE, rec.cardRow, { id: submissionId, text: content }, user.email); } catch (err) {}
    try { require('./data-sync').requestBackup(); } catch (err) {}
    return submissionsForCard_(rec.cardRow, user);
  });
}

function lockSubmission(submissionId, token) {
  const editor = auth.requireEditor(token);

  return runWithLock_(function () {
    const rec = findSubmissionRecord_(submissionId);
    if (!rec) throw new Error('Submission not found.');
    if (submissionLocked_(rec) && auth.getUserRole(rec.lockedBy) === ROLES.ADMIN && editor.role !== ROLES.ADMIN) {
      throw new Error('This submission was locked by an admin and can only be changed by an admin.');
    }

    db.prepare('UPDATE submissions SET locked_by = ?, locked_at = ? WHERE id = ?').run(editor.email, Date.now(), rec.id);

    try { require('./audit').logAudit_(ACTIONS.SUBMISSION_LOCK, rec.cardRow, { id: submissionId }, editor.email); } catch (err) {}
    return submissionsForCard_(rec.cardRow, editor);
  });
}

function unlockSubmission(submissionId, token) {
  const editor = auth.requireEditor(token);

  return runWithLock_(function () {
    const rec = findSubmissionRecord_(submissionId);
    if (!rec) throw new Error('Submission not found.');
    if (submissionLocked_(rec) && auth.getUserRole(rec.lockedBy) === ROLES.ADMIN && editor.role !== ROLES.ADMIN) {
      throw new Error('This submission was locked by an admin and can only be changed by an admin.');
    }

    db.prepare('UPDATE submissions SET locked_by = ?, locked_at = ? WHERE id = ?').run('', null, rec.id);

    try { require('./audit').logAudit_(ACTIONS.SUBMISSION_UNLOCK, rec.cardRow, { id: submissionId }, editor.email); } catch (err) {}
    return submissionsForCard_(rec.cardRow, editor);
  });
}

function deleteSubmission(submissionId, token) {
  const editor = auth.requireEditor(token);

  return runWithLock_(function () {
    const rec = findSubmissionRecord_(submissionId);
    if (!rec) throw new Error('Submission not found.');

    deleteSubmissionAttachments_(rec.id);
    db.prepare('DELETE FROM submissions WHERE id = ?').run(rec.id);

    try { require('./audit').logAudit_(ACTIONS.SUBMISSION_DELETE, rec.cardRow, { id: submissionId, text: rec.text }, editor.email); } catch (err) {}
    try { require('./data-sync').requestBackup(); } catch (err) {}
    return submissionsForCard_(rec.cardRow, editor);
  });
}

function markAllSubmissionsRead(token) {
  const admin = auth.requireAdmin(token);

  db.prepare('UPDATE submissions SET read_at = ? WHERE read_at = 0').run(Date.now());

  try { require('./audit').logAudit_(ACTIONS.SUBMISSION_READ_ALL, '', 'Marked all submissions as read', admin.email); } catch (err) {}
  try { require('./data-sync').requestBackup(); } catch (err) {}
  return getSubmissionOverview_(admin);
}

function toggleSubmissionDisplay(submissionId, token) {
  const admin = auth.requireAdmin(token);

  return runWithLock_(function () {
    const rec = findSubmissionRecord_(submissionId);
    if (!rec) throw new Error('Submission not found.');

    const next = !rec.displayed;
    db.prepare('UPDATE submissions SET displayed = ? WHERE id = ?').run(next ? 1 : 0, rec.id);

    try { require('./audit').logAudit_(next ? ACTIONS.SUBMISSION_DISPLAY : ACTIONS.SUBMISSION_HIDE, rec.cardRow, { id: submissionId }, admin.email); } catch (err) {}
    return submissionsForCard_(rec.cardRow, admin);
  });
}

module.exports = {
  getSubmissionOverview_,
  getSubmissions,
  addSubmission,
  updateSubmission,
  lockSubmission,
  unlockSubmission,
  deleteSubmission,
  markAllSubmissionsRead,
  toggleSubmissionDisplay,
  officeForEmail: officeForEmail_,
  // Persist promptly (see records.js bumpDataGeneration_): the KV snapshot is
  // what Render restores on boot, so submission writes must reach it within
  // seconds, not up to the auto-sync interval.
  requestBackup: function () { try { require('./data-sync').requestBackup(); } catch (e) {} }
};

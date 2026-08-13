/**
 * ============================================================
 * India Post Dashboard — Node port
 * submissions.js
 * Viewer/editor updates submitted against dashboard records
 * (port of Submissions.gs against the 'submissions' table).
 * ============================================================
 */

const { db } = require('./db');
const { CONFIG, ROLES, ACTIONS } = require('./config');
const { uuid_, now_, formatDate_, runWithLock_ } = require('./helpers');
const auth = require('./auth');

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
    readAt: row.read_at || 0
  };
}

function readSubmissionRows_() {
  return db.prepare('SELECT * FROM submissions').all().map(submissionRecordFromRow_);
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

function getSubmissionOverview_() {
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
      displayed.push({
        cardRow: key,
        email: rec.email,
        text: rec.text,
        createdAt: formatDateTime_(rec.createdAt)
      });
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

function addSubmission(cardRow, cardId, text, token) {
  const user = auth.requireLogin(token);
  cardRow = Number(cardRow);
  if (!cardRow || isNaN(cardRow) || cardRow <= 0) throw new Error('Invalid record reference.');
  const content = String(text || '').trim();
  if (!content) throw new Error('Write your update before submitting.');
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

    try { require('./audit').logAudit_(ACTIONS.SUBMISSION_ADD, cardRow, { id: id, cardRow: cardRow, text: content }, user.email); } catch (err) {}
    try {
      require('./notifications').notifyStaffLocked_('submission', 'New submission', 'Update submitted on record #' + cardRow + ' by ' + user.email + '.', '', user.email);
    } catch (err) {}
    return submissionsForCard_(cardRow, user);
  });
}

function updateSubmission(submissionId, text, token) {
  const user = auth.requireLogin(token);
  const content = String(text || '').trim();
  if (!content) throw new Error('Write your update before saving.');
  if (content.length > CONFIG.SUBMISSIONS.MAX_TEXT_LENGTH) {
    throw new Error('Submission is too long (max ' + CONFIG.SUBMISSIONS.MAX_TEXT_LENGTH + ' characters).');
  }

  return runWithLock_(function () {
    const rec = findSubmissionRecord_(submissionId);
    if (!rec) throw new Error('Submission not found.');
    assertCanEditSubmission_(user, rec);

    db.prepare('UPDATE submissions SET text = ?, updated_at = ? WHERE id = ?').run(content, Date.now(), rec.id);

    try { require('./audit').logAudit_(ACTIONS.SUBMISSION_UPDATE, rec.cardRow, { id: submissionId, text: content }, user.email); } catch (err) {}
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
  const admin = auth.requireAdmin(token);

  return runWithLock_(function () {
    const rec = findSubmissionRecord_(submissionId);
    if (!rec) throw new Error('Submission not found.');

    db.prepare('DELETE FROM submissions WHERE id = ?').run(rec.id);

    try { require('./audit').logAudit_(ACTIONS.SUBMISSION_DELETE, rec.cardRow, { id: submissionId, text: rec.text }, admin.email); } catch (err) {}
    return submissionsForCard_(rec.cardRow, admin);
  });
}

function markAllSubmissionsRead(token) {
  const admin = auth.requireAdmin(token);

  db.prepare('UPDATE submissions SET read_at = ? WHERE read_at = 0').run(Date.now());

  try { require('./audit').logAudit_(ACTIONS.SUBMISSION_READ_ALL, '', 'Marked all submissions as read', admin.email); } catch (err) {}
  return getSubmissionOverview_();
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
  toggleSubmissionDisplay
};

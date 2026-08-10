/**
 * ============================================================
 * India Post Dashboard — Node port
 * workflow.js
 * Approval workflow engine (port of Workflow.gs against the
 * 'approvals' table).
 * ============================================================
 */

const { db } = require('./db');
const { CONFIG, ROLES, APPROVAL_STATUS, WORKFLOW_TYPES, NOTIFICATION_TYPES, ACTIONS } = require('./config');
const { uuid_, now_, runWithLock_ } = require('./helpers');
const auth = require('./auth');

function approvalRecordFromRow_(row) {
  return {
    id: String(row.id || ''),
    module: String(row.module || 'records'),
    type: String(row.type || 'RECORD_REVIEW'),
    targetRow: Number(row.target_row) || 0,
    targetId: String(row.target_id || ''),
    summary: String(row.summary || ''),
    submittedBy: String(row.submitted_by || '').toLowerCase(),
    submittedAt: row.submitted_at ? Number(row.submitted_at) : 0,
    status: String(row.status || APPROVAL_STATUS.PENDING),
    reviewedBy: String(row.reviewed_by || '').toLowerCase(),
    reviewedAt: row.reviewed_at ? Number(row.reviewed_at) : 0,
    comment: String(row.comment || '')
  };
}

function findApproval_(id) {
  const row = db.prepare('SELECT * FROM approvals WHERE id = ?').get(String(id));
  return row ? approvalRecordFromRow_(row) : null;
}

function isApprover_(email) {
  email = String(email || '').toLowerCase().trim();
  if (!email) return false;
  if (auth.isAdmin(email)) return true;
  const groups = auth.getUserGroups(email);
  return groups.indexOf('APPROVER') !== -1;
}

function requireApprover_(token) {
  const user = auth.requireLogin(token);
  if (!isApprover_(user.email)) throw new Error('Approver permission required.');
  return user;
}

function submitRecordReview(targetRow, summary, token) {
  const submitter = auth.requireEditor(token);
  targetRow = Number(targetRow);
  if (!targetRow || targetRow < CONFIG.SHEET.START_ROW) throw new Error('Invalid record row.');
  const summaryText = String(summary || '').trim();
  if (!summaryText) throw new Error('Provide a summary for the review request.');

  return runWithLock_(function () {
    const id = uuid_();
    const now = Date.now();
    db.prepare(
      'INSERT INTO approvals (id, module, type, target_row, target_id, summary, submitted_by, submitted_at, status, reviewed_by, reviewed_at, comment) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, 'records', WORKFLOW_TYPES.RECORD_REVIEW.key, targetRow, '', summaryText, submitter.email, now, APPROVAL_STATUS.PENDING, '', null, '');

    try {
      require('./notifications').notifyStaffLocked_(NOTIFICATION_TYPES.SYSTEM, 'Approval requested', 'Editor ' + submitter.email + ' requested review for record row ' + targetRow + ': ' + summaryText, '', submitter.email);
    } catch (err) {}

    return approvalRecordFromRow_({
      id: id, module: 'records', type: WORKFLOW_TYPES.RECORD_REVIEW.key, target_row: targetRow, target_id: '',
      summary: summaryText, submitted_by: submitter.email, submitted_at: now, status: APPROVAL_STATUS.PENDING,
      reviewed_by: '', reviewed_at: null, comment: ''
    });
  });
}

function getPendingApprovals(token) {
  const user = auth.requireLogin(token);
  if (!isApprover_(user.email)) return [];
  const rows = db.prepare('SELECT * FROM approvals WHERE status = ?').all(APPROVAL_STATUS.PENDING).map(approvalRecordFromRow_);
  rows.sort(function (a, b) { return b.submittedAt - a.submittedAt; });
  return rows;
}

function getMyApprovals(token) {
  const user = auth.requireLogin(token);
  const rows = db.prepare('SELECT * FROM approvals').all().map(approvalRecordFromRow_);
  const out = [];
  rows.forEach(function (rec) {
    if (rec.submittedBy !== user.email && rec.reviewedBy !== user.email) return;
    out.push(rec);
  });
  out.sort(function (a, b) { return b.submittedAt - a.submittedAt; });
  return out;
}

function reviewApproval(id, approve, comment, token) {
  const reviewer = requireApprover_(token);
  id = String(id || '').trim();
  if (!id) throw new Error('Approval id required.');

  return runWithLock_(function () {
    const rec = findApproval_(id);
    if (!rec) throw new Error('Approval not found.');
    if (rec.status !== APPROVAL_STATUS.PENDING) throw new Error('Approval is already ' + rec.status.toLowerCase() + '.');
    if (rec.submittedBy === reviewer.email) throw new Error('You cannot review your own approval request.');

    const now = Date.now();
    const newStatus = approve ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.REJECTED;
    db.prepare(
      'UPDATE approvals SET reviewed_by = ?, reviewed_at = ?, status = ?, comment = ? WHERE id = ?'
    ).run(reviewer.email, now, newStatus, String(comment || ''), id);

    if (approve && rec.type === WORKFLOW_TYPES.RECORD_REVIEW.key) {
      const records = require('./records');
      const existing = db.prepare('SELECT row FROM records WHERE row = ?').get(rec.targetRow);
      if (existing) {
        db.prepare('UPDATE records SET review_bg = ? WHERE row = ?').run(CONFIG.COLORS.REVIEW_DONE, rec.targetRow);
        records.invalidateDataCache();
        try { require('./audit').logAudit_(ACTIONS.REVIEW_DONE, String(rec.targetRow), 'Approval workflow: review marked done', reviewer.email); } catch (err) {}
      }
      try {
        require('./notifications').notify_(rec.submittedBy, NOTIFICATION_TYPES.SYSTEM, 'Review approved', 'Your review request for record row ' + rec.targetRow + ' was approved.' + (comment ? ' Comment: ' + comment : ''), '');
      } catch (err) {}
    } else if (!approve) {
      try {
        require('./notifications').notify_(rec.submittedBy, NOTIFICATION_TYPES.SYSTEM, 'Review rejected', 'Your review request for record row ' + rec.targetRow + ' was rejected.' + (comment ? ' Comment: ' + comment : ''), '');
      } catch (err) {}
    }

    return approvalRecordFromRow_({
      id: id, module: rec.module, type: rec.type, target_row: rec.targetRow, target_id: rec.targetId,
      summary: rec.summary, submitted_by: rec.submittedBy, submitted_at: rec.submittedAt, status: newStatus,
      reviewed_by: reviewer.email, reviewed_at: now, comment: String(comment || '')
    });
  });
}

module.exports = {
  isApprover_,
  submitRecordReview,
  getPendingApprovals,
  getMyApprovals,
  reviewApproval
};

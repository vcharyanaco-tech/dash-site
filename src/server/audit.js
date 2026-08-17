/**
 * ============================================================
 * India Post Dashboard — Node port
 * audit.js
 * Audit log (port of Audit.gs against the 'audit' table).
 * ============================================================
 */

const { db } = require('./db');
const { ACTIONS } = require('./config');
const { now_ } = require('./helpers');
const auth = require('./auth');

function logAudit_(action, id, details, userEmail) {
  try {
    db.prepare(
      'INSERT INTO audit (timestamp, user, action, record_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(
      now_().getTime(),
      userEmail || auth.getCurrentUser(),
      action || '',
      id === null || id === undefined ? '' : String(id),
      typeof details === 'string' ? details : JSON.stringify(details)
    );
  } catch (err) {
    // ignore
  }
}

function auditTimestampMs_(value) {
  const t = Number(value);
  return isFinite(t) ? t : 0;
}

function getAuditEntries(limit) {
  auth.requireViewer();
  const rows = db.prepare('SELECT * FROM audit').all();
  return rows
    .map(function (r, i) {
      const ts = auditTimestampMs_(r.timestamp);
      return {
        row: r.id,
        timestamp: r.timestamp ? String(r.timestamp) : '',
        timestampMs: ts,
        user: r.user || '',
        action: r.action || '',
        recordId: r.record_id || '',
        details: r.details || ''
      };
    })
    .sort(function (a, b) { return b.timestampMs - a.timestampMs || a.row - b.row; })
    .slice(0, limit || 100);
}

function adminDeleteAuditRows(rowNumbers, token) {
  const admin = auth.requireAdmin(token);
  const rows = (rowNumbers || [])
    .map(function (n) { return Number(n); })
    .filter(function (n) { return isFinite(n) && n >= 1; });
  if (!rows.length) throw new Error('No audit entries selected.');
  const stmt = db.prepare('DELETE FROM audit WHERE id = ?');
  rows.forEach(function (r) { stmt.run(r); });
  try { logAudit_(ACTIONS.AUDIT_DELETE, '', 'Deleted ' + rows.length + ' audit entries', admin.email); } catch (err) {}
  return getAuditEntries(80);
}

function adminClearAudit(token) {
  const admin = auth.requireAdmin(token);
  db.prepare('DELETE FROM audit').run();
  try { logAudit_(ACTIONS.AUDIT_CLEAR, '', 'Cleared the entire audit log', admin.email); } catch (err) {}
  return getAuditEntries(80);
}

/* Replaces the GAS daily `archiveAuditLog` trigger: moves audit rows older
   than ARCHIVE_AFTER_DAYS into the audit_archive table (bounded batch per
   run) so the live audit log stays small and fast. Called by the daily
   internal job (worker cron) — no token required, it is not exposed through
   the public dispatch. Idempotent and never throws. */
function archiveAuditLog() {
  const ARCHIVE_AFTER_DAYS = 90;
  const ARCHIVE_BATCH_SIZE = 400;
  const cutoff = Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const oldRows = db.prepare(
    'SELECT id, timestamp, user, action, record_id, details FROM audit WHERE timestamp <= ? ORDER BY id LIMIT ?'
  ).all(cutoff, ARCHIVE_BATCH_SIZE);
  if (!oldRows.length) return { archived: 0, batchLimitReached: false };
  const ins = db.prepare(
    'INSERT INTO audit_archive (id, timestamp, user, action, record_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const del = db.prepare('DELETE FROM audit WHERE id = ?');
  const moveAll = db.transaction(function (rows) {
    rows.forEach(function (r) {
      ins.run(r.id, r.timestamp, r.user, r.action, r.record_id, r.details);
      del.run(r.id);
    });
  });
  try {
    moveAll(oldRows);
  } catch (err) {
    // rollback happens automatically on throw; report and keep the live log
    return { archived: 0, batchLimitReached: false, error: (err && err.message) || String(err) };
  }
  return { archived: oldRows.length, batchLimitReached: oldRows.length === ARCHIVE_BATCH_SIZE };
}

module.exports = {
  logAudit_,
  getAuditEntries,
  adminDeleteAuditRows,
  adminClearAudit,
  archiveAuditLog
};

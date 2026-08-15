/**
 * ============================================================
 * India Post Dashboard — Node port
 * full-backup.js
 * Admin-only full backup: a VACUUM'd standalone copy of the live
 * SQLite DB (records, submissions, tasks, users, audit, settings,
 * documents) returned as base64 for a one-click download. No new
 * dependencies — the same VACUUM INTO trick the KV bridge uses.
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const auth = require('./auth');

const DATA_DIR = process.env.DASH_DATA_DIR || path.join(__dirname, '..', '..', 'data');

async function exportFullBackup(token) {
  auth.requireAdmin(token);
  const { db } = require('./db');
  const tmp = path.join(DATA_DIR, '.full-backup-tmp.db');
  try { fs.unlinkSync(tmp); } catch (err) {}
  try {
    // Single-quoted SQL string: SQLite parses double quotes as an identifier,
    // so JSON.stringify (double quotes) would fail. Standalone, consistent
    // snapshot — safe with WAL + live traffic.
    db.exec("VACUUM INTO '" + String(tmp).replace(/'/g, "''") + "'");
  } catch (vacErr) {
    // better-sqlite3 >= 12: db.backup() is async.
    await db.backup(tmp);
  }
  let bytes;
  try {
    bytes = fs.readFileSync(tmp);
  } catch (err) {
    return { success: false, message: 'Could not build the backup file.' };
  } finally {
    try { fs.unlinkSync(tmp); } catch (err) {}
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    success: true,
    name: 'india-post-dashboard-backup-' + stamp + '.db',
    mimeType: 'application/x-sqlite3',
    size: bytes.length,
    base64: bytes.toString('base64'),
    note: 'Full SQLite database — open with any SQLite tool to inspect or restore.'
  };
}

module.exports = { exportFullBackup };

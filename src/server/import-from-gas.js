/**
 * ============================================================
 * India Post Dashboard — Migration importer
 * import-from-gas.js
 * Idempotent loader that moves live spreadsheet data into the
 * SQLite backend, preserving record `row` numbers so display IDs
 * stay stable.
 *
 * Usage:
 *   1. In Google Sheets, export each tab as CSV:
 *        Sheet1        -> data/export/records.csv
 *        Users         -> data/export/users.csv
 *        Tasks         -> data/export/tasks.csv
 *        Submissions   -> data/export/submissions.csv
 *        Notifications -> data/export/notifications.csv
 *        Audit Log     -> data/export/audit.csv
 *        Documents     -> data/export/documents.csv
 *   2. node import-from-gas.js
 *
 * Row rules (matches GAS):
 *   - records.csv optionally has a header row (auto-detected), then data
 *     starting at the sheet's START_ROW. We map the spreadsheet's physical
 *     row number = START_ROW + i so display id = row - START_ROW + 1,
 *     exactly as in the live app.
 *   - All other sheets are keyed by their Id column; existing rows are skipped.
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const { db } = require('./db');
const { CONFIG } = require('./config');

const EXPORT_DIR = process.env.DASH_IMPORT_DIR || path.join(__dirname, '..', '..', 'data', 'export');

// RFC-4180-style CSV parser. Handles quoted fields containing commas,
// embedded newlines (LF/CRLF) and escaped quotes (""), which the old
// split(',')/split('\n') approach mangled for multi-line action/text fields.
function parseCsv(text) {
  // Strip a UTF-8 BOM if present.
  if (text && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text ? text.length : 0;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; }  // escaped quote
        else { inQuotes = false; i++; }
      } else {
        field += c;
        i++;
      }
      continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      // consume a following \n so CRLF is treated as a single newline
      if (text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // Flush the final field/row when the file does not end with a newline.
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function readCsv(file) {
  const p = path.join(EXPORT_DIR, file);
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf8');
  const rows = parseCsv(text);
  if (!rows.length) return [];
  return rows;
}

function isHeader(row) {
  if (!row || !row.length) return false;
  const joined = row.join(' ').toLowerCase();
  return joined.includes('sector') && joined.includes('description');
}

// Skips leading rows until the header row (first cell === headerKey,
// case-insensitive) and returns the data rows after it. Handles exports that
// start with a stray artifact row (e.g. a column-letter row) before the real
// header. If no header row is found, returns the rows unchanged.
function stripHeader(rows, headerKey) {
  if (!rows || !rows.length) return rows;
  const key = String(headerKey || '').toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').toLowerCase() === key) {
      return rows.slice(i + 1);
    }
  }
  return rows;
}

function importRecords() {
  const rows = readCsv('records.csv');
  if (!rows) { console.log('records.csv: skipped (not found)'); return 0; }
  let data = rows;
  if (data.length && isHeader(data[0])) data = data.slice(1);

  // Opt-in full re-seed: DASH_IMPORT_RESET=1 or --reset deletes existing
  // records first, so a re-run can repair a DB seeded by an earlier buggy
  // import (INSERT OR IGNORE alone would skip rows whose `row` already
  // exists). One-time use: it overwrites any manual record edits.
  const reset = process.env.DASH_IMPORT_RESET === '1' ||
    process.argv.indexOf('--reset') !== -1;
  if (reset) {
    db.prepare('DELETE FROM records').run();
    console.log('records: existing rows cleared (DASH_IMPORT_RESET / --reset)');
  }

  const startRow = CONFIG.SHEET.START_ROW;
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO records (row, sector, description, entry_date, action, responsibility, review_date, links, review_bg, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  let n = 0;
  data.forEach(function (cols, i) {
    const row = startRow + i;
    const reviewBg = String(cols[6] || '').trim() === '' ? CONFIG.COLORS.NORMAL : CONFIG.COLORS.NORMAL;
    stmt.run(
      row,
      String(cols[1] || '').trim(),
      String(cols[2] || '').trim(),
      String(cols[3] || '').trim(),
      String(cols[4] || '').trim(),
      String(cols[5] || '').trim(),
      String(cols[6] || '').trim(),
      '{}',
      reviewBg,
      Date.now(),
      Date.now()
    );
    n++;
  });
  console.log('records: ' + n + ' row(s) processed (existing rows ignored)');
  return n;
}

function importUsers() {
  const rows = readCsv('users.csv');
  if (!rows) { console.log('users.csv: skipped (not found)'); return 0; }
  const data = stripHeader(rows, 'email');
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO users (email, role, salt, password_hash, must_change, created_by, created_at, reset_token, reset_expires, group_name, department, office, preferences, reset_requested, username) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  let n = 0;
  data.forEach(function (c) {
    stmt.run(
      String(c[0] || '').trim().toLowerCase(),
      String(c[1] || 'VIEWER').toUpperCase(),
      String(c[2] || ''),
      String(c[3] || ''),
      Number(c[4]) ? 1 : 0,
      String(c[5] || ''),
      Number(c[6]) || Date.now(),
      String(c[7] || ''),
      Number(c[8]) || 0,
      String(c[9] || ''),
      String(c[10] || ''),
      String(c[11] || ''),
      String(c[12] || ''),
      String(c[13] || ''),
      String(c[14] || '')
    );
    n++;
  });
  console.log('users: ' + n + ' row(s) processed');
  return n;
}

function importTasks() {
  const rows = readCsv('tasks.csv');
  if (!rows) { console.log('tasks.csv: skipped (not found)'); return 0; }
  const data = stripHeader(rows, 'id');
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO tasks (id, record_row, record_id, title, description, assignee, status, priority, due_date, created_by, created_at, updated_at, completed_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  let n = 0;
  data.forEach(function (c) {
    stmt.run(
      String(c[0] || ''),
      Number(c[1]) || 0,
      String(c[2] || ''),
      String(c[3] || ''),
      String(c[4] || ''),
      String(c[5] || ''),
      String(c[6] || 'OPEN').toUpperCase(),
      String(c[7] || 'MEDIUM').toUpperCase(),
      Number(c[8]) || null,
      String(c[9] || ''),
      Number(c[10]) || Date.now(),
      Number(c[11]) || Date.now(),
      Number(c[12]) || null
    );
    n++;
  });
  console.log('tasks: ' + n + ' row(s) processed');
  return n;
}

function importSubmissions() {
  const rows = readCsv('submissions.csv');
  if (!rows) { console.log('submissions.csv: skipped (not found)'); return 0; }
  const data = stripHeader(rows, 'id');
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, locked_by, locked_at, displayed) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  let n = 0;
  data.forEach(function (c) {
    stmt.run(
      String(c[0] || ''),
      Number(c[1]) || 0,
      String(c[2] || ''),
      String(c[3] || ''),
      String(c[4] || ''),
      Number(c[5]) || Date.now(),
      Number(c[6]) || Date.now(),
      String(c[7] || ''),
      Number(c[8]) || 0,
      Number(c[9]) ? 1 : 0
    );
    n++;
  });
  console.log('submissions: ' + n + ' row(s) processed');
  return n;
}

function importNotifications() {
  const rows = readCsv('notifications.csv');
  if (!rows) { console.log('notifications.csv: skipped (not found)'); return 0; }
  const data = stripHeader(rows, 'id');
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO notifications (id, email, type, title, body, link, created_at, read_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  let n = 0;
  data.forEach(function (c) {
    stmt.run(
      String(c[0] || ''),
      String(c[1] || ''),
      String(c[2] || 'system'),
      String(c[3] || ''),
      String(c[4] || ''),
      String(c[5] || ''),
      Number(c[6]) || Date.now(),
      Number(c[7]) || null
    );
    n++;
  });
  console.log('notifications: ' + n + ' row(s) processed');
  return n;
}

function importAudit() {
  const rows = readCsv('audit.csv');
  if (!rows) { console.log('audit.csv: skipped (not found)'); return 0; }
  const data = stripHeader(rows, 'timestamp');
  const stmt = db.prepare(
    'INSERT INTO audit (timestamp, user, action, record_id, details) VALUES (?, ?, ?, ?, ?)'
  );
  let n = 0;
  data.forEach(function (c) {
    stmt.run(
      Number(c[0]) || Date.now(),
      String(c[1] || ''),
      String(c[2] || ''),
      String(c[3] || ''),
      String(c[4] || '')
    );
    n++;
  });
  console.log('audit: ' + n + ' row(s) appended');
  return n;
}

function importDocuments() {
  const rows = readCsv('documents.csv');
  if (!rows) { console.log('documents.csv: skipped (not found)'); return 0; }
  const data = stripHeader(rows, 'id');
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO documents (id, record_row, record_id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  let n = 0;
  data.forEach(function (c) {
    stmt.run(
      String(c[0] || ''),
      Number(c[1]) || 0,
      String(c[2] || ''),
      String(c[3] || ''),
      String(c[4] || ''),
      String(c[5] || ''),
      Number(c[6]) || 0,
      String(c[7] || ''),
      Number(c[8]) || Date.now()
    );
    n++;
  });
  console.log('documents: ' + n + ' row(s) processed (file_key must match data/uploads/)');
  return n;
}

function main() {
  console.log('Import source dir: ' + EXPORT_DIR);
  if (!fs.existsSync(EXPORT_DIR)) {
    console.log('Export directory not found. Create it and drop the CSV files there.');
    console.log('Expected: records.csv, users.csv, tasks.csv, submissions.csv,');
    console.log('          notifications.csv, audit.csv, documents.csv');
    process.exit(1);
  }
  const t0 = Date.now();
  importRecords();
  importUsers();
  importTasks();
  importSubmissions();
  importNotifications();
  importAudit();
  importDocuments();
  console.log('Import finished in ' + (Date.now() - t0) + 'ms.');
  const counts = {
    records: db.prepare('SELECT COUNT(*) c FROM records').get().c,
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    tasks: db.prepare('SELECT COUNT(*) c FROM tasks').get().c,
    submissions: db.prepare('SELECT COUNT(*) c FROM submissions').get().c,
    notifications: db.prepare('SELECT COUNT(*) c FROM notifications').get().c,
    audit: db.prepare('SELECT COUNT(*) c FROM audit').get().c,
    documents: db.prepare('SELECT COUNT(*) c FROM documents').get().c
  };
  console.log('Database row counts: ' + JSON.stringify(counts));
}

if (require.main === module) main();

module.exports = { main, readCsv };

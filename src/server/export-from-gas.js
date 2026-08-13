/**
 * ============================================================
 * India Post Dashboard — Migration: live sheet -> CSV export
 * export-from-gas.js
 * Reads the live Google Spreadsheet via the gviz JSON endpoint
 * (authenticated with a session cookie) and writes one CSV per
 * tab into data/export/, ready for `node import-from-gas.js`.
 *
 * This is a ONE-TIME migration helper. Cookie is read from
 * DASH_GAS_COOKIE env var (never hardcoded, never committed).
 *
 * Usage:
 *   $env:DASH_SPREADSHEET_ID = "1xQa...y8"
 *   $env:DASH_GAS_COOKIE = "SID=...; __Secure-1PSID=...; ..."
 *   node export-from-gas.js
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SPREADSHEET_ID = process.env.DASH_SPREADSHEET_ID;
const COOKIE = process.env.DASH_GAS_COOKIE;
const EXPORT_DIR = process.env.DASH_IMPORT_DIR || path.join(__dirname, '..', '..', 'data', 'export');

if (!SPREADSHEET_ID || !COOKIE) {
  console.error('Set DASH_SPREADSHEET_ID and DASH_GAS_COOKIE environment variables.');
  process.exit(1);
}
fs.mkdirSync(EXPORT_DIR, { recursive: true });

const SHEETS = [
  { name: 'Sheet1', file: 'records.csv', header: false },
  { name: 'Users', file: 'users.csv', header: true },
  { name: 'Tasks', file: 'tasks.csv', header: true },
  { name: 'Submissions', file: 'submissions.csv', header: true },
  { name: 'Notifications', file: 'notifications.csv', header: true },
  { name: 'Audit Log', file: 'audit.csv', header: true },
  { name: 'Documents', file: 'documents.csv', header: true },
];

function fetchGviz(sheetName) {
  return new Promise(function (resolve, reject) {
    const enc = encodeURIComponent(sheetName);
    const url = 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID +
      '/gviz/tq?tqx=out:json&sheet=' + enc;
    const req = https.get(url, {
      headers: { Cookie: COOKIE, 'User-Agent': 'Mozilla/5.0' }
    }, function (res) {
      let body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' for ' + sheetName));
        resolve(body);
      });
    });
    req.on('error', reject);
  });
}

// gviz wraps JSON in /*O_o*/ google.visualization.Query.setResponse({...});
function parseGviz(text) {
  let t = text.trim();
  // Strip a leading comment like /*O_o*/
  t = t.replace(/^\/\*O_o\*\//, '').trim();
  // Strip "google.visualization.Query.setResponse(" ... ");"
  const marker = 'setResponse(';
  const idx = t.indexOf(marker);
  if (idx !== -1) {
    t = t.slice(idx + marker.length);
    // drop trailing ); (allowing whitespace/comments)
    t = t.replace(/\);\s*$/, '');
  }
  return JSON.parse(t);
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(resp, withHeader) {
  const cols = resp.table.cols;
  const rows = resp.table.rows;
  const lines = [];
  if (withHeader) {
    lines.push(cols.map(function (c) { return csvCell(c.label || c.id); }).join(','));
  }
  rows.forEach(function (row) {
    const cells = row.c.map(function (cell) {
      if (!cell) return '';
      // prefer formatted value, fall back to raw
      if (cell.f !== null && cell.f !== undefined && cell.f !== '') return cell.f;
      if (cell.v === null || cell.v === undefined) return '';
      return cell.v;
    });
    lines.push(cells.map(csvCell).join(','));
  });
  return lines.join('\n');
}

async function main() {
  for (const s of SHEETS) {
    try {
      const text = await fetchGviz(s.name);
      const resp = parseGviz(text);
      if (resp.status === 'error') {
        console.log(s.file + ': gviz error -> ' + (resp.errors && resp.errors[0] && resp.errors[0].detailed_message));
        continue;
      }
      const csv = toCsv(resp, s.header);
      fs.writeFileSync(path.join(EXPORT_DIR, s.file), csv, 'utf8');
      const n = resp.table.rows.length;
      console.log(s.file + ': wrote ' + n + ' row(s) from "' + s.name + '"');
    } catch (err) {
      console.log(s.file + ': FAILED -> ' + err.message);
    }
  }
  console.log('Done. CSVs in ' + EXPORT_DIR);
}

main();

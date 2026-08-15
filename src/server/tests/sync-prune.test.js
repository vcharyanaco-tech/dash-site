// Guarded prune: pullFromSheet removes DB rows that fell outside the sheet's
// previously-seen extent (owner deleted rows), but never rows the app created
// (nextRow_() = MAX(row)+1, which lies beyond the sheet until push writes it).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const TMP = path.join('D:/tmp', 'sync-prune-' + Date.now());
process.env.DASH_DATA_DIR = TMP;
fs.mkdirSync(TMP, { recursive: true });

const { db } = require('../db');
const settings = require('../settings');
const sync = require('../sync-sheet');

const START_ROW = 4;

function gvizText(rowCount) {
  const rows = [];
  for (let i = 1; i <= rowCount; i++) {
    rows.push({ c: [
      { f: String(i), v: i },
      { v: 'Sector ' + i },
      { v: 'Description ' + i },
      { v: '01.08.2026' },
      { v: 'Action ' + i },
      { v: 'Resp ' + i },
      { v: '15.08.2026' }
    ] });
  }
  const payload = JSON.stringify({ status: 'ok', table: { rows } });
  return '/*O_o*/\ngoogle.visualization.Query.setResponse(' + payload + ');';
}

test('guarded prune: deletes stale rows, keeps app-created rows', async () => {
  // Seed the DB as if a previous sync had stored 21 sheet rows (rows 4-24).
  const insert = db.prepare('INSERT INTO records (row, sector, description, entry_date, action, responsibility, review_date, links, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (let i = 1; i <= 21; i++) {
    const row = START_ROW + i - 1;
    insert.run(row, 'Sector ' + i, 'Description ' + i, '01.08.2026', 'Action ' + i, 'Resp ' + i, '15.08.2026', '{}', Date.now(), Date.now());
  }
  // Mark the previously-seen sheet extent (rows 4-24 = 21 rows).
  settings.set('sync.prevSheetLastRow', String(START_ROW + 21 - 1));

  // Simulate: the owner deleted one row in the sheet — now only 20 rows (4-23).
  const originalFetch = global.fetch;
  global.fetch = async function (url) {
    if (String(url).includes('/gviz/tq')) {
      return { ok: true, text: async () => gvizText(20) };
    }
    throw new Error('unexpected fetch: ' + url);
  };

  // Add an app-created record at row 25 (beyond the sheet extent) — must survive.
  db.prepare('INSERT INTO records (row, sector, description, entry_date, action, responsibility, review_date, links, created_at, updated_at) VALUES (25, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('App-created', '', '', '', '', '', '{}', Date.now(), Date.now());

  const result = await sync.pullFromSheet();
  assert.strictEqual(result.sheetRows, 20, 'sheet has 20 rows');
  assert.ok(result.pruned >= 1, 'stale row 24 pruned, got pruned=' + result.pruned);

  const remaining = db.prepare('SELECT row, sector FROM records ORDER BY row').all();
  const rows = remaining.map(r => r.row);
  assert.ok(!rows.includes(24), 'stale row 24 removed');
  assert.ok(rows.includes(25), 'app-created row 25 kept');
  assert.strictEqual(rows.length, 21, '20 sheet rows + 1 app row');

  global.fetch = originalFetch;

  // After this pull the new extent (row 23) is recorded.
  assert.strictEqual(settings.getString('sync.prevSheetLastRow'), String(START_ROW + 20 - 1));
});

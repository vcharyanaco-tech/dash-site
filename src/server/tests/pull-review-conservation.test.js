// Guard: a sheet pull must never wipe local review state. Unchanged rows keep
// their review_bg and updated_at untouched; a changed row keeps its review
// colour (only a review action changes it) but gets a fresh updated_at; a
// brand-new sheet row arrives with the NORMAL colour.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), 'pull-review-conservation-' + Date.now());
process.env.DASH_DATA_DIR = TMP;
fs.mkdirSync(TMP, { recursive: true });

const { db } = require('../db');
const settings = require('../settings');
const sync = require('../sync-sheet');
const { CONFIG } = require('../config');

const START_ROW = 4;

function gvizText(rowCount, changeRowId) {
  const rows = [];
  for (let i = 1; i <= rowCount; i++) {
    rows.push({ c: [
      { f: String(i), v: i },
      { v: 'Sector ' + i },
      { v: 'Description ' + i },
      { v: '01.08.2026' },
      { v: i === changeRowId ? 'Action ' + i + ' CHANGED' : 'Action ' + i },
      { v: 'Resp ' + i },
      { v: '15.08.2026' }
    ] });
  }
  const payload = JSON.stringify({ status: 'ok', table: { rows } });
  return '/*O_o*/\ngoogle.visualization.Query.setResponse(' + payload + ');';
}

function installFetch(gvizTextFn) {
  const originalFetch = global.fetch;
  global.fetch = async function (url) {
    if (String(url).includes('/gviz/tq')) {
      return { ok: true, text: async () => gvizTextFn() };
    }
    throw new Error('unexpected fetch: ' + url);
  };
  return originalFetch;
}

function seed() {
  db.prepare('DELETE FROM records').run();
  const now = 1700000000000;
  const insRec = db.prepare(
    'INSERT INTO records (row, record_id, sector, description, entry_date, action, responsibility, review_date, links, review_bg, source, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  // Row 1: unchanged, review done.
  insRec.run(START_ROW, 'row1-uuid', 'Sector 1', 'Description 1', '01.08.2026', 'Action 1', 'Resp 1', '15.08.2026', '{}', CONFIG.COLORS.REVIEW_DONE, 'sheet', now, now);
  // Row 2: unchanged, normal.
  insRec.run(START_ROW + 1, 'row2-uuid', 'Sector 2', 'Description 2', '01.08.2026', 'Action 2', 'Resp 2', '15.08.2026', '{}', CONFIG.COLORS.NORMAL, 'sheet', now, now);
  // Row 3: will be changed by the sheet (action text).
  insRec.run(START_ROW + 2, 'row3-uuid', 'Sector 3', 'Description 3', '01.08.2026', 'Action 3 OLD', 'Resp 3', '15.08.2026', '{}', CONFIG.COLORS.REVIEW_DONE, 'sheet', now, now);
  settings.set('sync.prevSheetLastRow', String(START_ROW + 2));
}

test('pull preserves review_bg and updated_at on unchanged rows, keeps colour on changed rows', async function () {
  seed();

  const originalFetch = installFetch(function () { return gvizText(4, 3); });
  const result = await sync.pullFromSheet();
  global.fetch = originalFetch;

  assert.strictEqual(result.sheetRows, 4);

  const row1 = db.prepare('SELECT * FROM records WHERE row = ?').get(START_ROW);
  assert.strictEqual(row1.review_bg, CONFIG.COLORS.REVIEW_DONE, 'unchanged review-done row keeps its colour');
  assert.strictEqual(row1.updated_at, 1700000000000, 'unchanged row keeps its updated_at');

  const row2 = db.prepare('SELECT * FROM records WHERE row = ?').get(START_ROW + 1);
  assert.strictEqual(row2.review_bg, CONFIG.COLORS.NORMAL, 'unchanged normal row stays normal');

  const row3 = db.prepare('SELECT * FROM records WHERE row = ?').get(START_ROW + 2);
  assert.strictEqual(row3.action, 'Action 3 CHANGED', 'changed content pulled in');
  assert.strictEqual(row3.review_bg, CONFIG.COLORS.REVIEW_DONE, 'review colour survives a content change');
  assert.ok(Number(row3.updated_at) > 1700000000000, 'changed row gets a fresh updated_at');

  const row4 = db.prepare('SELECT * FROM records WHERE row = ?').get(START_ROW + 3);
  assert.ok(row4, 'new sheet row inserted');
  assert.strictEqual(row4.review_bg, CONFIG.COLORS.NORMAL, 'new row starts NORMAL');
});
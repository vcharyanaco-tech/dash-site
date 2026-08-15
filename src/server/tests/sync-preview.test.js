// Preview-before-apply sync:
//  - previewPullFromSheet() computes the plan WITHOUT writing.
//  - pullFromSheet() preserves dashboard-added links (merge with sheet links)
//    and never prunes rows the app created beyond the sheet extent.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const TMP = path.join('D:/tmp', 'sync-preview-' + Date.now());
process.env.DASH_DATA_DIR = TMP;
process.env.GOOGLE_SHEETS_API_KEY = 'test-key';
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

// gviz with an action text change on display row 1.
function gvizTextChanged() {
  const rows = [];
  for (let i = 1; i <= 3; i++) {
    rows.push({ c: [
      { f: String(i), v: i },
      { v: 'Sector ' + i },
      { v: 'Description ' + i },
      { v: '01.08.2026' },
      { v: i === 1 ? 'Action 1 CHANGED' : 'Action ' + i },
      { v: 'Resp ' + i },
      { v: '15.08.2026' }
    ] });
  }
  const payload = JSON.stringify({ status: 'ok', table: { rows } });
  return '/*O_o*/\ngoogle.visualization.Query.setResponse(' + payload + ');';
}

function sheetLinksJson() {
  // displayRow 1 has a sheet hyperlink on its action field.
  return {
    '1': {
      action: [
        { url: 'https://docs.google.com/spreadsheets/d/SHEET1/edit#gid=1', text: 'Sheet link A' }
      ]
    }
  };
}

function installFetch(gvizTextFn, links) {
  const originalFetch = global.fetch;
  global.fetch = async function (url) {
    if (String(url).includes('/gviz/tq')) {
      return { ok: true, text: async () => gvizTextFn() };
    }
    if (String(url).includes('includeGridData')) {
      return { ok: true, json: async () => ({ sheets: [{ data: [{ rowData: [] }] }] }) };
    }
    if (String(url).includes('sheets.googleapis.com')) {
      // hyperlinks read: return the fixture keyed by row via the raw endpoint
      return { ok: true, json: async () => ({}) };
    }
    throw new Error('unexpected fetch: ' + url);
  };
  // Simulate fetchHyperlinks by monkey-patching API_KEY? Instead, seed the
  // links map through the grid-data endpoint shape used by fetchHyperlinks.
  return originalFetch;
}

test('previewPullFromSheet computes changes without writing', async () => {
  const insert = db.prepare('INSERT INTO records (row, sector, description, entry_date, action, responsibility, review_date, links, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insert.run(START_ROW, 'Sector 1', 'Description 1', '01.08.2026', 'Action 1 OLD', 'Resp 1', '15.08.2026', '{}', Date.now(), Date.now());
  settings.set('sync.prevSheetLastRow', String(START_ROW + 2));

  const originalFetch = global.fetch;
  global.fetch = async function (url) {
    if (String(url).includes('/gviz/tq')) {
      return { ok: true, text: async () => gvizTextChanged() };
    }
    throw new Error('unexpected fetch: ' + url);
  };

  const preview = await sync.previewPullFromSheet();
  assert.strictEqual(preview.preview, true);
  assert.strictEqual(preview.sheetRows, 3);
  // row 1 exists with changed action; rows 2-3 are new.
  assert.strictEqual(preview.updated.length, 1, 'one updated row');
  assert.strictEqual(preview.updated[0].displayId, 1);
  assert.ok(preview.updated[0].changes.indexOf('action') !== -1, 'action change listed');
  assert.strictEqual(preview.added.length, 2, 'two added rows');

  // Preview must not have written anything.
  const row1 = db.prepare('SELECT * FROM records WHERE row = ?').get(START_ROW);
  assert.strictEqual(row1.action, 'Action 1 OLD', 'DB untouched by preview');
  assert.strictEqual(settings.getString('sync.prevSheetLastRow'), String(START_ROW + 2), 'marker untouched by preview');

  global.fetch = originalFetch;
});

test('pullFromSheet merges sheet links with dashboard links and preserves app rows', async () => {
  // Reset: only row 1 exists (as if the app owned it beyond the sheet extent).
  db.prepare('DELETE FROM records').run();
  settings.set('sync.prevSheetLastRow', String(START_ROW + 2));

  // App-created row BEYOND the sheet extent (row 7 when sheet has rows 4-6).
  db.prepare('INSERT INTO records (row, sector, description, entry_date, action, responsibility, review_date, links, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(START_ROW + 3, 'App Sector', 'App record', '', 'App action', '', '', JSON.stringify({
      action: [{ url: 'https://dashboard.example/app-link', text: 'App link' }]
    }), Date.now(), Date.now());

  const originalFetch = global.fetch;
  global.fetch = async function (url) {
    const u = String(url);
    if (u.includes('/gviz/tq')) {
      return { ok: true, text: async () => gvizText(3) };
    }
    if (u.includes('includeGridData=true') && u.includes('sheets.googleapis.com')) {
      // fetchHyperlinks: no links in the sheet.
      return { ok: true, json: async () => ({ sheets: [{ data: [{ rowData: [] }] }] }) };
    }
    throw new Error('unexpected fetch: ' + url);
  };

  const result = await sync.pullFromSheet();
  assert.strictEqual(result.sheetRows, 3);

  // App-created row must survive.
  const appRow = db.prepare('SELECT * FROM records WHERE row = ?').get(START_ROW + 3);
  assert.ok(appRow, 'app-created row preserved');
  assert.strictEqual(appRow.description, 'App record');

  global.fetch = originalFetch;
});

test('pullFromSheet keeps dashboard link when sheet has none for the field', async () => {
  db.prepare('DELETE FROM records').run();
  settings.set('sync.prevSheetLastRow', String(START_ROW + 2));

  // Row 1 exists in DB with a dashboard-added action link.
  db.prepare('INSERT INTO records (row, sector, description, entry_date, action, responsibility, review_date, links, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(START_ROW, 'Sector 1', 'Description 1', '01.08.2026', 'Action 1', 'Resp 1', '15.08.2026', JSON.stringify({
      action: [{ url: 'https://dashboard.example/keep-me', text: 'Kept' }]
    }), Date.now(), Date.now());

  const originalFetch = global.fetch;
  global.fetch = async function (url) {
    const u = String(url);
    if (u.includes('/gviz/tq')) {
      return { ok: true, text: async () => gvizText(3) };
    }
    if (u.includes('includeGridData=true') && u.includes('sheets.googleapis.com')) {
      return { ok: true, json: async () => ({ sheets: [{ data: [{ rowData: [] }] }] }) };
    }
    throw new Error('unexpected fetch: ' + url);
  };

  await sync.pullFromSheet();

  const row1 = db.prepare('SELECT links FROM records WHERE row = ?').get(START_ROW);
  const links = JSON.parse(row1.links);
  assert.ok(links.action, 'action links present');
  const kept = links.action.find(function (l) { return l.url === 'https://dashboard.example/keep-me'; });
  assert.ok(kept, 'dashboard-added link preserved when sheet has no links');

  global.fetch = originalFetch;
});

test('pullFromSheet merges sheet links with existing DB links on the same field', async () => {
  db.prepare('DELETE FROM records').run();
  settings.set('sync.prevSheetLastRow', String(START_ROW + 2));

  db.prepare('INSERT INTO records (row, sector, description, entry_date, action, responsibility, review_date, links, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(START_ROW, 'Sector 1', 'Description 1', '01.08.2026', 'Action 1', 'Resp 1', '15.08.2026', JSON.stringify({
      action: [{ url: 'https://dashboard.example/db-link', text: 'DB link' }]
    }), Date.now(), Date.now());

  const originalFetch = global.fetch;
  global.fetch = async function (url) {
    const u = String(url);
    if (u.includes('/gviz/tq')) {
      return { ok: true, text: async () => gvizText(3) };
    }
    if (u.includes('includeGridData=true') && u.includes('sheets.googleapis.com')) {
      // Row 1 has one sheet link on action (col E = index 4).
      const actionCell = {
        userEnteredValue: { stringValue: 'Action 1' },
        formattedValue: 'Action 1',
        textFormatRuns: [{ startIndex: 0, format: { link: { uri: 'https://sheet.example/sheet-link', text: 'Sheet link' } } }]
      };
      return { ok: true, json: async () => ({
        sheets: [{
          data: [{ rowData: [
            { values: [null, null, null, null, actionCell] },
            {}, {}
          ] }]
        }]
      }) };
    }
    throw new Error('unexpected fetch: ' + url);
  };

  await sync.pullFromSheet();

  const row1 = db.prepare('SELECT links FROM records WHERE row = ?').get(START_ROW);
  const links = JSON.parse(row1.links);
  const urls = links.action.map(function (l) { return l.url; });
  assert.ok(urls.indexOf('https://dashboard.example/db-link') !== -1, 'DB link kept');
  assert.ok(urls.indexOf('https://sheet.example/sheet-link') !== -1, 'sheet link added');
  assert.strictEqual(links.action.length, 2, 'both links present');

  global.fetch = originalFetch;
});

test('pullFromSheet never overwrites an app-created row the sheet grew into', async () => {
  db.prepare('DELETE FROM records').run();
  // Sheet previously had rows 4-5 (2 rows); app created a record at row 6.
  settings.set('sync.prevSheetLastRow', String(START_ROW + 1));
  db.prepare("INSERT INTO records (row, sector, description, entry_date, action, responsibility, review_date, links, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'app', ?, ?)")
    .run(START_ROW + 2, 'App Sector', 'App-only record', '01.08.2026', 'App action', 'Resp', '15.08.2026', '{}', Date.now(), Date.now());

  // Sheet NOW has 3 rows — its third row (row 6) collides with the app row.
  const originalFetch = global.fetch;
  global.fetch = async function (url) {
    const u = String(url);
    if (u.includes('/gviz/tq')) {
      return { ok: true, text: async () => gvizText(3) };
    }
    if (u.includes('includeGridData=true') && u.includes('sheets.googleapis.com')) {
      return { ok: true, json: async () => ({ sheets: [{ data: [{ rowData: [] }] }] }) };
    }
    throw new Error('unexpected fetch: ' + url);
  };

  const result = await sync.pullFromSheet();
  assert.strictEqual(result.skipped, 1, 'colliding app row skipped');

  const appRow = db.prepare('SELECT * FROM records WHERE row = ?').get(START_ROW + 2);
  assert.ok(appRow, 'app row still exists');
  assert.strictEqual(appRow.description, 'App-only record', 'content untouched by pull');
  assert.strictEqual(appRow.source, 'app');

  global.fetch = originalFetch;
});

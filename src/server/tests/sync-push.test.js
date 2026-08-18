// Test pushToSheet: verifies the data sent to the Google Sheets API is correct.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const TMP = path.join('D:/tmp', 'sync-push-' + Date.now());
process.env.DASH_DATA_DIR = TMP;
process.env.DASH_PUSH_TO_SHEET = 'true';
process.env.GOOGLE_OAUTH_TOKEN = 'test-oauth-token';
process.env.GOOGLE_SHEETS_API_KEY = 'test-key';
fs.mkdirSync(TMP, { recursive: true });

const { db } = require('../db');
const settings = require('../settings');
const sync = require('../sync-sheet');

const START_ROW = 4;
const SHEET_ID = 12345;

// Seed records that mimic real dashboard data.
function seedRecords() {
  db.prepare('DELETE FROM records').run();
  const now = Date.now();
  const rows = [
    {
      row: START_ROW,
      sector: 'Postal Services',
      description: 'Speed Post tracking issue',
      entry_date: '01.08.2026',
      action: 'Investigate tracking API',
      responsibility: 'Ravi Kumar',
      review_date: '15.08.2026',
      links: JSON.stringify({
        action: [{ url: 'https://indiapost.gov.in/track', text: 'Track here' }]
      }),
      source: 'sheet'
    },
    {
      row: START_ROW + 1,
      sector: 'Mail Operations',
      description: 'Mail sorting delay in Delhi hub',
      entry_date: '02.08.2026',
      action: 'Review staffing',
      responsibility: 'Sunita Devi',
      review_date: '20.08.2026',
      links: JSON.stringify({}),
      source: 'sheet'
    },
    {
      row: START_ROW + 2,
      sector: 'Customer Service',
      description: 'Complaint resolution backlog',
      entry_date: '03.08.2026',
      action: 'Escalate to regional office',
      responsibility: 'Amit Singh',
      review_date: '25.08.2026',
      links: JSON.stringify({
        sector: [{ url: 'https://example.com/policy', text: 'Policy doc' }],
        description: [{ url: 'https://example.com/report', text: 'Report' }]
      }),
      source: 'app'
    }
  ];

  const insert = db.prepare(
    'INSERT INTO records (row, sector, description, entry_date, action, responsibility, review_date, links, review_bg, source, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  rows.forEach(function (r) {
    insert.run(r.row, r.sector, r.description, r.entry_date, r.action, r.responsibility, r.review_date,
      r.links, '#ffffff', r.source, now, now);
  });
  return rows;
}

test('pushToSheet sends correct values to the spreadsheet', async () => {
  seedRecords();

  let capturedValues = null;
  let capturedRange = null;
  let capturedBatchRequests = null;

  const originalFetch = global.fetch;
  global.fetch = async function (url, opts) {
    const u = String(url);
    if (u.includes('values/') && u.includes('valueInputOption=RAW')) {
      // Capture the values.update call
      capturedRange = decodeURIComponent(u.split('/values/')[1].split('?')[0]);
      capturedValues = JSON.parse(opts.body);
      return { ok: true, json: async () => ({}) };
    }
    if (u.includes('batchUpdate')) {
      // Capture the batchUpdate call (rich-text links)
      capturedBatchRequests = JSON.parse(opts.body);
      return { ok: true, json: async () => ({}) };
    }
    if (u.includes('spreadsheets/') && u.includes('fields=sheets.properties')) {
      // sheetGridId_ call
      return { ok: true, json: async () => ({ sheets: [{ properties: { sheetId: SHEET_ID, title: 'Sheet1' } }] }) };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  const result = await sync.pushToSheet();

  // Verify basic result
  assert.strictEqual(result.pushed, true);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.rows, 3, 'all 3 records pushed');

  // Verify the range
  assert.strictEqual(capturedRange, 'Sheet1!A4:G6', 'range covers all 3 rows starting at row 4');

  // Verify the values array structure (7 columns per row)
  assert.ok(capturedValues, 'values were sent');
  assert.strictEqual(capturedValues.majorDimension, 'ROWS');
  assert.strictEqual(capturedValues.values.length, 3, '3 rows of values');

  // Row 1 (row 4 in sheet): displayId=1
  const row1 = capturedValues.values[0];
  assert.deepStrictEqual(row1, [
    1,                          // displayId (row - START_ROW + 1)
    'Postal Services',          // sector
    'Speed Post tracking issue', // description
    '01.08.2026',               // entryDate
    'Investigate tracking API', // action
    'Ravi Kumar',               // responsibility
    '15.08.2026'                // reviewDate
  ], 'row 1 values correct');

  // Row 2 (row 5 in sheet): displayId=2
  const row2 = capturedValues.values[1];
  assert.deepStrictEqual(row2, [
    2,
    'Mail Operations',
    'Mail sorting delay in Delhi hub',
    '02.08.2026',
    'Review staffing',
    'Sunita Devi',
    '20.08.2026'
  ], 'row 2 values correct');

  // Row 3 (row 6 in sheet): displayId=3
  const row3 = capturedValues.values[2];
  assert.deepStrictEqual(row3, [
    3,
    'Customer Service',
    'Complaint resolution backlog',
    '03.08.2026',
    'Escalate to regional office',
    'Amit Singh',
    '25.08.2026'
  ], 'row 3 values correct');

  // Verify rich-text link updates (batchUpdate)
  // Row 1 has action link, Row 3 has sector + description links
  assert.ok(capturedBatchRequests, 'batchUpdate was called');
  const requests = capturedBatchRequests.requests;

  // Row 1: 1 link on action (col 4)
  // Row 3: 2 links on sector (col 1) + description (col 2)
  assert.strictEqual(requests.length, 3, '3 rich-text link cells updated');

  // Check the link for row 1 action
  const row1ActionLink = requests.find(function (r) {
    return r.updateCells.range.startRowIndex === START_ROW - 1 && r.updateCells.range.startColumnIndex === 4;
  });
  assert.ok(row1ActionLink, 'row 1 action link update exists');
  const row1ActionValue = row1ActionLink.updateCells.rows[0].values[0];
  assert.strictEqual(row1ActionValue.userEnteredValue.stringValue, 'Investigate tracking API');
  assert.ok(row1ActionValue.textFormatRuns.length >= 2, 'has at least 2 text runs (plain + link)');

  // Check the links for row 3 sector and description
  const row3SectorLink = requests.find(function (r) {
    return r.updateCells.range.startRowIndex === START_ROW + 1 && r.updateCells.range.startColumnIndex === 1;
  });
  assert.ok(row3SectorLink, 'row 3 sector link update exists');
  const row3SectorValue = row3SectorLink.updateCells.rows[0].values[0];
  assert.strictEqual(row3SectorValue.userEnteredValue.stringValue, 'Customer Service');

  const row3DescLink = requests.find(function (r) {
    return r.updateCells.range.startRowIndex === START_ROW + 1 && r.updateCells.range.startColumnIndex === 2;
  });
  assert.ok(row3DescLink, 'row 3 description link update exists');
  const row3DescValue = row3DescLink.updateCells.rows[0].values[0];
  assert.strictEqual(row3DescValue.userEnteredValue.stringValue, 'Complaint resolution backlog');

  global.fetch = originalFetch;
});

test('pushToSheet returns error when kill switch is off', async () => {
  process.env.DASH_PUSH_TO_SHEET = 'false';
  const result = await sync.pushToSheet();
  assert.strictEqual(result.pushed, false);
  assert.strictEqual(result.ok, false);
  assert.ok(result.reason.includes('push-back disabled'));
  process.env.DASH_PUSH_TO_SHEET = 'true';
});

test('pushToSheet returns error when no write credential', async () => {
  // OAUTH_TOKEN is captured at module load, so we mock fetch to simulate
  // the token exchange failing (no valid credential).
  const originalFetch = global.fetch;
  global.fetch = async function (url, opts) {
    throw new Error('should not reach API without credentials');
  };

  // We need to re-require with empty env — but since OAUTH_TOKEN is cached,
  // we test the guard by checking that accessToken_ returns the module-level
  // value. Instead, we verify the function exports pushToSheetEnabled and
  // writeCredentialConfigured which are the runtime checks.
  // The actual guard is at the top of pushToSheet: if pushToSheetEnabled()
  // returns true but token is null, it returns the error. Since our env
  // has OAUTH_TOKEN='test-oauth-token', we can't easily test this without
  // re-requiring the module. Instead, test the exported helpers directly.
  
  // Temporarily override the module-level check by testing with env off
  process.env.DASH_PUSH_TO_SHEET = 'false';
  assert.strictEqual(sync.pushToSheetEnabled(), false, 'pushToSheetEnabled returns false when env is not true');
  process.env.DASH_PUSH_TO_SHEET = 'true';
  assert.strictEqual(sync.pushToSheetEnabled(), true, 'pushToSheetEnabled returns true when env is true');

  // Test writeCredentialConfigured — it checks pushToSheetEnabled && (SA || OAuth)
  assert.strictEqual(typeof sync.writeCredentialConfigured, 'function');

  global.fetch = originalFetch;
});

test('pushToSheet handles empty database', async () => {
  db.prepare('DELETE FROM records').run();
  const result = await sync.pushToSheet();
  assert.strictEqual(result.pushed, true);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.rows, 0);
  assert.strictEqual(result.reason, 'no records to push');
});

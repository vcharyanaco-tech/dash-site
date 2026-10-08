/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/sheet-target.test.js
 * Unit tests for named-cell resolution.
 *
 * Pure functions, no network, no clock, no Google credentials — which is
 * exactly why the risky logic (column letters, tab quoting, header matching,
 * row clamping) lives here rather than inside the write path.
 * ============================================================
 */

const { test } = require('node:test');
const assert = require('node:assert');
const target = require('../sheet-target');

test('column letters cross the Z -> AA -> AAA boundaries', function () {
  const c = target.__test.columnLetters;
  assert.strictEqual(c(0), 'A');
  assert.strictEqual(c(1), 'B');
  assert.strictEqual(c(25), 'Z');
  assert.strictEqual(c(26), 'AA');
  assert.strictEqual(c(27), 'AB');
  assert.strictEqual(c(51), 'AZ');
  assert.strictEqual(c(52), 'BA');
  assert.strictEqual(c(701), 'ZZ');
  assert.strictEqual(c(702), 'AAA');
});

test('column letters reject nonsense instead of emitting a bad range', function () {
  assert.strictEqual(target.__test.columnLetters(-1), '');
  assert.strictEqual(target.__test.columnLetters(NaN), '');
  assert.strictEqual(target.__test.columnLetters(undefined), '');
});

test('a plain tab name is left unquoted', function () {
  assert.strictEqual(target.__test.quoteTabName('Sheet1'), 'Sheet1');
  assert.strictEqual(target.__test.quoteTabName('  Data  '), 'Data');
});

test('a tab name with spaces or punctuation is quoted', function () {
  assert.strictEqual(target.__test.quoteTabName('Monthly Plan (2026)'), "'Monthly Plan (2026)'");
  assert.strictEqual(target.__test.quoteTabName('2026-Q1'), "'2026-Q1'");
});

test('an apostrophe inside a tab name is doubled, not dropped', function () {
  // A single unescaped quote would terminate the quoted name early and the
  // range would address a different tab.
  assert.strictEqual(target.__test.quoteTabName("Bob's Tab"), "'Bob''s Tab'");
});

test('header matching ignores case, surrounding and repeated whitespace', function () {
  const found = target.__test.findHeaderColumn(['Date', 'Action ', 'owner'], '  action  ');
  assert.strictEqual(found.index, 1);
  assert.strictEqual(found.duplicate, false);
});

test('duplicate headers are reported rather than silently picking one', function () {
  const found = target.__test.findHeaderColumn(['Status', 'Owner', 'status'], 'Status');
  assert.strictEqual(found.duplicate, true);
  assert.deepStrictEqual(found.matches, [0, 2]);
});

test('resolves a named cell to a concrete range', function () {
  const r = target.resolveNamedCell({
    tabName: 'Sheet1',
    headerRow: ['Date', 'Action', 'Owner'],
    headerName: 'action',
    oneBasedRow: 42
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.range, 'Sheet1!B42');
  assert.strictEqual(r.columnLetter, 'B');
});

test('a quoted tab name is carried into the range', function () {
  const r = target.resolveNamedCell({
    tabName: 'Monthly Plan (2026)',
    headerRow: ['Action'],
    headerName: 'Action',
    oneBasedRow: 7
  });
  assert.strictEqual(r.range, "'Monthly Plan (2026)'!A7");
});

test('a missing header lists what is available, so the request can be fixed', function () {
  const r = target.resolveNamedCell({
    tabName: 'Sheet1',
    headerRow: ['Date', 'Action', 'Owner'],
    headerName: 'Remarks',
    oneBasedRow: 3
  });
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /not in the "Sheet1" header row/);
  assert.match(r.reason, /Date, Action, Owner/);
});

test('a duplicate header blocks the write instead of guessing', function () {
  const r = target.resolveNamedCell({
    tabName: 'Sheet1',
    headerRow: ['Status', 'Status'],
    headerName: 'Status',
    oneBasedRow: 5
  });
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /more than once/);
});

test('a missing tab or a bad row is refused before any range is built', function () {
  assert.strictEqual(target.resolveNamedCell({ tabName: '', headerRow: ['A'], headerName: 'A', oneBasedRow: 2 }).ok, false);
  assert.strictEqual(target.resolveNamedCell({ tabName: 'S', headerRow: ['A'], headerName: 'A', oneBasedRow: 0 }).ok, false);
  assert.strictEqual(target.resolveNamedCell({ tabName: 'S', headerRow: ['A'], headerName: 'A', oneBasedRow: -3 }).ok, false);
});

test('clampRow_ refuses a row past the end of the sheet', function () {
  // Sheets would happily accept this and create the row, which then reads back
  // as a real empty record.
  assert.strictEqual(target.clampRow_(999, 12), 0);
  assert.strictEqual(target.clampRow_(12, 12), 12);
  assert.strictEqual(target.clampRow_(5, 0), 5); // unknown extent -> allow
  assert.strictEqual(target.clampRow_(0, 5), 0);
});

// ------------------------------------------------------------------
// Headers are NOT assumed to be on row 1
//
// A sheet commonly opens with a title row and a blank row before the real
// headers. The dashboard's own origin sheet is exactly this shape: row 1 is
// "India Post Dashboard on <date>" and the headers are on row 3. Requiring row 1
// would leave real columns unselectable.
// ------------------------------------------------------------------

test('finds a header that is not on row 1', function () {
  const rows = [
    ['India Post Dashboard on 16.09.2026'],
    [],
    ['Date', 'Sector', 'Action', 'Responsibility'],
    ['01.09.2026', 'Mail', 'Do the thing', 'PO']
  ];
  const found = target.__test.findHeaderInTopRows(rows, 'Action');
  assert.strictEqual(found.found, true);
  assert.strictEqual(found.row, 3, 'the header row must be reported as 3, not 1');
  assert.strictEqual(found.columnIndex, 2);
});

test('ignores a title row that happens to contain the header word', function () {
  const rows = [
    ['Action Register'],
    ['Date', 'Action', 'Owner']
  ];
  const found = target.__test.findHeaderInTopRows(rows, 'action');
  assert.strictEqual(found.row, 2);
  assert.strictEqual(found.columnIndex, 1);
});

test('a header appearing in two of the top rows is ambiguous, not guessed', function () {
  const rows = [
    ['Date', 'Action'],
    ['Action', 'Owner']
  ];
  const found = target.__test.findHeaderInTopRows(rows, 'Action');
  assert.strictEqual(found.found, false);
  assert.strictEqual(found.ambiguous, true);
  // 'Action' is B1 on row 1 and A2 on row 2 — both are reported so the sheet
  // owner can see exactly where the collision is.
  assert.match(found.where, /B1 and A2/);
});

test('a header that is nowhere in the top rows lists the headings it did see', function () {
  const rows = [
    ['India Post Dashboard'],
    [],
    ['Date', 'Sector']
  ];
  const found = target.__test.findHeaderInTopRows(rows, 'Remarks');
  assert.strictEqual(found.found, false);
  assert.strictEqual(found.ambiguous, false);
  assert.ok(found.seenHeaders.indexOf('Sector') !== -1, 'the error should name what the sheet does have');
});

test('the search is bounded, so a value far down the sheet is not mistaken for a header', function () {
  const rows = [];
  for (let i = 0; i < 20; i++) rows.push(['Date', 'Sector']);
  rows[19] = ['Date', 'Remarks'];
  // Only the first N rows are inspected.
  assert.strictEqual(target.__test.findHeaderInTopRows(rows, 'Remarks', 5).found, false);
  // Widen the window and the same row is found, proving it is the window that
  // excluded it and not a name-matching failure.
  assert.strictEqual(target.__test.findHeaderInTopRows(rows, 'Remarks', 20).found, true);
});

test('a duplicated header inside the located row is still flagged', function () {
  // 'Status' twice on the same row (B and C) is ambiguous even though only one
  // of the top rows mentions it.
  const rows = [['Date', 'Owner'], ['Date', 'Status', 'Status']];
  const found = target.__test.findHeaderInTopRows(rows, 'Status');
  assert.strictEqual(found.found, true);
  assert.strictEqual(found.row, 2);
  assert.strictEqual(found.duplicateInRow, true);
});

test('only Google Sheets URLs yield a spreadsheet id', function () {
  const sheetWrite = require('../sheet-write');
  assert.strictEqual(sheetWrite.sheetIdFromUrl(
    'https://docs.google.com/spreadsheets/d/1AbC-_dEfGhIjKlMnOp/edit#gid=0'), '1AbC-_dEfGhIjKlMnOp');
  assert.strictEqual(sheetWrite.sheetIdFromUrl('https://example.com/spreadsheets/d/x'), '');
  assert.strictEqual(sheetWrite.sheetIdFromUrl(''), '');
});

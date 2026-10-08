/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/sheet-structure.test.js
 * Unit tests for the pieces that decide how long the change-request form
 * takes to open.
 *
 * The form used to cost 2N+1 SERIALIZED Google round trips for an N-tab sheet:
 * one metadata call, then per tab a header read and a second metadata call
 * purely to read that tab's row count. These tests pin the two properties that
 * fix it — the row extent comes back with the tab list, and the header reads
 * run concurrently while keeping their order.
 *
 * No network, no clock, no Google credentials.
 * ============================================================
 */

const { test } = require('node:test');
const assert = require('node:assert');
const sheetWrite = require('../sheet-write');

const { readSheetMeta, rowCountFor, mapWithConcurrency } = sheetWrite.__test;

/* Stands in for the Sheets API metadata response. */
function fakeResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async function () { return body; }
  };
}

test('the tab list and every tab row extent come from ONE metadata call', async function () {
  const seen = [];
  const original = global.fetch;
  global.fetch = async function (url) {
    seen.push(String(url));
    return fakeResponse({
      sheets: [
        { properties: { title: 'Sheet1', gridProperties: { rowCount: 120 } } },
        { properties: { title: 'Data', gridProperties: { rowCount: 7 } } },
        { properties: { title: 'Notes', gridProperties: { rowCount: 3 } } }
      ]
    });
  };
  try {
    const meta = await readSheetMeta('sid', 'tok');
    assert.strictEqual(seen.length, 1, 'one request must cover every tab');
    assert.match(seen[0], /gridProperties\.rowCount/);
    assert.deepStrictEqual(meta.map(function (t) { return t.title; }), ['Sheet1', 'Data', 'Notes']);
    assert.deepStrictEqual(meta.map(function (t) { return t.rowCount; }), [120, 7, 3]);
  } finally {
    global.fetch = original;
  }
});

test('a sheet with no gridProperties yields 0 rather than NaN', async function () {
  const original = global.fetch;
  global.fetch = async function () {
    return fakeResponse({ sheets: [{ properties: { title: 'Empty' } }] });
  };
  try {
    const meta = await readSheetMeta('sid', 'tok');
    assert.strictEqual(meta[0].rowCount, 0);
  } finally {
    global.fetch = original;
  }
});

test('a tab with no grid data is left out instead of becoming an empty option', async function () {
  const original = global.fetch;
  global.fetch = async function () {
    return fakeResponse({ sheets: [{ properties: {} }, null, { properties: { title: 'Real' } }] });
  };
  try {
    const meta = await readSheetMeta('sid', 'tok');
    assert.deepStrictEqual(meta.map(function (t) { return t.title; }), ['Real']);
  } finally {
    global.fetch = original;
  }
});

test('the row extent is matched by exact title, and a missing tab is 0', function () {
  const meta = [
    { title: 'Sheet1', rowCount: 120 },
    { title: 'Data', rowCount: 7 }
  ];
  assert.strictEqual(rowCountFor(meta, 'Data'), 7);
  assert.strictEqual(rowCountFor(meta, 'Nope'), 0);
  // Near-miss spellings must not silently inherit another tab's extent.
  assert.strictEqual(rowCountFor(meta, 'data'), 0);
  assert.strictEqual(rowCountFor(meta, ' Sheet1'), 0);
});

test('concurrent mapping keeps input order regardless of completion order', async function () {
  const items = [40, 5, 30, 1, 20];
  const out = await mapWithConcurrency(items, 3, async function (ms, i) {
    await new Promise(function (r) { setTimeout(r, ms); });
    return i;
  });
  assert.deepStrictEqual(out, [0, 1, 2, 3, 4]);
});

test('concurrent mapping never exceeds the limit it was given', async function () {
  let inFlight = 0;
  let peak = 0;
  await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, async function () {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise(function (r) { setTimeout(r, 5); });
    inFlight--;
  });
  assert.ok(peak <= 3, 'ran ' + peak + ' at once, limit was 3');
  assert.ok(peak > 1, 'work was not actually concurrent, so the form still waits per tab');
});

test('concurrent mapping propagates a rejected item rather than hiding it', async function () {
  const out = await mapWithConcurrency(['a', 'b', 'c'], 2, async function (name) {
    if (name === 'b') throw new Error('forbidden');
    return name.toUpperCase();
  }).then(function (v) { return { ok: v }; }, function (err) { return { err: err }; });
  assert.ok(out.err, 'the rejection reaches the caller, which reports it');
  assert.match(out.err.message, /forbidden/);
});

test('an unreadable tab yields empty choices, not an empty form', async function () {
  process.env.GOOGLE_OAUTH_TOKEN = 'test-oauth-token';
  const original = global.fetch;
  let valuesCalls = 0;
  global.fetch = async function (url) {
    const u = String(url);
    if (u.indexOf('/values/') === -1) {
      return fakeResponse({
        sheets: [
          { properties: { title: 'Good', gridProperties: { rowCount: 40 } } },
          { properties: { title: 'Bad', gridProperties: { rowCount: 9 } } }
        ]
      });
    }
    valuesCalls++;
    if (u.indexOf('Bad') !== -1) {
      return { ok: false, status: 403, json: async function () { return { error: { message: 'no access' } }; } };
    }
    return fakeResponse({ values: [['Office', 'Pin', 'Status']] });
  };
  try {
    const out = await sheetWrite.getSheetStructure('https://docs.google.com/spreadsheets/d/sid_resilient');
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.tabs.length, 2, 'the readable tab still reaches the form');
    assert.deepStrictEqual(out.tabs[0].headers, ['Office', 'Pin', 'Status']);
    assert.strictEqual(out.tabs[0].rowCount, 40);
    assert.deepStrictEqual(out.tabs[1].headers, [], 'an unreadable tab offers no columns');
    assert.strictEqual(out.tabs[1].rowCount, 9);
    assert.strictEqual(valuesCalls, 2);
  } finally {
    global.fetch = original;
  }
});

test('the structure is cached, so a repeat open costs no Google calls', async function () {
  process.env.GOOGLE_OAUTH_TOKEN = 'test-oauth-token';
  const original = global.fetch;
  let calls = 0;
  global.fetch = async function (url) {
    calls++;
    if (String(url).indexOf('/values/') === -1) {
      return fakeResponse({ sheets: [{ properties: { title: 'Only', gridProperties: { rowCount: 5 } } }] });
    }
    return fakeResponse({ values: [['A', 'B']] });
  };
  try {
    const url = 'https://docs.google.com/spreadsheets/d/sid_cached';
    const first = await sheetWrite.getSheetStructure(url);
    assert.strictEqual(first.cached, undefined);
    const after = calls;
    assert.ok(after > 0, 'the first open reads the sheet');

    const second = await sheetWrite.getSheetStructure(url);
    assert.strictEqual(second.cached, true);
    assert.strictEqual(calls, after, 'the second open made no requests');
    assert.deepStrictEqual(second.tabs, first.tabs);
  } finally {
    global.fetch = original;
  }
});

test('a sheet URL that is not a Google Sheet is refused before any request', async function () {
  let calls = 0;
  const original = global.fetch;
  global.fetch = async function () { calls++; return fakeResponse({}); };
  try {
    const out = await sheetWrite.getSheetStructure('https://evil.example/spreadsheets/d/sid_x');
    assert.strictEqual(out.ok, false);
    assert.strictEqual(calls, 0);
  } finally {
    global.fetch = original;
  }
});

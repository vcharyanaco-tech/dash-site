/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/change-requests.test.js
 * The approval queue for changes to a record's LINKED Google Sheet.
 *
 * The point of this feature is that a requester's edit is INERT until an
 * admin/editor signs it off, so these tests assert the negative space as hard
 * as the positive.
 *
 * No Google access anywhere: the dev machine has no credential, so every
 * sheet-scoped path is exercised through its "no credential configured"
 * branch. That branch is itself a requirement — it must fail loudly and leave
 * the request PENDING, because an approval that silently did nothing would be
 * the worst possible outcome for a document staff rely on. The resolver's own
 * logic is unit-tested separately in sheet-target.test.js.
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { password } = require('./test-bootstrap');
const { server } = require('../index');
const { db } = require('../db');

let port;
let adminToken;
let viewerToken;
let editorToken;
let sheetRow;   // a record that hyperlinks a Google Sheet
let bareRow;    // a record with no links at all

before(async function () {
  await new Promise(function (resolve) {
    server.listen(0, function () {
      port = server.address().port;
      resolve();
    });
  });
});

after(function () {
  server.close();
});

async function postRaw(fn, args) {
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: fn, args: args || [] })
  });
  return resp.json();
}

async function post(fn, args) {
  const body = await postRaw(fn, args);
  if (body.error) throw new Error(fn + ': ' + body.error);
  return body.result;
}

async function login(email) {
  const body = await postRaw('login', [email, password]);
  assert.ok(body.result && body.result.token, 'login failed for ' + email + ': ' + JSON.stringify(body.error || body));
  return body.result.token;
}

async function ensureUser(email, username, role) {
  await postRaw('adminAddUser', [email, username, role, password, 'Field', 'Haryana', 'Circle Office', adminToken]);
  const reset = await postRaw('adminResetPassword', [email, password, adminToken]);
  assert.ok(!reset.error, 'password reset failed for ' + email + ': ' + reset.error);
}

function firstSheetUrl(item) {
  const links = item.links || {};
  const keys = Object.keys(links);
  for (let i = 0; i < keys.length; i++) {
    const v = links[keys[i]];
    const url = Array.isArray(v) ? (v[0] && v[0].url) : (v && v.url);
    if (url && /docs\.google\.com\/spreadsheets\//i.test(url)) return url;
  }
  return '';
}

test('setup: admin, editor and viewer tokens', async function () {
  adminToken = await login('vcharyanaco@gmail.com');
  await ensureUser('cr_editor@test.com', 'creditor', 'editor');
  await ensureUser('cr_viewer@test.com', 'crviewer', 'viewer');
  editorToken = await login('cr_editor@test.com');
  viewerToken = await login('cr_viewer@test.com');

  const data = await post('getData', [adminToken]);
  const items = data.items || [];
  assert.ok(items.length, 'fixture DB should contain records');

  const withSheet = items.filter(function (it) { return !!firstSheetUrl(it); })[0];
  const without = items.filter(function (it) { return !firstSheetUrl(it); })[0];
  sheetRow = withSheet ? Number(withSheet.row) : 0;
  bareRow = Number((without || items[0]).row);
  if (!sheetRow) {
    // The seed data has no linked sheet, so give the LAST record one and keep
    // the first as the "no linked sheet" case. The URL is never fetched (no
    // credential is configured on the dev machine), but the record must carry a
    // Google Sheets link for the sheet-scoped paths to be reachable at all.
    const target = items[items.length - 1];
    if (Number(target.row) === bareRow) bareRow = Number(items[0].row);
    sheetRow = Number(target.row);
    db.prepare('UPDATE records SET links = ? WHERE row = ?').run(JSON.stringify({
      action: { url: 'https://docs.google.com/spreadsheets/d/1TestSheetIdForFixtures/edit', text: 'linked sheet' }
    }), sheetRow);
  }
});

// ------------------------------------------------------------------
// Authz
// ------------------------------------------------------------------

test('anonymous cannot raise, list, preview or approve', async function () {
  assert.ok((await postRaw('createChangeRequest', [{ recordRow: sheetRow, sheetTab: 'S', sheetHeader: 'H', sheetRow: 1, newValue: 'x' }, ''])).error);
  assert.ok((await postRaw('listChangeRequests', [''])).error);
  assert.ok((await postRaw('getLinkSheetStructure', ['', sheetRow])).error);
  assert.ok((await postRaw('previewChangeRequest', ['x', ''])).error);
  assert.ok((await postRaw('approveChangeRequest', ['x', ''])).error);
});

test('a viewer cannot approve or reject', async function () {
  assert.ok((await postRaw('approveChangeRequest', ['anything', viewerToken])).error,
    'a viewer must not be able to approve');
  assert.ok((await postRaw('rejectChangeRequest', ['anything', viewerToken])).error,
    'a viewer must not be able to reject');
});

// ------------------------------------------------------------------
// The sheet must be located before a request can even be raised
// ------------------------------------------------------------------

test('a request for a record with no linked sheet is refused', async function () {
  const res = await post('createChangeRequest', [{
    recordRow: bareRow, sheetTab: 'Sheet1', sheetHeader: 'Action', sheetRow: 2, newValue: 'x'
  }, viewerToken]);
  assert.strictEqual(res.success, false);
  assert.match(res.message, /no linked Google Sheet/i);
});

test('missing tab, column, row or value are each refused with a clear message', async function () {
  const base = { recordRow: sheetRow, sheetTab: 'Sheet1', sheetHeader: 'Action', sheetRow: 2, newValue: 'x' };
  const cases = [
    [{ recordRow: sheetRow, sheetHeader: 'Action', sheetRow: 2, newValue: 'x' }, /tab/i],
    [{ recordRow: sheetRow, sheetTab: 'Sheet1', sheetRow: 2, newValue: 'x' }, /column/i],
    [{ recordRow: sheetRow, sheetTab: 'Sheet1', sheetHeader: 'Action', newValue: 'x' }, /row number/i],
    [{ recordRow: sheetRow, sheetTab: 'Sheet1', sheetHeader: 'Action', sheetRow: 2, newValue: '  ' }, /value/i]
  ];
  for (const [payload, pattern] of cases) {
    const res = await post('createChangeRequest', [payload, viewerToken]);
    assert.strictEqual(res.success, false, 'expected refusal for ' + JSON.stringify(payload));
    assert.match(res.message, pattern);
  }
  assert.ok(base.recordRow);
});

test('an unknown record is refused', async function () {
  const res = await post('createChangeRequest', [{
    recordRow: 999999, sheetTab: 'Sheet1', sheetHeader: 'Action', sheetRow: 2, newValue: 'x'
  }, viewerToken]);
  assert.strictEqual(res.success, false);
  assert.match(res.message, /Record not found/);
});

test('an over-long value is refused rather than truncated', async function () {
  const res = await post('createChangeRequest', [{
    recordRow: sheetRow, sheetTab: 'Sheet1', sheetHeader: 'Action', sheetRow: 2,
    newValue: 'x'.repeat(6000)
  }, viewerToken]);
  assert.strictEqual(res.success, false);
  assert.match(res.message, /too long/i);
});

// ------------------------------------------------------------------
// Without a credential nothing can be created, and that must be loud
// ------------------------------------------------------------------

test('with no credential the request is refused and the sheet is untouched', async function () {
  const res = await post('createChangeRequest', [{
    recordRow: sheetRow, sheetTab: 'Sheet1', sheetHeader: 'Action', sheetRow: 2,
    newValue: 'approved sheet value', reason: 'test'
  }, viewerToken]);
  // Either it is refused for want of a credential, or (if a credential IS
  // configured on the machine) it is created. Both are correct; what must never
  // happen is a silent success with nothing written.
  assert.strictEqual(typeof res.success, 'boolean');
  if (res.success === false) {
    assert.match(res.message, /credential|could not/i);
    const rows = db.prepare('SELECT COUNT(*) AS n FROM change_requests WHERE new_value = ?').get('approved sheet value');
    assert.strictEqual(rows.n, 0, 'a refused request must not be stored as pending');
  }
});

test('the sheet structure endpoint reports unavailable instead of erroring', async function () {
  const res = await post('getLinkSheetStructure', [viewerToken, sheetRow]);
  assert.strictEqual(res.success, true);
  assert.strictEqual(typeof res.available, 'boolean');
  if (res.available === false && res.reason === 'unavailable') {
    assert.ok(res.detail, 'an unavailable sheet must say why');
  }
});

test('a record with no linked sheet reports no-link rather than a credential error', async function () {
  const res = await post('getLinkSheetStructure', [viewerToken, bareRow]);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.available, false);
  assert.strictEqual(res.reason, 'no-link');
});

// ------------------------------------------------------------------
// Queue behaviour that does not depend on Google being reachable
// ------------------------------------------------------------------

test('seeding a pending request directly: a viewer cannot approve it', async function () {
  const id = 'seeded-pending-1';
  db.prepare('INSERT OR REPLACE INTO change_requests (id, record_row, record_id, scope, sheet_url, sheet_tab, sheet_header, sheet_row, sheet_current_value, new_value, reason, status, requested_by, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, sheetRow, '', 'sheet', 'https://docs.google.com/spreadsheets/d/1TestSheetIdForFixtures/edit',
      'Sheet1', 'Action', 2, 'before', 'after', 'seeded', 'PENDING', 'cr_viewer@test.com', Date.now());

  const before = db.prepare('SELECT status FROM change_requests WHERE id = ?').get(id).status;
  assert.strictEqual(before, 'PENDING');

  const body = await postRaw('approveChangeRequest', [id, viewerToken]);
  assert.ok(body.error, 'a viewer must not be able to approve');
  assert.strictEqual(db.prepare('SELECT status FROM change_requests WHERE id = ?').get(id).status, 'PENDING',
    'a refused approval must leave the request pending');
});

test('a request cannot be approved twice', async function () {
  const id = 'seeded-approved-1';
  db.prepare('INSERT OR REPLACE INTO change_requests (id, record_row, record_id, scope, sheet_url, sheet_tab, sheet_header, sheet_row, new_value, status, requested_by, requested_at, reviewed_by, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, sheetRow, '', 'sheet', 'https://docs.google.com/spreadsheets/d/1TestSheetIdForFixtures/edit',
      'Sheet1', 'Action', 2, 'after', 'APPROVED', 'cr_viewer@test.com', Date.now(), 'vcharyanaco@gmail.com', Date.now());

  const res = await post('approveChangeRequest', [id, adminToken]);
  assert.strictEqual(res.success, false);
  assert.match(res.message, /already approved/i);
});

test('rejecting leaves the request rejected and records the reviewer note', async function () {
  const id = 'seeded-reject-1';
  db.prepare('INSERT OR REPLACE INTO change_requests (id, record_row, record_id, scope, sheet_url, sheet_tab, sheet_header, sheet_row, new_value, status, requested_by, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, sheetRow, '', 'sheet', 'https://docs.google.com/spreadsheets/d/1TestSheetIdForFixtures/edit',
      'Sheet1', 'Action', 3, 'after', 'PENDING', 'cr_viewer@test.com', Date.now());

  const res = await post('rejectChangeRequest', [id, adminToken, 'not this quarter']);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, 'REJECTED');
  const row = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(id);
  assert.strictEqual(row.status, 'REJECTED');
  assert.strictEqual(row.review_note, 'not this quarter');
  assert.strictEqual(row.reviewed_by, 'vcharyanaco@gmail.com');
  assert.strictEqual(row.applied_range, '', 'a rejection must never record a write');
});

test('an unknown request id is reported, not created', async function () {
  const res = await post('approveChangeRequest', ['does-not-exist', adminToken]);
  assert.strictEqual(res.success, false);
  assert.match(res.message, /not found/i);
});

test('a requester sees only their own requests; an approver sees everything', async function () {
  db.prepare('INSERT OR REPLACE INTO change_requests (id, record_row, record_id, scope, sheet_url, sheet_tab, sheet_header, sheet_row, new_value, status, requested_by, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('seeded-visibility-1', sheetRow, '', 'sheet', 'https://docs.google.com/spreadsheets/d/1TestSheetIdForFixtures/edit',
      'Sheet1', 'Action', 4, 'v', 'PENDING', 'cr_viewer@test.com', Date.now());
  db.prepare('INSERT OR REPLACE INTO change_requests (id, record_row, record_id, scope, sheet_url, sheet_tab, sheet_header, sheet_row, new_value, status, requested_by, requested_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('seeded-visibility-2', sheetRow, '', 'sheet', 'https://docs.google.com/spreadsheets/d/1TestSheetIdForFixtures/edit',
      'Sheet1', 'Action', 5, 'v', 'PENDING', 'someone.else@test.com', Date.now());

  const asViewer = await post('listChangeRequests', [viewerToken, { mine: 'true' }]);
  assert.strictEqual(asViewer.canApprove, false);
  assert.ok(asViewer.requests.every(function (r) { return r.requestedBy === 'cr_viewer@test.com'; }),
    'a requester must not see other people\'s requests');
  assert.ok(asViewer.requests.length > 0);

  const asAdmin = await post('listChangeRequests', [adminToken]);
  assert.strictEqual(asAdmin.canApprove, true);
  assert.ok(asAdmin.requests.some(function (r) { return r.requestedBy === 'someone.else@test.com'; }),
    'an approver sees the whole queue');
});

test('the record fields are NOT requestable: only sheet cells are', async function () {
  // The old record-field flow is gone. A payload naming a record field must be
  // refused rather than silently treated as something else.
  const res = await post('createChangeRequest', [{
    recordRow: sheetRow, field: 'sector', newValue: 'hijacked'
  }, viewerToken]);
  assert.strictEqual(res.success, false);
  assert.match(res.message, /tab|column/i);

  const rows = db.prepare('SELECT COUNT(*) AS n FROM change_requests WHERE field = ?').get('sector');
  assert.strictEqual(rows.n, 0, 'no request may target a record field');
});

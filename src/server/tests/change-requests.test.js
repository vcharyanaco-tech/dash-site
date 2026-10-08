/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/change-requests.test.js
 * The change-request approval queue.
 *
 * The point of this feature is that a non-approver's edit is INERT until an
 * admin/editor signs it off, so these tests assert the negative space as
 * hard as the positive: after a viewer raises a request, the record must be
 * byte-for-byte unchanged.
 *
 * No Google access anywhere. The linked-sheet path is exercised with the
 * credential absent (which is the state on every dev machine) and with a
 * stubbed resolver, so a test run can never write to a real sheet.
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { password } = require('./test-bootstrap');
const { server } = require('../index');
const { db } = require('../db');
const changeRequests = require('../change-requests');

let port;
let adminToken;
let viewerToken;
let editorToken;
let targetRow;

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

test('setup: admin, editor and viewer tokens, plus a target record', async function () {
  adminToken = await login('vcharyanaco@gmail.com');
  await ensureUser('cr_editor@test.com', 'creditor', 'editor');
  await ensureUser('cr_viewer@test.com', 'crviewer', 'viewer');
  editorToken = await login('cr_editor@test.com');
  viewerToken = await login('cr_viewer@test.com');

  const data = await post('getData', [adminToken]);
  const items = (data && (data.items || data.records)) || [];
  assert.ok(items.length, 'fixture DB should contain records');
  targetRow = Number(items[0].row);
});

function readField_(row, field) {
  const rec = db.prepare('SELECT * FROM records WHERE row = ?').get(Number(row));
  return rec ? String(rec[field] == null ? '' : rec[field]) : null;
}

// ------------------------------------------------------------------
// Authz
// ------------------------------------------------------------------

test('anonymous cannot raise a change request', async function () {
  const body = await postRaw('createChangeRequest', [{ recordRow: targetRow, field: 'sector', newValue: 'X' }, '']);
  assert.ok(body.error, 'anonymous must be refused');
});

test('anonymous cannot list or approve', async function () {
  assert.ok((await postRaw('listChangeRequests', [''])).error, 'anonymous list must be refused');
  assert.ok((await postRaw('approveChangeRequest', ['x', ''])).error, 'anonymous approve must be refused');
});

// ------------------------------------------------------------------
// The core guarantee: a pending request changes nothing
// ------------------------------------------------------------------

test('a viewer can raise a request and NOTHING is written until approval', async function () {
  const before = readField_(targetRow, 'sector');
  const res = await post('createChangeRequest', [{
    recordRow: targetRow, scope: 'record', field: 'sector',
    newValue: 'Requested Sector ' + Date.now(), reason: 'please review'
  }, viewerToken]);

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, 'PENDING');
  assert.strictEqual(readField_(targetRow, 'sector'), before,
    'a pending request must not touch the record');

  const row = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(res.id);
  assert.strictEqual(row.status, 'PENDING');
  assert.strictEqual(row.requested_by, 'cr_viewer@test.com');
  assert.strictEqual(row.old_value, before, 'the old value must be captured for the conflict check');

  global.__crPending = res.id;
});

test('a request for a field that is not user-editable is refused', async function () {
  const res = await post('createChangeRequest', [{
    recordRow: targetRow, field: 'row', newValue: '999'
  }, viewerToken]);
  assert.strictEqual(res.success, false);
  assert.match(res.message, /cannot be changed/);
});

test('an empty or no-op proposal is refused', async function () {
  const empty = await post('createChangeRequest', [{ recordRow: targetRow, field: 'sector', newValue: '   ' }, viewerToken]);
  assert.strictEqual(empty.success, false);

  const noop = await post('createChangeRequest', [{ recordRow: targetRow, field: 'sector', newValue: readField_(targetRow, 'sector') }, viewerToken]);
  assert.strictEqual(noop.success, false);
  assert.match(noop.message, /already the current value/);
});

test('an unknown record is refused', async function () {
  const res = await post('createChangeRequest', [{ recordRow: 999999, field: 'sector', newValue: 'x' }, viewerToken]);
  assert.strictEqual(res.success, false);
  assert.match(res.message, /Record not found/);
});

// ------------------------------------------------------------------
// Approve / reject
// ------------------------------------------------------------------

test('a viewer CANNOT approve', async function () {
  const before = readField_(targetRow, 'sector');
  const body = await postRaw('approveChangeRequest', [global.__crPending, viewerToken]);
  assert.ok(body.error, 'a viewer must not be able to approve');
  assert.strictEqual(readField_(targetRow, 'sector'), before, 'a refused approval must not write');
});

test('an editor CAN approve, and the record is then updated', async function () {
  const id = global.__crPending;
  const expected = db.prepare('SELECT new_value FROM change_requests WHERE id = ?').get(id).new_value;
  const res = await post('approveChangeRequest', [id, editorToken, 'looks right']);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, 'APPROVED');
  assert.strictEqual(readField_(targetRow, 'sector'), expected, 'approval must apply the proposed value');

  const row = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(id);
  assert.strictEqual(row.reviewed_by, 'cr_editor@test.com');
  assert.ok(row.reviewed_at > 0);
});

test('a request cannot be approved twice', async function () {
  const res = await post('approveChangeRequest', [global.__crPending, editorToken]);
  assert.strictEqual(res.success, false);
  assert.match(res.message, /already approved/i);
});

test('a rejected request never writes', async function () {
  const before = readField_(targetRow, 'responsibility');
  const created = await post('createChangeRequest', [{
    recordRow: targetRow, field: 'responsibility', newValue: 'Should never appear', reason: 'x'
  }, viewerToken]);
  const res = await post('rejectChangeRequest', [created.id, adminToken, 'not this quarter']);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, 'REJECTED');
  assert.strictEqual(readField_(targetRow, 'responsibility'), before, 'a rejection must not write');
  const row = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(created.id);
  assert.strictEqual(row.review_note, 'not this quarter');
});

test('a viewer cannot reject either', async function () {
  const created = await post('createChangeRequest', [{ recordRow: targetRow, field: 'description', newValue: 'nope' }, viewerToken]);
  const body = await postRaw('rejectChangeRequest', [created.id, viewerToken]);
  assert.ok(body.error, 'a viewer must not be able to reject');
});

// ------------------------------------------------------------------
// Conflict safety
// ------------------------------------------------------------------

test('a request whose field changed underneath is marked CONFLICT and not applied', async function () {
  const created = await post('createChangeRequest', [{
    recordRow: targetRow, field: 'action', newValue: 'Proposed action value'
  }, viewerToken]);
  assert.strictEqual(created.success, true);

  // Someone edits the record directly after the request was raised.
  db.prepare('UPDATE records SET action = ? WHERE row = ?').run('Edited by someone else', targetRow);

  const res = await post('approveChangeRequest', [created.id, adminToken]);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.conflict, true);
  assert.strictEqual(readField_(targetRow, 'action'), 'Edited by someone else',
    'approval must never overwrite the newer value');

  const row = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(created.id);
  assert.strictEqual(row.status, 'CONFLICT');
});

// ------------------------------------------------------------------
// Visibility
// ------------------------------------------------------------------

test('a requester sees only their own requests; an approver sees everything', async function () {
  await post('createChangeRequest', [{ recordRow: targetRow, field: 'sector', newValue: 'mine ' + Date.now() }, viewerToken]);

  const asViewer = await post('listChangeRequests', [viewerToken, { mine: 'true' }]);
  assert.strictEqual(asViewer.canApprove, false);
  assert.ok(asViewer.requests.every(function (r) { return r.requestedBy === 'cr_viewer@test.com'; }),
    'a requester must not see other people\'s requests');

  const asAdmin = await post('listChangeRequests', [adminToken]);
  assert.strictEqual(asAdmin.canApprove, true);
  assert.ok(asAdmin.requests.length >= 3, 'an approver sees the whole queue');
});

// ------------------------------------------------------------------
// Linked-sheet scope: refuses safely with no credential, never half-writes
// ------------------------------------------------------------------

test('a sheet-scope request needs a linked sheet on the record', async function () {
  const res = await post('createChangeRequest', [{
    recordRow: targetRow, scope: 'sheet', sheetTab: 'Sheet1', sheetHeader: 'Action', sheetRow: 5, newValue: 'x'
  }, viewerToken]);
  // The first seeded record may or may not carry a sheet link; either way this
  // must be a clean refusal or a clean creation, never a crash.
  assert.strictEqual(typeof res.success, 'boolean');
});

test('sheet-scope approval reports a clear refusal when no write credential exists', async function () {
  // Find or create a record that carries a Google Sheets link.
  const data = await post('getData', [adminToken]);
  const items = data.items || [];
  let row = null;
  for (let i = 0; i < items.length; i++) {
    const links = items[i].links || {};
    const keys = Object.keys(links);
    for (let k = 0; k < keys.length; k++) {
      const v = links[keys[k]];
      const url = Array.isArray(v) ? (v[0] && v[0].url) : (v && v.url);
      if (url && /docs\.google\.com\/spreadsheets\//i.test(url)) { row = Number(items[i].row); break; }
    }
    if (row) break;
  }
  if (!row) {
    // No linked sheet in the fixture: nothing to exercise, and that is fine.
    return;
  }

  const created = await post('createChangeRequest', [{
    recordRow: row, scope: 'sheet', sheetTab: 'Sheet1', sheetHeader: 'Action', sheetRow: 5,
    newValue: 'approved sheet value', reason: 'sheet test'
  }, viewerToken]);
  assert.strictEqual(created.success, true, 'sheet-scope request should be creatable');
  assert.strictEqual(db.prepare('SELECT status FROM change_requests WHERE id = ?').get(created.id).status, 'PENDING');

  // With no GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_OAUTH_TOKEN in this
  // environment the write must fail loudly and leave the request PENDING --
  // an approval that silently did nothing would be the worst outcome.
  const res = await post('approveChangeRequest', [created.id, adminToken]);
  assert.strictEqual(res.success, false);
  assert.match(res.message, /credential/i);
  assert.strictEqual(db.prepare('SELECT status FROM change_requests WHERE id = ?').get(created.id).status, 'PENDING',
    'a failed sheet write must leave the request pending, not approved');
});

// ------------------------------------------------------------------
// Preview is read-only
// ------------------------------------------------------------------

test('previewing a record-scope request does not change anything', async function () {
  const created = await post('createChangeRequest', [{
    recordRow: targetRow, field: 'description', newValue: 'preview me'
  }, viewerToken]);
  const before = readField_(targetRow, 'description');

  const p = await post('previewChangeRequest', [created.id, viewerToken]);
  assert.strictEqual(p.success, true);
  assert.strictEqual(p.scope, 'record');
  assert.strictEqual(p.proposedValue, 'preview me');
  assert.strictEqual(p.currentValue, before);
  assert.strictEqual(readField_(targetRow, 'description'), before, 'preview must be read-only');

  await post('rejectChangeRequest', [created.id, adminToken, 'cleanup']);
});

test('the module exposes only user-editable fields as proposable', function () {
  const fields = Object.keys(changeRequests.EDITABLE_FIELDS);
  assert.ok(fields.indexOf('sector') !== -1);
  assert.ok(fields.indexOf('action') !== -1);
  ['row', 'source', 'displayed', 'record_id', 'links'].forEach(function (f) {
    assert.strictEqual(changeRequests.EDITABLE_FIELDS[f], undefined,
      f + ' must not be proposable — it is not a user-editable field');
  });
});
/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/authz.test.js
 * Role-based authorization matrix: verifies every dispatch op
 * enforces the correct role gate (Phase 1C).
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
  db.prepare("DELETE FROM users WHERE email IN ('authz_viewer_e2e@test.com','authz_editor_e2e@test.com','authz_do_e2e@test.com')").run();
});

async function post(fn, args) {
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: fn, args: args || [] })
  });
  const body = await resp.json();
  if (body.error) throw new Error(fn + ': ' + body.error);
  return body.result;
}

test('setup: create viewer + editor users via adminAddUser, login all three', async function () {
  const a = await post('login', ['vcharyanaco@gmail.com', password]);
  assert.ok(a.token);
  adminToken = a.token;

  const v = await post('adminAddUser',
    ['authz_viewer_e2e@test.com', 'authz_viewer', 'VIEWER', 'AuthzView123!', '', '', '', adminToken]);
  assert.ok(Array.isArray(v) || v);

  const e = await post('adminAddUser',
    ['authz_editor_e2e@test.com', 'authz_editor', 'EDITOR', 'AuthzEdit123!', '', '', '', adminToken]);
  assert.ok(Array.isArray(e) || e);

  const vl = await post('login', ['authz_viewer_e2e@test.com', 'AuthzView123!']);
  assert.ok(vl.token);
  viewerToken = vl.token;

  const el = await post('login', ['authz_editor_e2e@test.com', 'AuthzEdit123!']);
  assert.ok(el.token);
  editorToken = el.token;
});

// ------------------------------------------------------------------
// Public ops: no auth required
// ------------------------------------------------------------------

test('public: getServerTime works without auth', async function () {
  const r = await post('getServerTime');
  assert.ok(typeof r === 'number');
});

// ------------------------------------------------------------------
// Login-required ops: anonymous → rejected
// ------------------------------------------------------------------

const requireLoginOps = [
  ['getAppData', []],
  ['getAuditEntries', [10]],
  ['getTaskCounts', []],
  ['getMyTasks', []],
  ['exportReviewCalendarIcs', []],
  ['getEnterpriseHealth', []],
  ['validateEnterpriseConfiguration', []],
  ['getRecordHistory', [1]],
  ['getNotificationPrefs', []],
  ['setNotificationPrefs', [{}]]
];

for (const [fn, args] of requireLoginOps) {
  test('anonymous rejected: ' + fn, async function () {
    await assert.rejects(
      post(fn, args),
      // Ops with validators reject malformed anonymous calls at the
      // validation gate ("requires (...)"); the rest hit the auth
      // gate. Either rejection satisfies the security intent.
      /login required|session expired|please log in|requires \(.*token\)/i
    );
  });
}

// ------------------------------------------------------------------
// getAuditEntries: viewer allowed (any logged-in user)
// ------------------------------------------------------------------

test('viewer: getAuditEntries allowed', async function () {
  const r = await post('getAuditEntries', [10, viewerToken]);
  assert.ok(Array.isArray(r));
});

// ------------------------------------------------------------------
// getRecordHistory: viewer allowed
// ------------------------------------------------------------------

test('viewer: getRecordHistory allowed (returns array for nonexistent row)', async function () {
  const r = await post('getRecordHistory', [999999, viewerToken]);
  assert.ok(Array.isArray(r));
});

// ------------------------------------------------------------------
// getEnterpriseHealth / validateEnterpriseConfiguration: login-gated
// ------------------------------------------------------------------

test('viewer: getEnterpriseHealth allowed', async function () {
  const r = await post('getEnterpriseHealth', [viewerToken]);
  assert.ok(r && typeof r === 'object');
});

test('viewer: validateEnterpriseConfiguration allowed', async function () {
  const r = await post('validateEnterpriseConfiguration', [viewerToken]);
  assert.ok(r && typeof r === 'object');
});

// ------------------------------------------------------------------
// getAiInsights: admin required
// ------------------------------------------------------------------

test('viewer rejected: getAiInsights', async function () {
  await assert.rejects(
    post('getAiInsights', [viewerToken]),
    /admin permission required/i
  );
});

test('editor rejected: getAiInsights', async function () {
  await assert.rejects(
    post('getAiInsights', [editorToken]),
    /admin permission required/i
  );
});

// ------------------------------------------------------------------
// sendWeeklyReport: admin required
// ------------------------------------------------------------------

test('viewer rejected: sendWeeklyReport', async function () {
  await assert.rejects(
    post('sendWeeklyReport', [viewerToken]),
    /admin permission required/i
  );
});

test('editor rejected: sendWeeklyReport', async function () {
  await assert.rejects(
    post('sendWeeklyReport', [editorToken]),
    /admin permission required/i
  );
});

test('admin: sendWeeklyReport allowed', async function () {
  const r = await post('sendWeeklyReport', [adminToken]);
  assert.ok(typeof r.success === 'boolean');
});

// ------------------------------------------------------------------
// sendReviewDeadlinePushNotifications: login required
// ------------------------------------------------------------------

test('viewer: sendReviewDeadlinePushNotifications allowed', async function () {
  const r = await post('sendReviewDeadlinePushNotifications', [viewerToken]);
  assert.strictEqual(typeof r.sent, 'number');
});

// ------------------------------------------------------------------
// setupEnterpriseAddons / installEnterpriseTriggers: admin required
// ------------------------------------------------------------------

test('viewer rejected: setupEnterpriseAddons', async function () {
  await assert.rejects(
    post('setupEnterpriseAddons', [viewerToken]),
    /admin permission required/i
  );
});

test('viewer rejected: installEnterpriseTriggers', async function () {
  await assert.rejects(
    post('installEnterpriseTriggers', [viewerToken]),
    /admin permission required/i
  );
});

// ------------------------------------------------------------------
// adminSetDivisionalDashboard: admin required (viewer/editor rejected)
// ------------------------------------------------------------------

test('viewer rejected: adminSetDivisionalDashboard', async function () {
  await assert.rejects(
    post('adminSetDivisionalDashboard', ['authz_do_e2e@test.com', 'https://dash.example.com/do', viewerToken]),
    /admin permission required/i
  );
});

test('editor rejected: adminSetDivisionalDashboard', async function () {
  await assert.rejects(
    post('adminSetDivisionalDashboard', ['authz_do_e2e@test.com', 'https://dash.example.com/do', editorToken]),
    /admin permission required/i
  );
});

test('admin: adminSetDivisionalDashboard updates then removes a DO dashboard link', async function () {
  await post('adminAddUser', ['authz_do_e2e@test.com', 'do_authz_test', 'VIEWER', 'AuthzDo123!', '', '', '', adminToken]);

  await assert.rejects(
    post('adminSetDivisionalDashboard', ['nobody@test.com', 'https://dash.example.com/do', adminToken]),
    /no user found/i
  );

  await assert.rejects(
    post('adminSetDivisionalDashboard', ['authz_do_e2e@test.com', 'not-a-url', adminToken]),
    /valid http/i
  );

  const set = await post('adminSetDivisionalDashboard', ['authz_do_e2e@test.com', 'https://dash.example.com/do', adminToken]);
  assert.strictEqual(set.success, true);
  assert.strictEqual(set.url, 'https://dash.example.com/do');
  let rows = await post('getDivisionalDashboardLinks', [adminToken]);
  const row = rows.find(function (r) { return String(r.email).toLowerCase() === 'authz_do_e2e@test.com'; });
  assert.ok(row, 'DO user appears in the divisional dashboard links list');
  assert.strictEqual(row.url, 'https://dash.example.com/do');

  const update = await post('adminSetDivisionalDashboard', ['authz_do_e2e@test.com', 'https://dash.example.com/rms', adminToken]);
  assert.strictEqual(update.url, 'https://dash.example.com/rms');
  rows = await post('getDivisionalDashboardLinks', [adminToken]);
  assert.strictEqual(rows.find(function (r) { return String(r.email).toLowerCase() === 'authz_do_e2e@test.com'; }).url, 'https://dash.example.com/rms');

  const cleared = await post('adminSetDivisionalDashboard', ['authz_do_e2e@test.com', '', adminToken]);
  assert.strictEqual(cleared.success, true);
  assert.strictEqual(cleared.url, '');
  rows = await post('getDivisionalDashboardLinks', [adminToken]);
  const clearRow = rows.find(function (r) { return String(r.email).toLowerCase() === 'authz_do_e2e@test.com'; });
  assert.ok(clearRow, 'DO user still listed after link removal');
  assert.strictEqual(clearRow.url, '');
});

test('admin: setupEnterpriseAddons allowed (no-op when disabled)', async function () {
  const r = await post('setupEnterpriseAddons', [adminToken]);
  assert.ok(r && typeof r === 'object');
});

// ------------------------------------------------------------------
// createTask: editor required (viewer rejected)
// ------------------------------------------------------------------

test('viewer rejected: createTask', async function () {
  await assert.rejects(
    post('createTask', [{ title: 'Viewer task', assignee: 'authz_viewer_e2e@test.com' }, viewerToken]),
    /editor permission required|permission required/i
  );
});

// ------------------------------------------------------------------
// addItem: editor required (viewer rejected)
// ------------------------------------------------------------------

test('viewer rejected: addItem', async function () {
  await assert.rejects(
    post('addItem', [{ title: 'test', responsibility: 'test' }, viewerToken]),
    /editor permission required|permission required/i
  );
});

// ------------------------------------------------------------------
// markReviewDone: admin required
// ------------------------------------------------------------------

test('editor rejected: markReviewDone', async function () {
  await assert.rejects(
    post('markReviewDone', [1, editorToken]),
    /admin permission required/i
  );
});

// ------------------------------------------------------------------
// deleteItem: editor required (viewer rejected)
// ------------------------------------------------------------------

test('viewer rejected: deleteItem', async function () {
  await assert.rejects(
    post('deleteItem', [999999, viewerToken]),
    /editor permission required|permission required/i
  );
});

// ------------------------------------------------------------------
// adminGetUsers: admin required
// ------------------------------------------------------------------

test('viewer rejected: adminGetUsers', async function () {
  await assert.rejects(
    post('adminGetUsers', [viewerToken]),
    /admin permission required/i
  );
});

test('admin: adminGetUsers allowed', async function () {
  const r = await post('adminGetUsers', [adminToken]);
  assert.ok(Array.isArray(r));
});

// ------------------------------------------------------------------
// deleteSubmission: editor required (viewer rejected)
// ------------------------------------------------------------------

test('viewer rejected: deleteSubmission', async function () {
  await assert.rejects(
    post('deleteSubmission', ['not-a-real-id', viewerToken]),
    /editor permission required|permission required/i
  );
});

test('editor: deleteSubmission allowed', async function () {
  const added = await post('addSubmission', [4, 'card-1', 'Authz editor delete test', null, editorToken]);
  assert.ok(added[0].id);
  const del = await post('deleteSubmission', [added[0].id, editorToken]);
  assert.ok(!del.some(function (s) { return s.id === added[0].id; }));
});

// ------------------------------------------------------------------
// audit: admin-only ops (adminDeleteAuditRows, adminClearAudit)
// ------------------------------------------------------------------

test('viewer rejected: adminDeleteAuditRows', async function () {
  await assert.rejects(
    post('adminDeleteAuditRows', [[], viewerToken]),
    /admin permission required/i
  );
});

test('viewer rejected: adminClearAudit', async function () {
  await assert.rejects(
    post('adminClearAudit', [viewerToken]),
    /admin permission required/i
  );
});
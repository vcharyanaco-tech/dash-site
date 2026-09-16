/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/validators.test.js
 * Phase 1D: input validation + AUTH_ARG_INDEX cookie-injection
 * tests for the new validators and cookie-injected ops.
 * Run: npm test  (node --test tests/)
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { password } = require('./test-bootstrap');
const { server } = require('../index');

let port;
let adminToken;
let adminCookie;
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
});

async function postRaw(fn, args, opts) {
  const headers = { 'Content-Type': 'text/plain' };
  if (opts && opts.cookie) headers.Cookie = opts.cookie;
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ function: fn, args: args || [] })
  });
  return resp.json();
}

async function post(fn, args, opts) {
  const body = await postRaw(fn, args, opts);
  if (body.error) throw new Error(fn + ': ' + body.error);
  return body.result;
}

// ------------------------------------------------------------------
// Setup: login admin, create viewer + editor
// ------------------------------------------------------------------

test('setup: login admin + create viewer + editor', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: 'login', args: ['vcharyanaco@gmail.com', password] })
  });
  const res = await resp.json();
  assert.strictEqual(res.result.success, true);
  adminToken = res.result.token;
  adminCookie = (resp.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(adminCookie.startsWith('dash_session='));

  const v = await post('adminAddUser',
    ['vali_viewer@test.com', 'vali_viewer', 'VIEWER', 'ValidView123!', '', '', '', adminToken]);
  assert.ok(v);

  const e = await post('adminAddUser',
    ['vali_editor@test.com', 'vali_editor', 'EDITOR', 'ValidEdit123!', '', '', '', adminToken]);
  assert.ok(e);

  viewerToken = (await post('login', ['vali_viewer@test.com', 'ValidView123!'])).token;
  editorToken = (await post('login', ['vali_editor@test.com', 'ValidEdit123!'])).token;
});

after(function () {
  if (adminToken) {
    post('adminDeleteUser', ['vali_viewer@test.com', adminToken]).catch(function () {});
    post('adminDeleteUser', ['vali_editor@test.com', adminToken]).catch(function () {});
  }
});

// ------------------------------------------------------------------
// Validator tests: malformed / missing args
// ------------------------------------------------------------------

const validatorCases = [
  { fn: 'changePassword', goodArgs: ['old', 'new', adminToken], badArgs: [], msg: /changePassword requires/ },
  { fn: 'changePassword', goodArgs: ['old', 'new', adminToken], badArgs: [123, 456, adminToken], msg: /passwords must be strings/ },
  { fn: 'markReviewDone', goodArgs: [1, adminToken], badArgs: [], msg: /markReviewDone requires/ },
  { fn: 'markReviewNotDone', goodArgs: [1, adminToken], badArgs: [], msg: /markReviewNotDone requires/ },
  { fn: 'adminUpdateUser', goodArgs: ['x@y.com', { role: 'VIEWER' }, adminToken], badArgs: [], msg: /adminUpdateUser requires/ },
  { fn: 'adminUpdateUser', goodArgs: ['x@y.com', { role: 'VIEWER' }, adminToken], badArgs: ['', {}, adminToken], msg: /email is required/ },
  { fn: 'adminUpdateUser', goodArgs: ['x@y.com', { role: 'VIEWER' }, adminToken], badArgs: ['x@y.com', 'bad', adminToken], msg: /fields must be an object/ },
  { fn: 'emailReport', goodArgs: [adminToken, 'a@b.com', 'weekly'], badArgs: [], msg: /emailReport requires/ },
  { fn: 'emailReport', goodArgs: [adminToken, 'a@b.com', 'weekly'], badArgs: [adminToken, '', 'weekly'], msg: /recipient is required/ },
  { fn: 'getReportData', goodArgs: [adminToken, 'weekly'], badArgs: [], msg: /getReportData requires/ },
  { fn: 'exportFullBackup', goodArgs: [adminToken], badArgs: [], msg: /exportFullBackup requires/ },
  { fn: 'setOpenRouterApiKey', goodArgs: [adminToken, 'sk-test'], badArgs: [], msg: /setOpenRouterApiKey requires/ },
  { fn: 'setOpenRouterApiKey', goodArgs: [adminToken, 'sk-test'], badArgs: [adminToken, ''], msg: /apiKey is required/ },
  { fn: 'setGeminiApiKey', goodArgs: [adminToken, 'key'], badArgs: [], msg: /setGeminiApiKey requires/ },
  { fn: 'setGeminiApiKey', goodArgs: [adminToken, 'key'], badArgs: [adminToken, ''], msg: /apiKey is required/ },
  { fn: 'setGroqApiKey', goodArgs: [adminToken, 'key'], badArgs: [], msg: /setGroqApiKey requires/ },
  { fn: 'setGroqApiKey', goodArgs: [adminToken, 'key'], badArgs: [adminToken, ''], msg: /apiKey is required/ },
  { fn: 'setHuggingFaceApiKey', goodArgs: [adminToken, 'key'], badArgs: [], msg: /setHuggingFaceApiKey requires/ },
  { fn: 'setHuggingFaceApiKey', goodArgs: [adminToken, 'key'], badArgs: [adminToken, ''], msg: /apiKey is required/ },
  { fn: 'setKiloApiKey', goodArgs: [adminToken, 'key'], badArgs: [], msg: /setKiloApiKey requires/ },
  { fn: 'setKiloApiKey', goodArgs: [adminToken, 'key'], badArgs: [adminToken, ''], msg: /apiKey is required/ },
];

for (const c of validatorCases) {
  test('validator rejects: ' + c.fn + ' (' + c.msg + ')', async function () {
    const body = await postRaw(c.fn, c.badArgs);
    assert.ok(body.error, 'expected validation error for ' + c.fn);
    assert.match(body.error, c.msg);
  });
}

// ------------------------------------------------------------------
// AUTH_ARG_INDEX cookie-injection tests:
// ops that were missing AUTH_ARG_INDEX now work via cookie only
// ------------------------------------------------------------------

test('cookie-injection: setRecordDisplay via cookie (no token in args)', async function () {
  const data = await post('getData');
  const row = data.items[0].row;
  const result = await post('setRecordDisplay', [row, true], { cookie: adminCookie });
  assert.ok(result && result.items, 'setRecordDisplay returns appData');
  await post('setRecordDisplay', [row, false], { cookie: adminCookie });
});

test('cookie-injection: generateReviewNotifications via cookie', async function () {
  const result = await post('generateReviewNotifications', [], { cookie: adminCookie });
  assert.ok(result);
});

test('cookie-injection: reconcileRecordOrder (dryRun) via cookie', async function () {
  const result = await post('reconcileRecordOrder', [true], { cookie: adminCookie });
  assert.ok(result);
});

test('cookie-injection: adminSyncFromSheet via cookie', async function () {
  const result = await post('adminSyncFromSheet', [], { cookie: adminCookie });
  assert.ok(result && result.pull !== undefined);
});

test('cookie-injection: adminPreviewSyncFromSheet via cookie', async function () {
  const result = await post('adminPreviewSyncFromSheet', [], { cookie: adminCookie });
  assert.ok(result);
});

test('cookie-injection: adminPushToSheet via cookie', async function () {
  const result = await post('adminPushToSheet', [], { cookie: adminCookie });
  assert.ok(result);
});

test('cookie-injection: exportFullBackup via cookie', async function () {
  const result = await post('exportFullBackup', [], { cookie: adminCookie });
  assert.ok(result);
});

// ------------------------------------------------------------------
// API key setters: admin-only, cookie-injected
// ------------------------------------------------------------------

test('cookie-injection: setOpenRouterApiKey via cookie', async function () {
  const result = await post('setOpenRouterApiKey', ['sk-test-openrouter'], { cookie: adminCookie });
  assert.ok(result);
});

test('cookie-injection: setGeminiApiKey via cookie', async function () {
  const result = await post('setGeminiApiKey', ['sk-test-gemini'], { cookie: adminCookie });
  assert.ok(result);
});

test('cookie-injection: setGroqApiKey via cookie', async function () {
  const result = await post('setGroqApiKey', ['sk-test-groq'], { cookie: adminCookie });
  assert.ok(result);
});

test('cookie-injection: setHuggingFaceApiKey via cookie', async function () {
  const result = await post('setHuggingFaceApiKey', ['sk-test-hf'], { cookie: adminCookie });
  assert.ok(result);
});

test('cookie-injection: setKiloApiKey via cookie', async function () {
  const result = await post('setKiloApiKey', ['sk-test-kilo'], { cookie: adminCookie });
  assert.ok(result);
});

// ------------------------------------------------------------------
// Admin-only ops: viewer/editor rejected
// ------------------------------------------------------------------

test('viewer rejected: markReviewDone', async function () {
  await assert.rejects(
    post('markReviewDone', [1, viewerToken]),
    /admin permission required/i
  );
});

test('editor rejected: markReviewDone', async function () {
  await assert.rejects(
    post('markReviewDone', [1, editorToken]),
    /admin permission required/i
  );
});

test('viewer rejected: markReviewNotDone', async function () {
  await assert.rejects(
    post('markReviewNotDone', [1, viewerToken]),
    /admin permission required/i
  );
});

test('editor rejected: markReviewNotDone', async function () {
  await assert.rejects(
    post('markReviewNotDone', [1, editorToken]),
    /admin permission required/i
  );
});

test('viewer rejected: exportFullBackup', async function () {
  await assert.rejects(
    post('exportFullBackup', [viewerToken]),
    /admin permission required/i
  );
});

test('viewer rejected: setOpenRouterApiKey', async function () {
  await assert.rejects(
    post('setOpenRouterApiKey', [viewerToken, 'key']),
    /admin permission required/i
  );
});

test('viewer rejected: setGeminiApiKey', async function () {
  await assert.rejects(
    post('setGeminiApiKey', [viewerToken, 'key']),
    /admin permission required/i
  );
});

test('viewer rejected: setGroqApiKey', async function () {
  await assert.rejects(
    post('setGroqApiKey', [viewerToken, 'key']),
    /admin permission required/i
  );
});

test('viewer rejected: setHuggingFaceApiKey', async function () {
  await assert.rejects(
    post('setHuggingFaceApiKey', [viewerToken, 'key']),
    /admin permission required/i
  );
});

test('viewer rejected: setKiloApiKey', async function () {
  await assert.rejects(
    post('setKiloApiKey', [viewerToken, 'key']),
    /admin permission required/i
  );
});

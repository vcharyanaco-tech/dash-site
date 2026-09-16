/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/cookie-injection.test.js
 * Phase 1B: the browser no longer sends a session token arg at
 * all — the HttpOnly dash_session cookie is the ONLY auth input.
 * The /api middleware injects the cookie token at the op's
 * AUTH_ARG_INDEX slot, shifting data rightward when it occupies
 * the token slot (token-first ops) or appending when the args are
 * all data (append-token ops). A stale token-shaped string in the
 * slot is treated as the cookie's inferior and replaced.
 * Run: npm test  (node --test tests/)
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { password } = require('./test-bootstrap');
const { server } = require('../index');

const AUTH_ERROR_RE = /login required|session expired|please log in|permission required|requires \(.*token\)/i;
const ROW = { sector: 'Test', description: 'cookie-injection record', entryDate: '09.08.2026', action: 'Do nothing', responsibility: 'co_admin', reviewDate: '10.08.2026' };

let port;
let adminCookie;

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

// eslint-disable-next-line no-unused-vars
async function post(fn, args, opts) {
  const body = await postRaw(fn, args, opts);
  if (body.error) throw new Error(fn + ': ' + body.error);
  return body.result;
}

test('setup: login admin, capture cookie', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: 'login', args: ['vcharyanaco@gmail.com', password] })
  });
  const res = await resp.json();
  assert.strictEqual(res.result.success, true);
  adminCookie = (resp.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(adminCookie.startsWith('dash_session='));
});

test('append-token op: addItem({record}) injects cookie at index 1', async function () {
  const result = await post('addItem', [ROW], { cookie: adminCookie });
  assert.ok(result && result.user && result.user.loggedIn === true, 'expected appData-style result after addItem');
});

test('token-first op: getSubmissions([0]) shifts data right of injected cookie', async function () {
  const result = await post('getSubmissions', [0], { cookie: adminCookie });
  assert.ok(Array.isArray(result), 'expected submissions array for row 0');
});

test('token-first op: getMeetingFile([name]) reaches the handler, not the auth gate', async function () {
  const body = await postRaw('getMeetingFile', ['cookie-injection-test.md'], { cookie: adminCookie });
  assert.strictEqual(body.error, undefined, 'auth must pass; got error: ' + body.error);
  assert.strictEqual(body.result.success, false, 'expected clean file-not-found result');
  assert.strictEqual(body.result.message, 'File not found.');
});

test('stale 64-hex token in slot is replaced by the cookie (cookie is authoritative)', async function () {
  const stale = 'a'.repeat(64);
  const result = await post('getAppData', [stale], { cookie: adminCookie });
  assert.ok(result && result.user && result.user.loggedIn === true, 'cookie must win over the stale token string');
});

test('no cookie and no token arg -> login required', async function () {
  const body = await postRaw('getAppData', [], {});
  assert.ok(AUTH_ERROR_RE.test(body.error || ''), 'expected auth error, got: ' + JSON.stringify(body));
});

test('single apiKey arg still works through the generalized splice', async function () {
  const result = await post('setOpenRouterApiKey', ['sk-cookie-injection-test'], { cookie: adminCookie });
  assert.strictEqual(result.ok, true);
});
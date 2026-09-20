/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/session-rotation.test.js
 * Phase 13, section 3 — session rotation lifecycle:
 *   - creation
 *   - authenticated request
 *   - rotation (new session, old destroyed, new identifier
 *     handed to the browser via Set-Cookie)
 *   - new-session request works, old-session rejection
 *   - expiry
 *   - logout invalidation
 *   - concurrent requests around rotation stay consistent
 *   - changePassword invalidates every other session
 *   - adminResetPassword forces the target to re-login
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { password } = require('./test-bootstrap');
const { server } = require('../index');
const { db } = require('../db');

let port;
let adminToken;
let pwUser;
let pwUserToken;

const PW_USER = 'rotpw_target@test.com';
const PW_USER_OLD = 'RotPwOld!23456';
const PW_USER_NEW = 'RotPwNew!234567';

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
  try {
    db.prepare('DELETE FROM users WHERE email = ?').run(PW_USER);
  } catch (err) {}
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

/** raw POST retaining the response headers (to inspect Set-Cookie). */
async function postRaw(fn, args) {
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: fn, args: args || [] })
  });
  return { status: resp.status, headers: resp.headers, body: await resp.json() };
}

function sessionCookieOf(headers) {
  const setCookie = headers.get('set-cookie') || '';
  const m = String(setCookie).match(/dash_session=([^;]+);\s*HttpOnly/i);
  return m ? m[1] : null;
}

test('setup: admin login issues a live session', async function () {
  const a = await post('login', ['vcharyanaco@gmail.com', password]);
  assert.ok(a.token && /^[0-9a-f]{64}$/i.test(a.token));
  adminToken = a.token;
  const ok = await post('validateSession', [adminToken]);
  assert.strictEqual(ok.success, true);
});

test('rotation: new token issued, old token is rejected, new one works', async function () {
  const oldToken = adminToken;

  const rotated = await post('rotateSession', [oldToken]);
  assert.ok(rotated.token && /^[0-9a-f]{64}$/i.test(rotated.token));
  assert.notStrictEqual(rotated.token, oldToken);
  adminToken = rotated.token;

  // New session: authenticated request works.
  const freshOk = await post('validateSession', [adminToken]);
  assert.strictEqual(freshOk.success, true);
  const data = await post('getAppData', [adminToken]);
  assert.ok(Array.isArray(data.items));

  // Old session: rejected.
  const stale = await post('validateSession', [oldToken]);
  assert.strictEqual(stale.success, false);
  await assert.rejects(
    post('getAppData', [oldToken]),
    /login required|session expired|please log in/i
  );

  // The old session row is gone from the store.
  const staleRow = db.prepare('SELECT COUNT(*) n FROM sessions WHERE token = ?').get(oldToken);
  assert.strictEqual(Number(staleRow.n), 0);
});

test('rotation: browser receives the new session identifier via Set-Cookie', async function () {
  const loginResp = await postRaw('login', ['vcharyanaco@gmail.com', password]);
  const cookieBefore = sessionCookieOf(loginResp.headers);
  assert.ok(cookieBefore, 'login issues a dash_session cookie');

  // The browser never sends the token as an arg — it sends the HttpOnly
  // cookie. Send the cookie on the rotation request like a real browser.
  const rotateResp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      Cookie: 'dash_session=' + cookieBefore
    },
    body: JSON.stringify({ function: 'rotateSession', args: [] })
  });
  const rotateBody = await rotateResp.json();
  assert.ok(rotateBody && rotateBody.result && rotateBody.result.success);
  const cookieAfter = sessionCookieOf(rotateResp.headers);
  assert.ok(cookieAfter, 'rotateSession re-issues the dash_session cookie');
  assert.notStrictEqual(cookieAfter, cookieBefore, 'cookie carries the NEW token');

  // And the new cookie actually authenticates a subsequent request.
  const followUp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      Cookie: 'dash_session=' + cookieAfter
    },
    body: JSON.stringify({ function: 'validateSession', args: [] })
  });
  const followUpBody = await followUp.json();
  assert.strictEqual(followUpBody.result && followUpBody.result.success, true);
});

test('rotation is idempotent under repeated rotation', async function () {
  const a = await post('rotateSession', [adminToken]);
  adminToken = a.token;
  const b = await post('rotateSession', [adminToken]);
  adminToken = b.token;
  const ok = await post('validateSession', [adminToken]);
  assert.strictEqual(ok.success, true);
});

test('expiry: an expired session is rejected and logs no one in', async function () {
  const t = (await post('login', ['vcharyanaco@gmail.com', password])).token;
  db.prepare('UPDATE sessions SET expires_at = 0 WHERE token = ?').run(t);
  const r = await post('validateSession', [t]);
  assert.strictEqual(r.success, false);
});

test('logout invalidates the session', async function () {
  const t = (await post('login', ['vcharyanaco@gmail.com', password])).token;
  const out = await post('logout', [t]);
  assert.strictEqual(out.success, true);
  const r = await post('validateSession', [t]);
  assert.strictEqual(r.success, false);
});

test('concurrent requests around rotation stay consistent', async function () {
  const base = (await post('login', ['vcharyanaco@gmail.com', password])).token;

  // Fire a burst of parallel requests while rotating. Every response must be
  // a determinate success (old token still valid at call time) or a clean
  // auth rejection (old token already destroyed) — never a 500/crash — and
  // the rotated session must be usable afterwards.
  const burst = [];
  for (let i = 0; i < 12; i++) {
    burst.push(post('validateSession', [base]).catch(function (e) { return { error: e.message }; }));
  }
  const rotated = await post('rotateSession', [base]);
  const results = await Promise.all(burst);
  results.forEach(function (r) {
    if (r && r.success !== undefined) assert.strictEqual(r.success, true);
    else if (r && r.error) assert.match(String(r.error), /login required|session expired|please log in/i);
    else assert.fail('unexpected result during rotation burst');
  });

  const ok = await post('validateSession', [rotated.token]);
  assert.strictEqual(ok.success, true);
  const stale = await post('validateSession', [base]);
  assert.strictEqual(stale.success, false);
});

test('changePassword invalidates every other session but keeps the caller signed in', async function () {
  await post('adminAddUser', [PW_USER, 'rotpw', 'VIEWER', PW_USER_OLD, '', '', '', adminToken]);
  const s1 = (await post('login', [PW_USER, PW_USER_OLD])).token;
  const s2 = (await post('login', [PW_USER, PW_USER_OLD])).token;
  assert.notStrictEqual(s1, s2);

  const changed = await post('changePassword', [PW_USER_OLD, PW_USER_NEW, s1]);
  assert.strictEqual(changed.success, true);

  // The session that changed the password is still live.
  const callerOk = await post('validateSession', [s1]);
  assert.strictEqual(callerOk.success, true);

  // Every other session for the user is destroyed.
  const otherOk = await post('validateSession', [s2]);
  assert.strictEqual(otherOk.success, false);

  // Old password no longer works, new password does.
  const oldLogin = await post('login', [PW_USER, PW_USER_OLD]);
  assert.strictEqual(oldLogin.success, false);
  const newLogin = await post('login', [PW_USER, PW_USER_NEW]);
  assert.strictEqual(newLogin.success, true);

  pwUser = s1;
  pwUserToken = newLogin.token;
});

test('adminResetPassword forces the target account to re-login', async function () {
  const target = (await post('login', [PW_USER, PW_USER_NEW])).token;
  assert.strictEqual((await post('validateSession', [target])).success, true);

  const reset = await post('adminResetPassword', [PW_USER, 'RotPwAdmin!23456', adminToken]);
  assert.ok(Array.isArray(reset));

  const afterReset = await post('validateSession', [target]);
  assert.strictEqual(afterReset.success, false, 'old session is destroyed after admin reset');
  const relogin = await post('login', [PW_USER, 'RotPwAdmin!23456']);
  assert.strictEqual(relogin.success, true);
});
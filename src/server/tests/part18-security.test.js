/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/part18-security.test.js
 * Part 18 security scenarios not covered elsewhere: invalid and
 * expired sessions, login throttling, password-reset enumeration
 * safety, object-level task authorization, and document-route path
 * traversal.
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { password } = require('./test-bootstrap');
const { server } = require('../index');
const { db } = require('../db');

let port;
let adminToken;
let viewer1Token;
let viewer2Token;
let taskId;

const V1 = 'part18_viewer1@test.com';
const V2 = 'part18_viewer2@test.com';
const V1_PW = 'Part18Viewer1!';
const V2_PW = 'Part18Viewer2!';
const NOBODY = 'part18_nobody@test.com';

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
    db.prepare('DELETE FROM tasks WHERE assignee IN (?, ?)').run(V1, V2);
    db.prepare('DELETE FROM users WHERE email IN (?, ?, ?)').run(V1, V2, NOBODY);
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

test('setup: admin + two viewers with an assigned task', async function () {
  const a = await post('login', ['vcharyanaco@gmail.com', password]);
  assert.ok(a.token);
  adminToken = a.token;

  await post('adminAddUser', [V1, 'part18_viewer1', 'VIEWER', V1_PW, '', '', '', adminToken]);
  await post('adminAddUser', [V2, 'part18_viewer2', 'VIEWER', V2_PW, '', '', '', adminToken]);

  viewer1Token = (await post('login', [V1, V1_PW])).token;
  viewer2Token = (await post('login', [V2, V2_PW])).token;
  assert.ok(viewer1Token && viewer2Token);

  const task = await post('createTask', [{ title: 'Part 18 object-level task', assignee: V1 }, adminToken]);
  assert.ok(task && task.id);
  taskId = task.id;
});

/* ------------------------------------------------------------------
 * Invalid + expired sessions
 * ------------------------------------------------------------------ */

test('invalid session token cannot validate', async function () {
  const r = await post('validateSession', ['part18-not-a-real-token']);
  assert.strictEqual(r.success, false);
});

test('invalid session token is rejected by a protected op', async function () {
  await assert.rejects(
    post('getTaskCounts', ['part18-not-a-real-token']),
    /login required|session expired|please log in/i
  );
});

test('expired session is rejected', async function () {
  const token = (await post('login', [V2, V2_PW])).token;
  db.prepare('UPDATE sessions SET expires_at = 0 WHERE token = ?').run(token);

  const r = await post('validateSession', [token]);
  assert.strictEqual(r.success, false);
  await assert.rejects(
    post('getTaskCounts', [token]),
    /login required|session expired|please log in/i
  );
});

/* ------------------------------------------------------------------
 * Login throttling
 * ------------------------------------------------------------------ */

test('repeated bad logins lock the identifier', async function () {
  let last;
  for (let i = 0; i < 6; i++) {
    last = await post('login', [NOBODY, 'definitely-wrong']);
    assert.strictEqual(last.success, false);
  }
  assert.match(String(last.message || ''), /too many failed attempts/i);
});

/* ------------------------------------------------------------------
 * Password reset: no account enumeration
 * ------------------------------------------------------------------ */

test('requestPasswordReset does not reveal whether an account exists', async function () {
  const known = await post('requestPasswordReset', [V2]);
  const unknown = await post('requestPasswordReset', [NOBODY]);
  assert.strictEqual(known.success, true);
  assert.strictEqual(unknown.success, true);
  assert.strictEqual(known.message, unknown.message);
});

test('requestPasswordReset rejects an empty identifier', async function () {
  await assert.rejects(
    post('requestPasswordReset', ['   ']),
    /requires \(identifier\)/i
  );
});

/* ------------------------------------------------------------------
 * Object-level authorization (tasks)
 * ------------------------------------------------------------------ */

test('assignee may update their own task', async function () {
  const r = await post('updateTask', [taskId, { status: 'IN_PROGRESS' }, viewer1Token]);
  assert.ok(r);
  const fresh = await post('getMyTasks', [viewer1Token]);
  assert.ok(Array.isArray(fresh));
});

test('a different viewer cannot update someone else\'s task', async function () {
  await assert.rejects(
    post('updateTask', [taskId, { status: 'DONE' }, viewer2Token]),
    /permission denied/i
  );
});

test('a non-editor assignee cannot reassign the task', async function () {
  await assert.rejects(
    post('updateTask', [taskId, { assignee: V2 }, viewer1Token]),
    /only editors can reassign/i
  );
});

/* ------------------------------------------------------------------
 * Document route: path traversal
 * ------------------------------------------------------------------ */

test('document file route rejects traversal keys with 404', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api/files/' + encodeURIComponent('../../server/index.js'));
  assert.strictEqual(resp.status, 404);
  const text = await resp.text();
  assert.ok(text.indexOf('require(') === -1, 'served source content on a traversal key');
});

test('unknown document key returns 404', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api/files/not-a-real-key');
  assert.strictEqual(resp.status, 404);
});

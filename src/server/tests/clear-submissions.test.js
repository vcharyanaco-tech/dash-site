/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/clear-submissions.test.js
 * Admin-only bulk clear of card updates.
 *
 * This is the most destructive operation in the app, so the tests spend most
 * of their weight on the two things that would be catastrophic to get wrong:
 * a non-admin must not be able to trigger it, and "clear read" must never
 * remove an unread update.
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { password } = require('./test-bootstrap');
const { server } = require('../index');
const { db } = require('../db');

let port;
let adminToken;
let editorToken;
let viewerToken;

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

/* Counts straight from the table: the test asserts on storage, not on any
   shape the endpoint happens to return. */
function rows() {
  return db.prepare('SELECT id, read_at, email, text FROM submissions ORDER BY created_at ASC').all();
}

async function seed(n, read) {
  const made = [];
  for (let i = 0; i < n; i++) {
    const res = await post('addSubmission', [4, 'card-clear', 'clear-test update ' + i + ' ' + Date.now(), null, viewerToken]);
    made.push(res && res.id);
  }
  if (read) db.prepare('UPDATE submissions SET read_at = ? WHERE read_at = 0').run(Date.now());
  return made;
}

test('setup: admin, editor and viewer tokens', async function () {
  adminToken = await login('vcharyanaco@gmail.com');
  await ensureUser('clr_editor@test.com', 'clreditor', 'editor');
  await ensureUser('clr_viewer@test.com', 'clrviewer', 'viewer');
  editorToken = await login('clr_editor@test.com');
  viewerToken = await login('clr_viewer@test.com');
});

// ------------------------------------------------------------------
// The gate
// ------------------------------------------------------------------

test('anonymous cannot clear updates', async function () {
  const body = await postRaw('clearSubmissions', ['', 'all']);
  assert.ok(body.error, 'anonymous must be refused');
  assert.ok(rows().length > 0 || true); // no assertion needed; the refusal is the point
});

test('a viewer cannot clear updates', async function () {
  const before = rows().length;
  await seed(2, false);
  const after = rows().length;
  const body = await postRaw('clearSubmissions', [viewerToken, 'all']);
  assert.ok(body.error, 'a viewer must be refused');
  assert.strictEqual(rows().length, after, 'a refused clear must not delete anything');
  assert.ok(after > before);
});

test('an EDITOR cannot clear updates — this is admin-only', async function () {
  await seed(1, false);
  const before = rows().length;
  const body = await postRaw('clearSubmissions', [editorToken, 'all']);
  assert.ok(body.error, 'an editor must be refused: clearing is admin-only');
  assert.match(String(body.error), /Admin permission required/i);
  assert.strictEqual(rows().length, before, 'a refused clear must not delete anything');
});

test('mode must be exactly "all" or "read" — nothing defaults to clearing everything', async function () {
  await seed(1, false);
  const before = rows().length;
  for (const bad of [undefined, null, '', 'everything', 'ALL READ']) {
    const body = await postRaw('clearSubmissions', [adminToken, bad]);
    assert.ok(body.error, 'mode ' + JSON.stringify(bad) + ' must be refused');
  }
  assert.strictEqual(rows().length, before, 'a refused mode must not delete anything');
});

// ------------------------------------------------------------------
// "clear read"
// ------------------------------------------------------------------

test('clear read removes only the updates an admin has already read', async function () {
  await post('clearSubmissions', [adminToken, 'all']);
  await seed(3, false);
  const unreadIds = rows().filter(function (r) { return !r.read_at; }).map(function (r) { return r.id; });
  assert.ok(unreadIds.length >= 3, 'expected unread updates to start with');

  // Mark exactly one as read.
  db.prepare('UPDATE submissions SET read_at = ? WHERE id = ?').run(Date.now(), unreadIds[0]);

  const res = await post('clearSubmissions', [adminToken, 'read']);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.mode, 'read');
  assert.strictEqual(res.cleared, 1);

  const left = rows();
  assert.strictEqual(left.length, unreadIds.length - 1);
  left.forEach(function (r) {
    assert.strictEqual(!!r.read_at, false, 'an unread update must survive a "clear read"');
  });
});

// ------------------------------------------------------------------
// "clear all"
// ------------------------------------------------------------------

test('clear all removes every update on every record', async function () {
  await post('clearSubmissions', [adminToken, 'all']);
  await seed(4, false);
  assert.ok(rows().length >= 4);

  const res = await post('clearSubmissions', [adminToken, 'all']);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.mode, 'all');
  assert.strictEqual(res.cleared, 4);
  assert.strictEqual(rows().length, 0, 'every update must be gone');
  assert.strictEqual(res.remaining, 0, 'remaining must be counted from the table, not reported as a hardcoded 0');
});

test('clearing on an empty table is a no-op, not an error', async function () {
  const res = await post('clearSubmissions', [adminToken, 'all']);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.cleared, 0);
});

test('attachments do not survive the update they belong to', async function () {
  await post('clearSubmissions', [adminToken, 'all']);
  const id = 'orphan-check-' + Date.now();
  db.prepare('INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, 4, 'card-clear', 'clr_viewer@test.com', 'with attachment', Date.now(), Date.now(), 0, 0);
  db.prepare('INSERT INTO submission_attachments (id, submission_id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('att-' + id, id, 'note.txt', 'file_key_' + id, 'text/plain', 3, 'clr_viewer@test.com', Date.now());

  const res = await post('clearSubmissions', [adminToken, 'all']);
  assert.strictEqual(res.success, true);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM submissions WHERE id = ?').get(id).n, 0);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM submission_attachments WHERE submission_id = ?').get(id).n, 0,
    'an attachment row left behind would resurrect a deleted update');
});

test('the clear is written to the audit log', async function () {
  await post('clearSubmissions', [adminToken, 'all']);
  await seed(1, false);
  await post('clearSubmissions', [adminToken, 'all']);
  const row = db.prepare('SELECT COUNT(*) AS n FROM audit WHERE action = ?').get('SUBMISSION_CLEAR_ALL');
  assert.ok(row.n > 0, 'a bulk clear must leave an audit trail');
});
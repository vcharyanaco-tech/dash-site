/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/api-security.test.js
 * Phase 13 §6 API security review regression tests:
 *  - getData now requires a login and scopes viewers to displayed records
 *  - deleteSubmission respects admin locks (editors keep deleting unlocked)
 *  - updateTask: non-editor assignees are status-only
 *  - automation CREATE_TASK idempotency (no per-tick duplicates)
 *  - roleCache invalidation (role changes take effect immediately)
 *  - document write ops require editor
 *  - unsafe attachment MIME is forced to download inline
 *  - static sensitive-path denial
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { password } = require('./test-bootstrap');
const { server } = require('../index');
const { db } = require('../db');
const automation = require('../automation');
const documents = require('../documents');

let port;
let adminToken;
let adminCookie;
let editorToken;
let viewer1Token;
let viewer2Token;

const EDITOR = 'sec_editor@test.com';
const EDITOR_PW = 'SecEditor123!';
const VIEWER1 = 'sec_viewer1@test.com';
const VIEWER2 = 'sec_viewer2@test.com';
const VIEWER_PW = 'SecViewer123!';
const UPLOADS_DIR = documents.UPLOADS_DIR;

before(async function () {
  await new Promise(function (resolve) {
    server.listen(0, function () {
      port = server.address().port;
      resolve();
    });
  });
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: 'login', args: ['vcharyanaco@gmail.com', password] })
  });
  const res = await resp.json();
  assert.strictEqual(res.result.success, true);
  adminToken = res.result.token;
  adminCookie = (resp.headers.get('set-cookie') || '').split(';')[0];

  await post('adminAddUser', [EDITOR, 'sec_editor', 'EDITOR', EDITOR_PW, '', '', '', adminToken]);
  await post('adminAddUser', [VIEWER1, 'sec_viewer1', 'VIEWER', VIEWER_PW, '', '', '', adminToken]);
  await post('adminAddUser', [VIEWER2, 'sec_viewer2', 'VIEWER', VIEWER_PW, '', '', '', adminToken]);

  editorToken = (await post('login', [EDITOR, EDITOR_PW])).token;
  viewer1Token = (await post('login', [VIEWER1, VIEWER_PW])).token;
  viewer2Token = (await post('login', [VIEWER2, VIEWER_PW])).token;
});

after(function () {
  server.close();
  try {
    db.prepare('DELETE FROM users WHERE email IN (?, ?, ?)').run(EDITOR, VIEWER1, VIEWER2);
  } catch (err) {}
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

/* ------------------------------------------------------------------
 * getData authentication + viewer scoping
 * ------------------------------------------------------------------ */

test('getData: anonymous dispatch call is rejected', async function () {
  const body = await postRaw('getData', []);
  assert.ok(body.error, 'anonymous getData must fail');
  assert.match(body.error, /getData requires|login required/i);
});

test('getData: authenticated request returns the dataset', async function () {
  const data = await post('getData', [viewer1Token]);
  assert.ok(data.title);
  assert.ok(Array.isArray(data.items));
});

test('getData: viewers never see records editors have hidden', async function () {
  const created = await post('addItem', [
    { sector: 'SecTest', description: 'hidden-scope record', entryDate: '10.09.2026', action: 'Do nothing', responsibility: 'co_admin', reviewDate: '11.09.2026' },
    adminToken
  ]);
  const row = created.items[created.items.length - 1].row;
  await post('setRecordDisplay', [row, false, adminToken]);

  const adminData = await post('getData', [adminToken]);
  assert.ok(adminData.items.some(function (i) { return i.row === row; }), 'editor sees hidden record');

  const viewerData = await post('getData', [viewer1Token]);
  assert.ok(!viewerData.items.some(function (i) { return i.row === row; }), 'viewer does not see hidden record');
});

/* ------------------------------------------------------------------
 * deleteSubmission respects admin locks (editor delete preserved)
 * ------------------------------------------------------------------ */

test('deleteSubmission: editor may delete unlocked submissions', async function () {
  const added = await post('addSubmission', [4, 'card-1', 'unlocked delete', null, adminToken]);
  const id = added[0].id;
  const del = await post('deleteSubmission', [id, editorToken]);
  assert.ok(!del.some(function (s) { return s.id === id; }), 'editor deleted an unlocked submission');
});

test('deleteSubmission: editor cannot delete an admin-locked submission', async function () {
  const added = await post('addSubmission', [4, 'card-1', 'admin-locked delete', null, adminToken]);
  const id = added[0].id;
  await post('lockSubmission', [id, adminToken]);
  await assert.rejects(
    post('deleteSubmission', [id, editorToken]),
    /locked by an admin/i
  );
  const del = await post('deleteSubmission', [id, adminToken]);
  assert.ok(!del.some(function (s) { return s.id === id; }), 'admin can delete the admin-locked submission');
});

/* ------------------------------------------------------------------
 * updateTask: non-editor assignees are status-only
 * ------------------------------------------------------------------ */

test('updateTask: assignee may change status but not task details', async function () {
  const task = await post('createTask', [{ title: 'SecScope task', assignee: VIEWER1 }, adminToken]);
  const id = task.id;

  const status = await post('updateTask', [id, { status: 'IN_PROGRESS' }, viewer1Token]);
  assert.strictEqual(status.status, 'IN_PROGRESS', 'assignee may update status');
  await post('updateTask', [id, { status: 'OPEN' }, viewer1Token]);

  await assert.rejects(
    post('updateTask', [id, { title: 'rewritten' }, viewer1Token]),
    /only editors can edit task details/i
  );
  await assert.rejects(
    post('updateTask', [id, { description: 'rewritten' }, viewer1Token]),
    /only editors can edit task details/i
  );
  await assert.rejects(
    post('updateTask', [id, { priority: 'HIGH' }, viewer1Token]),
    /only editors can edit task details/i
  );

  await assert.rejects(
    post('updateTask', [id, { status: 'DONE' }, viewer2Token]),
    /permission denied/i
  );
  await post('deleteTask', [id, adminToken]);
});

/* ------------------------------------------------------------------
 * Automation CREATE_TASK idempotency
 * ------------------------------------------------------------------ */

test('automation CREATE_TASK does not duplicate on every scheduler tick', async function () {
  const saved = await post('saveAutomationRule', [{
    name: 'Sec dedupe task',
    trigger: 'TASK_OVERDUE',
    action: 'CREATE_TASK',
    config: { assignee: VIEWER1, taskTitle: 'Sec dedupe auto task' }
  }, editorToken]);
  const ruleId = saved.rule.id;
  const count = function () {
    return db.prepare("SELECT COUNT(*) c FROM tasks WHERE title = 'Sec dedupe auto task'").get().c;
  };

  automation.evaluate_('TASK_OVERDUE', { key: 'task:t1:overdue', email: VIEWER1, recordRow: 4, message: 'overdue' });
  assert.strictEqual(count(), 1, 'first tick creates the task');

  automation.evaluate_('TASK_OVERDUE', { key: 'task:t1:overdue', email: VIEWER1, recordRow: 4, message: 'overdue' });
  assert.strictEqual(count(), 1, 'second tick within the TTL is deduped');

  automation.evaluate_('TASK_OVERDUE', { key: 'task:t2:overdue', email: VIEWER1, recordRow: 5, message: 'overdue' });
  assert.strictEqual(count(), 2, 'a distinct overdue task still triggers creation');

  await post('deleteAutomationRule', [ruleId, editorToken]);
  db.prepare("DELETE FROM tasks WHERE title = 'Sec dedupe auto task'").run();
});

/* ------------------------------------------------------------------
 * roleCache invalidation — role changes apply immediately
 * ------------------------------------------------------------------ */

test('role changes take effect immediately (no restart)', async function () {
  // Built-in admin creates a task as editor — works today.
  const task = await post('createTask', [{ title: 'role-flip task', assignee: VIEWER1 }, editorToken]);
  const id = task.id;
  await post('deleteTask', [id, adminToken]);

  // Demote EDITOR -> VIEWER through the real admin path.
  await post('adminUpdateUser', [EDITOR, { role: 'VIEWER' }, adminToken]);

  await assert.rejects(
    post('createTask', [{ title: 'should fail', assignee: VIEWER1 }, editorToken]),
    /editor permission required/i
  );

  // Restore for any later assertions in this file.
  await post('adminUpdateUser', [EDITOR, { role: 'EDITOR' }, adminToken]);
});

/* ------------------------------------------------------------------
 * Document write ops require editor
 * ------------------------------------------------------------------ */

test('document writes are editor-gated for viewers', async function () {
  const record = await post('addItem', [
    { sector: 'SecTest', description: 'doc-gate record', entryDate: '10.09.2026', action: 'Do nothing', responsibility: 'co_admin', reviewDate: '11.09.2026' },
    adminToken
  ]);
  const row = record.items[record.items.length - 1].row;

  const b64 = Buffer.from('hello').toString('base64');
  await assert.rejects(
    post('uploadDocument', [row, '', 'viewer.txt', b64, 'text/plain', viewer1Token]),
    /editor permission required/i
  );

  const doc = await post('uploadDocument', [row, '', 'editor.txt', b64, 'text/plain', editorToken]);
  assert.ok(doc.id, 'editor can upload documents');

  await assert.rejects(
    post('deleteDocument', [doc.id, viewer1Token]),
    /editor permission required/i
  );
  await assert.rejects(
    post('setDocumentKeep', [doc.id, true, viewer1Token]),
    /editor permission required/i
  );
  await post('deleteDocument', [doc.id, adminToken]);
  await post('deleteItem', [row, adminToken]);
});

/* ------------------------------------------------------------------
 * Unsafe attachment MIME is forced to download (submission attachments)
 * ------------------------------------------------------------------ */

test('files route: html attachment MIME is forced to attachment download', async function () {
  const key = 'a'.repeat(32);
  const p = path.join(UPLOADS_DIR, key);
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(p, '<script>alert(1)</script>');
  db.prepare(
    "INSERT INTO submission_attachments (id, submission_id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run('sec_sa1', 'sec_sub1', 'evil.html', key, 'text/html', Buffer.byteLength('<script>alert(1)</script>'), 'x@x.com', Date.now());

  try {
    const resp = await fetch('http://127.0.0.1:' + port + '/api/files/' + key, { headers: { Cookie: adminCookie } });
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(resp.headers.get('content-type'), 'application/octet-stream');
    assert.match(resp.headers.get('content-disposition') || '', /attachment/i);
    assert.notStrictEqual(String(resp.headers.get('content-type') || ''), 'text/html');
  } finally {
    try { fs.unlinkSync(p); } catch (err) {}
    try { db.prepare('DELETE FROM submission_attachments WHERE id = ?').run('sec_sa1'); } catch (err) {}
  }
});

test('files route: safe inline MIME stays inline (png)', async function () {
  const key = 'b'.repeat(32);
  const p = path.join(UPLOADS_DIR, key);
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(p, 'pngdata');
  db.prepare(
    "INSERT INTO submission_attachments (id, submission_id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run('sec_sa2', 'sec_sub2', 'img.png', key, 'image/png', 7, 'x@x.com', Date.now());

  try {
    const resp = await fetch('http://127.0.0.1:' + port + '/api/files/' + key, { headers: { Cookie: adminCookie } });
    assert.strictEqual(resp.status, 200);
    assert.strictEqual(resp.headers.get('content-type'), 'image/png');
    assert.match(resp.headers.get('content-disposition') || '', /inline/i);
  } finally {
    try { fs.unlinkSync(p); } catch (err) {}
    try { db.prepare('DELETE FROM submission_attachments WHERE id = ?').run('sec_sa2'); } catch (err) {}
  }
});

/* ------------------------------------------------------------------
 * Static sensitive-path denial
 * ------------------------------------------------------------------ */

test('static server denies sensitive paths even when STATIC_ROOT is the repo root', async function () {
  const denied = [
    '/data/dashboard.db',
    '/data/uploads/anything',
    '/src/server/index.js',
    '/build/app.js',
    '/scripts/secret-scan.cjs',
    '/node_modules/express/package.json',
    '/.git/config'
  ];
  for (const urlPath of denied) {
    const resp = await fetch('http://127.0.0.1:' + port + urlPath);
    assert.strictEqual(resp.status, 403, urlPath + ' must be rejected');
  }
  const ok = await fetch('http://127.0.0.1:' + port + '/app.html');
  assert.ok(ok.status === 200 || ok.status === 302, 'normal static asset still served');
});
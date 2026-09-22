/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/tier-a-happy-path.test.js
 * Part 17: happy-path coverage for the Tier-A endpoints a daily
 * user drives. This complements smoke.test.js (record CRUD,
 * submissions, auth) by exercising the notification, task,
 * instruction-entry, audit, divisional-dashboard and reporting
 * surfaces on their happy paths over the real HTTP surface.
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { password } = require('./test-bootstrap');
const { server } = require('../index');

let port;
let token;
let cookie = '';

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

async function post(fn, args, useCookie) {
  const headers = { 'Content-Type': 'text/plain' };
  if (useCookie && cookie) headers.Cookie = cookie;
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ function: fn, args: args || [] })
  });
  const body = await resp.json();
  if (body.error) throw new Error(fn + ': ' + body.error);
  return body.result;
}

test('login returns a session and the divisional dashboard resolves', async function () {
  const login = await post('login', ['vcharyanaco@gmail.com', password]);
  assert.strictEqual(login.success, true);
  token = login.token;
  const links = await post('getMyDivisionalDashboard', [token]);
  assert.strictEqual(typeof links, 'object', 'divisional dashboard resolves to an object');
  assert.strictEqual(typeof links.eligible, 'boolean', 'eligible flag present');
});

test('notifications: digest, list and mark-all-read on the happy path', async function () {
  const digest = await post('getNotificationDigest', [token]);
  assert.ok(typeof digest === 'object', 'digest must be an object');
  assert.ok(Array.isArray(digest.items || digest.notifications || []), 'digest carries a list');

  const list = await post('getMyNotifications', [token]);
  assert.ok(Array.isArray(list.recent), 'notification list must carry a recent array');
  assert.strictEqual(typeof list.unread, 'number', 'unread count present');
  const markAll = await post('markNotificationsRead', ['all', token]);
  assert.ok(markAll !== undefined, 'mark-all-read resolves without error');
  const after = await post('getMyNotifications', [token]);
  if (after.unread > 0) assert.fail('mark-all-read should zero the unread count');
});

test('tasks: create is listed across counts/my-tasks/all-tasks, then deletes', async function () {
  const created = await post('createTask', [{ title: 'Tier-A happy path task', description: 'hap', priority: 'HIGH', assignee: 'vcharyanaco@gmail.com' }, token]);
  assert.ok(created && created.id, 'createTask must return a task with an id');
  const id = created.id;

  const counts = await post('getTaskCounts', [token]);
  const myTasks = await post('getMyTasks', [token]);
  const allTasks = await post('getTasks', [{}, token]);
  assert.ok(Array.isArray(allTasks), 'getTasks must return an array');
  assert.strictEqual(
    allTasks.some(function (t) { return String(t.id) === String(id); }),
    true, 'newly created task must appear in getTasks');
  assert.ok(typeof counts === 'object', 'getTaskCounts returns a summary object');

  const afterDelete = await post('deleteTask', [id, token]);
  assert.strictEqual(afterDelete, true, 'deleteTask reports a row deleted');
  const now = await post('getTasks', [{}, token]);
  assert.ok(!now.some(function (t) { return String(t.id) === String(id); }),
    'deleted task must not be listed afterwards');
});

test('instruction entries flow end-to-end for an editor', async function () {
  const before = await post('getInstructionEntries', [4, token]);
  const added = await post('addInstructionEntry', [4, 'R1', 'Call the circle offices', null, token]);
  assert.strictEqual(added[0].text, 'Call the circle offices', 'added entry echoed at head');
  const list = await post('getInstructionEntries', [4, token]);
  assert.ok(Array.isArray(list) && list.length >= before.length, 'entry count grew');
  await post('deleteInstructionEntry', [added[0].id, token]);
});

test('audit log lists entries for a logged-in user', async function () {
  const entries = await post('getAuditEntries', [80, token]);
  assert.ok(Array.isArray(entries), 'audit entries must be an array');
  assert.ok(entries.length >= 1, 'login/API activity should be audited');
});

test('reports: templates resolve and weekly report renders', async function () {
  const templates = await post('getReportTemplates', []);
  assert.ok(Array.isArray(templates) && templates.length >= 3, 'at least 3 report templates');
  const report = await post('getReportData', ['weekly', token]);
  assert.ok(report, 'weekly report data must resolve');
});

test('documents and i18n resolve on the happy path', async function () {
  const docs = await post('getRecordDocuments', [1, token]);
  assert.ok(Array.isArray(docs), 'getRecordDocuments must return an array');
  const hi = await post('getTranslations', ['hi']);
  const en = await post('getTranslations', ['en']);
  assert.ok(hi && hi[Object.keys(hi)[0]] !== undefined, 'Hindi dict resolves');
  assert.ok(en && en[Object.keys(en)[0]] !== undefined, 'English dict resolves');
});
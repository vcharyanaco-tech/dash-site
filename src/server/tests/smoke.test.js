/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/smoke.test.js
 * End-to-end smoke test over the Express HTTP surface.
 * Run: npm test  (node --test tests/)
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { server } = require('../index');

let port;
let token;

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

test('health endpoint', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api/health');
  assert.strictEqual(resp.status, 200);
  const body = await resp.json();
  assert.strictEqual(body.ok, true);
});

test('unknown function returns error', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: 'noSuchFn', args: [] })
  });
  const body = await resp.json();
  assert.ok(body.error);
  assert.match(body.error, /Unknown function/);
});

test('admin login + validateSession', async function () {
  const res = await post('login', ['vcharyanaco@gmail.com', 'Admin@123']);
  assert.strictEqual(res.success, true);
  assert.ok(res.token);
  token = res.token;
  assert.strictEqual(res.user.role, 'ADMIN');

  const vs = await post('validateSession', [token]);
  assert.strictEqual(vs.success, true);
  assert.strictEqual(vs.user.email, 'vcharyanaco@gmail.com');
});

test('getServerTime / getData / getAppData', async function () {
  const t = await post('getServerTime', []);
  assert.ok(typeof t === 'number');
  const data = await post('getData', []);
  assert.ok(data.title);
  assert.ok(Array.isArray(data.items));
  assert.ok(data.items.length >= 3);

  const appData = await post('getAppData', [token]);
  assert.strictEqual(appData.user.email, 'vcharyanaco@gmail.com');
  assert.ok(appData.summary.total >= 3);
  assert.ok(Array.isArray(appData.responsibilities));
});

test('record CRUD + review flags', async function () {
  const created = await post('addItem', [{ sector: 'Test', description: 'Smoke test record', entryDate: '09.08.2026', action: 'Do nothing', responsibility: 'co_admin', reviewDate: '10.08.2026' }, token]);
  const items = created.items;
  const item = items[items.length - 1];
  assert.strictEqual(item.sector, 'Test');
  assert.strictEqual(item.flagged, true);

  const updated = await post('updateItem', [{ row: item.row, id: item.id, sector: 'Test', description: 'Updated', entryDate: '09.08.2026', action: 'Do nothing', responsibility: 'co_admin', reviewDate: '10.08.2026' }, token]);
  assert.strictEqual(updated.items[updated.items.length - 1].description, 'Updated');

  const done = await post('markReviewDone', [item.row, token]);
  const doneItem = done.items.find(function (i) { return i.row === item.row; });
  assert.strictEqual(doneItem.reviewStatus, 'done');

  await post('markReviewNotDone', [item.row, token]);

  const deleted = await post('deleteItem', [item.row, token]);
  assert.ok(!deleted.items.find(function (i) { return i.row === item.row; }));
});

test('submissions flow', async function () {
  await post('getSubmissions', [token, 0]);
  const added = await post('addSubmission', [4, 'card-1', 'Smoke submission text', token]);
  assert.strictEqual(added[0].text, 'Smoke submission text');
  const id = added[0].id;
  const toggled = await post('toggleSubmissionDisplay', [id, token]);
  assert.strictEqual(toggled[0].displayed, true);
  await post('lockSubmission', [id, token]);
  await post('unlockSubmission', [id, token]);
  const del = await post('deleteSubmission', [id, token]);
  assert.ok(!del.some(function (s) { return s.id === id; }));
});

test('submission badge flashes until an admin reads the updates', async function () {
  // Admin adds an update -> the card's badge flashes.
  const added = await post('addSubmission', [4, 'card-1', 'Flash test update', token]);
  assert.ok(added[0].id);
  const id = added[0].id;

  let appData = await post('getAppData', [token]);
  assert.strictEqual(appData.submissionFlash[4], true);
  assert.ok(appData.submissionCounts[4] >= 1);

  // A viewer reading the card does NOT clear the flash (only an admin's
  // read counts), so the badge keeps flashing for the admin.
  const viewerEmail = 'flashviewer@example.com';
  await post('adminAddUser', [viewerEmail, 'flashviewer', 'VIEWER', 'Viewer@123', '', '', '', token]);
  const vlogin = await post('login', [viewerEmail, 'Viewer@123']);
  assert.strictEqual(vlogin.success, true);
  await post('getSubmissions', [vlogin.token, 4]);
  appData = await post('getAppData', [token]);
  assert.strictEqual(appData.submissionFlash[4], true);

  // The admin reading the card's updates stops the flash; the count stays.
  await post('getSubmissions', [token, 4]);
  appData = await post('getAppData', [token]);
  assert.ok(!appData.submissionFlash[4]);
  assert.ok(appData.submissionCounts[4] >= 1);

  // Cleanup.
  await post('deleteSubmission', [id, token]);
  await post('adminDeleteUser', [viewerEmail, token]);
});

test('mark all submissions as read clears every flashing badge at once', async function () {
  // Admin adds updates on two different cards so both badges flash.
  const a = await post('addSubmission', [4, 'card-1', 'Mark-all flash A', token]);
  const b = await post('addSubmission', [5, 'card-2', 'Mark-all flash B', token]);
  const idA = a[0].id;
  const idB = b[0].id;

  let appData = await post('getAppData', [token]);
  assert.strictEqual(appData.submissionFlash[4], true);
  assert.strictEqual(appData.submissionFlash[5], true);

  // A viewer cannot mark everything read.
  const viewerEmail = 'markallviewer@example.com';
  await post('adminAddUser', [viewerEmail, 'markallviewer', 'VIEWER', 'Viewer@123', '', '', '', token]);
  const vlogin = await post('login', [viewerEmail, 'Viewer@123']);
  assert.strictEqual(vlogin.success, true);
  await assert.rejects(post('markAllSubmissionsRead', [vlogin.token]));

  // The admin clears both flashing badges in one call; counts stay.
  const overview = await post('markAllSubmissionsRead', [token]);
  assert.ok(!overview.flash[4]);
  assert.ok(!overview.flash[5]);
  assert.ok(overview.counts[4] >= 1);
  assert.ok(overview.counts[5] >= 1);

  appData = await post('getAppData', [token]);
  assert.ok(!appData.submissionFlash[4]);
  assert.ok(!appData.submissionFlash[5]);
  assert.ok(appData.submissionCounts[4] >= 1);
  assert.ok(appData.submissionCounts[5] >= 1);

  // Cleanup.
  await post('deleteSubmission', [idA, token]);
  await post('deleteSubmission', [idB, token]);
  await post('adminDeleteUser', [viewerEmail, token]);
});

test('tasks flow', async function () {
  const created = await post('createTask', [{ title: 'Smoke task', description: 'desc', priority: 'HIGH', assignee: 'vcharyanaco@gmail.com' }, token]);
  assert.strictEqual(created.title, 'Smoke task');
  const list = await post('getTasks', [{}, token]);
  assert.ok(list.some(function (t) { return t.id === created.id; }));
  const mine = await post('getMyTasks', [token]);
  assert.ok(mine.some(function (t) { return t.id === created.id; }));
  const updated = await post('updateTask', [created.id, { status: 'DONE' }, token]);
  assert.strictEqual(updated.status, 'DONE');
  const counts = await post('getTaskCounts', [token]);
  assert.strictEqual(typeof counts.openTasks, 'number');
  assert.strictEqual(typeof counts.dueToday, 'number');
  await post('deleteTask', [created.id, token]);
});

test('dashboard preferences', async function () {
  await post('saveDashboardPreferences', [{ viewMode: 'table', columns: { id: true, sector: false } }, token]);
  const prefs = await post('getDashboardPreferences', [token]);
  assert.strictEqual(prefs.viewMode, 'table');
  assert.strictEqual(prefs.columns.sector, false);
});

test('reports: templates, data, xlsx, pdf', async function () {
  const templates = await post('getReportTemplates', []);
  assert.ok(templates.length >= 3);
  const data = await post('getReportData', ['flagged', token]);
  assert.strictEqual(data.template, 'flagged');
  assert.ok(data.summary);

  const xlsx = await post('exportToSpreadsheet', [token]);
  assert.ok(xlsx.filename.endsWith('.xlsx'));
  const buf = Buffer.from(xlsx.base64, 'base64');
  assert.ok(buf.subarray(0, 2).toString() === 'PK');

  const pdf = await post('createPdfReport', [token]);
  assert.ok(pdf.filename.endsWith('.pdf'));
  const pdfBuf = Buffer.from(pdf.base64, 'base64');
  assert.ok(pdfBuf.subarray(0, 4).toString() === '%PDF');
});

test('documents: upload, list, GET /files, delete', async function () {
  const uploaded = await post('uploadDocument', [4, '', 'hello.txt', Buffer.from('Hello world').toString('base64'), 'text/plain', token]);
  assert.ok(uploaded.driveFileId);
  const list = await post('getRecordDocuments', [4, token]);
  assert.ok(list.some(function (d) { return d.id === uploaded.id; }));

  const resp = await fetch('http://127.0.0.1:' + port + '/api/files/' + uploaded.driveFileId);
  assert.strictEqual(resp.status, 200);
  const text = await resp.text();
  assert.strictEqual(text, 'Hello world');

  await post('deleteDocument', [uploaded.id, token]);
  const after = await post('getRecordDocuments', [4, token]);
  assert.ok(!after.some(function (d) { return d.id === uploaded.id; }));
});

test('audit + calendar + ai graceful', async function () {
  const entries = await post('getAuditEntries', [80]);
  assert.ok(Array.isArray(entries));

  const ics = await post('exportReviewCalendarIcs', [token]);
  assert.ok(ics.ics.indexOf('BEGIN:VCALENDAR') !== -1);

  const ai = await post('getAiInsights', [token]);
  assert.ok(typeof ai.success === 'boolean');
  if (ai.success) {
    assert.ok(ai.insights);
  } else {
    assert.ok(ai.message);
  }
});

test('logout invalidates session', async function () {
  await post('logout', [token]);
  const vs = await post('validateSession', [token]);
  assert.strictEqual(vs.success, false);
});

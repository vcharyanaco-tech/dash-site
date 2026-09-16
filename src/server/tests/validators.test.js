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
  // ── 1F: admin-mutating validators ────────────────────────────────────────
  { fn: 'adminImportUsers', goodArgs: ['Email,Role\nx@y.com,VIEWER', adminToken], badArgs: [], msg: /adminImportUsers requires/ },
  { fn: 'adminImportUsers', goodArgs: ['Email,Role\nx@y.com,VIEWER', adminToken], badArgs: ['', adminToken], msg: /csv content is required/ },
  { fn: 'adminResetPassword', goodArgs: ['x@y.com', 'NewPass1!', adminToken], badArgs: [], msg: /adminResetPassword requires/ },
  { fn: 'adminResetPassword', goodArgs: ['x@y.com', 'NewPass1!', adminToken], badArgs: ['', 'NewPass1!', adminToken], msg: /email is required/ },
  { fn: 'adminResetPassword', goodArgs: ['x@y.com', 'NewPass1!', adminToken], badArgs: ['x@y.com', '', adminToken], msg: /newPassword is required/ },
  { fn: 'adminEmailAllUsers', goodArgs: ['Subject', 'Body', adminToken], badArgs: [], msg: /adminEmailAllUsers requires/ },
  { fn: 'adminEmailAllUsers', goodArgs: ['Subject', 'Body', adminToken], badArgs: ['', 'Body', adminToken], msg: /subject is required/ },
  { fn: 'adminEmailAllUsers', goodArgs: ['Subject', 'Body', adminToken], badArgs: ['Subject', '', adminToken], msg: /body is required/ },
  { fn: 'adminImportCsv', goodArgs: ['Email,Name\nx@y.com,Test', adminToken], badArgs: [], msg: /adminImportCsv requires/ },
  { fn: 'adminImportCsv', goodArgs: ['Email,Name\nx@y.com,Test', adminToken], badArgs: ['', adminToken], msg: /csvText is required/ },
  { fn: 'adminDeleteAuditRows', goodArgs: [[1, 2], adminToken], badArgs: [], msg: /adminDeleteAuditRows requires/ },
  { fn: 'adminDeleteAuditRows', goodArgs: [[1, 2], adminToken], badArgs: ['not-array', adminToken], msg: /rowNumbers must be an array/ },
  { fn: 'adminClearAudit', goodArgs: [adminToken], badArgs: [], msg: /adminClearAudit requires/ },
  // ── 1F: file / data deletion validators ──────────────────────────────────
  { fn: 'deleteDocument', goodArgs: ['doc123', adminToken], badArgs: [], msg: /deleteDocument requires/ },
  { fn: 'deleteDocument', goodArgs: ['doc123', adminToken], badArgs: [null, adminToken], msg: /docId is required/ },
  { fn: 'deleteMeetingFile', goodArgs: [adminToken, 'file.pdf'], badArgs: [], msg: /deleteMeetingFile requires/ },
  { fn: 'deleteMeetingFile', goodArgs: [adminToken, 'file.pdf'], badArgs: [adminToken, ''], msg: /name is required/ },
  { fn: 'deleteSubmission', goodArgs: ['sub123', adminToken], badArgs: [], msg: /deleteSubmission requires/ },
  { fn: 'deleteSubmission', goodArgs: ['sub123', adminToken], badArgs: [null, adminToken], msg: /submissionId is required/ },
  { fn: 'deleteTask', goodArgs: ['task123', adminToken], badArgs: [], msg: /deleteTask requires/ },
  { fn: 'deleteTask', goodArgs: ['task123', adminToken], badArgs: [null, adminToken], msg: /id is required/ },
  // ── 1F: other high-risk mutating validators ──────────────────────────────
  { fn: 'updateTask', goodArgs: ['task123', { status: 'DONE' }, adminToken], badArgs: [], msg: /updateTask requires/ },
  { fn: 'updateTask', goodArgs: ['task123', { status: 'DONE' }, adminToken], badArgs: [null, { status: 'DONE' }, adminToken], msg: /id is required/ },
  { fn: 'updateTask', goodArgs: ['task123', { status: 'DONE' }, adminToken], badArgs: ['task123', null, adminToken], msg: /fields must be an object/ },
  { fn: 'updateSubmission', goodArgs: ['sub123', 'New text', adminToken], badArgs: [], msg: /updateSubmission requires/ },
  { fn: 'updateSubmission', goodArgs: ['sub123', 'New text', adminToken], badArgs: [null, 'New text', adminToken], msg: /submissionId is required/ },
  { fn: 'updateSubmission', goodArgs: ['sub123', 'New text', adminToken], badArgs: ['sub123', '', adminToken], msg: /text is required/ },
  { fn: 'lockSubmission', goodArgs: ['sub123', adminToken], badArgs: [], msg: /lockSubmission requires/ },
  { fn: 'lockSubmission', goodArgs: ['sub123', adminToken], badArgs: [null, adminToken], msg: /submissionId is required/ },
  { fn: 'unlockSubmission', goodArgs: ['sub123', adminToken], badArgs: [], msg: /unlockSubmission requires/ },
  { fn: 'unlockSubmission', goodArgs: ['sub123', adminToken], badArgs: [null, adminToken], msg: /submissionId is required/ },
  { fn: 'toggleSubmissionDisplay', goodArgs: ['sub123', adminToken], badArgs: [], msg: /toggleSubmissionDisplay requires/ },
  { fn: 'toggleSubmissionDisplay', goodArgs: ['sub123', adminToken], badArgs: [null, adminToken], msg: /submissionId is required/ },
  { fn: 'markAllSubmissionsRead', goodArgs: [adminToken], badArgs: [], msg: /markAllSubmissionsRead requires/ },
  { fn: 'setRecordDisplay', goodArgs: [1, true, adminToken], badArgs: [], msg: /setRecordDisplay requires/ },
  { fn: 'setRecordDisplay', goodArgs: [1, true, adminToken], badArgs: [1, 'yes', adminToken], msg: /displayed must be a boolean/ },
  { fn: 'setDocumentKeep', goodArgs: ['doc123', true, adminToken], badArgs: [], msg: /setDocumentKeep requires/ },
  { fn: 'setDocumentKeep', goodArgs: ['doc123', true, adminToken], badArgs: ['doc123', 'yes', adminToken], msg: /keep must be a boolean/ },
  { fn: 'saveDashboardPreferences', goodArgs: [{ layout: 'grid' }, adminToken], badArgs: [], msg: /saveDashboardPreferences requires/ },
  { fn: 'saveDashboardPreferences', goodArgs: [{ layout: 'grid' }, adminToken], badArgs: [null, adminToken], msg: /prefs must be an object/ },
  { fn: 'markNotificationsRead', goodArgs: [['id1'], adminToken], badArgs: [], msg: /markNotificationsRead requires/ },
  { fn: 'markNotificationsRead', goodArgs: [['id1'], adminToken], badArgs: ['not-array', adminToken], msg: /ids must be an array/ },
  { fn: 'subscribePush', goodArgs: [{ endpoint: 'https://example.com', keys: {} }, adminToken], badArgs: [], msg: /subscribePush requires/ },
  { fn: 'subscribePush', goodArgs: [{ endpoint: 'https://example.com', keys: {} }, adminToken], badArgs: [null, adminToken], msg: /subscription must be an object/ },
  { fn: 'unsubscribePush', goodArgs: ['https://example.com/ep', adminToken], badArgs: [], msg: /unsubscribePush requires/ },
  { fn: 'unsubscribePush', goodArgs: ['https://example.com/ep', adminToken], badArgs: ['', adminToken], msg: /endpoint is required/ },
  { fn: 'setFathomApiKey', goodArgs: [adminToken, 'sk-test'], badArgs: [], msg: /setFathomApiKey requires/ },
  { fn: 'setFathomApiKey', goodArgs: [adminToken, 'sk-test'], badArgs: [adminToken, ''], msg: /apiKey is required/ },
  { fn: 'exportReviewCalendarIcs', goodArgs: [adminToken], badArgs: [], msg: /exportReviewCalendarIcs requires/ },
  { fn: 'createPdfReport', goodArgs: [adminToken], badArgs: [], msg: /createPdfReport requires/ },
  { fn: 'exportToSpreadsheet', goodArgs: [adminToken], badArgs: [], msg: /exportToSpreadsheet requires/ },
  { fn: 'sendWeeklyReport', goodArgs: [adminToken], badArgs: [], msg: /sendWeeklyReport requires/ },
  { fn: 'sendReviewDeadlinePushNotifications', goodArgs: [adminToken], badArgs: [], msg: /sendReviewDeadlinePushNotifications requires/ },
  // ── 1F: read / informational validators (public, no token) ────────────────
  { fn: 'getServerTime', goodArgs: [], badArgs: ['x'], msg: /getServerTime takes no arguments/ },
  { fn: 'getData', goodArgs: [], badArgs: ['x'], msg: /getData takes no arguments/ },
  { fn: 'getSyncStatus', goodArgs: [], badArgs: ['x'], msg: /getSyncStatus takes no arguments/ },
  { fn: 'getReportTemplates', goodArgs: [], badArgs: ['x'], msg: /getReportTemplates takes no arguments/ },
  { fn: 'getTranslations', goodArgs: ['en'], badArgs: ['en', 'fr'], msg: /getTranslations requires/ },
  { fn: 'getTranslations', goodArgs: ['en'], badArgs: [123], msg: /lang must be a string/ },
  { fn: 'requestPasswordReset', goodArgs: ['test@example.com'], badArgs: [], msg: /requestPasswordReset requires \(identifier\)/ },
  // ── 1F: read / informational validators (token-only, token@0) ─────────────
  { fn: 'getAppData', goodArgs: [adminToken], badArgs: [], msg: /getAppData requires/ },
  { fn: 'generateReviewNotifications', goodArgs: [adminToken], badArgs: [], msg: /generateReviewNotifications requires/ },
  { fn: 'logout', goodArgs: [adminToken], badArgs: [], msg: /logout requires/ },
  { fn: 'validateSession', goodArgs: [adminToken], badArgs: [], msg: /validateSession requires/ },
  { fn: 'refreshSession', goodArgs: [adminToken], badArgs: [], msg: /refreshSession requires/ },
  { fn: 'adminGetUsers', goodArgs: [adminToken], badArgs: [], msg: /adminGetUsers requires/ },
  { fn: 'adminExportUsers', goodArgs: [adminToken], badArgs: [], msg: /adminExportUsers requires/ },
  { fn: 'adminGetUserActivity', goodArgs: [adminToken], badArgs: [], msg: /adminGetUserActivity requires/ },
  { fn: 'getAssignableUsers', goodArgs: [adminToken], badArgs: [], msg: /getAssignableUsers requires/ },
  { fn: 'getMyNotifications', goodArgs: [adminToken], badArgs: [], msg: /getMyNotifications requires/ },
  { fn: 'clearMyNotifications', goodArgs: [adminToken], badArgs: [], msg: /clearMyNotifications requires/ },
  { fn: 'getTaskCounts', goodArgs: [adminToken], badArgs: [], msg: /getTaskCounts requires/ },
  { fn: 'getMyTasks', goodArgs: [adminToken], badArgs: [], msg: /getMyTasks requires/ },
  { fn: 'getDashboardPreferences', goodArgs: [adminToken], badArgs: [], msg: /getDashboardPreferences requires/ },
  { fn: 'sendWhatsAppReviewReminders', goodArgs: [adminToken], badArgs: [], msg: /sendWhatsAppReviewReminders requires/ },
  { fn: 'getAiInsights', goodArgs: [adminToken], badArgs: [], msg: /getAiInsights requires/ },
  { fn: 'getAllAskLinkHistory', goodArgs: [adminToken], badArgs: [], msg: /getAllAskLinkHistory requires/ },
  { fn: 'listMeetingFiles', goodArgs: [adminToken], badArgs: [], msg: /listMeetingFiles requires/ },
  { fn: 'getFathomStatus', goodArgs: [adminToken], badArgs: [], msg: /getFathomStatus requires/ },
  { fn: 'listFathomUsers', goodArgs: [adminToken], badArgs: [], msg: /listFathomUsers requires/ },
  { fn: 'getFathomMeetingStats', goodArgs: [adminToken], badArgs: [], msg: /getFathomMeetingStats requires/ },
  { fn: 'getEnterpriseFrontendConfig', goodArgs: [adminToken], badArgs: [], msg: /getEnterpriseFrontendConfig requires/ },
  { fn: 'setupEnterpriseAddons', goodArgs: [adminToken], badArgs: [], msg: /setupEnterpriseAddons requires/ },
  { fn: 'installEnterpriseTriggers', goodArgs: [adminToken], badArgs: [], msg: /installEnterpriseTriggers requires/ },
  { fn: 'validateEnterpriseConfiguration', goodArgs: [adminToken], badArgs: [], msg: /validateEnterpriseConfiguration requires/ },
  { fn: 'getEnterpriseHealth', goodArgs: [adminToken], badArgs: [], msg: /getEnterpriseHealth requires/ },
  { fn: 'adminSyncFromSheet', goodArgs: [adminToken], badArgs: [], msg: /adminSyncFromSheet requires/ },
  { fn: 'adminPreviewSyncFromSheet', goodArgs: [adminToken], badArgs: [], msg: /adminPreviewSyncFromSheet requires/ },
  { fn: 'adminPushToSheet', goodArgs: [adminToken], badArgs: [], msg: /adminPushToSheet requires/ },
  // ── 1F: read / informational validators (token-first with data) ───────────
  { fn: 'getSubmissions', goodArgs: [adminToken, 0], badArgs: [], msg: /getSubmissions requires/ },
  { fn: 'getCardAiInsight', goodArgs: [adminToken, 1], badArgs: [], msg: /getCardAiInsight requires/ },
  { fn: 'getCardAiInsight', goodArgs: [adminToken, 1], badArgs: [adminToken, null], msg: /row is required/ },
  { fn: 'getLinkContentAiInsight', goodArgs: [adminToken, 1], badArgs: [], msg: /getLinkContentAiInsight requires/ },
  { fn: 'getLinkContentAiInsight', goodArgs: [adminToken, 1], badArgs: [adminToken, null], msg: /row is required/ },
  { fn: 'askLinkAi', goodArgs: [adminToken, 1, 'q'], badArgs: [], msg: /askLinkAi requires/ },
  { fn: 'askLinkAi', goodArgs: [adminToken, 1, 'q'], badArgs: [adminToken, 1, ''], msg: /question is required/ },
  { fn: 'saveAskLinkHistory', goodArgs: [adminToken, 1, []], badArgs: [], msg: /saveAskLinkHistory requires/ },
  { fn: 'saveAskLinkHistory', goodArgs: [adminToken, 1, []], badArgs: [adminToken, 1, 'bad'], msg: /history must be an array/ },
  { fn: 'getMeetingFile', goodArgs: [adminToken, 'file.pdf'], badArgs: [], msg: /getMeetingFile requires/ },
  { fn: 'getMeetingFile', goodArgs: [adminToken, 'file.pdf'], badArgs: [adminToken, ''], msg: /name is required/ },
  { fn: 'listFathomMeetings', goodArgs: [adminToken], badArgs: [], msg: /listFathomMeetings requires/ },
  { fn: 'searchFathomMeetings', goodArgs: [adminToken], badArgs: [], msg: /searchFathomMeetings requires/ },
  { fn: 'getFathomMeetingContent', goodArgs: [adminToken, 'rec123'], badArgs: [], msg: /getFathomMeetingContent requires/ },
  { fn: 'getFathomMeetingContent', goodArgs: [adminToken, 'rec123'], badArgs: [adminToken, ''], msg: /recordingId is required/ },
  { fn: 'getRecordingDownloadLink', goodArgs: [adminToken, 'rec123'], badArgs: [], msg: /getRecordingDownloadLink requires/ },
  { fn: 'getRecordingDownloadLink', goodArgs: [adminToken, 'rec123'], badArgs: [adminToken, ''], msg: /recordingId is required/ },
  { fn: 'bulkGetRecordingDownloadLinks', goodArgs: [adminToken, ['rec123']], badArgs: [], msg: /bulkGetRecordingDownloadLinks requires/ },
  { fn: 'bulkGetRecordingDownloadLinks', goodArgs: [adminToken, ['rec123']], badArgs: [adminToken, 'rec123'], msg: /recordingIds must be an array/ },
  { fn: 'getRecordHistory', goodArgs: [1, adminToken], badArgs: [], msg: /getRecordHistory requires/ },
  { fn: 'getRecordHistory', goodArgs: [1, adminToken], badArgs: [null, adminToken], msg: /row is required/ },
  { fn: 'getRecordDocuments', goodArgs: [1, adminToken], badArgs: [], msg: /getRecordDocuments requires/ },
  { fn: 'getAuditEntries', goodArgs: [10, adminToken], badArgs: [], msg: /getAuditEntries requires/ },
  { fn: 'getTasks', goodArgs: [{}, adminToken], badArgs: [], msg: /getTasks requires/ },
  { fn: 'getTasks', goodArgs: [{}, adminToken], badArgs: ['bad', adminToken], msg: /filters must be an object/ },
  { fn: 'processMeetingRecording', goodArgs: [{ recordingId: 'r' }, adminToken], badArgs: [], msg: /processMeetingRecording requires/ },
  { fn: 'processMeetingRecording', goodArgs: [{ recordingId: 'r' }, adminToken], badArgs: ['bad', adminToken], msg: /payload must be an object/ },
  { fn: 'transcribeMeetingSegment', goodArgs: [{ recordingId: 'r' }, adminToken], badArgs: [], msg: /transcribeMeetingSegment requires/ },
  { fn: 'transcribeMeetingSegment', goodArgs: [{ recordingId: 'r' }, adminToken], badArgs: ['bad', adminToken], msg: /payload must be an object/ },
  { fn: 'generateMeetingMinutes', goodArgs: [{ recordingId: 'r' }, adminToken], badArgs: [], msg: /generateMeetingMinutes requires/ },
  { fn: 'generateMeetingMinutes', goodArgs: [{ recordingId: 'r' }, adminToken], badArgs: ['bad', adminToken], msg: /payload must be an object/ },
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

// ------------------------------------------------------------------
// Bearer/cron regression: a real session token passed as an ARG (no
// cookie) must still authenticate — documents the service-to-service
// / cron path preserved after the generalized cookie-injection
// middleware (see index.js cookie splice).
// ------------------------------------------------------------------

test('bearer/cron: token-as-arg authenticates adminGetUsers (no cookie)', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: 'adminGetUsers', args: [adminToken] })
  });
  const body = await resp.json();
  assert.ok(!body.error, 'expected success, got error: ' + (body.error || ''));
  assert.ok(Array.isArray(body.result), 'adminGetUsers result should be an array');
});

test('bearer/cron: token-as-arg authenticates createTask (no cookie)', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: 'createTask', args: [{ title: 'Bearer cron task' }, adminToken] })
  });
  const body = await resp.json();
  assert.ok(!body.error, 'expected success, got error: ' + (body.error || ''));
  const result = body.result;
  assert.ok(result && result.id, 'createTask should return a task with id');
  if (result && result.id) {
    await post('deleteTask', [result.id, adminToken]);
  }
});

test('bearer/cron: garbage token-as-arg rejected (no cookie)', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: 'adminGetUsers', args: ['deadbeef' + '0'.repeat(58)] })
  });
  const body = await resp.json();
  assert.ok(body.error, 'expected error for garbage bearer token');
});

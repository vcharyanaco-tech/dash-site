/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/dispatch-args.test.js
 * Arg-order lock: replays every client ApiService call (shaped
 * exactly as app.js sends it, token position included) through
 * index-dispatch and fails if the auth token lands in the wrong
 * slot.
 *
 * Guards the class of bug fixed for the meeting-file calls: the
 * client sent listMeetingFiles/getMeetingFile/deleteMeetingFile as
 * ({}, token) / ({name}, token) while the server read the token as
 * args[0], so requireAdmin saw {} and threw "Login required" — the
 * client treated that as session expiry and logged the user out on
 * every Meeting Notes open.
 *
 * Keep CLIENT_CALLS in sync with the ApiService block in app.js.
 * ============================================================
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-args-'));
process.env.DASH_DATA_DIR = TMP;
process.env.DASH_IMPORT_SKIP = '1';

const { db } = require('../db');
const dispatch = require('../index-dispatch');

const TOKEN = 'tok';

function setup() {
  db.prepare("INSERT OR IGNORE INTO users (email, role, salt, password_hash, must_change, created_by, created_at, username) VALUES ('a@x.com', 'ADMIN', 'salt', 'x', 0, '', 0, 'admin')").run();
  db.prepare("INSERT OR IGNORE INTO sessions (token, email, created_at, expires_at) VALUES ('tok', 'a@x.com', 0, " + (Date.now() + 3600000) + ")").run();
}

// Auth errors are exactly what a misplaced token produces. Any other
// (domain) error is tolerated — the point is the auth check must pass.
const AUTH_ERROR_RE = /login required|session expired|please log in|permission required/i;

// [fn, args] pairs copied from the ApiService block in app.js, with
// getAuthToken() already substituted by TOKEN. Order matters: args are
// passed positionally to the dispatch, which mirrors the client.
const CLIENT_CALLS = [
  ['getAppData', [TOKEN]],
  ['validateSession', [TOKEN]],
  ['getMyNotifications', [TOKEN]],
  ['markNotificationsRead', [[], TOKEN]],
  ['clearMyNotifications', [TOKEN]],
  ['createTask', [{}, TOKEN]],
  ['getTaskCounts', [TOKEN]],
  ['getTasks', [{}, TOKEN]],
  ['getAssignableUsers', [TOKEN]],
  ['getMyTasks', [TOKEN]],
  ['updateTask', ['1', {}, TOKEN]],
  ['deleteTask', ['1', TOKEN]],
  ['getDashboardPreferences', [TOKEN]],
  ['saveDashboardPreferences', [{}, TOKEN]],
  ['getReportData', ['x', TOKEN]],
  ['getRecordDocuments', [1, TOKEN]],
  ['deleteDocument', ['x', TOKEN]],
  ['getSubmissions', [TOKEN, 1]],
  ['markAllSubmissionsRead', [TOKEN]],
  ['getAuditEntries', [80]],
  ['adminGetUsers', [TOKEN]],
  ['adminGetUserActivity', [TOKEN]],
  ['adminClearAudit', [TOKEN]],
  ['exportReviewCalendarIcs', [TOKEN]],
  ['getAiInsights', [TOKEN]],
  ['getCardAiInsight', [TOKEN, 1]],
  ['getLinkContentAiInsight', [TOKEN, 1]],
  ['askLinkAi', [TOKEN, 1, 'summarize this record']],
  ['processMeetingRecording', [{ title: 't' }, TOKEN]],
  ['transcribeMeetingSegment', [{}, TOKEN]],
  ['generateMeetingMinutes', [{ title: 't', transcript: 'x' }, TOKEN]],
  ['listMeetingFiles', [TOKEN]],
  ['getMeetingFile', [TOKEN, 'x.md']],
  ['deleteMeetingFile', [TOKEN, 'x.md']],
  ['getFathomStatus', [TOKEN]],
  ['setFathomApiKey', [TOKEN, 'k']],
  ['listFathomMeetings', [TOKEN, {}]],
  ['getFathomMeetingContent', [TOKEN, 'r']]
];

test('client-shaped args never land the auth token in the wrong slot', function () {
  setup();
  CLIENT_CALLS.forEach(function (entry) {
    const fn = entry[0];
    const args = entry[1];
    assert.strictEqual(typeof dispatch[fn], 'function', 'dispatch has ' + fn);
    let thrown = null;
    try {
      const result = dispatch[fn](args);
      if (result && result.success === false && result.message && AUTH_ERROR_RE.test(result.message)) {
        assert.fail(fn + ' returned auth error: ' + result.message);
      }
    } catch (err) {
      thrown = err;
    }
    if (thrown) {
      const msg = (thrown && thrown.message) || String(thrown || '');
      assert.ok(!AUTH_ERROR_RE.test(msg),
        fn + ' threw an auth error (token in the wrong slot?): ' + msg);
    }
  });
});

test('meeting-file calls pass auth through the dispatch (arg-order lock)', function () {
  setup();
  const dir = path.join(TMP, 'meetings');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Locked_2026-08-17_1200.md'), '# Locked\n\n## Summary\nok');

  // listMeetingFiles — client sends [token] (was ({}, token))
  const list = dispatch.listMeetingFiles([TOKEN]);
  assert.strictEqual(list.success, true);
  assert.strictEqual(list.total, 1);

  // getMeetingFile — client sends [token, name] (was ({name}, token))
  const dl = dispatch.getMeetingFile([TOKEN, 'Locked_2026-08-17_1200.md']);
  assert.strictEqual(dl.success, true);
  assert.strictEqual(dl.mimeType, 'text/markdown');

  // deleteMeetingFile — client sends [token, name] (was ({name}, token))
  const del = dispatch.deleteMeetingFile([TOKEN, 'Locked_2026-08-17_1200.md']);
  assert.strictEqual(del.success, true);
  const after = dispatch.listMeetingFiles([TOKEN]);
  assert.strictEqual(after.total, 0);

  // The old buggy client shape must still fail auth — this is the lock.
  assert.throws(function () { dispatch.listMeetingFiles([{}, TOKEN]); }, /login required/i);
  assert.throws(function () { dispatch.getMeetingFile([{ name: 'x.md' }, TOKEN]); }, /login required/i);
});

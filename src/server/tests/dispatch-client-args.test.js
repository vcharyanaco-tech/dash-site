/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/dispatch-client-args.test.js
 * Arg-order lock, auto-maintained: parses the REAL ApiService
 * block from app.js, evaluates each client call's arguments
 * (token position included), and replays them through
 * index-dispatch. Any auth error means the token landed in the
 * wrong slot — the bug class that made Meeting Notes throw
 * "Login required" and log the user out.
 *
 * Because it reads app.js directly, this never drifts: a new
 * client call is audited automatically, and a call whose token
 * position diverges from the dispatch fails the suite.
 * ============================================================
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-client-args-'));
process.env.DASH_DATA_DIR = TMP;
process.env.DASH_IMPORT_SKIP = '1';

const { db } = require('../db');
const dispatch = require('../index-dispatch');

const APP_JS = path.join(__dirname, '..', '..', '..', 'app.js');
const TOKEN = 'tok';

function setup() {
  db.prepare("INSERT OR IGNORE INTO users (email, role, salt, password_hash, must_change, created_by, created_at, username) VALUES ('a@x.com', 'ADMIN', 'salt', 'x', 0, '', 0, 'admin')").run();
  db.prepare("INSERT OR IGNORE INTO sessions (token, email, created_at, expires_at) VALUES ('tok', 'a@x.com', 0, " + (Date.now() + 3600000) + ")").run();
}

// Auth errors are exactly what a misplaced token produces. Any other
// (domain) error is tolerated — the point is the auth check must pass.
const AUTH_ERROR_RE = /login required|session expired|please log in|permission required/i;

// Safe values for every parameter name used in the ApiService signatures.
const VALUE = {
  item: {}, row: 1, cardRow: 1, cardId: 'C1', text: 't', name: 'x.md',
  ids: [], filters: undefined, params: {}, prefs: {}, fields: {},
  csv: 'a@x.com,VIEWER', email: 'a@x.com', username: 'audit', role: 'VIEWER',
  password: 'x', group: '', department: '', office: '', subject: 's', body: 'b',
  currentPassword: 'x', newPassword: 'x', id: '1', limit: undefined,
  rowNumbers: [], recipient: 'a@x.com', templateKey: 'x', docId: 'x',
  keep: true, recordId: 'R1', fileName: 'f.txt', fileBytes: 'Yg==',
  mimeType: 'text/plain', submissionId: '1', apiKey: 'k', opts: undefined,
  recordingId: 'r', question: 'summarize', payload: {}
};

// These hit external services / heavy I/O; they are exercised by their own
// tests (sync-preview.test.js, sync-prune.test.js) and skipped here.
const SKIP = new Set(['adminSyncFromSheet', 'adminPreviewSyncFromSheet']);

// Parse the ApiService object body out of app.js.
function parseClientCalls() {
  const src = fs.readFileSync(APP_JS, 'utf8');
  const start = src.indexOf('const ApiService = {');
  const end = src.indexOf('\n};', start);
  if (start === -1 || end === -1) throw new Error('Could not locate ApiService block in app.js');
  const block = src.slice(start, end);
  // fnName: function (params) { return apiCall_('name', args...); },
  const ENTRY = /(\w+):\s*function\s*\(([^)]*)\)\s*\{\s*return\s+apiCall_\('([^']+)'([\s\S]*?)\);\s*\}/g;
  const calls = [];
  let m;
  while ((m = ENTRY.exec(block)) !== null) {
    calls.push({
      fn: m[1],
      api: m[3],
      params: m[2].split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      argExprs: m[4].split(',').map(function (s) { return s.trim(); }).filter(Boolean)
    });
  }
  return calls;
}

// Evaluate a call's arg expressions with params bound to safe values and
// getAuthToken() returning the real session token — exactly the args the
// browser would send.
function evalArgs(call) {
  const names = call.params.concat('getAuthToken');
  const body = 'return [' + call.argExprs.join(',') + '];';
  const make = new (Function.prototype.bind.apply(Function, [null].concat(names, body)))();
  return make.apply(null, call.params.map(function (p) { return VALUE[p]; }).concat(function () { return TOKEN; }));
}

test('every app.js ApiService call authenticates through the dispatch', async function () {
  setup();
  const calls = parseClientCalls();
  assert.ok(calls.length >= 50, 'parsed a healthy number of client calls: ' + calls.length);
  const missing = [];
  const authErrors = [];
  for (const call of calls) {
    if (SKIP.has(call.api)) continue;
    if (typeof dispatch[call.api] !== 'function') { missing.push(call.api); continue; }
    // Re-create the session before every call: the ApiService block is
    // replayed in order, and logout() deletes the token — each call should
    // be judged as if the user is freshly logged in.
    db.prepare("INSERT OR IGNORE INTO sessions (token, email, created_at, expires_at) VALUES ('tok', 'a@x.com', 0, " + (Date.now() + 3600000) + ")").run();
    let args;
    try {
      args = evalArgs(call);
    } catch (e) {
      authErrors.push(call.fn + ': could not evaluate args (' + e.message + ')');
      continue;
    }
    try {
      // Some endpoints are async (AI/meeting calls) — await so late
      // rejections can't escape as unhandled rejections.
      const r = await Promise.resolve(dispatch[call.api](args));
      if (r && r.success === false && r.message && AUTH_ERROR_RE.test(r.message)) {
        authErrors.push(call.fn + ' returned auth error: ' + r.message);
      }
    } catch (e) {
      const msg = (e && e.message) || String(e || '');
      if (AUTH_ERROR_RE.test(msg)) authErrors.push(call.fn + ' threw auth error: ' + msg);
    }
  }
  assert.deepStrictEqual(missing, [], 'client calls missing from dispatch');
  assert.deepStrictEqual(authErrors, [], 'client calls with a misplaced auth token');
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

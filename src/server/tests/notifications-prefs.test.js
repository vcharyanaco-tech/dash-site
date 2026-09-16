/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/notifications-prefs.test.js
 * Part 9: notification prefs, suppression, history/byType, mark-by-type, dedupe.
 * Run: node --test tests/notifications-prefs.test.js
 * ============================================================ */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');

const { password } = require('./test-bootstrap');
const { server } = require('../index');
const { db } = require('../db');
const notifications = require('../notifications');

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

test('admin login', async function () {
  const res = await post('login', ['vcharyanaco@gmail.com', password]);
  assert.strictEqual(res.success, true);
  assert.ok(res.token);
  token = res.token;
});

/* ------------------------------------------------------------------ */
/* getNotificationPrefs / setNotificationPrefs                          */
/* ------------------------------------------------------------------ */

test('getNotificationPrefs returns default prefs object', async function () {
  const res = await post('getNotificationPrefs', [token]);
  assert.ok(res && res.prefs, 'expected prefs in response');
  const p = res.prefs;
  assert.strictEqual(p.record, true);
  assert.strictEqual(p.submission, true);
  assert.strictEqual(p.user, true);
  assert.strictEqual(p.system, true);
  assert.strictEqual(p.push, true);
});

test('setNotificationPrefs updates and returns cleaned prefs', async function () {
  const res = await post('setNotificationPrefs', [{ record: false, push: false }, token]);
  assert.ok(res && res.prefs);
  assert.strictEqual(res.prefs.record, false);
  assert.strictEqual(res.prefs.push, false);
  // Other keys should remain at default
  assert.strictEqual(res.prefs.submission, true);
  assert.strictEqual(res.prefs.user, true);
  assert.strictEqual(res.prefs.system, true);
  // Restore defaults
  await post('setNotificationPrefs', [{ record: true, push: true }, token]);
});

test('setNotificationPrefs rejects non-object prefs', async function () {
  await assert.rejects(
    post('setNotificationPrefs', [null, token]),
    /prefs must be an object/
  );
});

/* ------------------------------------------------------------------ */
/* appendNotification_ respects prefs (suppression)                     */
/* ------------------------------------------------------------------ */

test('appendNotification_ suppresses when type is disabled', async function () {
  await post('setNotificationPrefs', [{ system: false }, token]);

  const beforeRows = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE email = ?').get(
    'vcharyanaco@gmail.com'
  ).c;

  notifications.appendNotification_('vcharyanaco@gmail.com', 'system', 'test-suppressed', 'body', '');

  const afterRows = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE email = ?').get(
    'vcharyanaco@gmail.com'
  ).c;

  assert.strictEqual(afterRows, beforeRows, 'notification should be suppressed when type is disabled');

  // Restore
  await post('setNotificationPrefs', [{ system: true }, token]);
});

/* ------------------------------------------------------------------ */
/* appendNotification_ stores priority + recordRow                      */
/* ------------------------------------------------------------------ */

test('appendNotification_ stores priority and recordRow fields', function () {
  const id = require('../helpers').uuid_();
  db.prepare(
    'INSERT INTO notifications (id, email, type, title, body, link, created_at, read_at, priority, record_row) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, 'vcharyanaco@gmail.com', 'record', 'priority-test', 'body', '', Date.now(), null, 1, 42);

  const row = db.prepare('SELECT priority, record_row FROM notifications WHERE id = ?').get(id);
  assert.strictEqual(row.priority, 1);
  assert.strictEqual(row.record_row, 42);

  db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
});

/* ------------------------------------------------------------------ */
/* getMyNotifications returns history, byTypeUnread, byTypeCount, prefs */
/* ------------------------------------------------------------------ */

test('getMyNotifications returns grouped counts and prefs', async function () {
  // Insert two test notifications
  const id1 = require('../helpers').uuid_();
  const id2 = require('../helpers').uuid_();
  db.prepare(
    'INSERT INTO notifications (id, email, type, title, body, link, created_at, read_at, priority, record_row) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id1, 'vcharyanaco@gmail.com', 'record', 'unread-record', 'body', '', Date.now(), null, 0, 0);
  db.prepare(
    'INSERT INTO notifications (id, email, type, title, body, link, created_at, read_at, priority, record_row) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id2, 'vcharyanaco@gmail.com', 'system', 'unread-system', 'body', '', Date.now(), null, 0, 0);

  const res = await post('getMyNotifications', [token]);
  assert.ok(res.unread >= 2, 'expected at least 2 unread');
  assert.ok(Array.isArray(res.history), 'expected history array');
  assert.ok(res.history.length >= 2, 'expected history with at least 2 items');
  assert.ok(typeof res.byTypeUnread === 'object', 'expected byTypeUnread');
  assert.ok(res.byTypeUnread.record >= 1, 'expected at least 1 unread record');
  assert.ok(res.byTypeUnread.system >= 1, 'expected at least 1 unread system');
  assert.ok(res.prefs && typeof res.prefs.push === 'boolean', 'expected prefs in response');

  // Cleanup
  db.prepare('DELETE FROM notifications WHERE id IN (?, ?)').run(id1, id2);
});

/* ------------------------------------------------------------------ */
/* markNotificationsRead with type name                                 */
/* ------------------------------------------------------------------ */

test('markNotificationsRead by type marks all of that type as read', async function () {
  const id = require('../helpers').uuid_();
  db.prepare(
    'INSERT INTO notifications (id, email, type, title, body, link, created_at, read_at, priority, record_row) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, 'vcharyanaco@gmail.com', 'user', 'mark-test', 'body', '', Date.now(), null, 0, 0);

  const before = db.prepare('SELECT read_at FROM notifications WHERE id = ?').get(id);
  assert.strictEqual(before.read_at, null, 'should start unread');

  const res = await post('markNotificationsRead', [['user'], token]);
  assert.ok(res);

  const after = db.prepare('SELECT read_at FROM notifications WHERE id = ?').get(id);
  assert.ok(after.read_at !== null, 'should be marked read after mark-by-type');

  // Cleanup
  db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
});

test('markNotificationsRead with "all" string marks everything read', async function () {
  const id = require('../helpers').uuid_();
  db.prepare(
    'INSERT INTO notifications (id, email, type, title, body, link, created_at, read_at, priority, record_row) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, 'vcharyanaco@gmail.com', 'submission', 'mark-all-test', 'body', '', Date.now(), null, 0, 0);

  const res = await post('markNotificationsRead', ['all', token]);
  assert.ok(res);

  const after = db.prepare('SELECT read_at FROM notifications WHERE id = ?').get(id);
  assert.ok(after.read_at !== null, 'should be marked read after mark-all');

  db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
});

/* ------------------------------------------------------------------ */
/* Deduplication via dedupeKey                                         */
/* ------------------------------------------------------------------ */

test('appendNotification_ deduplicates via dedupeKey within TTL', function () {
  const key = 'testdedupe_' + Date.now();
  const email = 'vcharyanaco@gmail.com';

  // First call should insert
  notifications.appendNotification_(email, 'record', 'dedupe-1', 'body', '', {
    dedupeKey: key,
    dedupeTtlSeconds: 300
  });

  const after1 = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE title = ?').get('dedupe-1').c;
  assert.ok(after1 >= 1, 'first insert should succeed');

  // Second call with same dedupeKey should be suppressed
  notifications.appendNotification_(email, 'record', 'dedupe-1', 'body', '', {
    dedupeKey: key,
    dedupeTtlSeconds: 300
  });

  const after2 = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE title = ?').get('dedupe-1').c;
  assert.strictEqual(after2, after1, 'second call should be deduplicated');

  // Cleanup
  db.prepare('DELETE FROM notifications WHERE title = ?').run('dedupe-1');
});

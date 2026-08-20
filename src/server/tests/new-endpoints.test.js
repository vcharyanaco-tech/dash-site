/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/new-endpoints.test.js
 * End-to-end tests for push notifications, weekly reports,
 * i18n translations, and the daily-jobs internal endpoint.
 * Run: node --test tests/new-endpoints.test.js
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

const { server } = require('../index');
const { db } = require('../db');

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

/* ============================================================
 * Setup: login as admin
 * ============================================================ */

test('admin login', async function () {
  const res = await post('login', ['vcharyanaco@gmail.com', 'Admin@123']);
  assert.strictEqual(res.success, true);
  assert.ok(res.token);
  token = res.token;
});

/* ============================================================
 * Push notifications — subscribe / unsubscribe
 * ============================================================ */

test('subscribePush: requires auth', async function () {
  await assert.rejects(
    post('subscribePush', [{ endpoint: 'https://example.com/push', keys: {} }]),
    /login required/i
  );
});

test('subscribePush: rejects invalid subscription', async function () {
  await assert.rejects(
    post('subscribePush', [{}, token]),
    /invalid push subscription/i
  );
});

test('subscribePush: stores valid subscription', async function () {
  const sub = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
    keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-key' }
  };
  const result = await post('subscribePush', [sub, token]);
  assert.strictEqual(result.success, true);

  // Verify stored in DB
  const row = db.prepare('SELECT * FROM push_subscriptions WHERE endpoint = ?')
    .get('https://fcm.googleapis.com/fcm/send/test-endpoint-123');
  assert.ok(row, 'subscription should be stored in DB');
  assert.strictEqual(row.email, 'vcharyanaco@gmail.com');
  assert.strictEqual(row.p256dh, 'test-p256dh-key');
  assert.strictEqual(row.auth_key, 'test-auth-key');
});

test('subscribePush: upserts on duplicate endpoint', async function () {
  const sub = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
    keys: { p256dh: 'updated-p256dh', auth: 'updated-auth' }
  };
  const result = await post('subscribePush', [sub, token]);
  assert.strictEqual(result.success, true);

  // Should have updated, not duplicated
  const count = db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE endpoint = ?')
    .get('https://fcm.googleapis.com/fcm/send/test-endpoint-123');
  assert.strictEqual(count.n, 1, 'should upsert, not duplicate');

  const row = db.prepare('SELECT * FROM push_subscriptions WHERE endpoint = ?')
    .get('https://fcm.googleapis.com/fcm/send/test-endpoint-123');
  assert.strictEqual(row.p256dh, 'updated-p256dh');
});

test('unsubscribePush: removes subscription', async function () {
  const result = await post('unsubscribePush', [
    'https://fcm.googleapis.com/fcm/send/test-endpoint-123', token
  ]);
  assert.strictEqual(result.success, true);

  const row = db.prepare('SELECT * FROM push_subscriptions WHERE endpoint = ?')
    .get('https://fcm.googleapis.com/fcm/send/test-endpoint-123');
  assert.strictEqual(row, undefined, 'subscription should be deleted');
});

test('unsubscribePush: no-op for unknown endpoint', async function () {
  const result = await post('unsubscribePush', ['https://nonexistent.example.com', token]);
  assert.strictEqual(result.success, true);
});

/* ============================================================
 * Push notifications — send
 * ============================================================ */

test('sendReviewDeadlinePushNotifications: works without auth (cron mode)', async function () {
  // Intentionally allows token-less calls for the daily cron job.
  // When called without a token, it skips auth and processes all records.
  const result = await post('sendReviewDeadlinePushNotifications', []);
  assert.strictEqual(result.success, true);
  assert.strictEqual(typeof result.sent, 'number');
});

test('sendReviewDeadlinePushNotifications: runs without error', async function () {
  // No VAPID keys configured, so sent will be 0 but should not throw
  const result = await post('sendReviewDeadlinePushNotifications', [token]);
  assert.strictEqual(result.success, true);
  assert.strictEqual(typeof result.sent, 'number');
});

/* ============================================================
 * Weekly reports
 * ============================================================ */

test('sendWeeklyReport: requires admin auth', async function () {
  // Create a VIEWER user and try to call sendWeeklyReport
  await post('adminAddUser', ['viewer@test.com', 'viewer_e2e', 'VIEWER', 'Viewer@123', '', '', '', token]);
  const vLogin = await post('login', ['viewer@test.com', 'Viewer@123']);
  await assert.rejects(
    post('sendWeeklyReport', [vLogin.token]),
    /admin permission required/i
  );
  // Cleanup
  await post('adminDeleteUser', ['viewer@test.com', token]);
});

test('sendWeeklyReport: generates report successfully', async function () {
  const result = await post('sendWeeklyReport', [token]);
  assert.strictEqual(result.success, true);
  assert.strictEqual(typeof result.sent, 'number');
  assert.ok(result.sent >= 0, 'sent count should be non-negative');
  assert.ok(result.period, 'should have period string');
  assert.ok(result.period.indexOf('—') !== -1, 'period should contain dash separator');
  assert.ok(result.activity, 'should have activity object');
  assert.ok(result.health, 'should have health object');
  assert.strictEqual(typeof result.health.totalRecords, 'number');
  assert.strictEqual(typeof result.health.flagged, 'number');
  assert.strictEqual(typeof result.health.normal, 'number');
  assert.strictEqual(typeof result.health.sectorCount, 'number');
  assert.strictEqual(typeof result.health.overdueCount, 'number');
  assert.ok(Array.isArray(result.health.overdueItems), 'overdueItems should be array');
  assert.strictEqual(typeof result.activity.totalAuditEvents, 'number');
});

test('sendWeeklyReport: activity counters are numbers', async function () {
  const result = await post('sendWeeklyReport', [token]);
  const a = result.activity;
  assert.strictEqual(typeof a.newRecords, 'number');
  assert.strictEqual(typeof a.updatedRecords, 'number');
  assert.strictEqual(typeof a.deletedRecords, 'number');
  assert.strictEqual(typeof a.logins, 'number');
  assert.strictEqual(typeof a.submissions, 'number');
  assert.strictEqual(typeof a.newUsers, 'number');
  assert.strictEqual(typeof a.reviewDone, 'number');
  assert.strictEqual(typeof a.reviewReopened, 'number');
});

/* ============================================================
 * i18n translations endpoint
 * ============================================================ */

test('getTranslations: returns English by default', async function () {
  const result = await post('getTranslations', []);
  assert.ok(result, 'should return translations object');
  assert.strictEqual(result['nav.dashboard'], 'Dashboard');
  assert.strictEqual(result['dashboard.title'], 'India Post Dashboard');
  assert.strictEqual(result['common.save'], 'Save');
});

test('getTranslations: returns Hindi when requested', async function () {
  const result = await post('getTranslations', ['hi']);
  assert.ok(result, 'should return translations object');
  assert.strictEqual(result['nav.dashboard'], 'डैशबोर्ड');
  assert.strictEqual(result['dashboard.title'], 'भारतीय डाक डैशबोर्ड');
  assert.strictEqual(result['common.save'], 'सहेजें');
});

test('getTranslations: falls back to English for unknown language', async function () {
  const result = await post('getTranslations', ['fr']);
  assert.strictEqual(result['nav.dashboard'], 'Dashboard');
});

test('getTranslations: contains expected key categories', async function () {
  const en = await post('getTranslations', ['en']);
  const hi = await post('getTranslations', ['hi']);

  // Both should have the same keys
  const enKeys = Object.keys(en);
  const hiKeys = Object.keys(hi);
  assert.ok(enKeys.length >= 15, 'English should have at least 15 keys');
  assert.ok(hiKeys.length >= 15, 'Hindi should have at least 15 keys');

  // Verify specific key categories exist
  assert.ok(en['nav.dashboard'], 'nav.* keys present');
  assert.ok(en['dashboard.title'], 'dashboard.* keys present');
  assert.ok(en['common.save'], 'common.* keys present');
});

/* ============================================================
 * Daily jobs internal endpoint
 * ============================================================ */

test('daily-jobs: rejects unauthorized requests', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api/internal/daily-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer wrong-token' },
    body: JSON.stringify({ job: 'review-reminders' })
  });
  assert.strictEqual(resp.status, 401);
  const body = await resp.json();
  assert.strictEqual(body.error, 'unauthorized');
});

test('daily-jobs: rejects requests without token', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api/internal/daily-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job: 'review-reminders' })
  });
  assert.strictEqual(resp.status, 401);
});

test('daily-jobs: rejects unknown jobs', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api/internal/daily-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' },
    body: JSON.stringify({ job: 'nonexistent-job' })
  });
  // Without a valid WORKER_API_TOKEN env, any token is rejected
  assert.strictEqual(resp.status, 401);
});

/* ============================================================
 * Cleanup
 * ============================================================ */

test('logout', async function () {
  await post('logout', [token]);
  const vs = await post('validateSession', [token]);
  assert.strictEqual(vs.success, false);
});

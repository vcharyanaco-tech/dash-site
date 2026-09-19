/**
 * ============================================================
 * Part 17 — admin System Health snapshot.
 *
 * Verifies the getSystemHealth dispatch op is admin-only and
 * returns the aggregated sections the Settings view renders.
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { password } = require('./test-bootstrap');
const { server } = require('../index');
const { db } = require('../db');

let port;
let adminToken;
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
  db.prepare("DELETE FROM users WHERE email = 'syshealth_viewer@test.com'").run();
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

test('setup: create a viewer and log in', async function () {
  const admin = await post('login', ['vcharyanaco@gmail.com', password]);
  assert.ok(admin.token);
  adminToken = admin.token;

  await post('adminAddUser',
    ['syshealth_viewer@test.com', 'syshealth_viewer', 'VIEWER', 'SysHealth123!', '', '', '', adminToken]);
  const viewer = await post('login', ['syshealth_viewer@test.com', 'SysHealth123!']);
  assert.ok(viewer.token);
  viewerToken = viewer.token;
});

test('admin: getSystemHealth returns every expected section', async function () {
  const h = await post('getSystemHealth', [adminToken]);
  assert.ok(h && typeof h === 'object');
  assert.strictEqual(h.backend.ok, true);
  assert.ok(h.backend.uptimeSec >= 0);
  assert.strictEqual(typeof h.backend.memory.rssMb, 'number');
  assert.strictEqual(h.database.ok, true);
  assert.strictEqual(typeof h.database.sizeBytes, 'number');
  assert.ok(h.backup && typeof h.backup === 'object');
  assert.ok(h.worker && typeof h.worker.urlSet === 'boolean');
  assert.ok(h.ai && typeof h.ai.enabled === 'boolean');
  assert.ok(h.notifications && 'unread' in h.notifications);
  assert.ok(h.metrics && typeof h.metrics.requestCount === 'number');
  assert.ok(h.counters && typeof h.counters.apiErrors === 'number');
  assert.ok(Array.isArray(h.recentErrors));
});

test('viewer: getSystemHealth is rejected (admin-only)', async function () {
  const body = await postRaw('getSystemHealth', [viewerToken]);
  assert.ok(body.error, 'expected an authorization error');
  assert.match(body.error, /permission/i);
});

test('unauthenticated: getSystemHealth requires a token', async function () {
  const body = await postRaw('getSystemHealth', []);
  assert.ok(body.error);
  assert.match(body.error, /getSystemHealth requires/);
});

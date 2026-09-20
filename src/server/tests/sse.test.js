/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/sse.test.js
 * Server-Sent Events hardening (Phase 13, section 4):
 *   - anonymous connections are rejected (401)
 *   - authenticated connections receive a `connected` event
 *   - user-specific events (notificationChanged) only reach the
 *     owning session's connections
 *   - general authorized events (dataChanged) reach every
 *     authenticated connection
 *   - a fresh connection after a close works (reconnect tolerance)
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { password } = require('./test-bootstrap');
const { server } = require('../index');
const { db } = require('../db');
const notifications = require('../notifications');

let port;
let adminToken;
let firstRecordRow;
const openStreams = [];

before(async function () {
  await new Promise(function (resolve) {
    server.listen(0, function () {
      port = server.address().port;
      resolve();
    });
  });
  const rows = db.prepare('SELECT row FROM records ORDER BY row ASC LIMIT 1').get();
  firstRecordRow = rows ? rows.row : 4;
});

after(function () {
  openStreams.forEach(function (s) { try { s.close(); } catch (e) {} });
  db.prepare("DELETE FROM users WHERE email = 'sse_e2e_viewer@test.com'").run();
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

/** Open an SSE connection using an explicit session cookie. */
function openSse(sessionToken) {
  const state = { events: [], closed: false, done: null, req: null };
  state.req = http.request({
    host: '127.0.0.1',
    port: port,
    path: '/api/events',
    method: 'GET',
    agent: false,
    headers: {
      Accept: 'text/event-stream',
      Cookie: sessionToken ? 'dash_session=' + sessionToken : ''
    }
  });

  state.done = new Promise(function (resolve, reject) {
    state.req.on('response', function (res) {
      state.status = res.statusCode;
      res.on('data', function (chunk) {
        // Split on blank lines (SSE frame separator)
        const frames = chunk.toString().split(/\n\s*\n/);
        frames.forEach(function (frame) {
          if (!frame.trim()) return;
          const event = { event: '', data: '', raw: frame };
          frame.split('\n').forEach(function (line) {
            if (line.indexOf('event:') === 0) event.event = line.slice(6).trim();
            else if (line.indexOf('data:') === 0) event.data = line.slice(5).trim();
            else if (line.indexOf('id:') === 0) event.id = line.slice(3).trim();
          });
          state.events.push(event);
        });
      });
      res.on('end', function () { state.closed = true; resolve(state); });
      res.on('error', function (err) { state.closed = true; reject(err); });
    });
    state.req.on('error', function (err) { state.closed = true; reject(err); });
  });

  state.req.end();
  state.close = function () {
    state.closed = true;
    if (state.req) { try { state.req.destroy(); } catch (e) {} state.req = null; }
  };
  // Stream teardown intentionally destroys in-flight responses; never let that
  // surface as an unhandledRejection during cleanup.
  state.done.catch(function () {});
  openStreams.push(state);
  return state;
}

function waitForEvent(state, name, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const deadline = Date.now() + (timeoutMs || 3000);
    const poll = function () {
      const match = state.events.filter(function (e) { return e.event === name; });
      if (match.length) return resolve(match);
      if (state.closed) return reject(new Error('stream closed while waiting for ' + name));
      if (Date.now() >= deadline) return reject(new Error('timeout waiting for ' + name + '; got: ' + state.events.map(function (e) { return e.event; }).join(',')));
      setTimeout(poll, 25);
    };
    poll();
  });
}

function waitQuiet(state, ms) {
  return new Promise(function (resolve) {
    const marker = state.events.length;
    setTimeout(function () { resolve(state.events.length === marker); }, ms);
  });
}

test('sse: anonymous connection is rejected with 401', async function () {
  const s = openSse(null);
  const outcome = await s.done.catch(function () { return null; });
  assert.ok(outcome);
  assert.strictEqual(outcome.status, 401);
  s.close();
});

test('sse: authenticated connection receives a connected event', async function () {
  const a = await post('login', ['vcharyanaco@gmail.com', password]);
  assert.ok(a.token);
  adminToken = a.token;

  const stream = openSse(adminToken);
  try {
    const events = await waitForEvent(stream, 'connected');
    assert.ok(events.length >= 1);
    assert.ok(events[0].id, 'connected event carries an event id for Last-Event-ID');
  } finally {
    stream.close();
  }
});

test('sse: notificationChanged is scoped to the owning session only', async function () {
  const viewer = (await post('adminAddUser',
    ['sse_e2e_viewer@test.com', 'sse_viewer', 'VIEWER', 'SseView123!', '', '', '', adminToken]));
  assert.ok(viewer);
  const vl = await post('login', ['sse_e2e_viewer@test.com', 'SseView123!']);
  assert.ok(vl.token);

  const viewerStream = openSse(vl.token);
  const adminStream = openSse(adminToken);
  try {
    await waitForEvent(viewerStream, 'connected');
    await waitForEvent(adminStream, 'connected');

    // Fire a notification for the viewer only.
    notifications.appendNotification_('sse_e2e_viewer@test.com', 'system', 'SSE Scoped Test', 'must reach viewer only', '', {});

    const viewerEvents = await waitForEvent(viewerStream, 'notificationChanged');
    assert.ok(viewerEvents.length >= 1);

    // Admin must NOT receive the viewer's notification within a quiet window.
    const remaining = await waitQuiet(adminStream, 800);
    assert.ok(remaining, 'admin stream unexpectedly received a notificationChanged');
  } finally {
    viewerStream.close();
    adminStream.close();
  }
});

test('sse: dataChanged reaches every authenticated connection', async function () {
  const stream = openSse(adminToken);
  try {
    await waitForEvent(stream, 'connected');
    // setRecordDisplay is a data-mutating dispatch fn that broadcasts dataChanged.
    const before = stream.events.map(function (e) { return e.event; });
    await post('setRecordDisplay', [firstRecordRow, true, adminToken]);
    const events = await waitForEvent(stream, 'dataChanged');
    assert.ok(events.length >= 1);
  } finally {
    stream.close();
  }
});

test('sse: reconnect after close picks up a fresh connection', async function () {
  const s1 = openSse(adminToken);
  await waitForEvent(s1, 'connected');
  s1.close();

  const s2 = openSse(adminToken);
  try {
    const events = await waitForEvent(s2, 'connected');
    assert.ok(events.length >= 1);
  } finally {
    s2.close();
  }
});
/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/divisional-heads-group.test.js
 * Verify the "All Divisional Heads" virtual group is available
 * in the tasks assignee dropdown via getAssignableUsers.
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

// Login once for all tests in this file.
test('admin login', async function () {
  const res = await post('login', ['vcharyanaco@gmail.com', 'Admin@123']);
  assert.strictEqual(res.success, true);
  assert.ok(res.token);
  token = res.token;
});

test('getAssignableUsers includes "All Divisional Heads" group', async function () {
  const users = await post('getAssignableUsers', [token]);
  assert.ok(Array.isArray(users), 'getAssignableUsers must return an array');
  assert.ok(users.length > 0, 'list should not be empty');

  // The group entry should be the very first item (unshift).
  const group = users.find(function (u) {
    return u.email === 'group:all-divisional-heads';
  });
  assert.ok(group, '"All Divisional Heads" group entry must be present');
  assert.strictEqual(group.role, 'GROUP');
  assert.strictEqual(group.label, 'All Divisional Heads');
});

test('"All Divisional Heads" group appears first in the list', async function () {
  const users = await post('getAssignableUsers', [token]);
  assert.ok(users.length > 0);
  assert.strictEqual(
    users[0].email,
    'group:all-divisional-heads',
    'Group entry must be first (top of dropdown)'
  );
});

test('getAssignableUsers still includes regular user entries', async function () {
  const users = await post('getAssignableUsers', [token]);
  const regularUsers = users.filter(function (u) {
    return u.email !== 'group:all-divisional-heads';
  });
  assert.ok(regularUsers.length > 0, 'Regular users should still be listed');

  // Each regular user should have email, username, role.
  regularUsers.forEach(function (u) {
    assert.ok(u.email, 'User must have an email');
    assert.ok(u.role, 'User must have a role');
  });
});

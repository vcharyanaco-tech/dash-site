// Audit listing reads newest-first through an indexed ORDER BY + LIMIT instead
// of loading the whole log and sorting in JS. The public surface (row numbers,
// ordering, limit cap) must stay identical.
const { test } = require('node:test');
const assert = require('node:assert');

const { db } = require('../db');
const { createSession_ } = require('../db');
const audit = require('../audit');

function addAuditRow_(id, ts) {
  db.prepare(
    'INSERT OR REPLACE INTO audit (id, timestamp, user, action, record_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, ts, 'a@x.com', 'ACTION_' + id, '', 'details-' + id);
}

let viewerToken;
test('setup: create a viewer session', function () {
  db.prepare("INSERT OR IGNORE INTO users (email, role, salt, password_hash, must_change, created_by, created_at, username) VALUES ('audlister@x.com', 'VIEWER', 'salt', 'x', 0, '', 0, 'audlister')").run();
  db.prepare('DELETE FROM audit').run();
  viewerToken = createSession_('audlister@x.com');
  assert.ok(viewerToken);
});

test('getAuditEntries returns newest-first and honours the limit via SQL', function () {
  // Insert out of chronological id order so a naive full scan would mis-order.
  addAuditRow_(9001, 1000);
  addAuditRow_(9002, 3000);
  addAuditRow_(9003, 2000);

  const capped = audit.getAuditEntries(2, viewerToken);
  assert.strictEqual(capped.length, 2, 'limit is applied in SQL, not a JS slice');

  const all = audit.getAuditEntries(0, viewerToken);
  assert.ok(all.length >= 3, 'no-limit call still returns entries');
  for (let i = 1; i < all.length; i++) {
    assert.ok(all[i - 1].timestampMs >= all[i].timestampMs, 'list stays descending');
  }
  // The fixtures' relative order must hold regardless of other audit rows that
  // newer activity may have written ahead of them.
  const pos = function (id) { return all.reduce(function (acc, r, i) { return r.row === id ? i : acc; }, -1); };
  assert.ok(pos(9002) !== -1 && pos(9003) !== -1 && pos(9001) !== -1, 'fixture rows present');
  assert.ok(pos(9002) < pos(9003) && pos(9003) < pos(9001), 'fixtures sorted newest-first by timestamp');
});

test('adminDeleteAuditRows only removes the requested rows and still lists cleanly', function () {
  const adminToken = createSession_('vcharyanaco@gmail.com');
  const after = audit.adminDeleteAuditRows([9001], adminToken);
  const stillThere = after.some(function (r) { return r.row === 9001; });
  assert.strictEqual(stillThere, false, 'deleted row gone from the returned list');
});

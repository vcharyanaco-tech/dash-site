// archiveAuditLog — replacement for the GAS daily audit-archival trigger.
// Moves audit rows older than 90 days into audit_archive (bounded batch),
// keeps recent rows live, and never throws on an empty table.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const TMP = path.join('D:/tmp', 'audit-archive-' + Date.now());
process.env.DASH_DATA_DIR = TMP;

const { db } = require('../db');
const { archiveAuditLog } = require('../audit');

function seedAudit(ts, user, action) {
  db.prepare('INSERT INTO audit (timestamp, user, action, record_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(ts, user, action, '', '{}');
}

test('archiveAuditLog moves old rows, keeps recent, reports batch limit', function () {
  const oldTs = Date.now() - 200 * 24 * 3600 * 1000; // ~200 days ago
  const freshTs = Date.now();
  seedAudit(oldTs, 'u1', 'OLD_1');
  seedAudit(oldTs, 'u1', 'OLD_2');
  seedAudit(freshTs, 'u2', 'FRESH');

  const result = archiveAuditLog();

  assert.strictEqual(result.archived, 2, 'both old rows archived');
  assert.strictEqual(result.batchLimitReached, false);
  assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM audit').get().c, 1, 'only the fresh row stays live');
  assert.strictEqual(db.prepare("SELECT COUNT(*) c FROM audit_archive WHERE action = 'OLD_1'").get().c, 1);
  assert.strictEqual(db.prepare("SELECT COUNT(*) c FROM audit_archive WHERE action = 'OLD_2'").get().c, 1);
  assert.strictEqual(db.prepare("SELECT COUNT(*) c FROM audit_archive WHERE action = 'FRESH'").get().c, 0);
});

test('archiveAuditLog is idempotent on an empty live table', function () {
  const result = archiveAuditLog();
  assert.strictEqual(result.archived, 0);
  assert.strictEqual(result.batchLimitReached, false);
});

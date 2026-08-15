// The KV backup bridge exposes write-budget + last-backup state so the
// health endpoint can surface quota exhaustion instead of failing silently.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const TMP = path.join('D:/tmp', 'backup-status-' + Date.now());
process.env.DASH_DATA_DIR = TMP;
fs.mkdirSync(TMP, { recursive: true });

require('../db');
const dataSync = require('../data-sync');

test('getBackupStatus exposes budget + last-backup state even when the bridge is disabled', function () {
  const s = dataSync.getBackupStatus();
  assert.strictEqual(s.enabled, false);
  assert.strictEqual(typeof s.budget, 'number');
  assert.ok(s.budget > 0, 'budget is a positive number');
  assert.strictEqual(typeof s.budgetLeft, 'number');
  assert.strictEqual(s.lastBackupAt, null);
  assert.strictEqual(typeof s.writesToday, 'number');
  assert.strictEqual(typeof s.meetings, 'number');
});

test('exportFullBackup returns a valid standalone SQLite copy with the core tables', async function () {
  const { db } = require('../db');
  db.prepare("INSERT INTO users (email, role, salt, password_hash, must_change, created_by, created_at, username) VALUES ('b@x.com', 'ADMIN', 'salt', 'x', 0, '', 0, 'admin2')").run();
  db.prepare("INSERT INTO sessions (token, email, created_at, expires_at) VALUES ('tok2', 'b@x.com', 0, " + (Date.now() + 3600000) + ")").run();
  const fb = require('../full-backup');
  const out = await fb.exportFullBackup('tok2');
  assert.strictEqual(out.success, true);
  assert.ok(out.size > 0);
  const buf = Buffer.from(out.base64, 'base64');
  assert.strictEqual(buf.length, out.size);
  assert.strictEqual(buf.toString('utf8', 0, 15), 'SQLite format 3');
  const sqlite = require('better-sqlite3');
  const tmp = path.join(TMP, 'fb-check.db');
  fs.writeFileSync(tmp, buf);
  const c = new sqlite(tmp, { readonly: true });
  const tables = c.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(function (r) { return r.name; });
  c.close();
  try { fs.unlinkSync(tmp); } catch (err) {}
  ['records', 'users', 'submissions', 'tasks', 'settings'].forEach(function (t) {
    assert.ok(tables.indexOf(t) !== -1, 'backup contains table ' + t);
  });
});

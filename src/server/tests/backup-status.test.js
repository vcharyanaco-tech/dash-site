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

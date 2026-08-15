// Retention policy: files (meetings + uploads) older than DASH_RETENTION_DAYS
// are pruned from disk, from KV (when the bridge is enabled), and — for
// uploads — from the documents table, while newer files survive.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TMP = path.join('D:/tmp', 'retention-' + Date.now());
process.env.DASH_DATA_DIR = TMP;
process.env.DASH_RETENTION_DAYS = '1';

const { db } = require('../db');
const dataSync = require('../data-sync');

test('retentionDays surfaces in backup status', function () {
  assert.strictEqual(dataSync.getBackupStatus().retentionDays, 1);
});

test('enforceRetention_ prunes old meetings + uploads but keeps recent ones', async function () {
  const meetDir = path.join(TMP, 'meetings');
  const upDir = path.join(TMP, 'uploads');
  fs.mkdirSync(meetDir, { recursive: true });
  fs.mkdirSync(upDir, { recursive: true });

  // Old meeting files: the creation stamp is in the file name (2020 → 6 years old).
  fs.writeFileSync(path.join(meetDir, 'Old meeting_2020-01-01_0000.md'), 'old notes');
  fs.writeFileSync(path.join(meetDir, 'Old meeting_2020-01-01_0000.mp3'), Buffer.from('old audio'));
  // Fresh meeting file: recent stamp must survive.
  fs.writeFileSync(path.join(meetDir, 'Recent meeting_2030-01-01_1200.md'), 'recent notes');

  // Old + recent uploads via the documents table (uploaded_at is ms epoch).
  db.prepare(
    "INSERT INTO documents (id, record_row, record_id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at) VALUES ('olddoc', 1, '1', 'old.pdf', 'oldkey', 'application/pdf', 10, 'a@x.com', 1)"
  ).run();
  db.prepare(
    "INSERT INTO documents (id, record_row, record_id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at) VALUES ('newdoc', 2, '2', 'new.pdf', 'newkey', 'application/pdf', 10, 'a@x.com', " + (Date.now() + 3600000) + ")"
  ).run();
  fs.writeFileSync(path.join(upDir, 'oldkey'), Buffer.from('old upload'));
  fs.writeFileSync(path.join(upDir, 'newkey'), Buffer.from('new upload'));

  const pruned = await dataSync.enforceRetention_(true);

  assert.strictEqual(pruned.meetings, 2, 'both old meeting files pruned');
  assert.strictEqual(pruned.uploads, 1, 'old upload pruned');
  assert.ok(!fs.existsSync(path.join(meetDir, 'Old meeting_2020-01-01_0000.md')));
  assert.ok(!fs.existsSync(path.join(meetDir, 'Old meeting_2020-01-01_0000.mp3')));
  assert.ok(fs.existsSync(path.join(meetDir, 'Recent meeting_2030-01-01_1200.md')), 'recent meeting kept');
  assert.ok(!fs.existsSync(path.join(upDir, 'oldkey')));
  assert.ok(fs.existsSync(path.join(upDir, 'newkey')), 'recent upload kept');
  assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM documents WHERE id = ?').get('olddoc').c, 0, 'old document row removed');
  assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM documents WHERE id = ?').get('newdoc').c, 1, 'recent document row kept');

  // Pruned files are recorded in the daily stats (2 meetings + 1 upload).
  assert.strictEqual(dataSync.getBackupStatus().prunedToday, 3);
});

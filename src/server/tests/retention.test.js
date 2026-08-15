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

test('setDocumentKeep toggles the retention exemption and the sweep honours it', async function () {
  const documents = require('../documents');
  db.prepare("INSERT INTO users (email, role, salt, password_hash, must_change, created_by, created_at, username) VALUES ('k@x.com', 'ADMIN', 'salt', 'x', 0, '', 0, 'keepadmin')").run();
  db.prepare("INSERT INTO sessions (token, email, created_at, expires_at) VALUES ('keeptok', 'k@x.com', 0, " + (Date.now() + 3600000) + ")").run();
  db.prepare(
    "INSERT INTO documents (id, record_row, record_id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at) VALUES ('keptdoc', 3, '3', 'keep.pdf', 'keepkey', 'application/pdf', 10, 'k@x.com', 1)"
  ).run();
  const upDir = path.join(TMP, 'uploads');
  fs.writeFileSync(path.join(upDir, 'keepkey'), Buffer.from('keep me'));

  // Toggle on — exempt from retention.
  const on = documents.setDocumentKeep('keptdoc', 1, 'keeptok');
  assert.strictEqual(on.success, true);
  assert.strictEqual(on.keep, 1);
  // Kept flag shows up in the doc record returned to the client.
  const listed = documents.getRecordDocuments(3, 'keeptok');
  assert.strictEqual(listed.length, 1);
  assert.strictEqual(listed[0].keep, 1);

  // An old kept document survives the sweep.
  const pruned = await dataSync.enforceRetention_(true);
  assert.strictEqual(pruned.uploads, 0, 'kept upload not pruned');
  assert.ok(fs.existsSync(path.join(upDir, 'keepkey')), 'kept file still on disk');
  assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM documents WHERE id = ?').get('keptdoc').c, 1, 'kept row retained');

  // Toggle off — retention applies again.
  const off = documents.setDocumentKeep('keptdoc', 0, 'keeptok');
  assert.strictEqual(off.keep, 0);
  const pruned2 = await dataSync.enforceRetention_(true);
  assert.strictEqual(pruned2.uploads, 1, 'un-kept upload now pruned');
  assert.ok(!fs.existsSync(path.join(upDir, 'keepkey')), 'un-kept file removed');
  assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM documents WHERE id = ?').get('keptdoc').c, 0, 'un-kept row removed');
});

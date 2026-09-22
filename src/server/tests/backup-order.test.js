// Backup session semantics (KV bridge):
//  - files (uploads + meetings) are pushed BEFORE the DB snapshot: the /db put
//    is the commit point, so a snapshot can never reference KV keys that
//    haven't been written yet (broken attachments after a restore).
//  - at least one budget write is always reserved for the /db commit, so file
//    pushes can't starve it.
//  - the orphan sweep never deletes a KV key that a documents row references
//    even when the file is missing locally (restore interrupted) — deleting it
//    would permanently break that attachment.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const TMP = path.join(os.tmpdir(), 'backup-order-' + Date.now());
process.env.DASH_DATA_DIR = TMP;
process.env.DASH_UPLOAD_DIR = path.join(TMP, 'uploads');
process.env.DATA_SYNC_URL = 'https://backup.test/api/backup';
process.env.WORKER_API_TOKEN = 'test-token';
process.env.DASH_RETENTION_DAYS = '0';
process.env.DASH_BACKUP_WRITE_BUDGET = '3';
process.env.DASH_MIGRATION_SKIP = '1';

let seen = [];
function installFetch() {
  const originalFetch = global.fetch;
  global.fetch = async function (url, opts) {
    const u = String(url);
    seen.push({ url: u, method: opts && opts.method ? opts.method : 'GET' });
    if (/\/(uploads|meetings)$/.test(u) && (!opts.method || opts.method === 'GET')) {
      return { ok: true, json: async function () { return { files: [] }; } };
    }
    if (opts && (opts.method === 'DELETE' || opts.method === 'PUT')) {
      return { ok: true, status: 200 };
    }
    return { ok: true, json: async function () { return {}; } };
  };
  return originalFetch;
}

const { db } = require('../db');
const dataSync = require('../data-sync');

test('backup pushes files before the DB snapshot and reserves the commit write', async function () {
  fs.mkdirSync(path.join(TMP, 'uploads'), { recursive: true });
  fs.mkdirSync(path.join(TMP, 'meetings'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'uploads', 'u1'), Buffer.from('a'));
  fs.writeFileSync(path.join(TMP, 'uploads', 'u2'), Buffer.from('b'));
  fs.writeFileSync(path.join(TMP, 'uploads', 'u3'), Buffer.from('c'));
  fs.writeFileSync(path.join(TMP, 'meetings', 'm1.md'), 'notes');

  const originalFetch = installFetch();
  try {
    const out = await dataSync.backupData();
    assert.strictEqual(out.backedUp, true, 'backup ran');
    assert.ok(out.dbBytes > 0, 'DB snapshot pushed');
    assert.strictEqual(out.uploads, 2, 'two uploads fit in the file budget share');
    assert.strictEqual(out.meetings, 0, 'meetings starved before the reserved commit write');
  } finally {
    global.fetch = originalFetch;
  }

  const order = seen.filter(function (s) { return s.method === 'PUT'; }).map(function (s) { return s.url; });
  const BASE = 'https://backup.test/api/backup';
  const lastDb = order.lastIndexOf(BASE + '/db');
  assert.ok(lastDb !== -1, '/db was pushed');
  const lastUpload = Math.max(
    order.lastIndexOf(BASE + '/uploads/u1'),
    order.lastIndexOf(BASE + '/uploads/u2'),
    order.lastIndexOf(BASE + '/uploads/u3'),
    order.lastIndexOf(BASE + '/meetings/m1.md')
  );
  assert.ok(lastUpload < lastDb, 'files were pushed before the /db commit point');
  assert.strictEqual(dataSync.getBackupStatus().writesToday, 3, 'exactly the budgeted 3 writes used');
});

test('orphan sweep never deletes a KV upload referenced by a document', async function () {
  db.prepare(
    "INSERT INTO documents (id, record_row, record_id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at) VALUES ('refdoc', 1, '1', 'ref.png', 'ref.png', 'image/png', 10, 'a@x.com', " + Date.now() + ")"
  ).run();

  const deleted = [];
  const originalFetch = global.fetch;
  global.fetch = async function (url, opts) {
    const u = String(url);
    if (/\/(uploads|meetings)$/.test(u) && (!opts.method || opts.method === 'GET')) {
      return { ok: true, json: async function () {
        return u.indexOf('/uploads') !== -1
          ? { files: ['ref.png', 'orphan.png', 'kept.png'] }
          : { files: [] };
      } };
    }
    if (opts && opts.method === 'DELETE') {
      deleted.push(u);
      return { ok: true, status: 200 };
    }
    return { ok: true, json: async function () { return {}; } };
  };
  try {
    // 'kept.png' is present locally → never swept. 'ref.png' is referenced by a
    // document but missing locally → MUST keep its KV copy. 'orphan.png' is
    // neither → swept.
    fs.mkdirSync(path.join(TMP, 'uploads'), { recursive: true });
    fs.writeFileSync(path.join(TMP, 'uploads', 'kept.png'), Buffer.from('local'));
    await dataSync._runCleanupOrphanedKeysForTest();
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepStrictEqual(deleted, ['https://backup.test/api/backup/uploads/orphan.png'],
    'only the unreferenced orphan is deleted from KV');
});
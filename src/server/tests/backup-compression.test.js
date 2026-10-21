// KV snapshot bandwidth:
//  - the DB is gzipped before the PUT (Render egress is metered);
//  - an unchanged DB is not uploaded again on the next timer tick;
//  - a changed DB is re-uploaded, still gzipped;
//  - restore accepts both gzipped and legacy raw-SQLite snapshots.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const TMP = path.join(os.tmpdir(), 'backup-compression-' + Date.now());
process.env.DASH_DATA_DIR = TMP;
process.env.DASH_UPLOAD_DIR = path.join(TMP, 'uploads');
process.env.DATA_SYNC_URL = 'https://backup.test/api/backup';
process.env.WORKER_API_TOKEN = 'test-token';
process.env.DASH_RETENTION_DAYS = '0';
process.env.DASH_BACKUP_WRITE_BUDGET = '100';
process.env.DASH_MIGRATION_SKIP = '1';

const { db } = require('../db');
const dataSync = require('../data-sync');

let puts = [];
function installFetch() {
  const originalFetch = global.fetch;
  puts = [];
  dataSync._resetDedupeForTest();
  global.fetch = async function (url, opts) {
    const u = String(url);
    const method = (opts && opts.method) || 'GET';
    if (method === 'PUT') {
      puts.push({ url: u, body: opts.body });
      return {
        ok: true,
        status: 200,
        json: async function () { return { ok: true, bytes: opts.body.length }; }
      };
    }
    if (/\/(uploads|meetings)$/.test(u)) {
      return { ok: true, json: async function () { return { files: [] }; } };
    }
    return { ok: true, json: async function () { return {}; } };
  };
  return originalFetch;
}

function dbPuts() {
  return puts.filter(function (p) { return p.url.endsWith('/db'); });
}

test('first snapshot is gzipped and an unchanged cycle skips the DB PUT', async function () {
  const originalFetch = installFetch();
  try {
    const first = await dataSync.backupData();
    assert.strictEqual(first.backedUp, true);
    assert.ok(first.dbBytes > 0, 'raw snapshot size reported');
    assert.ok(first.dbStoredBytes > 0, 'gzipped size reported');
    assert.strictEqual(dbPuts().length, 1, 'first snapshot was uploaded');

    const body = dbPuts()[0].body;
    assert.ok(Buffer.isBuffer(body), 'PUT body is a Buffer');
    assert.strictEqual(body[0], 0x1f, 'gzip magic byte 0');
    assert.strictEqual(body[1], 0x8b, 'gzip magic byte 1');
    const raw = zlib.gunzipSync(body);
    assert.strictEqual(raw.toString('utf8', 0, 15), 'SQLite format 3');
    assert.strictEqual(raw.length, first.dbBytes);

    const before = dataSync.getBackupStatus();
    const second = await dataSync.backupData();
    assert.strictEqual(second.backedUp, true);
    assert.strictEqual(second.skipped, 'unchanged');
    assert.strictEqual(dbPuts().length, 1, 'unchanged snapshot was not re-uploaded');
    const after = dataSync.getBackupStatus();
    assert.strictEqual(after.skippedUnchanged, before.skippedUnchanged + 1);
    assert.ok(after.lastCheckedAt, 'check time is recorded');
    assert.ok(after.lastUploadAt, 'last actual upload is recorded');
  } finally {
    global.fetch = originalFetch;
  }
});

test('a changed DB is re-uploaded with the new rows', async function () {
  const originalFetch = installFetch();
  try {
    await dataSync.backupData();
    assert.strictEqual(dbPuts().length, 1);

    db.exec('CREATE TABLE IF NOT EXISTS dedupe_probe (id INTEGER PRIMARY KEY, v TEXT)');
    db.prepare('INSERT INTO dedupe_probe (v) VALUES (?)').run('changed-' + Date.now());

    const out = await dataSync.backupData();
    assert.strictEqual(out.backedUp, true);
    assert.ok(out.dbBytes > 0);
    assert.strictEqual(dbPuts().length, 2, 'changed snapshot was uploaded');
    const raw = zlib.gunzipSync(dbPuts()[1].body);
    assert.ok(raw.includes(Buffer.from('dedupe_probe')), 'snapshot contains the new table');
  } finally {
    global.fetch = originalFetch;
  }
});

test('snapshot decode accepts gzipped and legacy raw SQLite bytes', function () {
  const raw = Buffer.from('SQLite format 3\u0000legacy snapshot');
  assert.deepStrictEqual(dataSync._decodeSnapshotForTest(zlib.gzipSync(raw)), raw);
  assert.deepStrictEqual(dataSync._decodeSnapshotForTest(raw), raw);
});

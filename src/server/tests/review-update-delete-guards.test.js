// Three guards on the record lifecycle:
//  - updateItem keeps a REVIEW_DONE highlight through routine edits (an
//    explicit flag still wins), so the review colour is not silently reset.
//  - deleting a sheet-origin record mirrors the deletion onto the origin
//    spreadsheet via sync-sheet.deleteSheetRowForRecord_ so a pull can't
//    resurrect it; dashboard-created records are never mirrored.
//  - the "item deleted" staff notification must not deep-link into whatever
//    record inherited the deleted row (recordRow = 0).
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'review-update-delete-guards-'));
process.env.DASH_DATA_DIR = DATA_DIR;
process.env.DASH_IMPORT_DIR = path.join(__dirname, '..', '..', 'data', 'export');
process.env.DASH_IMPORT_SKIP = '1';

const { db } = require('../db');
const records = require('../records');
const sync = require('../sync-sheet');
const { CONFIG } = require('../config');

const START_ROW = 4;

function seedUsers() {
  db.prepare("INSERT OR IGNORE INTO users (email, role, salt, password_hash, must_change, username) VALUES ('a@x.com', 'ADMIN', 'salt', 'x', 0, 'admin')").run();
  db.prepare("INSERT OR IGNORE INTO users (email, role, salt, password_hash, must_change, username) VALUES ('b@x.com', 'ADMIN', 'salt', 'x', 0, 'admin2')").run();
  db.prepare("INSERT OR IGNORE INTO sessions (token, email, created_at, expires_at) VALUES ('tok', 'a@x.com', 0, " + (Date.now() + 3600000) + ")").run();
}

function resetRecords() {
  seedUsers();
  db.prepare('DELETE FROM notifications').run();
  db.prepare('DELETE FROM records').run();
  const now = Date.now();
  const insRec = db.prepare("INSERT INTO records (row, record_id, sector, description, review_bg, source, created_at, updated_at) VALUES (?, ?, 'Sector', ?, ?, ?, ?, ?)");
  insRec.run(START_ROW, 'sheet-uuid', 'Sheet record', CONFIG.COLORS.NORMAL, 'sheet', now, now);
  insRec.run(START_ROW + 1, 'app-uuid', 'App record', CONFIG.COLORS.NORMAL, 'app', now, now);
}

test('updateItem preserves REVIEW_DONE unless explicitly flagged', async function () {
  resetRecords();
  const row = START_ROW;

  await records.markReviewDone(row, 'tok');
  assert.strictEqual(db.prepare('SELECT review_bg FROM records WHERE row = ?').get(row).review_bg, CONFIG.COLORS.REVIEW_DONE);

  // Routine edit, no flag: review state must survive.
  await records.updateItem({ row: row, recordId: 'sheet-uuid', sector: 'Sector', description: 'Edited description' }, 'tok');
  assert.strictEqual(db.prepare('SELECT review_bg FROM records WHERE row = ?').get(row).review_bg, CONFIG.COLORS.REVIEW_DONE, 'REVIEW_DONE survives a routine edit');

  // Explicit flag wins.
  await records.updateItem({ row: row, recordId: 'sheet-uuid', sector: 'Sector', description: 'Edited again', flagged: true }, 'tok');
  assert.strictEqual(db.prepare('SELECT review_bg FROM records WHERE row = ?').get(row).review_bg, CONFIG.COLORS.FLAG, 'explicit flag overrides');
});

test('deleting a sheet-origin record mirrors the row deletion to the sheet', async function () {
  resetRecords();
  const calls = [];
  const original = sync.deleteSheetRowForRecord_;
  sync.deleteSheetRowForRecord_ = async function (row) { calls.push(row); return { deleted: true }; };
  try {
    await records.deleteItem('sheet-uuid', 'tok');
  } finally {
    sync.deleteSheetRowForRecord_ = original;
  }
  assert.deepStrictEqual(calls, [START_ROW], 'sheet-origin delete mirrored to the sheet row');
});

test('deleting a dashboard-created record never touches the sheet', async function () {
  resetRecords();
  const calls = [];
  const original = sync.deleteSheetRowForRecord_;
  sync.deleteSheetRowForRecord_ = async function (row) { calls.push(row); return { deleted: true }; };
  try {
    await records.deleteItem('app-uuid', 'tok');
  } finally {
    sync.deleteSheetRowForRecord_ = original;
  }
  assert.deepStrictEqual(calls, [], 'app-created (source=app) delete is not mirrored');
});

test('delete notification recordRow is 0 so it cannot deep-link to a successor', async function () {
  resetRecords();
  const original = sync.deleteSheetRowForRecord_;
  sync.deleteSheetRowForRecord_ = async function () { return { deleted: false, reason: 'not configured' }; };
  try {
    await records.deleteItem('sheet-uuid', 'tok');
  } finally {
    sync.deleteSheetRowForRecord_ = original;
  }
  const notifs = db.prepare("SELECT title, record_row FROM notifications WHERE title = 'Item deleted'").all();
  assert.ok(notifs.length >= 1, 'staff notified of the deletion (' + notifs.length + ' rows)');
  notifs.forEach(function (n) {
    assert.strictEqual(n.record_row, 0, 'deletion not deep-linked to the renumbered row');
  });
});

test('delete mirror failures do not fail the local delete', async function () {
  resetRecords();
  const original = sync.deleteSheetRowForRecord_;
  sync.deleteSheetRowForRecord_ = async function () { throw new Error('sheets down'); };
  try {
    const data = await records.deleteItem('sheet-uuid', 'tok');
    assert.strictEqual(data.items.length, 1, 'local delete still succeeded');
  } finally {
    sync.deleteSheetRowForRecord_ = original;
  }
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM records').get().n, 1, 'record gone');
});
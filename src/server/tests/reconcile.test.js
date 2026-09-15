const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'reconcile-'));
process.env.DASH_DATA_DIR = DATA_DIR;
process.env.DASH_IMPORT_DIR = path.join(__dirname, '..', '..', 'data', 'export');
process.env.DASH_IMPORT_SKIP = '1';

const { db } = require('../db');
const reconcile = require('../reconcile');

const START_ROW = 4;

function seedAdmin() {
  db.prepare("INSERT OR IGNORE INTO users (email, role, salt, password_hash, must_change, username) VALUES ('a@x.com', 'ADMIN', 'salt', 'x', 0, 'admin')").run();
  db.prepare("INSERT OR IGNORE INTO sessions (token, email, created_at, expires_at) VALUES ('tok', 'a@x.com', 0, ?)").run(Date.now() + 3600000);
}

function resetTables() {
  db.exec('DELETE FROM submissions; DELETE FROM tasks; DELETE FROM documents; DELETE FROM record_changes; DELETE FROM ask_ai_history; DELETE FROM records;');
}

const CANONICAL = [
  { displayId: 1, row: 4, sector: 'S1', description: 'A' },
  { displayId: 2, row: 5, sector: 'S2', description: 'B' },
  { displayId: 3, row: 6, sector: 'S3', description: 'C' },
  { displayId: 4, row: 7, sector: 'S4', description: 'D' }
];

function norm_(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase(); }
function contentKey_(sector, description) { return norm_(sector) + '|' + norm_(description); }

function compactionScenario() {
  seedAdmin();
  resetTables();
  const now = Date.now();
  const insRec = db.prepare('INSERT INTO records (row, sector, description, source, displayed, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)');
  // C (displayId 3) deleted; D shifted from 7 to 6.
  insRec.run(4, 'S1', 'A', 'sheet', now, now);
  insRec.run(5, 'S2', 'B', 'sheet', now, now);
  insRec.run(6, 'S4', 'D', 'sheet', now, now);

  db.prepare('INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)')
    .run('s-ok', 4, '1', 'u@x.com', 'subA', now, now);
  // Pre-gap D sub stuck at old row 7 (C's slot was 6; D shifted 7→6, sub stayed).
  db.prepare('INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)')
    .run('s-pre', 7, '4', 'u@x.com', 'subD-pre', now, now);
  // Orphan: deleted C's old sub still on old row 6.
  db.prepare('INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)')
    .run('s-orph', 6, '3', 'u@x.com', 'subC-orphan', now, now);
  // Beyond canonical (row 8 > last canon row 7): dashboard-created record's sub.
  db.prepare('INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)')
    .run('s-extra', 8, '5', 'u@x.com', 'extra', now, now);

  db.prepare('INSERT INTO tasks (id, record_row, record_id, title, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('t-pre', 7, '4', 'taskD-pre', 'u@x.com', now, now);
  db.prepare('INSERT INTO documents (id, record_row, record_id, file_name, file_key, size, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('d-extra', 8, '5', 'f.pdf', 'fkey', 10, 'u@x.com', now);
  db.prepare('INSERT INTO record_changes (record_row, record_id, changed_by, changed_at, diff) VALUES (?, ?, ?, ?, ?)')
    .run(7, '4', 'u@x.com', now, '{}');
  db.prepare('INSERT INTO ask_ai_history (record_row, history, updated_at) VALUES (?, ?, ?)')
    .run(7, '[{"q":1}]', now);
}

test('reconcileRecordOrder is a strict no-op on a clean canonical DB', async function () {
  seedAdmin();
  resetTables();
  const now = Date.now();
  const insRec = db.prepare('INSERT INTO records (row, sector, description, source, displayed, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)');
  CANONICAL.forEach(function (c) { insRec.run(c.row, c.sector, c.description, 'sheet', now, now); });

  db.prepare('INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)')
    .run('s1', 4, '1', 'u@x.com', 'textA', now, now);

  const plan = await reconcile.reconcileRecordOrder(true, 'tok', CANONICAL);
  assert.ok(plan.success);
  assert.ok(!plan.changed, 'no changes on an aligned DB');
  assert.strictEqual(plan.records.reordered.length, 0, 'no record moves');
  assert.strictEqual(plan.children.submissions.rebound, 0, 'no sub rebinds');
  assert.strictEqual(plan.children.submissions.orphaned, 0, 'no orphans');
});

test('reconcileRecordOrder rebinds pre-gap children, orphans deleted-record children, and leaves beyond-canonical untouched', async function () {
  compactionScenario();

  const plan = await reconcile.reconcileRecordOrder(true, 'tok', CANONICAL);
  assert.ok(plan.success);
  assert.ok(plan.changed, 'plan signals changes');
  assert.deepStrictEqual(plan.records.reordered, [], 'records already dense in canonical order');

  const subs = plan.children.submissions;
  assert.strictEqual(subs.total, 4, 'four submissions total');
  assert.strictEqual(subs.rebound, 1, 'one pre-gap sub re-bound');
  assert.strictEqual(subs.orphaned, 1, 'one orphaned sub removed');
  assert.strictEqual(subs.beyondCanonical, 1, 'one beyond-canonical untouched');
  assert.deepStrictEqual(subs.examples.rebound, [{ id: 's-pre', from: 7, to: 6, displayId: 4 }], 'pre-gap sub moves to D row');
  assert.strictEqual(subs.examples.orphaned[0].id, 's-orph', 'orphan identified');

  assert.deepStrictEqual(
    plan.children.tasks.examples.rebound,
    [{ id: 't-pre', from: 7, to: 6, displayId: 4 }],
    'task pre-gap moves to D row'
  );
  assert.deepStrictEqual(plan.children.documents.examples.orphaned, [], 'extra doc beyond canonical stays untouched');
  assert.deepStrictEqual(
    plan.children.recordChanges.examples.rebound,
    [{ id: '1', from: 7, to: 6, displayId: 4 }],
    'record changes pre-gap moves'
  );
  assert.deepStrictEqual(
    plan.children.askAiHistory.examples.rebound,
    [{ id: '7', from: 7, to: 6, displayId: 4 }],
    'ask-ai history pre-gap moves'
  );
});

test('reconcileRecordOrder reorders scrambled records and moves children to the post-reorder rows', async function () {
  seedAdmin();
  resetTables();
  const now = Date.now();
  const insRec = db.prepare('INSERT INTO records (row, sector, description, source, displayed, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)');
  // Live rows scrambled: A@6, B@4, C@7, D@5 (canonical order is A,B,C,D at 4..7).
  insRec.run(6, 'S1', 'A', 'sheet', now, now);
  insRec.run(4, 'S2', 'B', 'sheet', now, now);
  insRec.run(7, 'S3', 'C', 'sheet', now, now);
  insRec.run(5, 'S4', 'D', 'sheet', now, now);
  // B's pre-gap sub sits at the pre-reorder row 4 (id 2); after the reorder B
  // lands on canonical row 5, so the sub must be re-bound 4→5 via the
  // post-reorder row map.
  db.prepare('INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)')
    .run('sB', 4, '2', 'u@x.com', 'subB', now, now);

  const plan = await reconcile.reconcileRecordOrder(true, 'tok', CANONICAL);
  assert.ok(plan.changed);
  assert.strictEqual(plan.records.reordered.length, 4, 'all four records move to canonical positions');
  assert.deepStrictEqual(
    plan.children.submissions.examples.rebound,
    [{ id: 'sB', from: 4, to: 5, displayId: 2 }],
    'child target computed against post-reorder rows'
  );

  const applied = await reconcile.reconcileRecordOrder(false, 'tok', CANONICAL);
  assert.ok(applied.changed);

  const rows = db.prepare('SELECT row, sector FROM records ORDER BY row ASC').all();
  assert.deepStrictEqual(rows.map(function (r) { return r.sector; }), ['S1', 'S2', 'S3', 'S4']);
  assert.deepStrictEqual(rows.map(function (r) { return r.row; }), [4, 5, 6, 7]);

  const subB = db.prepare('SELECT card_row FROM submissions WHERE id = ?').get('sB');
  assert.strictEqual(subB.card_row, 5, 'sub follows its record to the post-reorder row');

  const second = await reconcile.reconcileRecordOrder(true, 'tok', CANONICAL);
  assert.ok(!second.changed, 'idempotent after apply');
});

test('reconcileRecordOrder applied with dryRun=false writes the changes', async function () {
  compactionScenario();

  const plan = await reconcile.reconcileRecordOrder(false, 'tok', CANONICAL);
  assert.ok(plan.changed);
  assert.strictEqual(plan.dryRun, false);

  // Pre-gap sub now sits on D's live row.
  const subPre = db.prepare('SELECT card_row, card_id FROM submissions WHERE id = ?').get('s-pre');
  assert.strictEqual(subPre.card_row, 6, 'pre-gap sub re-bound to D row');
  assert.strictEqual(subPre.card_id, '4', 'card_id preserved');

  // Orphan gone.
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM submissions WHERE id = ?').get('s-orph').n, 0, 'orphan sub removed');
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n, 3, 'three submissions remain (ok + pre-gap + beyond-canonical)');

  // Extra untouched.
  const extra = db.prepare('SELECT card_row FROM submissions WHERE id = ?').get('s-extra');
  assert.strictEqual(extra.card_row, 8, 'beyond-canonical sub stays at row 8');

  // Task.
  const task = db.prepare('SELECT record_row FROM tasks WHERE id = ?').get('t-pre');
  assert.strictEqual(task.record_row, 6, 'pre-gap task re-bound to D row');

  // record_changes.
  const rc = db.prepare('SELECT record_row FROM record_changes WHERE record_id = ?').get('4');
  assert.strictEqual(rc.record_row, 6, 'record changes re-bound');

  // ask_ai_history.
  const ask = db.prepare('SELECT record_row FROM ask_ai_history').get();
  assert.strictEqual(ask.record_row, 6, 'ask-ai history re-bound');

  // Idempotent: re-run is a no-op.
  const second = await reconcile.reconcileRecordOrder(true, 'tok', CANONICAL);
  assert.ok(!second.changed, 'second run is a no-op');
});
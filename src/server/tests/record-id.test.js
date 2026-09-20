// Part 15: stable record identity. Every record carries a UUID in
// records.record_id that survives the physical-row renumbering that happens
// when a row is deleted. Child tables (tasks, documents, record_changes) are
// anchored to that UUID; record updates and documents/tasks created against a
// record can be addressed by the UUID and land on the right record even after
// rows shift. Numeric inputs remain valid as physical-row contract values but
// uuid inputs take precedence.
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'record-id-'));
process.env.DASH_DATA_DIR = DATA_DIR;
process.env.DASH_IMPORT_DIR = path.join(__dirname, '..', '..', 'data', 'export');
process.env.DASH_IMPORT_SKIP = '1';

const { db } = require('../db');
const records = require('../records');
const documents = require('../documents');
const tasks = require('../tasks');
const { uuid_ } = require('../helpers');

const START_ROW = 4;

// Shared users/sessions (created once); each test re-seeds a pristine 3-record
// table so tests stay order-independent in the single shared scratch DB.
function seedUsers() {
  db.prepare("INSERT INTO users (email, role, salt, password_hash, must_change, username) VALUES ('a@x.com', 'ADMIN', 'salt', 'x', 0, 'admin')").run();
  db.prepare("INSERT INTO sessions (token, email, created_at, expires_at) VALUES ('tok', 'a@x.com', 0, " + (Date.now() + 3600000) + ")").run();
}

function resetRecords() {
  ['submissions', 'tasks', 'documents', 'record_changes', 'ask_ai_history'].forEach(function (t) {
    db.prepare('DELETE FROM ' + t).run();
  });
  db.prepare('DELETE FROM records').run();

  const now = Date.now();
  // Production insert paths (addRecord_/sync/import/seed) stamp record_id with
  // a UUID; mirror that here so the test exercises the real write contract.
  const insRec = db.prepare('INSERT INTO records (row, record_id, sector, description, source, displayed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)');
  ['Alpha', 'Beta', 'Gamma'].forEach(function (name, i) {
    insRec.run(START_ROW + i, uuid_(), 'Sector', name, 'app', now, now);
  });
}

function items() {
  return records.buildItems(db.prepare('SELECT * FROM records ORDER BY row ASC').all());
}

function recUuid_(desc) {
  return String(db.prepare('SELECT record_id FROM records WHERE description = ?').get(desc).record_id);
}

seedUsers();

test('every record carries a unique record_id UUID', function () {
  resetRecords();
  const rows = db.prepare('SELECT row, record_id FROM records ORDER BY row ASC').all();
  assert.strictEqual(rows.length, 3);
  rows.forEach(function (r) {
    assert.ok(r.record_id && r.record_id.length > 20, 'every record has a UUID');
  });
  const ids = rows.map(function (r) { return r.record_id; });
  assert.strictEqual(new Set(ids).size, 3, 'UUIDs are unique');
});

test('record_id survives delete+renumber while the physical row moves', async function () {
  resetRecords();
  const gammaRow = db.prepare('SELECT row FROM records WHERE description = ?').get('Gamma').row;
  const gammaUuid = recUuid_('Gamma');

  // Delete Beta (the record above Gamma) through the real path, which runs the
  // dataRenumber_ sweep: Gamma shifts up one row.
  await records.deleteItem(gammaRow - 1, 'tok');

  const gammaAfter = items().find(function (i) { return i.description === 'Gamma'; });
  assert.strictEqual(Number(gammaAfter.row), gammaRow - 1, 'Gamma physically moved up (renumbering happened)');
  assert.strictEqual(String(gammaAfter.recordId), gammaUuid, 'the UUID survived renumbering unchanged');
});

test('updateRecord_ resolves by recordId UUID even after rows shift', async function () {
  resetRecords();
  const item = items().find(function (i) { return i.description === 'Gamma'; });
  const originalRow = Number(item.row);
  const uuid = String(item.recordId);

  // Delete both records above Gamma through the real path so Gamma shifts up.
  // Addressed by UUID so the deletions stay correct as rows renumber.
  await records.deleteItem(recUuid_('Alpha'), 'tok');
  await records.deleteItem(recUuid_('Beta'), 'tok');

  const gammaAfter = items().find(function (i) { return i.description === 'Gamma'; });
  assert.notStrictEqual(Number(gammaAfter.row), originalRow, 'Gamma physically moved during renumbering');
  assert.strictEqual(String(gammaAfter.recordId), uuid, 'UUID unchanged across renumbering');

  // Address the record purely by UUID; the old physical row no longer exists.
  const updated = await records.updateItem({ recordId: uuid, sector: 'Renamed Sector' }, 'tok');
  const gamma = updated.items.find(function (i) { return String(i.recordId) === uuid; });
  assert.strictEqual(gamma.sector, 'Renamed Sector', 'update by UUID landed on the right record');
  assert.strictEqual(String(gamma.recordId), uuid, 'the returned item still carries the same UUID');
});

test('uploadDocument and getRecordDocuments resolve by recordId UUID', async function () {
  resetRecords();
  const item = items().find(function (i) { return i.description === 'Gamma'; });
  const uuid = String(item.recordId);
  const row = Number(item.row);

  const uploaded = await documents.uploadDocument(row, uuid, 'proof.pdf', Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==').toString('base64'), 'application/pdf', 'tok');
  assert.ok(uploaded.id, 'document uploaded against the record UUID');

  const byUuid = documents.getRecordDocuments(uuid, 'tok');
  assert.strictEqual(byUuid.length, 1, 'UUID-keyed lookup finds the document');
  assert.strictEqual(String(byUuid[0].recordId), uuid, 'stored record_id is the stable UUID, not a numeric row string');
  // The address-by-row form still works as the legacy row-keyed contract.
  assert.strictEqual(documents.getRecordDocuments(row, 'tok').length, 1, 'row-keyed lookup finds the same document');
});

test('createTask anchors the task to the record recordId UUID, not a numeric id', async function () {
  resetRecords();
  const item = items().find(function (i) { return i.description === 'Gamma'; });
  const uuid = String(item.recordId);

  const task = await tasks.createTask({ title: 'Follow up', recordRow: Number(item.row), recordId: uuid, assignee: 'a@x.com', priority: 'MEDIUM' }, 'tok');
  assert.strictEqual(String(task.recordId), uuid, 'created task stores the record UUID');
  assert.strictEqual(Number(task.recordRow), Number(item.row), 'task stays on the record’s physical row too');

  const stored = db.prepare('SELECT record_id FROM tasks WHERE id = ?').get(task.id);
  assert.strictEqual(String(stored.record_id), uuid, 'DB row shows the stable UUID anchored to the record');

  // Address the record by UUID with a deliberately stale/no-longer-valid row:
  // the UUID must win and land the task on the record's real (current) row.
  const staleRow = Number(item.row) + 50;
  const after = await tasks.createTask({ title: 'Second follow up', recordRow: staleRow, recordId: uuid, assignee: 'a@x.com', priority: 'LOW' }, 'tok');
  assert.strictEqual(String(after.recordId), uuid, 'task created by UUID is still anchored to the record');
  assert.strictEqual(Number(after.recordRow), Number(item.row), 'UUID resolution overrode the stale row argument');
});
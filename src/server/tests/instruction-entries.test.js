// Last-meeting-instruction entries: the field behaves like a card update —
// dated text entries with timestamp + office, optional attachments, editable by
// admins/editors (viewers rejected). Every mutation recomputes
// records.last_meeting_instructions as the joined entry text (newest first) so
// cards, slides and print keep reading the plain column.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), 'instruction-entries-' + Date.now());
process.env.DASH_DATA_DIR = TMP;
process.env.DASH_IMPORT_DIR = path.join(__dirname, '..', '..', 'data', 'export');
process.env.DASH_IMPORT_SKIP = '1';

const { db } = require('../db');
const entries = require('../instruction-entries');
const documents = require('../documents');

function seed() {
  const now = Date.now();
  const exp = now + 3600000;
  db.exec('DELETE FROM users; DELETE FROM sessions; DELETE FROM records; DELETE FROM instruction_entries; DELETE FROM instruction_attachments;');
  db.prepare("INSERT INTO users (email, role, salt, password_hash, must_change, username, office) VALUES ('admin@x.com','ADMIN','s','h',0,'a','Admin Office')").run();
  db.prepare("INSERT INTO users (email, role, salt, password_hash, must_change, username, office) VALUES ('viewer@x.com','VIEWER','s','h',0,'v','Viewer')").run();
  db.prepare("INSERT INTO users (email, role, salt, password_hash, must_change, username, office) VALUES ('editor@x.com','EDITOR','s','h',0,'e','North Division')").run();
  db.prepare('INSERT INTO sessions (token, email, created_at, expires_at) VALUES (?, ?, 0, ?)').run('admintok', 'admin@x.com', exp);
  db.prepare('INSERT INTO sessions (token, email, created_at, expires_at) VALUES (?, ?, 0, ?)').run('editortok', 'editor@x.com', exp);
  db.prepare('INSERT INTO sessions (token, email, created_at, expires_at) VALUES (?, ?, 0, ?)').run('viewertok', 'viewer@x.com', exp);
  db.prepare('INSERT INTO records (row, sector, description, source, displayed, last_meeting_instructions, created_at, updated_at) VALUES (4, ?, ?, ?, 1, ?, ?, ?)')
    .run('Sector A', 'Record 1', 'app', '', now, now);
}

test('viewers cannot read instruction entries', function () {
  seed();
  assert.throws(function () { entries.getInstructionEntries(4, 'viewertok'); }, /permission required/i);
});

test('add appends an entry and mirrors it onto records.last_meeting_instructions', async function () {
  seed();
  const list = await entries.addInstructionEntry(4, 'R1', 'Call the division offices', null, 'editortok');
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].text, 'Call the division offices');
  assert.strictEqual(list[0].office, 'North Division', 'office resolved from the user row');
  assert.strictEqual(list[0].email, 'editor@x.com');
  assert.ok(list[0].createdAt, 'formatted timestamp present');
  const rec = db.prepare("SELECT last_meeting_instructions FROM records WHERE row = 4").get();
  assert.strictEqual(rec.last_meeting_instructions, 'Call the division offices', 'column mirrors the entry');
});

test('aggregate is newest-first, empty set clears the column', async function () {
  seed();
  const old = Date.now() - 60000;
  db.prepare('INSERT INTO instruction_entries (id, card_row, card_id, email, text, created_at, updated_at) VALUES (?, 4, ?, ?, ?, ?, ?)')
    .run('old1', 'R1', 'editor@x.com', 'older instruction', old, old);
  await entries.addInstructionEntry(4, 'R1', 'newer instruction', null, 'admintok');
  const rec = db.prepare("SELECT last_meeting_instructions FROM records WHERE row = 4").get();
  assert.strictEqual(rec.last_meeting_instructions, 'newer instruction\n\nolder instruction', 'newest entry on top');
  await entries.deleteInstructionEntry('old1', 'editortok');
  const rec2 = db.prepare("SELECT last_meeting_instructions FROM records WHERE row = 4").get();
  assert.strictEqual(rec2.last_meeting_instructions, 'newer instruction', 'recomputed after delete');
  const remaining = db.prepare("SELECT id FROM instruction_entries WHERE id != 'old1' ORDER BY created_at DESC").get();
  await entries.deleteInstructionEntry(remaining.id, 'editortok');
  const rec3 = db.prepare("SELECT last_meeting_instructions FROM records WHERE row = 4").get();
  assert.strictEqual(rec3.last_meeting_instructions, '', 'cleared when the last entry goes');
});

test('update edits the entry text and recomputes the column', async function () {
  seed();
  const added = await entries.addInstructionEntry(4, 'R1', 'original text', null, 'editortok');
  assert.throws(function () { entries.updateInstructionEntry(added[0].id, '', null, 'editortok'); }, /Write the instructions/i);
  const updated = await entries.updateInstructionEntry(added[0].id, 'corrected text', null, 'admintok');
  assert.strictEqual(updated[0].text, 'corrected text');
  const rec = db.prepare("SELECT last_meeting_instructions FROM records WHERE row = 4").get();
  assert.strictEqual(rec.last_meeting_instructions, 'corrected text');
});

test('attachment round-trips through the shared /files resolver', async function () {
  seed();
  const b64 = Buffer.from('hello instructions').toString('base64');
  const list = await entries.addInstructionEntry(4, 'R1', 'with a file', {
    fileName: 'minutes.txt',
    mimeType: 'text/plain',
    base64: b64
  }, 'editortok');
  assert.strictEqual(list[0].attachments.length, 1);
  const att = list[0].attachments[0];
  assert.strictEqual(att.fileName, 'minutes.txt');
  const resolved = documents.resolveDocumentFile(att.fileKey, 'editortok');
  assert.ok(resolved && resolved.path, 'attachment resolves on disk');
  assert.strictEqual(resolved.meta.isInstructionAttachment, true, 'tagged as an instruction attachment');
  assert.strictEqual(fs.readFileSync(resolved.path, 'utf8'), 'hello instructions');

  await entries.deleteInstructionEntry(list[0].id, 'admintok');
  assert.strictEqual(fs.existsSync(path.join(TMP, 'uploads', att.fileKey)), false, 'file removed from disk');
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM instruction_attachments').get().n, 0);
});

test('delete entry requires editor role and removes the row', async function () {
  seed();
  const added = await entries.addInstructionEntry(4, 'R1', 'do something', null, 'admintok');
  assert.throws(function () { entries.deleteInstructionEntry(added[0].id, 'viewertok'); }, /permission required/i);
  const list = await entries.deleteInstructionEntry(added[0].id, 'editortok');
  assert.strictEqual(list.length, 0);
});
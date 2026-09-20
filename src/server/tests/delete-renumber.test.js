// Regression: deleting a middle record (record #17, sheet row 20) must
// renumber the records table with no gaps AND remap every child table keyed by
// the old row number (submissions.card_row, tasks.record_row,
// documents.record_row, record_changes.record_row, ask_ai_history.record_row)
// so updates/tasks/documents never silently attach to the wrong record after
// the rows below the deletion shift up. The deleted record's own child rows
// must be cascade-deleted, never remapped onto its successor.
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'delete-renumber-'));
process.env.DASH_DATA_DIR = DATA_DIR;
process.env.DASH_IMPORT_DIR = path.join(__dirname, '..', '..', 'data', 'export');
process.env.DASH_IMPORT_SKIP = '1';

const { db } = require('../db');
const records = require('../records');

const START_ROW = 4;               // CONFIG.SHEET.START_ROW
const COUNT = 20;                  // records #1..#20 → rows 4..23
const TARGET = 17;                 // record #17 → row 20
const TARGET_ROW = START_ROW + TARGET - 1;

function seed() {
  db.prepare("INSERT INTO users (email, role, salt, password_hash, must_change, username) VALUES ('a@x.com', 'ADMIN', 'salt', 'x', 0, 'admin')").run();
  db.prepare("INSERT INTO sessions (token, email, created_at, expires_at) VALUES ('tok', 'a@x.com', 0, " + (Date.now() + 3600000) + ")").run();

  const now = Date.now();
  const insRec = db.prepare('INSERT INTO records (row, sector, description, source, displayed, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)');
  for (let i = 0; i < COUNT; i++) {
    const row = START_ROW + i;
    insRec.run(row, 'Sector', 'Record ' + (i + 1), 'app', now, now);
  }

  const insSub = db.prepare(
    "INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed, read_at) VALUES (?, ?, ?, 'u@x.com', ?, ?, ?, 1, 0)"
  );
  function sub(id, row, text) { insSub.run(id, row, 'r' + row, text, now, now); }
  sub('s-a', START_ROW, 'keep bottom');
  sub('s-b', TARGET_ROW - 1, 'keep below');            // record #16 stays
  sub('s-c', TARGET_ROW, 'delete me 1');               // record #17 - gone
  sub('s-d', TARGET_ROW, 'delete me 2');               // record #17 - gone
  sub('s-e', TARGET_ROW + 1, 'shift down part a');     // record #18 → 17
  sub('s-f', TARGET_ROW + 1, 'shift down part b');     // record #18 → 17
  sub('s-g', TARGET_ROW + 2, 'shift down');            // record #19 → 18
  sub('s-h', TARGET_ROW + 3, 'shift down');            // record #20 → 19

  const insTask = db.prepare("INSERT INTO tasks (id, record_row, record_id, title, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'u@x.com', ?, ?)");
  insTask.run('t-below', TARGET_ROW - 1, 'r' + (TARGET_ROW - 1), 'below task', now, now);
  insTask.run('t-above', TARGET_ROW + 1, 'r' + (TARGET_ROW + 1), 'above task', now, now);

  const insDoc = db.prepare("INSERT INTO documents (id, record_row, record_id, file_name, file_key, size, uploaded_by, uploaded_at) VALUES (?, ?, ?, 'f.pdf', ?, 10, 'u@x.com', ?)");
  insDoc.run('d-above', TARGET_ROW + 2, 'r' + (TARGET_ROW + 2), 'dk-above', now);

  const insChange = db.prepare("INSERT INTO record_changes (record_row, record_id, changed_by, changed_at, diff) VALUES (?, ?, 'u@x.com', ?, '{}')");
  insChange.run(TARGET_ROW + 1, 'r' + (TARGET_ROW + 1), now);

  const insInstr = db.prepare("INSERT INTO instruction_entries (id, card_row, card_id, email, text, created_at, updated_at) VALUES (?, ?, ?, 'u@x.com', ?, ?, ?)");
  insInstr.run('i-below', TARGET_ROW - 1, 'r' + (TARGET_ROW - 1), 'keep below instr', now, now);
  insInstr.run('i-gone', TARGET_ROW, 'r' + TARGET_ROW, 'delete me instr', now, now);
  insInstr.run('i-shift', TARGET_ROW + 1, 'r' + (TARGET_ROW + 1), 'shift down instr', now, now);

  const insAsk = db.prepare("INSERT INTO ask_ai_history (record_row, history, updated_at) VALUES (?, '[{\"q\":1}]', ?)");
  insAsk.run(TARGET_ROW + 3, now);
}

test('deleting record #17 remaps submissions and child rows to the renumbered records', async function () {
  seed();
  const appData = await records.deleteItem(TARGET_ROW, 'tok');

  // Records are contiguous again with no gaps; row 20 now holds the record
  // that shifted down (#18), while #17 itself is gone for good.
  const rows = db.prepare('SELECT row FROM records ORDER BY row ASC').all().map(function (r) { return r.row; });
  assert.strictEqual(rows.length, COUNT - 1);
  rows.forEach(function (r, i) { assert.strictEqual(r, START_ROW + i, 'no gaps, contiguous rows'); });
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM records WHERE description = ?').get('Record 17').n, 0, 'deleted record no longer exists');

  // The appData payload reflects the shifted numbering (record #18 → #17).
  assert.strictEqual(appData.items.length, COUNT - 1);
  const shifted = appData.items.find(function (i) { return Number(i.row) === TARGET_ROW; });
  assert.ok(shifted, 'former record #18 now occupies row 20');
  assert.strictEqual(shifted.id, TARGET, 'former #18 renumbered to #17');
  assert.strictEqual(shifted.description, 'Record 18', 'correct record survives the renumber');

  // The deleted record's submissions are gone; the others follow their rows.
  const subRows = db.prepare('SELECT card_row FROM submissions ORDER BY card_row ASC').all().map(function (s) { return s.card_row; });
  assert.strictEqual(subRows.length, 6, 'the two submissions of the deleted record were cascade-deleted');
  assert.deepStrictEqual(subRows, [START_ROW, TARGET_ROW - 1, TARGET_ROW, TARGET_ROW, TARGET_ROW + 1, TARGET_ROW + 2]);
  const deleted = db.prepare('SELECT COUNT(*) AS n FROM submissions WHERE card_row = ?').get(TARGET_ROW);
  assert.strictEqual(deleted.n, 2, 'submissions survived on the renumbered record #17');
  const deletedText = db.prepare('SELECT text FROM submissions WHERE card_row = ? ORDER BY id').all(TARGET_ROW).map(function (s) { return s.text; });
  assert.deepStrictEqual(deletedText, ['shift down part a', 'shift down part b'], 'they are the old #18 submissions, not the deleted ones');

  // Tasks, documents, change history and AI history follow children too.
  const taskRows = db.prepare('SELECT record_row FROM tasks ORDER BY record_row').all().map(function (t) { return t.record_row; });
  assert.deepStrictEqual(taskRows, [TARGET_ROW - 1, TARGET_ROW]);
  const docRow = db.prepare('SELECT record_row FROM documents').get();
  assert.strictEqual(docRow.record_row, TARGET_ROW + 1, 'documents shifted down with their record');
  const changeRow = db.prepare('SELECT record_row FROM record_changes').get();
  assert.strictEqual(changeRow.record_row, TARGET_ROW, 'change history shifted down with its record');
  const askRow = db.prepare('SELECT record_row FROM ask_ai_history').get();
  assert.strictEqual(askRow.record_row, TARGET_ROW + 2, 'ask-AI history shifted down with its record');

  // Instruction entries follow their records too: the deleted record's entry
  // is gone, the one above is cascade-deleted with it, the one below survives
  // and the one above the deletion shifts down with its record.
  const instrRows = db.prepare('SELECT card_row FROM instruction_entries ORDER BY card_row ASC').all().map(function (e) { return e.card_row; });
  assert.deepStrictEqual(instrRows, [TARGET_ROW - 1, TARGET_ROW], 'instruction entry below survived, deleted-record entry cascade-deleted');
  const instrShifted = db.prepare('SELECT text FROM instruction_entries WHERE card_row = ?').get(TARGET_ROW);
  assert.strictEqual(instrShifted.text, 'shift down instr', 'instruction entry followed the renumbered record');

  // The submission overview returned to the client is already remapped, so the
  // card badges/update lines point at the right records.
  const counts = appData.submissionCounts;
  assert.deepStrictEqual(counts, {
    [START_ROW]: 1,
    [TARGET_ROW - 1]: 1,
    [TARGET_ROW]: 2,
    [TARGET_ROW + 1]: 1,
    [TARGET_ROW + 2]: 1
  });
  const shown = appData.displayedSubmissions;
  assert.ok(shown.some(function (s) { return s.cardRow === TARGET_ROW && s.text === 'shift down part a'; }), 'overview shows the survivor submissions under the new row');
  assert.ok(!shown.some(function (s) { return s.text === 'delete me 1' || s.text === 'delete me 2'; }), 'deleted record submissions are not displayed');
});
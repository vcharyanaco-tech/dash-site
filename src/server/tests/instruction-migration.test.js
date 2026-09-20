// One-time boot migration: admin-authored, on-card submissions are shifted
// into instruction entries (newest first) and the submission rows + their
// attachment files are deleted. Runs exactly once per database (settings
// flag). Reproduced here in two child node processes because the migration
// executes when db.js is first required: child A creates+seeds the DB fresh,
// child B re-opens it in a new process so the guarded migration actually runs.
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SRV = path.join(__dirname, '..');

const MIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'instruction-migration-'));
const SCRIPT_A = [
  'const path=require("path");',
  'const dir=process.env.MIG_DIR;',
  'process.env.DASH_DATA_DIR=dir;',
  'require("./db");',
  'const Database=require("better-sqlite3");',
  'const d2=new Database(path.join(dir,"dashboard.db"));',
  "d2.prepare(\"DELETE FROM settings WHERE key='MIGRATION_ADMIN_UPDATES_SHIFTED'\").run();",
  "d2.prepare(\"INSERT INTO users (email, role, salt, password_hash, must_change, username) VALUES ('boss@x.com','ADMIN','s','h',0,'boss')\").run();",
  "d2.prepare(\"INSERT INTO records (row, sector, description, source, displayed, last_meeting_instructions, created_at, updated_at) VALUES (4,'S','desc','sheet',1,'existing guidance',1,1)\").run();",
  "d2.prepare(\"INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed, read_at) VALUES ('sa',4,'','boss@x.com','admin update A',1000,1000,1,1000)\").run();",
  "d2.prepare(\"INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed, read_at) VALUES ('sb',4,'','boss@x.com','admin update B',2000,2000,1,2000)\").run();",
  "d2.prepare(\"INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed, read_at) VALUES ('sv',4,'','other@x.com','viewer update stays',3000,3000,1,3000)\").run();",
  'd2.close();'
].join('\n');

const SCRIPT_B = [
  'const process2=process;',
  'process2.env.DASH_DATA_DIR=process2.env.MIG_DIR;',
  'require("./db");',
  'const { db } = require("./db");',
  'const out = {',
  "  subs: db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n,",
  "  subIds: db.prepare('SELECT id FROM submissions ORDER BY created_at').all().map(function (r) { return r.id; }),",
  "  flags: db.prepare(\"SELECT value FROM settings WHERE key='MIGRATION_ADMIN_UPDATES_SHIFTED'\").get(),",
  "  entries: db.prepare('SELECT text FROM instruction_entries WHERE card_row = 4 ORDER BY created_at ASC').all().map(function (r) { return r.text; }),",
  "  column: db.prepare('SELECT last_meeting_instructions FROM records WHERE row = 4').get().last_meeting_instructions",
  '};',
  'console.log(JSON.stringify(out));'
].join('\n');

test('boot migration shifts admin displayed submissions into instructions and deletes them', function () {
  execFileSync(process.execPath, ['-e', SCRIPT_A], {
    cwd: SRV,
    env: Object.assign({}, process.env, { DASH_DATA_DIR: MIG_DIR, MIG_DIR: MIG_DIR })
  });

  const raw = execFileSync(process.execPath, ['-e', SCRIPT_B], {
    cwd: SRV,
    env: Object.assign({}, process.env, { DASH_DATA_DIR: MIG_DIR, MIG_DIR: MIG_DIR }),
    encoding: 'utf8'
  });
  const out = JSON.parse(raw.trim().split('\n').pop());

  assert.strictEqual(out.subs, 1, 'admin submissions deleted, viewer submission survives');
  assert.deepStrictEqual(out.subIds, ['sv'], 'only the viewer submission remains');
  assert.ok(out.flags, 'run-once settings flag recorded');
  assert.deepStrictEqual(
    out.entries,
    ['existing guidance', 'admin update A', 'admin update B'],
    'existing guidance preserved as the oldest entry, admin updates converted with their timestamps'
  );
  assert.strictEqual(
    out.column,
    'admin update B\n\nadmin update A\n\nexisting guidance',
    'records.last_meeting_instructions = joined entries, newest first'
  );
});
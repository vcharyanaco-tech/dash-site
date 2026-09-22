#!/usr/bin/env node
/**
 * Part 19 (CI): boot the server DB layer against a throwaway data dir and
 * assert that schema.sql + every idempotent migration landed. A second boot on
 * the same dir proves the migrations re-run safely, which is the actual deploy
 * path for the persistent volume (they run on every server start).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-migrations-'));

const EXPECTED_TABLES = [
  'records', 'users', 'submissions', 'tasks', 'notifications', 'audit',
  'audit_archive', 'documents', 'sessions', 'login_attempts', 'settings',
  'ai_cache', 'dedupe', 'ask_ai_history', 'record_changes',
  'submission_attachments', 'instruction_entries', 'instruction_attachments'
];
const EXPECTED_COLUMNS = {
  submissions: ['read_at'],
  records: ['source', 'displayed', 'record_id', 'last_meeting_instructions'],
  users: ['divisional_dashboard_url'],
  tasks: ['record_id'],
  documents: ['keep', 'record_id'],
  record_changes: ['record_id'],
  notifications: ['priority', 'record_row', 'snoozed_until', 'dismissed_at', 'group_key']
};
const EXPECTED_INDEXES = [
  'idx_users_email_unique', 'idx_users_username', 'idx_records_record_id', 'idx_users_dashboard_url',
  'idx_instruction_entries_card_row', 'idx_instruction_attachments_entry'
];

// Columns added by db.js migrations after schema.sql. A legacy restored DB
// (Render free-tier: the KV snapshot predates these) lacks them, so booting
// must add them without crashing — that upgrade path is what actually broke
// deploys and is exercised by the legacy phase below.
const MIGRATED_COLUMNS = [
  ['submissions', 'read_at'],
  ['records', 'source'], ['records', 'displayed'], ['records', 'record_id'],
  ['records', 'last_meeting_instructions'],
  ['users', 'divisional_dashboard_url'],
  ['tasks', 'record_id'], ['documents', 'keep'], ['documents', 'record_id'],
  ['record_changes', 'record_id'],
  ['notifications', 'priority'], ['notifications', 'record_row'],
  ['notifications', 'snoozed_until'], ['notifications', 'dismissed_at'],
  ['notifications', 'group_key']
];

const env = Object.assign({}, process.env, {
  DASH_DATA_DIR: dir,
  DASH_UPLOAD_DIR: path.join(dir, 'uploads')
});

function boot() {
  execFileSync(process.execPath, ['-e', "require('./src/server/db.js')"], { cwd: ROOT, env, stdio: 'inherit' });
}

// Turn the freshly-migrated DB back into a pre-migration shape so the next
// boot has to re-run every migration against existing tables (the persistent
// volume / KV-restore path), not just CREATE TABLE IF NOT EXISTS.
function stripToLegacy() {
  const Database = require(path.join(ROOT, 'src', 'server', 'node_modules', 'better-sqlite3'));
  const db = new Database(path.join(dir, 'dashboard.db'));
  db.exec('DROP INDEX IF EXISTS idx_records_record_id');
  db.exec('DROP INDEX IF EXISTS idx_users_dashboard_url');
  MIGRATED_COLUMNS.forEach(function (d) {
    const have = new Set(db.prepare('PRAGMA table_info(' + d[0] + ')').all().map(function (c) { return c.name; }));
    if (have.has(d[1])) db.exec('ALTER TABLE ' + d[0] + ' DROP COLUMN ' + d[1]);
  });
  db.close();
}

function assertSchema(label) {
  const Database = require(path.join(ROOT, 'src', 'server', 'node_modules', 'better-sqlite3'));
  const db = new Database(path.join(dir, 'dashboard.db'), { readonly: true });
  const problems = [];

  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(function (r) { return r.name; }));
  EXPECTED_TABLES.forEach(function (t) { if (!tables.has(t)) problems.push('missing table ' + t); });

  Object.keys(EXPECTED_COLUMNS).forEach(function (table) {
    const have = new Set(db.prepare('PRAGMA table_info(' + table + ')').all().map(function (c) { return c.name; }));
    EXPECTED_COLUMNS[table].forEach(function (c) { if (!have.has(c)) problems.push('missing column ' + table + '.' + c); });
  });

  const indexes = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map(function (r) { return r.name; }));
  EXPECTED_INDEXES.forEach(function (i) { if (!indexes.has(i)) problems.push('missing index ' + i); });

  db.close();

  if (problems.length) {
    console.error('\n' + label + ' FAILED: ' + problems.join('; '));
    process.exit(1);
  }
  console.log(label + ': ' + EXPECTED_TABLES.length + ' tables, ' +
    Object.values(EXPECTED_COLUMNS).reduce(function (a, c) { return a + c.length; }, 0) +
    ' migrated columns, ' + EXPECTED_INDEXES.length + ' indexes OK');
}

try {
  boot();
  assertSchema('fresh boot');
  boot();
  assertSchema('re-boot (idempotency)');
  stripToLegacy();
  boot();
  assertSchema('legacy upgrade (pre-migration schema restored, then booted)');
  console.log('\nDB migrations OK');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

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
  'ai_cache', 'dedupe', 'ask_ai_history', 'record_changes'
];
const EXPECTED_COLUMNS = {
  submissions: ['read_at'],
  records: ['source', 'displayed'],
  documents: ['keep'],
  notifications: ['priority', 'record_row']
};
const EXPECTED_INDEXES = ['idx_users_email_unique', 'idx_users_username'];

const env = Object.assign({}, process.env, {
  DASH_DATA_DIR: dir,
  DASH_UPLOAD_DIR: path.join(dir, 'uploads')
});

function boot() {
  execFileSync(process.execPath, ['-e', "require('./src/server/db.js')"], { cwd: ROOT, env, stdio: 'inherit' });
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
  console.log('\nDB migrations OK');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

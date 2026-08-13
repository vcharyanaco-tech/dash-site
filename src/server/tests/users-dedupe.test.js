/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/users-dedupe.test.js
 * Unit tests for the boot-time migrations in db.js:
 *  - users.email has no UNIQUE constraint, so a repeated CSV import
 *    (INSERT OR IGNORE) appends a fresh copy of every user on each boot.
 *    The boot migration keeps the earliest row per normalized email and
 *    locks the column down so future imports skip existing accounts.
 *  - submissions.read_at (admin-read marker) is added to older DBs and
 *    existing rows are backfilled as already read.
 *
 * Runs entirely against in-memory databases shaped like the pre-migration
 * schema, so the real data/dashboard.db is never touched. Run: npm test
 * ============================================================
 */

const { test } = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');

// Shape of the users table before the boot migration (no unique email index).
const OLD_USERS_SQL = `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'VIEWER',
    salt TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL DEFAULT '',
    must_change INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL DEFAULT '',
    created_at INTEGER,
    reset_token TEXT NOT NULL DEFAULT '',
    reset_expires INTEGER,
    group_name TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    office TEXT NOT NULL DEFAULT '',
    preferences TEXT NOT NULL DEFAULT '',
    reset_requested TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL DEFAULT ''
  )`;

// Shape of the submissions table before the read_at migration.
const OLD_SUBMISSIONS_SQL = `
  CREATE TABLE submissions (
    id TEXT PRIMARY KEY,
    card_row INTEGER NOT NULL DEFAULT 0,
    card_id TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL DEFAULT '',
    created_at INTEGER,
    updated_at INTEGER,
    locked_by TEXT NOT NULL DEFAULT '',
    locked_at INTEGER,
    displayed INTEGER NOT NULL DEFAULT 0
  )`;

test('users dedupe keeps the earliest row per normalized email', function () {
  const db = new Database(':memory:');
  db.exec(OLD_USERS_SQL);

  // Simulate the rows a persistent volume accumulates when the CSV import
  // runs once per boot without a unique email constraint.
  const ins = db.prepare('INSERT INTO users (email, role) VALUES (?, ?)');
  ins.run('dup@example.com', 'ADMIN');
  ins.run('dup@example.com', 'VIEWER');
  ins.run('DUP@example.com', 'EDITOR');
  ins.run('  dup@example.com  ', 'EDITOR');
  assert.strictEqual(
    db.prepare("SELECT COUNT(*) c FROM users WHERE lower(trim(email)) = 'dup@example.com'").get().c,
    4
  );

  // Same statements db.js runs on boot.
  db.exec(
    'DELETE FROM users WHERE id NOT IN (' +
    '  SELECT MIN(id) FROM users GROUP BY lower(trim(email))' +
    ')'
  );
  db.exec('DROP INDEX IF EXISTS idx_users_email_unique');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(lower(trim(email)))');

  const rows = db.prepare("SELECT id, role FROM users WHERE lower(trim(email)) = 'dup@example.com'").all();
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].role, 'ADMIN'); // earliest row wins

  // The unique index makes future INSERT OR IGNORE imports skip the account.
  const before = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  db.prepare('INSERT OR IGNORE INTO users (email, role) VALUES (?, ?)').run('dup@example.com', 'VIEWER');
  db.prepare('INSERT OR IGNORE INTO users (email, role) VALUES (?, ?)').run('  DUP@example.com  ', 'EDITOR');
  assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM users').get().c, before);
});

test('read_at migration adds the column and backfills history as read', function () {
  const db = new Database(':memory:');
  db.exec(OLD_SUBMISSIONS_SQL);

  const created = 1700000000000;
  db.prepare(
    'INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, locked_by, locked_at, displayed) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run('old-1', 4, 'card-1', 'a@x.com', 'history', created, created, '', null, 0);

  // Same migration db.js runs for DBs that predate the column.
  const subCols = db.prepare('PRAGMA table_info(submissions)').all();
  assert.ok(!subCols.some(function (c) { return String(c.name) === 'read_at'; }));
  db.exec('ALTER TABLE submissions ADD COLUMN read_at INTEGER NOT NULL DEFAULT 0');
  db.exec('UPDATE submissions SET read_at = COALESCE(created_at, 0)');

  // Existing history is backfilled as read, so it does not flash.
  const rec = db.prepare("SELECT read_at FROM submissions WHERE id = 'old-1'").get();
  assert.strictEqual(rec.read_at, created);

  // New submissions (column omitted from INSERT) default to read_at = 0 and
  // flash until an admin reads the card.
  db.prepare(
    'INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, locked_by, locked_at, displayed) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run('new-1', 5, 'card-2', 'b@x.com', 'fresh', Date.now(), Date.now(), '', null, 0);
  const fresh = db.prepare("SELECT read_at FROM submissions WHERE id = 'new-1'").get();
  assert.strictEqual(fresh.read_at, 0);
});

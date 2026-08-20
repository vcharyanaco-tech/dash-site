/**
 * ============================================================
 * India Post Dashboard — Node port
 * db.js
 * better-sqlite3 connection, schema bootstrap and cross-cutting
 * store helpers (sessions, script cache replacement, dedupe keys).
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const { CONFIG } = require('./config');
const { uuid_ } = require('./helpers');
const settings = require('./settings');

const DATA_DIR = process.env.DASH_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'dashboard.db');
const UPLOAD_DIR = process.env.DASH_UPLOAD_DIR || path.join(DATA_DIR, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

/* ---- Migration: dedupe users + enforce unique email ----
   users.email has no UNIQUE constraint, so the first-boot CSV import's
   INSERT OR IGNORE never conflicts on re-import — once the data dir
   persists (volume), every deploy appends a fresh copy of every user.
   Keep the earliest row per normalized email, then lock the column down
   so future imports skip existing accounts. The index normalizes exactly
   like the dedupe (lower + trim) so it can never admit a row the dedupe
   would remove. Runs on every boot; it is a no-op on a fresh or
   already-clean DB. */
db.exec(
  'DELETE FROM users WHERE id NOT IN (' +
  '  SELECT MIN(id) FROM users GROUP BY lower(trim(email))' +
  ')'
);
db.exec('DROP INDEX IF EXISTS idx_users_email_unique');
db.exec(
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(lower(trim(email)))'
);

/* ---- Migration: submissions.read_at (admin-read marker) ----
   The submission counter badge on a card flashes while that card has
   updates the admin has not read yet (see submissions.js). Older DBs lack
   the column; add it and backfill existing submissions as already read
   (read_at = created_at) so historical updates do not flash on deploy.
   New submissions default to read_at = 0 and flash until an admin opens
   the card's update list. */
const submissionColumns = db.prepare('PRAGMA table_info(submissions)').all();
if (!submissionColumns.some(function (c) { return String(c.name) === 'read_at'; })) {
  db.exec('ALTER TABLE submissions ADD COLUMN read_at INTEGER NOT NULL DEFAULT 0');
  db.exec('UPDATE submissions SET read_at = COALESCE(created_at, 0)');
}

/* ---- Migration: records.source (origin marker) ----
   Rows created in the dashboard (addItem) are marked source='app' so a sheet
   pull never overwrites or prunes them — the owner's dashboard additions are
   preserved even when they don't exist in the sheet. Older DBs lack the
   column; existing rows predate the marker and came from the sheet, so they
   default to 'sheet'. */
const recordColumns = db.prepare('PRAGMA table_info(records)').all();
if (!recordColumns.some(function (c) { return String(c.name) === 'source'; })) {
  db.exec("ALTER TABLE records ADD COLUMN source TEXT NOT NULL DEFAULT 'sheet'");
}

/* ---- Migration: documents.keep (retention exemption) ----
   Attachments flagged with keep=1 are never pruned by the retention sweep
   (DASH_RETENTION_DAYS). Older DBs lack the column; nothing is kept by
   default. */
const docColumns = db.prepare('PRAGMA table_info(documents)').all();
if (!docColumns.some(function (c) { return String(c.name) === 'keep'; })) {
  db.exec('ALTER TABLE documents ADD COLUMN keep INTEGER NOT NULL DEFAULT 0');
}

/* ---- Migration: username index ---- */
db.exec("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username != ''");

settings.setDb(db);

/* ============================================================
 * Sessions
 * ============================================================ */

function createSession_(email) {
  const token = uuid_() + uuid_();
  const now = Date.now();
  const ttl = CONFIG.USERS.SESSION_TTL_SECONDS * 1000;
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  db.prepare('INSERT INTO sessions (token, email, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, String(email).toLowerCase(), now, now + ttl);
  return token;
}

function sessionEmail_(token) {
  if (!token) return null;
  const row = db.prepare('SELECT email FROM sessions WHERE token = ? AND expires_at > ?').get(String(token), Date.now());
  return row ? row.email : null;
}

function destroySession_(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(String(token));
}

function destroySessionsForEmail_(email) {
  db.prepare('DELETE FROM sessions WHERE email = ?').run(String(email).toLowerCase());
}

/* ============================================================
 * Script-cache replacement (login throttling, reminders dedupe)
 * ============================================================ */

function cacheGet(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('cache:' + key);
  return row ? row.value : null;
}

function cachePut(key, value, ttlSeconds) {
  const k = 'cache:' + key;
  const expires = Date.now() + Math.max(1, Number(ttlSeconds) || 60) * 1000;
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(k, String(value));
  db.prepare('INSERT INTO dedupe (key, created_at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET created_at = excluded.created_at')
    .run(k, expires);
}

function cacheRemove(key) {
  db.prepare('DELETE FROM settings WHERE key = ?').run('cache:' + key);
  db.prepare('DELETE FROM dedupe WHERE key = ?').run('cache:' + key);
}

function cacheExpiry(key) {
  const k = 'cache:' + key;
  const row = db.prepare('SELECT created_at FROM dedupe WHERE key = ?').get(k);
  return row ? Number(row.created_at) : 0;
}

function cacheGetTTL(key) {
  const k = 'cache:' + key;
  const val = cacheGet(key);
  if (val === null || val === undefined) return null;
  const exp = cacheExpiry(key);
  if (exp && exp <= Date.now()) {
    db.prepare('DELETE FROM settings WHERE key = ?').run(k);
    db.prepare('DELETE FROM dedupe WHERE key = ?').run(k);
    return null;
  }
  return val;
}

/* ============================================================
 * Settings defaults (port of Settings.getAppSettings + props)
 * ============================================================ */

function seedDefaultSettings() {
  if (!settings.has('APP_NAME')) settings.set('APP_NAME', CONFIG.TITLE.DEFAULT);
  if (!settings.has('SHEET_NAME')) settings.set('SHEET_NAME', CONFIG.SHEET.NAME);
  if (!settings.has('START_ROW')) settings.set('START_ROW', String(CONFIG.SHEET.START_ROW));
  if (!settings.has('TIMEZONE')) settings.set('TIMEZONE', 'Asia/Kolkata');
  if (!settings.has('ENTERPRISE_ENABLED')) settings.set('ENTERPRISE_ENABLED', 'true');
  if (!settings.has('AI_INSIGHTS_ENABLED')) settings.set('AI_INSIGHTS_ENABLED', 'true');
  if (!settings.has('PWA_ENABLED')) settings.set('PWA_ENABLED', 'true');
  if (!settings.has('CALENDAR_ENABLED')) settings.set('CALENDAR_ENABLED', 'true');
  if (!settings.has('OFFLINE_STRICT_AUTH')) settings.set('OFFLINE_STRICT_AUTH', 'false');
}

function getAppSettings() {
  const startRow = Number(settings.getString('START_ROW') || CONFIG.SHEET.START_ROW);
  return {
    appName: settings.getString('APP_NAME') || CONFIG.TITLE.DEFAULT,
    sheetName: settings.getString('SHEET_NAME') || CONFIG.SHEET.NAME,
    startRow: isFinite(startRow) ? startRow : CONFIG.SHEET.START_ROW
  };
}

/* ============================================================
 * AI cache (replaces Worker KV)
 * ============================================================ */

function aiCacheGet(key) {
  const row = db.prepare('SELECT payload, created_at FROM ai_cache WHERE cache_key = ?').get(key);
  if (!row) return null;
  if (Number(row.created_at) + 3600000 < Date.now()) {
    db.prepare('DELETE FROM ai_cache WHERE cache_key = ?').run(key);
    return null;
  }
  return row.payload;
}

function aiCachePut(key, payload) {
  db.prepare(
    'INSERT INTO ai_cache (cache_key, payload, created_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at'
  ).run(key, String(payload), Date.now());
}

module.exports = {
  db,
  DATA_DIR,
  DB_PATH,
  UPLOAD_DIR,
  createSession_,
  sessionEmail_,
  destroySession_,
  destroySessionsForEmail_,
  cacheGet,
  cachePut,
  cacheRemove,
  cacheGetTTL,
  seedDefaultSettings,
  getAppSettings,
  aiCacheGet,
  aiCachePut
};

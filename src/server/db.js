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

const { CONFIG } = require('./config');
const { uuid_ } = require('./helpers');
const settings = require('./settings');

const DATA_DIR = process.env.DASH_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'dashboard.db');
const UPLOAD_DIR = process.env.DASH_UPLOAD_DIR || path.join(DATA_DIR, 'uploads');

// Initialize directories safely
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (err) {
  console.error('Failed to create data directories:', err.message);
  process.exit(1);
}

// Lazy-load Database to catch better-sqlite3 load errors with proper error handling
let dbInstance = null;
let dbInitError = null;

function ensureDb() {
  if (dbInitError) {
    throw new Error('Database initialization failed: ' + dbInitError.message);
  }
  if (!dbInstance) {
    try {
      const Database = require('better-sqlite3');
      dbInstance = new Database(DB_PATH);
      dbInstance.pragma('journal_mode = WAL');
      dbInstance.pragma('foreign_keys = ON');

      const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      dbInstance.exec(schema);

      settings.setDb(dbInstance);
    } catch (err) {
      dbInitError = err;
      console.error('Database initialization error:', err.message);
      throw err;
    }
  }
  return dbInstance;
}

// Ensure DB is initialized once on first use or on-demand
const db = new Proxy({}, {
  get: (target, prop) => {
    const instance = ensureDb();
    return instance[prop];
  }
});

/* ============================================================
 * Sessions
 * ============================================================ */

function createSession_(email) {
  const dbInst = ensureDb();
  const token = uuid_() + uuid_();
  const now = Date.now();
  const ttl = CONFIG.USERS.SESSION_TTL_SECONDS * 1000;
  dbInst.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  dbInst.prepare('INSERT INTO sessions (token, email, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, String(email).toLowerCase(), now, now + ttl);
  return token;
}

function sessionEmail_(token) {
  const dbInst = ensureDb();
  if (!token) return null;
  const row = dbInst.prepare('SELECT email FROM sessions WHERE token = ? AND expires_at > ?').get(String(token), Date.now());
  return row ? row.email : null;
}

function destroySession_(token) {
  const dbInst = ensureDb();
  if (token) dbInst.prepare('DELETE FROM sessions WHERE token = ?').run(String(token));
}

function destroySessionsForEmail_(email) {
  const dbInst = ensureDb();
  dbInst.prepare('DELETE FROM sessions WHERE email = ?').run(String(email).toLowerCase());
}

/* ============================================================
 * Script-cache replacement (login throttling, reminders dedupe)
 * ============================================================ */

function cacheGet(key) {
  const dbInst = ensureDb();
  const row = dbInst.prepare('SELECT value FROM settings WHERE key = ?').get('cache:' + key);
  return row ? row.value : null;
}

function cachePut(key, value, ttlSeconds) {
  const dbInst = ensureDb();
  const k = 'cache:' + key;
  const expires = Date.now() + Math.max(1, Number(ttlSeconds) || 60) * 1000;
  dbInst.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(k, String(value));
  dbInst.prepare('INSERT INTO dedupe (key, created_at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET created_at = excluded.created_at')
    .run(k, expires);
}

function cacheRemove(key) {
  const dbInst = ensureDb();
  dbInst.prepare('DELETE FROM settings WHERE key = ?').run('cache:' + key);
  dbInst.prepare('DELETE FROM dedupe WHERE key = ?').run('cache:' + key);
}

function cacheExpiry(key) {
  const dbInst = ensureDb();
  const row = dbInst.prepare('SELECT created_at FROM dedupe WHERE key = ?').get('cache:' + key);
  return row ? Number(row.created_at) : 0;
}

function cacheGetTTL(key) {
  const dbInst = ensureDb();
  const k = 'cache:' + key;
  const val = cacheGet(key);
  if (val === null || val === undefined) return null;
  const exp = cacheExpiry(key);
  if (exp && exp <= Date.now()) {
    dbInst.prepare('DELETE FROM settings WHERE key = ?').run(k);
    dbInst.prepare('DELETE FROM dedupe WHERE key = ?').run(k);
    return null;
  }
  return val;
}

/* ============================================================
 * Settings defaults (port of Settings.getAppSettings + props)
 * ============================================================ */

function seedDefaultSettings() {
  try {
    const dbInst = ensureDb();
    if (!settings.has('APP_NAME')) settings.set('APP_NAME', CONFIG.TITLE.DEFAULT);
    if (!settings.has('SHEET_NAME')) settings.set('SHEET_NAME', CONFIG.SHEET.NAME);
    if (!settings.has('START_ROW')) settings.set('START_ROW', String(CONFIG.SHEET.START_ROW));
    if (!settings.has('TIMEZONE')) settings.set('TIMEZONE', 'Asia/Kolkata');
    if (!settings.has('ENTERPRISE_ENABLED')) settings.set('ENTERPRISE_ENABLED', 'true');
    if (!settings.has('AI_INSIGHTS_ENABLED')) settings.set('AI_INSIGHTS_ENABLED', 'true');
    if (!settings.has('PWA_ENABLED')) settings.set('PWA_ENABLED', 'true');
    if (!settings.has('CALENDAR_ENABLED')) settings.set('CALENDAR_ENABLED', 'true');
    if (!settings.has('OFFLINE_STRICT_AUTH')) settings.set('OFFLINE_STRICT_AUTH', 'false');
  } catch (err) {
    console.warn('Failed to seed default settings:', err.message);
  }
}

function getAppSettings() {
  const dbInst = ensureDb();
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
  const dbInst = ensureDb();
  const row = dbInst.prepare('SELECT payload, created_at FROM ai_cache WHERE cache_key = ?').get(key);
  if (!row) return null;
  if (Number(row.created_at) + 3600000 < Date.now()) {
    dbInst.prepare('DELETE FROM ai_cache WHERE cache_key = ?').run(key);
    return null;
  }
  return row.payload;
}

function aiCachePut(key, payload) {
  const dbInst = ensureDb();
  dbInst.prepare(
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


/**
 * ============================================================
 * India Post Dashboard — Node port
 * settings.js
 * Script-Properties replacement: key/value store backed by the
 * 'settings' table. Keys set through admin-gated set*ApiKey APIs
 * land here (never in committed files).
 * ============================================================
 */

let db = null;

function setDb(database) {
  db = database;
}

function get(key) {
  if (!db) return null;
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(String(key));
    return row || null;
  } catch (err) {
    return null;
  }
}

function getString(key) {
  const row = get(key);
  return row && row.value !== undefined && row.value !== null ? String(row.value) : '';
}

function set(key, value) {
  if (!db) return;
  const k = String(key);
  const v = value === null || value === undefined ? '' : String(value);
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(k, v);
}

function getAll() {
  if (!db) return {};
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  rows.forEach(function (r) { out[r.key] = r.value; });
  return out;
}

function has(key) {
  return !!getString(key);
}

module.exports = { setDb, get, getString, set, getAll, has };

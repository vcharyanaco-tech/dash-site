/**
 * ============================================================
 * India Post Dashboard — Node port
 * data-sync.js
 * Persistent-disk bridge for hosts with an ephemeral filesystem
 * (Render free tier). The Worker's DATA_BACKUP_KV namespace holds
 * the SQLite DB + uploads; this module restores them before boot
 * and pushes fresh snapshots on an interval (and on shutdown).
 *
 * Configured via:
 *   DATA_SYNC_URL       base of the worker bridge, e.g.
 *                       https://dashboardharyana.site/api/backup
 *   WORKER_API_TOKEN    shared bearer token (also used by the
 *                       worker's enterprise routes)
 *   DATA_SYNC_INTERVAL_MS  backup cadence (default 10 min)
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DASH_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'dashboard.db');
const UPLOAD_DIR = process.env.DASH_UPLOAD_DIR || path.join(DATA_DIR, 'uploads');

const BASE = (process.env.DATA_SYNC_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.WORKER_API_TOKEN || '';
const INTERVAL_MS = Number(process.env.DATA_SYNC_INTERVAL_MS || 10 * 60 * 1000);

function enabled() {
  return !!(BASE && TOKEN);
}

function authHeaders() {
  return { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/octet-stream' };
}

async function fetchBuf(url, opts) {
  const resp = await fetch(url, opts);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error('backup bridge ' + resp.status + ' for ' + url);
  return Buffer.from(await resp.arrayBuffer());
}

async function putBuf(url, buf) {
  const resp = await fetch(url, { method: 'PUT', headers: authHeaders(), body: buf });
  if (!resp.ok) throw new Error('backup bridge PUT ' + resp.status + ' for ' + url);
  return resp;
}

/** Download the latest DB + uploads from the KV bridge into DATA_DIR.
 *  Call BEFORE the server opens the SQLite file. No-op when disabled or
 *  when the bridge has no snapshot yet. */
async function restoreData() {
  if (!enabled()) return { restored: false, reason: 'disabled' };
  const out = { restored: false, db: false, uploads: 0 };
  try {
    const dbBuf = await fetchBuf(BASE + '/db', { headers: authHeaders() });
    if (dbBuf) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_PATH, dbBuf);
      out.db = true;
      out.restored = true;
      console.log('[data-sync] restored dashboard.db (' + dbBuf.length + ' bytes)');
    }
    const listResp = await fetch(BASE + '/uploads', { headers: authHeaders() });
    if (listResp.ok) {
      const list = await listResp.json();
      if (list && Array.isArray(list.files)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        for (const name of list.files) {
          const buf = await fetchBuf(BASE + '/uploads/' + encodeURIComponent(name), { headers: authHeaders() });
          if (buf) {
            fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
            out.uploads++;
          }
        }
        if (out.uploads) {
          out.restored = true;
          console.log('[data-sync] restored ' + out.uploads + ' upload(s)');
        }
      }
    }
  } catch (err) {
    console.error('[data-sync] restore failed: ' + (err && err.message));
  }
  return out;
}

/** Consistent snapshot of the live DB (better-sqlite3 backup API, safe with
 *  WAL) + every file in the uploads dir, pushed to the KV bridge. */
async function backupData() {
  if (!enabled()) return { backedUp: false, reason: 'disabled' };
  const out = { backedUp: true, dbBytes: 0, uploads: 0 };
  try {
    const { db } = require('./db');
    const tmp = path.join(DATA_DIR, '.dashboard.backup-tmp.db');
    try { fs.unlinkSync(tmp); } catch (e) {}
    await db.backup(tmp);
    const buf = fs.readFileSync(tmp);
    try { fs.unlinkSync(tmp); } catch (e) {}
    await putBuf(BASE + '/db', buf);
    out.dbBytes = buf.length;

    let names = [];
    try { names = fs.readdirSync(UPLOAD_DIR); } catch (e) {}
    for (const name of names) {
      if (name.indexOf('.') === 0) continue;
      const p = path.join(UPLOAD_DIR, name);
      let st;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (!st.isFile()) continue;
      await putBuf(BASE + '/uploads/' + encodeURIComponent(name), fs.readFileSync(p));
      out.uploads++;
    }
    console.log('[data-sync] backup pushed: db=' + out.dbBytes + 'B, uploads=' + out.uploads);
  } catch (err) {
    out.backedUp = false;
    out.error = (err && err.message) || String(err);
    console.error('[data-sync] backup failed: ' + out.error);
  }
  return out;
}

/** Fire one backup now, then every INTERVAL_MS. Also flushes a final backup
 *  on SIGTERM/SIGINT before exiting (Render sends SIGTERM on restart). */
function startAutoSync() {
  if (!enabled()) return;
  backupData();
  setInterval(function () { backupData(); }, INTERVAL_MS);
  ['SIGTERM', 'SIGINT'].forEach(function (sig) {
    process.on(sig, function () {
      console.log('[data-sync] ' + sig + ' — final backup before exit');
      backupData().then(function () { process.exit(0); });
    });
  });
}

module.exports = { enabled, restoreData, backupData, startAutoSync };

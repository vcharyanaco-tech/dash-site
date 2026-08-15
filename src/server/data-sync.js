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
const MEETINGS_DIR = path.join(DATA_DIR, 'meetings');

const BASE = (process.env.DATA_SYNC_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.WORKER_API_TOKEN || '';
const INTERVAL_MS = Number(process.env.DATA_SYNC_INTERVAL_MS || 10 * 60 * 1000);

function enabled() {
  return !!(BASE && TOKEN);
}

function authHeaders() {
  return { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/octet-stream' };
}

// All bridge calls get a hard timeout: a hung PUT must not leave the write-
// triggered backup chain stuck (backupInFlight stays true forever otherwise,
// queueing every later write behind it).
const FETCH_TIMEOUT_MS = 20000;

async function fetchWithTimeout_(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, Object.assign({}, opts, { signal: ctrl.signal }));
  } finally {
    clearTimeout(t);
  }
}

async function fetchBuf(url, opts) {
  const resp = await fetchWithTimeout_(url, opts);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error('backup bridge ' + resp.status + ' for ' + url);
  return Buffer.from(await resp.arrayBuffer());
}

async function putBuf(url, buf) {
  const resp = await fetchWithTimeout_(url, { method: 'PUT', headers: authHeaders(), body: buf });
  if (!resp.ok) throw new Error('backup bridge PUT ' + resp.status + ' for ' + url);
  return resp;
}

/** Download the latest DB + uploads from the KV bridge into DATA_DIR.
 *  Call BEFORE the server opens the SQLite file. No-op when disabled or
 *  when the bridge has no snapshot yet.
 *
 *  IMPORTANT: only restores when the local DB file is ABSENT (ephemeral
 *  disk, e.g. Render free after a redeploy). NEVER overwrite an existing
 *  DB: hosts with a persistent volume (Railway) run rolling deploys where
 *  the previous instance still has the file open in WAL mode — writing
 *  over it corrupts the database (observed 2026-08-14). */
async function restoreData() {
  if (!enabled()) return { restored: false, reason: 'disabled' };
  if (fs.existsSync(DB_PATH)) return { restored: false, reason: 'local db exists' };
  const out = { restored: false, db: false, uploads: 0, meetings: 0 };
  try {
    const dbBuf = await fetchBuf(BASE + '/db', { headers: authHeaders() });
    if (dbBuf) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_PATH, dbBuf);
      // A restored snapshot must not be replayed against any stale WAL left
      // by an earlier boot on the same disk (WAL mode + external restore =
      // corruption). Drop leftover side files so SQLite opens the copy clean.
      try { fs.rmSync(DB_PATH + '-wal', { force: true }); } catch (e) {}
      try { fs.rmSync(DB_PATH + '-shm', { force: true }); } catch (e) {}
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
    // Saved meeting recordings + minutes, same ephemeral-disk story as uploads.
    const meetResp = await fetch(BASE + '/meetings', { headers: authHeaders() });
    if (meetResp.ok) {
      const list = await meetResp.json();
      if (list && Array.isArray(list.files)) {
        fs.mkdirSync(MEETINGS_DIR, { recursive: true });
        for (const name of list.files) {
          const buf = await fetchBuf(BASE + '/meetings/' + encodeURIComponent(name), { headers: authHeaders() });
          if (buf) {
            fs.writeFileSync(path.join(MEETINGS_DIR, name), buf);
            out.meetings++;
          }
        }
        if (out.meetings) {
          out.restored = true;
          console.log('[data-sync] restored ' + out.meetings + ' meeting file(s)');
        }
      }
    }
  } catch (err) {
    console.error('[data-sync] restore failed: ' + (err && err.message));
  }
  return out;
}

/** Consistent snapshot of the live DB (VACUUM INTO — a fresh standalone copy,
 *  safe with WAL and live traffic; falls back to the backup API on older
 *  SQLite) + every file in the uploads dir, pushed to the KV bridge. */
/* ── KV free-tier budget + stats ─────────────────────────────────────────
 * Workers KV free allows ~1,000 writes/day, shared account-wide with the
 * AI-insights cache in the same namespace. Every DB mutation triggers a
 * snapshot backup, so a busy editing day could exhaust the quota — after
 * which KV writes silently fail and the next redeploy restores stale data.
 * We keep a rolling daily write budget (default 400, env
 * DASH_BACKUP_WRITE_BUDGET) and STOP pushing once it is spent. Orphaned
 * uploads/meetings keys (files deleted locally) are also pruned from KV on
 * an hourly cadence so deletes truly persist across redeploys. */
const WRITE_BUDGET = Number(process.env.DASH_BACKUP_WRITE_BUDGET || 400);
const stats = {
  dayKey: '',
  writesToday: 0,
  deletesToday: 0,
  lastBackupAt: null,
  dbBytes: 0,
  uploads: 0,
  meetings: 0,
  error: '',
  skippedBudget: false
};
let lastCleanupAt = 0;

function budgetDayKey_() {
  return new Date().toISOString().slice(0, 10);
}

function rollBudgetIfNeeded_() {
  const k = budgetDayKey_();
  if (stats.dayKey !== k) {
    stats.dayKey = k;
    stats.writesToday = 0;
    stats.deletesToday = 0;
  }
}

function budgetLeft() {
  rollBudgetIfNeeded_();
  return Math.max(0, WRITE_BUDGET - stats.writesToday);
}

function canWrite() {
  return budgetLeft() > 0;
}

async function putBufCounted_(url, buf) {
  if (!canWrite()) {
    stats.skippedBudget = true;
    return false;
  }
  await putBuf(url, buf);
  stats.writesToday++;
  return true;
}

async function cleanupOrphanedKeys_() {
  const now = Date.now();
  if (now - lastCleanupAt < 3600000) return; // at most once per hour
  lastCleanupAt = now;
  try {
    const local = new Set();
    let n;
    try { n = fs.readdirSync(UPLOAD_DIR); } catch (e) { n = []; }
    n.forEach(function (x) { if (x.indexOf('.') !== 0) local.add('uploads/' + x); });
    try { n = fs.readdirSync(MEETINGS_DIR); } catch (e) { n = []; }
    n.forEach(function (x) { if (x.indexOf('.') !== 0) local.add('meetings/' + x); });
    const r1 = await fetchWithTimeout_(BASE + '/uploads', { headers: authHeaders() });
    const r2 = await fetchWithTimeout_(BASE + '/meetings', { headers: authHeaders() });
    const l1 = r1.ok ? await r1.json() : { files: [] };
    const l2 = r2.ok ? await r2.json() : { files: [] };
    const dels = [];
    (l1.files || []).forEach(function (f) { if (!local.has('uploads/' + f)) dels.push('/uploads/' + encodeURIComponent(f)); });
    (l2.files || []).forEach(function (f) { if (!local.has('meetings/' + f)) dels.push('/meetings/' + encodeURIComponent(f)); });
    for (const u of dels.slice(0, 200)) {
      await fetchWithTimeout_(BASE + u, { method: 'DELETE', headers: authHeaders() });
      stats.deletesToday++;
    }
    if (dels.length) console.log('[data-sync] cleaned ' + dels.length + ' orphaned KV key(s)');
  } catch (err) {
    console.error('[data-sync] cleanup failed: ' + (err && err.message));
  }
}

async function backupData() {
  if (!enabled()) return { backedUp: false, reason: 'disabled' };
  const out = { backedUp: true, dbBytes: 0, uploads: 0, meetings: 0 };
  try {
    const { db } = require('./db');
    const tmp = path.join(DATA_DIR, '.dashboard.backup-tmp.db');
    try { fs.unlinkSync(tmp); } catch (e) {}
    try {
      db.exec('VACUUM INTO ' + JSON.stringify(tmp.replace(/\\/g, '/')));
    } catch (vacErr) {
      await db.backup(tmp);
    }
    // Never let a corrupt snapshot overwrite the good one in KV: verify the
    // copy is a readable SQLite DB before uploading.
    let ok = false;
    try {
      const check = require('better-sqlite3');
      const c = new check(tmp, { readonly: true });
      const integrity = c.prepare('PRAGMA integrity_check').get().integrity_check;
      const recs = c.prepare('SELECT COUNT(*) c FROM records').get().c;
      const users = c.prepare('SELECT COUNT(*) c FROM users').get().c;
      c.close();
      ok = integrity === 'ok' && recs >= 0 && users >= 0;
      if (!ok) console.error('[data-sync] snapshot failed integrity check (' + integrity + ') — not pushed');
    } catch (e) {
      console.error('[data-sync] snapshot unreadable — not pushed: ' + e.message);
    }
    const buf = fs.readFileSync(tmp);
    try { fs.unlinkSync(tmp); } catch (e) {}
    if (!ok) { out.backedUp = false; out.error = 'snapshot failed integrity check'; return out; }
    if (!(await putBufCounted_(BASE + '/db', buf))) {
      out.backedUp = false;
      out.reason = 'budget';
      out.error = 'daily KV write budget exhausted (backups paused for today)';
      return out;
    }
    out.dbBytes = buf.length;

    let names = [];
    try { names = fs.readdirSync(UPLOAD_DIR); } catch (e) {}
    for (const name of names) {
      if (name.indexOf('.') === 0) continue;
      const p = path.join(UPLOAD_DIR, name);
      let st;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (!st.isFile()) continue;
      if (!(await putBufCounted_(BASE + '/uploads/' + encodeURIComponent(name), fs.readFileSync(p)))) break;
      out.uploads++;
    }
    let meetNames = [];
    try { meetNames = fs.readdirSync(MEETINGS_DIR); } catch (e) {}
    for (const name of meetNames) {
      if (name.indexOf('.') === 0) continue;
      const p = path.join(MEETINGS_DIR, name);
      let st;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (!st.isFile()) continue;
      if (!(await putBufCounted_(BASE + '/meetings/' + encodeURIComponent(name), fs.readFileSync(p)))) break;
      out.meetings++;
    }

    await cleanupOrphanedKeys_();

    // Reflect the run in the live stats (written to KV too, for the worker's
    // /api/health when Node is unreachable).
    stats.lastBackupAt = new Date().toISOString();
    stats.dbBytes = out.dbBytes;
    stats.uploads = out.uploads;
    stats.meetings = out.meetings;
    stats.error = '';
    const payload = {
      lastBackupAt: stats.lastBackupAt,
      dbBytes: stats.dbBytes,
      uploads: stats.uploads,
      meetings: stats.meetings,
      writesToday: stats.writesToday,
      budget: WRITE_BUDGET,
      deletesToday: stats.deletesToday,
      skippedBudget: stats.skippedBudget
    };
    await putBufCounted_(BASE + '/stats', Buffer.from(JSON.stringify(payload)));
    console.log('[data-sync] backup pushed: db=' + out.dbBytes + 'B, uploads=' + out.uploads + ', meetings=' + out.meetings + ', writesToday=' + stats.writesToday + '/' + WRITE_BUDGET);
  } catch (err) {
    out.backedUp = false;
    out.error = (err && err.message) || String(err);
    stats.error = out.error;
    console.error('[data-sync] backup failed: ' + out.error);
  }
  return out;
}

/** Immediately delete one file's KV copy (kind: 'uploads' | 'meetings'). Used by
 *  deleteMeetingFile / deleteDocument so a deleted file never resurrects on the
 *  next redeploy; the hourly orphan sweep remains as a safety net. */
async function deleteRemoteFile(kind, name) {
  if (!enabled()) return false;
  if (kind !== 'uploads' && kind !== 'meetings') return false;
  const safe = String(name || '');
  if (!safe || safe.indexOf('/') !== -1 || safe.indexOf('\\') !== -1) return false;
  try {
    await fetchWithTimeout_(BASE + '/' + kind + '/' + encodeURIComponent(safe), { method: 'DELETE', headers: authHeaders() });
    stats.deletesToday++;
    return true;
  } catch (err) {
    console.error('[data-sync] remote delete failed (' + kind + '/' + safe + '): ' + (err && err.message));
    return false;
  }
}

function getBackupStatus() {
  rollBudgetIfNeeded_();
  return {
    enabled: enabled(),
    lastBackupAt: stats.lastBackupAt || null,
    dbBytes: stats.dbBytes,
    uploads: stats.uploads,
    meetings: stats.meetings,
    error: stats.error || null,
    writesToday: stats.writesToday,
    budget: WRITE_BUDGET,
    budgetLeft: budgetLeft(),
    deletesToday: stats.deletesToday,
    skippedBudget: stats.skippedBudget
  };
}

/* ── write-triggered backups ────────────────────────────────────────────
 * The KV snapshot is what Render restores on boot. Waiting up to the full
 * INTERVAL_MS (default 10 min) after a write means a restart in that window
 * reverts the change — observed repeatedly with record links (2026-08-14).
 * So every mutation also schedules a backup within a few seconds. Debounced
 * so a burst of edits coalesces into one PUT, and serialized so concurrent
 * timers can't race on the snapshot temp file. */
let backupTimer = null;
let backupInFlight = false;
let backupQueued = false;

async function runBackup_() {
  if (backupInFlight) {
    backupQueued = true;
    return;
  }
  backupInFlight = true;
  try {
    await backupData();
  } finally {
    backupInFlight = false;
    if (backupQueued) {
      backupQueued = false;
      setTimeout(function () { runBackup_(); }, 100);
    }
  }
}

/** Schedule a backup shortly after a write. Safe to call on every mutation
 *  (cheap when disabled or when nothing changed). */
function requestBackup() {
  if (!enabled()) return;
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(function () {
    backupTimer = null;
    runBackup_();
  }, 1000);
}

/** Fire one backup now, then every INTERVAL_MS. Also flushes a final backup
 *  on SIGTERM/SIGINT before exiting (Render sends SIGTERM on restart). */
function startAutoSync() {
  if (!enabled()) return;
  runBackup_();
  setInterval(function () { runBackup_(); }, INTERVAL_MS);
  ['SIGTERM', 'SIGINT'].forEach(function (sig) {
    process.on(sig, function () {
      console.log('[data-sync] ' + sig + ' — final backup before exit');
      runBackup_().then(function () { process.exit(0); });
    });
  });
}

module.exports = { enabled, restoreData, backupData, startAutoSync, requestBackup, getBackupStatus, deleteRemoteFile };

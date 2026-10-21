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
 *
 * Snapshots are gzipped before upload and skipped entirely when the DB (and
 * every upload/meeting file) is byte-identical to the last successful push.
 * A 1.3 MB DB every 10 min was the workspace's largest Render egress line;
 * see SESSION_EXPORT_2026-10-21.md. Restore accepts both gzipped and legacy
 * raw-SQLite KV values.
 * ============================================================
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DATA_DIR = process.env.DASH_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'dashboard.db');
const UPLOAD_DIR = process.env.DASH_UPLOAD_DIR || path.join(DATA_DIR, 'uploads');
const MEETINGS_DIR = path.join(DATA_DIR, 'meetings');

const BASE = (process.env.DATA_SYNC_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.WORKER_API_TOKEN || '';
const INTERVAL_MS = Number(process.env.DATA_SYNC_INTERVAL_MS || 10 * 60 * 1000);

function sha256_(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Compress a DB snapshot before it crosses the Render egress meter. */
function gzipSnapshot_(buf) {
  return zlib.gzipSync(buf, { level: 6 });
}

/** Current snapshots are gzip; older KV values are raw SQLite. Sniff the
 *  magic bytes rather than trusting a header (Workers/KV is opaque binary). */
function decodeSnapshot_(buf) {
  if (buf && buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return zlib.gunzipSync(buf);
  }
  return buf;
}

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

async function putBuf(url, buf, extraHeaders) {
  const headers = Object.assign(authHeaders(), extraHeaders || {});
  const resp = await fetchWithTimeout_(url, { method: 'PUT', headers: headers, body: buf });
  if (!resp.ok) throw new Error('backup bridge PUT ' + resp.status + ' for ' + url);
  return resp;
}

// Content hashes of the last bytes successfully pushed. In-memory only: after
// a restart the first cycle uploads once, then the periodic loop is a no-op
// until something actually changes. That one restart upload is deliberate —
// it is cheaper than trusting a stale local hash file after a restore.
let lastUploadedDbHash = '';
const uploadedFileHashes = new Map();
let lastStatsPutAt = 0;
// Health stats are tiny, but there is no reason to spend a KV write every
// 10 minutes when the snapshot was unchanged; 15 minutes keeps the worker's
// fallback health view fresh without touching the write budget.
const STATS_MIN_INTERVAL_MS = 15 * 60 * 1000;

/** Download the latest DB + uploads from the KV bridge into DATA_DIR.
 *  Call BEFORE the server opens the SQLite file. No-op when disabled or
 *  when the bridge has no snapshot yet.
 *
 *  IMPORTANT: only restores when the local DB file is ABSENT (ephemeral
 *  disk, e.g. Render free after a redeploy). NEVER overwrite an existing
 *  DB: hosts with a persistent volume run rolling deploys where
 *  the previous instance still has the file open in WAL mode — writing
 *  over it corrupts the database (observed 2026-08-14). */
async function restoreData() {
  if (!enabled()) return { restored: false, reason: 'disabled' };
  if (fs.existsSync(DB_PATH)) return { restored: false, reason: 'local db exists' };
  const out = { restored: false, db: false, uploads: 0, meetings: 0 };
  try {
    const storedDb = await fetchBuf(BASE + '/db', { headers: authHeaders() });
    if (storedDb) {
      const dbBuf = decodeSnapshot_(storedDb);
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_PATH, dbBuf);
      // A restored snapshot must not be replayed against any stale WAL left
      // by an earlier boot on the same disk (WAL mode + external restore =
      // corruption). Drop leftover side files so SQLite opens the copy clean.
      try { fs.rmSync(DB_PATH + '-wal', { force: true }); } catch (e) {}
      try { fs.rmSync(DB_PATH + '-shm', { force: true }); } catch (e) {}
      // The bridge already holds these exact bytes; don't push them back on
      // the first timer tick after a restart.
      lastUploadedDbHash = sha256_(dbBuf);
      out.db = true;
      out.restored = true;
      out.dbBytes = dbBuf.length;
      console.log('[data-sync] restored dashboard.db (' + dbBuf.length + ' bytes, ' +
        (storedDb.length !== dbBuf.length ? 'gzip' : 'raw') + ' snapshot)');
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
            uploadedFileHashes.set('uploads/' + name, sha256_(buf));
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
            uploadedFileHashes.set('meetings/' + name, sha256_(buf));
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
/* ── Retention ─────────────────────────────────────────────────────────
 * Meeting recordings/notes and record attachments ride the same snapshot
 * bridge, so they accumulate in KV toward the 1 GB free cap. Files older
 * than DASH_RETENTION_DAYS (default 30) are pruned — local disk, KV copy,
 * and (for uploads) the documents row — by the hourly sweep inside
 * backupData. Set DASH_RETENTION_DAYS=0 to disable. */
const RETENTION_DAYS = Math.max(0, Number(process.env.DASH_RETENTION_DAYS || 30));
const stats = {
  dayKey: '',
  writesToday: 0,
  deletesToday: 0,
  lastBackupAt: null,
  lastUploadAt: null,
  lastCheckedAt: null,
  dbBytes: 0,
  dbStoredBytes: 0,
  uploads: 0,
  meetings: 0,
  prunedToday: 0,
  retentionDays: RETENTION_DAYS,
  error: '',
  skippedUnchanged: 0,
  skippedBudget: false
};
let lastCleanupAt = 0;
let lastRetentionAt = 0;

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

async function putBufCounted_(url, buf, extraHeaders) {
  if (!canWrite()) {
    stats.skippedBudget = true;
    return false;
  }
  await putBuf(url, buf, extraHeaders);
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
    let referencedNotLocal = 0;
    // Only delete a remote upload whose local copy is absent AND which no
    // documents row references. A file that is referenced but missing locally
    // (e.g. a restore where the file fetch failed) MUST keep its KV copy —
    // deleting it would break the attachment permanently on the next redeploy.
    (l1.files || []).forEach(function (f) {
      if (local.has('uploads/' + f)) return;
      const referenced = (function () {
        try {
          return !!require('./db').db.prepare('SELECT 1 FROM documents WHERE file_key = ?').get(String(f));
        } catch (e) { return false; }
      })();
      if (referenced) { referencedNotLocal++; return; }
      dels.push('/uploads/' + encodeURIComponent(f));
    });
    (l2.files || []).forEach(function (f) { if (!local.has('meetings/' + f)) dels.push('/meetings/' + encodeURIComponent(f)); });
    for (const u of dels.slice(0, 200)) {
      await fetchWithTimeout_(BASE + u, { method: 'DELETE', headers: authHeaders() });
      stats.deletesToday++;
    }
    if (dels.length || referencedNotLocal) {
      console.log('[data-sync] cleaned ' + dels.length + ' orphaned KV key(s)' +
        (referencedNotLocal ? ', kept ' + referencedNotLocal + ' referenced-but-locally-missing upload(s)' : ''));
    }
  } catch (err) {
    console.error('[data-sync] cleanup failed: ' + (err && err.message));
  }
}

function retentionCutoff_() {
  return Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

/** Prune files older than RETENTION_DAYS from local disk + KV (and, for
 *  uploads, the documents rows so the UI never shows a broken attachment).
 *  Meeting files embed their creation stamp ('<title>_YYYY-MM-DD_HHMM.ext')
 *  which survives restoreData (mtime does not — restored files get fresh
 *  mtimes). Upload file keys are uuids with no stamp, so those use the
 *  documents.uploaded_at column; orphan files on disk fall back to mtime.
 *  Hourly cadence (like the orphan sweep); pass force=true to run now. */
async function enforceRetention_(force) {
  const pruned = { meetings: 0, uploads: 0 };
  if (!RETENTION_DAYS) return pruned;
  const now = Date.now();
  if (!force && now - lastRetentionAt < 3600000) return pruned;
  lastRetentionAt = now;
  const cutoff = retentionCutoff_();

  // Meetings: the stamp is anchored at the end of the base name.
  let names = [];
  try { names = fs.readdirSync(MEETINGS_DIR); } catch (e) { names = []; }
  for (const name of names) {
    if (!name || name.indexOf('.') === 0) continue;
    const p = path.join(MEETINGS_DIR, name);
    let st;
    try { st = fs.statSync(p); } catch (e) { continue; }
    if (!st.isFile()) continue;
    const m = String(name).match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})\.[a-z0-9]{2,5}$/);
    const ageMs = m
      ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
      : st.mtimeMs;
    if (isNaN(ageMs) || ageMs > cutoff) continue;
    try { fs.unlinkSync(p); } catch (e) { continue; }
    try { await deleteRemoteFile('meetings', name); } catch (e) {}
    pruned.meetings++;
    console.log('[data-sync] retention pruned meeting file: ' + name);
  }

  // Uploads: prune by the documents row age, then orphan files by mtime.
  try {
    const { db } = require('./db');
    // Documents flagged keep=1 are exempt from retention.
    const rows = db.prepare('SELECT id, file_key, record_id FROM documents WHERE uploaded_at IS NOT NULL AND uploaded_at < ? AND (keep IS NULL OR keep = 0)').all(cutoff);
    for (const row of rows) {
      const fk = String(row.file_key || '');
      if (fk) {
        const p = path.join(UPLOAD_DIR, fk);
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
        try { await deleteRemoteFile('uploads', fk); } catch (e) {}
      }
      db.prepare('DELETE FROM documents WHERE id = ?').run(String(row.id));
      pruned.uploads++;
      try {
        require('./audit').logAudit_('DOC_PURGE', String(row.record_id || row.id), 'Attachment older than ' + RETENTION_DAYS + ' days pruned by retention policy', 'system');
      } catch (e) {}
    }
    let unames = [];
    try { unames = fs.readdirSync(UPLOAD_DIR); } catch (e) { unames = []; }
    for (const name of unames) {
      if (!name || name.indexOf('.') === 0) continue;
      const p = path.join(UPLOAD_DIR, name);
      let st;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (!st.isFile()) continue;
      if (db.prepare('SELECT 1 FROM documents WHERE file_key = ?').get(name)) continue;
      if (st.mtimeMs > cutoff) continue;
      try { fs.unlinkSync(p); } catch (e) { continue; }
      try { await deleteRemoteFile('uploads', name); } catch (e) {}
      pruned.uploads++;
    }
    if (pruned.uploads) requestBackup(); // DB rows changed — fresh snapshot
  } catch (err) {
    console.error('[data-sync] upload retention failed: ' + (err && err.message));
  }

  if (pruned.meetings || pruned.uploads) {
    stats.prunedToday += pruned.meetings + pruned.uploads;
    console.log('[data-sync] retention pruned ' + pruned.meetings + ' meeting file(s), ' + pruned.uploads + ' upload(s)');
  }
  return pruned;
}

async function backupData() {
  if (!enabled()) return { backedUp: false, reason: 'disabled' };
  const out = { backedUp: true, dbBytes: 0, dbStoredBytes: 0, uploads: 0, meetings: 0, skipped: '' };
  try {
    const { db } = require('./db');
    const tmp = path.join(DATA_DIR, '.dashboard.backup-tmp.db');
    try { fs.unlinkSync(tmp); } catch (e) {}
    try {
      // Single-quoted SQL string: SQLite parses double quotes as an identifier.
      db.exec("VACUUM INTO '" + String(tmp).replace(/'/g, "''") + "'");
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

    // Dedupe on the raw SQLite bytes. VACUUM INTO is deterministic for an
    // unchanged DB, so an idle timer tick costs a local snapshot but no PUT.
    const dbHash = sha256_(buf);
    const dbChanged = dbHash !== lastUploadedDbHash;

    // Files FIRST, DB LAST. The /db put is the commit point of a snapshot: an
    // upload that reaches KV but whose DB never arrives is a harmless orphan the
    // sweep removes; a DB that arrives while its files are still uploading means
    // documents rows reference keys the snapshot doesn't carry — broken
    // attachments after the next redeploy. Every file loop also reserves one
    // write so the /db commit always gets the final budget slot.
    // A file whose content hash matches the last successful push is skipped.
    const reserve = dbChanged ? 1 : 0;
    let names = [];
    try { names = fs.readdirSync(UPLOAD_DIR); } catch (e) {}
    for (const name of names) {
      if (name.indexOf('.') === 0) continue;
      if (budgetLeft() <= reserve) break;
      const p = path.join(UPLOAD_DIR, name);
      let st;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (!st.isFile()) continue;
      const fileBuf = fs.readFileSync(p);
      const fileKey = 'uploads/' + name;
      const fileHash = sha256_(fileBuf);
      if (uploadedFileHashes.get(fileKey) === fileHash) continue;
      if (!(await putBufCounted_(BASE + '/uploads/' + encodeURIComponent(name), fileBuf))) break;
      uploadedFileHashes.set(fileKey, fileHash);
      out.uploads++;
    }
    let meetNames = [];
    try { meetNames = fs.readdirSync(MEETINGS_DIR); } catch (e) {}
    for (const name of meetNames) {
      if (name.indexOf('.') === 0) continue;
      if (budgetLeft() <= reserve) break;
      const p = path.join(MEETINGS_DIR, name);
      let st;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (!st.isFile()) continue;
      const fileBuf = fs.readFileSync(p);
      const fileKey = 'meetings/' + name;
      const fileHash = sha256_(fileBuf);
      if (uploadedFileHashes.get(fileKey) === fileHash) continue;
      if (!(await putBufCounted_(BASE + '/meetings/' + encodeURIComponent(name), fileBuf))) break;
      uploadedFileHashes.set(fileKey, fileHash);
      out.meetings++;
    }

    if (dbChanged) {
      // gzip before the PUT: SQLite compresses ~5x for this schema. The bytes
      // are still opaque to the Worker/KV; restore sniffs the gzip magic.
      const stored = gzipSnapshot_(buf);
      if (!(await putBufCounted_(BASE + '/db', stored, { 'X-Backup-Encoding': 'gzip' }))) {
        out.backedUp = false;
        out.reason = 'budget';
        out.error = 'daily KV write budget exhausted (backups paused for today)';
        return out;
      }
      lastUploadedDbHash = dbHash;
      out.dbBytes = buf.length;
      out.dbStoredBytes = stored.length;
      stats.lastUploadAt = new Date().toISOString();
      stats.dbStoredBytes = stored.length;
    } else {
      out.skipped = 'unchanged';
    }

    await cleanupOrphanedKeys_();
    await enforceRetention_();

    // Reflect the run in the live stats (written to KV too, for the worker's
    // /api/health when Node is unreachable). lastBackupAt is the last verified
    // snapshot (uploaded or confirmed identical); lastUploadAt is the last
    // actual PUT, so an idle dashboard still reports a fresh, safe backup.
    const cycleChanged = dbChanged || out.uploads > 0 || out.meetings > 0;
    stats.lastBackupAt = new Date().toISOString();
    stats.lastCheckedAt = stats.lastBackupAt;
    stats.dbBytes = buf.length;
    stats.uploads = out.uploads;
    stats.meetings = out.meetings;
    if (!cycleChanged) stats.skippedUnchanged++;
    stats.error = '';
    const payload = {
      lastBackupAt: stats.lastBackupAt,
      lastUploadAt: stats.lastUploadAt,
      lastCheckedAt: stats.lastCheckedAt,
      skippedUnchanged: stats.skippedUnchanged,
      dbBytes: stats.dbBytes,
      dbStoredBytes: stats.dbStoredBytes,
      uploads: stats.uploads,
      meetings: stats.meetings,
      writesToday: stats.writesToday,
      budget: WRITE_BUDGET,
      deletesToday: stats.deletesToday,
      prunedToday: stats.prunedToday,
      retentionDays: RETENTION_DAYS,
      skippedBudget: stats.skippedBudget
    };
    if (cycleChanged || Date.now() - lastStatsPutAt >= STATS_MIN_INTERVAL_MS) {
      if (await putBufCounted_(BASE + '/stats', Buffer.from(JSON.stringify(payload)))) {
        lastStatsPutAt = Date.now();
      }
    }
    if (cycleChanged) {
      console.log('[data-sync] backup pushed: db=' +
        (dbChanged ? out.dbBytes + 'B (gzip ' + out.dbStoredBytes + 'B)' : 'unchanged') +
        ', uploads=' + out.uploads + ', meetings=' + out.meetings +
        ', writesToday=' + stats.writesToday + '/' + WRITE_BUDGET);
    } else {
      console.log('[data-sync] snapshot unchanged — no upload (checked ' +
        stats.skippedUnchanged + 'x, last upload ' + (stats.lastUploadAt || 'never') + ')');
    }
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
    uploadedFileHashes.delete(kind + '/' + safe);
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
    lastUploadAt: stats.lastUploadAt || null,
    lastCheckedAt: stats.lastCheckedAt || null,
    dbBytes: stats.dbBytes,
    dbStoredBytes: stats.dbStoredBytes,
    uploads: stats.uploads,
    meetings: stats.meetings,
    error: stats.error || null,
    writesToday: stats.writesToday,
    budget: WRITE_BUDGET,
    budgetLeft: budgetLeft(),
    deletesToday: stats.deletesToday,
    prunedToday: stats.prunedToday,
    retentionDays: RETENTION_DAYS,
    skippedUnchanged: stats.skippedUnchanged,
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

module.exports = {
  enabled, restoreData, backupData, startAutoSync, requestBackup, getBackupStatus, deleteRemoteFile, enforceRetention_, retentionCutoff_, RETENTION_DAYS,
  // Test hook: run the orphan sweep regardless of its hourly throttle.
  async _runCleanupOrphanedKeysForTest() {
    lastCleanupAt = 0;
    await cleanupOrphanedKeys_();
  },
  // Test hook: gzip/raw snapshot detection shared with restoreData.
  _decodeSnapshotForTest(buf) {
    return decodeSnapshot_(buf);
  },
  // Test hook: forget in-process dedupe state so a test starts from a cold
  // process (a real restart always uploads once).
  _resetDedupeForTest() {
    lastUploadedDbHash = '';
    uploadedFileHashes.clear();
    lastStatsPutAt = 0;
  }
};

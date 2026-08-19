/**
 * ============================================================
 * India Post Dashboard — Node port
 * auto-sync.js
 * Periodic background sync: keeps the origin spreadsheet and the
 * SQLite DB in step without manual "Sync from Google Sheet" clicks.
 *
 * Every interval it runs pullFromSheet() (and pushToSheet() when a
 * write credential is configured), then logs a one-line summary.
 * Runs are idempotent (pull upserts by row) and guarded so an
 * overlapping run is skipped rather than stacked.
 *
 * Configured via env:
 *   DASH_AUTO_SYNC_MINUTES  interval in minutes (default 15, minimum 5;
 *                           0 disables the trigger entirely).
 * ============================================================
 */

let timer = null;
let running = false;
let lastRun = null; // {at, pull, push} or {at, error} from the most recent pass

/** Resolves the configured interval in minutes (0 = disabled).
 *  Sync is now button-only by default: unless DASH_AUTO_SYNC_MINUTES is
 *  explicitly set to a positive number, no periodic sync runs. */
function intervalMinutes() {
  const rawEnv = process.env.DASH_AUTO_SYNC_MINUTES;
  if (rawEnv === undefined || rawEnv === null || String(rawEnv).trim() === '') return 0; // unset → off
  const raw = Number(rawEnv);
  if (raw === 0) return 0; // explicit 0 disables
  if (!isFinite(raw) || raw <= 0) return 0; // invalid → off
  return Math.max(5, Math.round(raw));
}

/**
 * Runs one sync pass (pull, then push when a write credential exists).
 * Never throws — failures are returned/logged so the interval survives.
 * @returns {Promise<Object>} {pull, push} summary or {skipped:true} when a
 *   run is already in flight.
 */
async function runAutoSyncOnce() {
  if (running) return { skipped: true };
  running = true;
  try {
    const sync = require('./sync-sheet');
    const pulled = await sync.pullFromSheet();
    let pushed = null;
    if (sync.writeCredentialConfigured()) {
      try {
        pushed = await sync.pushToSheet();
      } catch (err) {
        pushed = { pushed: false, ok: false, reason: (err && err.message) || String(err) };
      }
    } else {
      pushed = { pushed: false, ok: false, reason: 'write credential not configured' };
    }
    console.log('[auto-sync] ' + new Date().toISOString() +
      ' pull: ' + JSON.stringify({
        sheetRows: pulled.sheetRows,
        inserted: pulled.inserted,
        updated: pulled.updated,
        linksRead: pulled.linksRead,
        linksSource: pulled.linksSource
      }) +
      ' push: ' + JSON.stringify(pushed));
    lastRun = { at: new Date().toISOString(), pull: pulled, push: pushed };
    return { pull: pulled, push: pushed };
  } catch (err) {
    const message = (err && err.message) || String(err);
    console.error('[auto-sync] run failed: ' + message);
    lastRun = { at: new Date().toISOString(), error: message };
    return { error: message };
  } finally {
    running = false;
  }
}

/**
 * Current auto-sync configuration + most recent run (for the Settings UI).
 * Auto-sync is disabled at the code level (no startAutoSync call), so
 * this always reports enabled:false regardless of the env var.
 * @returns {{enabled: boolean, intervalMinutes: number, lastRun: Object|null}}
 */
function getSyncStatus() {
  return {
    enabled: false,
    intervalMinutes: 0,
    lastRun: lastRun
  };
}

/**
 * Starts the periodic sync timer. Safe to call more than once (no-op when
 * already running). The first run happens shortly after boot so the DB
 * catches up quickly; subsequent runs follow the configured interval.
 * @returns {NodeJS.Timeout|null} The timer, or null when disabled.
 */
function startAutoSync() {
  if (timer) return timer;
  const minutes = intervalMinutes();
  if (!minutes) {
    console.log('[auto-sync] disabled (DASH_AUTO_SYNC_MINUTES=0)');
    return null;
  }
  const ms = minutes * 60 * 1000;
  setTimeout(function () { runAutoSyncOnce(); }, 30000);
  timer = setInterval(runAutoSyncOnce, ms);
  console.log('[auto-sync] scheduled every ' + minutes + ' min (DASH_AUTO_SYNC_MINUTES)');
  return timer;
}

/** Stops the periodic timer (used by tests). */
function stopAutoSync() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { startAutoSync, stopAutoSync, runAutoSyncOnce, intervalMinutes, getSyncStatus };

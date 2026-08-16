/**
 * start.js — container entrypoint.
 * Boots the server and prints any startup error to stderr so Railway/Render
 * logs reveal the real cause (native module load, db open, port bind) instead
 * of a silent exit that fails the healthcheck.
 */
function fail(err) {
  console.error('[start] FATAL startup error: ' + (err && err.stack || err));
  process.exit(1);
}

process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);

(async function boot() {
  try {
    // 1. Persistent-disk bridge (Render free): restore the last DB + uploads
    //    snapshot from the worker's KV store BEFORE the SQLite file is opened.
    const dataSync = require('./data-sync');
    await dataSync.restoreData();

    // 2. No first-boot CSV import: the baked-in src/server/migration-export/*
    //    snapshot is stale and must not feed the dashboard. Restored KV
    //    snapshot (step 1) or a brand-new empty DB is the source of truth.

    // 3. Boot the server.
    const app = require('./index');
    const port = Number(process.env.PORT || 8787);
    const server = app.server;

    server.on('error', fail);

    if (!server.listening) {
      server.listen(port, function () {
        console.log('[start] listening on ' + port);
        // 4. Keep the KV snapshot fresh (DB + uploads) so the next redeploy
        //    restores close-to-current data. No-op unless DATA_SYNC_URL set.
        try { dataSync.startAutoSync(); } catch (syncErr) {
          console.error('[start] data-sync start warning: ' + (syncErr && syncErr.message));
        }
        // 5. Periodic spreadsheet <-> SQLite sync (auto-sync.js). index.js only
        //    starts it when run directly (require.main === module); production
        //    boots via this launcher, so start it here.
        try { require('./auto-sync').startAutoSync(); } catch (syncErr) {
          console.error('[start] sheet auto-sync start warning: ' + (syncErr && syncErr.message));
        }
      });
    }
  } catch (err) {
    fail(err);
  }
})();

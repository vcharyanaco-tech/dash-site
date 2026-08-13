/**
 * start.js — container entrypoint.
 * Boots the server and prints any startup error to stderr so Railway logs
 * reveal the real cause (native module load, db open, port bind) instead of
 * a silent exit that fails the healthcheck.
 */
function fail(err) {
  console.error('[start] FATAL startup error: ' + (err && err.stack || err));
  process.exit(1);
}

process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);

try {
  // One-time data import: if a data/export/*.csv set is present (e.g. baked
  // into the image for first-boot migration), import it, then it's harmless
  // on subsequent boots (INSERT OR IGNORE skips existing rows).
  const fs = require('fs');
  const path = require('path');
  const exportDir = path.join(__dirname, 'migration-export');
  const needImport = fs.existsSync(exportDir) &&
    fs.existsSync(path.join(exportDir, 'records.csv'));
  if (needImport) {
    try {
      console.log('[start] found export CSVs — running one-time import...');
      process.env.DASH_IMPORT_DIR = exportDir;
      require('./import-from-gas').main();
      console.log('[start] import complete.');
    } catch (impErr) {
      console.error('[start] import warning: ' + (impErr && impErr.message));
    }
  }

  const app = require('./index');
  const port = Number(process.env.PORT || 8787);
  const server = app.server;

  server.on('error', fail);

  if (!server.listening) {
    server.listen(port, function () {
      console.log('[start] listening on ' + port);
    });
  }
} catch (err) {
  fail(err);
}

/**
 * start.js — container entrypoint.
 * Boots the server and prints any startup error to stderr so Railway logs
 * reveal the real cause (native module load, db open, port bind) instead of
 * a silent exit that fails the healthcheck.
 */
try {
  const app = require('./index');
  const port = Number(process.env.PORT || 8787);
  const server = app.server;
  server.on('error', function (err) {
    console.error('[start] server error: ' + (err && err.stack || err));
    process.exit(1);
  });
  // index.js already listens when run as main; ensure it listens on the
  // Railway-injected PORT even if index.js defaulted differently.
  if (typeof server.listening === 'undefined' || !server.listening) {
    server.listen(port, function () {
      console.log('[start] listening on ' + port);
    });
  }
} catch (err) {
  console.error('[start] FATAL startup error: ' + (err && err.stack || err));
  process.exit(1);
}

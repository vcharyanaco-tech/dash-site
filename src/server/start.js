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

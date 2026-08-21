/**
 * ============================================================
 * India Post Dashboard — Node port
 * events.js
 * Server-Sent Events (SSE) endpoint for real-time dashboard
 * updates. Clients connect to GET /api/events and receive
 * push notifications when records, submissions, tasks, or
 * audit entries change.
 *
 * Usage: require('./events').broadcast('recordChanged', { row: 5 });
 * ============================================================
 */

// Set of active SSE response objects
const clients = new Set();

// Heartbeat every 30s to keep connections alive
const HEARTBEAT_MS = 30 * 1000;
let heartbeatTimer = null;

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(function () {
    for (const client of clients) {
      try { client.write(': heartbeat\n\n'); } catch (e) { clients.delete(client); }
    }
  }, HEARTBEAT_MS);
  if (heartbeatTimer.unref) heartbeatTimer.unref();
}

/**
 * Register an Express GET route for SSE.
 * GET /api/events — streams events as text/event-stream.
 */
function registerSseRoute(app, apiPrefix) {
  app.get(apiPrefix + '/events', function (req, res) {
    // SSE requires no buffering
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial connection event
    res.write('event: connected\ndata: {}\n\n');

    clients.add(res);
    startHeartbeat();

    req.on('close', function () {
      clients.delete(res);
    });
  });
}

/**
 * Broadcast an event to all connected SSE clients.
 * @param {string} event - Event name (e.g. 'recordChanged', 'submissionAdded')
 * @param {object} data - Payload (will be JSON-serialized)
 */
function broadcast(event, data) {
  const payload = 'event: ' + event + '\ndata: ' + JSON.stringify(data || {}) + '\n\n';
  for (const client of clients) {
    try { client.write(payload); } catch (e) { clients.delete(client); }
  }
}

function getClientCount() {
  return clients.size;
}

module.exports = { registerSseRoute, broadcast, getClientCount };

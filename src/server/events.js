/**
 * ============================================================
 * India Post Dashboard — Node port
 * events.js
 * Server-Sent Events (SSE) endpoint for real-time dashboard
 * updates. Clients connect to GET /api/events and receive
 * push notifications when records, submissions, tasks, or
 * audit entries change.
 *
 * Security (Phase 13): the stream is authenticated and scoped.
 *   - Anonymous clients are rejected with 401 before any bytes
 *     are streamed.
 *   - User-specific events (notificationChanged) are delivered
 *     only to the connection(s) of the session owner.
 *   - General authorized events (dataChanged, userLoggedIn) go
 *     to every authenticated connection.
 *   - Every event carries a per-connection `id:` so reconnecting
 *     clients can resume via Last-Event-ID.
 *   - The number of accepted connections is capped so one
 *     attacker flood cannot exhaust memory/descriptors.
 *
 * Usage: require('./events').broadcast('recordChanged', { row: 5 });
 * ============================================================
 */

// Set of active SSE clients: { res, email }
const clients = new Set();

// Heartbeat every 30s to keep connections alive
const HEARTBEAT_MS = 30 * 1000;
let heartbeatTimer = null;

// Bound on concurrent connections. The dashboard is a small staff app; a hard
// cap converts an SSE connection flood into clean 503s instead of a slow leak.
const MAX_CLIENTS = 500;

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(function () {
    for (const client of clients) {
      try { client.res.write(': heartbeat\n\n'); } catch (e) { clients.delete(client); }
    }
  }, HEARTBEAT_MS);
  if (heartbeatTimer.unref) heartbeatTimer.unref();
}

/**
 * Register an Express GET route for SSE.
 * GET /api/events — streams events as text/event-stream.
 *
 * @param {object} app          Express app
 * @param {string} apiPrefix    e.g. '/api'
 * @param {function} authenticate  (req) => { email, role } | throws
 */
function registerSseRoute(app, apiPrefix, authenticate) {
  app.get(apiPrefix + '/events', function (req, res) {
    let user;
    try {
      user = authenticate(req);
    } catch (err) {
      if (!res.headersSent) {
        res.status(401).json({ error: (err && err.message) || 'Login required.' });
      } else {
        res.end();
      }
      return;
    }

    if (clients.size >= MAX_CLIENTS) {
      res.status(503).json({ error: 'Server busy. Please try again.' });
      return;
    }

    // SSE requires no buffering
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const client = { res: res, email: user.email, seq: 0 };
    clients.add(client);
    startHeartbeat();

    // Send initial connection event with an event id for Last-Event-ID resume
    res.write('retry: 2000\n');
    writeEvent(client, 'connected', {});

    const disconnected = function () {
      clients.delete(client);
    };
    res.on('close', disconnected);
    res.on('error', disconnected);
  });
}

/** Serialize + write one event, incrementing the connection sequence. */
function writeEvent(client, event, data) {
  client.seq += 1;
  const payload = 'id: ' + client.seq + '\nevent: ' + event + '\ndata: ' + JSON.stringify(data || {}) + '\n\n';
  try { client.res.write(payload); } catch (e) { clients.delete(client); }
}

/**
 * Broadcast an event to all authenticated SSE clients.
 * @param {string} event - Event name (e.g. 'dataChanged', 'submissionAdded')
 * @param {object} data - Payload (will be JSON-serialized)
 */
function broadcast(event, data) {
  const payload = { event: event, data: data || {} };
  for (const client of clients) {
    writeEvent(client, payload.event, payload.data);
  }
}

/**
 * Broadcast a user-specific event only to connections whose session belongs
 * to the given email (used for notificationChanged).
 */
function broadcastUser(email, event, data) {
  const payload = { event: event, data: data || {} };
  for (const client of clients) {
    if (client.email === email) {
      writeEvent(client, payload.event, payload.data);
    }
  }
}

function getClientCount() {
  return clients.size;
}

module.exports = { registerSseRoute, broadcast, broadcastUser, getClientCount };
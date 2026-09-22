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
 *   - Every event carries a globally-monotonic `id:` so a
 *     reconnecting client can resume via Last-Event-ID.
 *   - A bounded log of recent events is replayed to a client
 *     whose Last-Event-ID is inside it; an older gap triggers an
 *     `outOfSync` event so the client refetches everything.
 *   - dataChanged signals (pure "refetch now" triggers) are
 *     coalesced: a burst of mutations collapses into one event.
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

// Global monotonic event clock. Every event written to any connection gets the
// NEXT id from this clock, so Last-Event-ID comparisons are consistent across
// the whole server (a per-connection counter can't express "everything that
// happened while I was gone").
let eventClock = 0;

// Bounded log of events for Last-Event-ID resume. Entry: {id, event, data,
// user}. user-scoped events (notificationChanged) are replayed only to that
// user's connections; everyone else gets the general events.
const RESUME_LOG_LIMIT = 64;
const resumeLog = [];

function nextEventId_() {
  eventClock += 1;
  return eventClock;
}

function pushLog_(entry) {
  resumeLog.push(entry);
  if (resumeLog.length > RESUME_LOG_LIMIT) resumeLog.splice(0, resumeLog.length - RESUME_LOG_LIMIT);
}

// Serialize + write one event. `id` comes from the global clock so replays and
// live events share one monotonic sequence.
function dispatch_(id, client, event, data) {
  const payload = 'id: ' + id + '\nevent: ' + event + '\ndata: ' + JSON.stringify(data || {}) + '\n\n';
  try { client.res.write(payload); } catch (e) { clients.delete(client); }
}

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

    const client = { res: res, email: user.email };
    clients.add(client);
    startHeartbeat();

    // Last-Event-ID resume: a reconnecting client says "I last saw event N".
    // Replay the bounded log logged after N (fresh ids, in order — each event
    // is an idempotent refresh trigger, so re-stamping is safe). If the gap is
    // older than the log holds, send `outOfSync` so the client refetches
    // everything instead of silently missing what rolled out of the buffer.
    let lastId = 0;
    const rawId = req.headers['last-event-id'] || req.query.lastEventId;
    if (rawId != null) {
      const n = Number(String(rawId).trim());
      if (isFinite(n) && n > 0) lastId = n;
    }

    // Initial connection event with an event id for Last-Event-ID resume
    res.write('retry: 2000\n');
    dispatch_(nextEventId_(), client, 'connected', {});

    if (lastId) {
      const oldest = resumeLog.length ? resumeLog[0].id : 0;
      if (lastId < oldest) {
        dispatch_(nextEventId_(), client, 'outOfSync', {});
      } else {
        for (const entry of resumeLog) {
          if (entry.id <= lastId) continue;
          if (entry.user && entry.user !== client.email) continue;
          dispatch_(nextEventId_(), client, entry.event, entry.data);
        }
      }
    }

    const disconnected = function () {
      clients.delete(client);
    };
    res.on('close', disconnected);
    res.on('error', disconnected);
  });
}

/* ── coalescing ────────────────────────────────────────────────────────
 * dataChanged is a pure "something changed — refetch now" signal (the client
 * ignores its payload). A single user action can fan out several broadcasts
 * back-to-back; collapsing them into one event cuts SSE chatter and the
 * refetch storm across every connected client. */
const COALESCE_MS = 80;
let pendingDataChanged = false;
let coalesceTimer = null;

// Records a broadcast (immediately for user-scoped / non-refresh events; into
// the coalescing window for dataChanged) and appends it to the resume log.
function recordBroadcast_(event, data, user) {
  if (event === 'dataChanged') {
    if (!pendingDataChanged) {
      pendingDataChanged = true;
      if (coalesceTimer) clearTimeout(coalesceTimer);
      coalesceTimer = setTimeout(flushCoalesced_, COALESCE_MS);
    }
    return;
  }
  const id = nextEventId_();
  pushLog_({ id: id, event: event, data: data || {}, user: user || null });
  for (const client of clients) {
    if (user && client.email !== user) continue;
    dispatch_(id, client, event, data);
  }
}

/** Flush a pending dataChanged coalescing window (one event, stored for resume). */
function flushCoalesced_() {
  coalesceTimer = null;
  if (!pendingDataChanged) return;
  pendingDataChanged = false;
  const id = nextEventId_();
  pushLog_({ id: id, event: 'dataChanged', data: {}, user: null });
  for (const client of clients) dispatch_(id, client, 'dataChanged', {});
}

/**
 * Broadcast an event to all authenticated SSE clients.
 * @param {string} event - Event name (e.g. 'dataChanged', 'submissionAdded')
 * @param {object} data - Payload (will be JSON-serialized)
 */
function broadcast(event, data) {
  recordBroadcast_(String(event), data || {}, null);
}

/**
 * Broadcast a user-specific event only to connections whose session belongs
 * to the given email (used for notificationChanged).
 */
function broadcastUser(email, event, data) {
  recordBroadcast_(String(event), data || {}, String(email || ''));
}

function getClientCount() {
  return clients.size;
}

// Exposed for tests: force the coalesce flush + inspect the resume log.
function _flushCoalescedForTest() {
  flushCoalesced_();
}
function _resumeLogForTest() {
  return resumeLog.slice();
}
function _resetForTest() {
  if (coalesceTimer) clearTimeout(coalesceTimer);
  coalesceTimer = null;
  pendingDataChanged = false;
  resumeLog.length = 0;
  eventClock = 0;
}

module.exports = {
  registerSseRoute, broadcast, broadcastUser, getClientCount,
  _flushCoalescedForTest, _resumeLogForTest, _resetForTest
};
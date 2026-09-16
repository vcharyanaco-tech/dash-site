/**
 * ============================================================
 * India Post Dashboard — Node port
 * index.js
 * Express server: static frontend + POST /api dispatcher (client
 * arg order) + GET /files/:key document streaming + CORS + health.
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');

const crypto = require('crypto');
const { db, seedDefaultSettings } = require('./db');
const auth = require('./auth');
const dispatch = require('./index-dispatch');
const { rateLimiter } = require('./rate-limiter');
const { registerSseRoute, broadcast } = require('./events');
const { cspMiddleware } = require('./csp');

const PORT = Number(process.env.PORT || process.env.DASH_PORT || 8787);
const STATIC_ROOT = process.env.DASH_STATIC_ROOT || path.join(__dirname, '..', '..');
const API_PREFIX = '/api';
const SESSION_COOKIE = 'dash_session';
const AUTH_ARG_INDEX = Object.freeze({
  getAppData: 0, addItem: 1, updateItem: 1, deleteItem: 1,
  markReviewDone: 1, markReviewNotDone: 1, logout: 0, validateSession: 0,
  refreshSession: 0, changePassword: 2, adminGetUsers: 0, adminAddUser: 7,
  adminUpdateUser: 2, adminExportUsers: 0, adminImportUsers: 1,
  adminGetUserActivity: 0, adminDeleteUser: 1, adminResetPassword: 2,
  adminEmailAllUsers: 2, getAssignableUsers: 0, getMyNotifications: 0,
  markNotificationsRead: 1, clearMyNotifications: 0, getTaskCounts: 0,
  createTask: 1, getTasks: 1, getMyTasks: 0, updateTask: 2, deleteTask: 1,
  getDashboardPreferences: 0, saveDashboardPreferences: 1,
  getReportData: 1, exportToSpreadsheet: 0, createPdfReport: 0,
  emailReport: 0, getRecordDocuments: 1, uploadDocument: 5,
  deleteDocument: 1, setDocumentKeep: 2, getSubmissions: 0,
  addSubmission: 3, updateSubmission: 2, lockSubmission: 1,
  unlockSubmission: 1, deleteSubmission: 1, markAllSubmissionsRead: 0,
  toggleSubmissionDisplay: 1, adminDeleteAuditRows: 1, adminClearAudit: 0,
  exportReviewCalendarIcs: 0, sendWhatsAppReviewReminders: 0,
  getAiInsights: 0, getCardAiInsight: 0, getLinkContentAiInsight: 0,
  askLinkAi: 0, getAllAskLinkHistory: 0, saveAskLinkHistory: 0,
  processMeetingRecording: 1, transcribeMeetingSegment: 1,
  generateMeetingMinutes: 1, listMeetingFiles: 0, getMeetingFile: 0,
  deleteMeetingFile: 0, getFathomStatus: 0, setFathomApiKey: 0,
  listFathomMeetings: 0, getFathomMeetingContent: 0,
  getRecordingDownloadLink: 0, listFathomUsers: 0, searchFathomMeetings: 0,
  getFathomMeetingStats: 0, bulkGetRecordingDownloadLinks: 0,
  subscribePush: 1, unsubscribePush: 1, sendReviewDeadlinePushNotifications: 0,
  sendWeeklyReport: 0, adminImportCsv: 1
});

// ── Trusted origins for CORS ─────────────────────────────────────────────
const TRUSTED_ORIGINS = new Set([
  'https://dashboardharyana.site',
  'https://www.dashboardharyana.site',
  'https://vcharyanaco-tech.github.io'
]);
if (process.env.NODE_ENV !== 'production') {
  TRUSTED_ORIGINS.add('http://localhost:3000');
  TRUSTED_ORIGINS.add('http://localhost:8080');
  TRUSTED_ORIGINS.add('http://localhost:8787');
}

// NOTE: Per-IP rate limiting is applied server-side as well as by
// the Cloudflare Worker. Local dev has no Cloudflare, so the
// server-side limiter is the only protection.
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_DISABLED !== '1';
const metrics = {
  requests: 0,
  errors: 0,
  latencies: []
};

// NOTE: the baked-in src/server/migration-export/*.csv snapshot is no longer
// auto-imported on boot. The live SQLite DB (restored from the KV backup
// bridge by data-sync.js when the local file is absent) is the single source
// of truth; the CSVs are stale by construction and must not feed the
// dashboard. Use the manual tools (npm run import/export + adminSyncFromSheet)
// if a deliberate one-time restore is ever needed.

seedDefaultSettings();
try {
  auth.ensureBootstrapAdmin();
} catch (err) {
  console.error('Bootstrap admin seeding failed: ' + err.message);
}

const app = express();
app.disable('x-powered-by');

app.use(function (req, res, next) {
  const started = Date.now();
  metrics.requests++;
  res.on('finish', function () {
    const latency = Date.now() - started;
    metrics.latencies.push(latency);
    if (metrics.latencies.length > 2000) metrics.latencies.shift();
    if (res.statusCode >= 500) metrics.errors++;
  });
  next();
});

app.use(cspMiddleware);
if (RATE_LIMIT_ENABLED) app.use(rateLimiter);

app.use(function (req, res, next) {
  // Item 2: Restrict CORS to trusted origins only
  const origin = req.headers.origin || '';
  if (origin && TRUSTED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Item 3: Content-Security-Policy for all responses (uses per-request nonce)
  // NOTE: CSP is now set by cspMiddleware before this point.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.static(STATIC_ROOT, {
  index: false,
  maxAge: '1h',
  setHeaders: function (res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

app.get(API_PREFIX + '/health', function (req, res) {
  // Surface the KV backup bridge state so a quota/backup problem is visible
  // in a health check instead of silently widening the redeploy data-loss window.
  let dataSync = null;
  try { dataSync = require('./data-sync').getBackupStatus(); } catch (err) { dataSync = { error: String(err && err.message || err) }; }
  // SQLite connectivity check
  let sqliteOk = false;
  try { const row = db.prepare('SELECT 1 AS ping').get(); sqliteOk = !!(row && row.ping === 1); } catch (e) { sqliteOk = false; }
  const mem = process.memoryUsage();
  const latencySamples = metrics.latencies.slice().sort(function (a, b) { return a - b; });
  const p95Index = latencySamples.length ? Math.min(latencySamples.length - 1, Math.ceil(latencySamples.length * 0.95) - 1) : 0;
  let dbSize = 0;
  try { dbSize = fs.statSync(require('./db').DB_PATH).size; } catch (err) {}
  res.json({
    ok: true,
    name: 'India Post Dashboard server',
    port: PORT,
    now: Date.now(),
    uptime: Math.round(process.uptime()),
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024)
    },
    sqlite: { ok: sqliteOk },
    database: { sizeBytes: dbSize },
    metrics: {
      requestCount: metrics.requests,
      errorCount: metrics.errors,
      p95LatencyMs: latencySamples.length ? latencySamples[p95Index] : 0
    },
    dataSync: dataSync
  });
});

function readBodyJson(req) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on('data', function (c) {
      size += c.length;
      if (size > 64 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Request body too large.'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', function () {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON body: ' + err.message));
      }
    });
    req.on('error', reject);
  });
}

app.post(API_PREFIX, async function (req, res) {
  try {
    const body = await readBodyJson(req);
    const fn = body && body.function;
    const args = body && Array.isArray(body.args) ? body.args : [];
    const fnRef = typeof fn === 'string' ? dispatch[fn] : null;
    if (typeof fnRef !== 'function') {
      res.json({ error: 'Unknown function: ' + fn });
      return;
    }
    const cookieToken = parseCookie_(req.headers.cookie || '')[SESSION_COOKIE] || '';
    const authIndex = AUTH_ARG_INDEX[fn];
    if (cookieToken && authIndex !== undefined && !args[authIndex]) {
      args[authIndex] = cookieToken;
    }
    // Item 8: Input validation for known functions
    const validator = VALIDATORS[fn];
    if (validator) {
      const validationError = validator(args);
      if (validationError) {
        res.json({ error: validationError });
        return;
      }
    }
    const result = await fnRef(args);
    if (fn === 'login' && result && result.success && result.token) {
      setSessionCookie_(res, result.token);
    } else if (fn === 'logout' && result && result.success) {
      clearSessionCookie_(res);
    }
    // Broadcast real-time SSE events for data-mutating functions
    const dataFns = ['addItem', 'updateItem', 'deleteItem', 'markReviewDone', 'markReviewNotDone',
      'addSubmission', 'updateSubmission', 'deleteSubmission', 'toggleSubmissionDisplay',
      'createTask', 'updateTask', 'deleteTask', 'setRecordDisplay', 'login'];
    if (dataFns.indexOf(fn) !== -1 && result && result.success !== false) {
      broadcast(fn === 'login' ? 'userLoggedIn' : 'dataChanged', { fn: fn });
    }
    res.json({ result: result === undefined ? null : result });
  } catch (err) {
    metrics.errors++;
    console.error('API request failed (' + String(fn || 'unknown') + '): ' + ((err && err.message) || String(err)));
    res.json({ error: (err && err.message) || String(err) });
  }
});

// Internal daily jobs (replaces the decommissioned GAS time-driven triggers:
// 9am review-reminder emails, 10am audit archival). Not part of the public
// dispatch — gated by the shared WORKER_API_TOKEN that the Worker uses for its
// own internal endpoints (/api/send-email etc.). The Worker cron fires this
// directly against SERVER_ORIGIN. sendReviewReminders is deliberately NOT in
// the public dispatch: its `if (token) auth.requireAdmin(token)` guard skips
// auth when called token-less (as GAS's trigger did), which would be a spam
// vector if exposed.
app.post(API_PREFIX + '/internal/daily-jobs', async function (req, res) {
  const authHeader = req.headers['authorization'] || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : '';
  const expected = process.env.WORKER_API_TOKEN || '';
  if (!expected || token !== expected) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }    try {
      const body = await readBodyJson(req);
      const job = body && body.job;
      let result;
      if (job === 'review-reminders') {
        result = require('./records').sendReviewReminders(undefined);
      } else if (job === 'archive-audit') {
        result = require('./audit').archiveAuditLog();
      } else if (job === 'weekly-report') {
        result = require('./weekly-reports').sendWeeklyReport(undefined);
      } else if (job === 'review-push-notifications') {
        result = require('./push-notifications').sendReviewDeadlinePushNotifications(undefined);
      } else {
        res.json({ error: 'Unknown job: ' + job });
        return;
      }
      res.json({ result: result === undefined ? null : result });
    } catch (err) {
      res.json({ error: (err && err.message) || String(err) });
    }
});

app.get(API_PREFIX + '/files/:key', function (req, res) {
  const documents = require('./documents');
  const token = parseCookie_(req.headers.cookie || '')[SESSION_COOKIE] || '';
  const found = documents.resolveDocumentFile(req.params.key, token);
  if (!found) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }
  const meta = found.meta;
  const isDownload = req.query.download === '1';
  res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', String(meta.size));
  res.setHeader('Content-Disposition', (isDownload ? 'attachment' : 'inline') + '; filename="' + String(meta.fileName || 'document').replace(/"/g, '') + '"');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(found.path);
});

function parseCookie_(header) {
  const cookies = {};
  String(header || '').split(';').forEach(function (part) {
    const separator = part.indexOf('=');
    if (separator === -1) return;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) {
      try { cookies[key] = decodeURIComponent(value); } catch (err) { cookies[key] = value; }
    }
  });
  return cookies;
}

function setSessionCookie_(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', SESSION_COOKIE + '=' + encodeURIComponent(token) +
    '; HttpOnly; SameSite=Lax; Path=/; Max-Age=21600' + secure);
}

function clearSessionCookie_(res) {
  res.setHeader('Set-Cookie', SESSION_COOKIE + '=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

app.get('/', function (req, res) {
  const indexPath = path.join(STATIC_ROOT, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.redirect('/app.html');
  }
});

/* ── Input validation ──────────────────────────────────────────────────────
 * Lightweight schema validation for known API functions. Catches malformed
 * requests before they reach the dispatch layer. Unknown functions still
 * fall through to the dispatch for a clean 'Unknown function' error.
 * ────────────────────────────────────────────────────────────────────────── */
const VALIDATORS = {
  login: function (args) {
    if (args.length < 2) return 'login requires (email, password)';
    if (typeof args[0] !== 'string' || typeof args[1] !== 'string') return 'login arguments must be strings';
    return null;
  },
  addItem: function (args) {
    if (args.length < 2) return 'addItem requires (item, token)';
    if (!args[0] || typeof args[0] !== 'object') return 'item must be an object';
    return null;
  },
  updateItem: function (args) {
    if (args.length < 2) return 'updateItem requires (item, token)';
    if (!args[0] || typeof args[0] !== 'object') return 'item must be an object';
    return null;
  },
  deleteItem: function (args) {
    if (args.length < 2) return 'deleteItem requires (row, token)';
    return null;
  },
  adminAddUser: function (args) {
    if (args.length < 8) return 'adminAddUser requires (email, username, role, password, group, department, office, token)';
    if (typeof args[0] !== 'string' || !args[0].trim()) return 'email is required';
    return null;
  },
  adminDeleteUser: function (args) {
    if (args.length < 2) return 'adminDeleteUser requires (email, token)';
    if (typeof args[0] !== 'string' || !args[0].trim()) return 'email is required';
    return null;
  },
  createTask: function (args) {
    if (args.length < 2) return 'createTask requires (params, token)';
    if (!args[0] || typeof args[0] !== 'object') return 'params must be an object';
    return null;
  },
  addSubmission: function (args) {
    if (args.length < 4) return 'addSubmission requires (cardRow, cardId, text, token)';
    return null;
  },
  reconcileRecordOrder: function (args) {
    if (args.length < 2) return 'reconcileRecordOrder requires (dryRun, token)';
    if (typeof args[0] !== 'boolean') return 'dryRun must be a boolean';
    return null;
  },
  uploadDocument: function (args) {
    if (args.length < 6) return 'uploadDocument requires (row, recordId, fileName, fileBytes, mimeType, token)';
    return null;
  }
};

const server = http.createServer(app);
server.on('error', function (err) {
  console.error('Server error: ' + err.message);
});

// Register SSE route for real-time updates
registerSseRoute(app, API_PREFIX);

if (require.main === module) {
  server.listen(PORT, function () {
    console.log('India Post Dashboard server listening on http://localhost:' + PORT);
    console.log('API dispatcher: POST http://localhost:' + PORT + API_PREFIX);
    console.log('SSE endpoint: GET http://localhost:' + PORT + API_PREFIX + '/events');
    console.log('Rate limiting: ' + (RATE_LIMIT_ENABLED ? 'enabled' : 'disabled'));
    // Spreadsheet sync is BUTTON-ONLY: no auto-sync timer.
  });
}

module.exports = { app, server, dispatch };

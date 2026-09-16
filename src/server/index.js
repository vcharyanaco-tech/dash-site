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
  getAuditEntries: 1, getRecordHistory: 1,
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
  sendWeeklyReport: 0, adminImportCsv: 1,
  setupEnterpriseAddons: 0, installEnterpriseTriggers: 0,
  validateEnterpriseConfiguration: 0, getEnterpriseHealth: 0,
  getEnterpriseFrontendConfig: 0,
  setRecordDisplay: 2, generateReviewNotifications: 0,
  reconcileRecordOrder: 1, exportFullBackup: 0,
  adminSyncFromSheet: 0, adminPreviewSyncFromSheet: 0, adminPushToSheet: 0,
  setOpenRouterApiKey: 0, setGeminiApiKey: 0, setGroqApiKey: 0,
  setHuggingFaceApiKey: 0, setKiloApiKey: 0
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
  let fn = 'unknown';
  try {
    const body = await readBodyJson(req);
    fn = body && body.function;
    const args = body && Array.isArray(body.args) ? body.args : [];
    const fnRef = typeof fn === 'string' ? dispatch[fn] : null;
    if (typeof fnRef !== 'function') {
      res.json({ error: 'Unknown function: ' + fn });
      return;
    }
    const cookieToken = parseCookie_(req.headers.cookie || '')[SESSION_COOKIE] || '';
    const authIndex = AUTH_ARG_INDEX[fn];
    if (cookieToken && authIndex !== undefined) {
      const slot = args[authIndex];
      const looksLikeToken = typeof slot === 'string' && /^[0-9a-f]{64}$/i.test(slot);
      if (looksLikeToken) {
        // Token slot already holds a session token — the cookie is authoritative.
        args[authIndex] = cookieToken;
      } else {
        // Slot is empty or holds data: for token-first ops the data commonly
        // occupies the token slot (e.g. the browser sends ['apiKey'] or
        // [cardRow] for a (token, data…) op). The HttpOnly cookie is the
        // auth source of truth, so the cookie token is inserted at the
        // documented index, shifting any data rightward. Session tokens are
        // 64 hex chars (uuid_()+uuid_()), so real data (numbers, objects,
        // short strings) never collides with this branch.
        args.splice(authIndex, 0, cookieToken);
      }
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
  },
  changePassword: function (args) {
    if (args.length < 3) return 'changePassword requires (currentPassword, newPassword, token)';
    if (typeof args[0] !== 'string' || typeof args[1] !== 'string') return 'passwords must be strings';
    return null;
  },
  markReviewDone: function (args) {
    if (args.length < 2) return 'markReviewDone requires (row, token)';
    return null;
  },
  markReviewNotDone: function (args) {
    if (args.length < 2) return 'markReviewNotDone requires (row, token)';
    return null;
  },
  adminUpdateUser: function (args) {
    if (args.length < 3) return 'adminUpdateUser requires (email, fields, token)';
    if (typeof args[0] !== 'string' || !args[0].trim()) return 'email is required';
    if (!args[1] || typeof args[1] !== 'object') return 'fields must be an object';
    return null;
  },
  emailReport: function (args) {
    if (args.length < 3) return 'emailReport requires (token, recipient, templateKey)';
    if (typeof args[1] !== 'string' || !args[1].trim()) return 'recipient is required';
    return null;
  },
  getReportData: function (args) {
    if (args.length < 2) return 'getReportData requires (token, templateKey)';
    return null;
  },
  exportFullBackup: function (args) {
    if (args.length < 1) return 'exportFullBackup requires (token)';
    return null;
  },
  setOpenRouterApiKey: function (args) {
    if (args.length < 2) return 'setOpenRouterApiKey requires (token, apiKey)';
    if (typeof args[1] !== 'string' || !args[1].trim()) return 'apiKey is required';
    return null;
  },
  setGeminiApiKey: function (args) {
    if (args.length < 2) return 'setGeminiApiKey requires (token, apiKey)';
    if (typeof args[1] !== 'string' || !args[1].trim()) return 'apiKey is required';
    return null;
  },
  setGroqApiKey: function (args) {
    if (args.length < 2) return 'setGroqApiKey requires (token, apiKey)';
    if (typeof args[1] !== 'string' || !args[1].trim()) return 'apiKey is required';
    return null;
  },
  setHuggingFaceApiKey: function (args) {
    if (args.length < 2) return 'setHuggingFaceApiKey requires (token, apiKey)';
    if (typeof args[1] !== 'string' || !args[1].trim()) return 'apiKey is required';
    return null;
  },
  setKiloApiKey: function (args) {
    if (args.length < 2) return 'setKiloApiKey requires (token, apiKey)';
    if (typeof args[1] !== 'string' || !args[1].trim()) return 'apiKey is required';
    return null;
  },
  // ── 1F: admin-mutating ops ───────────────────────────────────────────────
  adminImportUsers: function (args) {
    if (args.length < 2) return 'adminImportUsers requires (csv, token)';
    if (typeof args[0] !== 'string' || !args[0].trim()) return 'csv content is required';
    return null;
  },
  adminResetPassword: function (args) {
    if (args.length < 3) return 'adminResetPassword requires (email, newPassword, token)';
    if (typeof args[0] !== 'string' || !args[0].trim()) return 'email is required';
    if (typeof args[1] !== 'string' || !args[1].trim()) return 'newPassword is required';
    return null;
  },
  adminEmailAllUsers: function (args) {
    if (args.length < 3) return 'adminEmailAllUsers requires (subject, body, token)';
    if (typeof args[0] !== 'string' || !args[0].trim()) return 'subject is required';
    if (typeof args[1] !== 'string' || !args[1].trim()) return 'body is required';
    return null;
  },
  adminImportCsv: function (args) {
    if (args.length < 2) return 'adminImportCsv requires (csvText, token)';
    if (typeof args[0] !== 'string' || !args[0].trim()) return 'csvText is required';
    return null;
  },
  adminDeleteAuditRows: function (args) {
    if (args.length < 2) return 'adminDeleteAuditRows requires (rowNumbers, token)';
    if (!Array.isArray(args[0])) return 'rowNumbers must be an array';
    return null;
  },
  adminClearAudit: function (args) {
    if (args.length < 1) return 'adminClearAudit requires (token)';
    return null;
  },
  // ── 1F: file / data deletion ops ─────────────────────────────────────────
  deleteDocument: function (args) {
    if (args.length < 2) return 'deleteDocument requires (docId, token)';
    if (!args[0] && args[0] !== 0) return 'docId is required';
    return null;
  },
  deleteMeetingFile: function (args) {
    if (args.length < 2) return 'deleteMeetingFile requires (token, name)';
    if (typeof args[1] !== 'string' || !args[1].trim()) return 'name is required';
    return null;
  },
  deleteSubmission: function (args) {
    if (args.length < 2) return 'deleteSubmission requires (submissionId, token)';
    if (!args[0] && args[0] !== 0) return 'submissionId is required';
    return null;
  },
  deleteTask: function (args) {
    if (args.length < 2) return 'deleteTask requires (id, token)';
    if (!args[0] && args[0] !== 0) return 'id is required';
    return null;
  },
  // ── 1F: other high-risk mutating ops ─────────────────────────────────────
  updateTask: function (args) {
    if (args.length < 3) return 'updateTask requires (id, fields, token)';
    if (!args[0] && args[0] !== 0) return 'id is required';
    if (!args[1] || typeof args[1] !== 'object') return 'fields must be an object';
    return null;
  },
  updateSubmission: function (args) {
    if (args.length < 3) return 'updateSubmission requires (submissionId, text, token)';
    if (!args[0] && args[0] !== 0) return 'submissionId is required';
    if (typeof args[1] !== 'string' || !args[1].trim()) return 'text is required';
    return null;
  },
  lockSubmission: function (args) {
    if (args.length < 2) return 'lockSubmission requires (submissionId, token)';
    if (!args[0] && args[0] !== 0) return 'submissionId is required';
    return null;
  },
  unlockSubmission: function (args) {
    if (args.length < 2) return 'unlockSubmission requires (submissionId, token)';
    if (!args[0] && args[0] !== 0) return 'submissionId is required';
    return null;
  },
  toggleSubmissionDisplay: function (args) {
    if (args.length < 2) return 'toggleSubmissionDisplay requires (submissionId, token)';
    if (!args[0] && args[0] !== 0) return 'submissionId is required';
    return null;
  },
  markAllSubmissionsRead: function (args) {
    if (args.length < 1) return 'markAllSubmissionsRead requires (token)';
    return null;
  },
  setRecordDisplay: function (args) {
    if (args.length < 3) return 'setRecordDisplay requires (row, displayed, token)';
    if (!args[0] && args[0] !== 0) return 'row is required';
    if (typeof args[1] !== 'boolean') return 'displayed must be a boolean';
    return null;
  },
  setDocumentKeep: function (args) {
    if (args.length < 3) return 'setDocumentKeep requires (docId, keep, token)';
    if (!args[0] && args[0] !== 0) return 'docId is required';
    if (typeof args[1] !== 'boolean') return 'keep must be a boolean';
    return null;
  },
  saveDashboardPreferences: function (args) {
    if (args.length < 2) return 'saveDashboardPreferences requires (prefs, token)';
    if (!args[0] || typeof args[0] !== 'object') return 'prefs must be an object';
    return null;
  },
  markNotificationsRead: function (args) {
    if (args.length < 2) return 'markNotificationsRead requires (ids, token)';
    if (!Array.isArray(args[0])) return 'ids must be an array';
    return null;
  },
  subscribePush: function (args) {
    if (args.length < 2) return 'subscribePush requires (subscription, token)';
    if (!args[0] || typeof args[0] !== 'object') return 'subscription must be an object';
    return null;
  },
  unsubscribePush: function (args) {
    if (args.length < 2) return 'unsubscribePush requires (endpoint, token)';
    if (typeof args[0] !== 'string' || !args[0].trim()) return 'endpoint is required';
    return null;
  },
  setFathomApiKey: function (args) {
    if (args.length < 2) return 'setFathomApiKey requires (token, apiKey)';
    if (typeof args[1] !== 'string' || !args[1].trim()) return 'apiKey is required';
    return null;
  },
  exportReviewCalendarIcs: function (args) {
    if (args.length < 1) return 'exportReviewCalendarIcs requires (token)';
    return null;
  },
  createPdfReport: function (args) {
    if (args.length < 1) return 'createPdfReport requires (token)';
    return null;
  },
  exportToSpreadsheet: function (args) {
    if (args.length < 1) return 'exportToSpreadsheet requires (token)';
    return null;
  },
  sendWeeklyReport: function (args) {
    if (args.length < 1) return 'sendWeeklyReport requires (token)';
    return null;
  },
  sendReviewDeadlinePushNotifications: function (args) {
    if (args.length < 1) return 'sendReviewDeadlinePushNotifications requires (token)';
    return null;
  },
  // ── 1F: read / informational ops (public, no token) ──────────────────────
  getServerTime: function (args) {
    if (args.length > 0) return 'getServerTime takes no arguments';
    return null;
  },
  getData: function (args) {
    if (args.length > 0) return 'getData takes no arguments';
    return null;
  },
  getSyncStatus: function (args) {
    if (args.length > 0) return 'getSyncStatus takes no arguments';
    return null;
  },
  getReportTemplates: function (args) {
    if (args.length > 0) return 'getReportTemplates takes no arguments';
    return null;
  },
  getTranslations: function (args) {
    if (args.length > 1) return 'getTranslations requires (lang)';
    if (args.length === 1 && (typeof args[0] !== 'string' || !args[0].trim())) return 'lang must be a string';
    return null;
  },
  requestPasswordReset: function (args) {
    if (args.length < 1 || typeof args[0] !== 'string' || !args[0].trim()) return 'requestPasswordReset requires (identifier)';
    return null;
  },
  // ── 1F: read / informational ops (token-only, token@0) ───────────────────
  getAppData: function (args) {
    if (args.length < 1) return 'getAppData requires (token)';
    return null;
  },
  generateReviewNotifications: function (args) {
    if (args.length < 1) return 'generateReviewNotifications requires (token)';
    return null;
  },
  logout: function (args) {
    if (args.length < 1) return 'logout requires (token)';
    return null;
  },
  validateSession: function (args) {
    if (args.length < 1) return 'validateSession requires (token)';
    return null;
  },
  refreshSession: function (args) {
    if (args.length < 1) return 'refreshSession requires (token)';
    return null;
  },
  adminGetUsers: function (args) {
    if (args.length < 1) return 'adminGetUsers requires (token)';
    return null;
  },
  adminExportUsers: function (args) {
    if (args.length < 1) return 'adminExportUsers requires (token)';
    return null;
  },
  adminGetUserActivity: function (args) {
    if (args.length < 1) return 'adminGetUserActivity requires (token)';
    return null;
  },
  getAssignableUsers: function (args) {
    if (args.length < 1) return 'getAssignableUsers requires (token)';
    return null;
  },
  getMyNotifications: function (args) {
    if (args.length < 1) return 'getMyNotifications requires (token)';
    return null;
  },
  clearMyNotifications: function (args) {
    if (args.length < 1) return 'clearMyNotifications requires (token)';
    return null;
  },
  getTaskCounts: function (args) {
    if (args.length < 1) return 'getTaskCounts requires (token)';
    return null;
  },
  getMyTasks: function (args) {
    if (args.length < 1) return 'getMyTasks requires (token)';
    return null;
  },
  getDashboardPreferences: function (args) {
    if (args.length < 1) return 'getDashboardPreferences requires (token)';
    return null;
  },
  sendWhatsAppReviewReminders: function (args) {
    if (args.length < 1) return 'sendWhatsAppReviewReminders requires (token)';
    return null;
  },
  getAiInsights: function (args) {
    if (args.length < 1) return 'getAiInsights requires (token)';
    return null;
  },
  getAllAskLinkHistory: function (args) {
    if (args.length < 1) return 'getAllAskLinkHistory requires (token)';
    return null;
  },
  listMeetingFiles: function (args) {
    if (args.length < 1) return 'listMeetingFiles requires (token)';
    return null;
  },
  getFathomStatus: function (args) {
    if (args.length < 1) return 'getFathomStatus requires (token)';
    return null;
  },
  listFathomUsers: function (args) {
    if (args.length < 1) return 'listFathomUsers requires (token)';
    return null;
  },
  getFathomMeetingStats: function (args) {
    if (args.length < 1) return 'getFathomMeetingStats requires (token)';
    return null;
  },
  getEnterpriseFrontendConfig: function (args) {
    if (args.length < 1) return 'getEnterpriseFrontendConfig requires (token)';
    return null;
  },
  setupEnterpriseAddons: function (args) {
    if (args.length < 1) return 'setupEnterpriseAddons requires (token)';
    return null;
  },
  installEnterpriseTriggers: function (args) {
    if (args.length < 1) return 'installEnterpriseTriggers requires (token)';
    return null;
  },
  validateEnterpriseConfiguration: function (args) {
    if (args.length < 1) return 'validateEnterpriseConfiguration requires (token)';
    return null;
  },
  getEnterpriseHealth: function (args) {
    if (args.length < 1) return 'getEnterpriseHealth requires (token)';
    return null;
  },
  adminSyncFromSheet: function (args) {
    if (args.length < 1) return 'adminSyncFromSheet requires (token)';
    return null;
  },
  adminPreviewSyncFromSheet: function (args) {
    if (args.length < 1) return 'adminPreviewSyncFromSheet requires (token)';
    return null;
  },
  adminPushToSheet: function (args) {
    if (args.length < 1) return 'adminPushToSheet requires (token)';
    return null;
  },
  // ── 1F: read / informational ops (token-first with data) ──────────────────
  getSubmissions: function (args) {
    if (args.length < 1) return 'getSubmissions requires (token)';
    return null;
  },
  getCardAiInsight: function (args) {
    if (args.length < 2) return 'getCardAiInsight requires (token, row)';
    if (args[1] === undefined || args[1] === null) return 'row is required';
    return null;
  },
  getLinkContentAiInsight: function (args) {
    if (args.length < 2) return 'getLinkContentAiInsight requires (token, row)';
    if (args[1] === undefined || args[1] === null) return 'row is required';
    return null;
  },
  askLinkAi: function (args) {
    if (args.length < 3) return 'askLinkAi requires (token, row, question)';
    if (typeof args[2] !== 'string' || !args[2].trim()) return 'question is required';
    return null;
  },
  saveAskLinkHistory: function (args) {
    if (args.length < 3) return 'saveAskLinkHistory requires (token, row, history)';
    if (!Array.isArray(args[2])) return 'history must be an array';
    return null;
  },
  getMeetingFile: function (args) {
    if (args.length < 2) return 'getMeetingFile requires (token, name)';
    if (typeof args[1] !== 'string' || !args[1].trim()) return 'name is required';
    return null;
  },
  listFathomMeetings: function (args) {
    if (args.length < 1) return 'listFathomMeetings requires (token)';
    return null;
  },
  searchFathomMeetings: function (args) {
    if (args.length < 1) return 'searchFathomMeetings requires (token)';
    return null;
  },
  getFathomMeetingContent: function (args) {
    if (args.length < 2) return 'getFathomMeetingContent requires (token, recordingId)';
    if (args[1] === undefined || args[1] === null || args[1] === '') return 'recordingId is required';
    return null;
  },
  getRecordingDownloadLink: function (args) {
    if (args.length < 2) return 'getRecordingDownloadLink requires (token, recordingId)';
    if (args[1] === undefined || args[1] === null || args[1] === '') return 'recordingId is required';
    return null;
  },
  bulkGetRecordingDownloadLinks: function (args) {
    if (args.length < 2) return 'bulkGetRecordingDownloadLinks requires (token, recordingIds)';
    if (!Array.isArray(args[1])) return 'recordingIds must be an array';
    return null;
  },
  // ── 1F: read / informational ops (append-token, token@1) ──────────────────
  getRecordHistory: function (args) {
    if (args.length < 2) return 'getRecordHistory requires (row, token)';
    if (args[0] === undefined || args[0] === null) return 'row is required';
    return null;
  },
  getRecordDocuments: function (args) {
    if (args.length < 2) return 'getRecordDocuments requires (row, token)';
    if (args[0] === undefined || args[0] === null) return 'row is required';
    return null;
  },
  getAuditEntries: function (args) {
    if (args.length < 2) return 'getAuditEntries requires (limit, token)';
    return null;
  },
  getTasks: function (args) {
    if (args.length < 2) return 'getTasks requires (filters, token)';
    if (args[0] === undefined || args[0] === null || typeof args[0] !== 'object') return 'filters must be an object';
    return null;
  },
  processMeetingRecording: function (args) {
    if (args.length < 2) return 'processMeetingRecording requires (payload, token)';
    if (!args[0] || typeof args[0] !== 'object') return 'payload must be an object';
    return null;
  },
  transcribeMeetingSegment: function (args) {
    if (args.length < 2) return 'transcribeMeetingSegment requires (payload, token)';
    if (!args[0] || typeof args[0] !== 'object') return 'payload must be an object';
    return null;
  },
  generateMeetingMinutes: function (args) {
    if (args.length < 2) return 'generateMeetingMinutes requires (payload, token)';
    if (!args[0] || typeof args[0] !== 'object') return 'payload must be an object';
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

module.exports = { app, server, dispatch, AUTH_ARG_INDEX, VALIDATORS };

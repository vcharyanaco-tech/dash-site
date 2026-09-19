'use strict';
/* Part 17 — Observability / System Health.
 *
 * The public GET /api/health is a liveness probe. This module is the admin
 * counterpart: it aggregates the process, database, KV backup bridge, Worker
 * config, AI, and notification state behind the admin-gated `getSystemHealth`
 * dispatch op, and keeps in-memory counters + a bounded recent-error ring so
 * the admin System Health view shows failures that previously only scrolled
 * past in server logs.
 *
 * Nothing here throws: every subsection degrades to { error } so a broken
 * dependency cannot take the health view (or the process) down with it.
 */

const fs = require('fs');
const os = require('os');

const STARTED_AT = Date.now();
const RECENT_ERRORS_MAX = 50;

const counters = {
  apiErrors: 0,
  authFailures: 0,
  rateLimitEvents: 0,
  aiFailures: 0
};

const recentErrors = [];

/* index.js owns the request/p95 metrics; it registers a snapshot provider so
   this module stays free of a circular require back into the HTTP layer. */
let metricsProvider_ = null;
function setMetricsProvider_(fn) {
  metricsProvider_ = typeof fn === 'function' ? fn : null;
}

function recordCount_(name, n) {
  if (Object.prototype.hasOwnProperty.call(counters, name)) {
    counters[name] += (n === undefined ? 1 : Number(n) || 0);
  }
}

function recordError_(source, message) {
  const entry = {
    at: new Date().toISOString(),
    source: String(source || 'unknown').slice(0, 80),
    message: String(message || '').slice(0, 300)
  };
  recentErrors.unshift(entry);
  if (recentErrors.length > RECENT_ERRORS_MAX) recentErrors.length = RECENT_ERRORS_MAX;
  return entry;
}

/* API dispatch failures: authN/authZ refusals are counted separately from
   generic errors so a spike in one is distinguishable from the other. */
function recordApiError_(fn, err) {
  const message = (err && err.message) || String(err || '');
  const isAuth = /login required|permission|not allowed|session|token|unauthor|forbidden|invalid credentials/i.test(message);
  if (isAuth) counters.authFailures++;
  else counters.apiErrors++;
  return recordError_(isAuth ? 'auth' : ('api:' + String(fn || 'unknown')), message);
}

function dbSection_() {
  const section = { ok: false, sizeBytes: 0 };
  try {
    const { db, DB_PATH } = require('./db');
    const row = db.prepare('SELECT 1 AS ping').get();
    section.ok = !!(row && row.ping === 1);
    try { section.sizeBytes = fs.statSync(DB_PATH).size; } catch (err) {}
  } catch (err) {
    section.ok = false;
    section.error = String((err && err.message) || err);
  }
  return section;
}

function backupSection_() {
  try {
    const s = require('./data-sync').getBackupStatus();
    const last = s.lastBackupAt || null;
    return {
      enabled: !!s.enabled,
      lastBackupAt: last,
      ageMs: last ? Math.max(0, Date.now() - new Date(last).getTime()) : null,
      writesToday: Number(s.writesToday) || 0,
      budget: Number(s.budget) || 0,
      budgetLeft: Number(s.budgetLeft) || 0,
      error: s.error || ''
    };
  } catch (err) {
    return { error: String((err && err.message) || err) };
  }
}

function enterpriseSection_() {
  const out = {
    worker: { urlSet: false, tokenSet: false },
    ai: { enabled: false, keySet: false }
  };
  try {
    const eh = require('./enterprise').getEnterpriseHealth();
    out.worker = { urlSet: !!eh.workerUrlSet, tokenSet: !!eh.workerTokenSet };
    out.ai = { enabled: !!eh.aiEnabled, keySet: !!eh.aiKeySet };
  } catch (err) {
    out.error = String((err && err.message) || err);
  }
  return out;
}

function notificationsSection_() {
  const out = { unread: null, lastGeneratedAt: null };
  try {
    const { db } = require('./db');
    const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE read_at IS NULL OR read_at = 0').get();
    out.unread = unread ? Number(unread.n) || 0 : 0;
    const last = db.prepare('SELECT MAX(created_at) AS ts FROM notifications').get();
    out.lastGeneratedAt = last && last.ts ? new Date(Number(last.ts)).toISOString() : null;
  } catch (err) {
    out.error = String((err && err.message) || err);
  }
  return out;
}

function getSystemHealth_() {
  const mem = process.memoryUsage();
  const ent = enterpriseSection_();
  return {
    backend: {
      ok: true,
      startedAt: new Date(STARTED_AT).toISOString(),
      uptimeSec: Math.round(process.uptime()),
      node: process.version,
      platform: os.platform(),
      pid: process.pid,
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024)
      }
    },
    database: dbSection_(),
    backup: backupSection_(),
    worker: ent.worker,
    ai: ent.ai,
    notifications: notificationsSection_(),
    metrics: metricsProvider_ ? metricsProvider_() : null,
    counters: Object.assign({}, counters),
    recentErrors: recentErrors.slice(0, RECENT_ERRORS_MAX),
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  setMetricsProvider_,
  recordCount_,
  recordError_,
  recordApiError_,
  getSystemHealth_
};

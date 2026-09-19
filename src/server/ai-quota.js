'use strict';
/* Ask-AI per-user quota + rate limit (server-side, Phase-4-gated, Part 10).
   Editor/admin gate lives in enterprise.js; this adds the per-user daily
   budget + sliding-window rate limit the Ask-AI phase-4 gate demands.

   Keyed on the caller's EMAIL (not the session token) so the daily budget
   survives a logout/login cycle. Usage is two-phase: checkAskQuota_() only
   reads (no side effect) and commitAskQuota_() records a used question once
   the AI call actually succeeded, so failed attempts do not burn quota. */
const { db } = require('./db');

const ASK_AI_DAILY_QUOTA = 20;
const ASK_AI_RATE_MAX = 5;
const ASK_AI_RATE_WINDOW_MS = 60000; /* 60s sliding window */

function ensureQuotaTable_() {
  db.exec(
    'CREATE TABLE IF NOT EXISTS ai_ask_quota (' +
    '  email        TEXT NOT NULL,' +
    '  day          INTEGER NOT NULL,' +
    '  used         INTEGER NOT NULL DEFAULT 0,' +
    '  window_start INTEGER NOT NULL,' +
    '  window_count INTEGER NOT NULL DEFAULT 0,' +
    '  PRIMARY KEY (email, day)' +
    ')'
  );
}

function dayKey_() {
  const n = new Date();
  return n.getFullYear() * 10000 + (n.getMonth() + 1) * 100 + n.getDate();
}

function readQuota_(email, day) {
  const row = db.prepare(
    'SELECT used, window_start, window_count FROM ai_ask_quota WHERE email = ? AND day = ?'
  ).get(email, day);
  const now = Date.now();
  let used = 0; let wStart = now; let wCount = 0;
  if (row) {
    used = Number(row.used) || 0;
    wStart = Number(row.window_start) || now;
    wCount = Number(row.window_count) || 0;
  }
  if (now - wStart >= ASK_AI_RATE_WINDOW_MS) { wStart = now; wCount = 0; }
  return { used: used, windowStart: wStart, windowCount: wCount, now: now };
}

/* Read-only check. Returns { ok, email, day } or { ok:false, message }. */
function checkAskQuota_(email) {
  ensureQuotaTable_();
  email = String(email || '').trim().toLowerCase();
  if (!email) return { ok: false, message: 'Login required.' };
  const day = dayKey_();
  const q = readQuota_(email, day);
  if (q.used >= ASK_AI_DAILY_QUOTA) {
    return { ok: false, message: 'Daily Ask-AI quota reached. Try again tomorrow.' };
  }
  if (q.windowCount >= ASK_AI_RATE_MAX) {
    return { ok: false, message: 'Too many Ask-AI questions in a short time. Wait a minute.' };
  }
  return { ok: true, email: email, day: day };
}

/* Record one used question (call only after a successful AI response). */
function commitAskQuota_(email) {
  ensureQuotaTable_();
  email = String(email || '').trim().toLowerCase();
  if (!email) return;
  const day = dayKey_();
  const q = readQuota_(email, day);
  db.prepare(
    'INSERT INTO ai_ask_quota (email, day, used, window_start, window_count) ' +
    'VALUES (?, ?, ?, ?, ?) ' +
    'ON CONFLICT(email, day) DO UPDATE SET ' +
    '  used = used + 1, window_start = ?, window_count = ?'
  ).run(email, day, q.used + 1, q.now, q.windowCount + 1, q.windowStart, q.windowCount + 1);
}

module.exports = { checkAskQuota_, commitAskQuota_ };

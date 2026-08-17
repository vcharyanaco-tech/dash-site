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

const { db, seedDefaultSettings } = require('./db');
const auth = require('./auth');
const dispatch = require('./index-dispatch');

const PORT = Number(process.env.PORT || process.env.DASH_PORT || 8787);
const STATIC_ROOT = process.env.DASH_STATIC_ROOT || path.join(__dirname, '..', '..');
const API_PREFIX = '/api';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.static(STATIC_ROOT, {
  index: false,
  setHeaders: function (res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

app.get(API_PREFIX + '/health', function (req, res) {
  // Surface the KV backup bridge state so a quota/backup problem is visible
  // in a health check instead of silently widening the redeploy data-loss window.
  let dataSync = null;
  try { dataSync = require('./data-sync').getBackupStatus(); } catch (err) { dataSync = { error: String(err && err.message || err) }; }
  res.json({ ok: true, name: 'India Post Dashboard server', port: PORT, now: Date.now(), dataSync: dataSync });
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
    const result = await fnRef(args);
    res.json({ result: result === undefined ? null : result });
  } catch (err) {
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
  }
  try {
    const body = await readBodyJson(req);
    const job = body && body.job;
    let result;
    if (job === 'review-reminders') {
      result = require('./records').sendReviewReminders(undefined);
    } else if (job === 'archive-audit') {
      result = require('./audit').archiveAuditLog();
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
  const found = documents.resolveDocumentFile(req.params.key);
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

app.get('/', function (req, res) {
  const indexPath = path.join(STATIC_ROOT, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.redirect('/app.html');
  }
});

const server = http.createServer(app);
server.on('error', function (err) {
  console.error('Server error: ' + err.message);
});

if (require.main === module) {
  server.listen(PORT, function () {
    console.log('India Post Dashboard server listening on http://localhost:' + PORT);
    console.log('API dispatcher: POST http://localhost:' + PORT + API_PREFIX);
    // Periodic background sync so the spreadsheet and SQLite stay in step
    // without manual button clicks (DASH_AUTO_SYNC_MINUTES, default 15).
    require('./auto-sync').startAutoSync();
  });
}

module.exports = { app, server, dispatch };

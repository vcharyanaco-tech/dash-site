// verify-browser.cjs — headless Chrome (CDP via Node 24 native WebSocket)
// Verifies the live dashboardharyana.site post-cutover:
//   login → role ADMIN → Manage users (no dups) → add update → badge flashes →
//   admin re-opens modal → flash off, count stays → cleanup (delete test sub)
//
// Credentials come from env vars — NEVER hardcode them here:
//   VERIFY_BASE      app URL to test (default: live dashboardharyana.site)
//   VERIFY_EMAIL     admin login email (required)
//   VERIFY_PASSWORD  admin login password (required)
//   CHROME_PATH      Chrome executable (default: standard Windows path)
//   VERIFY_PORT      CDP debug port (default 9333)
//
// Usage:
//   VERIFY_EMAIL=admin@example.com VERIFY_PASSWORD='...' node verify-browser.cjs
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.env.VERIFY_BASE || 'https://dashboardharyana.site/app.html';
const ADMIN_EMAIL = process.env.VERIFY_EMAIL || '';
const ADMIN_PASS = process.env.VERIFY_PASSWORD || '';
const MARKER = 'VERIFY-' + Date.now();
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.env.VERIFY_PORT || 9333);

if (!ADMIN_EMAIL || !ADMIN_PASS) {
  console.error('Missing credentials. Set VERIFY_EMAIL and VERIFY_PASSWORD (e.g. VERIFY_EMAIL=... VERIFY_PASSWORD=... node verify-browser.cjs).');
  process.exit(1);
}

let chromeProc = null;
let ws = null;
let msgId = 0;
const pending = new Map();
const results = [];
let failCount = 0;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function log(step, ok, detail) {
  const tag = ok ? 'PASS' : 'FAIL';
  if (!ok) failCount++;
  results.push({ step, ok, detail });
  console.log(`[${tag}] ${step}${detail ? ' — ' + detail : ''}`);
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(new Error('WS error: ' + (e && e.message)));
    ws.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch (e) { return; }
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(new Error(JSON.stringify(data.error)));
        else resolve(data.result);
      }
    };
  });
}

function cdp(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}

async function evaluate(expression) {
  const res = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error('eval exception: ' + JSON.stringify(res.exceptionDetails.exception && res.exceptionDetails.exception.description));
  return res.result && res.result.value;
}

async function waitFor(expr, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const v = await evaluate(expr);
      if (v) return v;
    } catch (e) { /* keep polling */ }
    await sleep(500);
  }
  throw new Error('Timed out waiting for: ' + (label || expr));
}

async function main() {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-verify-'));
  chromeProc = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + userDir,
    'about:blank'
  ], { stdio: 'ignore' });

  // Wait for the debugger endpoint
  let version = null;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      version = await r.json();
      break;
    } catch (e) { await sleep(300); }
  }
  if (!version) throw new Error('Chrome CDP did not start');

  // Create a fresh tab at the target URL
  const tabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE)}`, { method: 'PUT' });
  const tab = await tabRes.json();
  await connect(tab.webSocketDebuggerUrl);
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await sleep(2500);

  // ── 1. Login ────────────────────────────────────────────────────────────
  await waitFor(`document.getElementById('loginEmail') !== null`, 15000, 'login form');
  await evaluate(`(() => {
    const e = document.getElementById('loginEmail'); e.value = ${JSON.stringify(ADMIN_EMAIL)};
    const p = document.getElementById('loginPassword'); p.value = ${JSON.stringify(ADMIN_PASS)};
    document.getElementById('loginForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return true;
  })()`);

  await waitFor(`document.getElementById('profileRoleBadge') && document.getElementById('profileRoleBadge').textContent.trim() === 'ADMIN'`, 20000, 'ADMIN badge after login');
  const role = await evaluate(`document.getElementById('profileRoleBadge').textContent.trim()`);
  log('1. Login as admin', role === 'ADMIN', `role=${role}`);

  // ── 2. Manage users — no duplicates ─────────────────────────────────────
  await evaluate(`document.querySelector('.nav-item[data-tab="settings"]').click(); true`);
  await waitFor(`document.getElementById('usersTable') && document.getElementById('usersTable').querySelector('tbody') && document.getElementById('usersTable').querySelector('tbody').dataset.users !== undefined`, 15000, 'users table');
  const users = await evaluate(`(() => {
    const t = document.getElementById('usersTable').querySelector('tbody');
    const arr = JSON.parse(t.dataset.users || '[]');
    const emails = arr.map(u => String(u.email || '').toLowerCase().trim());
    const seen = {}, dups = [];
    emails.forEach(e => { if (!e) return; if (seen[e]) dups.push(e); seen[e] = true; });
    return { total: arr.length, unique: emails.filter(Boolean).length, dups: [...new Set(dups)] };
  })()`);
  const noDups = users.total > 0 && users.dups.length === 0 && users.unique === users.total;
  log('2. Manage users: no duplicates', noDups, `users=${users.total}, unique=${users.unique}, dups=${JSON.stringify(users.dups)}`);

  // ── 3. Dashboard: add an update → badge flashes ─────────────────────────
  await evaluate(`document.querySelector('.nav-item[data-tab="dashboard"]').click(); true`);
  await waitFor(`document.querySelector('#dashboard .btn') !== null || document.querySelector('[onclick*="openSubmissionsModal"]') !== null`, 15000, 'dashboard cards');
  // Grab the first card's row + id from the openSubmissionsModal onclick
  const card = await evaluate(`(() => {
    const btns = document.querySelectorAll('[onclick*="openSubmissionsModal"]');
    for (const b of btns) {
      const m = b.getAttribute('onclick').match(/openSubmissionsModal\\('([^']+)','([^']+)'/);
      if (m) return { row: m[1], id: m[2] };
    }
    return null;
  })()`);
  if (!card) throw new Error('No card with a Submit update button found');
  log('3a. Found card', true, `row=${card.row} id=${card.id}`);

  // Open the modal, add our marked submission
  await evaluate(`openSubmissionsModal('${card.row}','${card.id}'); true`);
  await waitFor(`!document.getElementById('submissionsModal').classList.contains('hidden')`, 10000, 'submissions modal open');
  await evaluate(`(() => {
    document.getElementById('submissionText').value = ${JSON.stringify(MARKER + ' browser-verify test update')};
    submitSubmission();
    return true;
  })()`);
  await waitFor(`document.querySelector('#submissionsList .submission-text') && document.querySelector('#submissionsList .submission-text').textContent.indexOf(${JSON.stringify(MARKER)}) !== -1`, 15000, 'submission appears in list');
  log('3b. Update added', true, 'test submission visible in modal');

  // Scoped selectors: find the card whose Submit-update button targets this row
  const scopedCardExpr = `(() => {
    const cards = document.querySelectorAll('#dashboardCards .card, #dashboardCards article.card');
    for (const c of cards) {
      const btn = c.querySelector('[onclick*="openSubmissionsModal"]');
      if (btn && btn.getAttribute('onclick').indexOf('${card.row}') !== -1) return c;
    }
    return null;
  })()`;

  // Close and re-render dashboard to see the flash badge
  await evaluate(`closeSubmissionsModal(); true`);
  await sleep(800);
  const flashBefore = await evaluate(`(() => {
    const c = ${scopedCardExpr};
    if (!c) return { found: false };
    const badge = c.querySelector('.submission-badge');
    return { found: true, flash: badge ? badge.classList.contains('flash') : false, count: badge ? badge.textContent.trim() : null };
  })()`);
  log('3c. Badge flashes after new update', flashBefore.found === true && flashBefore.flash === true, `row=${card.row} flash=${flashBefore.flash} count=${flashBefore.count}`);

  // ── 4. Admin re-opens modal → server marks read ─────────────────────────
  // Two checks so we can report accurately:
  //   4a — immediate client-side clear (requires the current frontend, whose
  //        loadSubmissions() clears the local flash flag on admin open);
  //   4b — server read_at persists: after a full reload (fresh getAppData)
  //        the badge stays off while the count is preserved.
  const countBefore = flashBefore.count;
  await evaluate(`openSubmissionsModal('${card.row}','${card.id}'); true`);
  await waitFor(`!document.getElementById('submissionsModal').classList.contains('hidden')`, 10000, 'modal re-open');
  await sleep(2500);
  await evaluate(`closeSubmissionsModal(); true`);
  await sleep(500);
  const stateAfter = await evaluate(`(() => {
    const c = ${scopedCardExpr};
    if (!c) return { found: false };
    const badge = c.querySelector('.submission-badge');
    return { found: true, flash: badge ? badge.classList.contains('flash') : false, count: badge ? badge.textContent.trim() : null };
  })()`);
  const countSame = stateAfter.count !== null && stateAfter.count === countBefore;
  log('4a. Immediate flash clear on modal open (new-client behavior)', stateAfter.flash === false, `row=${card.row} flash=${stateAfter.flash} (expected false with the current frontend)`);

  // Full reload → fresh getAppData from the Node server (token persists in localStorage)
  await cdp('Page.reload', { ignoreCache: true });
  await sleep(4000);
  await waitFor(`document.querySelector('.nav-item[data-tab="dashboard"]') !== null`, 15000, 'post-reload app');
  await evaluate(`document.querySelector('.nav-item[data-tab="dashboard"]').click(); true`);
  await sleep(1500);
  const stateReload = await evaluate(`(() => {
    const c = ${scopedCardExpr};
    if (!c) return { found: false };
    const badge = c.querySelector('.submission-badge');
    const all = Array.from(document.querySelectorAll('#dashboardCards .card .submission-badge.flash')).map(b => b.textContent.trim());
    return { found: true, flash: badge ? badge.classList.contains('flash') : false, count: badge ? badge.textContent.trim() : null, otherFlashing: all };
  })()`);
  const serverCleared = stateReload.found === true && stateReload.flash === false;
  const countSameReload = stateReload.count !== null && stateReload.count === countBefore;
  log('4b. Server read_at persists (flash off after reload), count stays', serverCleared && countSameReload, `row=${card.row} flash=${stateReload.flash} count=${stateReload.count} (was ${countBefore}) otherFlashing=${JSON.stringify(stateReload.otherFlashing)}`);

  // ── 5. Cleanup: delete the test submission ──────────────────────────────
  await evaluate(`openSubmissionsModal('${card.row}','${card.id}'); true`);
  await waitFor(`!document.getElementById('submissionsModal').classList.contains('hidden')`, 10000, 'modal for cleanup');
  await waitFor(`document.querySelector('#submissionsList .submission-text') && document.querySelector('#submissionsList .submission-text').textContent.indexOf(${JSON.stringify(MARKER)}) !== -1`, 15000, 'marker in list for cleanup');
  const deleted = await evaluate(`(() => {
    const cards = document.querySelectorAll('#submissionsList .submission-card');
    for (const c of cards) {
      const txt = c.querySelector('.submission-text');
      if (txt && txt.textContent.indexOf(${JSON.stringify(MARKER)}) !== -1) {
        const btn = c.querySelector('[onclick*="deleteSubmission"]');
        if (btn) { btn.click(); return true; }
      }
    }
    return false;
  })()`);
  if (deleted) {
    await sleep(600);
    await evaluate(`document.getElementById('confirmOkBtn').click(); true`);
    await sleep(1500);
    const gone = await evaluate(`(() => {
      const cards = document.querySelectorAll('#submissionsList .submission-card');
      for (const c of cards) {
        const txt = c.querySelector('.submission-text');
        if (txt && txt.textContent.indexOf(${JSON.stringify(MARKER)}) !== -1) return false;
      }
      return true;
    })()`);
    await evaluate(`closeSubmissionsModal(); true`);
    log('5. Cleanup: test submission deleted', gone === true, '');
  } else {
    log('5. Cleanup: test submission deleted', false, 'delete button not found');
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n===== SUMMARY =====');
  results.forEach(r => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.step}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.length - failCount}/${results.length} PASS`);
  process.exitCode = failCount ? 1 : 0;
}

main().catch((err) => {
  console.error('\nVERIFY ERROR:', err && err.message || err);
  process.exitCode = 1;
}).finally(async () => {
  try { if (ws) ws.close(); } catch (e) {}
  if (chromeProc) {
    try { chromeProc.kill(); } catch (e) {}
    // On Windows kill() only kills the parent; nuke the whole tree so the
    // debug port frees up for the next run.
    try { require('child_process').execSync('taskkill /F /T /PID ' + chromeProc.pid + ' 2>nul || true'); } catch (e) {}
  }
});

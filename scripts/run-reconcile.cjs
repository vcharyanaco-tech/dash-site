#!/usr/bin/env node
/**
 * ============================================================
 * India Post Dashboard — scripts/run-reconcile.cjs
 * Calls the admin-only reconcileRecordOrder endpoint against a
 * live server (default dashboardharyana.site) in dry-run mode by
 * default, or --apply to write the changes.
 *
 *   node scripts/run-reconcile.cjs            # dry-run plan
 *   node scripts/run-reconcile.cjs --apply    # apply the plan
 *
 * CONFIG (env): LIVE_DASH_BASE, LIVE_DASH_EMAIL, LIVE_DASH_PASS,
 * LIVE_DASH_TOKEN. Pace/429 handling mirrors the audit script.
 * ============================================================
 */

const BASE = process.env.LIVE_DASH_BASE || 'https://dashboardharyana.site';
const APPLY = process.argv.indexOf('--apply') !== -1;
const MIN_SPACING_MS = 1200;
let lastCallAt = 0;

function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

async function jsonPost(fn, args) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = lastCallAt ? (lastCallAt + MIN_SPACING_MS) - Date.now() : 0;
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    const resp = await fetch(BASE + '/api', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ function: fn, args: args }),
      signal: AbortSignal.timeout(30000)
    });
    const body = await resp.json();
    if (body && body.retryAfter) {
      const retry = Math.max(Number(body.retryAfter) || 60, 5);
      console.warn('rate limited on ' + fn + ' — waiting ' + retry + 's');
      await sleep(retry * 1000);
      continue;
    }
    if (body && body.error) throw new Error(fn + ': ' + body.error);
    return body.result;
  }
  throw new Error(fn + ': still rate limited');
}

async function run() {
  let token = process.env.LIVE_DASH_TOKEN;
  const email = process.env.LIVE_DASH_EMAIL;
  const pass = process.env.LIVE_DASH_PASS;
  if (!token) {
    if (!email || !pass) {
      console.error('Set LIVE_DASH_EMAIL + LIVE_DASH_PASS (or LIVE_DASH_TOKEN).');
      process.exit(2);
    }
    const login = await jsonPost('login', [email, pass]);
    if (!login || !login.token) {
      console.error('login failed');
      process.exit(2);
    }
    token = login.token;
  }

  const report = await jsonPost('reconcileRecordOrder', [APPLY ? false : true, token]);
  if (!report) {
    console.error('reconcileRecordOrder returned nothing');
    process.exit(1);
  }
  console.log((report.dryRun ? '[DRY-RUN]  ' : '[APPLIED]  ') + 'would-change: ' + report.changed);
  console.log('canonical: ' + report.canonicalCount + ' records · live: ' + report.liveCount + ' records');

  if (report.records.reordered && report.records.reordered.length) {
    console.log('\nrecord row moves (' + report.records.reordered.length + '):');
    report.records.reordered.forEach(function (m) {
      console.log('  row ' + m.from + ' -> ' + m.to + '  #' + (m.id || '—') + '  ' + String(m.description || '').slice(0, 48));
    });
  } else {
    console.log('\nrecord rows: unchanged (already dense in canonical order)');
  }

  console.log('\nchild rows:');
  Object.keys(report.children).forEach(function (key) {
    const c = report.children[key];
    console.log('  ' + key + ': total ' + c.total + ' · rebind ' + c.rebound + ' · orphan-delete ' + c.orphaned + ' · kept ' + c.kept + ' · beyond-canonic ' + c.beyondCanonical);
    if (c.rebound) {
      c.examples.rebound.forEach(function (x) { console.log('    rebind ' + x.id + ' row ' + x.from + ' -> ' + x.to + ' (record #' + x.displayId + ')'); });
    }
    if (c.orphaned) {
      c.examples.orphaned.forEach(function (x) { console.log('    DELETE ' + x.id + ' row ' + x.row + ' (record #' + x.displayId + ')'); });
    }
  });

  if (!report.changed) {
    console.log('\nNothing to change — database mapping is already clean.');
    process.exit(0);
  }
  console.log('\n' + (report.dryRun ? 'Plan only — nothing written. Re-run with --apply to write.' : 'Changes written.'));
}

run().catch(function (err) {
  console.error('runner error: ' + (err && err.message ? err.message : String(err)));
  process.exit(1);
});
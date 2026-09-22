/**
 * ============================================================
 * India Post Dashboard — scripts/live-check.cjs
 * Scheduled smoke test against the LIVE site (run by the
 * live-check GitHub Action). Exits non-zero on any failure so
 * GitHub emails the repo owner. Runs at 07:30 IST (02:00 UTC),
 * well after the 06:00 IST wake-up so the instance is warm.
 *
 * Checks:
 *   1. Worker /api/health → ok:true and a fresh KV backup
 *      (lastBackupAt within the last 45 minutes).
 *   2. Dashboard API (getServerTime sanity + getData reaches its auth guard —
 *      getData itself requires a session by design).
 *   3. Static bundle (app.html) → served with the app markers.
 * ============================================================
 */

const BASE = 'https://dashboardharyana.site';
const MAX_BACKUP_AGE_MS = 45 * 60 * 1000;

function fail(step, msg) {
  console.error('FAIL [' + step + '] ' + msg);
  process.exitCode = 1;
}

function pass(step, msg) {
  console.log('ok   [' + step + '] ' + msg);
}

async function checkHealth() {
  const resp = await fetch(BASE + '/api/health', { signal: AbortSignal.timeout(60000) });
  if (resp.status !== 200) throw new Error('HTTP ' + resp.status);
  const body = await resp.json();
  if (!body || body.ok !== true) throw new Error('body.ok !== true');
  const b = body.backup;
  if (b) {
    if (!b.lastBackupAt) throw new Error('backup.lastBackupAt missing');
    const age = Date.now() - Date.parse(b.lastBackupAt);
    if (isNaN(age) || age > MAX_BACKUP_AGE_MS) {
      throw new Error('last backup too old: ' + b.lastBackupAt + ' (age ' + Math.round(age / 60000) + 'm)');
    }
    if (b.skippedBudget) throw new Error('backup budget exhausted (skippedBudget=true)');
  }
  pass('health', 'ok:true, backup ' + (b ? b.lastBackupAt + ', writes ' + b.writesToday + '/' + b.budget : 'n/a'));
}

async function checkData() {
  // getData deliberately requires a session (anonymous dispatch is rejected
  // by design — see api-security.test.js). Without shelling in to the live
  // DB with real credentials we verify the data surface two ways:
  //   1. an anonymous endpoint that must succeed (server clock),
  //   2. the real dashboard endpoint returns its structured auth guard
  //      instead of an unhandled error, i.e. routing + validators work.
  const timeResp = await fetch(BASE + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: 'getServerTime', args: [] }),
    signal: AbortSignal.timeout(60000)
  });
  if (timeResp.status !== 200) throw new Error('getServerTime HTTP ' + timeResp.status);
  const timeBody = await timeResp.json();
  if (typeof timeBody.result !== 'number' || timeBody.result < 1e12 || timeBody.result > Date.now() + 60000) {
    throw new Error('getServerTime returned an invalid clock: ' + timeBody.result);
  }

  const resp = await fetch(BASE + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: 'getData', args: [] }),
    signal: AbortSignal.timeout(60000)
  });
  if (resp.status !== 200) throw new Error('getData HTTP ' + resp.status);
  const body = await resp.json();
  const err = body && body.error ? String(body.error) : '';
  if (!/requires \(token\)|token required|login required|must be logged/i.test(err)) {
    throw new Error('getData did not reach its auth guard (error=' + JSON.stringify(err) + ')');
  }
  pass('data', 'getServerTime sane + getData auth guard reached');
}

async function checkStatic() {
  const resp = await fetch(BASE + '/app.html', { signal: AbortSignal.timeout(60000) });
  if (resp.status !== 200) throw new Error('HTTP ' + resp.status);
  const text = await resp.text();
  if (text.indexOf('dashboard') === -1 && text.indexOf('Dashboard') === -1 && text.indexOf('login') === -1) {
    throw new Error('app.html does not look like the dashboard');
  }
  pass('static', 'app.html served (' + text.length + ' bytes)');
}

(async function main() {
  const steps = [['health', checkHealth], ['data', checkData], ['static', checkStatic]];
  let failed = 0;
  for (const [name, fn] of steps) {
    try {
      await fn();
    } catch (err) {
      failed++;
      fail(name, err && err.message ? err.message : String(err));
    }
  }
  console.log(failed ? 'LIVE CHECK FAILED (' + failed + ' step(s))' : 'LIVE CHECK PASSED (3/3)');
  process.exit(failed ? 1 : 0);
})().catch(function (err) {
  fail('runner', err && err.message ? err.message : String(err));
  process.exit(1);
});

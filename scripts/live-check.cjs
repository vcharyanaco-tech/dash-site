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
 *   2. Dashboard API (getData) → returns the records list.
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
  const resp = await fetch(BASE + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: 'getData', args: [] }),
    signal: AbortSignal.timeout(60000)
  });
  if (resp.status !== 200) throw new Error('HTTP ' + resp.status);
  const body = await resp.json();
  if (body && body.error) throw new Error('API error: ' + body.error);
  const items = body && body.result && body.result.items;
  if (!Array.isArray(items) || items.length < 1) throw new Error('no records returned');
  pass('data', items.length + ' records returned');
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

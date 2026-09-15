#!/usr/bin/env node
/**
 * ============================================================
 * India Post Dashboard — run-tests.cjs
 * Test-suite launcher (npm test). Runs `node --test` against a
 * brand-new temp data dir every time so no test can be poisoned
 * by rows another test file (or an earlier interrupted run) left
 * in the shared dev DB — e.g. a leftover viewer@test.com account.
 * Cross-platform (Linux CI + Windows dev).
 * ============================================================
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-tests-'));
process.env.DASH_DATA_DIR = dir;
process.env.RATE_LIMIT_DISABLED = '1';

// Seed the empty scratch DB exactly like a fresh local `npm run seed` so
// tests that assume baseline records (e.g. smoke.test.js posting to row 4)
// keep working; seed.js is idempotent so it is safe on any recovery path.
const seed = spawnSync(process.execPath, ['seed.js'], { cwd: __dirname, env: process.env });
if (seed.status !== 0) {
  console.error((seed.stderr || '') + 'demo seeding failed (exit ' + seed.status + ')');
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ['--test', '--experimental-test-coverage'],
  { stdio: 'inherit', cwd: __dirname }
);

child.on('error', function (err) {
  console.error('failed to launch test runner: ' + err.message);
  process.exit(1);
});

child.on('exit', function (code, signal) {
  if (signal) {
    console.error('test runner killed by signal ' + signal);
    process.exit(1);
  }
  process.exit(code === null ? 1 : code);
});
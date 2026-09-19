#!/usr/bin/env node
/**
 * Part 19 (CI): guard the shipped frontend bundle against size regressions.
 *
 * Budgets are the browser-facing gzip sizes (with headroom over the current
 * build) plus a raw-size ceiling. Raise a budget consciously via the
 * BUNDLE_BUDGET_* env vars only when a feature genuinely needs the room.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const KB = 1024;

function num(env, fallback) {
  const v = Number(process.env[env]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const TARGETS = [
  { file: 'app.js', gzip: num('BUNDLE_BUDGET_APP_JS_GZIP', 150), raw: num('BUNDLE_BUDGET_APP_JS_RAW', 550) },
  { file: 'assets/styles.css', gzip: num('BUNDLE_BUDGET_CSS_GZIP', 45), raw: num('BUNDLE_BUDGET_CSS_RAW', 160) }
];

function kb(n) {
  return (n / KB).toFixed(1) + ' KB';
}

let failed = false;
for (const t of TARGETS) {
  const abs = path.join(ROOT, t.file);
  if (!fs.existsSync(abs)) {
    console.error('MISSING ' + t.file);
    failed = true;
    continue;
  }
  const buf = fs.readFileSync(abs);
  const gz = zlib.gzipSync(buf).length;
  const okGz = gz <= t.gzip * KB;
  const okRaw = buf.length <= t.raw * KB;
  console.log(
    t.file.padEnd(20) +
    ' raw ' + kb(buf.length).padStart(9) + ' / ' + (t.raw + ' KB').padStart(8) +
    '   gzip ' + kb(gz).padStart(9) + ' / ' + (t.gzip + ' KB').padStart(8) +
    '   ' + (okGz && okRaw ? 'OK' : 'OVER BUDGET')
  );
  if (!okGz || !okRaw) failed = true;
}

if (failed) {
  console.error('\nBundle size budget exceeded - trim the change or raise BUNDLE_BUDGET_* consciously.');
  process.exit(1);
}
console.log('\nBundle size OK');

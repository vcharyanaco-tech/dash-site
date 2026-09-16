#!/usr/bin/env node
/**
 * build/split-app.js
 *
 * Inverse of build-app.js: verifies that the committed app.js is exactly the
 * concatenation of the modules listed in manifest.json and reproduces each
 * module file byte-for-byte. Module order and source locations come from
 * manifest.json (which may point modules at canonical files outside src/app/,
 * e.g. i18n.js at src/ and offline-queue.js at the repo root).
 *
 * Usage:  node build/split-app.js
 *
 * The split is NON-DESTRUCTIVE: app.js is left untouched. If app.js has
 * drifted from the manifest (a developer hand-edited app.js), the tool
 * refuses to overwrite the module files instead of guessing — edit the
 * modules and run `node build/build-app.js` to rebuild app.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'app.js');
const OUT_DIR = path.join(ROOT, 'src', 'app');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

// ── Read manifest ─────────────────────────────────────────────────────────
if (!fs.existsSync(MANIFEST)) {
  console.error('No manifest.json found. Run `node build/build-app.js` first.');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

// ── Read app.js ───────────────────────────────────────────────────────────
if (!fs.existsSync(APP_JS)) {
  console.error('No app.js found — nothing to split.');
  process.exit(1);
}
const appSource = fs.readFileSync(APP_JS, 'utf8');

// ── Resolve module files ──────────────────────────────────────────────────
const mods = [];
for (const m of manifest.modules) {
  const filePath = m.src ? path.join(ROOT, m.src) : path.join(OUT_DIR, m.file);
  if (!fs.existsSync(filePath)) {
    console.error(`  ERROR: ${m.file} not found at ${filePath} — aborting`);
    process.exit(1);
  }
  mods.push({ name: m.name, file: m.file, path: filePath });
}

// ── Reassemble what the manifest expects app.js to be ─────────────────────
const chunks = mods.map((m) => fs.readFileSync(m.path, 'utf8'));
const expected = chunks.join('');

if (expected !== appSource) {
  console.error(`
app.js does NOT match the concatenation of the manifest modules.
  expected  ${expected.length} chars
  actual    ${appSource.length} chars

app.js has drifted from src/app/*.js + manifest.json. The splitter will not
overwrite module files from an ambiguous source. Edit the module files and
run \`node build/build-app.js\` to regenerate app.js instead.
`);
  process.exit(1);
}

// ── Split app.js back into the manifest modules ──────────────────────────
// Byte-exact: each module is the app.js substring of the same length as its
// canonical chunk, positioned at the running concatenation offset.
let offset = 0;

for (let i = 0; i < mods.length; i++) {
  const m = mods[i];
  const chunk = chunks[i];
  const slice = appSource.substr(offset, chunk.length);
  if (slice !== chunk) {
    console.error(`  ERROR: ${m.file} mismatch at offset ${offset} — refusing to write`);
    process.exit(1);
  }
  fs.writeFileSync(m.path, slice, 'utf8');
  const lines = chunk.split('\n');
  offset += chunk.length;
  console.log(`  ${m.file.padEnd(16)} chars ${String(offset - chunk.length).padStart(7)}–${String(offset).padStart(7)} (${lines.length} lines)`);
}

console.log(`\nSplit complete: ${mods.length} modules reproduced byte-exact from ${APP_JS}`);
console.log(`Verify with: node build/build-app.js (must report ${mods.length} modules)`);
#!/usr/bin/env node
/**
 * build/build-app.js
 *
 * Reads the manifest.json produced by split-app.js and concatenates all
 * module files from src/app/ back into a single app.js at the repo root.
 *
 * Usage:  node build/build-app.js
 *
 * The output is byte-identical to the original app.js when split → build
 * is run as a round-trip (no trailing-newline drift, no reordering).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'app');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const APP_JS = path.join(ROOT, 'app.js');

// ── Read manifest ─────────────────────────────────────────────────────────
if (!fs.existsSync(MANIFEST)) {
  console.error('No manifest.json found. Run `node build/split-app.js` first.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

// ── Concatenate modules ───────────────────────────────────────────────────
const chunks = [];

for (const mod of manifest.modules) {
  const filePath = path.join(OUT_DIR, mod.file);
  if (!fs.existsSync(filePath)) {
    console.error(`  ERROR: ${mod.file} not found — aborting`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  chunks.push(content);
  console.log(`  ${mod.file.padEnd(16)} ${mod.lineCount} lines`);
}

let output = chunks.join('');

// Read the original to check if it ends with a trailing newline
const originalPath = APP_JS + '.original';
if (fs.existsSync(originalPath)) {
  const origBuf = fs.readFileSync(originalPath);
  const origEndsWithNewline = origBuf[origBuf.length - 1] === 0x0a; // 0x0a = \n

  if (!origEndsWithNewline && output.endsWith('\n')) {
    output = output.slice(0, -1); // strip trailing newline to match original
  }
}

// ── Write app.js ──────────────────────────────────────────────────────────
fs.writeFileSync(APP_JS, output, 'utf8');

console.log(`\nReassembled app.js (${manifest.modules.length} modules, ${output.split('\n').length - 1} lines)`);

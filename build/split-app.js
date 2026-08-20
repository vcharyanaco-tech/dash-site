#!/usr/bin/env node
/**
 * build/split-app.js
 *
 * Reads app.js, finds every section-marker comment, groups them
 * into logical modules, and writes each module to src/app/<name>.js.
 * A manifest.json records the order so build-app.js can reassemble them.
 *
 * Usage:  node build/split-app.js
 *
 * The split is NON-DESTRUCTIVE: app.js is left untouched. After splitting,
 * run node build/build-app.js to reassemble a byte-identical app.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_JS = path.join(ROOT, 'app.js');
const OUT_DIR = path.join(ROOT, 'src', 'app');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

// ── Module definitions ────────────────────────────────────────────────────
// Each module: { name, startSection (first section marker text), endSection
// (exclusive — the next module's startSection, or null for the last module) }.
// Sections are assigned to the first module whose startSection they fall
// between. The preamble (everything before the first section marker) goes
// into the first module.
const MODULES = [
  { name: 'core',           startSection: 'Event bus',         endSection: 'AI Meeting Notes' },
  { name: 'meetings',       startSection: 'AI Meeting Notes',  endSection: 'Live browser recording' },
  { name: 'recording',      startSection: 'Live browser recording', endSection: 'Per-record AI insight' },
  { name: 'ai',             startSection: 'Per-record AI insight',  endSection: 'Auth token' },
  { name: 'session',        startSection: 'Auth token',        endSection: 'Dashboard: filters' },
  { name: 'dashboard',      startSection: 'Dashboard: filters', endSection: 'Audit' },
  { name: 'audit',          startSection: 'Audit',             endSection: 'Reports' },
  { name: 'reports',        startSection: 'Reports',           endSection: 'Settings' },
  { name: 'settings',       startSection: 'Settings',          endSection: 'Record detail dialog' },
  { name: 'detail',         startSection: 'Record detail dialog', endSection: 'Tasks' },
  { name: 'tasks',          startSection: 'Tasks',             endSection: 'Date picker' },
  { name: 'utils',          startSection: 'Date picker',       endSection: 'Dashboard Studio' },
  { name: 'studio',         startSection: 'Dashboard Studio',  endSection: 'Edit modal' },
  { name: 'edit',           startSection: 'Edit modal',        endSection: 'Submissions modal' },
  { name: 'submissions',    startSection: 'Submissions modal', endSection: 'About' },
  { name: 'init',           startSection: 'About',             endSection: null }
];

// ── Read source ───────────────────────────────────────────────────────────
const source = fs.readFileSync(APP_JS, 'utf8');
const lines = source.split('\n');

// ── Find section boundaries ───────────────────────────────────────────────
// A section marker is a line matching: /* ---...<keyword>...--- */
const SECTION_RE = /^\/\*\s*-+\s*(.+?)\s*-+\s*\*\//;

const sections = []; // { line: 0-indexed, keyword: string }
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(SECTION_RE);
  if (m) {
    sections.push({ line: i, keyword: m[1] });
  }
}

console.log(`Found ${sections.length} section markers in app.js`);

// ── Assign lines to modules ───────────────────────────────────────────────
function findModuleForLine(lineIdx) {
  // Find the section marker that starts the module containing this line
  let currentModule = 0;
  for (let s = 0; s < sections.length; s++) {
    const sec = sections[s];
    // Check if this section starts a new module
    for (let m = 0; m < MODULES.length; m++) {
      if (sec.keyword.indexOf(MODULES[m].startSection) !== -1) {
        if (lineIdx >= sec.line) currentModule = m;
        break;
      }
    }
  }
  return currentModule;
}

// Build line ranges for each module
const moduleRanges = MODULES.map(() => ({ start: -1, end: -1 }));

// Find the start line of each module's first section.
// Also include any blank lines immediately before the section marker
// so no lines are orphaned between modules.
for (let m = 0; m < MODULES.length; m++) {
  for (let s = 0; s < sections.length; s++) {
    if (sections[s].keyword.indexOf(MODULES[m].startSection) !== -1) {
      let startLine = sections[s].line;
      // Walk backwards to include preceding blank lines in this module
      while (startLine > 0 && (lines[startLine - 1] || '').trim() === '') {
        startLine--;
      }
      moduleRanges[m].start = startLine;
      break;
    }
  }
}

// Preamble (before first section) goes into the first module
moduleRanges[0].start = 0; // Include preamble in core.js

// Set end of each module (exclusive) to start of next module.
for (let m = 0; m < MODULES.length - 1; m++) {
  if (moduleRanges[m + 1].start !== -1) {
    moduleRanges[m].end = moduleRanges[m + 1].start;
  }
}
// Last module goes to end of file
moduleRanges[MODULES.length - 1].end = lines.length;

// ── Write module files ────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });

const manifest = { version: 1, modules: [] };

for (let m = 0; m < MODULES.length; m++) {
  const mod = MODULES[m];
  const range = moduleRanges[m];

  if (range.start === -1) {
    console.error(`  WARNING: module "${mod.name}" has no matching section — skipped`);
    continue;
  }

  if (range.end === -1) range.end = lines.length;

  const startLine = range.start;
  const endLine = range.end; // exclusive
  const moduleLines = lines.slice(startLine, endLine);

  // Preserve all lines exactly as they appear in the original (including trailing blank lines)
  // to ensure byte-identical round-trip through build-app.js.

  const filename = mod.name + '.js';
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, moduleLines.join('\n') + '\n', 'utf8');

  manifest.modules.push({
    name: mod.name,
    file: filename,
    startLine: startLine + 1, // 1-indexed for human readability
    endLine: endLine,         // 1-indexed, inclusive
    lineCount: moduleLines.length
  });

  console.log(`  ${filename.padEnd(16)} lines ${String(startLine + 1).padEnd(5)}–${String(endLine).padEnd(5)} (${moduleLines.length} lines)`);
}

// ── Write manifest ────────────────────────────────────────────────────────
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`\nManifest written to ${MANIFEST}`);
console.log(`Split complete: ${MODULES.length} modules in ${OUT_DIR}`);

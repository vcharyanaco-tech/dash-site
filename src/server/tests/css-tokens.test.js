/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/css-tokens.test.js
 * CSS semantic-token pass (Phase 3, Part 21) gate. Reads the
 * design system (assets/styles.css) and enforces that the token
 * layer is the single source of truth: every var() reference
 * resolves to a defined token, every explicit hex fallback
 * matches the canonical token value, and on-screen component
 * rules carry no literal colors that would bypass theming.
 * ============================================================
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const css = fs.readFileSync(path.join(ROOT, 'assets', 'styles.css'), 'utf8');

// name -> value for every custom-property definition (`--name: value;`) in the
// whole file (used for the "nothing is referenced without being defined" gate).
function allTokens() {
  const map = {};
  const re = /^\s*--([a-z0-9-]+)\s*:\s*([^;]+);/gm;
  let m;
  while ((m = re.exec(css)) !== null) {
    map[m[1].toLowerCase()] = m[2].trim();
  }
  return map;
}

// Slice the first `:root { ... }` block (the light/default token layer). Hex
// fallbacks in components are written against these defaults; dark-mode values
// live on body.dark-mode where the fallbacks never apply.
function rootBlock() {
  const start = css.indexOf(':root {');
  assert.notStrictEqual(start, -1, ':root block missing');
  let depth = 1;
  let i = css.indexOf('{', start) + 1;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return css.slice(start, i + 1);
}

const ROOT_TOKENS = function () {
  const map = {};
  const re = /^\s*--([a-z0-9-]+)\s*:\s*([^;]+);/gm;
  let m;
  while ((m = re.exec(rootBlock())) !== null) {
    map[m[1].toLowerCase()] = m[2].trim();
  }
  return map;
}();

function referencedTokens() {
  const map = {};
  const re = /var\(--([a-z0-9-]+)/g;
  let m;
  while ((m = re.exec(css)) !== null) map[m[1].toLowerCase()] = true;
  return map;
}

function normalizeHex(v) {
  let s = String(v).trim().toLowerCase();
  if (s[0] !== '#') return s;
  s = s.slice(1);
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  return '#' + s;
}

// Remove every `@media print { ... }` segment so theme-blind print literals
// (deliberate paper-white) are exempt from the on-screen checks.
function stripPrintBlocks(src) {
  const re = /@media\s+print\s*\{/g;
  let out = src;
  let m;
  while ((m = re.exec(out)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < out.length; i++) {
      if (out[i] === '{') depth++;
      else if (out[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    out = out.slice(0, m.index) + out.slice(i + 1);
    re.lastIndex = 0;
  }
  return out;
}

test('every var() custom-property reference resolves to a defined token', function () {
  const defs = allTokens();
  const refs = referencedTokens();
  const missing = Object.keys(refs).filter(function (name) { return !defs[name]; });
  assert.deepStrictEqual(missing, [], 'referenced but undefined tokens: ' + missing.join(', '));
});

test('the Part 21 tokens exist in :root and get a dark-mode override', function () {
  ['accent-soft', 'radius-full', 'scrollbar', 'color-accent-soft'].forEach(function (t) {
    assert.ok(ROOT_TOKENS[t], 'missing token: --' + t);
  });
  assert.ok(css.indexOf('--accent-soft: rgba(144, 202, 249, .16);') !== -1,
    '--accent-soft must have a dark-mode override');
});

test('every explicit hex fallback matches the :root default', function () {
  const re = /var\(--([a-z0-9-]+)\s*,\s*(#[0-9a-fA-F]{3,8})\)/g;
  const mismatches = [];
  let m;
  while ((m = re.exec(css)) !== null) {
    const name = m[1].toLowerCase();
    const fallback = normalizeHex(m[2]);
    const defined = ROOT_TOKENS[name];
    if (defined === undefined || defined[0] !== '#') continue; // indirect/non-color tokens skipped
    if (normalizeHex(defined) !== fallback) {
      mismatches.push('--' + name + ' fallback ' + m[2] + ' != :root ' + defined);
    }
  }
  assert.deepStrictEqual(mismatches, [], 'drifted fallbacks:\n' + mismatches.join('\n'));
});

test('the non-brand hexes that used to leak into fallbacks are gone', function () {
  ['2563eb', '16a34a', 'dc2626', 'dcfce7', 'fee2e2', 'e5e7eb', 'eef2f7',
   'dc3545', 'd97706', 'dbeafe', 'e8f0ff', '2e9e5b', '667085', '0f172a']
    .forEach(function (hex) {
      assert.strictEqual(css.toLowerCase().indexOf('#' + hex), -1,
        'drift hex #' + hex + ' still present in styles.css');
    });
});

test('on-screen component rules carry no literal surface/on-solid colors', function () {
  const onScreen = stripPrintBlocks(css);
  assert.strictEqual(onScreen.indexOf('background: #fff;'), -1,
    'literal background #fff outside print');
  assert.strictEqual(onScreen.indexOf('color: #fff;'), -1,
    'literal color #fff outside print');
});

test('kanban count badge renders through a defined radius token', function () {
  assert.ok(css.indexOf('.kanban-col-count {') !== -1, 'kanban-col-count rule missing');
  assert.ok(css.indexOf('border-radius: var(--radius-full);') !== -1,
    'kanban badge must use --radius-full');
});
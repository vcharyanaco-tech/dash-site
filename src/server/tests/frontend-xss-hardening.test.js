/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/frontend-xss-hardening.test.js
 * Frontend DOM hardening (Phase 13 S7): extracts the pure URL /
 * HTML escaping helpers out of the rebuilt app.js bundle and
 * exercises the scheme allowlist + escaping logic in Node, then
 * locks static contracts proving every user-content render sink
 * routes through the hardened helper. Runs against the committed
 * bundle, so an app.js edit that skips `node build/build-app.js`
 * fails here.
 * ============================================================
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..', '..');
const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

// Pull a named top-level function out of the bundle with a string-, regex- and
// template-aware brace balance (no minifier, so module sources are preserved
// verbatim in app.js).
function extractFunction(name) {
  const marker = 'function ' + name + '(';
  const start = appJs.indexOf(marker);
  if (start === -1) throw new Error('function ' + name + ' not found in app.js');
  let i = appJs.indexOf('{', start);
  let depth = 0;
  let quote = null;            // opening ' " `
  let inRegex = false;
  let inClass = false;         // inside a regex [...] class
  let last = '';               // previous significant char (regex-start heuristic)
  for (; i < appJs.length; i++) {
    const ch = appJs[i];
    if (inRegex) {
      if (ch === '\\') { i++; continue; }
      if (inClass) {
        if (ch === ']') inClass = false;
        continue;
      }
      if (ch === '[') { inClass = true; continue; }
      if (ch === '/') inRegex = false;
      continue;
    }
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '/' && /[=(:,!&|?;{}[+\-*%^~<>]/.test(last)) {
      inRegex = true;
      last = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return appJs.slice(start, i + 1);
    }
    if (ch !== ' ' && ch !== '\n' && ch !== '\t') last = ch;
  }
  throw new Error('unbalanced definition for ' + name);
}

const ctx = vm.createContext({});
vm.runInContext(
  [extractFunction('escapeHtml'), extractFunction('escAttr'),
   extractFunction('linkableHref'), extractFunction('renderLinkableText')].join('\n'),
  ctx, { filename: 'app.js-extract' });

const linkableHref = (v) => ctx.linkableHref(v);
const renderLinkableText = (v) => ctx.renderLinkableText(v);

test('linkableHref: safe schemes and bare hosts resolve to clickable URLs', function () {
  assert.strictEqual(linkableHref('https://example.com'), 'https://example.com');
  assert.strictEqual(linkableHref('http://example.com/x'), 'http://example.com/x');
  assert.strictEqual(linkableHref('mailto:a@example.com'), 'mailto:a@example.com');
  assert.strictEqual(linkableHref('tel:+919876543210'), 'tel:+919876543210');
  assert.strictEqual(linkableHref('www.example.com'), 'https://www.example.com');
  assert.strictEqual(linkableHref('example.com'), 'https://example.com');
  assert.strictEqual(linkableHref('docs.google.com/spreadsheets/d/1/edit'), 'https://docs.google.com/spreadsheets/d/1/edit');
  assert.strictEqual(linkableHref('HTTPS://EXAMPLE.COM'), 'HTTPS://EXAMPLE.COM');
});

test('linkableHref: scriptable and dangerous schemes are dropped', function () {
  [
    'javascript:alert(1)',
    'javascript:alert(document.cookie)//.com',
    'data:text/html,<img src=x onerror=alert(1)>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'about:blank',
    'ftp://example.com',
    '<img src=x onerror=alert(1)>',
    '"><script>alert(1)</script>',
    'java\nscript:alert(1)'
  ].forEach(function (bad) {
    assert.strictEqual(linkableHref(bad), '', 'expected ' + JSON.stringify(bad) + ' to be dropped');
  });
});

test('renderLinkableText: XSS payloads render as inert text, never as <a>', function () {
  const raw = renderLinkableText('<img src=x onerror=alert(1)>');
  assert.strictEqual(raw, '&lt;img src=x onerror=alert(1)&gt;');
  assert.ok(raw.indexOf('<a ') === -1, 'payload produced an anchor');

  const js = renderLinkableText('javascript:alert(document.cookie)//.com');
  assert.strictEqual(js, 'javascript:alert(document.cookie)//.com');
  assert.ok(js.indexOf('<a ') === -1, 'javascript: payload produced an anchor');
});

test('renderLinkableText: legit URLs keep linkifying', function () {
  const out = renderLinkableText('https://example.com');
  assert.ok(out.indexOf('href="https://example.com"') !== -1, out);
  assert.ok(out.indexOf('rel="noopener noreferrer"') !== -1, out);
  assert.strictEqual(
    renderLinkableText('example.com/path'),
    '<a href="https://example.com/path" target="_blank" rel="noopener noreferrer">example.com/path</a>');
  assert.ok(renderLinkableText('mailto:a@example.com').indexOf('href="mailto:a@example.com"') !== -1);
  assert.strictEqual(linkableHref('ftp://example.com'), '');
  assert.strictEqual(renderLinkableText('ftp://example.com'), 'ftp://example.com');
});

test('renderLinkableText itself delegates to linkableHref', function () {
  assert.ok(appJs.indexOf('function linkableHref(') !== -1, 'linkableHref not bundled');
  assert.ok(appJs.indexOf('const href = linkableHref(normalized);') !== -1,
    'renderLinkableText must build href via linkableHref');
});

test('myday subtitle renders through escapeHtml', function () {
  assert.ok(appJs.indexOf("'<div class=\"myday-item-meta\">' + escapeHtml(subtitle)") !== -1,
    'My Day subtitle still interpolated raw into innerHTML');
});

test('raw link-url sinks route through linkableHref', function () {
  const sinks = [
    'const href = linkableHref(url);',                 // detail link panel
    'const href = linkableHref(r.url);',               // report print links
    'const meetingHref = linkableHref(meetingUrl);',   // Fathom meeting URL
    'const dashHref = linkableHref(r.url || \'\');'    // divisional dashboard link
  ];
  sinks.forEach(function (needle) {
    assert.ok(appJs.indexOf(needle) !== -1, 'missing sink guard: ' + needle);
  });
});

test('link preview gates its target before any navigation/embed', function () {
  assert.ok(appJs.indexOf('const safe = linkableHref(url);') !== -1, 'openLinkPreview gate missing?');
  assert.ok(appJs.indexOf('window.open(safe, \'_blank\')') !== -1, 'fallback window.open bypasses the gate');
  assert.ok(appJs.indexOf('if (openNew) openNew.href = safe;') !== -1, 'preview open-in-new-tab bypasses the gate');
  assert.ok(appJs.indexOf('Preview blocked') !== -1, 'blocked-preview toast missing');
});

test('embedded-link click delegate blocks non-http(s)/mailto/tel navigation', function () {
  assert.ok(appJs.indexOf("if (!/^https?:/i.test(href)) {") !== -1, 'delegate http(s) gate missing');
  assert.ok(appJs.indexOf("if (!/^(mailto|tel):/i.test(href)) event.preventDefault();") !== -1,
    'delegate must preventDefault scriptable-scheme navigation');
});

test('worker proxy-500 does not echo the upstream error detail', function () {
  const worker = fs.readFileSync(path.join(ROOT, 'src', 'worker', 'worker.js'), 'utf8');
  assert.ok(worker.indexOf("message: 'Proxy error: upstream request failed'") !== -1,
    'worker generic error message missing');
  assert.ok(worker.indexOf("'Proxy error: ' + inner") === -1,
    'worker still echoes the upstream error detail to clients');
  assert.ok(worker.indexOf("console.error('proxy failure on ' + path + ': ' + inner)") !== -1,
    'worker must keep the detail in the server log');
});
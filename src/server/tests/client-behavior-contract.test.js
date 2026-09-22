/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/client-behavior-contract.test.js
 * Part 18: client behavior contract tests with jsdom. Renders
 * the real app.html DOM, then exercises the dashboard table's
 * computed-colspan, column-visibility and editor multi-select
 * behaviors (plus the sanitizer) against a live DOM instead of
 * a regex. Functions are extracted verbatim from the committed
 * app.js bundle, so a rebuild-skipping edit fails here too.
 * ============================================================
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..', '..');
// Normalize to LF: the brace scan below is sensitive to a trailing \r on
// Windows worktrees (which masks a bad regex heuristic that LF checkouts hit).
const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').replace(/\r\n/g, '\n');
const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');

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
    if (ch === '/' && appJs[i + 1] === '/') {       // line comment
      const nl = appJs.indexOf('\n', i);
      i = nl === -1 ? appJs.length : nl;
      continue;
    }
    if (ch === '/' && appJs[i + 1] === '*') {       // block comment
      const close = appJs.indexOf('*/', i + 2);
      i = close === -1 ? appJs.length : close + 1;
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

function makeWindow() {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const window = dom.window;
  const code = 'var appState = { isEditor: true, dashboardPrefs: { columns: {} } };\n' +
    'var selectedDashRows_ = {};\n' +
    'var getEl = function (id) { return document.getElementById(id); };\n' +
    [extractFunction('visibleDashColumnCount'),
     extractFunction('applyColumnVisibility'),
     extractFunction('dashRowSelect'),
     extractFunction('toggleDashSelectAll'),
     extractFunction('selectedDashRowsArray_'),
     extractFunction('updateDashBatchBar'),
     extractFunction('clearDashSelection'),
     extractFunction('sanitizeFieldHtml_')].join('\n');
  window.eval(code);
  // Seed one data row (10 tds: sel + id + 8 visible-field tds, matching the
  // 9 th[data-col]) plus a full-width AI panel row attached like the client.
  window.document.querySelector('#dashboardTable tbody').innerHTML =
    '<tr class="row-clickable" data-row="7">' +
    '<td class="dash-sel-col"><input type="checkbox" class="dash-row-check" data-row="7"></td>' +
    '<td>x</td><td>y</td><td>z</td><td>a</td><td>b</td><td>c</td><td>d</td><td>e</td>' +
    '</tr>';
  return window;
}

test('visibleDashColumnCount tracks the toggled-off columns', function () {
  const w = makeWindow();
  assert.strictEqual(w.visibleDashColumnCount(), 9, 'default 9 columns');
  w.appState.dashboardPrefs.columns.description = false;
  assert.strictEqual(w.visibleDashColumnCount(), 8);
  w.appState.dashboardPrefs.columns.id = false;
  assert.strictEqual(w.visibleDashColumnCount(), 7);
});

test('applyColumnVisibility hides cells in sync with headers but keeps AI panels', function () {
  const w = makeWindow();
  w.appState.dashboardPrefs.columns.sector = false;
  w.applyColumnVisibility();
  const ths = w.document.querySelectorAll('#dashboardTable th[data-col]');
  const tds = w.document.querySelectorAll('#dashboardTable tbody tr:not(.ai-insight-tr) td');
  assert.strictEqual(tds[2].style.display, 'none', 'sector td hidden (td index 2)');
  assert.strictEqual(tds[1].style.display, '', 'id td visible');
  assert.strictEqual(tds[0].style.display, '', 'sel td visible');
  assert.strictEqual(ths[2].style.display, 'none', 'sector th hidden');
  // Panels opened while a column is off must span exactly the visible count.
  w.document.querySelector('#dashboardTable tbody').innerHTML +=
    '<tr class="ai-insight-tr"><td colspan="' + w.visibleDashColumnCount() + '">panel</td></tr>';
  w.applyColumnVisibility();
  const panels = w.document.querySelectorAll('#dashboardTable tbody tr.ai-insight-tr td');
  assert.strictEqual(panels.length, 1, 'AI panel row present');
  assert.strictEqual(panels[0].style.display, '', 'full-width panel must NOT be hidden by column toggles');
  assert.strictEqual(panels[0].getAttribute('colspan'), '8', 'panel colspan matches visible count');
});

test('multi-select drives the batch bar and count', function () {
  const w = makeWindow();
  assert.ok(w.document.getElementById('dashBatchBar').classList.contains('hidden'));
  const box = w.document.querySelector('.dash-row-check');
  box.checked = true;
  w.dashRowSelect(box);
  assert.ok(!w.document.getElementById('dashBatchBar').classList.contains('hidden'), 'bar appears');
  assert.strictEqual(w.document.getElementById('dashBatchCount').textContent, '1 selected');
  box.checked = false;
  w.dashRowSelect(box);
  assert.ok(w.document.getElementById('dashBatchBar').classList.contains('hidden'), 'bar hides when empty');
});

test('select-all checks every visible row checkbox', function () {
  const w = makeWindow();
  w.document.querySelector('#dashboardTable tbody').innerHTML =
    '<tr><td class="dash-sel-col"><input type="checkbox" class="dash-row-check" data-row="1"></td>' +
    '<td>1</td><td>1</td><td>1</td><td>1</td><td>1</td><td>1</td><td>1</td><td>1</td></tr>' +
    '<tr><td class="dash-sel-col"><input type="checkbox" class="dash-row-check" data-row="2"></td>' +
    '<td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td></tr>';
  const all = w.document.getElementById('dashSelAll');
  all.checked = true;
  w.toggleDashSelectAll(all);
  assert.ok(w.document.querySelectorAll('.dash-row-check')[0].checked, 'row 1 checked');
  assert.ok(w.document.querySelectorAll('.dash-row-check')[1].checked, 'row 2 checked');
  assert.strictEqual(w.document.getElementById('dashBatchCount').textContent, '2 selected');
  w.clearDashSelection();
  assert.ok(!w.document.querySelector('.dash-row-check').checked, 'clear unchecks rows');
});

test('sanitizer neutralises scriptable payloads handed to .innerHTML', function () {
  const w = makeWindow();
  const el = w.document.createElement('div');
  el.innerHTML = w.sanitizeFieldHtml_('<b>ok</b><img src=x onerror=alert(1)><a href="javascript:void(0)">x</a>');
  assert.strictEqual(el.querySelectorAll('script, img, iframe').length, 0, 'executable nodes dropped');
  assert.strictEqual(el.querySelectorAll('a[href^="javascript:"]').length, 0, 'scriptable href dropped');
  assert.ok(el.querySelector('b'), 'allowlisted tag preserved');
});
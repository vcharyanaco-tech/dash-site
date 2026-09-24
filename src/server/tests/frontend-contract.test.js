/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/frontend-contract.test.js
 * Part 18 frontend coverage without a browser: asserts the
 * shipped app.html + app.js keep the contracts the UI depends on
 * (grouped role-aware nav, the System Health card, ARIA sortable
 * headers). These run against the committed bundle, so a manual
 * edit of app.js that skips the module rebuild fails here.
 * ============================================================
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

test('sidebar is grouped into the Part 4 sections', function () {
  ['overview', 'work', 'insights', 'admin'].forEach(function (group) {
    assert.ok(html.indexOf('data-group-label="' + group + '"') !== -1,
      'missing group label: ' + group);
  });
});

test('audit nav item is the only permission-gated destination', function () {
  const gated = html.match(/data-perm="([^"]+)"/g) || [];
  assert.deepStrictEqual(gated, ['data-perm="audit"']);
});

test('every nav item declares a group and a tab', function () {
  const items = html.match(/<button class="nav-item[^"]*"[^>]*>/g) || [];
  assert.ok(items.length >= 7, 'expected at least 7 nav items, saw ' + items.length);
  items.forEach(function (tag) {
    assert.ok(tag.indexOf('data-tab="') !== -1, 'nav item missing data-tab: ' + tag);
    assert.ok(tag.indexOf('data-group="') !== -1, 'nav item missing data-group: ' + tag);
  });
});

test('app.js wires applyNavPermissions into applyAppData', function () {
  assert.ok(appJs.indexOf('function applyNavPermissions()') !== -1, 'applyNavPermissions not defined');
  assert.ok(appJs.indexOf('applyNavPermissions();') !== -1, 'applyNavPermissions never called');
});

test('System Health card exists with a live region body', function () {
  assert.ok(html.indexOf('id="systemHealthCard"') !== -1, 'systemHealthCard missing');
  assert.ok(html.indexOf('id="systemHealthBody"') !== -1, 'systemHealthBody missing');
  assert.match(html, /id="systemHealthBody"[^>]*aria-live="polite"/);
  assert.ok(appJs.indexOf('loadSystemHealth') !== -1, 'loadSystemHealth not bundled');
});

test('sortable headers expose aria-sort without role=button', function () {
  assert.ok(appJs.indexOf("setAttribute('aria-sort'") !== -1, 'aria-sort not managed');
  assert.ok(appJs.indexOf('thead th[data-dash-sort]') !== -1, 'dashboard sortable headers missing');
  assert.ok(appJs.indexOf('thead th[data-sort]') !== -1, 'audit sortable headers missing');
  assert.ok(appJs.indexOf("setAttribute('role', 'button')") === -1, 'sortable header still gets role=button');
});

test('dialog focus restoration helpers are bundled', function () {
  assert.ok(appJs.indexOf('dialogReturnFocus_') !== -1, 'dialogReturnFocus_ missing');
  assert.ok(appJs.indexOf('getDialogFocusable_') !== -1, 'getDialogFocusable_ missing');
});

test('link preview rebuilds a missing #previewFrame instead of escaping to a new tab', function () {
  // Regression: presentation-mode close parks #previewFrame in a hidden warm
  // holder (and exit destroys it), so the stage is legitimately frame-less on
  // the next open. openLinkPreview must rebuild the frame rather than falling
  // into the window.open new-tab path after the first preview.
  assert.ok(appJs.indexOf('function ensurePreviewFrame_(stage)') !== -1,
    'ensurePreviewFrame_ missing');
  assert.ok(appJs.indexOf("if (!stage) { window.open(safe, '_blank'); return; }") !== -1,
    'openLinkPreview must only fall back to a new tab when #previewStage is missing');
  assert.ok(appJs.indexOf("if (!frame) { window.open(url, '_blank'); return; }") === -1,
    'openLinkPreview still bails to a new tab when #previewFrame is absent');
  assert.ok(appJs.indexOf('ensurePreviewFrame_(stage)') !== -1,
    'openLinkPreview never invokes ensurePreviewFrame_');
});

test('no native prompt()/confirm() boxes remain', function () {
  assert.ok(appJs.indexOf('if (!confirm(') === -1, 'native confirm() block still present');
  assert.ok(appJs.indexOf('window.confirm(') === -1, 'window.confirm still present');
  assert.ok(appJs.indexOf('= prompt(') === -1, 'native prompt() call still present');
  assert.ok(appJs.indexOf('function showPrompt(') !== -1, 'in-app showPrompt helper missing');
  assert.ok(appJs.indexOf('function showConfirm(') !== -1, 'in-app showConfirm helper missing');
});

test('dashboard table supports editor multi-select', function () {
  assert.ok(appJs.indexOf('function toggleDashSelectAll(') !== -1, 'toggleDashSelectAll missing');
  assert.ok(appJs.indexOf('function dashRowSelect(') !== -1, 'dashRowSelect missing');
  assert.ok(appJs.indexOf('function dashBatchReview(') !== -1, 'bulk review missing');
  assert.ok(appJs.indexOf('selectedDashRows_') !== -1, 'selection state missing');
  assert.ok(appJs.indexOf('visibleDashColumnCount()') !== -1, 'computed colspan missing');
});

test('no top-level function name is declared twice (bundle scope collision)', function () {
  // The build concatenates every module into a single global scope, so a
  // second top-level `function X` hoists over the first. That produced an
  // infinite recursion in the command palette when studio.js's debounce
  // wrapper (also named filterCommands) captured itself via _origFilterCommands.
  const dupes = {};
  const lines = appJs.split('\n');
  lines.forEach(function (line) {
    const m = /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (m) dupes[m[1]] = (dupes[m[1]] || 0) + 1;
  });
  const conflicts = Object.keys(dupes).filter(function (name) { return dupes[name] > 1; });
  assert.deepStrictEqual(conflicts, [],
    'duplicate top-level function declarations collide across bundled modules: ' + conflicts.join(', '));
});

test('command palette input debounces through a distinct helper name', function () {
  assert.ok(html.indexOf('oninput="filterCommandsDebounced_(this.value)"') !== -1,
    'app.html command input must call the debounced palette helper');
  assert.ok(appJs.indexOf('function filterCommandsDebounced_(query)') !== -1,
    'debounced palette helper not bundled');
  assert.ok(appJs.indexOf('_origFilterCommands') === -1,
    'self-capturing filterCommands wrapper must stay removed');
});

test('Dash AI ask path reads the server-stamped r.insights (regression guard: ec98110)', function () {
  assert.ok(appJs.indexOf('r.text||r.answer||r.insights||') !== -1 ||
            appJs.indexOf('r.text || r.answer || r.insights ||') !== -1,
    'workspace ask fallback must read server-stamped r.insights');
  assert.ok(appJs.indexOf('r.text||r.answer||') !== -1 ||
            appJs.indexOf('r.text || r.answer ||') !== -1,
    'workspace ask fallback must keep the legacy text/answer fallback');
});

test('global search modal input repaints results on typing', function () {
  // v1.2.2 repurposed the topbar #searchInput into a launcher for the Global
  // Search modal and moved focus to #globalSearchInput, but nothing listened
  // for input on that field — so typing in the search bar did nothing
  // (the old dashboard-filter path in init.js is bypassed while
  // handleWorkspaceSearchInput_ exists). Every keystroke must re-run
  // renderGlobalSearch_.
  assert.ok(appJs.indexOf("gsi.addEventListener('input'") !== -1,
    'global search input must repaint results on every keystroke');
  assert.ok(appJs.indexOf('renderGlobalSearch_(gsi.value)') !== -1,
    'global search input must re-run renderGlobalSearch_ with its value');
});


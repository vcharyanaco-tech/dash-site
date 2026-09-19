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

'use strict';

/* ============================================================
   PWA installability contract
   Guards against the classic "missing icons" regression: the
   manifest must reference an icon that actually ships everywhere
   the app is deployed (repo root => Docker container COPY list,
   GitHub Pages, and the Cloudflare Workers enterprise route).
   ============================================================ */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const DOCKERFILE = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
const WORKER = fs.readdirSync(path.join(ROOT, 'src', 'worker'))
  .filter(function (f) { return f.endsWith('.js'); })
  .map(function (f) { return fs.readFileSync(path.join(ROOT, 'src', 'worker', f), 'utf8'); })
  .join('\n');

test('manifest declares an installable icon', function () {
  assert.ok(Array.isArray(MANIFEST.icons) && MANIFEST.icons.length >= 1, 'no icons in manifest');
  const icon = MANIFEST.icons[0];
  assert.ok(icon && icon.src, 'icon missing src');
  assert.ok(icon.purpose && String(icon.purpose).indexOf('maskable') !== -1, 'icon should be maskable-safe');
  assert.ok(/\.(svg|png|ico)$/i.test(icon.src), 'icon must be a web image asset');
});

test('icon file exists at the served site root', function () {
  const src = MANIFEST.icons[0].src.replace(/^\//, '');
  assert.ok(fs.existsSync(path.join(ROOT, src)), 'missing icon file at repo root: ' + src);
});

test('Dockerfile ships the icon into /app/www', function () {
  const base = MANIFEST.icons[0].src.replace(/^\//, '');
  assert.ok(DOCKERFILE.indexOf(base) !== -1, 'Dockerfile COPY omits ' + base);
});

test('worker enterprise routes serve the manifest + icon', function () {
  assert.ok(WORKER.indexOf("ENTERPRISE_MANIFEST_PATH = '/manifest.json'") !== -1, 'manifest route missing');
  assert.ok(WORKER.indexOf("ENTERPRISE_ICON_PATH = '" + MANIFEST.icons[0].src + "'") !== -1, 'icon route missing');
});

test('manifest id/start_url/scope agree on /app.html root', function () {
  assert.ok(MANIFEST.id && MANIFEST.id.indexOf('/app.html') !== -1, 'manifest id should anchor /app.html');
  assert.ok(MANIFEST.start_url === '/app.html', 'start_url should be /app.html');
  assert.ok(MANIFEST.scope === '/', 'scope should be /');
});
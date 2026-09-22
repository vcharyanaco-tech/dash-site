'use strict';

/* ============================================================
   i18n contract tests
   Proves the language abstraction is actually covered by real
   UI: every [data-i18n] key in app.html must exist in both the
   client dictionary (src/i18n.js) and the server endpoint
   dictionary (src/server/i18n-server.js), in both languages,
   with matching values (no drift) and intact Devanagari.
   ============================================================ */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');
const APP_HTML = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
const CLIENT_I18N = fs.readFileSync(path.join(ROOT, 'src', 'i18n.js'), 'utf8');
const { getTranslations } = require(path.join(__dirname, '..', 'i18n-server.js'));

function usedKeys() {
  const keys = [];
  const re = /data-i18n(?:-placeholder)?="([A-Za-z0-9._]+)"/g;
  let m;
  while ((m = re.exec(APP_HTML)) !== null) keys.push(m[1]);
  return keys.filter(function (k, i) { return keys.indexOf(k) === i; });
}

function clientDict(lang) {
  const marker = lang + ': {';
  const hi = CLIENT_I18N.indexOf('hi: {');
  const en = CLIENT_I18N.indexOf('en: {');
  const start = CLIENT_I18N.indexOf(marker);
  assert.ok(start !== -1, 'client dict missing ' + lang);
  const end = lang === 'en' ? hi - start : CLIENT_I18N.length;
  const block = CLIENT_I18N.slice(start, start + end);
  const out = {};
  const re = /^\s*'([A-Za-z0-9._]+)': '((?:[^'\\]|\\.)*)',$/gm;
  let m;
  while ((m = re.exec(block)) !== null) out[m[1]] = m[2];
  return out;
}

const DEVANAGARI = /[\u0900-\u097F]/;

test('sidebar/chrome carries data-i18n wiring', function () {
  assert.ok(usedKeys().length >= 12, 'expected 12+ used i18n keys, got ' + usedKeys().length);
});

test('every used key exists in client dict (en + hi)', function () {
  const clientEn = clientDict('en');
  const clientHi = clientDict('hi');
  const missing = usedKeys().filter(function (k) { return !(k in clientEn); });
  assert.deepStrictEqual(missing, [], 'client en missing: ' + missing.join(', '));
  const missingHi = usedKeys().filter(function (k) { return !(k in clientHi); });
  assert.deepStrictEqual(missingHi, [], 'client hi missing: ' + missingHi.join(', '));
});

test('every used key exists in server dict (en + hi)', function () {
  const serverEn = getTranslations('en');
  const serverHi = getTranslations('hi');
  const missing = usedKeys().filter(function (k) { return !(k in serverEn); });
  assert.deepStrictEqual(missing, [], 'server en missing: ' + missing.join(', '));
  const missingHi = usedKeys().filter(function (k) { return !(k in serverHi); });
  assert.deepStrictEqual(missingHi, [], 'server hi missing: ' + missingHi.join(', '));
});

test('server and client dictionaries do not drift on used keys', function () {
  const clientEn = clientDict('en');
  const clientHi = clientDict('hi');
  const serverEn = getTranslations('en');
  const serverHi = getTranslations('hi');
  usedKeys().forEach(function (k) {
    assert.strictEqual(serverEn[k], clientEn[k], 'en drift on ' + k);
    assert.strictEqual(serverHi[k], clientHi[k], 'hi drift on ' + k);
  });
});

test('client and server en/hi cover identical used key sets', function () {
  const clientEn = clientDict('en');
  const clientHi = clientDict('hi');
  const serverEn = getTranslations('en');
  const serverHi = getTranslations('hi');
  const used = usedKeys();
  used.forEach(function (k) {
    assert.ok((k in clientEn) === (k in clientHi), 'client en/hi set differ on ' + k);
    assert.ok((k in serverEn) === (k in serverHi), 'server en/hi set differ on ' + k);
  });
});

test('Devanagari values survive both dictionaries intact', function () {
  const clientHi = clientDict('hi');
  const serverHi = getTranslations('hi');
  const check = ['nav.dashboard', 'nav.myday', 'nav.sectionWork', 'dashboard.live'];
  check.forEach(function (k) {
    assert.ok(DEVANAGARI.test(clientHi[k]), 'client hi ' + k + ' not Devanagari: ' + clientHi[k]);
    assert.ok(DEVANAGARI.test(serverHi[k]), 'server hi ' + k + ' not Devanagari: ' + serverHi[k]);
  });
});

test('toggleLanguage is wired in the built client', function () {
  const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.ok(appJs.indexOf('function toggleLanguage()') !== -1, 'toggleLanguage missing from app.js');
  assert.ok(appJs.indexOf("i18n.setLanguage(next)") !== -1, 'setLanguage call missing');
  assert.ok(appJs.indexOf("i18n.applyTranslations()") !== -1, 'applyTranslations call missing');
});
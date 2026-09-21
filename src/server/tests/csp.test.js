/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/csp.test.js
 * Phase 13 §5 — CSP hardening: verifies the nonce-based policy is
 * built with the split script-src-elem/-attr directives, that HTML
 * responses carry a per-request nonce both in the header and stamped
 * onto their <script> tags, and that the nonce rotates per request.
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { password } = require('./test-bootstrap');
const { server } = require('../index');
const { buildCsp, generateNonce, stampCspNonce } = require('../csp');

let port;

before(async function () {
  await new Promise(function (resolve) {
    server.listen(0, function () {
      port = server.address().port;
      resolve();
    });
  });
});

after(function () {
  server.close();
});

test('buildCsp drops unsafe-inline for script elements in favour of the nonce', function () {
  const nonce = generateNonce();
  const csp = buildCsp(nonce);
  assert.ok(csp.indexOf("script-src-elem 'self' 'nonce-" + nonce + "'") !== -1,
    'script-src-elem must carry the per-request nonce');
  const elem = csp.split(';').filter(function (s) { return s.indexOf('script-src-elem') !== -1; })[0] || '';
  assert.ok(elem && elem.indexOf("'unsafe-inline'") === -1,
    'script-src-elem must not allow blanket inline execution');
  assert.ok(csp.indexOf("script-src-attr 'unsafe-inline'") !== -1,
    'inline handler attributes (hundreds of onclick=) stay allowed');
  assert.ok(csp.indexOf("media-src 'self' blob:") !== -1,
    'meeting recording player uses object URLs');
  assert.ok(csp.indexOf('frame-src') !== -1 && csp.indexOf('https:') !== -1,
    'AI link preview loads arbitrary external iframes');
  assert.ok(csp.indexOf("worker-src 'self'") !== -1, 'service worker stays same-origin');
  assert.ok(csp.indexOf("frame-ancestors 'self'") !== -1, 'clickjacking guard preserved');
});

test('stampCspNonce adds the nonce to inline and external script tags', function () {
  const nonce = 'unit-test-nonce';
  const html = '<html><head></head><body><script src="app.js"></script><script>inline()</script></body></html>';
  const stamped = stampCspNonce(html, nonce);
  assert.ok(stamped.indexOf('<script src="app.js" nonce="' + nonce + '">') !== -1,
    'external bundle script must carry the nonce');
  assert.ok(stamped.indexOf('<script nonce="' + nonce + '">inline()</script>') !== -1,
    'inline script must carry the nonce');
});

test('HTML responses carry a nonce that matches the CSP header and body', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/');
  assert.strictEqual(resp.status, 200);
  const csp = resp.headers.get('content-security-policy') || '';
  assert.match(csp, /script-src-elem 'self' 'nonce-[^']+'/);
  const headerNonce = (csp.match(/nonce-([^']+)/) || [])[1];
  assert.ok(headerNonce, 'CSP header must carry a nonce');
  const body = await resp.text();
  const bodyNonce = (body.match(/<script[^>]*\snonce="([^"]+)"/) || [])[1];
  assert.strictEqual(bodyNonce, headerNonce, 'body script nonce must equal the header nonce');
});

test('the nonce rotates per request (fresh nonce each load)', async function () {
  async function grabNonce() {
    const resp = await fetch('http://127.0.0.1:' + port + '/');
    const csp = resp.headers.get('content-security-policy') || '';
    return (csp.match(/nonce-([^']+)/) || [])[1];
  }
  const a = await grabNonce();
  const b = await grabNonce();
  assert.notStrictEqual(a, b, 'two requests must receive different nonces');
  assert.ok(a && b, 'both requests must have a nonce');
});

test('CSP header applies to API responses too (middleware is global)', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: 'login', args: ['vcharyanaco@gmail.com', password] })
  });
  const csp = resp.headers.get('content-security-policy') || '';
  assert.match(csp, /script-src-elem/, 'API responses ride the same nonce policy');
});
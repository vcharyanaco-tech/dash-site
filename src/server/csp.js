/**
 * ============================================================
 * India Post Dashboard — Node port
 * csp.js
 * Content-Security-Policy builder with per-request nonces.
 *
 * The nonce is generated fresh for every HTTP request and injected
 * into the served HTML by stampCspNonce (one nonce per request, used
 * both in the CSP header and on every <script> tag). Browsers enforce
 * that only scripts whose nonce attribute matches the CSP header are
 * allowed to run.
 *
 * Directive design (CSP Level 3 splits script-src):
 *  - script-src-elem   controls <script> ELEMENT loading. We allow
 *                      'self' (the app bundle app.js) plus the per-request
 *                      nonce so ONLY server-stamped inline scripts execute.
 *  - script-src-attr   controls inline event-handler ATTRIBUTES
 *                      (onclick=, onchange=, ...). This app uses hundreds of
 *                      them across app.html (and the print-toolbar snippets
 *                      written into about:blank pop-ups). Standard practice
 *                      is to move them to addEventListener, but that would be
 *                      a UI-wide refactor; an explicit 'unsafe-inline' here is
 *                      the honest carve-out instead of pretending scripts are
 *                      nonce-gated when handler attributes are not.
 *  - script-src        legacy fallback for browsers without the *-elem/*-attr
 *                      split. 'unsafe-inline' there keeps pre-CSP3 browsers
 *                      working exactly as they do today — the strict
 *                      nonce-gating only bites on modern browsers.
 *
 * Other directives reflect the real app surface:
 *  - media-src blob:   meeting-recording player uses object URLs
 *                      (URL.createObjectURL) for <video> playback.
 *  - frame-src https/http/data/about: the AI link preview loads arbitrary
 *                      external URLs into its iframe (Drive/Docs embeds plus
 *                      raw web pages) and resets to about:blank.
 *  - worker-src 'self' service worker registration (sw.js) stays same-origin.
 * ============================================================
 */

const crypto = require('crypto');

function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

function buildCsp(nonce) {
  return [
    "default-src 'self'",
    // Legacy fallback for browsers that predate script-src-elem/attr.
    "script-src 'self' 'unsafe-inline'",
    // Script ELEMENTS: same-origin bundle + stamped-inline only.
    "script-src-elem 'self' 'nonce-" + nonce + "'",
    // Inline event-handler attributes (onclick= etc.) — app reality.
    "script-src-attr 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "frame-src 'self' data: https: http: about:",
    "worker-src 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'"
  ].join('; ');
}

/**
 * Stamps the per-request nonce onto every inline <script> tag in the served
 * HTML (it is harmless on external <script src="app.js"> too). Existing nonce
 * attributes are never duplicated. The client reads the value back from the
 * nonce attribute on the app bundle's <script> tag (pageCspNonce) so that
 * dynamically written print pages — which inherit this page's CSP, nonce
 * included — can stamp their own inline scripts.
 */
function stampCspNonce(html, nonce) {
  return html.replace(/<script\b(?![^>]*\snonce=)([^>]*?)>/gi, function (match, attrs) {
    return '<script' + attrs + ' nonce="' + nonce + '">';
  });
}

/**
 * Express middleware that generates a per-request nonce, builds the CSP
 * header, and attaches it to the response. The nonce is exposed on
 * res.locals.cspNonce for the HTML-serving pipeline.
 */
function cspMiddleware(req, res, next) {
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;
  res.setHeader('Content-Security-Policy', buildCsp(nonce));
  next();
}

module.exports = { generateNonce, buildCsp, stampCspNonce, cspMiddleware };
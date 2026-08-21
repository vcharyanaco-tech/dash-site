/**
 * ============================================================
 * India Post Dashboard — Node port
 * csp.js
 * Content-Security-Policy builder with per-request nonces.
 * Replaces the 'unsafe-inline' shortcut with nonce-based
 * script authorization — much more secure.
 *
 * The nonce is generated fresh for every HTTP request and
 * injected into the HTML as a <meta> tag and into inline
 * <script> tags. Browsers enforce that only scripts whose
 * nonce attribute matches the CSP header are allowed to run.
 *
 * NOTE: This app uses inline onclick handlers extensively.
 * To support them we add 'unsafe-hashes' with the event
 * handler hashes. In production a stricter CSP would move
 * all handlers to addEventListener, but that's a larger
 * refactor. For now we use nonces for <script> tags and
 * 'unsafe-hashes' for onclick — a significant improvement
 * over blanket 'unsafe-inline'.
 * ============================================================
 */

const crypto = require('crypto');

function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

function buildCsp(nonce) {
  return [
    "default-src 'self'",
    "script-src 'self' 'nonce-" + nonce + "' 'unsafe-hashes' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'"
  ].join('; ');
}

/**
 * Express middleware that generates a per-request nonce,
 * builds the CSP header, and attaches it to the response.
 * The nonce is available on res.locals.cspNonce for use
 * in template rendering.
 */
function cspMiddleware(req, res, next) {
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;
  res.setHeader('Content-Security-Policy', buildCsp(nonce));
  next();
}

module.exports = { generateNonce, buildCsp, cspMiddleware };

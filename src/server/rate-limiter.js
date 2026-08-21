/**
 * ============================================================
 * India Post Dashboard — Node port
 * rate-limiter.js
 * Sliding-window per-IP rate limiter (no dependencies).
 * Stores hit counts in a Map with automatic cleanup.
 * ============================================================
 */

const MAX_POST_PER_MIN = Number(process.env.RATE_LIMIT_POST || 120);
const WINDOW_MS = 60 * 1000; // 1 minute

// Map<string, { count: number, resetAt: number }>
const buckets = new Map();

// Periodic cleanup every 5 minutes so the map doesn't grow unbounded.
setInterval(function () {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket && req.socket.remoteAddress || '0.0.0.0';
}

/**
 * Express middleware: 429 with Retry-After when the IP exceeds the limit.
 * Only applied to POST /api (not GET /api/health or static files).
 */
function rateLimiter(req, res, next) {
  if (req.method !== 'POST') return next();

  const ip = getClientIp(req);
  const now = Date.now();
  let entry = buckets.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    buckets.set(ip, entry);
    return next();
  }

  entry.count++;
  if (entry.count > MAX_POST_PER_MIN) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many requests. Please try again in ' + retryAfter + ' seconds.'
    });
  }

  next();
}

module.exports = { rateLimiter, getClientIp };

/**
 * Cloudflare Worker — Split-routing proxy
 *
 * Routing:
 *   /api, /macros/*, /static/*  → Node/SQLite backend (SERVER_ORIGIN)
 *   dashboardharyana.site/*      → current frontend bundle (dash-site repo root
 *                                  via raw CDN, same files GitHub Pages serves)
 *
 * Why raw CDN instead of GitHub Pages:
 *   vcharyanaco-tech.github.io/* 301-redirects to the custom domain, which
 *   Cloudflare forwards back to this Worker — an infinite loop.
 *   raw.githubusercontent.com serves the same files with correct Content-Type
 *   and no redirect.
 *
 * GAS CSP-safe approach (for /app.html):
 *   - NO <base> tag injection (blocked by Google's base-uri 'self' CSP)
 *   - Rewrite all relative /static/... URLs to absolute script.google.com URLs
 *   - Inject disclaimer-killer CSS/JS using the page's own nonce
 */

import { isEnterprisePath, enterpriseHeadersForPath } from './worker-enterprise-routes.js';
import { connect } from 'cloudflare:sockets';

const GITHUB_RAW = 'https://raw.githubusercontent.com/vcharyanaco-tech/dash-site/main';

const COMMON_HEADERS = {
  'X-Frame-Options': 'ALLOWALL',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Referrer-Policy': 'no-referrer-when-downgrade',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...COMMON_HEADERS, 'Access-Control-Max-Age': '86400' },
      });
    }

    // ── Route: /api/* ───────────────────────────────────────────────────────
    // Enterprise routes (AI insights, WhatsApp) use Worker-only secrets and are
    // handled locally. ALL other /api/* calls (the dashboard dispatcher + file
    // streaming) are forwarded to the Node/SQLite backend (SERVER_ORIGIN),
    // which replaces the old Google Apps Script backend.
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      if (isEnterpriseApiPath(url.pathname)) {
        return handleEnterpriseRoute(request, env, url, ctx);
      }
      const serverOrigin = env.SERVER_ORIGIN;
      if (!serverOrigin) {
        return new Response('Worker not configured: SERVER_ORIGIN missing', { status: 500, headers: COMMON_HEADERS });
      }
      return forwardToServer(request, url, serverOrigin);
    }

    // ── Route: /macros/* → Node server dispatcher (was GAS script) ──────────
    // Legacy client posts function(args) here; forward to /api.
    if (url.pathname.startsWith('/macros/')) {
      const serverOrigin = env.SERVER_ORIGIN;
      if (!serverOrigin) {
        return new Response('Worker not configured: SERVER_ORIGIN missing', { status: 500, headers: COMMON_HEADERS });
      }
      const target = new URL(serverOrigin + '/api' + (url.search || ''));
      return forwardToServer(request, target, serverOrigin);
    }

    // ── Route: /static/* → Node server static assets (was GAS warden) ───────
    if (url.pathname.startsWith('/static/')) {
      const serverOrigin = env.SERVER_ORIGIN;
      if (!serverOrigin) {
        return new Response('Worker not configured: SERVER_ORIGIN missing', { status: 500, headers: COMMON_HEADERS });
      }
      const target = new URL(serverOrigin + url.pathname + (url.search || ''));
      return forwardToServer(request, target, serverOrigin);
    }

    const GAS_BASE_URL = env.GAS_URL;
    const GAS_SCRIPT_URL = env.GAS_SCRIPT_URL;
    // GAS is no longer required for routing; GAS_URL/GAS_SCRIPT_URL are kept
    // only for backward compatibility and are otherwise unused.

    // ── Route: everything else → GitHub Pages static bundle (docs/) ─────────
    // /app.html is served as docs/app.html (standalone static page, no GAS wrapper).
    // The GAS proxy approach can't work cross-domain: googleusercontent.com's
    // maeInit_ only accepts postMessage from script.google.com, so proxying the
    // GAS outer wrapper from dashboardharyana.site always produces a blank page.

    // PWA assets: upgrade response headers for manifest / sw / offline-queue / icon
    if (isEnterprisePath(path)) {
      const headers = enterpriseHeadersForPath(path);
      if (headers) {
        const resp = await fetchFromPages(path, url.search);
        const newHeaders = new Headers(resp.headers);
        Object.entries(headers).forEach(([k, v]) => newHeaders.set(k, v));
        return new Response(resp.body, { status: resp.status, headers: newHeaders });
      }
    }

    return fetchFromPages(path, url.search);
  },

  // ── Keep-alive cron ───────────────────────────────────────────────────────
  // Render free web services spin down after 15 min without traffic (~1 min
  // cold start). The scheduled trigger (wrangler `[triggers]` / schedules API,
  // "*/10 * * * *") pings the Node backend's own /api/health directly so the
  // instance never idles out. Hitting SERVER_ORIGIN (not this worker's
  // /api/health, which is served locally) is intentional.
  async scheduled(event, env, ctx) {
    const origin = env.SERVER_ORIGIN;
    if (!origin) return;
    try {
      await fetch(origin.replace(/\/+$/, '') + '/api/health', {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; dashv1-keepalive)' },
      });
    } catch (err) {
      // Transient failure — the next tick retries.
    }
  },
};

// ── GitHub Pages static bundle fetcher ──────────────────────────────────────
async function fetchFromPages(path, search) {
  // Map request path to a docs/ file on the raw GitHub CDN.
  // / and /index.html → docs/index.html (the landing page)
  let filePath = path;
  if (!filePath || filePath === '/') filePath = '/index.html';

  // Include query string when fetching from GitHub Raw to bypass CDN caching
  const rawUrl = GITHUB_RAW + filePath + (search || '');

  const resp = await fetch(rawUrl, { redirect: 'follow' });

  if (resp.status === 404) {
    // Fallback: serve index.html for unknown paths (SPA-style)
    const fallback = await fetch(GITHUB_RAW + '/index.html');
    const html = await fallback.text();
    return new Response(html, {
      status: 200,
      headers: {
        ...COMMON_HEADERS,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  // Determine content-type from path extension since raw CDN may not set it
  const ct = guessContentType(filePath) || resp.headers.get('Content-Type') || 'application/octet-stream';
  const body = await resp.arrayBuffer();

  const headers = {
    ...COMMON_HEADERS,
    'Content-Type': ct,
    'Cache-Control': filePath.match(/\.(js|css|png|ico|jpg|svg|woff2?)(\?|$)/)
      ? 'public, max-age=3600'
      : 'public, max-age=300',
  };

  return new Response(body, { status: resp.status, headers });
}

function guessContentType(path) {
  const p = path.split('?')[0];
  if (p.endsWith('.html')) return 'text/html; charset=utf-8';
  if (p.endsWith('.js'))   return 'application/javascript; charset=utf-8';
  if (p.endsWith('.css'))  return 'text/css; charset=utf-8';
  if (p.endsWith('.json')) return 'application/json; charset=utf-8';
  if (p.endsWith('.png'))  return 'image/png';
  if (p.endsWith('.ico'))  return 'image/x-icon';
  if (p.endsWith('.svg'))  return 'image/svg+xml';
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
  if (p.endsWith('.woff2')) return 'font/woff2';
  if (p.endsWith('.woff'))  return 'font/woff';
  return null;
}

// ── GAS proxy fetcher (banner-stripped) ─────────────────────────────────────
async function fetchFromGas(request, GAS_BASE_URL, GAS_SCRIPT_URL) {
  const gasScriptOrigin = new URL(GAS_SCRIPT_URL).origin;

  const gasHeaders = new Headers(request.headers);
  gasHeaders.delete('Host');
  gasHeaders.delete('Referer');

  const response = await fetch(GAS_BASE_URL, {
    method: request.method,
    headers: gasHeaders,
    body: request.method === 'GET' ? undefined : request.body,
    redirect: 'manual',
  });

  const contentType = response.headers.get('Content-Type') || '';

  if (contentType.includes('text/html')) {
    let html = await response.text();
    html = processHtml(html, gasScriptOrigin);
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Content-Type', 'text/html; charset=utf-8');
    Object.entries(COMMON_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
    return new Response(html, { status: response.status, headers: newHeaders });
  }

  if (contentType.includes('javascript') || request.url.endsWith('.js')) {
    let js = await response.text();
    js = stripDisclaimerJs(js);
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Content-Type', 'application/javascript; charset=utf-8');
    Object.entries(COMMON_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
    return new Response(js, { status: response.status, headers: newHeaders });
  }

  const body = await response.arrayBuffer();
  const newHeaders = new Headers(response.headers);
  Object.entries(COMMON_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
  return new Response(body, { status: response.status, headers: newHeaders });
}

/**
 * Main HTML processor:
 *  1. Remove any <base> tags (we use absolute URL rewriting instead)
 *  2. Rewrite relative /static/... and /macros/... URLs to absolute
 *  3. Extract the page's nonce so injected scripts/styles pass CSP
 *  4. Inject disclaimer-killer CSS and JS using that nonce
 *  5. Strip disclaimer text from HTML
 */
function processHtml(html, gasOrigin) {
  let result = html;

  // 1. Remove ALL <base> tags — they violate base-uri 'self' CSP
  result = result.replace(/<base[^>]*>/gi, '');

  // 3. Extract the nonce Google put on the page (used for strict-dynamic CSP)
  //    Google sets nonce="<value>" on <script> and <link> tags
  const nonceMatch = result.match(/\snonce=["']([^"']+)["']/i);
  const pageNonce = nonceMatch ? nonceMatch[1] : '';
  const nonceAttr = pageNonce ? ` nonce="${pageNonce}"` : '';

  // 3b. Add the page nonce to the warden external <script src> tag so it
  //     passes strict-dynamic CSP (external scripts need a nonce under strict-dynamic)
  if (pageNonce) {
    result = result.replace(
      /(<script\b)([^>]*\bsrc=["']https:\/\/script\.google\.com\/static\/[^"']+["'][^>]*)(>)/gi,
      (match, open, attrs, close) => {
        // Only add nonce if not already present
        if (attrs.includes('nonce=')) return match;
        return `${open}${attrs} nonce="${pageNonce}"${close}`;
      }
    );
  }

  // 4. Remove the empty #warning div (initially empty, populated by warden JS)
  result = result.replace(
    /<div[^>]*id=["']warning["'][^>]*>\s*<\/div>/gi, ''
  );

  // 5. Strip standalone disclaimer text
  result = result.replace(
    /[\s]*This application was created by a Google Apps Script user[^<]*(<[^>]+>[^<]*<\/[^>]+>)*[\s]*/gi, ''
  );

  // 6. Inject disclaimer-killer CSS with the page nonce so it passes CSP
  //    IMPORTANT: Do NOT hide #warning-bar-table — it contains the sandboxFrame iframe
  const hideCss =
    `<style${nonceAttr} id="gas-disclaimer-killer">`
    + '#warning{display:none!important}'
    + '.warning-bar{display:none!important}'
    + '.warning-banner{display:none!important}'
    + '.warning-banner-text{display:none!important}'
    + '.warning-banner-icon{display:none!important}'
    + '.warning-banner-header{display:none!important}'
    + '.warning-banner-buttons{display:none!important}'
    + '.warning-banner-close-icon{display:none!important}'
    + '[id*="warning-text"]{display:none!important}'
    + '[class*="warning-banner"]{display:none!important}'
    + '[id*="ga-web-app-banner"]{display:none!important}'
    + '[id*="disclaimer"]{display:none!important}'
    + '[class*="disclaimer"]{display:none!important}'
    + '</style>';

  result = result.replace(/(<\/head>)/i, hideCss + '$1');

  // 7. Inject disclaimer-killer JS with the page nonce so it passes CSP
  const killScript =
    `<script${nonceAttr}>(function(){'use strict';`
    + 'function killDisclaimer(){'
    + 'var sel=['
    + '"#warning",'
    + '".warning-bar",'
    + '".warning-banner",'
    + '".warning-banner-text",'
    + '".warning-banner-icon",'
    + '".warning-banner-header",'
    + '".warning-banner-buttons",'
    + '".warning-banner-close-icon",'
    + '"[id*=\\"warning-text\\"]",'
    + '"[class*=\\"warning-banner\\"]",'
    + '"[id*=\\"disclaimer\\"]",'
    + '"[class*=\\"disclaimer\\"]"'
    + '];'
    + 'sel.forEach(function(s){'
    + 'var els=document.querySelectorAll(s);'
    + 'for(var i=0;i<els.length;i++){'
    + 'var el=els[i];'
    + 'if(el.id==="warning-bar-table")continue;'
    + 'el.style.setProperty("display","none","important");'
    + 'el.style.setProperty("visibility","hidden","important");'
    + 'el.style.height="0";'
    + 'el.style.overflow="hidden";'
    + 'try{el.parentNode.removeChild(el)}catch(e){}'
    + '}'
    + '});'
    + '}'
    + 'if(document.readyState==="loading"){'
    + 'document.addEventListener("DOMContentLoaded",killDisclaimer);'
    + '}else{killDisclaimer();}'
    + 'setTimeout(killDisclaimer,100);'
    + 'setTimeout(killDisclaimer,500);'
    + 'setTimeout(killDisclaimer,1000);'
    + 'setTimeout(killDisclaimer,3000);'
    + 'if(window.MutationObserver){'
    + 'var mo=new MutationObserver(function(mutations){'
    + 'mutations.forEach(function(m){'
    + 'm.addedNodes.forEach(function(n){'
    + 'if(n.nodeType===1&&((n.id||"")+(n.className||"")).match(/warning|disclaimer|banner/)){'
    + 'n.style.setProperty("display","none","important");'
    + 'try{n.parentNode.removeChild(n)}catch(e){}'
    + '}'
    + '});'
    + '});'
    + '});'
    + 'mo.observe(document.documentElement,{childList:true,subtree:true});'
    + '}'
    + '})();'
    + '<\/script>';

  result = result.replace(/(<body[^>]*>)/i, '$1' + killScript);

  return result;
}

/**
 * Strips the disclaimer text from warden JavaScript source.
 */
function stripDisclaimerJs(js) {
  let result = js;

  result = result.replace(
    /"This application was created by a Google Apps Script user"/g,
    '""'
  );

  result = result.replace(
    /function kB\(a,b\)\{[\s\S]*?d\.appendChild\(a\);[\s\S]*?d\.appendChild\(e\);[\s\S]*?\}/g,
    'function kB(a,b){}'
  );

  return result;
}

// ── Enterprise /api/* routes ────────────────────────────────────────────────
// Authorization: shared internal bearer token (env.WORKER_API_TOKEN).
// External secrets (GEMINI_API_KEY, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID)
// are read only from Worker environment/secrets and never echoed in responses.

const AI_INSIGHTS_TTL = 3600; // seconds; 1h keeps insights fresh-ish

function jsonResponse(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      ...COMMON_HEADERS,
      'Content-Type': 'application/json',
      // All /api/* responses are dynamic (secrets, backup snapshots, AI
      // insights); never let the CDN cache them (a stale 401 was observed
      // serving in place of the real response on 2026-08-14).
      'Cache-Control': 'no-store',
      ...(extraHeaders || {})
    },
  });
}

function bearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

/** Enterprise routes are handled locally by the Worker (they use Worker-only
 *  secrets). Everything else under /api/* is forwarded to the Node server. */
function isEnterpriseApiPath(pathname) {
  return pathname === '/api/health' ||
    pathname === '/api/ai-insights' ||
    pathname === '/api/notify-whatsapp' ||
    pathname === '/api/send-email' ||
    pathname.startsWith('/api/backup');
}

/** Forwards a request to the Node/SQLite backend, preserving method, headers
 *  (minus host/origin) and body, and re-applying CORS + the auth bearer so the
 *  server's token checks pass. */
async function forwardToServer(request, url, serverOrigin) {
  const target = new URL(serverOrigin + url.pathname + (url.search || ''));
  const fwd = new Headers();
  const ct = request.headers.get('Content-Type');
  if (ct) fwd.set('Content-Type', ct);
  const auth = request.headers.get('Authorization');
  if (auth) fwd.set('Authorization', auth);
  fwd.set('User-Agent', 'Mozilla/5.0');

  const isGetHead = request.method === 'GET' || request.method === 'HEAD';
  const bodyText = isGetHead ? undefined : await request.text();

  const resp = await fetch(target.toString(), {
    method: request.method,
    headers: fwd,
    body: bodyText,
    redirect: 'follow',
  });

  const newHeaders = new Headers(resp.headers);
  Object.entries(COMMON_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
  const respBody = await resp.arrayBuffer();
  return new Response(respBody, { status: resp.status, headers: newHeaders });
}

async function handleEnterpriseRoute(request, env, url, ctx) {
  if (url.pathname === '/api/health') {
    return jsonResponse({ ok: true, service: 'dashv1-proxy' });
  }

  const token = bearerToken(request);
  if (!token || token !== (env.WORKER_API_TOKEN || '')) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  if (url.pathname === '/api/ai-insights' && request.method === 'POST') {
    return handleAiInsights(request, env, ctx);
  }
  if (url.pathname === '/api/notify-whatsapp' && request.method === 'POST') {
    return handleWhatsApp(request, env);
  }
  if (url.pathname === '/api/send-email' && request.method === 'POST') {
    return handleSendEmail(request, env);
  }
  if (url.pathname.startsWith('/api/backup')) {
    return handleBackup(request, env, url);
  }
  return jsonResponse({ error: 'not found' }, 404);
}

async function handleAiInsights(request, env, ctx) {
  if (!env.GEMINI_API_KEY) {
    return jsonResponse({ error: 'AI not configured' }, 500);
  }
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }

  // Build the same deterministic prompt as before — its hash IS the cache key,
  // so identical summaries share one edge entry.
  const s = body.summary || {};
  const prompt = body.prompt ||
    'India Post dashboard: total=' + (s.total || 0) + ', reviewDue=' + (s.flagged || s.reviewDue || 0) +
    ', normal=' + (s.normal || 0) + '. Give exactly 3 concise bullet follow-up actions.';

  const cacheKey = 'ai:' + hashText(prompt); // fnv-1a of the prompt
  const kv = env.AI_INSIGHTS_KV;

  // 1) KV read first — sub-10ms when warm, zero Gemini cost.
  if (kv) {
    try {
      const hit = await kv.get(cacheKey, 'json');
      if (hit && hit.insights) {
        return jsonResponse({
          success: true, insights: hit.insights,
          cachedAt: hit.cachedAt, stale: false
        }, 200, { 'X-AI-Cache': 'HIT' });
      }
    } catch (e) { /* cache error = bypass, still call Gemini */ }
  }

  // 2) Cache miss → expensive Gemini call.
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    (env.GEMINI_MODEL || 'gemini-2.0-flash') + ':generateContent';
  let text = '';
  try {
    const resp = await fetch(endpoint + '?key=' + encodeURIComponent(env.GEMINI_API_KEY), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const gem = await resp.json();
    text = gem && gem.candidates && gem.candidates[0] && gem.candidates[0].content &&
      gem.candidates[0].content.parts && gem.candidates[0].content.parts[0] &&
      gem.candidates[0].content.parts[0].text || '';
    if (!text) return jsonResponse({ error: 'AI returned no content' }, 502);
  } catch (err) {
    return jsonResponse({ error: 'AI request failed' }, 502);
  }

  // 3) Persist asynchronously so the response is not blocked by the KV write.
  if (kv) {
    ctx.waitUntil(kv.put(cacheKey, JSON.stringify({
      insights: text, cachedAt: Date.now(), prompt: prompt
    }), { expirationTtl: AI_INSIGHTS_TTL }));
  }

  return jsonResponse({ success: true, insights: text }, 200, { 'X-AI-Cache': 'MISS' });
}

/** FNV-1a 64-bit → hex (fast, dependency-free, fine for cache keys). */
function hashText(str) {
  let h1 = 0x811c9dc5, h2 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x01000193) >>> 0;
  }
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

/* ============================================================
 * Persistent-data bridge (KV-backed)
 *
 * Render free web services have an ephemeral filesystem — every
 * redeploy/restart wipes the SQLite DB + uploads. The Node server
 * (data-sync.js) restores from this bridge on boot and pushes fresh
 * snapshots on an interval, so the KV namespace acts as a poor-man's
 * persistent disk. KV value limit is 25 MiB per key; the dashboard DB
 * is well under that (text rows only). Keys are namespaced backup:...
 * inside the same KV namespace as AI insights (no collision).
 * ============================================================ */

const BACKUP_DB_KEY = 'backup:db.sqlite';
const BACKUP_UPLOAD_PREFIX = 'backup:uploads/';

async function handleBackup(request, env, url) {
  const kv = env.DATA_BACKUP_KV;
  if (!kv) return jsonResponse({ error: 'backup storage not bound' }, 500);

  const rest = url.pathname.slice('/api/backup'.length);

  // GET /api/backup/db | PUT /api/backup/db | DELETE /api/backup/db
  if (rest === '/db') {
    if (request.method === 'GET') {
      const v = await kv.get(BACKUP_DB_KEY, 'arrayBuffer');
      if (v === null) return jsonResponse({ error: 'no backup yet' }, 404);
      // no-store: the restore path must always get the CURRENT snapshot,
      // never a CDN-cached copy (a stale corrupt DB was observed 2026-08-14).
      return new Response(v, { headers: { ...COMMON_HEADERS, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } });
    }
    if (request.method === 'PUT') {
      const buf = await request.arrayBuffer();
      await kv.put(BACKUP_DB_KEY, buf);
      return jsonResponse({ ok: true, bytes: buf.byteLength });
    }
    if (request.method === 'DELETE') {
      await kv.delete(BACKUP_DB_KEY);
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  // GET /api/backup/uploads  → { files: [...] }
  if (rest === '/uploads') {
    if (request.method === 'GET') {
      const list = await kv.list({ prefix: BACKUP_UPLOAD_PREFIX });
      const files = list.keys.map((k) => k.name.slice(BACKUP_UPLOAD_PREFIX.length));
      return jsonResponse({ ok: true, files: files });
    }
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  // GET/PUT/DELETE /api/backup/uploads/<name>
  const m = rest.match(/^\/uploads\/([A-Za-z0-9._-]{1,200})$/);
  if (m) {
    const key = BACKUP_UPLOAD_PREFIX + m[1];
    if (request.method === 'GET') {
      const v = await kv.get(key, 'arrayBuffer');
      if (v === null) return jsonResponse({ error: 'not found' }, 404);
      // no-store: same reasoning as /api/backup/db.
      return new Response(v, { headers: { ...COMMON_HEADERS, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } });
    }
    if (request.method === 'PUT') {
      const buf = await request.arrayBuffer();
      await kv.put(key, buf);
      return jsonResponse({ ok: true, bytes: buf.byteLength });
    }
    if (request.method === 'DELETE') {
      await kv.delete(key);
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  return jsonResponse({ error: 'not found' }, 404);
}

/* ============================================================
 * Email relay (SMTP over TCP connect())
 *
 * Render free blocks outbound SMTP ports (25/465/587), so the Node
 * mailer posts the message here over HTTPS (port 443, allowed) and
 * this Worker speaks SMTP to the provider (Gmail) using the TCP
 * sockets connect() API — available on the Workers Free plan.
 * Credentials live in Worker secrets SMTP_USER / SMTP_PASS.
 * ============================================================ */

function rfc2047Subject(subject) {
  const s = String(subject || '');
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return '=?UTF-8?B?' + btoa(bin) + '?=';
}

function buildMailMessage(mail) {
  const from = mail.fromName && /^[\x20-\x7e]+$/.test(mail.fromName)
    ? mail.fromName + ' <' + mail.from + '>'
    : '<' + mail.from + '>';
  const to = '<' + mail.to + '>';
  const subject = rfc2047Subject(mail.subject);
  const date = new Date().toUTCString();
  const body = String(mail.text || '').replace(/\r?\n/g, '\r\n');

  const atts = Array.isArray(mail.attachments) ? mail.attachments : [];
  const boundary = '----=_dashv1_' + Math.random().toString(36).slice(2, 12);

  let msg = 'From: ' + from + '\r\n' +
    'To: ' + to + '\r\n' +
    'Subject: ' + subject + '\r\n' +
    'Date: ' + date + '\r\n' +
    'MIME-Version: 1.0\r\n';

  if (!atts.length) {
    msg += 'Content-Type: text/plain; charset=\"utf-8\"\r\n' +
      'Content-Transfer-Encoding: 8bit\r\n\r\n' +
      body + '\r\n';
  } else {
    msg += 'Content-Type: multipart/mixed; boundary=\"' + boundary + '\"\r\n\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Type: text/plain; charset=\"utf-8\"\r\n' +
      'Content-Transfer-Encoding: 8bit\r\n\r\n' +
      body + '\r\n';
    atts.forEach(function (a) {
      const filename = String(a.filename || 'attachment').replace(/[\r\n"]/g, '_');
      const contentType = String(a.contentType || 'application/octet-stream').replace(/[\r\n]/g, '');
      let b64 = String(a.contentBase64 || '').replace(/\s+/g, '');
      b64 = b64.replace(/(.{76})/g, '$1\r\n');
      msg += '--' + boundary + '\r\n' +
        'Content-Type: ' + contentType + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        'Content-Disposition: attachment; filename=\"' + filename + '\"\r\n\r\n' +
        b64 + '\r\n';
    });
    msg += '--' + boundary + '--\r\n';
  }

  // SMTP DATA dot-stuffing + trailing CRLF
  const stuffed = msg.replace(/^\\./gm, '..');
  return stuffed.replace(/\r?\n/g, '\r\n') + '\r\n.' + '\r\n';
}

async function smtpSend(env, mail) {
  const host = env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(env.SMTP_PORT || 465);
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  if (!user || !pass) throw new Error('SMTP not configured on worker');

  const socket = connect({ hostname: host, port: port }, { secureTransport: 'on' });
  await socket.opened;

  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  function timeout() {
    return new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('SMTP timeout')); }, 20000);
    });
  }

  async function readLine() {
    while (true) {
      const idx = buf.indexOf('\n');
      if (idx >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, '');
        buf = buf.slice(idx + 1);
        return line;
      }
      const chunk = await Promise.race([reader.read(), timeout()]);
      if (chunk.done) throw new Error('SMTP connection closed by server');
      buf += decoder.decode(chunk.value, { stream: true });
    }
  }

  async function readReply() {
    const first = await readLine();
    let last = first;
    while (last.length >= 4 && last[3] === '-') last = await readLine();
    return { code: first.slice(0, 3), first: first };
  }

  async function command(line, okCodes) {
    await writer.write(new TextEncoder().encode(line + '\r\n'));
    const reply = await readReply();
    if (okCodes.indexOf(reply.code) === -1) {
      throw new Error('SMTP ' + line.split(' ')[0] + ' failed: ' + reply.first);
    }
    return reply;
  }

  try {
    const greet = await readReply();
    if (greet.code !== '220') throw new Error('SMTP greeting failed: ' + greet.first);
    await command('EHLO dashv1-proxy', ['250']);
    const auth = btoa('\x00' + user + '\x00' + pass);
    await command('AUTH PLAIN ' + auth, ['235']);
    await command('MAIL FROM:<' + user + '>', ['250']);
    await command('RCPT TO:<' + mail.to + '>', ['250', '251']);
    await command('DATA', ['354']);
    await writer.write(new TextEncoder().encode(buildMailMessage(mail)));
    const done = await readReply();
    if (done.code !== '250') throw new Error('SMTP DATA failed: ' + done.first);
    await command('QUIT', ['221']);
  } finally {
    try { await socket.close(); } catch (e) {}
  }
}

async function handleSendEmail(request, env) {
  let payload;
  try { payload = await request.json(); } catch (e) { return jsonResponse({ error: 'invalid json' }, 400); }
  const to = String(payload.to || '').trim();
  const subject = String(payload.subject || '').trim();
  if (!to || !subject) return jsonResponse({ error: 'to and subject required' }, 400);
  if (/[\r\n]/.test(to) || /[\r\n]/.test(subject)) return jsonResponse({ error: 'invalid header' }, 400);
  const from = env.SMTP_FROM || env.SMTP_USER;
  if (!from) return jsonResponse({ error: 'sender not configured' }, 500);
  try {
    await smtpSend(env, {
      from: from,
      fromName: payload.fromName,
      to: to,
      subject: subject,
      text: payload.text || payload.html || '',
      attachments: payload.attachments || []
    });
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: (err && err.message) || String(err) }, 502);
  }
}

async function handleWhatsApp(request, env) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return jsonResponse({ error: 'WhatsApp not configured' }, 500);
  }
  let payload;
  try { payload = await request.json(); } catch (e) { return jsonResponse({ error: 'invalid json' }, 400); }
  try {
    const resp = await fetch(
      'https://graph.facebook.com/v20.0/' + env.WHATSAPP_PHONE_NUMBER_ID + '/messages', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.WHATSAPP_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    return jsonResponse(await resp.json(), resp.status);
  } catch (err) {
    return jsonResponse({ error: 'WhatsApp request failed' }, 502);
  }
}

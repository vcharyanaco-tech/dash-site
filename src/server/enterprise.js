/**
 * ============================================================
 * India Post Dashboard — Node port
 * enterprise.js
 * Enterprise addons: review calendar (.ics), WhatsApp review
 * reminders (Meta WhatsApp Cloud API), AI dashboard insights
 * (provider-switchable: Groq, Hugging Face, OpenRouter, Google
 * Gemini, or Kilo Gateway free tier as a keyless fallback), Groq
 * meeting transcription + minutes, Fathom notes, config/health.
 * Port of EnterpriseService.gs + EnterpriseUtils.js.
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const { db, aiCacheGet, aiCachePut } = require('./db');
const settings = require('./settings');
const {
  CONFIG,
  ENTERPRISE_SETTINGS,
  ENTERPRISE_AI_DEFAULT_ENDPOINT,
  ENTERPRISE_AI_OPENROUTER_ENDPOINT,
  ENTERPRISE_AI_GROQ_ENDPOINT,
  ENTERPRISE_AI_HF_ENDPOINT,
  ENTERPRISE_AI_KILO_ENDPOINT,
  ENTERPRISE_AI_GROQ_TRANSCRIBE_ENDPOINT,
  ENTERPRISE_AI_TRANSCRIBE_MODEL,
  ENTERPRISE_AI_TRANSCRIBE_MAX_BYTES,
  ENTERPRISE_AI_TRANSCRIPT_MAX_CHARS,
  ENTERPRISE_AI_MEETING_SYSTEM_PROMPT,
  ENTERPRISE_AI_SYSTEM_PROMPT,
  ENTERPRISE_AI_RECORD_SYSTEM_PROMPT,
  ENTERPRISE_AI_LINK_MAX_CHARS,
  ENTERPRISE_AI_PREVIEW_MAX_ROWS,
  ENTERPRISE_AI_PREVIEW_MAX_CELLS,
  ENTERPRISE_AI_PREVIEW_MAX_CELL_CHARS
} = require('./config');
const helpers = require('./helpers');
const auth = require('./auth');
const records = require('./records');

const MEETINGS_DIR = path.join(__dirname, '..', '..', 'data', 'meetings');

/* ============================================================
 * Script-Properties replacement
 * ============================================================ */

function spGet_(key) { return settings.getString(key); }
function spSet_(key, value) { settings.set(key, value); }
function spGetAll_() { return settings.getAll(); }

/* ============================================================
 * Enterprise config
 * ============================================================ */

function enterpriseFeatureEnabled_(feature) {
  const s = (ENTERPRISE_SETTINGS || {})[feature];
  return !!(s && s.enabled);
}

function getEnterpriseConfig_() {
  const props = spGetAll_();
  const s = ENTERPRISE_SETTINGS || {};
  return {
    enabled: props.ENTERPRISE_ENABLED === 'true',
    workerUrl: props.WORKER_API_URL || '',
    workerToken: props.WORKER_API_TOKEN || '',
    aiEnabled: props.AI_INSIGHTS_ENABLED === 'true' || ((s.AI_INSIGHTS || {}).enabled === true),
    whatsappEnabled: props.WHATSAPP_ENABLED === 'true' || ((s.WHATSAPP || {}).enabled === true),
    pwaEnabled: props.PWA_ENABLED === 'true' || ((s.PWA || {}).enabled === true),
    calendarEnabled: props.CALENDAR_ENABLED === 'true' || ((s.CALENDAR || {}).enabled === true),
    fathomEnabled: props.FATHOM_ENABLED === 'true' || ((s.FATHOM || {}).enabled === true),
    fathomConfigured: !!(props.FATHOM_API_KEY || ((s.FATHOM || {}).apiKey)),
    offlineStrictAuth: props.OFFLINE_STRICT_AUTH === 'true',
    timezone: props.TIMEZONE || 'Asia/Kolkata',
    aiModel: props.AI_MODEL || props.GEMINI_MODEL || ((s.AI_INSIGHTS || {}).model) || 'llama-3.3-70b-versatile'
  };
}

function enterpriseBool_(v) {
  if (v === true) return true;
  return String(v).toUpperCase() === 'TRUE';
}

/* ============================================================
 * ICS (review calendar + single task)
 * ============================================================ */

function icsEscapeText_(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function icsFormatDate_(date) {
  const d = date instanceof Date ? date : new Date(date);
  function two(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + 'T' + two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
}

function icsFormatDateOnly_(date) {
  const d = date instanceof Date ? date : new Date(date);
  function two(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate());
}

function buildIcs_(summary, events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//India Post Dashboard//Haryana//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + icsEscapeText_(summary)
  ];
  events.forEach(function (ev) {
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + ev.uid);
    lines.push('DTSTAMP:' + icsFormatDate_(new Date()));
    lines.push('DTSTART;VALUE=DATE:' + ev.start);
    lines.push('DTEND;VALUE=DATE:' + (ev.end || ev.start));
    lines.push('SUMMARY:' + icsEscapeText_(ev.summary));
    if (ev.description) lines.push('DESCRIPTION:' + icsEscapeText_(ev.description));
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

function exportReviewCalendarIcs(token) {
  const user = auth.requireLogin(token);
  const context = auth.getUserContext(user.email);
  const cal = (ENTERPRISE_SETTINGS || {}).CALENDAR || {};
  if (!cal.enabled) {
    return { success: false, message: 'Calendar export is not enabled.' };
  }
  const data = records.getData();
  const items = records.scopeItemsForUser_((data.items || []), context);
  const events = [];
  items.forEach(function (item) {
    if (item.reviewStatus === 'done') return;
    if (!item.reviewDate) return;
    const d = helpers.parseDisplayDate_(item.reviewDate);
    if (!d) return;
    events.push({
      uid: 'review-' + item.row + '-' + icsFormatDateOnly_(d),
      start: icsFormatDateOnly_(d),
      summary: 'Review #' + item.id + ' - ' + (item.sector || ''),
      description: item.action || item.description || ''
    });
  });
  if (!events.length) {
    return { success: false, message: 'No review-due records to export.' };
  }
  const ics = buildIcs_('Review calendar - ' + (context.office || 'Haryana'), events);
  return { success: true, filename: 'review-calendar.ics', count: events.length, ics: ics };
}

function getTaskIcs(tokenOrTaskId, maybeTaskId) {
  const token = maybeTaskId === undefined ? '' : tokenOrTaskId;
  const taskId = maybeTaskId === undefined ? tokenOrTaskId : maybeTaskId;
  if (token) auth.requireLogin(token);
  const tasks = getEnterpriseTasks_();
  let task = null;
  for (let i = 0; i < tasks.length; i++) {
    if (String(tasks[i].id) === String(taskId)) { task = tasks[i]; break; }
  }
  if (!task) return { success: false, message: 'Task not found.' };
  const d = task.dueDate ? new Date(task.dueDate) : new Date();
  const events = [{
    uid: 'task-' + taskId + '-' + icsFormatDateOnly_(d),
    start: icsFormatDateOnly_(d),
    summary: task.title || 'Task',
    description: task.description || ''
  }];
  return { success: true, filename: 'task-' + taskId + '.ics', count: 1, ics: buildIcs_(task.title || 'Task', events) };
}

function getEnterpriseTasks_() {
  return db.prepare('SELECT * FROM tasks').all().map(function (row) {
    return {
      id: String(row.id || ''),
      recordRow: Number(row.record_row) || 0,
      recordId: String(row.record_id || ''),
      title: String(row.title || ''),
      description: String(row.description || ''),
      assignee: String(row.assignee || '').toLowerCase(),
      status: String(row.status || 'OPEN'),
      priority: String(row.priority || 'MEDIUM'),
      dueDate: row.due_date ? Number(row.due_date) : 0,
      createdBy: String(row.created_by || '').toLowerCase(),
      createdAt: row.created_at ? Number(row.created_at) : 0,
      updatedAt: row.updated_at ? Number(row.updated_at) : 0,
      completedAt: row.completed_at ? Number(row.completed_at) : 0
    };
  });
}

/* ============================================================
 * WhatsApp review reminders
 * ============================================================ */

function sendWhatsAppReviewReminders(token) {
  auth.requireAdmin(token);
  return sendOverdueWhatsAppReminders();
}

function sendOverdueWhatsAppReminders() {
  const cfg = getEnterpriseConfig_();
  if (!cfg.enabled) return { success: false, message: 'enterprise disabled' };
  if (!cfg.whatsappEnabled) return { success: false, message: 'whatsapp disabled' };
  const wa = JSON.parse(JSON.stringify((ENTERPRISE_SETTINGS || {}).WHATSAPP || {}));
  const templateName = spGet_('WHATSAPP_TEMPLATE_NAME');
  if (templateName) wa.templateName = templateName;
  if (!wa.enabled || !wa.apiToken || !wa.phoneNumberId) {
    return { success: false, message: 'whatsapp not configured' };
  }
  const data = records.getData();
  const users = auth.listUserRecords_();
  const due = (data.items || []).filter(function (item) {
    if (item.reviewStatus === 'done') return false;
    if (!enterpriseBool_(item.whatsappOptIn)) return false;
    const days = helpers.daysUntilDate_(item.reviewDate);
    return days === 0 || days === 1;
  });
  const result = { sent: [], skipped: [], errors: [] };
  users.forEach(function (u) {
    let phone = String(u.phone || '').trim().replace(/^\+?0*/, '');
    if (!/^\d{10,13}$/.test(phone)) {
      result.skipped.push({ user: u.email, reason: 'invalid phone' });
      return;
    }
    if (phone.length === 10) phone = '91' + phone;
    due.forEach(function (item) {
      if (!records.responsibilityMatchesUser_(String(item.responsibility || '').trim(), u)) return;
      const text = 'Review due ' + (item.reviewDate || '') + ' for record #' + item.id +
        ' - ' + (item.sector || '');
      const r = postWhatsApp_(wa, phone, text);
      if (r.ok) {
        result.sent.push({ phone: phone, record: item.id });
      } else {
        result.errors.push({ phone: phone, record: item.id, reason: r.reason || r.code });
      }
    });
  });
  return { success: true, sent: result.sent, skipped: result.skipped, errors: result.errors };
}

function postWhatsApp_(wa, toPhone, text) {
  return new Promise(function (resolve) {
    (async function () {
      try {
        if (!wa.phoneNumberId) return resolve({ ok: false, reason: 'phoneNumberId missing' });
        const payload = wa.templateName
          ? {
              messaging_product: 'whatsapp',
              to: toPhone,
              type: 'template',
              template: {
                name: wa.templateName,
                language: { code: 'en' },
                components: [{ type: 'body', parameters: [{ type: 'text', text: text }] }]
              }
            }
          : {
              messaging_product: 'whatsapp',
              to: toPhone,
              type: 'text',
              text: { preview_url: false, body: text }
            };
        const resp = await fetch(wa.apiBaseUrl + '/' + wa.phoneNumberId + '/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + wa.apiToken
          },
          body: JSON.stringify(payload)
        });
        const code = resp.status;
        const bodyText = await resp.text();
        return resolve({ ok: code >= 200 && code < 300, code: code, reason: code >= 200 && code < 300 ? '' : bodyText });
      } catch (err) {
        return resolve({ ok: false, reason: String(err) });
      }
    })();
  });
}

/* ============================================================
 * AI Smart Insights
 * ============================================================ */

function aiEnabled_() {
  const ai = (ENTERPRISE_SETTINGS || {}).AI_INSIGHTS || {};
  return spGet_('AI_INSIGHTS_ENABLED') === 'true' || ai.enabled === true;
}

function aiKeyPropName_(provider) {
  if (provider === 'gemini') return 'GEMINI_API_KEY';
  if (provider === 'groq') return 'GROQ_API_KEY';
  if (provider === 'huggingface') return 'HUGGINGFACE_API_KEY';
  if (provider === 'kilo' || provider === 'kilocode') return 'KILO_API_KEY';
  return 'OPENROUTER_API_KEY';
}

function aiDefaultModel_(provider) {
  if (provider === 'gemini') return 'gemini-2.0-flash';
  if (provider === 'groq') return 'llama-3.3-70b-versatile';
  if (provider === 'huggingface') return 'meta-llama/Llama-3.3-70B-Instruct';
  if (provider === 'kilo' || provider === 'kilocode') return 'kilo-auto/free';
  return 'openai/gpt-4o-mini';
}

async function callOpenAiChat_(endpoint, apiKey, model, prompt, systemPrompt) {
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt || ENTERPRISE_AI_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    })
  });
  let body = {};
  try { body = JSON.parse(await resp.text()); } catch (err) { body = {}; }
  const code = resp.status;
  if (code < 200 || code >= 300) {
    const apiErr = body && body.error && (body.error.message || body.error.type || body.error.status);
    return { success: false, message: apiErr || ('AI provider HTTP ' + code) };
  }
  const text = body && body.choices && body.choices[0] && body.choices[0].message &&
    body.choices[0].message.content;
  if (!text) return { success: false, message: 'No text returned by AI provider.' };
  return { success: true, insights: text };
}

async function callKilo_(apiKey, model, prompt, systemPrompt) {
  const endpoint = spGet_('KILO_ENDPOINT') || ENTERPRISE_AI_KILO_ENDPOINT;
  const token = apiKey || 'anonymous';
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt || ENTERPRISE_AI_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    })
  });
  let body = {};
  try { body = JSON.parse(await resp.text()); } catch (err) { body = {}; }
  const code = resp.status;
  if (code < 200 || code >= 300) {
    const apiErr = body && body.error && (body.error.message || body.error.type || body.error.status);
    return { success: false, message: apiErr || ('Kilo HTTP ' + code) };
  }
  const text = body && body.choices && body.choices[0] && body.choices[0].message &&
    body.choices[0].message.content;
  if (!text) return { success: false, message: 'No text returned by Kilo.' };
  return { success: true, insights: text };
}

async function callGemini_(apiKey, model, prompt, systemPrompt) {
  const endpoint = spGet_('GEMINI_ENDPOINT') || ENTERPRISE_AI_DEFAULT_ENDPOINT;
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  if (systemPrompt) {
    payload.systemInstruction = { parts: [{ text: systemPrompt }] };
  }
  const resp = await fetch(endpoint + '?key=' + encodeURIComponent(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let body = {};
  try { body = JSON.parse(await resp.text()); } catch (err) { body = {}; }
  const code = resp.status;
  if (code < 200 || code >= 300) {
    const apiErr = body && body.error && (body.error.message || body.error.status);
    return { success: false, message: apiErr || ('Gemini HTTP ' + code) };
  }
  const text = body && body.candidates && body.candidates[0] && body.candidates[0].content &&
    body.candidates[0].content.parts && body.candidates[0].content.parts[0] &&
    body.candidates[0].content.parts[0].text;
  if (!text) return { success: false, message: 'No text returned by Gemini.' };
  return { success: true, insights: text };
}

async function runAiProvider_(provider, apiKey, model, prompt, systemPrompt) {
  try {
    if (provider === 'gemini') {
      if (!apiKey) return { success: false, message: 'AI credentials are not configured.' };
      return await callGemini_(apiKey, model, prompt, systemPrompt);
    }
    if (provider === 'groq') {
      if (!apiKey) return { success: false, message: 'AI credentials are not configured.' };
      const endpoint = spGet_('GROQ_ENDPOINT') || ENTERPRISE_AI_GROQ_ENDPOINT;
      return await callOpenAiChat_(endpoint, apiKey, model, prompt, systemPrompt);
    }
    if (provider === 'huggingface') {
      if (!apiKey) return { success: false, message: 'AI credentials are not configured.' };
      const endpoint = spGet_('HUGGINGFACE_ENDPOINT') || ENTERPRISE_AI_HF_ENDPOINT;
      return await callOpenAiChat_(endpoint, apiKey, model, prompt, systemPrompt);
    }
    if (provider === 'kilo' || provider === 'kilocode') {
      return await callKilo_(apiKey, model, prompt, systemPrompt);
    }
    if (!apiKey) return { success: false, message: 'AI credentials are not configured.' };
    const endpoint = spGet_('OPENROUTER_ENDPOINT') || (ENTERPRISE_SETTINGS || {}).AI_INSIGHTS.endpoint || ENTERPRISE_AI_OPENROUTER_ENDPOINT;
    return await callOpenAiChat_(endpoint, apiKey, model, prompt, systemPrompt);
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

async function generateAiText_(prompt, systemPrompt) {
  const ai = (ENTERPRISE_SETTINGS || {}).AI_INSIGHTS || {};
  const provider = (spGet_('AI_PROVIDER') || ai.provider || 'openrouter').toLowerCase();
  const apiKey = spGet_(aiKeyPropName_(provider)) || ai.apiKey || '';
  const model = spGet_('AI_MODEL') || ai.model || aiDefaultModel_(provider);

  let result = await runAiProvider_(provider, apiKey, model, prompt, systemPrompt);
  if (result.success) return result;

  const kiloFallback = (spGet_('AI_KILO_FALLBACK') || 'true').toLowerCase() !== 'false';
  const isKilo = provider === 'kilo' || provider === 'kilocode';
  if (kiloFallback && !isKilo) {
    const kiloModel = spGet_('AI_KILO_MODEL') || 'kilo-auto/free';
    const kiloResult = await runAiProvider_('kilo', '', kiloModel, prompt, systemPrompt);
    if (kiloResult.success) {
      kiloResult.fallbackProvider = 'kilo';
      return kiloResult;
    }
    result.kiloFallbackError = kiloResult.message || '';
  }
  return result;
}

/* Cached AI text: getAiInsights and card insights use the ai_cache table. */
async function cachedGenerateAiText_(cacheKey, prompt, systemPrompt, ttlSeconds) {
  if (cacheKey) {
    const hit = aiCacheGet(cacheKey);
    if (hit) {
      try {
        return JSON.parse(hit);
      } catch (err) {}
    }
  }
  const result = await generateAiText_(prompt, systemPrompt);
  if (result.success && cacheKey) {
    aiCachePut(cacheKey, JSON.stringify(result), ttlSeconds || 3600);
  }
  return result;
}

function findItemByRow_(row) {
  const items = records.getData().items || [];
  for (let i = 0; i < items.length; i++) {
    if (String(items[i].row) === String(row)) return items[i];
  }
  return null;
}

function firstLinkUrl_(item) {
  const links = (item && item.linkUrls) || {};
  if (links.action) return links.action;
  const keys = Object.keys(links);
  for (let i = 0; i < keys.length; i++) {
    if (links[keys[i]]) return links[keys[i]];
  }
  return '';
}

async function getAiInsights(token) {
  if (token) auth.requireAdmin(token);
  if (!aiEnabled_()) {
    return { success: false, message: 'AI insights are not enabled.' };
  }
  const data = records.getData();
  const summary = helpers.buildSummaryFromItems(data.items || []);
  const prompt = 'India Post dashboard: total=' + summary.total + ', reviewDue=' + summary.flagged +
    ', normal=' + summary.normal + '. Give exactly 3 concise bullet follow-up actions.';
  const cacheKey = 'ai_summary_' + helpers.safeCacheKey_(prompt);
  return cachedGenerateAiText_(cacheKey, prompt, ENTERPRISE_AI_SYSTEM_PROMPT);
}

async function getAIInsights(token) { return getAiInsights(token); }

async function getCardAiInsight(token, row) {
  auth.requireEditor(token);
  if (!aiEnabled_()) {
    return { success: false, message: 'AI insights are not enabled.' };
  }
  const item = findItemByRow_(row);
  if (!item) return { success: false, message: 'Record not found.' };
  const linkUrl = firstLinkUrl_(item);
  const prompt = 'India Post dashboard record #' + (item.id || '') + ':\n' +
    'Sector: ' + (item.sector || '') + '\n' +
    'Description: ' + (item.description || '') + '\n' +
    'Action: ' + (item.action || '') + '\n' +
    'Responsibility: ' + (item.responsibility || '') + '\n' +
    'Entry date: ' + (item.entryDate || '') + '\n' +
    'Review date: ' + (item.reviewDate || '') + '\n' +
    'Review status: ' + (item.reviewStatus || '') + '\n' +
    (linkUrl ? 'Linked file URL: ' + linkUrl + '\n' : '') +
    'Give exactly 3 concise bullet follow-up actions for this record.';
  const cacheKey = 'ai_card_' + String(row) + '_' + helpers.safeCacheKey_(prompt);
  const result = await cachedGenerateAiText_(cacheKey, prompt, ENTERPRISE_AI_RECORD_SYSTEM_PROMPT);
  if (result.success === true) {
    result.row = item.row;
    result.id = item.id;
    result.hasLink = !!linkUrl;
  }
  return result;
}

/* --- link content fetching (SSRF-guarded) --- */

function toReadableLinkUrl_(url) {
  const doc = String(url || '').match(/docs\.google\.com\/document\/d\/([^/?#]+)/);
  if (doc) return 'https://docs.google.com/document/d/' + doc[1] + '/export?format=txt';
  const sheets = String(url || '').match(/docs\.google\.com\/spreadsheets\/d\/([^/?#]+)/);
  if (sheets) {
    const gid = (String(url || '').match(/[?&#]gid=(\d+)/) || [])[1];
    return 'https://docs.google.com/spreadsheets/d/' + sheets[1] + '/export?format=csv' + (gid ? '&gid=' + gid : '');
  }
  const file = String(url || '').match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (file) return 'https://drive.google.com/uc?export=download&id=' + file[1];
  const open = String(url || '').match(/drive\.google\.com\/open\?id=([^&#]+)/);
  if (open) return 'https://drive.google.com/uc?export=download&id=' + open[1];
  return url;
}

async function fetchRawBody_(url) {
  let current = String(url || '');
  let hops = 5;
  const guard = {};
  while (hops-- > 0) {
    try {
      if (!helpers.isSafeLinkUrl_(current)) return '';
      if (guard[current]) return '';
      guard[current] = true;
      const resp = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      const code = resp.status;
      if (code >= 300 && code < 400) {
        const loc = resp.headers.get('location') || '';
        current = toAbsoluteUrl_(current, loc);
        if (!current) return '';
        continue;
      }
      if (code < 200 || code >= 300) return '';
      const body = await resp.arrayBuffer();
      const text = Buffer.from(body).toString('utf8');
      if (!text || text.indexOf('\u0000') !== -1) return '';
      return text;
    } catch (err) {
      return '';
    }
  }
  return '';
}

function fetchRawText_(url) {
  return fetchRawBody_(url).then(function (body) {
    if (!body) return '';
    const lower = body.substring(0, 500).toLowerCase();
    if (lower.indexOf('<html') !== -1 || lower.indexOf('<!doctype') !== -1) {
      return helpers.htmlToText_(body);
    }
    return String(body).replace(/\s+/g, ' ').trim();
  });
}

function isSheetsLink_(url) {
  return /docs\.google\.com\/spreadsheets\//i.test(String(url || ''));
}

function fetchLinkText_(url) {
  const candidates = [toReadableLinkUrl_(url), url];
  const seen = {};
  return (async function () {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (!candidate || seen[candidate]) continue;
      seen[candidate] = true;
      const raw = await fetchRawText_(candidate);
      if (helpers.isReadableAiText_(raw)) return raw;
    }
    return '';
  })();
}

function fetchLinkTable_(url) {
  return fetchRawBody_(toReadableLinkUrl_(url)).then(function (body) {
    if (!body) return { rows: [], rowCount: 0 };
    const trimmed = String(body).trim();
    const lower = trimmed.substring(0, 500).toLowerCase();
    if (lower.indexOf('<html') !== -1 || lower.indexOf('<!doctype') !== -1) return { rows: [], rowCount: 0 };
    if (!helpers.isReadableAiText_(helpers.htmlToText_(trimmed))) return { rows: [], rowCount: 0 };
    const rows = helpers.parseCsv_(trimmed).filter(function (r) {
      for (let i = 0; i < r.length; i++) { if (String(r[i]).trim() !== '') return true; }
      return false;
    });
    if (!rows.length) return { rows: [], rowCount: 0 };
    const text = rows.map(function (r) { return r.join(', '); }).join('\n');
    return { rows: rows, rowCount: rows.length, text: text };
  });
}

function toAbsoluteUrl_(base, loc) {
  loc = String(loc || '').trim();
  if (!loc) return '';
  if (/^https?:\/\//i.test(loc)) return loc;
  if (loc.charAt(0) === '/') {
    const m = String(base || '').match(/^https?:\/\/[^/]+/i);
    return m ? m[0] + loc : '';
  }
  const idx = String(base || '').lastIndexOf('/');
  return idx !== -1 ? base.substring(0, idx + 1) + loc : loc;
}

async function getLinkContentAiInsight(token, row) {
  auth.requireEditor(token);
  if (!aiEnabled_()) {
    return { success: false, message: 'AI insights are not enabled.' };
  }
  const item = findItemByRow_(row);
  if (!item) return { success: false, message: 'Record not found.' };
  const url = firstLinkUrl_(item);
  if (!url) return { success: false, message: 'This record has no linked file.' };
  if (!helpers.isSafeLinkUrl_(url)) return { success: false, message: 'Unsafe link rejected.' };
  let previewRows = [];
  let previewRowTotal = 0;
  let fetched;
  if (isSheetsLink_(url)) {
    const table = await fetchLinkTable_(url);
    previewRows = table.rows;
    previewRowTotal = table.rowCount;
    fetched = table.text || await fetchLinkText_(url);
  } else {
    fetched = await fetchLinkText_(url);
  }
  fetched = String(fetched || '').replace(/\s+/g, ' ').trim();
  const contentTruncated = fetched.length > ENTERPRISE_AI_LINK_MAX_CHARS;
  const text = contentTruncated ? fetched.substring(0, ENTERPRISE_AI_LINK_MAX_CHARS) : fetched;
  const contentRead = text.length > 40;
  const prompt = 'India Post dashboard record #' + (item.id || '') + ' (sector: ' + (item.sector || '') + ').\n' +
    'Linked file URL: ' + url + '\n' +
    (contentRead
      ? 'Linked file content: ' + text + '\n'
      : 'The linked file content could not be read (private, blocked, or unreadable). Base your answer on the record and URL only.\n') +
    'Give exactly 3 concise bullet follow-up actions.';
  const cacheKey = 'ai_link_' + String(row) + '_' + helpers.safeCacheKey_(prompt);
  const result = await cachedGenerateAiText_(cacheKey, prompt, ENTERPRISE_AI_RECORD_SYSTEM_PROMPT);
  if (result.success === true) {
    result.row = item.row;
    result.id = item.id;
    result.source = url;
    result.contentRead = contentRead;
    result.contentLength = text.length;
    result.contentTruncated = contentTruncated;
    result.preview = contentRead ? text.substring(0, 600) : '';
    result.previewFormat = 'text';
    if (previewRows.length) {
      result.previewFormat = 'table';
      result.previewRows = previewRows.slice(0, ENTERPRISE_AI_PREVIEW_MAX_ROWS).map(function (r) {
        return r.slice(0, ENTERPRISE_AI_PREVIEW_MAX_CELLS).map(function (c) {
          const s = String(c === null || c === undefined ? '' : c);
          return s.length > ENTERPRISE_AI_PREVIEW_MAX_CELL_CHARS ? s.substring(0, ENTERPRISE_AI_PREVIEW_MAX_CELL_CHARS) + '\u2026' : s;
        });
      });
      result.previewRowTotal = previewRowTotal;
    }
  }
  return result;
}

/* ============================================================
 * API key setters (admin-gated, stored in settings, never echoed)
 * ============================================================ */

function setApiKey_(token, propName, apiKey, missingMsg) {
  auth.requireAdmin(token);
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return { ok: false, message: missingMsg || 'Missing API key.' };
  }
  spSet_(propName, apiKey.trim());
  return { ok: true };
}

function setOpenRouterApiKey(token, apiKey) { return setApiKey_(token, 'OPENROUTER_API_KEY', apiKey); }
function setGeminiApiKey(token, apiKey) { return setApiKey_(token, 'GEMINI_API_KEY', apiKey); }
function setGroqApiKey(token, apiKey) { return setApiKey_(token, 'GROQ_API_KEY', apiKey); }
function setHuggingFaceApiKey(token, apiKey) { return setApiKey_(token, 'HUGGINGFACE_API_KEY', apiKey, 'Missing API token.'); }
function setKiloApiKey(token, apiKey) { return setApiKey_(token, 'KILO_API_KEY', apiKey); }
function setFathomApiKey(token, apiKey) { return setApiKey_(token, 'FATHOM_API_KEY', apiKey); }

/* ============================================================
 * Meeting recording: Groq transcription + AI minutes
 * ============================================================ */

function sanitizeFileName_(name) {
  const s = String(name || '').replace(/[\/\\:*?"<>|]/g, '_').trim();
  return s.length ? s : 'Meeting';
}

function meetingFileExt_(fileName, mimeType) {
  const m = String(fileName || '').match(/\.([a-z0-9]{2,5})$/i);
  if (m) return m[1].toLowerCase();
  mimeType = String(mimeType || '');
  if (mimeType.indexOf('m4a') !== -1 || mimeType.indexOf('mp4') !== -1) return 'm4a';
  if (mimeType.indexOf('ogg') !== -1) return 'ogg';
  if (mimeType.indexOf('wav') !== -1) return 'wav';
  if (mimeType.indexOf('mpeg') !== -1) return 'mp3';
  if (mimeType.indexOf('flac') !== -1) return 'flac';
  return 'webm';
}

function ensureMeetingsDir_() {
  if (!fs.existsSync(MEETINGS_DIR)) {
    fs.mkdirSync(MEETINGS_DIR, { recursive: true });
  }
}

async function callGroqTranscribe_(apiKey, bytes, mimeType, fileName) {
  try {
    const fd = new FormData();
    fd.append('model', ENTERPRISE_AI_TRANSCRIBE_MODEL);
    fd.append('file', new Blob([bytes], { type: mimeType || 'audio/mpeg' }), fileName || 'recording.webm');
    fd.append('response_format', 'json');
    const resp = await fetch(ENTERPRISE_AI_GROQ_TRANSCRIBE_ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      body: fd,
      signal: AbortSignal.timeout(300000)
    });
    let body = {};
    try { body = JSON.parse(await resp.text()); } catch (err) { body = {}; }
    const code = resp.status;
    if (code < 200 || code >= 300) {
      const apiErr = body && body.error && (body.error.message || body.error.code || body.error.type);
      return { ok: false, reason: apiErr || ('Groq transcription HTTP ' + code) };
    }
    return { ok: true, text: String(body.text || '') };
  } catch (err) {
    return { ok: false, reason: 'Transcription failed: ' + String(err) };
  }
}

function tryParseJsonObject_(text) {
  let s = String(text || '').trim();
  if (!s) return null;
  if (s.charAt(0) === '`') s = s.replace(/^`+/, '').replace(/`+$/, '').trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end > start) s = s.substring(start, end + 1);
  try { return JSON.parse(s); } catch (err) { return null; }
}

function buildMinutesMarkdown_(title, minutes, transcript) {
  let md = '# ' + title + '\n\nGenerated: ' + new Date().toString() + '\n\n';
  md += '## Summary\n' + (String(minutes.summary || '').trim() || '(no summary)') + '\n\n';
  if (minutes.decisions && minutes.decisions.length) {
    md += '## Decisions\n' + minutes.decisions.map(function (d) { return '- ' + String(d); }).join('\n') + '\n\n';
  }
  if (minutes.actionItems && minutes.actionItems.length) {
    md += '## Action items\n' + minutes.actionItems.map(function (a) {
      return '- [' + String((a && a.priority) || 'MEDIUM') + '] ' + String((a && a.task) || '') +
        ((a && a.assignee) ? ' (assigned: ' + a.assignee + ')' : '') +
        ((a && a.dueDate) ? ' (due: ' + a.dueDate + ')' : '');
    }).join('\n') + '\n\n';
  }
  if (minutes.risks && minutes.risks.length) {
    md += '## Risks\n' + minutes.risks.map(function (r) { return '- ' + String(r); }).join('\n') + '\n\n';
  }
  md += '## Transcript\n' + transcript + '\n';
  return md;
}

function stampForFile_() {
  return helpers.formatDate_(new Date(), 'yyyy-MM-dd_HHmm');
}

function saveMinutesFile_(title, minutes, transcript) {
  ensureMeetingsDir_();
  const stamp = stampForFile_();
  const name = sanitizeFileName_(title) + '_' + stamp + '.md';
  const target = path.join(MEETINGS_DIR, name);
  fs.writeFileSync(target, buildMinutesMarkdown_(title, minutes, transcript), 'utf8');
  return { id: name, url: '', name: name };
}

function saveAudioFile_(title, bytes, mimeType, fileName) {
  ensureMeetingsDir_();
  const stamp = stampForFile_();
  const name = sanitizeFileName_(title) + '_' + stamp + '.' + meetingFileExt_(fileName, mimeType);
  const target = path.join(MEETINGS_DIR, name);
  fs.writeFileSync(target, bytes);
  return { id: name, url: '', name: name, size: bytes.length };
}

function decodeBase64_(base64) {
  try {
    const bytes = Buffer.from(String(base64 || ''), 'base64');
    if (!bytes.length) return null;
    return bytes;
  } catch (err) {
    return null;
  }
}

async function transcribeAndBuildMinutes_(title, bytes, mimeType, fileName) {
  if (!aiEnabled_()) return { success: false, message: 'AI insights are not enabled.' };
  const groqKey = spGet_('GROQ_API_KEY');
  if (!groqKey) return { success: false, message: 'Groq API key not configured (required for transcription).' };
  if (!bytes || !bytes.length) return { success: false, message: 'The audio file appears to be empty.' };
  if (bytes.length > ENTERPRISE_AI_TRANSCRIBE_MAX_BYTES) {
    return { success: false, message: 'Audio exceeds the 25 MB transcription limit.' };
  }
  const tr = await callGroqTranscribe_(groqKey, bytes, mimeType, fileName);
  if (!tr.ok) return { success: false, message: tr.reason };
  const transcript = String(tr.text || '').trim();
  if (!transcript) return { success: false, message: 'No speech was detected in the recording.' };

  const minutesPrompt = 'Meeting title: ' + title + '\n\nTranscript:\n' + transcript.substring(0, ENTERPRISE_AI_TRANSCRIPT_MAX_CHARS);
  const ai = await generateAiText_(minutesPrompt, ENTERPRISE_AI_MEETING_SYSTEM_PROMPT);
  let minutes = { summary: '', decisions: [], actionItems: [], risks: [] };
  let minutesText = '';
  if (ai.success) {
    minutesText = String(ai.insights || '');
    const parsed = tryParseJsonObject_(minutesText);
    if (parsed && typeof parsed === 'object') minutes = parsed;
  }
  let driveMinutes = null;
  try {
    driveMinutes = saveMinutesFile_(title, minutes, transcript);
  } catch (err) {
    driveMinutes = null;
  }
  return {
    success: true,
    title: title,
    transcript: transcript,
    transcriptChars: transcript.length,
    minutes: minutes,
    minutesText: minutesText,
    driveMinutes: driveMinutes,
    fallbackProvider: ai.fallbackProvider || ''
  };
}

async function processMeetingRecording(payload, token) {
  auth.requireAdmin(token);
  payload = payload || {};
  const title = String(payload.title || '').trim() || 'Review meeting';
  const base64 = String(payload.base64 || '');
  const mimeType = String(payload.mimeType || 'audio/mpeg');
  const fileName = String(payload.fileName || 'recording.' + (mimeType.indexOf('m4a') !== -1 ? 'm4a' : 'mpeg'));
  if (!base64) return { success: false, message: 'No audio was provided.' };
  const bytes = decodeBase64_(base64);
  if (!bytes) return { success: false, message: 'Audio data could not be decoded.' };
  if (!bytes.length) return { success: false, message: 'The audio file appears to be empty.' };
  if (bytes.length > ENTERPRISE_AI_TRANSCRIBE_MAX_BYTES) {
    return { success: false, message: 'Audio exceeds the 25 MB transcription limit.' };
  }

  let driveAudio = null;
  try {
    driveAudio = saveAudioFile_(title, bytes, mimeType, fileName);
  } catch (err) {
    driveAudio = null;
  }

  const result = await transcribeAndBuildMinutes_(title, bytes, mimeType, fileName);
  if (!result.success) return { success: false, message: result.message, driveAudio: driveAudio };
  result.driveAudio = driveAudio;
  return result;
}

async function transcribeMeetingSegment(payload, token) {
  auth.requireAdmin(token);
  payload = payload || {};
  const title = String(payload.title || '').trim() || 'Review meeting';
  const base64 = String(payload.base64 || '');
  const mimeType = String(payload.mimeType || 'audio/webm');
  const fileName = String(payload.fileName || 'segment.webm');
  if (!base64) return { success: false, message: 'No audio was provided.' };
  const bytes = decodeBase64_(base64);
  if (!bytes) return { success: false, message: 'Audio data could not be decoded.' };
  if (!bytes.length) return { success: false, message: 'The audio file appears to be empty.' };
  if (bytes.length > ENTERPRISE_AI_TRANSCRIBE_MAX_BYTES) {
    return { success: false, message: 'Audio segment exceeds the 25 MB transcription limit.' };
  }
  const groqKey = spGet_('GROQ_API_KEY');
  if (!groqKey) return { success: false, message: 'Groq API key not configured (required for transcription).' };
  const tr = await callGroqTranscribe_(groqKey, bytes, mimeType, fileName);
  if (!tr.ok) return { success: false, message: tr.reason };
  const transcript = String(tr.text || '').trim();
  if (!transcript) return { success: false, message: 'No speech was detected in this segment.' };
  return { success: true, title: title, transcript: transcript };
}

async function generateMeetingMinutes(payload, token) {
  auth.requireAdmin(token);
  payload = payload || {};
  const title = String(payload.title || '').trim() || 'Review meeting';
  const transcript = String(payload.transcript || '').trim();
  if (!transcript) return { success: false, message: 'No transcript was provided.' };
  if (!aiEnabled_()) return { success: false, message: 'AI insights are not enabled.' };

  const minutesPrompt = 'Meeting title: ' + title + '\n\nTranscript:\n' +
    transcript.substring(0, ENTERPRISE_AI_TRANSCRIPT_MAX_CHARS);
  const ai = await generateAiText_(minutesPrompt, ENTERPRISE_AI_MEETING_SYSTEM_PROMPT);
  let minutes = { summary: '', decisions: [], actionItems: [], risks: [] };
  let minutesText = '';
  if (ai.success) {
    minutesText = String(ai.insights || '');
    const parsed = tryParseJsonObject_(minutesText);
    if (parsed && typeof parsed === 'object') minutes = parsed;
  }
  let driveMinutes = null;
  try {
    driveMinutes = saveMinutesFile_(title, minutes, transcript);
  } catch (err) {
    driveMinutes = null;
  }
  return {
    success: true,
    title: title,
    transcript: transcript,
    transcriptChars: transcript.length,
    minutes: minutes,
    minutesText: minutesText,
    driveMinutes: driveMinutes,
    fallbackProvider: ai.fallbackProvider || ''
  };
}

/* ============================================================
 * Fathom
 * ============================================================ */

function fathomEnabled_() {
  return spGet_('FATHOM_ENABLED') === 'true' || (ENTERPRISE_SETTINGS || {}).FATHOM.enabled === true;
}

function fathomApiKey_() {
  return spGet_('FATHOM_API_KEY') || (ENTERPRISE_SETTINGS || {}).FATHOM.apiKey || '';
}

function fathomBaseUrl_() {
  return (ENTERPRISE_SETTINGS || {}).FATHOM.apiBaseUrl || 'https://api.fathom.ai/external/v1';
}

function fathomConfig_() {
  return {
    enabled: fathomEnabled_(),
    configured: !!fathomApiKey_(),
    baseUrl: fathomBaseUrl_()
  };
}

function getFathomStatus(token) {
  auth.requireAdmin(token);
  return { success: true, fathom: fathomConfig_() };
}

function fathomMeetingToCard_(m) {
  const summary = (m.default_summary && m.default_summary.markdown_formatted) ||
    (m.summary && m.summary.markdown_formatted) || '';
  const actions = (m.action_items || []).map(function (a) {
    return {
      task: String(a.description || '').trim(),
      assignee: (a.assignee && (a.assignee.name || a.assignee.email)) || '',
      completed: !!a.completed,
      timestamp: a.recording_timestamp || ''
    };
  });
  return {
    recordingId: m.recording_id,
    title: m.title || m.meeting_title || 'Untitled meeting',
    meetingTitle: m.meeting_title || '',
    url: m.url || '',
    shareUrl: m.share_url || '',
    createdAt: m.created_at || '',
    recordedBy: m.recorded_by ? (m.recorded_by.name || m.recorded_by.email) : '',
    summary: String(summary || '').trim(),
    actionItems: actions
  };
}

async function listFathomMeetings(token, opts) {
  auth.requireAdmin(token);
  opts = opts || {};
  const cfg = fathomConfig_();
  if (!cfg.enabled) return { success: false, message: 'Fathom integration is not enabled.' };
  if (!cfg.configured) return { success: false, message: 'Fathom API key is not configured.' };
  const key = fathomApiKey_();
  let max = parseInt(opts.max, 10) || ((ENTERPRISE_SETTINGS || {}).FATHOM || {}).maxMeetings || 20;
  if (max < 1) max = 20;
  if (max > 100) max = 100;

  const qs = ['include_summary=true', 'include_action_items=true', 'limit=' + max];
  if (opts.createdAfter) qs.push('created_after=' + encodeURIComponent(String(opts.createdAfter)));

  try {
    const resp = await fetch(cfg.baseUrl + '/meetings?' + qs.join('&'), {
      method: 'GET',
      headers: { 'X-Api-Key': key }
    });
    const code = resp.status;
    let body = {};
    try { body = JSON.parse(await resp.text()); } catch (err) { body = {}; }
    if (code < 200 || code >= 300) {
      const apiErr = body && body.error && (body.error.message || body.error.code || body.error.type);
      return { success: false, message: apiErr || ('Fathom HTTP ' + code), code: code };
    }
    const items = (body.items || []).map(fathomMeetingToCard_);
    return { success: true, items: items, nextCursor: body.next_cursor || '' };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

async function getFathomMeetingContent(token, recordingId) {
  auth.requireAdmin(token);
  const cfg = fathomConfig_();
  if (!cfg.enabled) return { success: false, message: 'Fathom integration is not enabled.' };
  if (!cfg.configured) return { success: false, message: 'Fathom API key is not configured.' };
  if (!recordingId) return { success: false, message: 'Missing recording id.' };
  const key = fathomApiKey_();
  try {
    const resp = await fetch(cfg.baseUrl + '/recordings/' + encodeURIComponent(String(recordingId)) + '/transcript', {
      method: 'GET',
      headers: { 'X-Api-Key': key }
    });
    const code = resp.status;
    let body = {};
    try { body = JSON.parse(await resp.text()); } catch (err) { body = {}; }
    if (code < 200 || code >= 300) {
      const apiErr = body && body.error && (body.error.message || body.error.code || body.error.type);
      return { success: false, message: apiErr || ('Fathom HTTP ' + code), code: code };
    }
    const transcript = (body.transcript || []).map(function (t) {
      const speaker = (t.speaker && t.speaker.display_name) || 'Speaker';
      return '[' + (t.timestamp || '') + '] ' + speaker + ': ' + String(t.text || '');
    }).join('\n');
    return { success: true, recordingId: recordingId, transcript: transcript, transcriptChars: transcript.length };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

/* ============================================================
 * Offline queue replay
 * ============================================================ */

const dispatch = require('./index-dispatch');

function processOfflineQueue(token, queueItems) {
  const user = auth.requireLogin(token);
  const results = { processed: 0, failed: 0, errors: [] };
  (queueItems || []).forEach(function (item) {
    try {
      const fnName = item && (item.fn || item.action || item.method || '');
      const args = item && item.args ? item.args.slice() : [];
      if (!fnName) throw new Error('missing fn');
      const fnRef = dispatch[fnName];
      if (typeof fnRef !== 'function') throw new Error('unknown fn: ' + fnName);
      const result = fnRef(args);
      if (result && typeof result.then === 'function') {
        result.then(function () { results.processed++; }, function (err) {
          results.failed++;
          results.errors.push({ fn: fnName, reason: err.message || String(err) });
        });
      } else {
        results.processed++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ fn: item && (item.fn || item.action), reason: err.message || String(err) });
    }
  });
  return results;
}

/* ============================================================
 * Setup / config / triggers / health
 * ============================================================ */

function setupEnterpriseAddons() {
  spSet_('ENTERPRISE_ENABLED', 'true');
  spSet_('AI_INSIGHTS_ENABLED', 'true');
  spSet_('WHATSAPP_ENABLED', 'true');
  spSet_('PWA_ENABLED', 'true');
  spSet_('CALENDAR_ENABLED', 'true');
  spSet_('TIMEZONE', 'Asia/Kolkata');
  spSet_('GEMINI_MODEL', 'gemini-2.0-flash');
  spSet_('OFFLINE_STRICT_AUTH', 'false');
  return { ok: true };
}

function installEnterpriseTriggers() {
  return { ok: true };
}

function getEnterpriseFrontendConfig(token) {
  if (token) auth.requireLogin(token);
  const cfg = getEnterpriseConfig_();
  return {
    enabled: cfg.enabled,
    aiEnabled: cfg.aiEnabled,
    whatsappEnabled: cfg.whatsappEnabled,
    pwaEnabled: cfg.pwaEnabled,
    calendarEnabled: cfg.calendarEnabled,
    fathomEnabled: cfg.fathomEnabled,
    fathomConfigured: cfg.fathomConfigured,
    offlineStrictAuth: cfg.offlineStrictAuth,
    timezone: cfg.timezone
  };
}

function aiKeyConfigured_() {
  const ai = (ENTERPRISE_SETTINGS || {}).AI_INSIGHTS || {};
  const provider = (spGet_('AI_PROVIDER') || ai.provider || 'openrouter').toLowerCase();
  const propName = aiKeyPropName_(provider);
  if (spGet_(propName) || ai.apiKey) return true;
  const kiloFallback = (spGet_('AI_KILO_FALLBACK') || 'true').toLowerCase() !== 'false';
  return kiloFallback && provider !== 'kilo' && provider !== 'kilocode';
}

function validateEnterpriseConfiguration() {
  const cfg = getEnterpriseConfig_();
  return {
    enabled: cfg.enabled,
    workerUrlSet: !!cfg.workerUrl,
    workerTokenSet: !!cfg.workerToken,
    aiEnabled: cfg.aiEnabled,
    aiKeySet: aiKeyConfigured_(),
    whatsappEnabled: cfg.whatsappEnabled,
    pwaEnabled: cfg.pwaEnabled,
    calendarEnabled: cfg.calendarEnabled,
    timezone: cfg.timezone,
    aiModel: cfg.aiModel
  };
}

function getEnterpriseHealth() {
  const cfg = getEnterpriseConfig_();
  return {
    enabled: cfg.enabled,
    aiEnabled: cfg.aiEnabled,
    aiKeySet: aiKeyConfigured_(),
    whatsappEnabled: cfg.whatsappEnabled,
    pwaEnabled: cfg.pwaEnabled,
    calendarEnabled: cfg.calendarEnabled,
    workerUrlSet: !!cfg.workerUrl,
    workerTokenSet: !!cfg.workerToken,
    timezone: cfg.timezone,
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  exportReviewCalendarIcs,
  getTaskIcs,
  sendWhatsAppReviewReminders,
  sendOverdueWhatsAppReminders,
  getAiInsights,
  getAIInsights,
  getCardAiInsight,
  getLinkContentAiInsight,
  setOpenRouterApiKey,
  setGeminiApiKey,
  setGroqApiKey,
  setHuggingFaceApiKey,
  setKiloApiKey,
  setFathomApiKey,
  processMeetingRecording,
  transcribeMeetingSegment,
  generateMeetingMinutes,
  getFathomStatus,
  listFathomMeetings,
  getFathomMeetingContent,
  processOfflineQueue,
  setupEnterpriseAddons,
  installEnterpriseTriggers,
  getEnterpriseFrontendConfig,
  validateEnterpriseConfiguration,
  getEnterpriseHealth,
  getEnterpriseConfig_,
  aiKeyConfigured_,
  generateAiText_
};

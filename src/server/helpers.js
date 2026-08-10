/**
 * ============================================================
 * India Post Dashboard — Node port
 * helpers.js
 * Common utility functions (port of Utils.gs + Reports.gs pure
 * helpers). No Google services — pure JS.
 * ============================================================
 */

const crypto = require('crypto');

const {
  CONFIG,
  DATE_FORMAT,
  ROLES,
  REPORT_TEMPLATES
} = require('./config');

const settings = require('./settings');

/* ============================================================
 * Time
 * ============================================================ */

function now_() {
  return new Date();
}

function timezone_() {
  const tz = settings.get('TIMEZONE');
  return tz && tz.value ? tz.value : 'Asia/Kolkata';
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

function pad4(n) {
  return (n < 10 ? '000' : n < 100 ? '00' : n < 1000 ? '0' : '') + n;
}

function tzParts_(date) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone_(),
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(d);
  const map = {};
  parts.forEach(function (p) { map[p.type] = p.value; });
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    hh: map.hour === '24' ? '00' : map.hour,
    mm: map.minute,
    ss: map.second
  };
}

function tzDate_(date) {
  const p = tzParts_(date);
  return new Date(p.y, p.m - 1, p.d, Number(p.hh), Number(p.mm), Number(p.ss));
}

/* Formats a Date using GAS-style format tokens: yyyy MM dd HH mm ss. */
function formatDate_(value, fmt) {
  if (value === null || value === undefined || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return '';
    const p = tzParts_(value);
    let out = String(fmt || DATE_FORMAT.DISPLAY);
    out = out.replace(/yyyy/g, String(p.y));
    out = out.replace(/MM/g, pad2(p.m));
    out = out.replace(/dd/g, pad2(p.d));
    out = out.replace(/HH/g, p.hh);
    out = out.replace(/mm/g, p.mm);
    out = out.replace(/ss/g, p.ss);
    return out;
  }
  return String(value).trim();
}

function today_() {
  return formatDate_(new Date(), DATE_FORMAT.DISPLAY);
}

/* Parses a display date string ("dd.MM.yyyy") or Date into a Date.
   Returns null when unparseable. */
function parseDisplayDate_(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? null : value;
  }
  const m = String(value).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

/* Whole days from today (script timezone) to the given display date.
   Returns 1 for tomorrow, 0 for today, -1 for yesterday, null when unparseable. */
function daysUntilDate_(value) {
  const d = parseDisplayDate_(value);
  if (!d) return null;
  const now = tzDate_(new Date());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target - today) / 86400000);
}

function addDays_(date, days) {
  const out = new Date(date.getTime());
  out.setDate(out.getDate() + days);
  return out;
}

/* ============================================================
 * ID / crypto
 * ============================================================ */

function uuid_() {
  return crypto.randomUUID().replace(/-/g, '');
}

function generateSalt_() {
  return uuid_();
}

function sha256Hex_(input) {
  return crypto.createHash('sha256').update(String(input), 'utf8').digest('hex');
}

function hashPassword_(password, salt) {
  let hash = sha256Hex_((salt || '') + '|' + (password || ''));
  for (let i = 0; i < 500; i++) {
    hash = sha256Hex_(hash + '|' + (salt || ''));
  }
  return hash;
}

function safeCacheKey_(value) {
  return sha256Hex_(String(value || '')).slice(0, 16);
}

/* ============================================================
 * Email helpers
 * ============================================================ */

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function emailList_(value) {
  return String(value || '')
    .split(',')
    .map(function (e) { return String(e).trim().toLowerCase(); })
    .filter(function (e) { return e; });
}

function primaryEmail_(value) {
  const list = emailList_(value);
  return list.length ? list[0] : '';
}

function emailsOverlap_(a, b) {
  const la = emailList_(a);
  const lb = emailList_(b);
  for (let i = 0; i < la.length; i++) {
    if (lb.indexOf(la[i]) !== -1) return true;
  }
  return false;
}

function emailsMatch_(storedCell, query) {
  return emailsOverlap_(storedCell, query);
}

function isValidEmailList_(value) {
  const list = emailList_(value);
  if (!list.length) return false;
  return list.every(function (e) { return isValidEmail_(e); });
}

function isValidUsername_(username) {
  return /^[A-Za-z0-9._-]{3,30}$/.test(String(username || '').trim());
}

function validatePassword_(password) {
  const pw = String(password || '');
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

/* ============================================================
 * Item normalization (port of Utils.normalizeItemForSheet_)
 * ============================================================ */

function normalizeItemForSheet_(item) {
  return {
    id: item && item.id !== undefined && item.id !== null ? item.id : '',
    sector: item && item.sector !== undefined && item.sector !== null ? item.sector : '',
    description: item && item.description !== undefined && item.description !== null ? item.description : '',
    entryDate: item && item.entryDate !== undefined && item.entryDate !== null ? item.entryDate : '',
    action: item && item.action !== undefined && item.action !== null ? item.action : '',
    responsibility: item && item.responsibility !== undefined && item.responsibility !== null ? item.responsibility : '',
    reviewDate: item && item.reviewDate !== undefined && item.reviewDate !== null ? item.reviewDate : '',
    links: item && item.links && typeof item.links === 'object' ? item.links : {}
  };
}

/* ============================================================
 * HTML / link helpers (port of code.gs + Utils.gs helpers)
 * ============================================================ */

function escHtml_(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function looksLikeUrl_(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  if (!text) return false;
  return /^(https?:\/\/|mailto:|ftp:\/\/|www\.)/i.test(text) || /(?:\.[a-z]{2,})(?:\/|$)/i.test(text);
}

function normalizeUrl_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^www\./i.test(text)) return 'https://' + text;
  return text;
}

function absUrl_(u) {
  if (!u) return '';
  const s = String(u).trim();
  if (!s) return '';
  if (s.charAt(0) === '#') return '';
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  if (s.charAt(0) === '/') return '';
  if (s.indexOf('www.') === 0) return 'https://' + s;
  return 'https://' + s;
}

function linkifyText_(text) {
  if (text === null || text === undefined) return '';
  const source = String(text);
  if (!source) return '';
  const pieces = source.split(/(\s+)/);
  return pieces.map(function (piece) {
    if (!looksLikeUrl_(piece)) return escHtml_(piece);
    const url = normalizeUrl_(piece);
    const safeUrl = absUrl_(url);
    if (!safeUrl) return escHtml_(piece);
    return '<a href="' + escHtml_(safeUrl) + '" target="_blank" rel="noopener noreferrer" data-embed="1">' + escHtml_(piece) + '</a>';
  }).join('');
}

/* ============================================================
 * Reports.gs pure helpers
 * ============================================================ */

function buildSummaryFromItems(items) {
  items = items || [];
  const summary = {
    total: items.length,
    flagged: items.filter(function (i) { return i.flagged; }).length,
    normal: items.filter(function (i) { return !i.flagged; }).length,
    sectors: {}
  };
  items.forEach(function (i) {
    const sector = i.sector || 'Unspecified';
    summary.sectors[sector] = (summary.sectors[sector] || 0) + 1;
  });
  return summary;
}

function buildSectorReportFromSummary(summary) {
  const sectors = (summary && summary.sectors) || {};
  return Object.keys(sectors).sort().map(function (key) { return { sector: key, total: sectors[key] }; });
}

function buildFlaggedItemsFromItems(items) {
  return (items || []).filter(function (item) { return item.flagged; });
}

function buildMonthlyTrendFromItems(items) {
  const trend = {};
  (items || []).forEach(function (item) {
    if (!item || !item.entryDate) return;
    const key = String(item.entryDate).slice(0, 7);
    trend[key] = (trend[key] || 0) + 1;
  });
  return trend;
}

function getReportTemplates() {
  return Object.keys(REPORT_TEMPLATES).map(function (key) {
    const t = REPORT_TEMPLATES[key];
    return { key: t.key, label: t.label, description: t.description };
  });
}

/* ============================================================
 * Analytics.gs helper
 * ============================================================ */

function buildAnalytics_(items) {
  if (!Array.isArray(items) || !items.length) {
    return {
      total: 0, flagged: 0, normal: 0, sectors: [], offices: [],
      flaggedItems: [], trend: [], trendPrev: []
    };
  }

  const total = items.length;
  const flagged = items.filter(function (i) { return i.reviewStatus === 'due'; }).length;
  const normal = total - flagged;

  const sectorMap = {};
  const officeMap = {};
  const flaggedItems = [];
  const monthMap = {};
  const prevMonthMap = {};

  const now = new Date();
  const thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');

  items.forEach(function (item) {
    const sector = String(item.sector || 'Unknown').trim();
    sectorMap[sector] = (sectorMap[sector] || 0) + 1;

    const office = String(item.responsibility || 'Unknown').trim();
    officeMap[office] = (officeMap[office] || 0) + 1;

    if (item.reviewStatus === 'due') {
      flaggedItems.push({
        id: item.id,
        sector: item.sector,
        reviewDate: item.reviewDate,
        row: item.row
      });
    }

    const entryDate = item.entryDate || '';
    if (entryDate && entryDate.length >= 7) {
      // 'dd.MM.yyyy' -> 'yyyy-MM'
      const parts = String(entryDate).split('.');
      let monthKey = '';
      if (parts.length === 3) {
        monthKey = parts[2] + '-' + parts[1];
      } else {
        monthKey = entryDate.substring(3, 10);
      }
      monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
      if (monthKey === prevMonth) prevMonthMap[prevMonth] = (prevMonthMap[prevMonth] || 0) + 1;
    }
  });

  const sectors = Object.keys(sectorMap).sort().map(function (key) {
    return { sector: key, total: sectorMap[key] };
  });

  const offices = Object.keys(officeMap).sort().map(function (key) {
    return { office: key, total: officeMap[key] };
  });

  const trend = Object.keys(monthMap).sort().slice(-12).map(function (key) {
    return { key: key, value: monthMap[key] };
  });

  const trendPrev = Object.keys(prevMonthMap).sort().map(function (key) {
    return { key: key, value: prevMonthMap[key] };
  });

  return {
    total: total,
    flagged: flagged,
    normal: normal,
    sectors: sectors,
    offices: offices,
    flaggedItems: flaggedItems.slice(0, 100),
    trend: trend,
    trendPrev: trendPrev
  };
}

/* ============================================================
 * CSV parsing
 * ============================================================ */

function parseCsvLine_(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

/* Parses CSV text into an array of rows (array of cell strings). */
function parseCsv_(csv) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  const s = String(csv || '');
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (inQ) {
      if (c === '"') {
        if (s.charAt(i + 1) === '"') { cur += '"'; i++; }
        else { inQ = false; }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      row.push(cur); cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s.charAt(i + 1) === '\n') i++;
      row.push(cur); cur = '';
      rows.push(row); row = [];
    } else {
      cur += c;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function xlsxColLetter_(index) {
  let letters = '';
  while (index > 0) {
    const rem = (index - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    index = Math.floor((index - 1) / 26);
  }
  return letters;
}

function xlsxEscape_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/* Builds the .xlsx XML parts (same shape as GAS buildXlsxFromItems_). */
function buildXlsxParts_(items) {
  const headers = ['ID', 'Sector', 'Description', 'Entry Date', 'Action', 'Responsibility', 'Review Date', 'Flagged'];
  const rows = [headers].concat((items || []).map(function (row) {
    return [
      row.id, row.sector, row.description, row.entryDate,
      row.action, row.responsibility, row.reviewDate,
      row.flagged ? 'YES' : 'NO'
    ];
  }));

  let sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
  rows.forEach(function (row, rIdx) {
    const rowNum = rIdx + 1;
    sheetXml += '<row r="' + rowNum + '">';
    row.forEach(function (value, cIdx) {
      sheetXml += '<c r="' + xlsxColLetter_(cIdx + 1) + rowNum + '" t="inlineStr"><is><t xml:space="preserve">' + xlsxEscape_(value) + '</t></is></c>';
    });
    sheetXml += '</row>';
  });
  sheetXml += '</sheetData></worksheet>';

  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>';

  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    '</Relationships>';

  const workbookXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets>' +
    '</workbook>';

  const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  const coreProps = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<dc:creator>India Post Dashboard</dc:creator>' +
    '<dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString() + '</dcterms:created>' +
    '</cp:coreProperties>';

  const appProps = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>India Post Dashboard</Application>' +
    '</Properties>';

  return [
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml },
    { name: 'xl/styles.xml', content: stylesXml },
    { name: 'docProps/core.xml', content: coreProps },
    { name: 'docProps/app.xml', content: appProps }
  ];
}

/* ============================================================
 * Misc
 * ============================================================ */

function htmlToText_(html) {
  const s = String(html || '');
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ').trim();
}

function isSafeLinkUrl_(url) {
  const s = String(url || '').trim();
  const m = s.match(/^(https?):\/\/([^/?#:]+)(?::\d+)?([/?#]|$)/i);
  if (!m) return false;
  if (m[1].toLowerCase() !== 'http' && m[1].toLowerCase() !== 'https') return false;
  const host = m[2].toLowerCase();
  if (host.indexOf('@') !== -1) return false;
  if (host === 'localhost' || host.indexOf('.localhost') !== -1 || host.indexOf('.local') !== -1) return false;
  if (host === '169.254.169.254') return false;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^0\./.test(host)) return false;
  const r = host.match(/^172\.(\d+)\./);
  if (r) { const n = parseInt(r[1], 10); if (n >= 16 && n <= 31) return false; }
  return true;
}

function isReadableAiText_(text) {
  const t = String(text || '').trim();
  if (t.length <= 40) return false;
  const low = t.toLowerCase();
  if (low.indexOf('request access') !== -1) return false;
  if (low.indexOf('sign in to continue') !== -1) return false;
  if (low.indexOf('javascript isn\'t enabled') !== -1) return false;
  if (low.indexOf('can\'t be opened') !== -1) return false;
  if (low.indexOf('enable and reload') !== -1) return false;
  if (low.indexOf('this browser version is no longer supported') !== -1) return false;
  if (low.indexOf('unable to load') !== -1) return false;
  if (low.indexOf('an error occurred') !== -1) return false;
  return true;
}

/* GAS-style runWithLock_: serializes the callback through a promise queue so
   concurrent requests never interleave locked write paths. Returns the
   callback's value (a promise when the callback is async). */
let lockQueue = Promise.resolve();
function runWithLock_(callback) {
  const result = lockQueue.then(function () { return callback(); }, function () { return callback(); });
  lockQueue = result.then(function () {}, function () {});
  return result;
}

module.exports = {
  now_,
  timezone_,
  formatDate_,
  today_,
  parseDisplayDate_,
  daysUntilDate_,
  addDays_,
  uuid_,
  generateSalt_,
  sha256Hex_,
  hashPassword_,
  safeCacheKey_,
  isValidEmail_,
  emailList_,
  primaryEmail_,
  emailsOverlap_,
  emailsMatch_,
  isValidEmailList_,
  isValidUsername_,
  validatePassword_,
  normalizeItemForSheet_,
  escHtml_,
  looksLikeUrl_,
  normalizeUrl_,
  absUrl_,
  linkifyText_,
  buildSummaryFromItems,
  buildSectorReportFromSummary,
  buildFlaggedItemsFromItems,
  buildMonthlyTrendFromItems,
  getReportTemplates,
  buildAnalytics_,
  parseCsvLine_,
  parseCsv_,
  buildXlsxParts_,
  htmlToText_,
  isSafeLinkUrl_,
  isReadableAiText_,
  runWithLock_
};

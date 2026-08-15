/**
 * ============================================================
 * India Post Dashboard — Node port
 * sync-sheet.js
 * Two-way sync with the origin Google Spreadsheet.
 *
 * The SQLite DB is the project's source of truth at runtime — the app never
 * depends on the spreadsheet being reachable. This module is the on-demand
 * bridge that keeps the two in step:
 *
 *   pullFromSheet():  reads Sheet1 (public gviz — no auth needed) and
 *                     upserts record text into the records table. When a
 *                     Google Sheets API key is configured, hyperlinks are
 *                     read from the sheet's rich-text cells too; without a
 *                     key the existing DB links are preserved untouched.
 *   pushToSheet():    writes the project's records back to the sheet
 *                     (values + rich-text hyperlinks). Requires a Google
 *                     service-account credential (GOOGLE_SERVICE_ACCOUNT_JSON
 *                     or GOOGLE_OAUTH_TOKEN); without one it reports
 *                     'not configured' and the pull path is still safe.
 *
 * Configured via env vars:
 *   GOOGLE_SHEETS_API_KEY      API key for reading hyperlinks (public sheet).
 *   GOOGLE_SERVICE_ACCOUNT_JSON  service-account JSON for write access (or
 *                              GOOGLE_OAUTH_TOKEN as an OAuth2 access token).
 * ============================================================
 */

const crypto = require('crypto');
const { db } = require('./db');
const { CONFIG } = require('./config');

const SOURCE_SPREADSHEET_ID =
  process.env.DASH_SPREADSHEET_ID ||
  '1xQaysoLjDIqNa5X_QnvA5FWp7J6lMr5r6lzLGalm-y8';
const SHEET_NAME = CONFIG.SHEET.NAME; // Sheet1
const START_ROW = CONFIG.SHEET.START_ROW; // 4

const API_KEY = process.env.GOOGLE_SHEETS_API_KEY || '';
const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const OAUTH_TOKEN = process.env.GOOGLE_OAUTH_TOKEN || '';

function writeCredentialConfigured() {
  return !!(SERVICE_ACCOUNT_JSON || OAUTH_TOKEN);
}

/* ------------------------------------------------------------------ *
 * gviz read (public sheet, no auth) — record text
 * ------------------------------------------------------------------ */

function fetchGviz() {
  const url = 'https://docs.google.com/spreadsheets/d/' + SOURCE_SPREADSHEET_ID +
    '/gviz/tq?tqx=out:json&sheet=' + encodeURIComponent(SHEET_NAME);
  return fetch(url).then(function (resp) {
    if (!resp.ok) throw new Error('gviz HTTP ' + resp.status);
    return resp.text();
  });
}

function parseGviz(text) {
  let t = String(text || '').trim();
  t = t.replace(/^\/\*O_o\*\//, '').trim();
  const marker = 'setResponse(';
  const idx = t.indexOf(marker);
  if (idx !== -1) {
    t = t.slice(idx + marker.length);
    t = t.replace(/\);\s*$/, '');
  }
  const parsed = JSON.parse(t);
  if (parsed.status === 'error') {
    throw new Error((parsed.errors && parsed.errors[0] && parsed.errors[0].detailed_message) || 'gviz error');
  }
  return parsed;
}

function gvizRows(resp) {
  const rows = resp && resp.table && resp.table.rows;
  return Array.isArray(rows) ? rows : [];
}

function cellValue(cell, fallback) {
  if (!cell) return fallback != null ? fallback : '';
  if (cell.f !== null && cell.f !== undefined && cell.f !== '') return String(cell.f);
  if (cell.v === null || cell.v === undefined) return fallback != null ? fallback : '';
  return String(cell.v);
}

/* ------------------------------------------------------------------ *
 * Sheets API read (public sheet + API key) — hyperlinks
 * ------------------------------------------------------------------ */

// Reads the sheet's grid data and returns a map of
//   displayRow (1-based, = sheet row - START_ROW + 1) -> { action: [...], ... }
// where each field's value is an array of { url, text } links extracted from
// rich-text runs. Falls back to cell.hyperlink for single-link cells.
async function fetchHyperlinks() {
  if (!API_KEY) return null;
  const range = SHEET_NAME + '!A' + START_ROW + ':Z';
  const fields = 'sheets.data.rowData.values(userEnteredValue,formattedValue,hyperlink,textFormatRuns(format.link,startIndex))';
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SOURCE_SPREADSHEET_ID +
    '?ranges=' + encodeURIComponent(range) +
    '&includeGridData=true' +
    '&fields=' + encodeURIComponent(fields) +
    '&key=' + encodeURIComponent(API_KEY);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error('Sheets API ' + resp.status + ': ' + (await resp.text()).slice(0, 200));
  }
  const json = await resp.json();
  const sheet = json.sheets && json.sheets[0];
  const rows = sheet && sheet.data && sheet.data[0] && sheet.data[0].rowData;
  if (!Array.isArray(rows)) return {};
  const out = {};
  rows.forEach(function (row, i) {
    const vals = row.values || [];
    // Sheet grid row 0 = physical row START_ROW → display row 1.
    const displayRow = i + 1;
    const fieldLinks = {};
    // Column order matches the records columns: A=id B=sector C=description
    // D=entryDate E=action F=responsibility G=reviewDate (0-based: 1..6).
    const FIELD_COLS = { sector: 1, description: 2, action: 4 };
    Object.keys(FIELD_COLS).forEach(function (key) {
      const cell = vals[FIELD_COLS[key]];
      if (!cell) return;
      const list = [];
      const runs = cell.textFormatRuns || [];
      const formatted = String(cell.formattedValue || (cell.userEnteredValue && (cell.userEnteredValue.stringValue || String(cell.userEnteredValue.numberValue != null ? cell.userEnteredValue.numberValue : ''))) || '');
      // textFormatRuns carry startIndex only — a run's text runs until the
      // next run's startIndex (or the end of the string).
      runs.forEach(function (run, ri) {
        const uri = run.format && run.format.link && run.format.link.uri;
        if (!uri) return;
        const start = run.startIndex || 0;
        const nextStart = ri + 1 < runs.length ? (runs[ri + 1].startIndex || formatted.length) : formatted.length;
        const text = formatted.slice(start, nextStart);
        list.push({ url: String(uri), text: String(text || '').trim() });
      });
      // Single-link cell (whole-cell hyperlink) with no runs carrying links.
      if (!list.length && cell.hyperlink) {
        list.push({ url: String(cell.hyperlink), text: String(formatted || '').trim() });
      }
      if (list.length) fieldLinks[key] = list;
    });
    if (Object.keys(fieldLinks).length) out[displayRow] = fieldLinks;
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * Pull: sheet -> SQLite
 * ------------------------------------------------------------------ */

// Upserts the sheet's records into the records table by display id (row =
// START_ROW + displayId - 1). When links are unavailable (no API key), the
// links column of existing rows is left untouched; new rows get {}.
async function pullFromSheet() {
  const text = await fetchGviz();
  const resp = parseGviz(text);
  const rows = gvizRows(resp);

  let linksByRow = null;
  let linksError = null;
  if (API_KEY) {
    try {
      linksByRow = await fetchHyperlinks();
    } catch (err) {
      linksError = err && err.message;
    }
  }

  const insert = db.prepare(
    'INSERT OR IGNORE INTO records (row, sector, description, entry_date, action, responsibility, review_date, links, review_bg, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const update = db.prepare(
    'UPDATE records SET sector = ?, description = ?, entry_date = ?, action = ?, responsibility = ?, review_date = ?, links = ?, review_bg = ?, updated_at = ? WHERE row = ?'
  );

  let inserted = 0;
  let updated = 0;
  let linkCount = 0;

  rows.forEach(function (r, i) {
    const displayId = i + 1;
    const row = START_ROW + i;
    const sector = cellValue(r.c[1]);
    const description = cellValue(r.c[2]);
    const entryDate = cellValue(r.c[3]);
    const action = cellValue(r.c[4]);
    const responsibility = cellValue(r.c[5]);
    const reviewDate = cellValue(r.c[6]);

    let linksObj = {};
    const sheetLinks = linksByRow && linksByRow[displayId];
    if (sheetLinks && Object.keys(sheetLinks).length) {
      linksObj = sheetLinks;
      linkCount += Object.keys(sheetLinks).reduce(function (n, k) { return n + sheetLinks[k].length; }, 0);
    } else {
      // No API key / no links in this row: keep whatever the DB already has.
      const existing = db.prepare('SELECT links FROM records WHERE row = ?').get(row);
      try { linksObj = existing && existing.links ? JSON.parse(existing.links) : {}; } catch (e) { linksObj = {}; }
    }

    const existing = db.prepare('SELECT row FROM records WHERE row = ?').get(row);
    if (existing) {
      update.run(sector, description, entryDate, action, responsibility, reviewDate,
        JSON.stringify(linksObj), CONFIG.COLORS.NORMAL, Date.now(), row);
      updated++;
    } else {
      insert.run(row, sector, description, entryDate, action, responsibility, reviewDate,
        JSON.stringify(linksObj), CONFIG.COLORS.NORMAL, Date.now(), Date.now());
      inserted++;
    }
  });

  require('./records').invalidateDataCache();

  return {
    pulled: true,
    spreadsheetId: SOURCE_SPREADSHEET_ID,
    sheetRows: rows.length,
    inserted: inserted,
    updated: updated,
    linksRead: linkCount,
    linksSource: API_KEY ? 'sheets-api' : (linksError ? 'db-kept (api error: ' + linksError + ')' : 'db-kept (no GOOGLE_SHEETS_API_KEY)')
  };
}

/* ------------------------------------------------------------------ *
 * Push: SQLite -> sheet (needs a write credential)
 * ------------------------------------------------------------------ */

// Field key -> 0-based column in the records sheet (A=id … G=reviewDate).
const PUSH_FIELD_COLS = { sector: 1, description: 2, action: 4 };

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

// Signs an RS256 JWT for a Google service account and exchanges it for an
// access token (scope: spreadsheets). Returns the access token.
async function serviceAccountToken_() {
  let sa;
  try {
    sa = JSON.parse(SERVICE_ACCOUNT_JSON);
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: tokenUri,
    iat: now,
    exp: now + 3600
  }));
  const signingInput = header + '.' + claim;
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(sa.private_key, 'base64');
  const jwt = signingInput + '.' + signature;
  const resp = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + encodeURIComponent(jwt)
  });
  const json = await resp.json();
  if (!resp.ok || !json.access_token) {
    throw new Error('service-account token exchange failed: ' + JSON.stringify(json).slice(0, 200));
  }
  return json.access_token;
}

async function accessToken_() {
  if (OAUTH_TOKEN) return OAUTH_TOKEN;
  if (SERVICE_ACCOUNT_JSON) return serviceAccountToken_();
  return null;
}

// Resolves the sheet's grid id (gid) so updateCells can target it.
async function sheetGridId_(token) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SOURCE_SPREADSHEET_ID +
    '?fields=sheets.properties(sheetId,title)&access_token=' + encodeURIComponent(token);
  const resp = await fetch(url);
  const json = await resp.json();
  if (!resp.ok) throw new Error('spreadsheets.get ' + resp.status + ': ' + JSON.stringify(json).slice(0, 200));
  const sheet = (json.sheets || []).find(function (s) { return (s.properties.title || '') === SHEET_NAME; });
  const id = sheet && sheet.properties && sheet.properties.sheetId;
  if (id == null) throw new Error('sheet "' + SHEET_NAME + '" not found');
  return id;
}

// Builds the rich-text runs for a cell: plain text run from 0, plus one run
// per hyperlink whose display text appears in the cell text. Runs are sorted
// by startIndex (the Sheets API requires ascending order).
function buildTextRuns_(text, links) {
  // Base run (no link) starting at 0 — the API derives each run's end from
  // the next run's startIndex, so a plain leading run covers unlinked text.
  const runs = [{ startIndex: 0, format: {} }];
  const t = String(text || '');
  links.forEach(function (link) {
    const uri = String(link.url || '');
    const label = String(link.text || '').trim();
    if (!uri) return;
    let start = -1;
    if (label) {
      start = t.indexOf(label);
    }
    if (start < 0) start = 0;
    if (start >= t.length && t.length) start = 0;
    runs.push({ startIndex: start, format: { link: { uri: uri } } });
  });
  runs.sort(function (a, b) { return a.startIndex - b.startIndex; });
  return runs;
}

function parseRecordLinks_(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

// Writes every record back to the sheet: plain values for all 7 columns, then
// rich-text cells (with hyperlink runs) for any field that has links.
async function pushToSheet() {
  const token = await accessToken_();
  if (!token) {
    return {
      pushed: false,
      ok: false,
      reason: 'no write credential — set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_OAUTH_TOKEN'
    };
  }

  const rows = db.prepare('SELECT * FROM records ORDER BY row ASC').all();
  if (!rows.length) return { pushed: true, ok: true, rows: 0, reason: 'no records to push' };

  const values = rows.map(function (r) {
    return [
      Number(r.row) - START_ROW + 1,
      String(r.sector || ''),
      String(r.description || ''),
      String(r.entry_date || ''),
      String(r.action || ''),
      String(r.responsibility || ''),
      String(r.review_date || '')
    ];
  });
  const lastRow = START_ROW + values.length - 1;
  const range = SHEET_NAME + '!A' + START_ROW + ':G' + lastRow;
  const putUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + SOURCE_SPREADSHEET_ID +
    '/values/' + encodeURIComponent(range) + '?valueInputOption=RAW&access_token=' + encodeURIComponent(token);
  const putResp = await fetch(putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ majorDimension: 'ROWS', values: values })
  });
  if (!putResp.ok) {
    throw new Error('values.update ' + putResp.status + ': ' + (await putResp.text()).slice(0, 200));
  }

  // Rich-text links: updateCells per linked cell.
  const sheetId = await sheetGridId_(token);
  const requests = [];
  rows.forEach(function (r, i) {
    const links = parseRecordLinks_(r.links);
    const sheetRow = START_ROW + i;
    const fieldTexts = {
      sector: String(r.sector || ''),
      description: String(r.description || ''),
      action: String(r.action || '')
    };
    Object.keys(PUSH_FIELD_COLS).forEach(function (key) {
      const list = links[key] || [];
      if (!list.length) return;
      const col = PUSH_FIELD_COLS[key];
      requests.push({
        updateCells: {
          range: {
            sheetId: sheetId,
            startRowIndex: sheetRow - 1,
            endRowIndex: sheetRow,
            startColumnIndex: col,
            endColumnIndex: col + 1
          },
          rows: [{
            values: [{
              userEnteredValue: { stringValue: fieldTexts[key] },
              textFormatRuns: buildTextRuns_(fieldTexts[key], list)
            }]
          }],
          fields: 'userEnteredValue,textFormatRuns'
        }
      });
    });
  });

  if (requests.length) {
    const batchUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + SOURCE_SPREADSHEET_ID +
      ':batchUpdate?access_token=' + encodeURIComponent(token);
    const batchResp = await fetch(batchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: requests })
    });
    if (!batchResp.ok) {
      throw new Error('batchUpdate ' + batchResp.status + ': ' + (await batchResp.text()).slice(0, 300));
    }
  }

  return { pushed: true, ok: true, rows: rows.length, linkedCells: requests.length };
}

module.exports = {
  SOURCE_SPREADSHEET_ID,
  pullFromSheet,
  pushToSheet,
  writeCredentialConfigured,
  _parseGviz: parseGviz,
  _gvizRows: gvizRows
};

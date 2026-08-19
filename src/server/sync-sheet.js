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
const settings = require('./settings');

const SOURCE_SPREADSHEET_ID =
  process.env.DASH_SPREADSHEET_ID ||
  '1xQaysoLjDIqNa5X_QnvA5FWp7J6lMr5r6lzLGalm-y8';
const SHEET_NAME = CONFIG.SHEET.NAME; // Sheet1
const START_ROW = CONFIG.SHEET.START_ROW; // 4

const API_KEY = process.env.GOOGLE_SHEETS_API_KEY || '';
const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const OAUTH_TOKEN = process.env.GOOGLE_OAUTH_TOKEN || '';
// Hard kill switch: push-back to the origin spreadsheet is DISABLED unless
// explicitly opted in via DASH_PUSH_TO_SHEET=true. This protects the origin
// sheet from being overwritten by stale/misaligned project data (a recurring
// corruption source); the pull (sheet -> DB) is unaffected.
function pushToSheetEnabled() {
  return String(process.env.DASH_PUSH_TO_SHEET || '').toLowerCase() === 'true';
}

function writeCredentialConfigured() {
  return pushToSheetEnabled() && !!(SERVICE_ACCOUNT_JSON || OAUTH_TOKEN);
}

/* ------------------------------------------------------------------ *
 * gviz read (public sheet, no auth) — record text
 * ------------------------------------------------------------------ */

function fetchGviz() {
  // Pin the header count (= START_ROW - 1) explicitly: gviz's automatic header
  // detection is heuristic and has been observed to flip (treating the first
  // data row as a header, dropping record id 1 and shifting every row's
  // content by one). START_ROW rows precede the data (title, blank, header).
  const headers = START_ROW - 1;
  const url = 'https://docs.google.com/spreadsheets/d/' + SOURCE_SPREADSHEET_ID +
    '/gviz/tq?tqx=out:json&headers=' + headers + '&sheet=' + encodeURIComponent(SHEET_NAME);
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

// Field keys that can carry links, and the DB columns they map to.
const LINK_FIELD_KEYS = ['sector', 'description', 'action'];

// Parses a stored links JSON column into a plain object (never throws).
function parseLinksCol_(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

// Merges the sheet's links into the DB's existing links for a row. The sheet
// is authoritative for the *content* of a field, but links the owner added in
// the dashboard (or in the sheet) must never be lost: the result is the union
// of the existing DB links and the sheet's links, keyed by field, with sheet
// entries winning on the same (field, url).
function mergeLinks_(existing, sheetLinks) {
  const out = {};
  LINK_FIELD_KEYS.forEach(function (key) {
    const dbList = Array.isArray(existing[key]) ? existing[key] : [];
    const sheetList = Array.isArray(sheetLinks[key]) ? sheetLinks[key] : [];
    const seen = {};
    const merged = [];
    // Sheet entries first so identical (field, url) keeps the sheet's text.
    sheetList.forEach(function (l) {
      if (!l || !l.url) return;
      if (seen[l.url]) return;
      seen[l.url] = true;
      merged.push({ url: String(l.url), text: l.text != null ? String(l.text) : '' });
    });
    dbList.forEach(function (l) {
      if (!l || !l.url) return;
      if (seen[l.url]) return;
      seen[l.url] = true;
      merged.push({ url: String(l.url), text: l.text != null ? String(l.text) : '' });
    });
    if (merged.length) out[key] = merged;
  });
  return out;
}

function sameText_(a, b) {
  return String(a == null ? '' : a) === String(b == null ? '' : b);
}

// Fetches the sheet and computes a *plan* of what pulling it into the DB
// would change — WITHOUT writing anything. Used both for the preview (shown
// to the admin before applying) and as the input to applyPullPlan_().
async function buildPullPlan_() {
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

  const plan = {
    rows: [],
    added: [],
    updated: [],
    unchanged: 0,
    removed: [],
    sheetRows: rows.length,
    linksRead: 0,
    linksSource: API_KEY ? 'sheets-api' : (linksError ? 'db-kept (api error: ' + linksError + ')' : 'db-kept (no GOOGLE_SHEETS_API_KEY)'),
    prevLastRow: Number(settings.getString('sync.prevSheetLastRow')) || 0,
    currentLastRow: START_ROW + rows.length - 1
  };

  rows.forEach(function (r, i) {
    const displayId = i + 1;
    const row = START_ROW + i;
    const proposed = {
      sector: cellValue(r.c[1]),
      description: cellValue(r.c[2]),
      entryDate: cellValue(r.c[3]),
      action: cellValue(r.c[4]),
      responsibility: cellValue(r.c[5]),
      reviewDate: cellValue(r.c[6])
    };

    const existingRow = db.prepare('SELECT * FROM records WHERE row = ?').get(row);
    const existingLinks = existingRow ? parseLinksCol_(existingRow.links) : {};
    const sheetLinks = linksByRow && linksByRow[displayId] || {};
    const mergedLinks = mergeLinks_(existingLinks, sheetLinks);

    if (sheetLinks && Object.keys(sheetLinks).length) {
      plan.linksRead += Object.keys(sheetLinks).reduce(function (n, k) { return n + sheetLinks[k].length; }, 0);
    }

    const entry = {
      displayId: displayId,
      row: row,
      proposed: proposed,
      links: mergedLinks,
      // A row the dashboard created (source='app') is owned by the app: the
      // pull must never overwrite it with sheet content, even if the sheet
      // grew into the same row number.
      appOwned: !!(existingRow && String(existingRow.source || 'sheet') === 'app'),
      existing: existingRow ? {
        row: existingRow.row,
        sector: existingRow.sector,
        description: existingRow.description,
        entryDate: existingRow.entry_date,
        action: existingRow.action,
        responsibility: existingRow.responsibility,
        reviewDate: existingRow.review_date,
        links: existingLinks
      } : null
    };
    plan.rows.push(entry);

    if (entry.appOwned) {
      // Dashboard-created record colliding with a sheet row: preserved as-is.
      plan.unchanged++;
    } else if (!existingRow) {
      plan.added.push(entry);
    } else {
      const existing = entry.existing;
      const textChanged = !sameText_(existing.sector, proposed.sector) ||
        !sameText_(existing.description, proposed.description) ||
        !sameText_(existing.entryDate, proposed.entryDate) ||
        !sameText_(existing.action, proposed.action) ||
        !sameText_(existing.responsibility, proposed.responsibility) ||
        !sameText_(existing.reviewDate, proposed.reviewDate);
      const linksChanged = JSON.stringify(existing.links) !== JSON.stringify(mergedLinks);
      if (textChanged || linksChanged) {
        plan.updated.push(entry);
      } else {
        plan.unchanged++;
      }
    }
  });

  // Rows the DB has that fall outside the sheet's extent (owner deleted rows)
  // are pruned — but ONLY within the sheet's previously-seen extent, and ONLY
  // rows that came from the sheet (source='sheet'). Records created in the
  // dashboard (source='app') are always preserved.
  const pruneUpTo = plan.prevLastRow >= START_ROW ? plan.prevLastRow : plan.currentLastRow;
  const stale = db.prepare("SELECT row, sector, description FROM records WHERE row > ? AND row <= ? AND source = 'sheet'")
    .all(plan.currentLastRow, pruneUpTo);
  plan.removed = stale.map(function (s) {
    return {
      row: s.row,
      displayId: s.row - START_ROW + 1,
      sector: s.sector,
      description: s.description
    };
  });

  return plan;
}

// Applies a plan produced by buildPullPlan_() to the DB (the "commit" half of
// a preview-then-apply sync).
async function applyPullPlan_(plan) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO records (row, sector, description, entry_date, action, responsibility, review_date, links, review_bg, source, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const update = db.prepare(
    'UPDATE records SET sector = ?, description = ?, entry_date = ?, action = ?, responsibility = ?, review_date = ?, links = ?, review_bg = ?, updated_at = ? WHERE row = ?'
  );

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  plan.rows.forEach(function (entry) {
    if (entry.appOwned) {
      // Dashboard-created row colliding with a sheet row: never overwrite.
      skipped++;
      return;
    }
    const p = entry.proposed;
    if (!entry.existing) {
      insert.run(entry.row, p.sector, p.description, p.entryDate, p.action, p.responsibility, p.reviewDate,
        JSON.stringify(entry.links), CONFIG.COLORS.NORMAL, 'sheet', Date.now(), Date.now());
      inserted++;
    } else {
      update.run(p.sector, p.description, p.entryDate, p.action, p.responsibility, p.reviewDate,
        JSON.stringify(entry.links), CONFIG.COLORS.NORMAL, Date.now(), entry.row);
      updated++;
    }
  });

  // Only rows that came from the sheet are ever pruned (source='sheet');
  // dashboard-created rows are preserved unconditionally.
  const pruned = db.prepare("DELETE FROM records WHERE row > ? AND row <= ? AND source = 'sheet'")
    .run(plan.currentLastRow, plan.prevLastRow >= START_ROW ? plan.prevLastRow : plan.currentLastRow).changes;
  if (pruned) console.log('[sync] pruned ' + pruned + ' stale DB row(s) beyond sheet row ' + plan.currentLastRow);
  settings.set('sync.prevSheetLastRow', String(plan.currentLastRow));

  require('./records').invalidateDataCache();

  return {
    pulled: true,
    spreadsheetId: SOURCE_SPREADSHEET_ID,
    sheetRows: plan.sheetRows,
    inserted: inserted,
    updated: updated,
    skipped: skipped,
    pruned: pruned,
    linksRead: plan.linksRead,
    linksSource: plan.linksSource
  };
}

// Computes what a pull would change and returns a human-readable preview
// WITHOUT touching the DB. The admin reviews this, then calls pullFromSheet()
// (via adminSyncFromSheet) to actually apply it.
async function previewPullFromSheet() {
  const plan = await buildPullPlan_();
  const summarize = function (entry) {
    const s = entry.existing;
    const changes = [];
    if (!s || !sameText_(s.sector, entry.proposed.sector)) changes.push('sector');
    if (!s || !sameText_(s.description, entry.proposed.description)) changes.push('description');
    if (!s || !sameText_(s.entryDate, entry.proposed.entryDate)) changes.push('entryDate');
    if (!s || !sameText_(s.action, entry.proposed.action)) changes.push('action');
    if (!s || !sameText_(s.responsibility, entry.proposed.responsibility)) changes.push('responsibility');
    if (!s || !sameText_(s.reviewDate, entry.proposed.reviewDate)) changes.push('reviewDate');
    if (!s || JSON.stringify(s.links) !== JSON.stringify(entry.links)) changes.push('links');
    return {
      displayId: entry.displayId,
      row: entry.row,
      sector: entry.proposed.sector,
      description: entry.proposed.description,
      changes: changes,
      links: entry.links
    };
  };
  return {
    preview: true,
    spreadsheetId: SOURCE_SPREADSHEET_ID,
    sheetRows: plan.sheetRows,
    added: plan.added.map(summarize),
    updated: plan.updated.map(summarize),
    removed: plan.removed,
    unchanged: plan.unchanged,
    linksRead: plan.linksRead,
    linksSource: plan.linksSource,
    pending: plan.added.length + plan.updated.length + plan.removed.length
  };
}

// Upserts the sheet's records into the records table by display id (row =
// START_ROW + displayId - 1). When links are unavailable (no API key), the
// links column of existing rows is left untouched; new rows get {}.
async function pullFromSheet() {
  const plan = await buildPullPlan_();
  return applyPullPlan_(plan);
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
    if (!uri || !label) return;          // skip empty labels entirely
    const start = t.indexOf(label);
    if (start < 0) return;               // label not in text → skip this link
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
  if (!pushToSheetEnabled()) {
    return {
      pushed: false,
      ok: false,
      reason: 'push-back disabled — set DASH_PUSH_TO_SHEET=true (and a write credential) to enable'
    };
  }
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
  previewPullFromSheet,
  pushToSheet,
  writeCredentialConfigured,
  pushToSheetEnabled,
  _parseGviz: parseGviz,
  _gvizRows: gvizRows,
  _buildTextRuns: buildTextRuns_
};

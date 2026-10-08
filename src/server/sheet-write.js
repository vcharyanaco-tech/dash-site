/**
 * ============================================================
 * India Post Dashboard — Node port
 * sheet-write.js
 * Reading and writing ONE named cell in a Google Sheet, for the
 * change-request approval path.
 *
 * Scope is deliberately tiny: read a header row + a row's current value, and
 * write a single cell. It never rewrites a whole row and never touches a range
 * the caller did not resolve through sheet-target.js, because this credential
 * has edit rights to real departmental data and a sloppy range would damage
 * it.
 *
 * Safety rails:
 *  - CHANGE_REQUEST_DRY_RUN=true resolves and returns the exact range and
 *    payload but sends nothing. This is how the path gets exercised against
 *    production data before it is allowed to write.
 *  - A missing write credential is a clear, reported condition - never a
 *    silent no-op, so an approval can never look applied when it was not.
 * ============================================================
 */

const { resolveNamedCell, clampRow_ } = require('./sheet-target');
const {
  SHEET_STRUCTURE_CACHE_TTL_MS,
  SHEET_STRUCTURE_FETCH_CONCURRENCY
} = require('./config');

const DRY_RUN = String(process.env.CHANGE_REQUEST_DRY_RUN || '').toLowerCase() === 'true';
const REQUEST_TIMEOUT_MS = 15000;
// Rows of a tab read when hunting for the header row. Sheets commonly open with
// a title row and a blank row before the real column names.
const HEADER_SCAN_ROWS = 10;

/* A Google Sheets URL is the only thing this module will ever be pointed at.
   The record's hyperlink is user-supplied text, so the host is checked as well
   as the path shape: without the host check, any URL merely CONTAINING
   "/spreadsheets/d/<id>" (e.g. https://evil.example/spreadsheets/d/<someone
   else's real sheet id>) would be accepted and written to. */
function sheetIdFromUrl_(url) {
  const text = String(url || '');
  let parsed;
  try {
    parsed = new URL(text);
  } catch (e) {
    return '';
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
  const host = String(parsed.hostname || '').toLowerCase();
  if (host !== 'docs.google.com' && host !== 'www.docs.google.com') return '';
  const m = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : '';
}

function writeCredentialPresent_() {
  return !!(process.env.GOOGLE_OAUTH_TOKEN || process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

async function sheetsGet_(spreadsheetId, token, fields) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId +
    '?fields=' + encodeURIComponent(fields) + '&includeGridData=false';
  const resp = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const json = await resp.json().catch(function () { return {}; });
  if (!resp.ok) {
    const msg = (json && json.error && json.error.message) || ('HTTP ' + resp.status);
    throw new Error('sheets.get failed: ' + msg);
  }
  return json;
}

/** Tab titles and row extents in ONE call: [{ title, rowCount }].
 *  The row extent used to be a second full metadata fetch per tab, which made
 *  building the form's tab list cost 2N+1 serialized round trips. */
async function readSheetMeta_(spreadsheetId, token) {
  const meta = await sheetsGet_(spreadsheetId, token, 'sheets.properties(title,gridProperties.rowCount)');
  return (meta.sheets || []).map(function (s) {
    const props = (s && s.properties) || {};
    return {
      title: String(props.title || ''),
      rowCount: props.gridProperties ? Number(props.gridProperties.rowCount) || 0 : 0
    };
  }).filter(function (t) { return !!t.title; });
}

/** List the tab titles of a spreadsheet: ['Sheet1', 'Data', ...]. */
async function listTabs_(spreadsheetId, token) {
  const meta = await readSheetMeta_(spreadsheetId, token);
  return meta.map(function (t) { return t.title; });
}

/** Case-insensitive tab lookup; returns the sheet's real title (needed verbatim
 *  for A1 quoting) or '' when absent. */
function matchTab_(tabs, wanted) {
  const key = function (v) { return String(v || '').trim().toLowerCase(); };
  const want = key(wanted);
  for (let i = 0; i < tabs.length; i++) {
    const t = typeof tabs[i] === 'string' ? tabs[i] : (tabs[i] && tabs[i].title);
    if (key(t) === want) return typeof tabs[i] === 'string' ? tabs[i] : tabs[i].title;
  }
  return '';
}

/** Row extent of a named tab, from metadata already fetched. 0 when absent. */
function rowCountFor_(meta, tabTitle) {
  const hit = meta.filter(function (t) { return t.title === String(tabTitle); })[0];
  return hit ? Number(hit.rowCount) || 0 : 0;
}

/** First row of a tab, used as the header row for column resolution. */
async function readHeaderRow_(spreadsheetId, tabTitle, token) {
  const rows = await readTopRows_(spreadsheetId, tabTitle, token, 1);
  return rows[0] || [];
}

/**
 * The top rows of a tab. The header is NOT assumed to be row 1: sheets
 * commonly open with a title row and a blank row before the real headers (the
 * dashboard's own origin sheet puts them on row 3), so the header has to be
 * located by name rather than by position.
 */
async function readTopRows_(spreadsheetId, tabTitle, token, maxRows) {
  const n = Math.max(1, Math.min(30, Number(maxRows) || 10));
  const range = "'" + String(tabTitle).replace(/'/g, "''") + "'!A1:Z" + n;
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId +
    '/values/' + encodeURIComponent(range);
  const resp = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const json = await resp.json().catch(function () { return {}; });
  if (!resp.ok) {
    const msg = (json && json.error && json.error.message) || ('HTTP ' + resp.status);
    throw new Error('sheets.values.get failed: ' + msg);
  }
  return (json.values || []).map(function (row) {
    return row.map(function (v) { return String(v == null ? '' : v); });
  });
}

/**
 * Resolve a named cell to a concrete range and report what is currently there.
 *
 * Returns { ok, reason, range, cell, columnLetter, currentValue, row, tab }.
 * Purely read-only, so it is safe to call from the approval UI to show the
 * approver exactly what would change.
 */
async function resolveTarget(opts) {
  opts = opts || {};
  const spreadsheetId = sheetIdFromUrl_(opts.sheetUrl);
  if (!spreadsheetId) return { ok: false, reason: 'That link is not a Google Sheets URL.' };
  if (!writeCredentialPresent_()) {
    return { ok: false, reason: 'No Google write credential is configured on the server, so linked sheets cannot be written.' };
  }

  const token = await require('./sync-sheet').accessToken_();
  if (!token) return { ok: false, reason: 'No Google write credential is configured on the server.' };

  // One metadata call yields both the tab list and the row extent, so the tab
  // check and the row clamp below cost nothing extra.
  const meta = await readSheetMeta_(spreadsheetId, token);
  const tabs = meta.map(function (t) { return t.title; });
  const tab = matchTab_(tabs, opts.tabName);
  if (!tab) {
    return {
      ok: false,
      reason: 'Tab "' + String(opts.tabName || '') + '" is not in this sheet.' +
        (tabs.length ? ' Available: ' + tabs.join(', ') + '.' : ' The sheet has no tabs.')
    };
  }

  const headerRows = await readTopRows_(spreadsheetId, tab, token, HEADER_SCAN_ROWS);
  const located = require('./sheet-target').findHeaderInTopRows_(headerRows, opts.headerName, HEADER_SCAN_ROWS);
  if (!located.found) {
    if (located.ambiguous) {
      return {
        ok: false,
        reason: 'Column "' + String(opts.headerName || '') + '" appears in more than one of the first ' +
          located.rowsSearched + ' rows of "' + tab + '" (at ' + (located.where || '') +
          '). Make the column name unique so the target is unambiguous.'
      };
    }
    const seen = located.seenHeaders || [];
    return {
      ok: false,
      reason: 'Column "' + String(opts.headerName || '') + '" was not found in the first ' +
        located.rowsSearched + ' rows of "' + tab + '".' +
        (seen.length ? ' Headings on those rows: ' + seen.slice(0, 12).join(', ') + '.' : '')
    };
  }
  const headerRow = headerRows[located.row - 1] || [];
  const resolved = resolveNamedCell({
    tabName: tab,
    headerRow: headerRow,
    headerName: opts.headerName,
    oneBasedRow: opts.oneBasedRow
  });
  if (!resolved.ok) return { ok: false, reason: resolved.reason };

  const rowCount = rowCountFor_(meta, tab);
  const row = clampRow_(opts.oneBasedRow, rowCount);
  if (!row) {
    return {
      ok: false,
      reason: 'Row ' + Number(opts.oneBasedRow) + ' is past the end of "' + tab +
        '" (it has ' + (rowCount || '?') + ' rows). Refusing rather than growing the sheet.'
    };
  }
  // The header row holds column NAMES, not data. Writing there would rename a
  // column, which is never what "change this cell" means.
  if (row <= located.row) {
    return {
      ok: false,
      reason: 'Row ' + row + ' is the header row (row ' + located.row + ' holds the column names). '
        + 'Pick a row below it.'
    };
  }

  // Re-resolve against the clamped row so the reported cell is the real one.
  const finalCell = resolveNamedCell({
    tabName: tab,
    headerRow: headerRow,
    headerName: opts.headerName,
    oneBasedRow: row
  });

  return {
    ok: true,
    range: finalCell.range,
    cell: finalCell.cell,
    columnLetter: finalCell.columnLetter,
    columnIndex: finalCell.columnIndex,
    tab: tab,
    headerName: String(opts.headerName || '').trim(),
    headerRow: located.row,
    row: row,
    spreadsheetId: spreadsheetId,
    currentValue: await readCellValue_(spreadsheetId, tab, row, finalCell.columnIndex, token)
  };
}

async function readCellValue_(spreadsheetId, tab, oneBasedRow, colIndex, token) {
  const letters = require('./sheet-target').columnLetters_(colIndex);
  const range = "'" + String(tab).replace(/'/g, "''") + "'!" + letters + String(oneBasedRow);
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId +
    '/values/' + encodeURIComponent(range);
  const resp = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const json = await resp.json().catch(function () { return {}; });
  if (!resp.ok) return '';
  const values = json.values || [];
  if (!values.length) return '';
  const first = values[0];
  return first && first.length ? String(first[0] == null ? '' : first[0]) : '';
}

/**
 * Write one cell. Dry-run returns the intended payload without sending it.
 * The caller has already resolved `range` via resolveTarget, so this cannot
 * invent a target of its own.
 */
async function writeCell(opts) {
  opts = opts || {};
  const spreadsheetId = String(opts.spreadsheetId || '');
  const range = String(opts.range || '');
  const value = String(opts.newValue == null ? '' : opts.newValue);

  if (!spreadsheetId) return { ok: false, message: 'No spreadsheet id to write to.' };
  if (!range) return { ok: false, message: 'Refusing to write: no cell range was resolved.' };
  if (!writeCredentialPresent_()) {
    return { ok: false, message: 'No Google write credential is configured on the server.' };
  }

  if (DRY_RUN) {
    // Intentionally does NOT call Google. The payload is returned so the
    // approver and the audit row can show precisely what would have been sent.
    return {
      ok: true,
      dryRun: true,
      range: range,
      spreadsheetId: spreadsheetId,
      value: value,
      message: 'Dry run: resolved ' + range + ' but did not write. Set CHANGE_REQUEST_DRY_RUN=false to enable writes.'
    };
  }

  const token = await require('./sync-sheet').accessToken_();
  if (!token) return { ok: false, message: 'No Google write credential is configured on the server.' };

  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId +
    '/values/' + encodeURIComponent(range) + '?valueInputOption=USER_ENTERED';
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range: range, majorDimension: 'ROWS', values: [[value]] }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const json = await resp.json().catch(function () { return {}; });
  if (!resp.ok) {
    const msg = (json && json.error && json.error.message) || ('HTTP ' + resp.status);
    return { ok: false, message: 'Sheet write failed for ' + range + ': ' + msg, range: range };
  }
  // The sheet just changed, so any cached description of it is now suspect.
  structureCache_.delete(spreadsheetId);
  return { ok: true, dryRun: false, range: range, spreadsheetId: spreadsheetId, value: value };
}

/* In-process cache of tab/header structure, keyed by spreadsheet id. Opening the
   change-request form reads the sheet so the requester is offered real tabs and
   column names; without this, every open paid for it again. Entries expire so a
   renamed column or added tab is picked up, and a write drops the entry outright
   because the sheet it describes has just changed. */
const structureCache_ = new Map();

function structureCacheGet_(spreadsheetId) {
  const hit = structureCache_.get(spreadsheetId);
  if (!hit) return null;
  if (Date.now() - hit.at > SHEET_STRUCTURE_CACHE_TTL_MS) {
    structureCache_.delete(spreadsheetId);
    return null;
  }
  return hit.value;
}

function structureCacheSet_(spreadsheetId, value) {
  structureCache_.set(spreadsheetId, { at: Date.now(), value: value });
  // Bound the map so a long-lived process cannot grow it without limit.
  if (structureCache_.size > 200) {
    const oldest = Array.from(structureCache_.entries())
      .sort(function (a, b) { return a[1].at - b[1].at; })
      .slice(0, structureCache_.size - 200);
    oldest.forEach(function (e) { structureCache_.delete(e[0]); });
  }
}

/* Runs `fn` over `items` with at most `limit` in flight, preserving order. The
   old sequential loop made the form's load time scale with the tab count. */
async function mapWithConcurrency_(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(Number(limit) || 1, items.length));
  const workers = [];
  for (let i = 0; i < n; i++) workers.push(worker());
  await Promise.all(workers);
  return out;
}

/**
 * Describe a record's linked sheet so the request form can offer real choices
 * instead of asking a user to type a tab name and a column header from memory:
 * every tab with its header row and its current extent.
 *
 * Read-only. Needs the write credential because it authenticates with the same
 * token the write does.
 *
 * Cost matters here: this runs the moment a user opens the form. It is one
 * metadata call plus one header read per tab, the header reads run
 * concurrently, and the whole answer is cached briefly, so a repeat open is
 * instant.
 */
async function getSheetStructure(sheetUrl) {
  const spreadsheetId = sheetIdFromUrl_(sheetUrl);
  if (!spreadsheetId) return { ok: false, reason: 'That link is not a Google Sheets URL.' };
  const cached = structureCacheGet_(spreadsheetId);
  if (cached) return { ok: true, spreadsheetId: spreadsheetId, tabs: cached, cached: true };
  if (!writeCredentialPresent_()) {
    return { ok: false, reason: 'No Google credential is configured on the server, so linked sheets cannot be read or changed.' };
  }
  const token = await require('./sync-sheet').accessToken_();
  if (!token) return { ok: false, reason: 'No Google credential is configured on the server.' };

  const meta = await readSheetMeta_(spreadsheetId, token);
  const scanned = await mapWithConcurrency_(meta, SHEET_STRUCTURE_FETCH_CONCURRENCY, async function (tab) {
    let headers = [];
    let headerRow = 1;
    try {
      const top = await readTopRows_(spreadsheetId, tab.title, token, HEADER_SCAN_ROWS);
      // The header row is the first of the top rows that actually looks like
      // headers (two or more named cells). A title row has one cell and is
      // skipped, so the requester is offered real column names.
      for (let r = 0; r < top.length; r++) {
        const named = top[r].filter(function (c) { return String(c || '').trim() !== ''; });
        if (named.length >= 2) {
          headers = named;
          headerRow = r + 1;
          break;
        }
      }
    } catch (e) { headers = []; }
    return {
      title: tab.title,
      headers: headers,
      headerRow: headerRow,
      rowCount: tab.rowCount
    };
  });

  structureCacheSet_(spreadsheetId, scanned);
  return { ok: true, spreadsheetId: spreadsheetId, tabs: scanned };
}

function dryRunEnabled() { return DRY_RUN; }

module.exports = {
  sheetIdFromUrl: sheetIdFromUrl_,
  writeCredentialPresent: writeCredentialPresent_,
  dryRunEnabled: dryRunEnabled,
  getSheetStructure: getSheetStructure,
  resolveTarget: resolveTarget,
  writeCell: writeCell,
  __test: {
    listTabs: listTabs_,
    matchTab: matchTab_,
    sheetIdFromUrl: sheetIdFromUrl_,
    readSheetMeta: readSheetMeta_,
    rowCountFor: rowCountFor_,
    mapWithConcurrency: mapWithConcurrency_
  }
};

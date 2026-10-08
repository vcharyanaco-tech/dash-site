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

const DRY_RUN = String(process.env.CHANGE_REQUEST_DRY_RUN || '').toLowerCase() === 'true';
const REQUEST_TIMEOUT_MS = 15000;

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

/** List the tab titles of a spreadsheet: ['Sheet1', 'Data', ...]. */
async function listTabs_(spreadsheetId, token) {
  const meta = await sheetsGet_(spreadsheetId, token, 'sheets.properties(title)');
  return (meta.sheets || []).map(function (s) {
    return s && s.properties ? String(s.properties.title || '') : '';
  }).filter(function (t) { return !!t; });
}

/** Case-insensitive tab lookup; returns the sheet's real title (needed verbatim
 *  for A1 quoting) or '' when absent. */
function matchTab_(tabs, wanted) {
  const key = function (v) { return String(v || '').trim().toLowerCase(); };
  const want = key(wanted);
  for (let i = 0; i < tabs.length; i++) {
    if (key(tabs[i]) === want) return tabs[i];
  }
  return '';
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

/** Row extent of a tab, so a typo'd row can be refused instead of growing the
 *  sheet (Sheets accepts a write past the end and creates the row). */
async function readRowCount_(spreadsheetId, tabTitle, token) {
  const meta = await sheetsGet_(spreadsheetId, token, 'sheets.properties(title,gridProperties.rowCount)');
  const hit = (meta.sheets || []).find(function (s) {
    return s && s.properties && String(s.properties.title || '') === String(tabTitle);
  });
  return hit && hit.properties && hit.properties.gridProperties
    ? Number(hit.properties.gridProperties.rowCount) || 0
    : 0;
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

  const tabs = await listTabs_(spreadsheetId, token);
  const tab = matchTab_(tabs, opts.tabName);
  if (!tab) {
    return {
      ok: false,
      reason: 'Tab "' + String(opts.tabName || '') + '" is not in this sheet.' +
        (tabs.length ? ' Available: ' + tabs.join(', ') + '.' : ' The sheet has no tabs.')
    };
  }

  const headerRows = await readTopRows_(spreadsheetId, tab, token, 10);
  const located = require('./sheet-target').findHeaderInTopRows_(headerRows, opts.headerName, 10);
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

  const rowCount = await readRowCount_(spreadsheetId, tab, token);
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
  return { ok: true, dryRun: false, range: range, spreadsheetId: spreadsheetId, value: value };
}

/**
 * Describe a record's linked sheet so the request form can offer real choices
 * instead of asking a user to type a tab name and a column header from memory:
 * every tab with its header row and its current extent.
 *
 * Read-only. Needs the write credential because it authenticates with the same
 * token the write does.
 */
async function getSheetStructure(sheetUrl) {
  const spreadsheetId = sheetIdFromUrl_(sheetUrl);
  if (!spreadsheetId) return { ok: false, reason: 'That link is not a Google Sheets URL.' };
  if (!writeCredentialPresent_()) {
    return { ok: false, reason: 'No Google credential is configured on the server, so linked sheets cannot be read or changed.' };
  }
  const token = await require('./sync-sheet').accessToken_();
  if (!token) return { ok: false, reason: 'No Google credential is configured on the server.' };

  const tabs = [];
  const titles = await listTabs_(spreadsheetId, token);
  for (let i = 0; i < titles.length; i++) {
    let headers = [];
    let rowCount = 0;
    let headerRow = 1;
    try {
      const top = await readTopRows_(spreadsheetId, titles[i], token, 10);
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
    try { rowCount = await readRowCount_(spreadsheetId, titles[i], token); } catch (e) { rowCount = 0; }
    tabs.push({
      title: titles[i],
      headers: headers,
      headerRow: headerRow,
      rowCount: rowCount
    });
  }
  return { ok: true, spreadsheetId: spreadsheetId, tabs: tabs };
}

function dryRunEnabled() { return DRY_RUN; }

module.exports = {
  sheetIdFromUrl: sheetIdFromUrl_,
  writeCredentialPresent: writeCredentialPresent_,
  dryRunEnabled: dryRunEnabled,
  getSheetStructure: getSheetStructure,
  resolveTarget: resolveTarget,
  writeCell: writeCell,
  __test: { listTabs: listTabs_, matchTab: matchTab_, sheetIdFromUrl: sheetIdFromUrl_ }
};

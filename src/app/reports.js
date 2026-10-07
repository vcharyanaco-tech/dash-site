
/* ---------------------------------- Reports ---------------------------------- */

// Must match LINK_PRINT_MAX_ROWS in src/server/config.js. Used only to word the
// "showing first N rows" note; the server is what actually truncates.
const LINK_PRINT_ROWS_SHOWN = 15;

function renderReportPreview() {
  const wrap = getEl('reportPreview');
  if (!wrap) return;
  const templateKey = getEl('reportTemplate') ? getEl('reportTemplate').value : 'summary';
  let items = appState.items || [];
  if (templateKey === 'flagged') items = items.filter(function (i) { return i.flagged; });
  const itemsHtml = items.map(function (item) {
    return `
      <tr>
        <td class="preserve-whitespace">${escapeHtml(item.id)}</td>
        <td class="preserve-whitespace">${renderLinkableText(item.sector)}</td>
        <td class="preserve-whitespace">${renderLinkableText(item.description)}</td>
        <td class="preserve-whitespace">${item.actionHtml || renderLinkableText(item.action)}</td>
        <td class="preserve-whitespace">${renderLinkableText(item.responsibility)}</td>
        <td class="preserve-whitespace">${renderLinkableText(item.reviewDate)}</td>
      </tr>`;
  }).join('');
  wrap.innerHTML = `
    <h3>Report preview (${templateKey})</h3>
    <div class="report-preview-scroll">
      <table class="data-table">
        <thead><tr><th>#</th><th>Sector</th><th>Description</th><th>Action</th><th>Responsibility</th><th>Review</th></tr></thead>
        <tbody>${itemsHtml || '<tr><td colspan="6">No records to report.</td></tr>'}</tbody>
      </table>
    </div>`;
}

function downloadReportCsv() {
  const headers = ['#', 'Sector', 'Description', 'Entry Date', 'Action', 'Responsibility', 'Review Date', 'Flagged'];
  const rows = (appState.items || []).map(function (item) {
    return [item.id, item.sector, item.description, item.entryDate, item.action, item.responsibility, item.reviewDate, item.flagged ? 'YES' : 'NO'];
  });
  downloadTextFile('IndiaPostDashboard_Report_' + new Date().toISOString().slice(0, 10) + '.csv', toCsv([headers].concat(rows)), 'text/csv;charset=utf-8');
  showToast('Report CSV downloaded', 'success');
}

function openPrintWindow(html) {
  const win = window.open('', '_blank', 'width=980,height=720');
  if (!win) { showToast('Pop-up blocked. Please allow pop-ups to print.', 'error'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function buildPrintPage(opts) {
  const title = opts.title || (appState.settings.appName || 'India Post Dashboard');
  const now = new Date().toLocaleString();
  const subtitle = opts.subtitle ? ' &middot; ' + escapeHtml(opts.subtitle) : '';
  const initialOrient = opts.landscape ? 'landscape' : 'portrait';
  // about:blank print windows inherit this page's CSP including its nonce, so
  // the inline script below must carry the same value (see pageCspNonce).
  const cspNonce = pageCspNonce();
  const scriptNonce = cspNonce ? ' nonce="' + cspNonce + '"' : '';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; font-size: 13px; line-height: 1.3; }
  .print-toolbar {
    display: flex; align-items: center; gap: 10px;
    position: sticky; top: 0; z-index: 10;
    background: #eef3ef; border-bottom: 1px solid #d1d5db;
    padding: 10px 14px; margin-bottom: 18px;
  }
  .print-toolbar .toolbar-title { font-weight: 600; color: #1f5c2e; margin-right: 4px; }
  .print-toolbar button {
    border: 1px solid #1f5c2e; background: #fff; color: #1f5c2e;
    padding: 6px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .print-toolbar button.active { background: #1f5c2e; color: #fff; }
  .print-toolbar .print-btn { background: #1f5c2e; color: #fff; margin-left: auto; }
  .print-toolbar label.print-toggle { color: #1f5c2e; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; }
  /* A fetched sheet table can be taller than a page, so this block must be
     allowed to break. Rows are kept atomic instead (see tr below). */
  .print-links-block { break-inside: auto; page-break-inside: auto; }
  body.no-links .print-links-block { display: none !important; }
  .print-links-block h4 { margin: 6px 0 2px; font-size: 12px; color: #1f5c2e; }
  .print-links-block .sheet-note { margin: 0 0 4px; color: #6b7280; font-size: 10.5px; font-style: italic; }
  .print-links-block .sheet-table { width: 100%; border-collapse: collapse; margin: 0 0 4px; }
  .print-links-block .sheet-table th, .print-links-block .sheet-table td {
    border: 1px solid #d1d5db; padding: 2px 4px; font-size: 10.5px;
    line-height: 1.25; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word;
  }
  .print-links-block .sheet-table th { background: #e3ece6; color: #1f5c2e; font-weight: 600; }
  .print-links-block .sheet-table tr { break-inside: avoid; page-break-inside: avoid; }
  @media print { .print-toolbar { display: none; } }
  .report-header { border-bottom: 2px solid #1f5c2e; padding-bottom: 5px; margin-bottom: 8px; }
  .report-header h1 { margin: 0; font-size: 16px; color: #1f5c2e; letter-spacing: 0.2px; }
  .report-header .meta { margin-top: 3px; color: #6b7280; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 3px 5px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.3; }
  th { background: #1f5c2e; color: #fff; font-weight: 600; white-space: normal; font-size: 12px; letter-spacing: 0.2px; }
  td.num { white-space: nowrap; }
  tr:nth-child(even) td { background: #f9fafb; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  /* A 7-column grid has no usable room on a 210mm portrait page, so portrait
     restacks each record into a label/value card rather than squeezing columns.
     Short fields pair up two-per-row; the prose fields (td.wide) span the full
     card width so long text keeps a usable measure. The wide table keeps its
     natural 7-column grid in landscape. */
  body.portrait .wide-report thead { display: none; }
  body.portrait .wide-report, body.portrait .wide-report tbody { display: block; width: 100%; }
  body.portrait .wide-report tr {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px;
    border: 1px solid #d1d5db; border-radius: 6px;
    padding: 3px 9px; margin: 0 0 6px; background: #fff;
  }
  body.portrait .wide-report td {
    display: grid; grid-template-columns: 34% 1fr; gap: 6px;
    border: none; border-bottom: 1px dotted #e5e7eb;
    padding: 2px 0; background: none;
  }
  body.portrait .wide-report td.wide { grid-column: 1 / -1; }
  body.portrait .wide-report td::before { content: attr(data-label); font-weight: 600; color: #1f5c2e; font-size: 11.5px; }
  .empty { text-align: center; color: #6b7280; padding: 14px 10px; font-size: 13px; }
  .sub-block { background: #f3f7f4; border-left: 4px solid #1f5c2e; margin-top: 5px; padding: 6px 9px; }
  .record-print-block { border: 1px solid #d1d5db; border-radius: 6px; padding: 6px 9px; margin: 0 0 6px; break-inside: avoid; page-break-inside: avoid; }
  .record-print-block .fields-table { margin: 0; }
  .sub-block h2, .sub-block h4 { margin: 0 0 4px; font-size: 12px; color: #1f5c2e; }
  .sub-item { padding: 3px 0; border-bottom: 1px dotted #d1d5db; }
  .sub-item:last-child { border-bottom: none; }
  .sub-meta { color: #6b7280; font-size: 10.5px; margin-bottom: 2px; }
  /* Density: authored hard line breaks are collapsed to flowing text. Keeping
     pre-wrap here was the single largest source of page bloat — every preserved
     newline costs a full line box per row. */
  .preserve-whitespace { white-space: normal; }
  .report-footer { margin-top: 10px; padding-top: 5px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 10.5px; }
  #pageRule { display: none; }
</style>
</head>
<body class="${initialOrient}">
  <div class="print-toolbar">
    <span class="toolbar-title">Print layout</span>
    <button type="button" id="btnOrientV" class="${initialOrient === 'portrait' ? 'active' : ''}" onclick="setOrient('portrait')">Vertical</button>
    <button type="button" id="btnOrientH" class="${initialOrient === 'landscape' ? 'active' : ''}" onclick="setOrient('landscape')">Horizontal</button>
    <label class="print-toggle" title="Include the hyperlink data table on each record"><input type="checkbox" id="toggleLinks" checked onchange="toggleLinks(this.checked)"> Include hyperlink data</label>
    <button type="button" class="print-btn" onclick="doPrint()">Print</button>
  </div>
  <style id="pageRule">@page { size: ${opts.landscape ? '297mm 210mm' : '210mm 297mm'}; margin: 9mm; }</style>
  <div class="report-header">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated ${escapeHtml(now)}${subtitle}</div>
  </div>
  ${opts.body}
  <div class="report-footer">India Post Dashboard &middot; Circle Office Haryana</div>
  <script${scriptNonce}>
    function setOrient(o) {
      // Explicit dimensions rather than the "A4 landscape" keyword: only
      // Chromium honours the named+orientation form, whereas <length>{2} is
      // portable. 297mm x 210mm is A4 landscape, 210mm x 297mm is A4 portrait.
      var dims = o === 'landscape' ? '297mm 210mm' : '210mm 297mm';
      document.getElementById('pageRule').textContent = '@page { size: ' + dims + '; margin: 9mm; }';
      document.body.classList.toggle('portrait', o === 'portrait');
      document.body.classList.toggle('landscape', o === 'landscape');
      document.getElementById('btnOrientV').classList.toggle('active', o === 'portrait');
      document.getElementById('btnOrientH').classList.toggle('active', o === 'landscape');
    }
    function toggleLinks(on) {
      document.body.classList.toggle('no-links', !on);
    }
    function doPrint() {
      window.focus();
      setTimeout(function () { window.print(); }, 60);
    }
  <\/script>
</body>
</html>`;
}

/* Hyperlink data table for print: a compact Field / Link text / URL table
   drawn from item.links (per-field array form) with a fallback to the legacy
   linkUrls/linkTexts shape. Returns '' when the record has no links. */
function printLinksHtml_(item, sheetData) {
  const labelFor = function (key) {
    const map = { action: 'Action', description: 'Description', sector: 'Sector', entryDate: 'Entry Date', responsibility: 'Responsibility', reviewDate: 'Review Date', lastMeetingInstructions: 'Last meeting instructions' };
    return map[key] || String(key || '').replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); });
  };
  const rows = [];
  const links = (item && item.links) || {};
  Object.keys(links).forEach(function (key) {
    const list = links[key];
    if (Array.isArray(list)) {
      list.forEach(function (l) {
        if (l && l.url) rows.push({ label: labelFor(key), text: (l.text || l.url), url: l.url });
      });
    } else if (list && list.url) {
      rows.push({ label: labelFor(key), text: (list.text || list.url), url: list.url });
    }
  });
  if (!rows.length) {
    const urls = (item && item.linkUrls) || {};
    const texts = (item && item.linkTexts) || {};
    Object.keys(urls).forEach(function (key) {
      rows.push({ label: labelFor(key), text: ((texts && texts[key]) || urls[key]), url: urls[key] });
    });
  }
  // The link table is always emitted (it is what the checkbox has always
  // toggled); the fetched spreadsheet table rides inside the same block so the
  // existing 'no-links' class hides both in one go.
  let sheetHtml = '';
  if (sheetData && sheetData.available === true && sheetData.rows && sheetData.rows.length) {
    const header = sheetData.rows[0];
    const body = sheetData.rows.slice(1);
    const cols = header.length;
    const grid = function (cells, tag) {
      return '<' + tag + '>' + header.map(function (_, ci) {
        return '<th>' + escapeHtml(String(cells[ci] === undefined || cells[ci] === null ? '' : cells[ci])) + '</th>';
      }).join('') + '</' + tag + '>';
    };
    sheetHtml = `<h4>Linked sheet contents</h4>
      <p class="sheet-note">${cols} column${cols === 1 ? '' : 's'} &middot; from the record's linked Google Sheet` +
      (sheetData.truncated ? ` &middot; showing first ${LINK_PRINT_ROWS_SHOWN} of ${escapeHtml(String(sheetData.rowTotal))} rows` : '') +
      `</p>
      <table class="sheet-table"><thead>${grid(header, 'tr')}</thead><tbody>${
        body.length ? body.map(function (r) { return grid(r, 'tr'); }).join('') : '<tr><td colspan="' + cols + '">No data rows.</td></tr>'
      }</tbody></table>
      ${sheetData.truncated ? '<p class="sheet-note">Remaining rows are not shown &mdash; open the linked sheet for the full table.</p>' : ''}`;
  } else if (sheetData && sheetData.available === false && sheetData.reason === 'unreadable') {
    sheetHtml = '<h4>Linked sheet contents</h4><p class="sheet-note">Not printed: the linked sheet could not be read. Sheets must be shared &ldquo;anyone with the link&rdquo;.</p>';
  } else if (sheetData && sheetData.available === false && sheetData.reason === 'not-a-sheet') {
    sheetHtml = '<h4>Linked sheet contents</h4><p class="sheet-note">Not printed: this record links a file that is not a Google Sheet.</p>';
  }
  if (!rows.length && !sheetHtml) return '';
  return `<div class="print-links-block"><h2 style="margin:12px 0 6px;font-size:14px;color:#1f5c2e;">Hyperlinks</h2><div class="sub-block">${
    rows.length ? `<table style="margin:0"><thead><tr><th style="width:22%">Field</th><th style="width:58%">Link text</th><th>URL</th></tr></thead><tbody>
      ${rows.map(function (r) {
        const href = linkableHref(r.url);
        return '<tr><td>' + escapeHtml(r.label) + '</td><td>' + escapeHtml(r.text) + '</td><td>' + (href
          ? '<a href="' + escAttr(href) + '" target="_blank" rel="noopener">' + escapeHtml(r.url) + '</a>'
          : escapeHtml(r.url)) + '</td></tr>';
      }).join('')}
    </tbody></table>` : ''
  }${sheetHtml}</div></div>`;
}

function groupSubmissionsByCard_(list) {
  const map = {};
  (list || []).forEach(function (s) {
    const key = Number(s.cardRow);
    if (!map[key]) map[key] = [];
    map[key].push(s);
  });
  return map;
}

function countSubmissions_(map) {
  let n = 0;
  Object.keys(map || {}).forEach(function (k) { n += map[k].length; });
  return n;
}

function printCard(row, includeSubmissions) {
  const item = (appState.items || []).find(function (x) { return Number(x.row) === Number(row); });
  if (!item) { showToast('Record not found.', 'error'); return; }
  const useSubs = includeSubmissions === true;

  const build = function (subs, sheetMap) {
    const fields = (item.displayFields || []).map(function (field) {
      const label = String(field && field.label || '').trim();
      const value = field.html ? sanitizeFieldHtml_(field.html) : escapeHtml(field.value);
      return `
        <tr>
          <th style="width:32%">${escapeHtml(label || 'Value')}</th>
          <td class="preserve-whitespace">${value}</td>
        </tr>`;
    }).join('');

    const subsHtml = (subs && subs.length) ? `
      <h2 style="margin:20px 0 10px;font-size:16px;color:#1f5c2e;">Submissions (${subs.length})</h2>
      <div class="sub-block">
        ${subs.map(function (s) {
          return `
          <div class="sub-item">              <div class="sub-meta">${escapeHtml(s.email)} &middot; ${escapeHtml(formatTimestamp(s.createdAt))}</div>
            <div class="preserve-whitespace">${escapeHtml(s.text || '')}</div>
          </div>`;
        }).join('')}
      </div>` : '';

    openPrintWindow(buildPrintPage({
      title: (appState.settings.appName || 'India Post Dashboard') + ' - Record #' + item.id,
      subtitle: (useSubs ? 'with submissions' : 'without submissions') + ' &middot; Record #' + item.id + (item.sector ? ' &middot; ' + item.sector : ''),
      body: `<div class="record-print-block"><table class="fields-table">
        <tbody>${fields || '<tr><td colspan="2" class="empty">No details available.</td></tr>'}</tbody>
      </table>${printLinksHtml_(item, (sheetMap || {})[String(item.row)])}${subsHtml}</div>`
    }));
  };

  const withSheets = function (subList) {
    showOverlay('Fetching linked sheet data…');
    fetchSheetTablesForPrint_([item]).then(function (map) {
      hideOverlay();
      build(subList, map);
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not fetch linked sheets: ' + ((err && err.message) || err), 'error');
      build(subList, null);
    });
  };

  if (useSubs) {
    showOverlay('Preparing print…');
    ApiService.getSubmissions(Number(row)).then(function (list) {
      hideOverlay();
      withSheets(list || []);
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not load submissions: ' + (err.message || err), 'error');
    });
  } else {
    withSheets([]);
  }
}

/* True when the record carries at least one hyperlink in either the per-field
   links array or the legacy linkUrls projection. Used to skip pointless
   server round-trips for records that have nothing to fetch. */
function itemHasLinks_(item) {
  if (!item) return false;
  const links = item.links || {};
  const keys = Object.keys(links);
  for (let i = 0; i < keys.length; i++) {
    const v = links[keys[i]];
    if (Array.isArray(v) ? v.some(function (l) { return l && l.url; }) : (v && v.url)) return true;
  }
  return Object.keys(item.linkUrls || {}).length > 0;
}

/* Fetches the real table behind each record's linked Google Sheet, for records
   that have one, at bounded concurrency. Resolves to a map row -> sheet data,
   or null when the report-level "include linked sheet data" box is unticked.

   A sheet that is private or unreachable resolves to available:false rather
   than throwing, and a single failed request never sinks the whole report. */
function fetchSheetTablesForPrint_(items) {
  const box = getEl('includeSheetTables');
  if (!box || box.checked !== true) return Promise.resolve(null);
  const targets = (items || []).filter(function (i) { return itemHasLinks_(i); });
  const map = {};
  if (!targets.length) return Promise.resolve(map);
  const laneCount = Math.min(4, targets.length);
  let next = 0;
  const worker = function () {
    if (next >= targets.length) return Promise.resolve();
    const item = targets[next++];
    return ApiService.getLinkPrintContent(Number(item.row)).then(function (data) {
      if (data && data.success === true) map[String(item.row)] = data;
    }).catch(function () {
      /* leave this record without a sheet table */
    }).then(worker);
  };
  const lanes = [];
  for (let i = 0; i < laneCount; i++) lanes.push(worker());
  return Promise.all(lanes).then(function () { return map; });
}

/* Print a report of the records. scope: 'all' (every record, the full
   appState.items set) or 'visible' (the current search/sector/review-filtered
   and sorted list, exactly what the dashboard shows). */
function printReport(scope, includeSubmissions) {
  const useSubs = includeSubmissions === true;
  const items = scope === 'visible' ? sortedItems() : (appState.items || []).slice();
  const scopeLabel = scope === 'visible' ? 'visible records' : 'all records';

  const run = function (subMap, sheetMap) {
    let bodyHtml = '';
    const sheetFor = function (item) { return (sheetMap || {})[String(item.row)]; };
    if (!items.length) {
      bodyHtml = '<div class="empty">No records to report.</div>';
    } else if (useSubs) {
      bodyHtml = items.map(function (item) {
        const subs = (subMap && subMap[Number(item.row)]) || [];
        const subsHtml = subs.length ? `
          <div class="sub-block">
            <h4>Submissions (${subs.length})</h4>
            ${subs.map(function (s) {
              return `<div class="sub-item"><div class="sub-meta">${escapeHtml(s.email)} &middot; ${escapeHtml(formatTimestamp(s.createdAt))}</div><div class="preserve-whitespace">${escapeHtml(s.text || '')}</div></div>`;
            }).join('')}
          </div>` : '';
        return `<div class="record-print-block"><table class="fields-table"><tbody>
          <tr><th style="width:18%">#</th><td>${escapeHtml(item.id)}</td></tr>
          <tr><th>Sector</th><td>${escapeHtml(item.sector)}</td></tr>
          <tr><th>Description</th><td class="preserve-whitespace">${escapeHtml(item.description)}</td></tr>
          <tr><th>Action</th><td class="preserve-whitespace">${item.actionHtml || renderLinkableText(item.action || '')}</td></tr>
          <tr><th>Last Meeting Instructions</th><td class="preserve-whitespace">${escapeHtml(item.lastMeetingInstructions || '')}</td></tr>
          <tr><th>Responsibility</th><td>${escapeHtml(item.responsibility)}</td></tr>
          <tr><th>Review</th><td>${escapeHtml(item.reviewDate)}</td></tr>
        </tbody></table>${printLinksHtml_(item, sheetFor(item))}${subsHtml}</div>`;
      }).join('');
    } else {
      const rowsHtml = items.map(function (item) {
        return `<tr><td class="num" data-label="#">${escapeHtml(item.id)}</td><td data-label="Sector">${escapeHtml(item.sector)}</td><td class="wide" data-label="Description">${escapeHtml(item.description)}</td><td class="preserve-whitespace wide" data-label="Action">${item.actionHtml || renderLinkableText(item.action || '')}</td><td class="preserve-whitespace wide" data-label="Last Meeting Instructions">${escapeHtml(item.lastMeetingInstructions || '')}</td><td data-label="Responsibility">${escapeHtml(item.responsibility)}</td><td data-label="Review">${escapeHtml(item.reviewDate)}</td></tr>`;
      }).join('');
      bodyHtml = `<table class="wide-report"><thead><tr><th>#</th><th>Sector</th><th>Description</th><th>Action</th><th>Last Meeting Instructions</th><th>Responsibility</th><th>Review</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
      // A table cell cannot hold a block-level sheet table, so the link/sheet
      // sections for the wide landscape report are appended after the grid.
      // printLinksHtml_ returns '' for records with neither, so this only
      // emits for records that actually have link data.
      bodyHtml += items.map(function (item) {
        return printLinksHtml_(item, sheetFor(item));
      }).join('');
    }
    const count = items.length;
    const subCount = useSubs ? countSubmissions_(subMap) : 0;
    const subtitle = (scopeLabel + ' &middot; ' + (useSubs
      ? count + ' record' + (count === 1 ? '' : 's') + ' with submissions (' + subCount + ')'
      : count + ' record' + (count === 1 ? '' : 's') + ' without submissions'));

    openPrintWindow(buildPrintPage({
      title: (appState.settings.appName || 'India Post Dashboard') + ' - Report',
      landscape: true,
      subtitle: subtitle,
      body: bodyHtml
    }));
  };

  const withSheets = function (subMap) {
    showOverlay('Fetching linked sheet data…');
    fetchSheetTablesForPrint_(items).then(function (map) {
      hideOverlay();
      run(subMap, map);
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not fetch linked sheets: ' + ((err && err.message) || err), 'error');
      // Still print: a missing sheet table must not block the report itself.
      run(subMap, null);
    });
  };

  if (useSubs) {
    showOverlay('Preparing report…');
    ApiService.getSubmissions().then(function (list) {
      hideOverlay();
      withSheets(groupSubmissionsByCard_(list || []));
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not load submissions: ' + (err.message || err), 'error');
    });
  } else {
    withSheets(null);
  }
}

function downloadFromBase64(base64, filename, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'IndiaPostDashboard_Report';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

function exportSpreadsheet() {
  showOverlay('Exporting Excel file…');
  ApiService.exportToSpreadsheet().then(function (result) {
    hideOverlay();
    if (result && result.base64) {
      downloadFromBase64(result.base64, result.filename || 'IndiaPostDashboard_Report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      showToast('Excel file downloaded', 'success');
    } else {
      showToast('Excel export failed', 'error');
    }
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Excel export failed: ' + (err.message || err), 'error');
  });
}

function downloadPdf() {
  showOverlay('Generating PDF…');
  ApiService.createPdfReport().then(function (result) {
    hideOverlay();
    if (result && result.base64) {
      downloadFromBase64(result.base64, result.filename || 'IndiaPostDashboard_Report.pdf', 'application/pdf');
      showToast('PDF downloaded', 'success');
    } else {
      showToast('PDF export failed', 'error');
    }
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('PDF export failed: ' + (err.message || err), 'error');
  });
}

/* ---------------------------------- Email report ---------------------------------- */

function openEmailReportDialog() {
  const templateSelect = getEl('reportTemplate');
  const emailTemplate = getEl('emailReportTemplate');
  if (templateSelect && emailTemplate) emailTemplate.value = templateSelect.value;
  const recipient = getEl('emailReportRecipient');
  const user = appState.user || {};
  if (recipient && !recipient.value && user.email) recipient.value = user.email;
  getEl('emailReportStatus').textContent = '';
  openDialog('emailReportModal');
}

function closeEmailReportDialog() {
  closeDialog('emailReportModal');
}

function sendEmailReport() {
  const recipient = (getEl('emailReportRecipient').value || '').trim();
  const templateKey = (getEl('emailReportTemplate') ? getEl('emailReportTemplate').value : 'summary') || 'summary';
  const status = getEl('emailReportStatus');
  const sendBtn = getEl('emailReportSendBtn');
  if (!recipient) {
    status.textContent = 'Enter a recipient email address.';
    status.classList.add('error');
    return;
  }
  status.textContent = '';
  status.classList.remove('error');
  if (sendBtn) sendBtn.disabled = true;
  showOverlay('Sending report by email…');
  ApiService.emailReport(recipient, templateKey).then(function (result) {
    hideOverlay();
    if (sendBtn) sendBtn.disabled = false;
    closeEmailReportDialog();
    showToast('Report sent to ' + result.sentTo, 'success');
  }).catch(function (err) {
    hideOverlay();
    if (sendBtn) sendBtn.disabled = false;
    if (handleServerFailure(err)) return;
    status.textContent = 'Failed to send: ' + (err.message || err);
    status.classList.add('error');
  });
}

/* ---------------------------------- Email all users (broadcast) ---------------------------------- */

function openEmailAllUsersDialog() {
  const subjectEl = getEl('emailAllUsersSubject');
  const bodyEl = getEl('emailAllUsersBody');
  if (subjectEl) subjectEl.value = '';
  if (bodyEl) bodyEl.value = '';
  getEl('emailAllUsersStatus').textContent = '';
  getEl('emailAllUsersStatus').classList.remove('error', 'success');
  openDialog('emailAllUsersModal');
}

function closeEmailAllUsersDialog() {
  closeDialog('emailAllUsersModal');
}

function sendEmailAllUsers() {
  const subject = (getEl('emailAllUsersSubject').value || '').trim();
  const body = (getEl('emailAllUsersBody').value || '').trim();
  const status = getEl('emailAllUsersStatus');
  const sendBtn = getEl('emailAllUsersSendBtn');
  if (!subject) {
    status.textContent = 'Enter a subject.';
    status.classList.add('error');
    return;
  }
  if (!body) {
    status.textContent = 'Enter a message body.';
    status.classList.add('error');
    return;
  }
  status.textContent = '';
  status.classList.remove('error');
  if (sendBtn) sendBtn.disabled = true;
  showOverlay('Sending to all users…');
  ApiService.adminEmailAllUsers(subject, body).then(function (result) {
    hideOverlay();
    if (sendBtn) sendBtn.disabled = false;
    closeEmailAllUsersDialog();
    showToast('Email sent to ' + result.sent + ' user(s)', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (sendBtn) sendBtn.disabled = false;
    if (handleServerFailure(err)) return;
    status.textContent = 'Failed to send: ' + (err.message || err);
    status.classList.add('error');
  });
}

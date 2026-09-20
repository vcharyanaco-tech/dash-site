
/* ---------------------------------- Reports ---------------------------------- */

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
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; font-size: 14px; line-height: 1.6; }
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
  .print-links-block { break-inside: avoid; page-break-inside: avoid; }
  body.no-links .print-links-block { display: none !important; }
  @media print { .print-toolbar { display: none; } }
  .report-header { border-bottom: 3px solid #1f5c2e; padding-bottom: 14px; margin-bottom: 20px; }
  .report-header h1 { margin: 0; font-size: 26px; color: #1f5c2e; letter-spacing: 0.2px; }
  .report-header .meta { margin-top: 8px; color: #6b7280; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.55; }
  th { background: #1f5c2e; color: #fff; font-weight: 600; white-space: nowrap; font-size: 13.5px; letter-spacing: 0.2px; }
  td.num { white-space: nowrap; }
  tr:nth-child(even) td { background: #f9fafb; }
  .empty { text-align: center; color: #6b7280; padding: 28px 16px; font-size: 14px; }
  .sub-block { background: #f3f7f4; border-left: 4px solid #1f5c2e; margin-top: 10px; padding: 14px 16px; }
  .record-print-block { border: 1px solid #d1d5db; border-radius: 8px; padding: 14px 16px; margin: 0 0 14px; break-inside: avoid; page-break-inside: avoid; }
  .record-print-block .fields-table { margin: 0; }
  .sub-block h2, .sub-block h4 { margin: 0 0 10px; font-size: 14px; color: #1f5c2e; }
  .sub-item { padding: 8px 0; border-bottom: 1px dotted #d1d5db; }
  .sub-item:last-child { border-bottom: none; }
  .sub-meta { color: #6b7280; font-size: 12px; margin-bottom: 4px; }
  .preserve-whitespace { white-space: pre-wrap; }
  .report-footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
  #pageRule { display: none; }
</style>
</head>
<body>
  <div class="print-toolbar">
    <span class="toolbar-title">Print layout</span>
    <button type="button" id="btnOrientV" class="${initialOrient === 'portrait' ? 'active' : ''}" onclick="setOrient('portrait')">Vertical</button>
    <button type="button" id="btnOrientH" class="${initialOrient === 'landscape' ? 'active' : ''}" onclick="setOrient('landscape')">Horizontal</button>
    <label class="print-toggle" title="Include the hyperlink data table on each record"><input type="checkbox" id="toggleLinks" checked onchange="toggleLinks(this.checked)"> Include hyperlink data</label>
    <button type="button" class="print-btn" onclick="doPrint()">Print</button>
  </div>
  <style id="pageRule">@page { size: ${opts.landscape ? 'A4 landscape' : 'A4 portrait'}; margin: 16mm; }</style>
  <div class="report-header">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated ${escapeHtml(now)}${subtitle}</div>
  </div>
  ${opts.body}
  <div class="report-footer">India Post Dashboard &middot; Circle Office Haryana</div>
  <script>
    function setOrient(o) {
      var rule = '@page { size: ' + (o === 'landscape' ? 'A4 landscape' : 'A4 portrait') + '; margin: 16mm; }';
      document.getElementById('pageRule').textContent = rule;
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
function printLinksHtml_(item) {
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
  if (!rows.length) return '';
  return `<div class="print-links-block"><h2 style="margin:20px 0 10px;font-size:16px;color:#1f5c2e;">Hyperlinks</h2><div class="sub-block">
    <table style="margin:0"><thead><tr><th style="width:22%">Field</th><th style="width:58%">Link text</th><th>URL</th></tr></thead><tbody>
      ${rows.map(function (r) {
        return '<tr><td>' + escapeHtml(r.label) + '</td><td>' + escapeHtml(r.text) + '</td><td><a href="' + escapeHtml(r.url) + '" target="_blank" rel="noopener">' + escapeHtml(r.url) + '</a></td></tr>';
      }).join('')}
    </tbody></table>
  </div></div>`;
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

  const build = function (subs) {
    const fields = (item.displayFields || []).map(function (field) {
      const label = String(field && field.label || '').trim();
      const value = field.html ? field.html : escapeHtml(field.value);
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
      </table>${printLinksHtml_(item)}${subsHtml}</div>`
    }));
  };

  if (useSubs) {
    showOverlay('Preparing print…');
    ApiService.getSubmissions(Number(row)).then(function (list) {
      hideOverlay();
      build(list || []);
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not load submissions: ' + (err.message || err), 'error');
    });
  } else {
    build([]);
  }
}

/* Print a report of the records. scope: 'all' (every record, the full
   appState.items set) or 'visible' (the current search/sector/review-filtered
   and sorted list, exactly what the dashboard shows). */
function printReport(scope, includeSubmissions) {
  const useSubs = includeSubmissions === true;
  const items = scope === 'visible' ? sortedItems() : (appState.items || []).slice();
  const scopeLabel = scope === 'visible' ? 'visible records' : 'all records';

  const run = function (subMap) {
    let bodyHtml = '';
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
        </tbody></table>${printLinksHtml_(item)}${subsHtml}</div>`;
      }).join('');
    } else {
      const rowsHtml = items.map(function (item) {
        return `<tr><td class="num">${escapeHtml(item.id)}</td><td>${escapeHtml(item.sector)}</td><td>${escapeHtml(item.description)}</td><td class="preserve-whitespace">${item.actionHtml || renderLinkableText(item.action || '')}</td><td class="preserve-whitespace">${escapeHtml(item.lastMeetingInstructions || '')}</td><td>${escapeHtml(item.responsibility)}</td><td>${escapeHtml(item.reviewDate)}</td></tr>`;
      }).join('');
      bodyHtml = `<table><thead><tr><th>#</th><th>Sector</th><th>Description</th><th>Action</th><th>Last Meeting Instructions</th><th>Responsibility</th><th>Review</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
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

  if (useSubs) {
    showOverlay('Preparing report…');
    ApiService.getSubmissions().then(function (list) {
      hideOverlay();
      run(groupSubmissionsByCard_(list || []));
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not load submissions: ' + (err.message || err), 'error');
    });
  } else {
    run(null);
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

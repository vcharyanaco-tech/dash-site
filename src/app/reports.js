
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
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: ${opts.landscape ? 'A4 landscape' : 'A4 portrait'}; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; font-size: 12px; }
  .report-header { border-bottom: 3px solid #1f5c2e; padding-bottom: 8px; margin-bottom: 12px; }
  .report-header h1 { margin: 0; font-size: 18px; color: #1f5c2e; }
  .report-header .meta { margin-top: 4px; color: #6b7280; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
  th { background: #1f5c2e; color: #fff; font-weight: 600; white-space: nowrap; }
  td.num { white-space: nowrap; }
  tr:nth-child(even) td { background: #f9fafb; }
  .empty { text-align: center; color: #6b7280; padding: 16px; }
  .sub-block { background: #f3f7f4; border-left: 3px solid #1f5c2e; margin-top: 6px; padding: 8px 10px; }
  .sub-block h2, .sub-block h4 { margin: 0 0 6px; font-size: 12px; color: #1f5c2e; }
  .sub-item { padding: 4px 0; border-bottom: 1px dotted #d1d5db; }
  .sub-item:last-child { border-bottom: none; }
  .sub-meta { color: #6b7280; font-size: 10px; }
  .preserve-whitespace { white-space: pre-wrap; }
  .report-footer { margin-top: 12px; color: #6b7280; font-size: 10px; }
</style>
</head>
<body>
  <div class="report-header">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated ${escapeHtml(now)}${subtitle}</div>
  </div>
  ${opts.body}
  <div class="report-footer">India Post Dashboard &middot; Circle Office Haryana</div>
  <script>window.onload = function () { window.focus(); setTimeout(function () { window.print(); }, 100); };<\/script>
</body>
</html>`;
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
      <h2 style="margin:16px 0 6px;font-size:14px;color:#1f5c2e;">Submissions (${subs.length})</h2>
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
      body: `<table class="fields-table">
        <tbody>${fields || '<tr><td colspan="2" class="empty">No details available.</td></tr>'}</tbody>
      </table>${subsHtml}`
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

function printReport(includeSubmissions) {
  const items = appState.items || [];
  const useSubs = includeSubmissions === true;

  const run = function (subMap) {
    const rowsHtml = items.length ? items.map(function (item) {
      const subs = (subMap && subMap[Number(item.row)]) || [];
      const subsHtml = subs.length ? `
        <tr><td colspan="6" class="sub-block">
          <h4>Submissions (${subs.length})</h4>
          ${subs.map(function (s) {
            return `
            <div class="sub-item">
              <div class="sub-meta">${escapeHtml(s.email)} &middot; ${escapeHtml(formatTimestamp(s.createdAt))}</div>
              <div class="preserve-whitespace">${escapeHtml(s.text || '')}</div>
            </div>`;
          }).join('')}
        </td></tr>` : '';
      return `
        <tr>
          <td class="num">${escapeHtml(item.id)}</td>
          <td>${escapeHtml(item.sector)}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(item.action)}</td>
          <td>${escapeHtml(item.responsibility)}</td>
          <td>${escapeHtml(item.reviewDate)}</td>
        </tr>${subsHtml}`;
    }).join('') : '<tr><td colspan="6" class="empty">No records to report.</td></tr>';

    const count = items.length;
    const subCount = useSubs ? countSubmissions_(subMap) : 0;
    const subtitle = useSubs
      ? count + ' record' + (count === 1 ? '' : 's') + ' &middot; with submissions (' + subCount + ')'
      : count + ' record' + (count === 1 ? '' : 's') + ' &middot; without submissions';

    openPrintWindow(buildPrintPage({
      title: (appState.settings.appName || 'India Post Dashboard') + ' - Report',
      landscape: true,
      subtitle: subtitle,
      body: `<table>
        <thead>
          <tr><th>#</th><th>Sector</th><th>Description</th><th>Action</th><th>Responsibility</th><th>Review</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>`
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

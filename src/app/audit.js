
/* ---------------------------------- Audit ---------------------------------- */

function auditValue(row, key) {
  if (key === 'timestamp' && row.timestampMs != null) {
    return String(row.timestampMs).padStart(16, '0');
  }
  return row[key] == null ? '' : String(row[key]);
}

function renderAudit() {
  const table = getEl('auditTable');
  if (!table) return;
  const key = appState.auditSortKey;
  const dir = appState.auditSortDir;
  const rows = appState.audit.slice().sort(function (a, b) {
    const av = auditValue(a, key).toLowerCase();
    const bv = auditValue(b, key).toLowerCase();
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  table.querySelectorAll('thead th[data-sort]').forEach(function (th) {
    const sortKey = th.getAttribute('data-sort');
    if (sortKey === key) {
      th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
    } else {
      th.removeAttribute('aria-sort');
    }
  });

  const selected = {};
  appState.selectedAuditRows.forEach(function (r) { selected[r] = true; });

  const tbody = table.querySelector('tbody');
  const totalRows = rows.length;
  const pages = Math.max(1, Math.ceil(totalRows / AUDIT_PAGE_SIZE));
  if (appState.auditPage > pages) appState.auditPage = pages;
  const start = (appState.auditPage - 1) * AUDIT_PAGE_SIZE;
  const pageRows = rows.slice(start, start + AUDIT_PAGE_SIZE);

  tbody.innerHTML = pageRows.length ? pageRows.map(function (row) {
    const rowNum = Number(row.row);
    const selectable = isFinite(rowNum) && rowNum >= 2;
    const checkbox = appState.isAdmin && selectable
      ? `<input type="checkbox" class="audit-row-check" data-row="${rowNum}"${selected[rowNum] ? ' checked' : ''} onchange="updateAuditSelection()" aria-label="Select this audit entry">`
      : '';
    return `
      <tr>
        <td class="audit-check-col">${checkbox}</td>
        <td class="preserve-whitespace">${escapeHtml(formatTimestamp(row.timestampMs != null ? row.timestampMs : row.timestamp))}</td>
        <td class="preserve-whitespace">${escapeHtml(row.user)}</td>
        <td class="preserve-whitespace">${renderLinkableText(row.action)}</td>
        <td class="preserve-whitespace">${renderLinkableText(row.recordId)}</td>
        <td class="details-cell preserve-whitespace">${renderLinkableText(row.details)}</td>
      </tr>`;
  }).join('') : '<tr><td colspan="6">No audit entries yet.</td></tr>';

  updateAuditSelection();

  const summaryEl = getEl('auditSummary');
  if (summaryEl) summaryEl.textContent = totalRows
    ? (start + 1) + '–' + Math.min(start + AUDIT_PAGE_SIZE, totalRows) + ' of ' + totalRows + ' entries'
    : 'No entries';
  renderAuditPager();
}

function renderAuditPager() {
  const pager = getEl('auditPager');
  if (!pager) return;
  const total = appState.audit.length;
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  pager.innerHTML = pages <= 1 ? '' : `
    <button class="page-btn" type="button" onclick="setAuditPage(${appState.auditPage - 1})" ${appState.auditPage <= 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>
    <span class="page-info">Page ${appState.auditPage} of ${pages}</span>
    <button class="page-btn" type="button" onclick="setAuditPage(${appState.auditPage + 1})" ${appState.auditPage >= pages ? 'disabled' : ''} aria-label="Next page">›</button>`;
}

function setAuditPage(page) {
  const pages = Math.max(1, Math.ceil(appState.audit.length / AUDIT_PAGE_SIZE));
  appState.auditPage = Math.min(Math.max(1, page), pages);
  renderAudit();
}

function auditSelectedRows() {
  const selected = [];
  document.querySelectorAll('#auditTable .audit-row-check:checked').forEach(function (cb) {
    selected.push(Number(cb.getAttribute('data-row')));
  });
  return selected;
}

function updateAuditSelection() {
  appState.selectedAuditRows = auditSelectedRows();
  const boxes = document.querySelectorAll('#auditTable .audit-row-check');
  const selectAll = getEl('auditSelectAll');
  if (selectAll) {
    selectAll.checked = boxes.length > 0 && appState.selectedAuditRows.length === boxes.length;
    selectAll.disabled = !appState.isAdmin || boxes.length === 0;
  }
  const deleteBtn = getEl('deleteAuditBtn');
  if (deleteBtn) deleteBtn.disabled = appState.selectedAuditRows.length === 0;
  const clearBtn = getEl('clearAuditBtn');
  if (clearBtn) clearBtn.classList.toggle('hidden', !appState.isAdmin);
}

function toggleAuditSelectAll() {
  const selectAll = getEl('auditSelectAll');
  const checked = !!selectAll && selectAll.checked;
  document.querySelectorAll('#auditTable .audit-row-check').forEach(function (cb) {
    cb.checked = checked;
  });
  updateAuditSelection();
}

function deleteAuditRows() {
  const rows = appState.selectedAuditRows.slice().sort(function (a, b) { return a - b; });
  if (!rows.length) { showToast('Select audit entries to delete', 'warning'); return; }
  showConfirm({
    title: 'Delete audit entries',
    message: 'Delete ' + rows.length + ' selected audit entr' + (rows.length === 1 ? 'y' : 'ies') + '?',
    okLabel: 'Delete',
    danger: true
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Deleting audit entries…');
    ApiService.adminDeleteAuditRows(rows).then(function (result) {
      hideOverlay();
      appState.audit = result || [];
      appState.selectedAuditRows = [];
      appState.auditPage = 1;
      auditLoaded = true;
      renderAudit();
      showToast('Deleted ' + rows.length + ' audit entr' + (rows.length === 1 ? 'y' : 'ies'), 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not delete audit entries: ' + (err.message || err), 'error');
    });
  });
}

function clearAuditLog() {
  showConfirm({
    title: 'Clear audit log',
    message: 'Delete the ENTIRE audit log? This cannot be undone.',
    okLabel: 'Clear log',
    danger: true
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Clearing audit log…');
    ApiService.adminClearAudit().then(function (result) {
      hideOverlay();
      appState.audit = result || [];
      appState.selectedAuditRows = [];
      appState.auditPage = 1;
      auditLoaded = true;
      renderAudit();
      showToast('Audit log cleared', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not clear audit log: ' + (err.message || err), 'error');
    });
  });
}

function setAuditSort(key) {
  if (key === appState.auditSortKey) {
    appState.auditSortDir = appState.auditSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    appState.auditSortKey = key;
    appState.auditSortDir = key === 'timestamp' ? 'desc' : 'asc';
  }
  appState.auditPage = 1;
  renderAudit();
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
  }
  fallbackCopy(text);
  return Promise.resolve();
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (err) {}
  document.body.removeChild(ta);
}

function auditAsText() {
  return appState.audit.map(function (row) {
    return [formatTimestamp(row.timestampMs != null ? row.timestampMs : row.timestamp), row.user, row.action, row.recordId, row.details].join('\t');
  }).join('\n');
}

function copyAudit() {
  copyText(auditAsText()).then(function () {
    showToast('Audit log copied to clipboard', 'success');
  }, function () {
    showToast('Could not copy audit log', 'error');
  });
}

function toCsv(rows) {
  return rows.map(function (row) {
    return row.map(function (cell) {
      return '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\r\n');
}

function downloadTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

function downloadAuditCsv() {
  const headers = ['Time', 'User', 'Action', 'Record', 'Details'];
  const rows = appState.audit.map(function (row) {
    return [formatTimestamp(row.timestampMs != null ? row.timestampMs : row.timestamp), row.user, row.action, row.recordId, row.details];
  });
  downloadTextFile('IndiaPostDashboard_Audit_' + new Date().toISOString().slice(0, 10) + '.csv', toCsv([headers].concat(rows)), 'text/csv;charset=utf-8');
  showToast('Audit CSV downloaded', 'success');
}

function printAudit() {
  const entries = appState.audit || [];
  const rowsHtml = entries.length ? entries.map(function (row) {
    return `
      <tr>
        <td class="preserve-whitespace">${escapeHtml(formatTimestamp(row.timestampMs != null ? row.timestampMs : row.timestamp))}</td>
        <td>${escapeHtml(row.user)}</td>
        <td>${escapeHtml(row.action)}</td>
        <td>${escapeHtml(row.recordId)}</td>
        <td>${escapeHtml(row.details)}</td>
      </tr>`;
  }).join('') : '<tr><td colspan="5" class="empty">No audit entries yet.</td></tr>';

  const count = entries.length;
  const title = appState.settings.appName || 'India Post Dashboard';
  const now = new Date().toLocaleString();

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} - Audit Log</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; font-size: 12px; }
  .report-header { border-bottom: 3px solid #1f5c2e; padding-bottom: 8px; margin-bottom: 12px; }
  .report-header h1 { margin: 0; font-size: 18px; color: #1f5c2e; }
  .report-header .meta { margin-top: 4px; color: #6b7280; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
  th { background: #1f5c2e; color: #fff; font-weight: 600; white-space: nowrap; }
  td.preserve-whitespace { white-space: pre-wrap; }
  tr:nth-child(even) td { background: #f9fafb; }
  .empty { text-align: center; color: #6b7280; padding: 16px; }
  .report-footer { margin-top: 12px; color: #6b7280; font-size: 10px; }
</style>
</head>
<body>
  <div class="report-header">
    <h1>${escapeHtml(title)} - Audit Log</h1>
    <div class="meta">Generated ${escapeHtml(now)} &middot; ${count} entr${count === 1 ? 'y' : 'ies'}</div>
  </div>
  <table>
    <thead>
      <tr><th>Time</th><th>User</th><th>Action</th><th>Record</th><th>Details</th></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="report-footer">India Post Dashboard &middot; Circle Office Haryana</div>
  <script>window.onload = function () { window.focus(); setTimeout(function () { window.print(); }, 100); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=980,height=720');
  if (!win) { showToast('Pop-up blocked. Please allow pop-ups to print the audit log.', 'error'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

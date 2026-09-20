
/* ---------------------------------- Record detail drawer ---------------------------------- */
/* Read-only drill-down for any record: shows every display field, review
   status, submissions, links, documents, tasks, history, and AI insight in
   a single context. Actions: Edit, Create task, Add submission, Attach
   document, Mark review done, Ask AI. */

function detailRowHtml_(field) {
  const valueHtml = field.html
    ? `<div class="detail-value preserve-whitespace field-html">${field.html}</div>`
    : `<div class="detail-value preserve-whitespace">${escapeHtml(field.value)}</div>`;
  return `
      <div class="about-row detail-row">
        <span class="detail-label">${escapeHtml(field.label || 'Value')}</span>
        ${valueHtml}
      </div>`;
}

function detailLinksHtml_(item) {
  if (!item.linkUrls || !Object.keys(item.linkUrls).length) return '';
  var html = '<div class="detail-links-section"><span class="text-subheading">Links</span>';
  Object.keys(item.linkUrls).forEach(function (key) {
    var url = item.linkUrls[key];
    if (!url) return;
    var text = (item.linkTexts && item.linkTexts[key]) || key;
    html += '<div class="about-row detail-row">' +
      '<span class="detail-label">' + escapeHtml(text) + '</span>' +
      '<div class="detail-value"><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" data-embed>' + escapeHtml(url) + '</a></div></div>';
  });
  html += '</div>';
  return html;
}

function openRecordDetail(row) {
  const item = appState.items.find(function (i) { return String(i.row) === String(row); });
  if (!item) return;
  const groups = groupCardFields_(item.displayFields);
  const fieldsHtml = (groups.top.length
    ? `<div class="detail-fields-row detail-fields-row-top">${groups.top.map(detailRowHtml_).join('')}</div>`
    : '') + (groups.action.length
    ? groups.action.map(detailRowHtml_).join('')
    : '') + (groups.bottom.length
    ? `<div class="detail-fields-row detail-fields-row-bottom">${groups.bottom.map(detailRowHtml_).join('')}</div>`
    : '');

  const linksHtml = detailLinksHtml_(item);
  const subCount = (appState.submissionCounts || {})[item.row] || 0;
  const statusBadge = item.reviewStatus === 'due'
    ? '<span class="review-badge review-due">Review due</span>'
    : item.reviewStatus === 'done'
      ? '<span class="review-badge review-done">Review done</span>'
      : '<span class="badge" data-tone="muted">Not reviewed</span>';

  const detailUpdatesHtml = rowUpdatesHtml_(item.row);
  const detailUpdatesCount = (appState.displayedSubmissions || [])
    .filter(function (s) { return Number(s.cardRow) === Number(item.row); })
    .length;
  const detailUpdatesHidden = isRowUpdatesHidden_(item.row);
  const detailUpdatesSection = detailUpdatesHtml
    ? `<div class="detail-updates"><span class="text-subheading">Updates</span><div class="card-updates${detailUpdatesHidden ? ' updates-hidden' : ''}" data-updates-row="${escAttr(item.row)}">${detailUpdatesHtml}</div></div>`
    : '';

  getEl('recordDetailTitle').textContent = 'Record #' + (item.id || item.row);
  getEl('recordDetailBody').innerHTML = `
    <div class="detail-status">${statusBadge}<span class="form-status">${subCount} submission${subCount === 1 ? '' : 's'}</span></div>
    <div class="about-rows">${fieldsHtml}</div>
    ${linksHtml}
    ${detailUpdatesSection}`;

  /* ---- actions ---- */
  let actionsHtml = '';
  if (appState.isEditor) {
    actionsHtml += `<button class="btn btn-primary" type="button" onclick="closeRecordDetail(); editItem('${escAttr(item.row)}');">Edit</button>`;
  }
  if (detailUpdatesCount > 0) {
    actionsHtml += `<button class="btn btn-secondary" data-updates-toggle="${escAttr(item.row)}" type="button" onclick="toggleCardUpdates('${escAttr(item.row)}', this)">${detailUpdatesHidden ? 'Show updates' : 'Hide updates'}</button>`;
  }
  if (appState.isEditor) {
    actionsHtml += `<button class="btn btn-secondary" type="button" onclick="closeRecordDetail(); openEditModal(${escAttr(item.row)});">Edit</button>`;
    actionsHtml += `<button class="btn btn-secondary" type="button" onclick="closeRecordDetail(); openTaskModal(${escAttr(item.row)});">Create task</button>`;
    actionsHtml += `<button class="btn btn-secondary" type="button" onclick="closeRecordDetail(); openSubmissionsModal('${escAttr(item.row)}','${escAttr(item.id)}');">Submit update</button>`;
    actionsHtml += `<label class="btn btn-secondary" style="cursor:pointer">Attach document<input type="file" style="display:none" onchange="handleDocUpload(${escAttr(item.row)}, this)"></label>`;
  }
  if (appState.isAdmin) {
    if (item.reviewStatus === 'due') {
      actionsHtml += `<button class="btn btn-secondary" type="button" onclick="detailMarkReviewDone_(${escAttr(item.row)})">Mark done</button>`;
    } else if (item.reviewStatus === 'done') {
      actionsHtml += `<button class="btn btn-secondary" type="button" onclick="detailMarkReviewNotDone_(${escAttr(item.row)})">Mark not done</button>`;
    }
  }
  if (appState.isEditor) {
    actionsHtml += `<button class="btn btn-secondary" type="button" onclick="detailAskAi_(${escAttr(item.row)})">Ask AI</button>`;
  }
  actionsHtml += `<button class="btn btn-ghost" type="button" onclick="closeRecordDetail()">Close</button>`;
  getEl('recordDetailActions').innerHTML = actionsHtml;

  loadRecordDocuments(item.row);
  loadDetailTasks_(item.row);
  loadDetailHistory_(item.row);

  openDialog('recordDetailModal');
}

/* ---- Tasks section ---- */
function loadDetailTasks_(row) {
  const el = getEl('recordDetailTasks');
  if (!el) return;
  el.innerHTML = '';
  ApiService.getTasks({ recordRow: Number(row) }).then(function (tasks) {
    const list = tasks || [];
    if (!list.length) return;
    const listHtml = list.map(function (t) {
      const statusClass = t.status === 'DONE' ? 'badge-success' : t.status === 'IN_PROGRESS' ? 'badge-primary' : 'badge-warning';
      const assignee = t.assignee || '';
      const due = t.dueDate ? ' · Due ' + formatDate(t.dueDate) : '';
      return '<div class="detail-task-row">' +
        '<span class="detail-task-title">' + escapeHtml(t.title || 'Untitled') + '</span>' +
        '<span class="badge ' + statusClass + '">' + escapeHtml(t.status) + '</span>' +
        (assignee ? '<span class="detail-task-assignee">' + escapeHtml(assignee) + '</span>' : '') +
        (due ? '<span class="detail-task-due">' + due + '</span>' : '') +
        '</div>';
    }).join('');
    el.innerHTML = '<div class="detail-section-block"><span class="text-subheading">Tasks</span>' + listHtml + '</div>';
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

/* ---- History section ---- */
function loadDetailHistory_(row) {
  const el = getEl('recordDetailHistory');
  if (!el) return;
  el.innerHTML = '';
  ApiService.getRecordHistory(row).then(function (entries) {
    if (!entries || !entries.length) return;
    const listHtml = entries.map(function (e) {
      const diff = e.diff || {};
      const fields = Object.keys(diff);
      const desc = fields.length
        ? fields.map(function (f) { return '<em>' + escapeHtml(f) + '</em>' + (diff[f] && diff[f].new !== undefined ? ' → ' + escapeHtml(String(diff[f].new)) : ''); }).join(', ')
        : 'metadata update';
      const when = e.changedAt ? formatTimestamp(e.changedAt) : '';
      return '<div class="detail-history-row">' +
        '<span class="detail-history-when">' + escapeHtml(when) + '</span>' +
        '<span class="detail-history-who">' + escapeHtml(e.changedBy || 'system') + '</span>' +
        '<span class="detail-history-what">' + desc + '</span></div>';
    }).join('');
    el.innerHTML = '<div class="detail-section-block"><span class="text-subheading">History</span>' + listHtml + '</div>';
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

/* ---- AI insight in drawer ---- */
function detailAskAi_(row) {
  const body = getEl('recordDetailBody');
  if (!body) return;
  let panel = body.querySelector('.card-ai-insight');
  if (panel) {
    panel.classList.toggle('card-ai-collapsed');
    return;
  }
  panel = document.createElement('div');
  panel.className = 'card-ai-panel card-ai-insight';
  panel.innerHTML = cardAiPanelHtml_();
  body.appendChild(panel);
  loadCardAi(panel, row);
}

/* ---- Mark review done / not done (from drawer) ---- */
function detailMarkReviewDone_(row) {
  showConfirm({ title: 'Mark review done', message: 'Confirm mark this record\'s review as done?', okLabel: 'Done' }).then(function (confirmed) {
    if (!confirmed) return;
    showOverlay('Marking review done…');
    ApiService.markReviewDone(row).then(function () {
      hideOverlay();
      showToast('Review marked done.', 'success');
      const item = appState.items.find(function (i) { return String(i.row) === String(row); });
      if (item) item.reviewStatus = 'done';
      renderDashboard(true);
      openRecordDetail(row);
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not mark review done: ' + (err.message || err), 'error');
    });
  });
}

function detailMarkReviewNotDone_(row) {
  showConfirm({ title: 'Mark review not done', message: 'Revert this record\'s review to not done?', okLabel: 'Revert', danger: true }).then(function (confirmed) {
    if (!confirmed) return;
    showOverlay('Reverting review…');
    ApiService.markReviewNotDone(row).then(function () {
      hideOverlay();
      showToast('Review reverted.', 'success');
      const item = appState.items.find(function (i) { return String(i.row) === String(row); });
      if (item) item.reviewStatus = 'due';
      renderDashboard(true);
      openRecordDetail(row);
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not revert review: ' + (err.message || err), 'error');
    });
  });
}

/* ---- Documents (preserved from original) ---- */

function loadRecordDocuments(row) {
  const docsEl = getEl('recordDetailDocs');
  if (!docsEl) return;
  ApiService.getRecordDocuments(row).then(function (docs) {
    const docsList = docs || [];
    docsEl.innerHTML = docsList.length ? `
      <div class="detail-docs-head">
        <span class="text-subheading">Documents</span>
        <label class="btn btn-ghost btn-small" style="cursor:pointer;">
          <input type="file" id="docUploadInput" style="display:none" onchange="handleDocUpload(${escAttr(row)}, this)">
          Upload
        </label>
      </div>
      <ul class="detail-docs-list">${docsList.map(function (d) {
        return '<li class="detail-doc-item">' +
          '<button class="btn btn-ghost btn-small" type="button" onclick="openDriveDocPreview(\'' + escAttr(d.driveFileId) + '\', \'' + escAttr(d.fileName) + '\')">Preview</button>' +
          '<a href="' + escapeHtml(d.url || '#') + '" target="_blank" rel="noopener">' + escapeHtml(d.fileName) + '</a>' +
          (d.keep
            ? '<button class="btn btn-small btn-keep" type="button" title="Kept: exempt from the 30-day retention cleanup. Click to un-keep." onclick="toggleDocKeep(\'' + escAttr(d.id) + '\', 0, ' + escAttr(row) + ')">Kept ✓</button>'
            : '<button class="btn btn-ghost btn-small" type="button" title="Keep this document so the 30-day retention cleanup never deletes it." onclick="toggleDocKeep(\'' + escAttr(d.id) + '\', 1, ' + escAttr(row) + ')">Keep</button>') +
          '<button class="btn btn-ghost btn-small" type="button" onclick="deleteRecordDoc(\'' + escAttr(d.id) + '\', \'' + escAttr(row) + '\')">Remove</button>' +
          '</li>';
      }).join('')}</ul>` : '';
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

function handleDocUpload(row, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const item = appState.items.find(function (i) { return String(i.row) === String(row); });
  const recordId = (item && item.recordId) || '';
  const reader = new FileReader();
  reader.onload = function (e) {
    const bytes = e.target.result;
    const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(bytes)));
    showOverlay('Uploading document…');
    ApiService.uploadDocument(row, recordId, file.name, base64, file.type || 'application/octet-stream').then(function () {
      hideOverlay();
      showToast('Document uploaded.', 'success');
      loadRecordDocuments(row);
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Upload failed: ' + (err.message || err), 'error');
    });
  };
  reader.readAsArrayBuffer(file);
}

function toggleDocKeep(docId, keep, row) {
  ApiService.setDocumentKeep(docId, keep).then(function (res) {
    showToast(keep ? 'Document kept — exempt from retention cleanup.' : 'Document un-kept — retention applies again.', 'success');
    loadRecordDocuments(row);
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not update document: ' + (err.message || err), 'error');
  });
}

function deleteRecordDoc(docId, row) {
  showConfirm({
    title: 'Delete document',
    body: 'Remove this document permanently?',
    confirmLabel: 'Delete',
    onConfirm: function () {
      showOverlay('Deleting document…');
      ApiService.deleteDocument(docId).then(function () {
        hideOverlay();
        showToast('Document removed.', 'success');
        loadRecordDocuments(row);
      }).catch(function (err) {
        hideOverlay();
        if (handleServerFailure(err)) return;
        showToast('Could not delete document.', 'error');
      });
    }
  });
}

function closeRecordDetail() {
  closeDialog('recordDetailModal');
}


/* ---------------------------------- Record detail dialog ---------------------------------- */
/* Read-only drill-down for any record (S8): shows every display field plus the
   review status and submission count, with contextual actions. */

/* One read-only detail row in the record detail dialog. */
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

function openRecordDetail(row) {
  const item = appState.items.find(function (i) { return String(i.row) === String(row); });
  if (!item) return;
  // Same 3-1-2 grouping as the dashboard cards: top row = Description, Entry
  // Date, Sector; Action its own horizontal block; bottom = Responsibility,
  // Review Date.
  const groups = groupCardFields_(item.displayFields);
  const fieldsHtml = (groups.top.length
    ? `<div class="detail-fields-row detail-fields-row-top">${groups.top.map(detailRowHtml_).join('')}</div>`
    : '') + (groups.action.length
    ? groups.action.map(detailRowHtml_).join('')
    : '') + (groups.bottom.length
    ? `<div class="detail-fields-row detail-fields-row-bottom">${groups.bottom.map(detailRowHtml_).join('')}</div>`
    : '');

  const subCount = (appState.submissionCounts || {})[item.row] || 0;
  const statusBadge = item.reviewStatus === 'due'
    ? '<span class="review-badge review-due">Review due</span>'
    : item.reviewStatus === 'done'
      ? '<span class="review-badge review-done">Review done</span>'
      : '<span class="badge" data-tone="muted">Not reviewed</span>';

  getEl('recordDetailTitle').textContent = 'Record #' + (item.id || item.row);
  getEl('recordDetailBody').innerHTML = `
    <div class="detail-status">${statusBadge}<span class="form-status">${subCount} submission${subCount === 1 ? '' : 's'}</span></div>
    <div class="about-rows">${fieldsHtml}</div>`;

  let actionsHtml = '';
  if (appState.isEditor) {
    actionsHtml += `<button class="btn btn-primary" type="button" onclick="closeRecordDetail(); editItem('${escAttr(item.row)}');">Edit</button>`;
  }
  actionsHtml += `
    <button class="btn btn-secondary" type="button" onclick="closeRecordDetail(); openSubmissionsModal('${escAttr(item.row)}','${escAttr(item.id)}');">Submit update</button>
    <button class="btn btn-ghost" type="button" onclick="closeRecordDetail()">Close</button>`;
  getEl('recordDetailActions').innerHTML = actionsHtml;

  loadRecordDocuments(item.row);

  openDialog('recordDetailModal');
}

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
  const reader = new FileReader();
  reader.onload = function (e) {
    const bytes = e.target.result;
    const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(bytes)));
    showOverlay('Uploading document…');
    ApiService.uploadDocument(row, '', file.name, base64, file.type || 'application/octet-stream').then(function () {
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


/* ------------------------- Sheet change requests (approval queue) -------------------------
 *
 * Anyone signed in can ask for a cell in a record's LINKED Google Sheet to be
 * changed. An admin/editor approves it, and only then is the sheet written.
 * Dashboard record fields are NOT requestable - they are edited directly as
 * before; the gate exists for the shared linked spreadsheets that staff were
 * previously editing by hand with nobody reviewing what changed.
 */

const changeRequestState_ = { requests: [], canApprove: false, previews: {} };
const sheetStructureCache_ = {};

/* True when the record hyperlinks a Google Sheet, i.e. when there is anything
   to request a change against. */
function itemHasSheetLink_(item) {
  const links = (item && (item.links || item.linkUrls)) || {};
  const keys = Object.keys(links);
  for (let i = 0; i < keys.length; i++) {
    const v = links[keys[i]];
    const url = Array.isArray(v) ? (v[0] && v[0].url) : (v && v.url);
    if (url && /docs\.google\.com\/spreadsheets\//i.test(String(url))) return true;
  }
  return false;
}

/* ---------------------------------- Request form ---------------------------------- */

function openSheetChangeRequest(row) {
  const item = (appState.items || []).filter(function (i) { return String(i.row) === String(row); })[0];
  appState.sheetRequestRow = Number(row);
  getEl('sheetRequestRecord').textContent = item
    ? ('Record #' + (Number(item.row) - 3) + ' — ' + (item.description || item.sector || ''))
    : ('Record row ' + row);
  getEl('sheetRequestTab').innerHTML = '<option value="">Loading…</option>';
  getEl('sheetRequestHeader').innerHTML = '<option value="">—</option>';
  getEl('sheetRequestRowNo').value = '';
  getEl('sheetRequestRowNo').removeAttribute('max');
  getEl('sheetRequestValue').value = '';
  getEl('sheetRequestReason').value = '';
  getEl('sheetRequestStatus').textContent = '';
  getEl('sheetRequestSubmit').disabled = true;
  openDialog('sheetRequestModal');
  loadSheetRequestStructure_(Number(row));
}

/* The tabs, their column headers and their extents come from the server, which
   reads the sheet itself. Offering the real choices is the whole point: a
   hand-typed tab or header name is how a request ends up aimed at the wrong
   cell (the server still re-resolves at approval, but the requester should see
   the real options up front). */
function loadSheetRequestStructure_(row) {
  ApiService.getLinkSheetStructure(row).then(function (data) {
    const tabSel = getEl('sheetRequestTab');
    if (!data || data.success !== true || data.available !== true) {
      const why = data && data.detail ? data.detail : (data && data.reason === 'no-link'
        ? 'This record has no linked Google Sheet.' : 'The linked sheet could not be read.');
      tabSel.innerHTML = '<option value="">Unavailable</option>';
      getEl('sheetRequestStatus').textContent = why;
      return;
    }
    const tabs = data.tabs || [];
    if (!tabs.length) {
      tabSel.innerHTML = '<option value="">No tabs</option>';
      getEl('sheetRequestStatus').textContent = 'That sheet has no tabs.';
      return;
    }
    sheetStructureCache_[String(row)] = tabs;
    tabSel.innerHTML = tabs.map(function (t) {
      return '<option value="' + escAttr(t.title) + '">' + escapeHtml(t.title) + '</option>';
    }).join('');
    if (data.dryRun) {
      getEl('sheetRequestStatus').textContent = 'Dry run is enabled on the server: approvals resolve the cell but will not write to the sheet.';
    } else {
      getEl('sheetRequestStatus').textContent = '';
    }
    getEl('sheetRequestSubmit').disabled = false;
    onSheetRequestTabChange_();
  }).catch(function (err) {
    getEl('sheetRequestTab').innerHTML = '<option value="">Unavailable</option>';
    if (handleServerFailure(err)) return;
    getEl('sheetRequestStatus').textContent = 'Could not read the sheet: ' + ((err && err.message) || err);
  });
}

function currentSheetTab_() {
  return tabsForRecord_(appState.sheetRequestRow, getEl('sheetRequestTab').value);
}

function tabsForRecord_(row, title) {
  const list = sheetStructureCache_[String(row)] || [];
  return list.filter(function (t) { return t.title === title; })[0] || null;
}

function onSheetRequestTabChange_() {
  const tab = currentSheetTab_();
  const sel = getEl('sheetRequestHeader');
  const headers = tab && tab.headers ? tab.headers : [];
  sel.innerHTML = headers.length
    ? headers.map(function (h) { return '<option value="' + escAttr(h) + '">' + escapeHtml(h) + '</option>'; }).join('')
    : '<option value="">— no named columns —</option>';
  const rowInput = getEl('sheetRequestRowNo');
  if (tab && tab.rowCount) {
    rowInput.setAttribute('max', String(tab.rowCount));
    rowInput.placeholder = '1–' + tab.rowCount;
  } else {
    rowInput.removeAttribute('max');
    rowInput.placeholder = 'Row number';
  }
}

function closeSheetChangeRequest() {
  closeDialog('sheetRequestModal');
}

function submitSheetChangeRequest() {
  const row = Number(appState.sheetRequestRow || 0);
  const payload = {
    recordRow: row,
    sheetTab: getEl('sheetRequestTab').value,
    sheetHeader: getEl('sheetRequestHeader').value,
    sheetRow: Number(getEl('sheetRequestRowNo').value),
    newValue: getEl('sheetRequestValue').value,
    reason: getEl('sheetRequestReason').value
  };
  const status = getEl('sheetRequestStatus');
  if (!payload.sheetTab) { status.textContent = 'Choose a tab.'; return; }
  if (!payload.sheetHeader) { status.textContent = 'Choose a column.'; return; }
  if (!isFinite(payload.sheetRow) || payload.sheetRow < 1) { status.textContent = 'Enter the row number.'; return; }
  if (!String(payload.newValue || '').trim()) { status.textContent = 'Enter the value the cell should contain.'; return; }

  showOverlay('Sending request…');
  ApiService.createChangeRequest(payload).then(function (res) {
    hideOverlay();
    if (!res || res.success !== true) {
      status.textContent = (res && res.message) || 'Could not send the request.';
      return;
    }
    closeSheetChangeRequest();
    showToast('Change request sent for approval', 'success');
    if (typeof refreshChangeRequestBadge_ === 'function') refreshChangeRequestBadge_();
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    status.textContent = 'Could not send the request: ' + ((err && err.message) || err);
  });
}

/* ---------------------------------- Approvals queue ---------------------------------- */

/* Cheap pending-count fetch so the toolbar badge is right on load and after
   any approval, without pulling the whole queue into the DOM. */
function refreshChangeRequestBadge_() {
  ApiService.listChangeRequests({}).then(function (data) {
    if (!data) return;
    changeRequestState_.canApprove = !!data.canApprove;
    const pending = Number(data.pendingCount) || 0;
    const badge = getEl('changeRequestBadge');
    if (!badge) return;
    badge.textContent = pending ? String(pending) : '';
    badge.style.display = pending ? '' : 'none';
  }).catch(function () { /* the badge is cosmetic: never surface its failure */ });
}

function openChangeRequestQueue() {
  openDialog('changeRequestModal');
  loadChangeRequests();
}

function closeChangeRequestQueue() {
  closeDialog('changeRequestModal');
}

function loadChangeRequests() {
  ApiService.listChangeRequests({ mine: appState.isEditor ? '' : 'true' }).then(function (data) {
    changeRequestState_.requests = (data && data.requests) || [];
    changeRequestState_.canApprove = !!(data && data.canApprove);
    renderChangeRequestQueue();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not load change requests: ' + ((err && err.message) || err), 'error');
  });
}

function changeRequestStatusBadge_(status) {
  const tone = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'muted', CONFLICT: 'danger' }[status] || 'muted';
  return '<span class="badge" data-tone="' + tone + '">' + escapeHtml(status) + '</span>';
}

function changeRequestTarget_(req) {
  return '<strong>' + escapeHtml(req.sheetHeader) + '</strong> &middot; tab ' + escapeHtml(req.sheetTab) +
    ', row ' + escapeHtml(String(req.sheetRow)) +
    (req.appliedRange ? ' <span class="cr-applied">&rarr; ' + escapeHtml(req.appliedRange) + '</span>' : '');
}

function renderChangeRequestQueue() {
  const list = getEl('changeRequestList');
  if (!list) return;
  const pending = changeRequestState_.requests.filter(function (r) { return r.status === 'PENDING'; }).length;
  const badge = getEl('changeRequestBadge');
  if (badge) {
    badge.textContent = pending ? String(pending) : '';
    badge.style.display = pending ? '' : 'none';
  }
  if (!changeRequestState_.requests.length) {
    list.innerHTML = '<p class="empty">No change requests' +
      (changeRequestState_.canApprove ? '.' : ' from you.') + '</p>';
    return;
  }
  list.innerHTML = changeRequestState_.requests.map(function (req) {
    const preview = changeRequestState_.previews[req.id];
    const oldText = (preview && preview.resolvable)
      ? String(preview.currentValue == null ? '' : preview.currentValue)
      : String(req.sheetCurrentValue == null ? '' : req.sheetCurrentValue);
    let extra = '';
    if (preview && preview.resolvable) {
      extra = '<div class="cr-preview">Resolves to <code>' + escapeHtml(preview.range) + '</code>' +
        (preview.conflict ? ' <strong class="cr-preview-bad">cell changed since this was requested</strong>' : '') +
        (preview.dryRun ? ' <em>(dry run &mdash; writes are disabled)</em>' : '') + '</div>';
    } else if (preview && !preview.resolvable) {
      extra = '<div class="cr-preview cr-preview-bad">' + escapeHtml(preview.reason || 'Could not resolve the target cell.') + '</div>';
    } else {
      extra = '<div class="cr-preview"><button type="button" class="btn btn-secondary btn-small" onclick="previewChangeRequestRow(\'' +
        escapeHtml(req.id) + '\')">Check target cell</button></div>';
    }
    const actions = (changeRequestState_.canApprove && req.status === 'PENDING')
      ? '<div class="cr-actions">' +
        '<button type="button" class="btn btn-small" onclick="approveChangeRequestRow(\'' + escapeHtml(req.id) + '\')">Approve</button>' +
        '<button type="button" class="btn btn-secondary btn-small" onclick="rejectChangeRequestRow(\'' + escapeHtml(req.id) + '\')">Reject</button>' +
        '</div>'
      : (req.status !== 'PENDING' && req.reviewedBy
        ? '<div class="cr-actions cr-reviewed">by ' + escapeHtml(req.reviewedBy) +
          (req.reviewNote ? ' &mdash; ' + escapeHtml(req.reviewNote) : '') + '</div>'
        : '');
    return '<div class="cr-item cr-' + escapeHtml(String(req.status || '').toLowerCase()) + '">' +
      '<div class="cr-head">' + changeRequestTarget_(req) + ' ' + changeRequestStatusBadge_(req.status) + '</div>' +
      '<div class="cr-meta">Record #' + escapeHtml(String(req.recordRow ? (Number(req.recordRow) - 3) : '')) +
      ' &middot; requested by ' + escapeHtml(req.requestedBy) + ' &middot; ' + escapeHtml(formatTimestamp(req.requestedAt)) + '</div>' +
      '<div class="cr-diff"><span class="cr-old">' + escapeHtml(oldText.slice(0, 300)) + '</span>' +
      '<span class="cr-arrow">&rarr;</span>' +
      '<span class="cr-new">' + escapeHtml(String(req.newValue || '').slice(0, 300)) + '</span></div>' +
      (req.reason ? '<div class="cr-reason">Reason: ' + escapeHtml(req.reason) + '</div>' : '') +
      extra + actions +
      '</div>';
  }).join('');
}

function previewChangeRequestRow(id) {
  ApiService.previewChangeRequest(id).then(function (data) {
    changeRequestState_.previews[id] = data || {};
    renderChangeRequestQueue();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not preview: ' + ((err && err.message) || err), 'error');
  });
}

function approveChangeRequestRow(id) {
  if (!changeRequestState_.canApprove) { showToast('Admin/editor access required', 'warning'); return; }
  showOverlay('Approving…');
  ApiService.approveChangeRequest(id).then(function (res) {
    hideOverlay();
    if (!res || res.success !== true) {
      showToast((res && res.message) || 'Could not approve.', res && res.conflict ? 'error' : 'error');
      return;
    }
    delete changeRequestState_.previews[id];
    showToast(res.dryRun ? 'Approved (dry run — the sheet was not modified)' : 'Approved and applied', 'success');
    // No dashboard refresh: approving writes to a linked sheet, not to a record.
    loadChangeRequests();
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not approve: ' + ((err && err.message) || err), 'error');
  });
}

function rejectChangeRequestRow(id) {
  if (!changeRequestState_.canApprove) { showToast('Admin/editor access required', 'warning'); return; }
  const note = window.prompt('Reason for rejecting (optional — shown to the requester):') || '';
  showOverlay('Rejecting…');
  ApiService.rejectChangeRequest(id, note).then(function (res) {
    hideOverlay();
    if (!res || res.success !== true) {
      showToast((res && res.message) || 'Could not reject.', 'error');
      return;
    }
    showToast('Rejected', 'success');
    loadChangeRequests();
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not reject: ' + ((err && err.message) || err), 'error');
  });
}

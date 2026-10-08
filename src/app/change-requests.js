
/* ------------------------- Change requests (approval queue) -------------------------
 *
 * Non-approvers cannot edit a record directly: their Save becomes "Request
 * change", which creates a request an admin/editor approves. This module owns
 * both halves of that flow plus the approvals queue.
 */

const CHANGE_REQUEST_FIELDS_ = [
  { key: 'sector', label: 'Sector' },
  { key: 'description', label: 'Description' },
  { key: 'entryDate', label: 'Entry Date' },
  { key: 'action', label: 'Action' },
  { key: 'lastMeetingInstructions', label: 'Last meeting instructions' },
  { key: 'responsibility', label: 'Responsibility' },
  { key: 'reviewDate', label: 'Review Date' }
];

const changeRequestState_ = { requests: [], canApprove: false, previews: {} };

function changeRequestFieldLabel_(key) {
  const hit = CHANGE_REQUEST_FIELDS_.filter(function (f) { return f.key === key; })[0];
  return hit ? hit.label : String(key || '');
}

/* Diff an edited item against the stored record so only genuinely changed
   fields are proposed. Sending unchanged fields would create noise an approver
   has to read past, and a "new value" identical to the old one is rejected by
   the server anyway. */
function collectChangeRequestFields_(item) {
  const original = (appState.items || []).filter(function (i) {
    return String(i.row) === String(Number(item.row || 0));
  })[0] || {};
  const changes = [];
  CHANGE_REQUEST_FIELDS_.forEach(function (f) {
    const before = String(original[f.key] == null ? '' : original[f.key]);
    const after = String(item[f.key] == null ? '' : item[f.key]);
    if (before !== after) changes.push({ field: f.key, label: f.label, oldValue: before, newValue: after });
  });
  return changes;
}

function submitChangeRequests(item, reason) {
  const changes = collectChangeRequestFields_(item);
  if (!changes.length) {
    showToast('Nothing has changed yet.', 'warning');
    return;
  }
  showOverlay('Sending change request…');
  // One request per changed field: each is reviewed on its own, so approving one
  // field never silently drags the rest of the edit through with it.
  let chain = Promise.resolve();
  let sent = 0;
  changes.forEach(function (change) {
    chain = chain.then(function () {
      return ApiService.createChangeRequest({
        recordRow: Number(item.row),
        scope: 'record',
        field: change.field,
        newValue: change.newValue,
        reason: String(reason || '')
      }).then(function (res) {
        if (res && res.success === true) sent++;
        else throw new Error((res && res.message) || 'Could not send the request.');
      });
    });
  });
  chain.then(function () {
    hideOverlay();
    closeEditModal();
    showToast(sent + ' change request' + (sent === 1 ? '' : 's') + ' sent for approval', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not send the request: ' + ((err && err.message) || err), 'error');
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
  if (req.scope === 'sheet') {
    return 'Linked sheet &middot; <strong>' + escapeHtml(req.sheetHeader) + '</strong> (tab ' +
      escapeHtml(req.sheetTab) + ', row ' + escapeHtml(String(req.sheetRow)) + ')';
  }
  return escapeHtml(req.fieldLabel || req.field);
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
    const oldText = req.scope === 'sheet'
      ? (preview && preview.resolvable ? String(preview.currentValue == null ? '' : preview.currentValue) : '(read on preview)')
      : String(req.oldValue == null ? '' : req.oldValue);
    let extra = '';
    if (req.scope === 'sheet') {
      if (preview && preview.resolvable) {
        extra = '<div class="cr-preview">Resolves to <code>' + escapeHtml(preview.range) + '</code>' +
          (preview.dryRun ? ' <em>(dry run &mdash; writes are disabled)</em>' : '') + '</div>';
      } else if (preview && !preview.resolvable) {
        extra = '<div class="cr-preview cr-preview-bad">' + escapeHtml(preview.reason || 'Could not resolve the target cell.') + '</div>';
      } else {
        extra = '<div class="cr-preview"><button type="button" class="btn btn-secondary btn-small" onclick="previewChangeRequestRow(\'' +
          escapeHtml(req.id) + '\')">Check target cell</button></div>';
      }
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
    loadChangeRequests();
    refreshData();
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

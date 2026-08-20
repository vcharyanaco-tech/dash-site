
/* ---------------------------------- Submissions modal ---------------------------------- */

function openSubmissionsModal(row, cardId, onlyMine) {
  appState.submissionCardRow = row;
  appState.submissionCardId = cardId;
  appState.submissionEditingId = '';
  getEl('submissionText').value = '';
  resetSubmissionCompose();
  getEl('submissionStatus').textContent = '';
  getEl('submissionsOnlyMine').checked = !!onlyMine;
  getEl('submissionText').placeholder = 'Write your update for record #' + cardId + '…';
  const subsModal = getEl('submissionsModal');
  subsModal.classList.remove('hidden');
  restoreModalSize_(subsModal);
  loadSubmissions();
}

function closeSubmissionsModal() {
  closeDialog('submissionsModal');
}

function markAllSubmissionsRead() {
  if (!appState.isAdmin) return;
  showOverlay('Marking all updates as read…');
  ApiService.markAllSubmissionsRead().then(function (overview) {
    hideOverlay();
    appState.submissionSeq++;
    appState.submissionCounts = (overview && overview.counts) || {};
    appState.submissionFlash = (overview && overview.flash) || {};
    appState.displayedSubmissions = (overview && overview.displayed) || [];
    renderDashboard(true);
    updateMarkAllSubmissionsReadBtn();
    showToast('All updates marked as read', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not mark updates as read: ' + (err.message || err), 'error');
  });
}

function resetSubmissionCompose() {
  getEl('submitSubmissionBtn').textContent = 'Submit update';
  getEl('cancelSubmissionBtn').classList.add('hidden');
}

function loadSubmissions() {
  ApiService.getSubmissions(Number(appState.submissionCardRow)).then(function (list) {
    appState.submissions = list || [];
    renderSubmissionList();
    // Reading a card's update list counts as reading it: an admin who opens
    // the modal stops that card's badge flashing (the counter stays).
    if (appState.isAdmin && appState.submissionCardRow) {
      const row = Number(appState.submissionCardRow);
      if (appState.submissionFlash[row]) {
        appState.submissionFlash[row] = false;
        renderDashboard(true);
        updateMarkAllSubmissionsReadBtn();
      }
    }
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not load submissions: ' + (err.message || err), 'error');
  });
}

function renderSubmissionList() {
  const onlyMine = getEl('submissionsOnlyMine').checked;
  const all = appState.submissions || [];
  const list = all.filter(function (s) { return !onlyMine || s.isOwner; });
  getEl('submissionsCount').textContent = list.length + ' shown / ' + all.length + ' total';
  getEl('submissionsList').innerHTML = list.length
    ? list.map(renderSubmissionCard).join('')
    : '<div class="empty-state"><div class="empty-state-icon">' + svgIcon('inbox') + '</div><div class="empty-state-title">No submissions yet</div><div class="empty-state-subtitle">Submissions for this record will appear here.</div></div>';
}

function renderSubmissionCard(s) {
  const lockedBadge = s.locked ? '<span class="badge badge-locked">Locked</span>' : '';
  const displayedBadge = s.displayed ? '<span class="badge badge-displayed">On card</span>' : '';
  const ownerTag = s.isOwner ? ' <em>(you)</em>' : '';
  const editBtn = s.editable
    ? `<button class="btn btn-secondary btn-small" type="button" onclick="editSubmission('${escAttr(s.id)}')">Edit</button>`
    : '';
  let lockBtn = '';
  if (s.canUnlock) {
    lockBtn = `<button class="btn btn-secondary btn-small" type="button" onclick="unlockSubmission('${escAttr(s.id)}')">Unlock</button>`;
  } else if (s.canLock) {
    lockBtn = `<button class="btn btn-secondary btn-small" type="button" onclick="lockSubmission('${escAttr(s.id)}')">Lock</button>`;
  }
  const deleteBtn = appState.isAdmin
    ? `<button class="btn btn-danger btn-small" type="button" onclick="deleteSubmission('${escAttr(s.id)}')">Delete</button>`
    : '';
  const displayBtn = appState.isAdmin
    ? `<button class="btn btn-secondary btn-small" type="button" onclick="toggleDisplaySubmission('${escAttr(s.id)}')">${s.displayed ? 'Hide from card' : 'Display on card'}</button>`
    : '';
  const lockRoleTag = s.lockRole ? ` (${escapeHtml(s.lockRole.toLowerCase())})` : '';
  const lockNote = s.lockedBy
    ? `<span class="submission-note">Locked by ${escapeHtml(s.lockedBy)}${lockRoleTag}${s.lockedAt ? ' on ' + escapeHtml(s.lockedAt) : ''}</span>`
    : '';
  return `
    <div class="submission-card">
      <div class="submission-meta">
        <span>${escapeHtml(s.email)}${ownerTag} ${lockedBadge} ${displayedBadge}</span>
        <span>${escapeHtml(formatTimestamp(s.createdAt))}</span>
      </div>
      <div class="submission-text preserve-whitespace">${escapeHtml(s.text || '')}</div>
      <div class="submission-actions">${editBtn}${lockBtn}${deleteBtn}${displayBtn}${lockNote}</div>
    </div>`;
}

function editSubmission(id) {
  const s = (appState.submissions || []).find(function (x) { return String(x.id) === String(id); });
  if (!s) return;
  appState.submissionEditingId = s.id;
  getEl('submissionText').value = s.text;
  getEl('submitSubmissionBtn').textContent = 'Save changes';
  getEl('cancelSubmissionBtn').classList.remove('hidden');
  getEl('submissionStatus').textContent = 'Editing your submission';
}

function cancelSubmissionEdit() {
  appState.submissionEditingId = '';
  getEl('submissionText').value = '';
  getEl('submissionStatus').textContent = '';
  resetSubmissionCompose();
}

function submitSubmission() {
  const text = getEl('submissionText').value;
  if (!text || !text.trim()) {
    getEl('submissionStatus').textContent = 'Write your update before submitting.';
    return;
  }
  const editingId = appState.submissionEditingId;
  if (editingId) {
    showOverlay('Saving submission…');
    ApiService.updateSubmission(editingId, text).then(function (list) {
      hideOverlay();
      appState.submissionSeq++;
      appState.submissions = list || [];
      appState.submissionEditingId = '';
      getEl('submissionText').value = '';
      resetSubmissionCompose();
      getEl('submissionStatus').textContent = '';
      renderSubmissionList();
      showToast('Submission updated', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      getEl('submissionStatus').textContent = err.message || 'Could not save submission';
    });
  } else {
    showOverlay('Submitting update…');
    ApiService.addSubmission(Number(appState.submissionCardRow), appState.submissionCardId, text).then(function (list) {
      hideOverlay();
      appState.submissionSeq++;
      appState.submissions = list || [];
      appState.submissionCounts[Number(appState.submissionCardRow)] = (list || []).length;
      appState.submissionFlash[Number(appState.submissionCardRow)] = true;
      getEl('submissionText').value = '';
      resetSubmissionCompose();
      getEl('submissionStatus').textContent = '';
      renderSubmissionList();
      renderDashboard(true);
      showToast('Update submitted', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      getEl('submissionStatus').textContent = err.message || 'Could not submit update';
    });
  }
}

function lockSubmission(id) {
  if (!appState.isEditor) { showToast('Editor access required', 'warning'); return; }
  showOverlay('Locking submission…');
  ApiService.lockSubmission(id).then(function (list) {
    hideOverlay();
    appState.submissions = list || [];
    renderSubmissionList();
    showToast('Submission locked', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not lock submission: ' + (err.message || err), 'error');
  });
}

function unlockSubmission(id) {
  if (!appState.isEditor) { showToast('Editor access required', 'warning'); return; }
  showOverlay('Unlocking submission…');
  ApiService.unlockSubmission(id).then(function (list) {
    hideOverlay();
    appState.submissions = list || [];
    renderSubmissionList();
    showToast('Submission unlocked', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not unlock submission: ' + (err.message || err), 'error');
  });
}

function deleteSubmission(id) {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  showConfirm({
    title: 'Delete submission',
    message: 'Delete this submission permanently?',
    okLabel: 'Delete',
    danger: true
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Deleting submission…');
    ApiService.deleteSubmission(id).then(function (list) {
      appState.submissionSeq++;
      hideOverlay();
      appState.submissions = list || [];
      renderSubmissionList();
      showToast('Submission deleted', 'success');
      refreshData();
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not delete submission: ' + (err.message || err), 'error');
    });
  });
}

function toggleDisplaySubmission(id) {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  showOverlay('Updating display…');
  ApiService.toggleSubmissionDisplay(id).then(function (list) {
    hideOverlay();
    appState.submissions = list || [];
    renderSubmissionList();
    showToast('Display updated', 'success');
    refreshData();
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not update display: ' + (err.message || err), 'error');
  });
}

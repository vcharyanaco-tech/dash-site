
/* ---------------------------------- Settings ---------------------------------- */

function renderSettings() {
  getEl('mustChangeBanner').classList.toggle('hidden', !appState.mustChange);

  // CSV import drop zone — editors and admins
  var csvImportCard = getEl('csvImportCard');
  if (csvImportCard) csvImportCard.classList.toggle('hidden', !appState.isEditor);
  wireCsvImportDropZone();

  // Google Sheet sync + full backup — admin only.
  const sheetSyncCard = getEl('sheetSyncCard');
  if (sheetSyncCard) sheetSyncCard.classList.toggle('hidden', !appState.isAdmin);
  const backupCard = getEl('backupCard');
  if (backupCard) backupCard.classList.toggle('hidden', !appState.isAdmin);
  if (appState.isAdmin) loadAutoSyncStatus();

  const usersAdmin = getEl('usersAdmin');
  const userActivityCard = getEl('userActivityCard');
  if (appState.isAdmin && can('users', 'view')) {
    usersAdmin.classList.remove('hidden');
    if (userActivityCard) userActivityCard.classList.remove('hidden');
    loadUsers();
    loadUserActivity();
  } else {
    usersAdmin.classList.add('hidden');
    if (userActivityCard) userActivityCard.classList.add('hidden');
  }
}

function loadUsers() {
  ApiService.adminGetUsers().then(function (users) {
    renderUsersTable(users || []);
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not load users: ' + (err.message || err), 'error');
  });
}

/* Pull the latest records + hyperlinks from the origin Google Sheet. The
   pull is previewed first — the admin reviews exactly what would change and
   confirms before anything is applied. Dashboard-added records and links are
   always preserved (the pull never prunes app-created rows, and links are
   merged, not replaced). */
let syncPreviewData = null;

function downloadFullBackup() {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  const status = getEl('backupStatus');
  if (status) { status.textContent = 'Building backup…'; status.className = 'form-status'; }
  showOverlay('Building backup…');
  ApiService.exportFullBackup().then(function (data) {
    hideOverlay();
    if (!data || data.success !== true) {
      const msg = (data && data.message) || 'Could not build the backup.';
      if (status) { status.textContent = msg; status.className = 'form-status error'; }
      showToast(msg, 'error');
      return;
    }
    let bin;
    try { bin = atob(data.base64); } catch (err) {
      if (status) { status.textContent = 'Could not decode the backup file.'; status.className = 'form-status error'; }
      return;
    }
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: data.mimeType || 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.name || 'india-post-dashboard-backup.db';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    if (status) { status.textContent = 'Downloaded ' + (data.name || '') + ' (' + formatFileSize(data.size) + ').';
      status.className = 'form-status'; }
    showToast('Full backup downloaded.', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    const msg = err && err.message ? err.message : String(err);
    if (status) { status.textContent = msg; status.className = 'form-status error'; }
    showToast('Backup failed: ' + msg, 'error');
  });
}

function syncFromSheet() {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  const btn = getEl('syncSheetBtn');
  const status = getEl('syncSheetStatus');
  if (!btn || !status) return;
  btn.disabled = true;
  status.textContent = 'Fetching sheet preview…';
  status.className = 'form-status';
  ApiService.adminPreviewSyncFromSheet().then(function (preview) {
    btn.disabled = false;
    if (!preview) {
      status.textContent = 'Preview failed: no data returned.';
      status.className = 'form-status error';
      return;
    }
    const added = (preview.added || []).length;
    const updated = (preview.updated || []).length;
    const removed = (preview.removed || []).length;
    if (!preview.pending) {
      status.textContent = 'Sheet is already in sync — no changes to apply.';
      status.className = 'form-status success';
      showToast('Sheet is up to date', 'success');
      return;
    }
    syncPreviewData = preview;
    renderSyncPreview(preview);
    openDialog('syncPreviewModal');
    status.textContent = 'Review the preview above, then apply or cancel.';
    status.className = 'form-status';
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    btn.disabled = false;
    status.textContent = 'Preview failed: ' + (err.message || err);
    status.className = 'form-status error';
  });
}

// Renders the preview payload into the sync preview modal.
function renderSyncPreview(preview) {
  const summary = getEl('syncPreviewSummary');
  const list = getEl('syncPreviewList');
  const added = (preview.added || []).length;
  const updated = (preview.updated || []).length;
  const removed = (preview.removed || []).length;
  const linksRead = preview.linksRead != null ? preview.linksRead : '—';
  summary.textContent = 'Pull would affect ' + preview.pending + ' record(s) from the sheet: ' +
    added + ' new, ' + updated + ' updated, ' + removed + ' removed. (' + linksRead + ' hyperlink(s) read.)';
  const parts = [];
  (preview.added || []).forEach(function (r) {
    parts.push('<div class="sync-preview-item"><strong class="sync-preview-tag sync-preview-add">NEW</strong> ' +
      escRec(r) + '</div>');
  });
  (preview.updated || []).forEach(function (r) {
    const changes = (r.changes || []).join(', ') || 'content';
    parts.push('<div class="sync-preview-item"><strong class="sync-preview-tag sync-preview-upd">UPDATE</strong> ' +
      escRec(r) + ' <span class="muted">(' + escapeHtml(changes) + ')</span></div>');
  });
  (preview.removed || []).forEach(function (r) {
    parts.push('<div class="sync-preview-item"><strong class="sync-preview-tag sync-preview-rem">REMOVE</strong> ' +
      escRec(r) + '</div>');
  });
  list.innerHTML = parts.length ? parts.join('') : '<p class="muted">No changes detected.</p>';
}

function escRec(r) {
  const label = escapeHtml(String(r.description || r.sector || ('Record ' + r.displayId)));
  const idTag = r.displayId != null ? ' <span class="muted">#' + escapeHtml(String(r.displayId)) + '</span>' : '';
  return label + idTag;
}

function applySyncPreview() {
  const applyBtn = getEl('syncPreviewApplyBtn');
  const status = getEl('syncPreviewStatus');
  if (!applyBtn) return;
  applyBtn.disabled = true;
  if (status) { status.textContent = 'Applying…'; status.className = 'form-status'; }
  ApiService.adminSyncFromSheet().then(function (data) {
    closeDialog('syncPreviewModal');
    syncPreviewData = null;
    const pull = (data && data.pull) || {};
    const push = (data && data.push) || {};
    const lines = [];
    if (pull.pulled) {
      lines.push('Pull: ' + pull.sheetRows + ' rows from sheet (' + pull.inserted + ' inserted, ' + pull.updated + ' updated' +
        (pull.pruned ? ', ' + pull.pruned + ' pruned' : '') + ').');
      if (pull.linksRead) lines.push('Hyperlinks read from sheet: ' + pull.linksRead + '.');
      else lines.push('Hyperlinks: ' + pull.linksSource + '.');
    } else {
      lines.push('Pull failed: ' + ((pull && pull.reason) || 'unknown error'));
    }
    if (push.pushed) {
      lines.push('Push: ' + push.rows + ' records written back to sheet' + (push.linkedCells ? ' (' + push.linkedCells + ' linked cells).' : '.'));
    } else {
      lines.push('Push: ' + (push.reason || 'not configured') + '.');
    }
    const statusEl = getEl('syncSheetStatus');
    if (statusEl) {
      statusEl.textContent = lines.join(' ');
      statusEl.className = 'form-status ' + (pull.pulled && (push.ok || !push.pushed) ? 'success' : 'error');
    }
    showToast('Sync complete', 'success');
    refreshData();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    applyBtn.disabled = false;
    if (status) { status.textContent = 'Apply failed: ' + (err.message || err); status.className = 'form-status error'; }
  });
}

function cancelSyncPreview() {
  closeDialog('syncPreviewModal');
  syncPreviewData = null;
  const status = getEl('syncSheetStatus');
  if (status) { status.textContent = 'Sync cancelled — no changes applied.'; status.className = 'form-status'; }
}

/** Push: send all DB records back to the Google Spreadsheet. */
function pushAllToSheet() {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  if (!confirm('This will overwrite the Google Spreadsheet with the current database records. Continue?')) return;
  const btn = getEl('pushSheetBtn');
  const status = getEl('syncSheetStatus');
  if (btn) btn.disabled = true;
  if (status) { status.textContent = 'Pushing records to spreadsheet…'; status.className = 'form-status'; }
  showOverlay('Pushing to spreadsheet…');
  ApiService.adminPushToSheet().then(function (result) {
    hideOverlay();
    if (btn) btn.disabled = false;
    if (!result || result.pushed === false) {
      const msg = (result && result.reason) || 'Push failed';
      if (status) { status.textContent = msg; status.className = 'form-status error'; }
      showToast(msg, 'error');
      return;
    }
    const msg = 'Pushed ' + (result.rows || 0) + ' records to the spreadsheet' + (result.linkedCells ? ' (' + result.linkedCells + ' linked cells).' : '.');
    if (status) { status.textContent = msg; status.className = 'form-status success'; }
    showToast(msg, 'success');
  }).catch(function (err) {
    hideOverlay();
    if (btn) btn.disabled = false;
    if (handleServerFailure(err)) return;
    const msg = 'Push failed: ' + (err.message || err);
    if (status) { status.textContent = msg; status.className = 'form-status error'; }
    showToast(msg, 'error');
  });
}

// Shows the periodic auto-sync configuration + last run in the Settings card.
function loadAutoSyncStatus() {
  const el = getEl('autoSyncStatus');
  if (!el) return;
  ApiService.getSyncStatus().then(function (data) {
    const mins = data && data.intervalMinutes;
    const enabled = !!(data && data.enabled);
    const parts = [];
    parts.push(enabled ? 'Auto-sync every ' + mins + ' min' : 'Auto-sync disabled');
    const last = data && data.lastRun;
    if (last && last.at) {
      if (last.error) {
        parts.push('last run ' + formatTimestamp(last.at) + ' failed: ' + last.error);
      } else {
        const pull = last.pull || {};
        const push = last.push || {};
        parts.push('last run ' + formatTimestamp(last.at) + ': pulled ' + (pull.sheetRows != null ? pull.sheetRows + ' rows' : '—') +
          (push && push.pushed ? ', pushed ' + push.rows + ' back' : ''));
      }
    } else {
      parts.push('no run yet');
    }
    el.textContent = parts.join(' — ');
  }).catch(function () {
    el.textContent = 'Auto-sync status unavailable';
  });
}

function renderUsersTable(users) {
  const tbody = getEl('usersTable').querySelector('tbody');
  tbody.dataset.users = JSON.stringify(users);
  tbody.innerHTML = users.length ? users.map(function (u, i) {
    const username = escapeHtml(u.username || '');
    const office = escapeHtml(u.office || '');
    const resetPending = !!(u.resetRequested && String(u.resetRequested).trim());
    const resetBadge = resetPending
      ? ' <span class="badge" data-tone="warning" title="Requested at ' + escapeHtml(formatTimestamp(u.resetRequested)) + '">Reset request received</span>'
      : '';
    return `
      <tr${resetPending ? ' class="row-reset-requested"' : ''}>
        <td class="preserve-whitespace">${escapeHtml(u.email)}${u.mustChange ? ' <em>(must change)</em>' : ''}${resetBadge}</td>
        <td class="preserve-whitespace">${username || '<span class="badge" data-tone="muted">—</span>'}</td>
        <td>${escapeHtml(u.role)}</td>
        <td class="preserve-whitespace">${office || '<span class="badge" data-tone="muted">—</span>'}</td>
        <td class="preserve-whitespace">${escapeHtml(formatTimestamp(u.createdAt))}</td>
        <td><button class="btn btn-secondary btn-small" type="button" data-action="reset" data-index="${i}">Reset password</button></td>
        <td><button class="btn btn-secondary btn-small" type="button" data-action="edit" data-index="${i}">Edit</button></td>
        <td><button class="btn btn-danger btn-small" type="button" data-action="delete" data-index="${i}">Delete</button></td>
      </tr>`;
  }).join('') : '<tr><td colspan="8">No users found.</td></tr>';
}

function loadUserActivity() {
  ApiService.adminGetUserActivity().then(function (activity) {
    renderUserActivity(activity || {});
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not load user activity: ' + (err.message || err), 'error');
  });
}

function renderUserActivity(activity) {
  const totals = activity.totals || {};
  const statsEl = getEl('activityStats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="activity-stat"><span class="activity-stat-value">${totals.events || 0}</span><span class="activity-stat-label">Events (tracked)</span></div>
      <div class="activity-stat"><span class="activity-stat-value">${totals.logins || 0}</span><span class="activity-stat-label">Logins</span></div>
      <div class="activity-stat"><span class="activity-stat-value">${totals.activeUsers || 0}</span><span class="activity-stat-label">Active users</span></div>`;
  }
  const tbody = getEl('activityTableBody');
  if (tbody) {
    tbody.innerHTML = (activity.users || []).map(function (u) {
      return `
        <tr>
          <td class="preserve-whitespace">${escapeHtml(u.email)}</td>
          <td>${u.actions || 0}</td>
          <td>${u.logins || 0}</td>
          <td class="preserve-whitespace">${escapeHtml(u.lastSeenMs > 0 ? formatTimestamp(u.lastSeenMs) : (u.lastSeen || ''))}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="4">No activity recorded yet.</td></tr>';
  }
  const recent = getEl('activityRecentList');
  if (recent) {
    recent.innerHTML = (activity.recent || []).map(function (row) {
      return `
        <li class="activity-recent-item">
          <span class="badge" data-tone="muted">${escapeHtml(row.action)}</span>
          <span class="preserve-whitespace">${escapeHtml(row.user)}</span>
          <span class="preserve-whitespace activity-recent-time">${escapeHtml(formatTimestamp(row.timestampMs != null ? row.timestampMs : row.timestamp))}</span>
        </li>`;
    }).join('') || '<li class="activity-recent-item">No recent activity.</li>';
  }
}

function exportUsers() {
  if (!appState.isAdmin) { showToast('Admin access required', 'error'); return; }
  showOverlay('Preparing CSV…');
  ApiService.adminExportUsers().then(function (csv) {
    hideOverlay();
    downloadTextFile('IndiaPostDashboard_Users_' + new Date().toISOString().slice(0, 10) + '.csv', csv || '', 'text/csv;charset=utf-8');
    showToast('Users CSV downloaded', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Export failed: ' + (err.message || err), 'error');
  });
}

function importUsersFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const csv = String(e.target.result || '');
    if (!csv.trim()) { showToast('The file is empty', 'error'); return; }
    showOverlay('Importing users…');
    ApiService.adminImportUsers(csv).then(function (result) {
      hideOverlay();
      renderUsersTable((result && result.users) || []);
      const errors = (result && result.errors) || [];
      const summary = 'Imported: ' + (result.added || 0) + ' added, ' + (result.updated || 0) + ' updated' + (errors.length ? ', ' + errors.length + ' errors' : '');
      showToast(summary, errors.length ? 'warning' : 'success');
      if (errors.length) {
        console.warn('User import errors', errors);
      }
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Import failed: ' + (err.message || err), 'error');
    });
  };
  reader.readAsText(file);
}

function triggerUserImport() {
  const input = getEl('userImportFile');
  if (input) input.click();
}

function openEditUser(email) {
  const usersTable = getEl('usersTable');
  const tbody = usersTable ? usersTable.querySelector('tbody') : null;
  const users = JSON.parse((tbody && tbody.dataset.users) || '[]');
  const u = users.find(function (x) { return String(x.email).toLowerCase() === String(email).toLowerCase(); });
  if (!u) return;
  editUserOriginalEmail = String(email);
  getEl('editUserEmail').value = u.email;
  getEl('editUserUsername').value = u.username || '';
  getEl('editUserRole').value = u.role || 'VIEWER';
  getEl('editUserOffice').value = u.office || '';
  openDialog('editUserModal');
}

function closeEditUser() {
  closeDialog('editUserModal');
}

function isValidEmailList(value) {
  const list = String(value || '').split(',').map(function (e) { return e.trim(); }).filter(function (e) { return e; });
  if (!list.length) return false;
  return list.every(function (e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); });
}

function saveEditUser() {
  const emailEl = getEl('editUserEmail');
  const email = emailEl.value.trim();
  const fields = {
    email: email,
    username: getEl('editUserUsername').value.trim(),
    role: getEl('editUserRole').value,
    office: getEl('editUserOffice').value.trim()
  };
  if (!setFieldInvalid(emailEl, isValidEmailList(email) ? '' : 'Enter a valid email address.')) return;
  showOverlay('Saving user…');
  ApiService.adminUpdateUser(editUserOriginalEmail, fields).then(function (res) {
    hideOverlay();
    closeEditUser();
    const result = res || {};
    renderUsersTable(result.users || []);
    showToast(result.message || 'User updated', 'success');
    if (result.reAuth) {
      setAuthToken('');
      try { window.sessionStorage.setItem(STORAGE_REAUTH_MSG, 'Your email was changed. Please log in with your new email.'); } catch (err) {}
      window.location.reload();
    }
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Update failed: ' + (err.message || err), 'error');
  });
}

function handleAddUser(e) {
  e.preventDefault();
  if (!appState.isAdmin) { showToast('Admin access required', 'error'); return; }
  const emailEl = getEl('newUserEmail');
  const usernameEl = getEl('newUserUsername');
  const roleEl = getEl('newUserRole');
  const passwordEl = getEl('newUserPassword');
  const groupEl = getEl('newUserGroup');
  const departmentEl = getEl('newUserDepartment');
  const officeEl = getEl('newUserOffice');
  const email = emailEl.value.trim();
  const username = (usernameEl && usernameEl.value.trim()) || '';
  const role = roleEl.value;
  const password = passwordEl.value;
  const group = (groupEl && groupEl.value) || '';
  const department = (departmentEl && departmentEl.value) || '';
  const office = (officeEl && officeEl.value) || '';

  let valid = true;
  valid = setFieldInvalid(emailEl, isValidEmailList(email) ? '' : 'Enter a valid email address.') && valid;
  valid = setFieldInvalid(passwordEl, password.length >= 8 ? '' : 'Password must be at least 8 characters.') && valid;
  if (!valid) return;

  showOverlay('Adding user…');
  ApiService.adminAddUser(email, username, role, password, group, department, office).then(function (users) {
    hideOverlay();
    emailEl.value = '';
    if (usernameEl) usernameEl.value = '';
    passwordEl.value = '';
    if (groupEl) groupEl.value = '';
    if (departmentEl) departmentEl.value = '';
    if (officeEl) officeEl.value = '';
    const status = getEl('addUserStatus');
    status.textContent = 'User added';
    status.classList.add('success');
    setTimeout(function () {
      status.textContent = '';
      status.classList.remove('success');
    }, 3000);
    renderUsersTable(users || []);
    showToast('User added', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    const status = getEl('addUserStatus');
    status.textContent = err.message || 'Could not add user';
    status.classList.add('error');
  });
}

function handleChangePassword(e) {
  e.preventDefault();
  const currentEl = getEl('changeCurrentPassword');
  const newEl = getEl('changeNewPassword');
  const confirmEl = getEl('changeConfirmPassword');
  const current = currentEl.value;
  const np = newEl.value;
  const cp = confirmEl.value;

  let valid = true;
  valid = setFieldInvalid(currentEl, current ? '' : 'Enter your current password.') && valid;
  valid = setFieldInvalid(newEl, np.length >= 8 ? '' : 'Password must be at least 8 characters.') && valid;
  if (np !== cp) {
    setFieldInvalid(confirmEl, 'Passwords do not match.');
    valid = false;
  } else {
    setFieldInvalid(confirmEl, '');
  }
  if (!valid) return;

  showOverlay('Updating password…');
  ApiService.changePassword(current, np).then(function (res) {
    hideOverlay();
    const status = getEl('changePasswordStatus');
    if (res && res.success) {
      currentEl.value = '';
      newEl.value = '';
      confirmEl.value = '';
      appState.mustChange = false;
      getEl('mustChangeBanner').classList.add('hidden');
      status.textContent = (res && res.message) || 'Password updated';
      status.classList.add('success');
      showToast('Password updated', 'success');
      EventBus.emit('SettingsUpdated');
    } else {
      status.textContent = (res && res.message) || 'Could not update password';
      status.classList.add('error');
    }
    setTimeout(function () {
      status.textContent = '';
      status.classList.remove('success');
      status.classList.remove('error');
    }, 3500);
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    const status = getEl('changePasswordStatus');
    status.textContent = err.message || 'Could not update password';
    status.classList.add('error');
  });
}

function deleteUser(email) {
  showConfirm({
    title: 'Delete user',
    message: 'Delete user ' + email + '? They will no longer be able to sign in.',
    okLabel: 'Delete',
    danger: true
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Deleting user…');
    ApiService.adminDeleteUser(email).then(function (users) {
      hideOverlay();
      renderUsersTable(users || []);
      showToast('User deleted', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Delete failed: ' + (err.message || err), 'error');
    });
  });
}

function resetUserPassword(email) {
  const newPassword = prompt('New password for ' + email + ' (min 8 characters):');
  if (!newPassword) return;
  showOverlay('Resetting password…');
  ApiService.adminResetPassword(email, newPassword).then(function (users) {
    hideOverlay();
    renderUsersTable(users || []);
    showToast('Password reset for ' + email, 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Reset failed: ' + (err.message || err), 'error');
  });
}

/* ---------------------------------- CSV Import (drag-and-drop) ---------------------------------- */
/* Admin/editor can drag a CSV file onto the drop zone (or click to browse).
   The file is parsed, sent to the server, and records are imported. */

function wireCsvImportDropZone() {
  var dropZone = getEl('csvImportDropZone');
  if (!dropZone) return; // not on this page

  dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) handleCsvFileImport(files[0]);
  });

  // Click to browse
  dropZone.addEventListener('click', function (e) {
    if (e.target.tagName === 'INPUT') return; // don't double-trigger
    var fileInput = getEl('csvImportFileInput');
    if (fileInput) fileInput.click();
  });
}

function handleCsvFileImport(file) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  if (!file) return;
  if (!file.name.match(/\.csv$/i)) {
    showToast('Please select a .csv file.', 'error');
    return;
  }
  var status = getEl('csvImportStatus');
  if (status) { status.textContent = 'Reading file…'; status.className = 'form-status'; }
  var reader = new FileReader();
  reader.onload = function (e) {
    var csvText = e.target.result;
    if (!csvText || !csvText.trim()) {
      if (status) { status.textContent = 'File is empty.'; status.className = 'form-status error'; }
      return;
    }
    if (status) { status.textContent = 'Importing records…'; status.className = 'form-status'; }
    showOverlay('Importing CSV…');
    ApiService.adminImportCsv(csvText).then(function (result) {
      hideOverlay();
      if (!result || !result.success) {
        var msg = (result && result.message) || 'Import failed.';
        if (status) { status.textContent = msg; status.className = 'form-status error'; }
        showToast(msg, 'error');
        return;
      }
      var lines = [result.added + ' record(s) imported successfully.'];
      if (result.errors && result.errors.length) {
        lines.push(result.errors.length + ' error(s): ' + result.errors.slice(0, 3).join('; '));
      }
      var msg = lines.join(' ');
      if (status) { status.textContent = msg; status.className = 'form-status success'; }
      showToast(msg, result.errors && result.errors.length ? 'warning' : 'success');
      refreshData();
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      var msg = 'Import failed: ' + (err.message || err);
      if (status) { status.textContent = msg; status.className = 'form-status error'; }
      showToast(msg, 'error');
    });
  };
  reader.readAsText(file);
}

function handleCsvFileInputChange(e) {
  var file = e.target && e.target.files && e.target.files[0];
  if (file) handleCsvFileImport(file);
  // Reset the input so the same file can be re-selected
  e.target.value = '';
}

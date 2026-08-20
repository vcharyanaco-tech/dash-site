
/* ---------------------------------- About ---------------------------------- */

function openAbout() {
  getEl('aboutVersion').textContent = APP_VERSION;
  // Build row shows the last update date (when the dashboard data was last
  // changed) rather than a hardcoded build string; falls back to APP_BUILD.
  getEl('aboutBuild').textContent = appState.lastUpdated || APP_BUILD;
  openDialog('aboutModal');
  getEl('profileDropdown').classList.remove('open');
}

function closeAbout() {
  closeDialog('aboutModal');
}

/* ---------------------------------- Offline ---------------------------------- */

function updateOfflineBanner() {
  const banner = getEl('offlineBanner');
  if (banner) banner.classList.toggle('hidden', navigator.onLine);
}

/* ---------------------------------- Event wiring ---------------------------------- */

function wireGlobalEvents() {
  const searchInput = getEl('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(function () {
      appState.searchQuery = searchInput.value.trim();
      updateFilterChips();
      renderDashboard();
    }, 180));
  }

  const notifList = getEl('notifList');
  if (notifList) {
    notifList.addEventListener('click', function (e) {
      const item = e.target.closest('.notif-item');
      if (!item) return;
      openNotification(item.getAttribute('data-notif-id'), item.getAttribute('data-notif-type'));
    });
  }

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      const palette = getEl('commandPalette');
      if (palette && !palette.classList.contains('hidden')) {
        const input = getEl('searchInput');
        if (input) { input.focus(); input.select(); }
      } else {
        openCommandPalette();
      }
    }
    if (e.key === 'Escape') {
      closeDropdowns();
      const profileDropdown = getEl('profileDropdown');
      if (profileDropdown && profileDropdown.classList.contains('open')) {
        profileDropdown.classList.remove('open');
        const trigger = getEl('profileTrigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
      closeNotificationsPanel();
      const confirmModal = getEl('confirmModal');
      if (confirmModal && !confirmModal.classList.contains('hidden')) {
        cancelConfirmDialog();
        return;
      }
      ['editModal', 'aboutModal', 'submissionsModal', 'recordDetailModal', 'editUserModal', 'taskModal', 'columnModal', 'commandPalette', 'previewModal', 'linkModal', 'syncPreviewModal'].forEach(function (id) {
        const el = getEl(id);
        if (el && !el.classList.contains('hidden')) closeDialog(id);
      });
      const meetingModal = getEl('meetingNotesModal');
      if (meetingModal && !meetingModal.classList.contains('hidden')) closeMeetingNotes();
      document.body.classList.remove('sidebar-open');
      const backdrop = getEl('sidebarBackdrop');
      if (backdrop) backdrop.classList.add('hidden');
    }
  });

  document.addEventListener('click', function (event) {
    ['review-dropdown-menu', 'menu-dropdown-menu'].forEach(function (cls) {
      document.querySelectorAll('.' + cls + '.open').forEach(function (menu) {
        if (!menu.parentElement.contains(event.target)) menu.classList.remove('open');
      });
    });
    const profileDropdown = getEl('profileDropdown');
    const profileMenu = getEl('profileMenu');
    if (profileDropdown && profileMenu && profileDropdown.classList.contains('open') && !profileMenu.contains(event.target)) {
      profileDropdown.classList.remove('open');
      const trigger = getEl('profileTrigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
    const notifPanel = getEl('notifPanel');
    const notifMenu = getEl('notifMenu');
    if (notifPanel && notifMenu && !notifPanel.classList.contains('hidden') && !notifMenu.contains(event.target)) {
      closeNotificationsPanel();
    }
  });

  document.querySelectorAll('.modal-backdrop').forEach(function (backdrop) {
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) {
        if (backdrop.id === 'editModal') closeEditModal();
        else if (backdrop.id === 'aboutModal') closeAbout();
        else if (backdrop.id === 'submissionsModal') closeSubmissionsModal();
        else if (backdrop.id === 'recordDetailModal') closeRecordDetail();
        else if (backdrop.id === 'editUserModal') closeEditUser();
        else if (backdrop.id === 'confirmModal') cancelConfirmDialog();
        else if (backdrop.id === 'previewModal') closeLinkPreview();
        else if (backdrop.id === 'linkModal') closeLinkModal();
        else if (backdrop.id === 'meetingNotesModal') closeMeetingNotes();
      }
    });
  });

  const dashboardTable = getEl('dashboardTable');
  if (dashboardTable) {
    dashboardTable.querySelectorAll('thead th[data-dash-sort]').forEach(function (th) {
      th.classList.add('sortable');
      th.addEventListener('click', function () {
        setDashSort(th.getAttribute('data-dash-sort'));
      });
    });
    const dashTbody = dashboardTable.querySelector('tbody');
    if (dashTbody) {
      dashTbody.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        const tr = e.target.closest('tr[data-row]');
        if (tr) openRecordDetail(tr.getAttribute('data-row'));
      });
      dashTbody.addEventListener('keydown', function (e) {
        const focused = document.activeElement;
        if (!focused || focused.tagName !== 'TR') return;
        const rows = Array.from(dashTbody.querySelectorAll('tr[data-row]'));
        const idx = rows.indexOf(focused);
        if (e.key === 'ArrowDown' && idx < rows.length - 1) { rows[idx + 1].focus(); e.preventDefault(); }
        if (e.key === 'ArrowUp' && idx > 0) { rows[idx - 1].focus(); e.preventDefault(); }
        if (e.key === 'Enter' || e.key === ' ') { openRecordDetail(focused.getAttribute('data-row')); e.preventDefault(); }
      });
    }
  }

  const auditTable = getEl('auditTable');
  if (auditTable) {
    auditTable.querySelectorAll('thead th[data-sort]').forEach(function (th) {
      th.classList.add('sortable');
      th.addEventListener('click', function () {
        setAuditSort(th.getAttribute('data-sort'));
      });
    });
  }

  const usersTable = getEl('usersTable');
  if (usersTable) {
    usersTable.addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const tbody = usersTable.querySelector('tbody');
      const users = JSON.parse((tbody && tbody.dataset.users) || '[]');
      const user = users[Number(btn.dataset.index)];
      if (!user) return;
      if (btn.dataset.action === 'delete') deleteUser(user.email);
      else if (btn.dataset.action === 'reset') resetUserPassword(user.email);
      else if (btn.dataset.action === 'edit') openEditUser(user.email);
    });
  }

  ['loginForm', 'forgotForm', 'changePasswordForm', 'addUserForm', 'editForm'].forEach(function (id) {
    const form = getEl(id);
    if (form) wireFieldClearing(form);
  });

  window.addEventListener('offline', updateOfflineBanner);
  window.addEventListener('online', function () {
    updateOfflineBanner();
    showToast('You are back online', 'info');
  });
}

wireGlobalEvents();
wireEmbeddedLinkPreview();
wirePreviewPinch();
window.addEventListener('load', initApp);

/* ============================ ENTERPRISE ADDONS ============================ */
window.EnterpriseAddons = window.EnterpriseAddons || {};

window.EnterpriseAddons.downloadTaskIcs = function (taskId) {
  const task = (appState.tasks || []).find(function (t) { return String(t.id) === String(taskId); });
  if (!task) {
    showToast('Task not found.', 'error');
    return;
  }
  const d = task.dueDate ? new Date(task.dueDate) : new Date();
  const two = function (n) { return (n < 10 ? '0' : '') + n; };
  const dateOnly = d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate());
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const title = (task.title || 'Task').replace(/[^a-zA-Z0-9 \-]/g, '').replace(/ /g, '_');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//India Post Dashboard//Task//EN',
    'BEGIN:VEVENT',
    'UID:task-' + taskId + '-' + dateOnly,
    'DTSTAMP:' + stamp,
    'DTSTART;VALUE=DATE:' + dateOnly,
    'SUMMARY:' + (task.title || 'Task'),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n') + '\r\n';
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = title + '.ics';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Calendar file downloaded.', 'success');
};

window.EnterpriseAddons.completeTaskOffline = function (taskId) {
  if (navigator.onLine) { completeTask(taskId); return; }
  if (window.OfflineQueue && window.OfflineQueue.enqueue) {
    window.OfflineQueue.enqueue('updateTask', [taskId, { status: 'DONE' }]).then(function () {
      showToast('Queued offline: task completion.', 'info');
    });
  } else {
    showToast('Offline queue not available.', 'error');
  }
};

window.EnterpriseAddons.submitRecordOffline = function (payload) {
  if (window.OfflineQueue && window.OfflineQueue.enqueue) {
    window.OfflineQueue.enqueue('addItem', [payload || {}]).then(function () {
      showToast('Queued offline: record submission.', 'info');
    });
  } else {
    showToast('Offline queue not available.', 'error');
  }
};

window.EnterpriseAddons.syncOfflineQueue = function () {
  if (window.OfflineQueue && window.OfflineQueue.flush) {
    return window.OfflineQueue.flush();
  }
  return Promise.resolve({ flushed: 0 });
};

function wireEnterpriseButtons() {
  document.addEventListener('click', function (event) {
    const icsButton = event.target.closest('[data-download-ics]');
    const completeButton = event.target.closest('[data-complete-task-offline]');

    if (icsButton && window.EnterpriseAddons) {
      EnterpriseAddons.downloadTaskIcs(icsButton.getAttribute('data-download-ics'));
    }

    if (completeButton && window.EnterpriseAddons) {
      EnterpriseAddons.completeTaskOffline(completeButton.getAttribute('data-complete-task-offline'));
    }
  });
}

wireEnterpriseButtons();

/* ---------------------------------- Push Notifications ---------------------------------- */
/* Registers the service worker for Web Push and subscribes to review
   deadline notifications. Push is opt-in: the user must click the bell
   icon in Settings to enable it. Requires VAPID_PUBLIC_KEY env var on
   the server. */

function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return; // Browser doesn't support push
  }
  navigator.serviceWorker.ready.then(function (reg) {
    return reg.pushManager.getSubscription();
  }).then(function (sub) {
    if (sub) {
      appState.pushSubscription = sub;
    }
  }).catch(function () {});
}

function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('Push notifications are not supported in this browser.', 'warning');
    return;
  }
  if (!('Notification' in window)) {
    showToast('Notifications API is not available.', 'warning');
    return;
  }
  Notification.requestPermission().then(function (perm) {
    if (perm !== 'granted') {
      showToast('Notification permission denied.', 'warning');
      return;
    }
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: getVapidPublicKey_()
      });
    }).then(function (sub) {
      appState.pushSubscription = sub;
      ApiService.subscribePush(getAuthToken(), sub.toJSON()).then(function () {
        showToast('Push notifications enabled!', 'success');
      }).catch(function (err) {
        showToast('Could not save push subscription: ' + (err.message || err), 'error');
      });
    }).catch(function (err) {
      showToast('Push subscription failed: ' + (err.message || err), 'error');
    });
  });
}

function unsubscribeFromPushNotifications() {
  if (appState.pushSubscription) {
    var endpoint = appState.pushSubscription.endpoint;
    appState.pushSubscription.unsubscribe().then(function () {
      appState.pushSubscription = null;
      return ApiService.unsubscribePush(getAuthToken(), endpoint);
    }).then(function () {
      showToast('Push notifications disabled.', 'info');
    }).catch(function () {});
  }
}

function getVapidPublicKey_() {
  // The VAPID public key must be configured on the server.
  // This is a placeholder — replace with the actual key.
  var keyEl = getEl('vapidPublicKey');
  if (keyEl) return new Uint8Array(JSON.parse(keyEl.textContent));
  return null;
}

/* ---------------------------------- Hindi / English toggle ---------------------------------- */
/* Adds a language toggle to the Settings tab. When switched, all [data-i18n]
   elements are re-translated and the preference is persisted in localStorage. */

function toggleLanguage() {
  var current = (typeof i18n !== 'undefined') ? i18n.getLanguage() : 'en';
  var next = current === 'en' ? 'hi' : 'en';
  if (typeof i18n !== 'undefined') {
    i18n.setLanguage(next);
    i18n.applyTranslations();
  }
  showToast(next === 'hi' ? 'भाषा हिन्दी में बदली' : 'Language set to English', 'success');
}

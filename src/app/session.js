
/* ---------------------------------- Auth helpers ---------------------------------- */

function isAuthError(message) {
  const msg = String(message || '');
  return msg.indexOf('Login required') !== -1 ||
    msg.indexOf('Session expired') !== -1 ||
    msg.indexOf('Please log in') !== -1 ||
    // Server-side token validators reject anonymous calls with
    // 'getAppData requires (token)' & co — these must route the user to
    // the login screen, not to the "Error loading app" panel.
    /requires \(.*token\)/i.test(msg);
}

function handleServerFailure(err) {
  hideOverlay();
  const msg = err && err.message ? err.message : String(err || 'Unknown error');
  if (isAuthError(msg)) {
    showScreen('login');
    showToast('Session expired. Please log in again.', 'warning');
    return true;
  }
  return false;
}

/* ---------------------------------- Screens ---------------------------------- */

function showScreen(screen) {
  ['login', 'forgot'].forEach(name => {
    const el = getEl(name + 'Screen');
    if (el) el.classList.add('hidden');
  });
  const target = getEl(screen + 'Screen');
  if (target) target.classList.remove('hidden');
}

function showAuthMessage(elementId, message) {
  const el = getEl(elementId);
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('hidden', !message);
}

/* ---------------------------------- Theme ---------------------------------- */

function applyTheme() {
  appState.darkMode = window.localStorage.getItem(STORAGE_THEME) === 'true';
  document.body.classList.toggle('dark-mode', appState.darkMode);
  const moon = getEl('iconMoon');
  const sun = getEl('iconSun');
  if (moon && sun) {
    moon.classList.toggle('hidden', appState.darkMode);
    sun.classList.toggle('hidden', !appState.darkMode);
  }
}

function toggleDarkMode() {
  appState.darkMode = !appState.darkMode;
  window.localStorage.setItem(STORAGE_THEME, String(appState.darkMode));
  applyTheme();
}

/* ---------------------------------- Sidebar ---------------------------------- */

function applySidebarPref() {
  const collapsed = window.localStorage.getItem(STORAGE_SIDEBAR) === '1';
  document.body.classList.toggle('sidebar-collapsed', collapsed);
}

function toggleSidebar() {
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  if (mobile) {
    const open = document.body.classList.toggle('sidebar-open');
    const backdrop = getEl('sidebarBackdrop');
    if (backdrop) backdrop.classList.toggle('hidden', !open);
  } else {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    window.localStorage.setItem(STORAGE_SIDEBAR, collapsed ? '1' : '0');
  }
}

/* ---------------------------------- Profile menu ---------------------------------- */

function toggleProfileMenu() {
  const dropdown = getEl('profileDropdown');
  const trigger = getEl('profileTrigger');
  const open = dropdown.classList.toggle('open');
  if (trigger) trigger.setAttribute('aria-expanded', String(open));
}

function renderProfile() {
  const user = appState.user || {};
  const email = user.email || '';
  const username = (user.username || '').trim();
  const role = user.role || 'VIEWER';
  const name = username || (email ? email.split('@')[0] : 'Guest');
  const initial = (username || email) ? (username || email).charAt(0).toUpperCase() : '?';
  const tone = role === 'ADMIN' ? 'danger' : (role === 'EDITOR' ? 'accent' : 'muted');

  const avatar = getEl('profileAvatar');
  if (avatar) avatar.textContent = initial;
  const nameEl = getEl('profileName');
  if (nameEl) nameEl.textContent = user.loggedIn ? name : 'Not signed in';
  const roleEl = getEl('profileRole');
  if (roleEl) roleEl.textContent = user.loggedIn ? role : '—';
  const emailEl = getEl('profileEmail');
  if (emailEl) emailEl.textContent = user.loggedIn ? email : 'Not signed in';
  const badge = getEl('profileRoleBadge');
  if (badge) {
    badge.textContent = user.loggedIn ? role : 'Guest';
    badge.setAttribute('data-tone', tone);
  }

  const addButton = getEl('addButton');
  if (addButton) addButton.style.display = appState.isEditor ? 'inline-flex' : 'none';
  const showHiddenWrap = getEl('showHiddenWrap');
  if (showHiddenWrap) showHiddenWrap.classList.toggle('hidden', !appState.isEditor);
  const meetingBtn = getEl('meetingNotesBtn');
  if (meetingBtn) meetingBtn.style.display = appState.isAdmin ? 'inline-flex' : 'none';
  updateMarkAllSubmissionsReadBtn();
}

// Show the "Mark all as read" action only to admins while at least one card
// badge is flashing; hide it once everything is read (or for non-admins).
function updateMarkAllSubmissionsReadBtn() {
  const btn = getEl('markAllSubmissionsReadBtn');
  if (!btn) return;
  const anyFlash = appState.isAdmin && Object.keys(appState.submissionFlash || {}).some(function (k) { return appState.submissionFlash[k]; });
  btn.style.display = anyFlash ? 'inline-flex' : 'none';
}

/* ---------------------------------- Notifications ---------------------------------- */

const NOTIF_TYPE_LABELS = {
  record: 'Records',
  submission: 'Submissions',
  user: 'User',
  system: 'System'
};
const NOTIF_TYPE_ORDER = ['record', 'submission', 'user', 'system'];

function loadNotifications(silent) {
  return ApiService.getMyNotifications().then(function (data) {
    appState.notifications = data || { unread: 0, recent: [] };
    appState.notifPrefs = (data && data.prefs) || null;
    renderNotifications();
    renderNotificationPrefsControls();
  }).catch(function (err) {
    if (!silent && handleServerFailure(err)) return;
  });
}

/* Group a notification list by type (stable by NOTIF_TYPE_ORDER). Returns an
   array of { type, label, items } for the dropdown / notification center. */
function groupNotifications_(items) {
  const groups = [];
  NOTIF_TYPE_ORDER.forEach(function (type) {
    const grouped = (items || []).filter(function (n) { return String(n.type || 'system') === type; });
    if (grouped.length) groups.push({ type: type, label: NOTIF_TYPE_LABELS[type] || type, items: grouped });
  });
  return groups;
}

function notifPriorityClass_(n) {
  return Number(n && n.priority) >= 1 ? ' notif-priority-high' : '';
}

function notifActionHtml_(n) {
  const parts = [];
  if (!n.readAt) {
    parts.push('<button class="btn btn-ghost btn-small notif-mark-read" type="button" onclick="event.stopPropagation(); markNotificationRead(\'' + escAttr(n.id) + '\')">Mark read</button>');
  }
  parts.push('<button class="btn btn-secondary btn-small" type="button" onclick="event.stopPropagation(); openNotification(\'' + escAttr(n.id) + '\', \'' + escAttr(n.type || 'system') + '\', \'' + escAttr(String(n.recordRow || 0)) + '\')">' +
    (Number(n.recordRow || 0) ? 'Open record' : 'Open') + '</button>');
  parts.push('<button class="btn btn-ghost btn-small" type="button" onclick="event.stopPropagation(); snoozeNotificationUi(\'' + escAttr(n.id) + '\',60)">Snooze</button>');
  parts.push('<button class="btn btn-ghost btn-small" type="button" onclick="event.stopPropagation(); dismissNotificationUi(\'' + escAttr(n.id) + '\')">Dismiss</button>');
  return parts.join('');
}

function renderNotifications() {
  const n = appState.notifications || { unread: 0, recent: [] };
  const badge = getEl('notifBadge');
  if (badge) {
    badge.textContent = n.unread > 99 ? '99+' : String(n.unread || 0);
    badge.classList.toggle('hidden', !n.unread);
    badge.setAttribute('aria-hidden', String(!n.unread));
  }
  const list = getEl('notifList');
  const empty = getEl('notifEmpty');
  const recent = n.recent || [];
  if (list) {
    const groups = groupNotifications_(recent);
    list.innerHTML = groups.map(function (g) {
      return '<li class="notif-group" role="group" aria-label="' + escAttr(g.label) + '">' +
        '<div class="notif-group-title">' + escapeHtml(g.label) + ' <span class="notif-group-count">' + g.items.length + '</span></div>' +
        '<ul class="notif-group-list">' + g.items.map(function (item) {
          const unreadClass = item.readAt ? '' : ' notif-item-unread';
          const unreadTag = item.readAt ? '' : '<span class="notif-unread-tag">Unread</span>';
          return '<li class="notif-item' + unreadClass + notifPriorityClass_(item) + '" data-notif-id="' + escAttr(String(item.id || '')) + '" data-notif-type="' + escAttr(String(item.type || 'system')) + '">' +
            '<div class="notif-item-title">' + unreadTag + (Number(item.priority) >= 1 ? '<span class="notif-urgent" title="Urgent">&#9888;</span> ' : '') + escapeHtml(item.title) + '</div>' +
            '<div class="notif-item-body">' + escapeHtml(item.body) + '</div>' +
            '<div class="notif-item-meta"><span class="notif-item-time">' + escapeHtml(formatNotifTime(item.createdAt)) + '</span>' +
            '<span class="notif-item-actions">' + notifActionHtml_(item) + '</span></div>' +
            '</li>';
        }).join('') + '</ul></li>';
    }).join('') || '<li class="notif-item-empty">No notifications yet.</li>';
  }
  if (empty) empty.classList.toggle('hidden', !!(recent && recent.length));
}

function openNotificationCenter() {
  closeNotificationsPanel();
  loadNotifications(true).then(function () {
    if (getEl('notifCenterModal')) {
      openDialog('notifCenterModal');
      renderNotificationCenter('all');
    }
  });
}

function closeNotificationCenter() {
  closeDialog('notifCenterModal');
}

function renderNotificationCenter(filter) {
  const view = appState.notifications || { unread: 0, recent: [], history: [] };
  const byTypeRemaining = Object.assign({}, view.byTypeUnread || {});
  const list = getEl('notifCenterList');
  const unreadAll = view.unread || 0;
  const counter = getEl('notifCenterCounter');
  if (counter) counter.textContent = unreadAll ? unreadAll + ' unread' : 'No unread notifications';

  let items = (view.history || view.recent || []).slice();
  if (filter === 'unread') items = items.filter(function (i) { return !i.readAt; });
  if (filter !== 'all' && filter !== 'unread' && NOTIF_TYPE_LABELS[filter]) {
    items = items.filter(function (i) { return String(i.type) === filter; });
  }

  const groups = groupNotifications_(items);
  list.innerHTML = groups.map(function (g) {
    const unread = byTypeRemaining[g.type] || 0;
    return '<div class="notif-center-group">' +
      '<div class="notif-center-group-head">' +
      '<span class="text-subheading">' + escapeHtml(g.label) + '</span>' +
      (unread ? '<span class="notif-center-unread">' + unread + ' unread</span>' : '') +
      '<button class="btn btn-ghost btn-small" type="button" onclick="markTypeRead(\'' + escAttr(g.type) + '\')">Mark group read</button>' +
      '</div>' +
      '<ul class="notif-center-group-list">' + g.items.map(notifCenterItemHtml_).join('') + '</ul>' +
      '</div>';
  }).join('') || '<div class="notif-center-empty">No notifications in this view.</div>';
  renderNotificationPrefsControls();
}

function notifCenterItemHtml_(item) {
  const unreadClass = item.readAt ? '' : ' notif-item-unread';
  const unreadTag = item.readAt ? '' : '<span class="notif-unread-tag">Unread</span>';
  return '<li class="notif-item' + unreadClass + notifPriorityClass_(item) + '" data-notif-id="' + escAttr(String(item.id || '')) + '">' +
    '<div class="notif-item-title">' + unreadTag + (Number(item.priority) >= 1 ? '<span class="notif-urgent" title="Urgent">&#9888;</span> ' : '') + escapeHtml(item.title) + '</div>' +
    '<div class="notif-item-body">' + escapeHtml(item.body) + '</div>' +
    '<div class="notif-item-meta"><span class="notif-item-time">' + escapeHtml(formatTimestamp(item.createdAt)) + '</span>' +
    '<span class="notif-item-actions">' + notifActionHtml_(item) + '</span></div>' +
    '</li>';
}

function renderNotificationPrefsControls() {
  const prefs = appState.notifPrefs;
  const wrap = getEl('notifPrefs');
  if (!wrap || !prefs) return;
  const defs = [['record', 'Record updates'], ['submission', 'Submissions'], ['user', 'User / account'], ['system', 'System']];
  wrap.innerHTML = '<div class="notif-prefs-grid">' + defs.map(function (d) {
      const key = d[0];
      return '<label class="notif-pref-item"><input type="checkbox" data-notif-pref-type="' + key + '" ' + (prefs[key] ? 'checked' : '') + ' onchange="setNotifPref(this)">' +
        '<span>' + escapeHtml(d[1]) + '</span></label>';
    }).join('') +
    '<label class="notif-pref-item"><input type="checkbox" data-notif-pref-type="push" ' + (prefs.push ? 'checked' : '') + ' onchange="setNotifPref(this)" data-notif-pref-push="1">' +
    '<span>Push notifications</span></label></div>';
}

function setNotifPref(input) {
  const type = input.getAttribute('data-notif-pref-type');
  if (!type) return;
  const isPush = input.hasAttribute('data-notif-pref-push');
  if (isPush) {
    if (input.checked) {
      subscribeToPushNotifications();
    } else {
      unsubscribeFromPushNotifications();
    }
  }
  const next = Object.assign({}, appState.notifPrefs || {});
  next[type] = !!input.checked;
  ApiService.setNotificationPrefs(next).then(function (data) {
    appState.notifPrefs = (data && data.prefs) || next;
    showToast('Notification preference saved.', 'success');
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    input.checked = !input.checked;
    showToast('Could not save preference: ' + (err.message || err), 'error');
  });
}

function markNotificationRead(id) {
  if (!id) return;
  ApiService.markNotificationsRead([id]).then(function (data) {
    appState.notifications = data || { unread: 0, recent: [] };
    appState.notifPrefs = (data && data.prefs) || appState.notifPrefs;
    renderNotifications();
    if (!getEl('notifCenterModal').classList.contains('hidden')) renderNotificationCenter(currentNotifCenterFilter_());
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

function markTypeRead(type) {
  if (!type) return;
  ApiService.markNotificationsRead([type]).then(function (data) {
    appState.notifications = data || { unread: 0, recent: [] };
    appState.notifPrefs = (data && data.prefs) || appState.notifPrefs;
    renderNotifications();
    if (!getEl('notifCenterModal').classList.contains('hidden')) renderNotificationCenter(currentNotifCenterFilter_());
    showToast('Notifications marked as read.', 'success');
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

function currentNotifCenterFilter_() {
  const active = document.querySelector('.notif-center-filter.active');
  return active ? active.getAttribute('data-notif-filter') || 'all' : 'all';
}

function setNotifCenterFilter(filter) {
  document.querySelectorAll('.notif-center-filter').forEach(function (b) { b.classList.remove('active'); });
  const match = document.querySelector('.notif-center-filter[data-notif-filter="' + filter + '"]');
  if (match) match.classList.add('active');
  renderNotificationCenter(filter);
}

function formatNotifTime(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - Number(ts)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return formatTimestamp(ts);
}

// Formats an epoch-ms timestamp as dd.MM.yyyy HH:mm (matches the project's
// dd.MM.yyyy date style used for record dates). Returns '' for invalid input.
function formatTimestamp(ts) {
  if (!ts) return '';
  const n = Number(ts);
  if (!isFinite(n) || n <= 0) return String(ts);
  const d = new Date(n);
  if (isNaN(d.getTime())) return String(ts);
  const pad = function (v) { return String(v).padStart(2, '0'); };
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function toggleNotifications() {
  const panel = getEl('notifPanel');
  if (!panel) return;
  const open = panel.classList.toggle('hidden');
  const trigger = getEl('notifTrigger');
  if (trigger) trigger.setAttribute('aria-expanded', String(!open));
  if (!open) loadNotifications(true);
}

function closeNotificationsPanel() {
  const panel = getEl('notifPanel');
  if (panel) panel.classList.add('hidden');
  const trigger = getEl('notifTrigger');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function markAllNotificationsRead() {
  ApiService.markNotificationsRead('all').then(function (data) {
    appState.notifications = data || { unread: 0, recent: [] };
    appState.notifPrefs = (data && data.prefs) || appState.notifPrefs;
    renderNotifications();
    if (!getEl('notifCenterModal').classList.contains('hidden')) renderNotificationCenter(currentNotifCenterFilter_());
    showToast('All notifications marked as read.', 'success');
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not update notifications: ' + (err.message || err), 'error');
  });
}

function clearAllNotifications() {
  ApiService.clearMyNotifications().then(function (data) {
    appState.notifications = data || { unread: 0, recent: [] };
    appState.notifPrefs = (data && data.prefs) || appState.notifPrefs;
    renderNotifications();
    if (!getEl('notifCenterModal').classList.contains('hidden')) renderNotificationCenter(currentNotifCenterFilter_());
    showToast('All notifications cleared.', 'success');
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not clear notifications: ' + (err.message || err), 'error');
  });
}

function openNotification(id, type, recordRow) {
  if (!id) {
    closeNotificationsPanel();
    return;
  }
  const readP = ApiService.markNotificationsRead([id]).then(function (data) {
    appState.notifications = data || { unread: 0, recent: [] };
    appState.notifPrefs = (data && data.prefs) || appState.notifPrefs;
    renderNotifications();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
  closeNotificationsPanel();
  if (recordRow && Number(recordRow) > 0) {
    const targetRow = Number(recordRow);
    const found = (appState.items || []).some(function (i) { return String(i.row) === String(targetRow); });
    if (found) {
      readP.then(function () { openRecordDetail(targetRow); });
    } else {
      readP.then(function () {
        return ApiService.getAppData().then(function (data) {
          applyAppData(data);
          renderDashboard(true);
          openRecordDetail(targetRow);
        }).catch(function (err) {
          if (handleServerFailure(err)) return;
          openTab('dashboard');
        });
      });
    }
    return;
  }
  const map = { record: 'dashboard', submission: 'dashboard', user: 'settings', system: 'dashboard' };
  readP.then(function () { openTab(map[type] || 'dashboard'); });
}

/* ---------------------------------- Tabs ---------------------------------- */

/* Part 4 — information architecture: the sidebar is grouped into
   Overview / Work / Insights / Admin. Items carry data-perm when the module
   permission map gates them (e.g. Audit is editor/admin + the Auditor group);
   a group label is hidden when every item in it is hidden, so viewers never
   see an empty "Admin" heading. Settings stays visible to all roles because it
   also holds personal controls (password change, theme, push preferences). */
function applyNavPermissions() {
  document.querySelectorAll('.nav-item[data-perm]').forEach(function (btn) {
    btn.classList.toggle('hidden', !can(btn.getAttribute('data-perm'), 'view'));
  });
  document.querySelectorAll('.sidebar-section-label[data-group-label]').forEach(function (label) {
    const group = label.getAttribute('data-group-label');
    const items = document.querySelectorAll('.nav-item[data-group="' + group + '"]');
    const anyVisible = Array.prototype.some.call(items, function (btn) {
      return !btn.classList.contains('hidden');
    });
    label.classList.toggle('hidden', items.length > 0 && !anyVisible);
  });
}

function openTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(function (btn) {
    btn.classList.remove('active');
    btn.removeAttribute('aria-current');
  });
  const panel = getEl(tabId);
  if (panel) panel.classList.remove('hidden');
  const nav = document.querySelector('.nav-item[data-tab="' + tabId + '"]');
  if (nav) {
    nav.classList.add('active');
    nav.setAttribute('aria-current', 'page');
  }
  if (tabId === 'analytics') renderAnalytics();
  if (tabId === 'audit') renderAuditPanel();
  if (tabId === 'reports') renderReportPreview();
  if (tabId === 'settings') renderSettings();
  if (tabId === 'dashboard') renderDashboard();
  if (tabId === 'tasks') renderTasks();
  if (tabId === 'myday') renderMyDay();
}

/* ---------------------------------- Auth flows ---------------------------------- */

function initApp() {
  startLiveClock();
  initDatePicker();

  // Initialize multi-select chip components (event delegation, survives innerHTML rebuilds)
  initMultiSelect('editResponsibilityMs', 'editResponsibility', 'Select...');
  initMultiSelect('taskAssigneeMs', 'taskAssignee', 'Select...');

  // Column-resize handles for every static data table (records, audit,
  // users, activity, tasks). Handlers attach once — the header cells persist
  // across tbody re-renders, so the widths keep working after any refresh.
  document.querySelectorAll('.data-table').forEach(function (t) { makeTableResizable_(t); });

  // Drag-resize grip on every modal window. The chosen size is remembered
  // per dialog id and re-applied in openDialog.
  document.querySelectorAll('.modal-card').forEach(function (card) { makeModalResizable_(card); });

  // Drag-resize for the inline analyze/AI panels. Delegated on document
  // because the panels are re-created on every refresh; the size is stored in
  // the persisted panel state so it survives re-renders.
  document.addEventListener('mousedown', function (e) {
    const grip = e.target && e.target.closest ? e.target.closest('.panel-resize-grip') : null;
    if (!grip) return;
    const panel = grip.closest('.card-ai-panel');
    if (!panel) return;
    const rowEl = panel.closest('[data-row]');
    if (!rowEl) return;
    const row = String(rowEl.getAttribute('data-row'));
    const isLink = panel.classList.contains('card-link-panel');
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    const startW = rect.width, startH = rect.height;
    const parent = panel.parentElement;
    // In table view the panel lives inside the records-table window; grow /
    // shrink that window with the panel so the analyze table is never
    // clipped by the window's max-height (the previous "limits at a
    // fraction" behaviour).
    const scroller = panel.closest('.table-scroll');
    const startScrollH = scroller ? scroller.getBoundingClientRect().height : 0;
    // Inner table window: the analyze table wrap follows the panel height.
    const wrap = panel.querySelector('.card-ai-table-wrap');
    const startWrapTop = wrap ? (wrap.getBoundingClientRect().top - panel.getBoundingClientRect().top) : 0;
    const maxW = parent ? Math.max(240, parent.clientWidth - 16) : window.innerWidth - 32;
    document.body.classList.add('modal-resizing');
    grip.classList.add('active');
    function onMove(ev) {
      const w = Math.max(240, Math.min(maxW, startW + (ev.clientX - startX)));
      const h = Math.max(140, Math.min(window.innerHeight - 12, startH + (ev.clientY - startY)));
      panel.style.width = w + 'px';
      panel.style.maxWidth = 'none';
      panel.style.height = h + 'px';
      panel.style.maxHeight = 'none';
      // Inner analyze table follows the panel height (expand + contract).
      if (wrap) {
        wrap.style.maxHeight = 'none';
        wrap.style.height = Math.max(120, h - startWrapTop - 8) + 'px';
      }
      // Surrounding records-table window follows the panel too.
      if (scroller) {
        const sh = Math.max(240, Math.min(window.innerHeight * 0.92, startScrollH + (h - startH)));
        scroller.style.maxHeight = 'none';
        scroller.style.height = sh + 'px';
        try { window.localStorage.setItem('dashTableHeight', String(Math.round(sh))); } catch (err) {}
      }
      let cached = isLink ? cachedLinkPanel_(row) : cachedAiPanel_(row);
      if (!cached) { cached = { data: null, collapsed: false }; if (isLink) persistLinkPanel_(row, null, false); else persistAiPanel_(row, null, false); }
      cached.w = Math.round(w); cached.h = Math.round(h);
      if (wrap) cached.wrapH = Math.round(Math.max(120, h - startWrapTop - 8));
    }
    function onUp() {
      document.body.classList.remove('modal-resizing');
      grip.classList.remove('active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Vertical drag-resize for the records table window (height). The chosen
  // height is remembered across sessions.
  (function () {
    const handle = getEl('dashboardTableResize');
    const scroller = document.querySelector('#dashboardTableWrap .table-scroll');
    if (!handle || !scroller) return;
    const saved = Number(window.localStorage.getItem('dashTableHeight'));
    if (saved && saved > 200) {
      scroller.style.maxHeight = 'none';
      scroller.style.height = saved + 'px';
    }
    handle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      const startY = e.clientY;
      const startH = scroller.getBoundingClientRect().height;
      document.body.classList.add('col-resizing');
      function onMove(ev) {
        const h = Math.max(240, Math.min(window.innerHeight * 0.92, startH + (ev.clientY - startY)));
        scroller.style.maxHeight = 'none';
        scroller.style.height = h + 'px';
        try { window.localStorage.setItem('dashTableHeight', String(h)); } catch (err) {}
      }
      function onUp() {
        document.body.classList.remove('col-resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  })();

  // The server validates the HttpOnly session cookie. This keeps the session
  // out of JavaScript while still allowing the app to restore a signed-in
  // session after a page reload.
  loadApp();
}

function loadApp() {
  showOverlay('Loading app…');
  ApiService.getAppData().then(function (data) {
    hideOverlay();
    hideSplash();
    if (!data || !data.user || !data.user.loggedIn) {
      showScreen('login');
      return;
    }
    appState.user = data.user || {};
    appState.isAdmin = data.user.role === 'ADMIN';
    appState.isEditor = data.user.role === 'ADMIN' || data.user.role === 'EDITOR';
    appState.mustChange = !!data.mustChange;
    appState.permissions = (data.user && data.user.permissions) || {};
    applyAppData(data);

    populateFilters();
    populateResponsibilitySelect();
  renderProfile();
    applyTheme();
    applySidebarPref();
    showScreen('login');
    getEl('loginScreen').classList.add('hidden');
    getEl('forgotScreen').classList.add('hidden');
    renderDashboard();
    updateOfflineBanner();
    refreshCounts();
    generateReviewNotifications();
    loadDashboardPreferences();
    loadAskLinkHistory();
    EventBus.emit('DataRefreshed');
    EventBus.emit('UserLoggedIn');
    startAutoRefresh();
    initRealtime();

    if (appState.mustChange) {
      getEl('mustChangeBanner').classList.remove('hidden');
      openTab('settings');
      showToast('Please set a new password to continue.', 'warning');
    }
  }).catch(function (err) {
    hideOverlay();
    hideSplash();
    if (handleServerFailure(err)) return;
    const message = err && err.message ? err.message : String(err || 'Unknown error');
    const panel = getEl('messagePanel');
    panel.classList.remove('hidden');
    panel.textContent = 'Error loading app: ' + message;
    console.error('App load failed', err);
  });
}

function handleLogin(e) {
  e.preventDefault();
  const emailEl = getEl('loginEmail');
  const passEl = getEl('loginPassword');
  const email = emailEl.value.trim();
  const password = passEl.value;
  let valid = true;
  valid = setFieldInvalid(emailEl, email ? '' : 'Enter your email or username.') && valid;
  valid = setFieldInvalid(passEl, password ? '' : 'Enter your password.') && valid;
  if (!valid) return;

  showOverlay('Logging in…');
  ApiService.login(email, password).then(function (res) {
    hideOverlay();
    if (!res || !res.success) {
      showAuthMessage('loginMessage', (res && res.message) || 'Login failed.');
      return;
    }
    appState.mustChange = !!res.mustChange;
    showAuthMessage('loginMessage', '');
    loadApp();
  }).catch(function (err) {
    hideOverlay();
    showAuthMessage('loginMessage', err && err.message ? err.message : 'Login failed.');
  });
}

function showForgotPassword() {
  showAuthMessage('forgotMessage', '');
  const loginEmail = getEl('loginEmail').value || '';
  getEl('forgotEmail').value = loginEmail;
  showScreen('forgot');
}

function showLogin() {
  ['loginMessage', 'forgotMessage'].forEach(id => showAuthMessage(id, ''));
  showScreen('login');
}

function handleForgotPassword(e) {
  e.preventDefault();
  const email = getEl('forgotEmail').value.trim();
  if (!setFieldInvalid(getEl('forgotEmail'), email ? '' : 'Enter your email or username.')) return;
  showOverlay('Submitting reset request…');
  ApiService.requestPasswordReset(email).then(function (res) {
    hideOverlay();
    showAuthMessage('forgotMessage', (res && res.message) || 'A reset request has been sent to your administrator.');
    showToast((res && res.message) || 'A reset request has been sent to your administrator.', 'success');
  }).catch(function (err) {
    hideOverlay();
    showAuthMessage('forgotMessage', err && err.message ? err.message : 'Could not submit the reset request.');
  });
}

function logout() {
  stopAutoRefresh();
  teardownRealtime();
  ApiService.logout().then(function () {
    window.location.href = window.location.href.split('?')[0];
  }).catch(function () {
    window.location.reload();
  });
}

/* ---------------------------------- Form validation ---------------------------------- */

function setFieldInvalid(inputEl, message) {
  if (!inputEl) return !message;
  const field = inputEl.closest('.field');
  if (!field) return !message;
  const err = field.querySelector('.field-error');
  if (err) {
    if (message && !err.id) {
      err.id = 'err-' + (inputEl.id || 'field') + '-' + Math.random().toString(36).slice(2, 8);
    }
    err.textContent = message || '';
    if (message) {
      inputEl.setAttribute('aria-invalid', 'true');
      inputEl.setAttribute('aria-describedby', err.id);
    } else {
      inputEl.removeAttribute('aria-invalid');
      if (err.id) {
        const describedBy = (inputEl.getAttribute('aria-describedby') || '')
          .split(/\s+/).filter(function (x) { return x && x !== err.id; });
        if (describedBy.length) inputEl.setAttribute('aria-describedby', describedBy.join(' '));
        else inputEl.removeAttribute('aria-describedby');
      }
    }
  } else if (!message) {
    inputEl.removeAttribute('aria-invalid');
  }
  field.classList.toggle('invalid', !!message);
  return !message;
}

function wireFieldClearing(container) {
  (container || document).querySelectorAll('input, select, textarea').forEach(function (input) {
    input.addEventListener('input', function () {
      setFieldInvalid(input, '');
    });
  });
}


function snoozeNotificationUi(id, minutes){ApiService.snoozeNotification(id,minutes).then(function(d){appState.notifications=d||appState.notifications;renderNotifications();}).catch(function(e){showToast(e.message||String(e),'error');});}
function dismissNotificationUi(id){ApiService.dismissNotification(id).then(function(d){appState.notifications=d||appState.notifications;renderNotifications();}).catch(function(e){showToast(e.message||String(e),'error');});}

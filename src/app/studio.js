
/* ---------------------------------- Dashboard Studio ---------------------------------- */

function loadDashboardPreferences() {
  return ApiService.getDashboardPreferences().then(function (prefs) {
    appState.dashboardPrefs = prefs || { viewMode: 'cards', columns: {}, layout: {} };
    applyDashboardPreferences();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    appState.dashboardPrefs = { viewMode: 'cards', columns: {}, layout: {} };
  });
}

function applyDashboardPreferences() {
  const prefs = appState.dashboardPrefs || {};
  // Restore persisted sort + review-status filter before rendering so the
  // first paint honours them.
  if (prefs.sortKey) appState.dashSortKey = prefs.sortKey;
  if (prefs.sortDir === 'asc' || prefs.sortDir === 'desc') appState.dashSortDir = prefs.sortDir;
  // Legacy 'pending' (old "not done / not due" value) maps to 'notdue'.
  appState.dashReviewFilter = prefs.reviewFilter === 'pending' ? 'notdue' : (prefs.reviewFilter || '');
  syncDashSortFilterControls();
  toggleDashboardView(prefs.viewMode === 'table' ? 'table' : 'cards');
}

/* Reflect the current sort/review-filter state in the dropdowns + chips. */
function syncDashSortFilterControls() {
  const sortSelect = getEl('dashSortSelect');
  if (sortSelect) {
    const optionValue = appState.dashSortKey === 'id' ? 'default' : appState.dashSortKey;
    if (sortSelect.querySelector('option[value="' + optionValue + '"]')) {
      sortSelect.value = optionValue;
    }
  }
  const reviewFilter = getEl('dashReviewFilter');
  if (reviewFilter) reviewFilter.value = appState.dashReviewFilter;
  updateFilterChips();
}

/* Debounced silent save of the dashboard prefs (sort, review filter, view
   mode, columns) so sort/filter choices survive reloads without a modal. */
var dashPrefsSaveTimer = null;

function scheduleDashboardPrefsSave() {
  if (dashPrefsSaveTimer) clearTimeout(dashPrefsSaveTimer);
  dashPrefsSaveTimer = setTimeout(function () {
    dashPrefsSaveTimer = null;
    persistDashboardPrefs();
  }, 800);
}

function persistDashboardPrefs() {
  const current = appState.dashboardPrefs || {};
  const prefs = {
    viewMode: current.viewMode || 'cards',
    columns: current.columns || {},
    layout: current.layout || {},
    sortKey: appState.dashSortKey,
    sortDir: appState.dashSortDir,
    reviewFilter: appState.dashReviewFilter
  };
  ApiService.saveDashboardPreferences(prefs).then(function () {
    appState.dashboardPrefs = prefs;
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    // Non-critical persistence failure; the next change will retry.
  });
}

function saveDashboardPreferences() {
  const columns = {};
  document.querySelectorAll('.col-toggle').forEach(function (cb) {
    columns[cb.dataset.col] = cb.checked;
  });
  const modeRadio = document.querySelector('input[name="viewMode"]:checked');
  const viewMode = modeRadio ? modeRadio.value : 'cards';
  const prefs = {
    viewMode: viewMode,
    columns: columns,
    layout: (appState.dashboardPrefs && appState.dashboardPrefs.layout) || {},
    sortKey: appState.dashSortKey,
    sortDir: appState.dashSortDir,
    reviewFilter: appState.dashReviewFilter
  };
  showOverlay('Saving preferences…');
  ApiService.saveDashboardPreferences(prefs).then(function () {
    hideOverlay();
    showToast('Dashboard preferences saved.', 'success');
    appState.dashboardPrefs = prefs;
    applyDashboardPreferences();
    closeColumnDialog();
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not save preferences.', 'error');
  });
}

function toggleColumnVisibility(colKey) {
  const cb = document.querySelector('.col-toggle[data-col="' + colKey + '"]');
  if (cb) {
    cb.checked = !cb.checked;
    renderDashboard();
  }
}

function openColumnDialog() {
  const prefs = appState.dashboardPrefs || {};
  const columns = prefs.columns || {};
  document.querySelectorAll('.col-toggle').forEach(function (cb) {
    cb.checked = columns[cb.dataset.col] !== false;
  });
  const modeRadio = document.querySelector('input[name="viewMode"][value="' + (prefs.viewMode || 'cards') + '"]');
  if (modeRadio) modeRadio.checked = true;
  openDialog('columnModal');
}

function closeColumnDialog() {
  closeDialog('columnModal');
}

/* ---------------------------------- Command Palette ---------------------------------- */

const COMMAND_ACTIONS = [
  { key: 'goto-dashboard', label: 'Go to Dashboard', shortcut: 'G D', action: function () { openTab('dashboard'); closeCommandPalette(); } },
  { key: 'goto-audit', label: 'Go to Audit log', shortcut: 'G A', action: function () { openTab('audit'); closeCommandPalette(); } },
  { key: 'goto-reports', label: 'Go to Reports', shortcut: 'G R', action: function () { openTab('reports'); closeCommandPalette(); } },
  { key: 'goto-settings', label: 'Go to Settings', shortcut: 'G S', action: function () { openTab('settings'); closeCommandPalette(); } },
  { key: 'goto-tasks', label: 'Go to Tasks', shortcut: 'G T', action: function () { openTab('tasks'); closeCommandPalette(); } },
  { key: 'refresh', label: 'Refresh data', shortcut: 'R', action: function () { refreshData(); closeCommandPalette(); } },
  { key: 'add-record', label: 'Add new record', shortcut: 'N', action: function () { openAddModal(); closeCommandPalette(); }, requireEditor: true },
  { key: 'toggle-theme', label: 'Toggle dark mode', shortcut: 'T', action: function () { toggleDarkMode(); closeCommandPalette(); } },
  { key: 'logout', label: 'Sign out', shortcut: 'Q', action: function () { handleLogout(); closeCommandPalette(); } }
];

function openCommandPalette() {
  openDialog('commandPalette');
  const input = getEl('commandInput');
  if (input) {
    input.value = '';
    input.focus();
    filterCommands('');
  }
}

function closeCommandPalette() {
  closeDialog('commandPalette');
}

function filterCommands(query) {
  const list = getEl('commandList');
  if (!list) return;
  const q = String(query || '').toLowerCase().trim();
  let actions = COMMAND_ACTIONS.slice();
  if (appState.isEditor === false) actions = actions.filter(function (a) { return !a.requireEditor; });
  if (q) actions = actions.filter(function (a) { return a.label.toLowerCase().indexOf(q) !== -1; });
  let records = [];
  if (q.length >= 2) {
    records = (appState.items || []).filter(function (item) {
      return String(item.id).indexOf(q) !== -1 || String(item.sector || '').toLowerCase().indexOf(q) !== -1 || String(item.description || '').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 8).map(function (item) {
      return {
        key: 'record-' + item.row,
        label: 'Record #' + item.id + ' — ' + (item.sector || ''),
        subtitle: (item.description || '').slice(0, 60),
        action: function () { openRecordDetail(item.row); closeCommandPalette(); }
      };
    });
  }
  let html = '';
  if (actions.length) {
    html += '<div style="padding:8px 16px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;">Commands</div>';
    actions.forEach(function (cmd) {
      html += '<div class="command-item" data-cmd="' + escAttr(cmd.key) + '" onclick="executeCommand(\'' + escAttr(cmd.key) + '\')">' +
        '<span>' + escapeHtml(cmd.label) + '</span>' +
        '<span class="command-shortcut">' + escapeHtml(cmd.shortcut || '') + '</span></div>';
    });
  }
  if (records.length) {
    html += '<div style="padding:8px 16px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;">Records</div>';
    records.forEach(function (rec) {
      html += '<div class="command-item" data-cmd="' + escAttr(rec.key) + '" onclick="executeCommand(\'' + escAttr(rec.key) + '\')">' +
        '<span>' + escapeHtml(rec.label) + '</span>' +
        '<span style="color:var(--muted);font-size:12px;">' + escapeHtml(rec.subtitle || '') + '</span></div>';
    });
  }
  if (!html) html = '<div style="padding:16px;color:var(--muted);text-align:center;">No results</div>';
  list.innerHTML = html;
}

function executeCommand(key) {
  const action = COMMAND_ACTIONS.find(function (a) { return a.key === key; });
  if (action && !action.requireEditor) action.action();
  else if (key.indexOf('record-') === 0) {
    const row = key.replace('record-', '');
    const item = (appState.items || []).find(function (i) { return String(i.row) === String(row); });
    if (item) openRecordDetail(item.row);
  }
}

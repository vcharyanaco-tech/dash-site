
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
  { key: 'create-task', label: 'Create task', shortcut: '', action: function () { openTaskModal(); closeCommandPalette(); }, requireEditor: true },
  { key: 'toggle-theme', label: 'Toggle dark mode', shortcut: 'T', action: function () { toggleDarkMode(); closeCommandPalette(); } },
  { key: 'logout', label: 'Sign out', shortcut: 'Q', action: function () { handleLogout(); closeCommandPalette(); } },
  { key: 'export-records', label: 'Export records to spreadsheet', shortcut: '', action: function () { exportToSpreadsheet(); closeCommandPalette(); } },
  { key: 'export-pdf', label: 'Create PDF report', shortcut: '', action: function () { createPdfReport(); closeCommandPalette(); } },
  { key: 'email-report', label: 'Send report via email', shortcut: '', action: function () { openEmailReportDialog(); closeCommandPalette(); } },
  { key: 'generate-review-notifications', label: 'Generate review notifications', shortcut: '', action: function () { ApiService.generateReviewNotifications().then(function () { showToast('Review notifications generated.', 'success'); }).catch(function (e) { showToast('Could not generate.', 'error'); }); closeCommandPalette(); } },
  { key: 'mark-all-submissions-read', label: 'Mark all submissions read', shortcut: '', action: function () { markAllSubmissionsRead(); closeCommandPalette(); } }
];

var CMD_RESULTS = [];
var CMD_SELECTED_IDX = 0;
var RECENT_KEY = 'ipd_cmd_recent_v1';
var CMD_SEARCH_DEBOUNCE = null;
var CMD_SEARCHING = false;
var CMD_SEARCH_GEN = 0;

function getRecentItems() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; }
}

function saveRecentItems(items) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 10))); } catch (e) {}
}

function addRecentItem(item) {
  var recent = getRecentItems().filter(function (r) { return r.key !== item.key; });
  recent.unshift(item);
  saveRecentItems(recent);
}

function openCommandPalette() {
  openDialog('commandPalette');
  const input = getEl('commandInput');
  CMD_RESULTS = [];
  CMD_SELECTED_IDX = 0;
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
        category: 'Records',
        action: function () { openRecordDetail(item.row); closeCommandPalette(); addRecentItem({ key: 'record-' + item.row, label: 'Record #' + item.id, type: 'record' }); }
      };
    });
  }
  var recent = [];
  if (q.length >= 1) {
    recent = getRecentItems().filter(function (r) {
      return String(r.label).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 5).map(function (r) {
      return {
        key: r.key,
        label: r.label,
        subtitle: '',
        category: 'Recent',
        action: function () {
          if (r.type === 'record') {
            var row = r.key.replace('record-', '');
            openRecordDetail(row);
          }
          closeCommandPalette();
        }
      };
    });
  }
  CMD_RESULTS = [];
  var html = '';
  function addSection(title, items) {
    if (!items.length) return;
    html += '<div style="padding:8px 16px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;">' + escapeHtml(title) + '</div>';
    items.forEach(function (item) {
      var idx = CMD_RESULTS.length;
      html += '<div class="command-item" data-cmd="' + escAttr(item.key) + '" data-idx="' + idx + '" onclick="executeCommand(\'' + escAttr(item.key) + '\')">' +
        '<span>' + escapeHtml(item.label) + '</span>' +
        '<span style="margin-left:auto;color:var(--muted);font-size:12px;">' + escapeHtml(item.shortcut || item.subtitle || '') + '</span></div>';
      CMD_RESULTS.push({ key: item.key, action: item.action });
    });
  }
  addSection('Commands', actions);
  addSection('Recent', recent);
  addSection('Records', records);
  if (!html) html = '<div style="padding:16px;color:var(--muted);text-align:center;">No results</div>';
  list.innerHTML = html;
  CMD_SELECTED_IDX = 0;
  highlightSelected();
  if (q.length >= 3) paletteSearch(q);
}

function highlightSelected() {
  var items = document.querySelectorAll('#commandList .command-item');
  items.forEach(function (el, i) {
    if (i === CMD_SELECTED_IDX) {
      el.style.background = 'var(--accent-soft, rgba(37,99,235,0.1))';
      el.style.outline = '1px solid var(--accent, #2563eb)';
    } else {
      el.style.background = '';
      el.style.outline = '';
    }
  });
}

function executeCommand(key) {
  var found = CMD_RESULTS.find(function (r) { return r.key === key; });
  if (found) { found.action(); return; }
  var action = COMMAND_ACTIONS.find(function (a) { return a.key === key; });
  if (action && !action.requireEditor) action.action();
  else if (key.indexOf('record-') === 0) {
    var row = key.replace('record-', '');
    var item = (appState.items || []).find(function (i) { return String(i.row) === String(row); });
    if (item) openRecordDetail(item.row);
  }
}

/* Async cross-data search (tasks, users) */
function paletteSearch(query) {
  CMD_SEARCH_GEN++;
  var gen = CMD_SEARCH_GEN;
  if (CMD_SEARCH_DEBOUNCE) clearTimeout(CMD_SEARCH_DEBOUNCE);
  CMD_SEARCH_DEBOUNCE = setTimeout(function () {
    var q = String(query || '').toLowerCase().trim();
    if (q.length < 3) { hideSearching(); return; }
    CMD_SEARCHING = true;
    showSearching();
    var taskPromise = ApiService.getMyTasks().catch(function () { return []; });
    var userPromise = ApiService.getAssignableUsers().catch(function () { return []; });
    var submissionPromise = ApiService.getSubmissions().catch(function () { return []; });
    var documentPromise = ApiService.getDocuments().catch(function () { return []; });
    Promise.all([taskPromise, userPromise, submissionPromise, documentPromise]).then(function (results) {
      if (gen !== CMD_SEARCH_GEN) return;
      CMD_SEARCHING = false;
      var tasks = results[0];
      var users = results[1];
      var submissions = results[2];
      var documents = results[3];
      var taskResults = tasks.filter(function (t) {
        return String(t.title || '').toLowerCase().indexOf(q) !== -1 ||
          String(t.description || '').toLowerCase().indexOf(q) !== -1;
      }).slice(0, 6).map(function (t) {
        return {
          key: 'task-' + (t.id || t.row || ''),
          label: String(t.title || '').slice(0, 80),
          subtitle: 'Task',
          category: 'Tasks',
          action: function () { openTaskModal(); closeCommandPalette(); }
        };
      });
      var userResults = users.filter(function (u) {
        return String(u.email || '').toLowerCase().indexOf(q) !== -1 ||
          String(u.username || '').toLowerCase().indexOf(q) !== -1 ||
          String(u.name || '').toLowerCase().indexOf(q) !== -1;
      }).slice(0, 6).map(function (u) {
        return {
          key: 'user-' + (u.email || u.username || ''),
          label: String(u.name || u.email || '').slice(0, 60) + ' <' + String(u.email || '').slice(0, 40) + '>',
          subtitle: 'User',
          category: 'Users',
          action: function () { closeCommandPalette(); showToast('User profile: ' + (u.email || u.username), 'info'); }
        };
      });
      var submissionResults = submissions.filter(function (s) {
        return String(s.text || '').toLowerCase().indexOf(q) !== -1 ||
          String(s.cardRow || '').indexOf(q) !== -1 ||
          String(s.email || '').toLowerCase().indexOf(q) !== -1;
      }).slice(0, 6).map(function (s) {
        return {
          key: 'submission-' + (s.id || ''),
          label: 'Record #' + (s.cardRow || '') + ': ' + String(s.text || '').slice(0, 60),
          subtitle: 'Submission',
          category: 'Submissions',
          action: function () { openRecordDetail(Number(s.cardRow)); closeCommandPalette(); }
        };
      });
      var documentResults = documents.filter(function (d) {
        return String(d.fileName || '').toLowerCase().indexOf(q) !== -1 ||
          String(d.recordId || '').toLowerCase().indexOf(q) !== -1 ||
          String(d.recordRow || '').indexOf(q) !== -1;
      }).slice(0, 6).map(function (d) {
        return {
          key: 'document-' + (d.id || ''),
          label: String(d.fileName || '').slice(0, 60),
          subtitle: 'Doc R#' + (d.recordRow || ''),
          category: 'Documents',
          action: function () { openRecordDetail(Number(d.recordRow)); closeCommandPalette(); }
        };
      });
      CMD_RESULTS = [];
      var html = '';
      if (taskResults.length) html += '<div style="padding:8px 16px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;">Tasks</div>';
      taskResults.forEach(function (item) {
        var idx = CMD_RESULTS.length;
        html += '<div class="command-item" data-cmd="' + escAttr(item.key) + '" data-idx="' + idx + '" onclick="executeCommand(\'' + escAttr(item.key) + '\')">' +
          '<span>' + escapeHtml(item.label) + '</span>' +
          '<span style="margin-left:auto;color:var(--muted);font-size:12px;">' + escapeHtml(item.subtitle || '') + '</span></div>';
        CMD_RESULTS.push({ key: item.key, action: item.action });
      });
      if (userResults.length) html += '<div style="padding:8px 16px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;">Users</div>';
      userResults.forEach(function (item) {
        var idx = CMD_RESULTS.length;
        html += '<div class="command-item" data-cmd="' + escAttr(item.key) + '" data-idx="' + idx + '" onclick="executeCommand(\'' + escAttr(item.key) + '\')">' +
          '<span>' + escapeHtml(item.label) + '</span>' +
          '<span style="margin-left:auto;color:var(--muted);font-size:12px;">' + escapeHtml(item.subtitle || '') + '</span></div>';
        CMD_RESULTS.push({ key: item.key, action: item.action });
      });
      if (submissionResults.length) html += '<div style="padding:8px 16px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;">Submissions</div>';
      submissionResults.forEach(function (item) {
        var idx = CMD_RESULTS.length;
        html += '<div class="command-item" data-cmd="' + escAttr(item.key) + '" data-idx="' + idx + '" onclick="executeCommand(\'' + escAttr(item.key) + '\')">' +
          '<span>' + escapeHtml(item.label) + '</span>' +
          '<span style="margin-left:auto;color:var(--muted);font-size:12px;">' + escapeHtml(item.subtitle || '') + '</span></div>';
        CMD_RESULTS.push({ key: item.key, action: item.action });
      });
      if (documentResults.length) html += '<div style="padding:8px 16px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;">Documents</div>';
      documentResults.forEach(function (item) {
        var idx = CMD_RESULTS.length;
        html += '<div class="command-item" data-cmd="' + escAttr(item.key) + '" data-idx="' + idx + '" onclick="executeCommand(\'' + escAttr(item.key) + '\')">' +
          '<span>' + escapeHtml(item.label) + '</span>' +
          '<span style="margin-left:auto;color:var(--muted);font-size:12px;">' + escapeHtml(item.subtitle || '') + '</span></div>';
        CMD_RESULTS.push({ key: item.key, action: item.action });
      });
      var list = getEl('commandList');
      if (list) {
        var spinner = list.querySelector('.palette-searching');
        if (spinner) spinner.remove();
        if (html) list.insertAdjacentHTML('beforeend', html);
      }
      hideSearching();
      highlightSelected();
    });
  }, 150);
}

function showSearching() {
  var list = getEl('commandList');
  if (!list) return;
  if (list.querySelector('.palette-searching')) return;
  var div = document.createElement('div');
  div.className = 'palette-searching';
  div.style.cssText = 'padding:12px 16px;color:var(--muted);font-size:12px;text-align:center;';
  div.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite;margin-right:6px;vertical-align:middle;"></span>Searching…';
  list.appendChild(div);
}

function hideSearching() {
  var list = getEl('commandList');
  if (!list) return;
  var el = list.querySelector('.palette-searching');
  if (el) el.remove();
}

function paletteNavigate(dir) {
  var total = CMD_RESULTS.length;
  if (!total) return;
  CMD_SELECTED_IDX = (CMD_SELECTED_IDX + dir + total) % total;
  highlightSelected();
}

function paletteActivate() {
  if (CMD_RESULTS[CMD_SELECTED_IDX]) executeCommand(CMD_RESULTS[CMD_SELECTED_IDX].key);
}

/* Keyboard navigation inside palette */
(function () {
  var origOpen = openCommandPalette;
  var overrideInstalled = false;
  openCommandPalette = function () {
    origOpen();
    if (!overrideInstalled) {
      var input = getEl('commandInput');
      if (input) {
        input.removeEventListener('keydown', paletteKeydown);
        input.addEventListener('keydown', paletteKeydown);
      }
      overrideInstalled = true;
    }
  };

  function paletteKeydown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); paletteNavigate(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); paletteNavigate(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); paletteActivate(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeCommandPalette(); }
  }
})();

/* Debounced filter for oninput (keeps direct calls synchronous) */
var _filterTimer = null;
var _origFilterCommands = filterCommands;
function filterCommands(query) {
  if (document.activeElement && document.activeElement.id === 'commandInput') {
    if (_filterTimer) clearTimeout(_filterTimer);
    _filterTimer = setTimeout(function () { _origFilterCommands(query); }, 120);
    return;
  }
  _origFilterCommands(query);
}

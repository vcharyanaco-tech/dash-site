/* ---------------------------------- SSE real-time connection ---------------------------------- */
/* Connects to the server's GET /api/events SSE endpoint and listens for
   data-mutating events (recordChanged, submissionAdded, etc.). When an
   event arrives, the dashboard re-fetches data silently instead of waiting
   for the next auto-refresh tick. Reconnects automatically on close. */

var sseSource = null;
var sseRetryMs = 2000;
var sseMaxRetryMs = 60000;
var sseConnected = false;

function connectSse() {
  if (sseSource) return; // already connected
  if (!getAuthToken()) return; // not logged in
  if (typeof EventSource === 'undefined') return; // browser doesn't support SSE

  sseSource = new EventSource(API_URL.replace('/api', '/api/events'));

  sseSource.addEventListener('connected', function () {
    sseConnected = true;
    sseRetryMs = 2000; // reset backoff on successful connect
  });

  sseSource.addEventListener('dataChanged', function (e) {
    if (autoRefreshInFlight) return; // already refreshing
    autoRefreshTick();
  });

  sseSource.addEventListener('userLoggedIn', function () {
    // Another user logged in — not critical, just refresh if idle
    if (!autoRefreshInFlight) autoRefreshTick();
  });

  sseSource.onerror = function () {
    sseConnected = false;
    sseSource.close();
    sseSource = null;
    // Exponential backoff reconnect
    setTimeout(function () {
      if (getAuthToken()) connectSse();
    }, sseRetryMs);
    sseRetryMs = Math.min(sseMaxRetryMs, sseRetryMs * 2);
  };
}

function disconnectSse() {
  if (sseSource) {
    sseSource.close();
    sseSource = null;
    sseConnected = false;
  }
}

/* ---------------------------------- Session auto-refresh ---------------------------------- */
/* The session token expires after 6 hours (SESSION_TTL_SECONDS). Instead of
   waiting for the user to get a 401 and be logged out, we silently refresh
   the token every 30 minutes by calling the refreshSession endpoint. This
   extends the server-side expiry by another 6 hours. */

var sessionRefreshTimerId = null;
var SESSION_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

function startSessionRefresh() {
  stopSessionRefresh();
  sessionRefreshTimerId = setInterval(function () {
    sessionRefreshTick();
  }, SESSION_REFRESH_INTERVAL_MS);
}

function stopSessionRefresh() {
  if (sessionRefreshTimerId) {
    clearInterval(sessionRefreshTimerId);
    sessionRefreshTimerId = null;
  }
}

function sessionRefreshTick() {
  if (!getAuthToken()) return;
  ApiService.refreshSession().then(function (result) {
    if (!result || !result.success) {
      // Session expired or invalid — log out
      stopSessionRefresh();
      disconnectSse();
      setAuthToken('');
      showScreen('login');
      showToast('Session expired. Please log in again.', 'warning');
    }
    // success — session extended, nothing else to do
  }).catch(function () {
    // Network error — non-fatal, will retry next tick
  });
}

/* ---------------------------------- Keyboard shortcuts ---------------------------------- */
/* Global keyboard shortcuts for power users. All shortcuts use Ctrl/Cmd as
   the modifier to avoid conflicts with browser defaults and text input.

   Shortcuts:
     Ctrl+K     — Open command palette / focus search
     Ctrl+N     — New record (editor+)
     Ctrl+R     — Refresh dashboard data
     Ctrl+E     — Toggle edit mode (table/cards)
     Ctrl+1-6   — Switch tabs (1=Dashboard, 2=Analytics, 3=Audit, 4=Reports, 5=Tasks, 6=Settings)
     Ctrl+/     — Show keyboard shortcut help
     ?          — Show keyboard shortcut help (when not in input) */

function wireKeyboardShortcuts() {
  document.addEventListener('keydown', function (e) {
    var isInInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable;

    // Ctrl+K — Command palette (already in init.js, enhanced here)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      var input = getEl('searchInput');
      if (input) { input.focus(); input.select(); }
      return;
    }

    // Ctrl+N — New record (editor+ only)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
      if (appState.isEditor) {
        e.preventDefault();
        openEditModal(null);
      }
      return;
    }

    // Ctrl+R — Refresh (override browser refresh)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      refreshData();
      return;
    }

    // Ctrl+E — Toggle view (cards/table)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault();
      var nextView = appState.dashboardView === 'cards' ? 'table' : 'cards';
      toggleDashboardView(nextView);
      return;
    }

    // Ctrl+1-6 — Switch tabs
    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
      var tabMap = { '1': 'dashboard', '2': 'analytics', '3': 'audit', '4': 'reports', '5': 'tasks', '6': 'settings' };
      var tabName = tabMap[e.key];
      if (tabName) {
        e.preventDefault();
        openTab(tabName);
      }
      return;
    }

    // Ctrl+/ — Show help
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      showShortcutHelp();
      return;
    }

    // ? — Show help (only when not typing in an input)
    if (!isInInput && e.key === '?' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      showShortcutHelp();
      return;
    }

    // Escape — close shortcuts help
    if (e.key === 'Escape') {
      var helpModal = getEl('shortcutsModal');
      if (helpModal && !helpModal.classList.contains('hidden')) {
        closeDialog('shortcutsModal');
      }
    }
  });
}

function showShortcutHelp() {
  var modal = getEl('shortcutsModal');
  if (!modal) {
    // Create the modal on first use
    var div = document.createElement('div');
    div.id = 'shortcutsModal';
    div.className = 'modal-backdrop hidden';
    div.innerHTML =
      '<div class="modal-card modal-card-sm" onclick="event.stopPropagation()">' +
      '<div class="modal-head"><h3>Keyboard Shortcuts</h3><button class="btn btn-ghost modal-close" onclick="closeDialog(\'shortcutsModal\')">&times;</button></div>' +
      '<div class="modal-body">' +
      '<table class="data-table" style="font-size:13px;">' +
      '<tbody>' +
      shortcutRow_('Ctrl+K', 'Open search / command palette') +
      shortcutRow_('Ctrl+N', 'New record (editor+)') +
      shortcutRow_('Ctrl+R', 'Refresh dashboard data') +
      shortcutRow_('Ctrl+E', 'Toggle card / table view') +
      shortcutRow_('Ctrl+1–6', 'Switch tabs (1=Dash, 2=Analytics, 3=Audit, 4=Reports, 5=Tasks, 6=Settings)') +
      shortcutRow_('Ctrl+/', 'Show this help') +
      shortcutRow_('?', 'Show this help') +
      shortcutRow_('Escape', 'Close dialogs and panels') +
      '</tbody></table>' +
      '</div>' +
      '</div>';
    div.addEventListener('click', function (e) {
      if (e.target === div) closeDialog('shortcutsModal');
    });
    document.body.appendChild(div);
    modal = div;
  }
  openDialog('shortcutsModal');
}

function shortcutRow_(keys, description) {
  return '<tr><td style="white-space:nowrap;font-weight:600;color:var(--accent,#2563eb);">' + escapeHtml(keys) + '</td><td>' + escapeHtml(description) + '</td></tr>';
}

/* ---------------------------------- Module init ---------------------------------- */
/* Called from init.js after login to wire up SSE, session refresh, and
   keyboard shortcuts. */

function initRealtime() {
  connectSse();
  startSessionRefresh();
  wireKeyboardShortcuts();
}

function teardownRealtime() {
  disconnectSse();
  stopSessionRefresh();
}

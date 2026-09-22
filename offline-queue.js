/*
 * OfflineQueue - PWA offline action queue for the India Post Dashboard.
 * Loaded AFTER app.js so the original global apiCall_ can be captured and
 * wrapped. Mutating calls made while offline are queued in localStorage and
 * replayed FIFO when the connection returns. Read-only calls pass through
 * unchanged. Also registers the service worker (sw.js).
 *
 * The offline activity center (modal) surfaces every queued / syncing /
 * failed / conflict / synced action so users can retry failures, discard
 * stuck actions, and never believe a queued mutation has synced unless it
 * actually completed.
 */
(function () {
  'use strict';

  var QUEUE_KEY = 'ipd_offline_queue_v1';
  var HISTORY_KEY = 'ipd_offline_history_v1';
  var MAX_QUEUE = 200;
  var MAX_HISTORY = 50;

  var MUTATIONS = {
    addItem: true, updateItem: true, deleteItem: true, markReviewDone: true,
    markReviewNotDone: true, setRecordDisplay: true,
    markNotificationsRead: true, clearMyNotifications: true,
    createTask: true, updateTask: true, deleteTask: true,
    saveDashboardPreferences: true,
    addSubmission: true, updateSubmission: true, deleteSubmission: true,
    lockSubmission: true, unlockSubmission: true, toggleSubmissionDisplay: true,
    deleteDocument: true
  };

  // Record-row-keyed mutations whose first data argument is a *physical row
  // number*: rows are renumbered when a record is deleted, so replaying the
  // stored row later can hit a different record. At enqueue time we capture
  // the record's stable UUID and rewrite the arg to it — the server resolves
  // record_id first (records.js resolveRecord_), so the queued action always
  // targets the same record the user acted on.
  var ROW_KEYED_RECORD = { deleteItem: 0, markReviewDone: 0, markReviewNotDone: 0, setRecordDisplay: 0 };

  function recordIdForRow_(row) {
    try {
      var items = (window.appState && window.appState.items) || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i] && Number(items[i].row) === Number(row) && items[i].recordId) {
          return String(items[i].recordId);
        }
      }
      if (window.appState && Array.isArray(window.appState.allItems)) {
        var all = window.appState.allItems;
        for (var j = 0; j < all.length; j++) {
          if (all[j] && Number(all[j].row) === Number(row) && all[j].recordId) {
            return String(all[j].recordId);
          }
        }
      }
    } catch (e) {}
    return '';
  }

  /* Rewrites a queued mutation's args so physical row numbers are replaced by
     the record's stable UUID when one is known. Returns a new array only when
     it actually changes something (identity preserved otherwise). */
  function stabilizeArgs_(fn, args) {
    var idx = ROW_KEYED_RECORD[fn];
    if (idx === undefined || !args || args[idx] == null) return args;
    if (!/^\d+$/.test(String(args[idx]).trim())) return args;
    var rid = recordIdForRow_(String(args[idx]));
    if (!rid) return args;
    var copy = args.slice();
    copy[idx] = rid;
    return copy;
  }

  var CID_COUNTER = 0;
  function cid() {
    CID_COUNTER++;
    return 'oq_' + Date.now().toString(36) + '_' + CID_COUNTER;
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function save(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) {}
  }

  function historyLoad() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function historySave(h) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch (e) {}
  }

  function pending() { return load().length; }

  function emit(name, detail) {
    try {
      if (window.EventBus) window.EventBus.emit(name, detail);
    } catch (e) {}
  }

  /* A rejected mutation is a generic "failed" action unless the server's
     answer reads like the target row is gone or the change no longer applies
     (not found / already done / deleted), which we surface as an
     understandable conflict. */
  var CONFLICT_HINTS = [
    /not found/i, /does not exist/i, /no longer/i, /was deleted/i,
    /already (deleted|removed|cancelled|done|exists|closed)/i,
    /conflict/i, /missing (row|record|id|task)/i,
    /invalid (row|record|id|task|item)/i
  ];

  function classifyError_(err) {
    var msg = String(err && err.message || err);
    for (var i = 0; i < CONFLICT_HINTS.length; i++) {
      if (CONFLICT_HINTS[i].test(msg)) return 'conflict';
    }
    return 'failed';
  }

  function describeError_(err) {
    var msg = String(err && err.message || err);
    return (msg && msg !== 'undefined') ? msg
      : 'The server rejected this action or was unavailable.';
  }

  function summary() {
    var q = load();
    var h = historyLoad();
    return {
      queued: q.filter(function (item) { return item.status === 'queued'; }).length,
      syncing: q.filter(function (item) { return item.status === 'syncing'; }).length,
      failed: q.filter(function (item) { return item.status === 'failed'; }).length,
      conflict: q.filter(function (item) { return item.status === 'conflict'; }).length,
      synced: h.length,
      backlog: q.length
    };
  }
  function totalProblems() {
    var s = summary();
    return s.failed + s.conflict + s.syncing + s.queued;
  }

  function renderQueueStatus() {
    var label = document.getElementById('offlineLabel');
    var view = document.getElementById('offlineViewBtn');
    var q = load();
    var n = q.length;
    var problems = summary();
    var failed = problems.failed + problems.conflict;
    if (label) {
      if (n > 0) {
        label.textContent = (
          failed ? (failed + (failed === 1 ? ' action failed' : ' actions failed') +
                    ' to sync and need retry. ') : ''
        ) + (
          (n - failed) ? (n - failed) + ' queued action(s) will sync when your connection returns.' : ''
        );
      } else {
        label.textContent = 'You appear to be offline. Some actions may not work until your connection returns.';
      }
    }
    if (view) view.classList.toggle('hidden', totalProblems() === 0);
    if (typeof window.updateOfflineBanner === 'function') window.updateOfflineBanner();
  }

  function enqueue(fn, args) {
    var q = load();
    q.push({
      id: cid(), fn: fn, args: args, ts: Date.now(),
      status: 'queued', attempts: 0
    });
    if (q.length > MAX_QUEUE) q.splice(0, q.length - MAX_QUEUE);
    save(q);
    renderQueueStatus();
    emit('OfflineQueueChange', { pending: q.length, status: summary() });
    return Promise.resolve({ queued: true, pending: q.length });
  }

  function findIndexById(q, id) {
    for (var i = 0; i < q.length; i++) {
      if (q[i].id === id) return i;
    }
    return -1;
  }

  function remove(item, q) {
    var arr = q || load();
    var i = findIndexById(arr, item.id);
    if (i !== -1) { arr.splice(i, 1); save(arr); }
    return arr.length;
  }

  function archiveSynced_(item) {
    var h = historyLoad();
    h.push({
      id: item.id, fn: item.fn, args: item.args, ts: item.ts,
      syncedAt: Date.now(), status: 'synced'
    });
    if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);
    historySave(h);
  }

  function callReal_(item) {
    try {
      return realApiCall.apply(null, [item.fn].concat(item.args || []));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function flush() {
    var q = load();
    var now = Date.now();
    q = q.filter(function(item){ return !item.nextRetryAt || item.nextRetryAt <= now || item.status === 'conflict'; });
    if (!q.length) return Promise.resolve({ flushed: 0, failed: 0, pending: 0, status: summary() });
    var flushed = 0;
    var failed = 0;
    var chain = Promise.resolve();
    q.forEach(function (item) {
      chain = chain.then(function () {
        item.status = 'syncing';
        item.attempts = (item.attempts || 0) + 1;
        item.lastError = null;
        save(q);
        emit('OfflineQueueChange', { pending: pending(), status: summary() });
        return callReal_(item).then(function () {
          flushed++;
          item.status = 'synced';
          item.syncedAt = Date.now();
          archiveSynced_(item);
          remove(item, q);
          renderQueueStatus();
          emit('OfflineQueueChange', { pending: pending(), status: summary() });
        }, function (err) {
          failed++;
          item.status = classifyError_(err);
          item.lastError = describeError_(err);
          if (item.status === 'failed' && item.attempts < 4) item.nextRetryAt = Date.now() + Math.min(120000, Math.pow(2, item.attempts) * 5000);
          else item.nextRetryAt = 0;
          item.lastErrorAt = Date.now();
          save(q);
          renderQueueStatus();
          emit('OfflineQueueChange', { pending: pending(), status: summary() });
        });
      });
    });
    return chain.then(function () {
      renderQueueStatus();
      emit('OfflineQueueFlushed', {
        flushed: flushed, failed: failed, pending: pending(), status: summary()
      });
      return { flushed: flushed, failed: failed, pending: pending(), status: summary() };
    });
  }

  /* Retry a single failed/conflict action: mark it queued again so it is
     picked up by the next flush, then attempt a flush immediately. */
  function retryItem(id) {
    var q = load();
    var i = findIndexById(q, id);
    if (i === -1) return Promise.resolve({ queued: 0, pending: q.length });
    q[i].status = 'queued';
    q[i].lastError = null;
    q[i].nextRetryAt = 0;
    save(q);
    renderQueueStatus();
    emit('OfflineQueueChange', { pending: q.length, status: summary() });
    return flush();
  }

  function retryAll() {
    var q = load();
    var reQueued = 0;
    q.forEach(function (item) {
      if (item.status === 'failed' || item.status === 'conflict') {
        item.status = 'queued';
        item.lastError = null;
        reQueued++;
      }
    });
    save(q);
    renderQueueStatus();
    emit('OfflineQueueChange', { pending: q.length, status: summary() });
    if (reQueued === 0) return Promise.resolve({ queued: 0, pending: q.length });
    return flush();
  }

  function discardItem(id) {
    var q = load();
    var i = findIndexById(q, id);
    if (i === -1) return false;
    q.splice(i, 1);
    save(q);
    renderQueueStatus();
    emit('OfflineQueueChange', { pending: q.length, status: summary() });
    emit('OfflineQueueDiscarded', { id: id });
    return true;
  }

  function clearHistory() {
    historySave([]);
    renderQueueStatus();
    emit('OfflineQueueChange', { pending: pending(), status: summary() });
  }

  /* ------------------------- Offline activity center ------------------------- */

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function shortArg_(a) {
    if (a == null) return String(a);
    if (typeof a === 'string') return a.length > 24 ? a.slice(0, 24) + '…' : a;
    if (typeof a === 'number' || typeof a === 'boolean') return String(a);
    if (Array.isArray(a)) return '[' + a.length + ' item(s)]';
    if (typeof a === 'object') {
      try {
        var s = JSON.stringify(a);
        return s.length > 48 ? s.slice(0, 48) + '…' : s;
      } catch (e) { return '[object]'; }
    }
    return String(a);
  }

  function describeItem_(item) {
    var parts = (item.args || []).map(shortArg_);
    return parts.length ? item.fn + ' · ' + parts.join(', ') : item.fn;
  }

  function timeText_(ts) {
    try { return new Date(ts).toLocaleString(); } catch (e) { return ''; }
  }

  var TONE = {
    queued: 'secondary',
    syncing: 'info',
    failed: 'danger',
    conflict: 'danger',
    synced: 'success'
  };
  var STATE_LABEL = {
    queued: 'Queued',
    syncing: 'Syncing…',
    failed: 'Failed',
    conflict: 'Conflict',
    synced: 'Synced'
  };

  function itemRow_(item, isHistory) {
    var tone = TONE[item.status] || 'muted';
    var label = STATE_LABEL[item.status] || item.status;
    var actions = '';
    if (!isHistory) {
      if (item.status === 'failed' || item.status === 'conflict') {
        actions += '<button class="btn btn-primary btn-small" type="button" data-oq-retry="' + esc(item.id) + '">Retry</button>';
      }
      if (item.status === 'queued' || item.status === 'failed' || item.status === 'conflict') {
        actions += '<button class="btn btn-ghost btn-small" type="button" data-oq-remove="' + esc(item.id) + '">Remove</button>';
      }
    }
    var errHtml = '';
    if (!isHistory && item.lastError) {
      errHtml = '<div class="oq-item-err">' + esc(item.lastError) + '</div>';
    }
    var when = isHistory ? 'Synced ' + timeText_(item.syncedAt) : 'Queued ' + timeText_(item.ts);
    var attempts = (item.attempts || 0) > 1 ? ' · ' + item.attempts + ' attempts' : '';
    return (
      '<div class="oq-item" data-state="' + esc(item.status) + '">' +
        '<div class="oq-item-head">' +
          '<span class="badge" data-tone="' + esc(tone) + '">' + esc(label) + '</span>' +
          '<strong class="oq-item-name">' + esc(item.fn) + '</strong>' +
          '<span class="oq-item-time">' + esc(when) + attempts + '</span>' +
        '</div>' +
        (item.args && item.args.length ? '<div class="oq-item-args">' + esc(describeItem_(item)) + '</div>' : '') +
        errHtml +
        (actions ? '<div class="oq-item-actions">' + actions + '</div>' : '') +
      '</div>'
    );
  }

  function renderOfflineCenter() {
    var list = document.getElementById('offlineCenterList');
    var summaryEl = document.getElementById('offlineCenterSummary');
    if (!list) return;
    var s = summary();
    var q = load();
    var h = historyLoad();
    var rows = q.map(function (item) { return itemRow_(item, false); });
    rows.push.apply(rows, h.map(function (item) { return itemRow_(item, true); }));
    if (summaryEl) {
      summaryEl.innerHTML =
        '<span class="badge" data-tone="secondary">' + s.queued + ' queued</span>' +
        '<span class="badge" data-tone="info">' + s.syncing + ' syncing</span>' +
        '<span class="badge" data-tone="danger">' + (s.failed + s.conflict) + ' failed</span>' +
        '<span class="badge" data-tone="success">' + s.synced + ' synced</span>';
    }
    list.innerHTML = rows.length
      ? rows.join('')
      : '<div class="oq-center-empty">No offline activity. Queued actions will appear here when you work without a connection.</div>';
    var foot = document.getElementById('offlineCenterFoot');
    if (foot) {
      var retryBtn = foot.querySelector('[data-oq-retry-all]');
      if (retryBtn) retryBtn.disabled = (s.failed + s.conflict) === 0;
      var historyBtn = foot.querySelector('[data-oq-clear-history]');
      if (historyBtn) historyBtn.disabled = s.synced === 0;
    }
  }

  function refreshAfterChange_() {
    renderOfflineCenter();
    renderQueueStatus();
  }

  function openOfflineCenter() {
    renderOfflineCenter();
    if (typeof window.openDialog === 'function') window.openDialog('offlineCenterModal');
  }

  function closeOfflineCenter() {
    if (typeof window.closeDialog === 'function') window.closeDialog('offlineCenterModal');
  }

  function wireOfflineCenter_() {
    var modal = document.getElementById('offlineCenterModal');
    if (!modal) return;
    modal.addEventListener('click', function (event) {
      var retry = event.target.closest('[data-oq-retry]');
      if (retry) {
        if (typeof window.showConfirm === 'function') {
          window.showConfirm({ message: 'Retry this action now?', okLabel: 'Retry' }).then(function (ok) {
            if (ok) retryItem(retry.getAttribute('data-oq-retry')).then(function (res) {
              if (res && res.flushed) {
                if (window.refreshData) window.refreshData();
                if (window.loadNotifications) window.loadNotifications(true);
              }
            });
          });
        } else {
          retryItem(retry.getAttribute('data-oq-retry'));
        }
        return;
      }
      var rm = event.target.closest('[data-oq-remove]');
      if (rm) {
        if (typeof window.showConfirm === 'function') {
          window.showConfirm({ message: 'Remove this action from the queue? It will not be synced.', okLabel: 'Remove', danger: true }).then(function (ok) {
            if (ok) {
              if (discardItem(rm.getAttribute('data-oq-remove')) && typeof window.showToast === 'function') {
                window.showToast('Removed from offline queue.', 'info');
              }
            }
          });
        } else {
          discardItem(rm.getAttribute('data-oq-remove'));
        }
        return;
      }
    });
  }

  function showUpdateBanner() {
    var banner = document.getElementById('updateBanner');
    if (!banner) return;
    banner.classList.remove('hidden');
    var label = document.getElementById('updateLabel');
    if (label) label.textContent = 'A new version of the dashboard is available.';
    renderQueueStatus();
  }

  function hideUpdateBanner() {
    var banner = document.getElementById('updateBanner');
    if (!banner) return;
    banner.classList.add('hidden');
  }

  function applyUpdate() {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
  }

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (registration) {
        registration.addEventListener('updatefound', function () {
          var installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', function () {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              emit('ServiceWorkerUpdateAvailable', { registration: registration });
              if (typeof window.showToast === 'function') {
                window.showToast('A new dashboard version is available. Reload to update.', 'info');
              }
              showUpdateBanner();
            }
          });
        });
      }).catch(function () {});
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (typeof window.showToast === 'function') {
        window.showToast('Dashboard updated. Reloading…', 'info');
      }
      window.location.reload();
    });
  }

  var realApiCall = window.apiCall_ || function () {
    throw new Error('apiCall_ not available');
  };

  window.apiCall_ = function (fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (MUTATIONS[fn] && navigator.onLine === false) {
      return enqueue(fn, stabilizeArgs_(fn, args));
    }
    return realApiCall.apply(null, arguments);
  };

  window.OfflineQueue = {
    enqueue: enqueue,
    flush: flush,
    pending: pending,
    isMutation: function (fn) { return !!MUTATIONS[fn]; },
    retry: retryItem,
    retryAll: retryAll,
    discard: discardItem,
    clearHistory: clearHistory,
    history: historyLoad,
    items: load,
    summary: summary,
    status: function () {
      var s = summary();
      return {
        queued: s.backlog,
        syncing: s.syncing,
        failed: s.failed + s.conflict,
        conflict: s.conflict,
        synced: s.synced,
        pending: s.backlog
      };
    }
  };

  registerServiceWorker();
  wireOfflineCenter_();

  if (window.EventBus) {
    EventBus.on('OfflineQueueChange', refreshAfterChange_);
    EventBus.on('OfflineQueueFlushed', refreshAfterChange_);
  }

  window.addEventListener('online', function () {
    renderQueueStatus();
    if (pending()) {
      flush().then(function (res) {
        renderQueueStatus();
        if (res.flushed && window.refreshData) window.refreshData();
        if (window.loadNotifications) window.loadNotifications(true);
      });
    }
  });
  window.addEventListener('offline', renderQueueStatus);

  window.openOfflineCenter = openOfflineCenter;
  window.closeOfflineCenter = closeOfflineCenter;
  window.refreshWithCacheBurst = refreshWithCacheBurst;

  window.OfflineQueueSyncNow = function () {
    flush().then(function (res) {
      if (res && res.flushed && window.refreshData) window.refreshData();
      if (typeof window.showToast === 'function') {
        if (res && res.failed) window.showToast(res.failed + ' failed action(s).', 'error');
        else if (res && res.flushed) window.showToast('All queued actions synced.', 'success');
        else window.showToast('Nothing to sync.', 'info');
      }
    });
  };

  window.OfflineQueueRetryAll = function () {
    retryAll().then(function (res) {
      if (typeof window.showToast === 'function') {
        if (res && res.flushed) window.showToast('Retried ' + res.flushed + ' action(s).', 'success');
        else window.showToast('No failed actions to retry.', 'info');
      }
    });
  };

  window.OfflineQueueClearHistory = function () {
    if (historyLoad().length === 0) {
      if (typeof window.showToast === 'function') window.showToast('No synced history to clear.', 'info');
      return;
    }
    clearHistory();
    if (typeof window.showToast === 'function') window.showToast('Synced history cleared.', 'info');
  };

  window.applyUpdate = function () {
    applyUpdate();
    if (typeof window.showToast === 'function') {
      window.showToast('Updating… Reloading.', 'info');
    }
  };

  /* Manual "Refresh" from the dashboard: burst the service-worker cache so the
     latest dashboard version is always loaded. When an update is available the
     new (installing) service worker is told to skip waiting and take control →
     the controllerchange handler reloads the app with the fresh shell. When no
     newer version exists we fall back to a plain data refresh so the button
     never feels dead. */
  var CHECK_WINDOW_MS = 3000;
  function refreshWithCacheBurst() {
    var settled = false;
    function finish(updateFound) {
      if (settled) return;
      settled = true;
      if (updateFound && navigator.serviceWorker.controller) {
        // applying: SKIP_WAITING already posted; controllerchange will reload.
        return;
      }
      if (typeof window.refreshData === 'function') window.refreshData();
    }
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      finish(false);
      return;
    }
    navigator.serviceWorker.ready.then(function (reg) {
      var sawUpdate = false;
      var applying = false;
      function installed() {
        if (applying || settled) return;
        applying = true;
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
          finish(true);
        } else {
          finish(false);
        }
      }
      function onUpdateFound() {
        sawUpdate = true;
        var w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed') installed();
          else if (w.state === 'redundant') finish(false);
        });
      }
      reg.addEventListener('updatefound', onUpdateFound);
      reg.update().then(function () {
        if (!sawUpdate) finish(false);
      }).catch(function () {
        finish(false);
      });
    }).catch(function () {
      finish(false);
    });
  }

  window.dismissUpdate = function () {
    hideUpdateBanner();
  };

  renderQueueStatus();
})();
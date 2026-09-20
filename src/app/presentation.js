/* ---------------------------------- Presentation Mode ---------------------------------- */
/* Full-screen slideshow over the current dashboard record set: one record per
   slide using the same card-field rendering semantics. Only two record
   actions are exposed — Show/Hide Submissions (reuses the existing per-record
   visibility state) and Mark as Completed (reuses review-completion
   semantics). All links reuse the existing in-page preview popup (80% zoom
   default). */

var presentationState = {
  active: false,          // is the overlay open?
  index: 0,               // current slide index
  items: [],              // snapshot of the visible record set at entry
  touchStartX: 0,
  touchStartY: 0,
  touchTarget: null,
  resumeRow: null
};

/* ---- Link warming state: deduped, concurrency-limited, abortable ----
   Warms with hidden <iframe>s (not fetch no-cors) so the warmed document is
   the *same* browsing-context type the preview modal uses — the warmed frame
   can be reparented straight into the modal instead of re-navigating, which
   is what actually makes a click load instantly. */
var presentationWarm = {
  MAX_CONCURRENCY: 4,
  MAX_RETRIES: 2,
  RETRY_BASE_MS: 900,
  TIMEOUT_MS: 8000,
  queue: [],
  status: {},                // URL -> queued|loading|ready|failed
  retryAt: {},               // URL -> epoch ms before another attempt
  retryCount: {},            // URL -> number of retries already used
  seenOrigins: {},
  inflight: 0,
  generation: 0,             // invalidates late iframe events after exit
  frames: {},                // embeddable URL -> { node, frame, ready }
  previewCache: {},           // embeddable URL -> { node, frame, ready }
  previewCacheOrder: []      // cache order for adopted preview frames
};

/* Buffer the previous/current/next/next-next slides' links in the background
   so a click loads instantly. Deduping (seenUrls) keeps the warm set bounded;
   the FIFO queue + concurrency pump keeps it polite. */
function warmNearbySlides_() {
  const items = presentationState.items;
  const idx = presentationState.index;
  const targets = [];
  // Priority order: current → next → previous → next+1 → next+2 → previous+1.
  // This keeps the most likely click targets warm first without warming the
  // entire deck at entry. The concurrency-limited pump handles the rest.
  [idx, idx + 1, idx - 1, idx + 2, idx + 3, idx - 2].forEach(function (i) {
    if (items[i]) targets.push(items[i]);
  });
  warmPresentationLinks_(targets);
}

function enterPresentationMode() {
  const items = sortedItems(); // respects current search/sector/review/hidden filters + sort
  if (!items || !items.length) {
    showToast('No records to present.', 'warning');
    return;
  }

  let savedRow = '';
  try { savedRow = localStorage.getItem('dash.presentation.resumeRow') || ''; } catch (err) {}
  const savedIndex = items.findIndex(function (item) { return String(item.row) === savedRow; });
  const startPresentation_ = function (index, resumed) {
    presentationState.items = items.slice();
    presentationState.index = Math.max(0, index);
    presentationState.active = true;
    presentationState.resumeRow = String(presentationState.items[presentationState.index].row);
    presentationWarm.generation++;
    presentationWarm.queue = [];
    presentationWarm.status = {};
    presentationWarm.retryAt = {};
    presentationWarm.retryCount = {};
    presentationWarm.seenOrigins = {};
    presentationWarm.inflight = 0;
    presentationWarm.frames = {};
    presentationWarm.previewCache = {};
    presentationWarm.activePreviewTarget = null;
    presentationWarm.previewCacheOrder = [];
    const overlay = getEl('presentationOverlay');
    if (overlay) {
      overlay.classList.add('presentation-open');
      renderPresentationSlide_();
      wirePresentationTouch_();
      const nextBtn = getEl('presentationNextBtn');
      if (nextBtn) nextBtn.focus();
    }
    if (resumed) showToast('Resumed presentation from card ' + (index + 1) + '.', 'success');
    warmNearbySlides_();
  };

  if (savedIndex >= 0) {
    showConfirm({
      title: 'Resume presentation?',
      message: 'Resume from card ' + (savedIndex + 1) + ' of ' + items.length + '?',
      okLabel: 'Resume'
    }).then(function (ok) {
      startPresentation_(ok ? savedIndex : 0, ok);
    });
    return;
  }

  startPresentation_(0, false);
}

function exitPresentationMode() {
  /* Return any modal parked inside the fullscreen overlay back to the
     document before the overlay is hidden, so it stays usable after exit. */
  try {
    if (typeof restoreModalFromFullscreen_ === 'function') {
      document.querySelectorAll('.modal-backdrop').forEach(restoreModalFromFullscreen_);
    }
  } catch (err) {}
  presentationState.active = false;
  try { localStorage.setItem('dash.presentation.resumeRow', presentationState.resumeRow || ''); } catch (err) {}
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
  // Iframes do not support fetch-style AbortController cancellation. A
  // generation token makes late events harmless; removing the browsing
  // contexts releases the actual navigation/document.
  presentationWarm.generation++;
  presentationWarm.queue = [];
  presentationWarm.inflight = 0;
  presentationWarm.frames = {};
  presentationWarm.previewCache = {};
  presentationWarm.activePreviewTarget = null;
  presentationWarm.status = {};
  presentationWarm.retryAt = {};
  presentationWarm.retryCount = {};
  presentationWarm.previewCacheOrder = [];
  document.querySelectorAll('.pres-warm-frame').forEach(function (node) {
    if (node.parentNode) node.parentNode.removeChild(node);
  });
  removePresentationPreconnects_();
  const overlay = getEl('presentationOverlay');
  if (overlay) overlay.classList.remove('presentation-open');
  const stage = getEl('presentationStage');
  if (stage) stage.innerHTML = '';
}

function togglePresentationMode() {
  if (presentationState.active) exitPresentationMode();
  else enterPresentationMode();
}

/* ---- Render the current slide ---- */
function renderPresentationSlide_() {
  const stage = getEl('presentationStage');
  if (!stage) return;
  const items = presentationState.items;
  if (!items.length) return;
  // Wrap-around index guard
  if (presentationState.index < 0) presentationState.index = items.length - 1;
  if (presentationState.index > items.length - 1) presentationState.index = 0;
  const item = items[presentationState.index];
  stage.innerHTML = presentationSlideHtml_(item);

  const counter = getEl('presentationCounter');
  if (counter) counter.textContent = (presentationState.index + 1) + ' / ' + items.length;
  const progress = getEl('presentationProgress');
  if (progress) {
    const pct = items.length ? ((presentationState.index + 1) / items.length) * 100 : 0;
    progress.style.width = pct + '%';
    progress.setAttribute('aria-valuenow', String(Math.round(pct)));
  }
  presentationState.resumeRow = String(item.row);
  try { localStorage.setItem('dash.presentation.resumeRow', presentationState.resumeRow); } catch (err) {}

  // Re-apply the slide's submission visibility state to the slide's toggle.
  const updatesHidden = isRowUpdatesHidden_(item.row);
  const toggle = stage.querySelector('[data-pres-updates]');
  if (toggle) toggle.textContent = updatesHidden ? 'Show submissions' : 'Hide submissions';

  const prevBtn = getEl('presentationPrevBtn');
  const nextBtn = getEl('presentationNextBtn');
  if (prevBtn) prevBtn.disabled = items.length <= 1;
  if (nextBtn) nextBtn.disabled = items.length <= 1;
}

/* Reuses the same field traversal as dashboard cards (groupCardFields_ +
   cardFieldHtml_) so Presentation Mode shows exactly what users already see,
   with only the two allowed record actions. */
function presentationSlideHtml_(item) {
  const groups = groupCardFields_(item.displayFields);
  /* Presentation mode is intentionally meeting-focused: only Action and
     Last Meeting Instructions are shown. */
  const fieldsHtml = groups.action.concat(groups.instructions || [])
    .map(function (f) { return cardFieldHtml_(item, f); }).join('');

  const updatesHidden = isRowUpdatesHidden_(item.row);
  const updatesHtml = rowUpdatesHtml_(item.row);
  const updatesBlock = updatesHtml
    ? `<div class="card-updates${updatesHidden ? ' updates-hidden' : ''}" data-updates-row="${escAttr(item.row)}">${updatesHtml}</div>`
    : '';

  const subCount = (appState.submissionCounts || {})[item.row] || 0;
  const statusBadge = item.reviewStatus === 'due'
    ? '<span class="review-badge review-due">Review due</span>'
    : item.reviewStatus === 'done'
      ? '<span class="review-badge review-done">Review done</span>'
      : '<span class="badge" data-tone="muted">Not reviewed</span>';

  /* Only two controls per spec. Mark as Completed uses existing
     review-completion semantics and stays admin-gated like the dashboard. */
  let actions = '';
  if (updatesHtml) {
    actions += `<button class="btn btn-secondary btn-small presentation-act" data-pres-updates="${escAttr(item.row)}" type="button" onclick="presentationToggleUpdates_(${escAttr(item.row)}, this)">${updatesHidden ? 'Show submissions' : 'Hide submissions'}</button>`;
  }
  if (appState.isAdmin) {
    if (item.reviewStatus === 'done') {
      actions += `<button class="btn btn-ghost btn-small presentation-act" type="button" onclick="presentationUndoDone_(${escAttr(item.row)}, this)">Undo</button>`;
    } else {
      actions += `<button class="btn btn-primary btn-small presentation-act" type="button" onclick="presentationMarkDone_(${escAttr(item.row)}, this)">Mark as Completed</button>`;
    }
  }

  return `
    <article class="card presentation-slide-card" data-row="${escAttr(item.row)}">
      <div class="presentation-slide-head">
        <span class="id-badge">#${escapeHtml(item.id)}</span>
        ${statusBadge}
        <span class="presentation-subcount">${subCount} submission${subCount === 1 ? '' : 's'}</span>
      </div>
      <div class="presentation-slide-body">
        <div class="card-fields">${fieldsHtml || '<div class="card-field"><span class="field-label">Details</span><div class="field-value preserve-whitespace">No details available</div></div>'}${updatesBlock}</div>
        ${presentationLinksHtml_(item)}
      </div>
      <div class="presentation-slide-actions">${actions || '<span class="presentation-actions-empty">No actions available</span>'}</div>
    </article>`;
}

/* Show/Hide Submissions — reuses the existing toggle state (toggleCardUpdates
   owns the authoritative per-record visibility) and relabels with the
   presentation wording. */
function presentationToggleUpdates_(row, btn) {
  toggleCardUpdates(row, btn, true);
  const hidden = isRowUpdatesHidden_(row);
  if (btn) btn.textContent = hidden ? 'Show submissions' : 'Hide submissions';
  const stage = getEl('presentationStage');
  if (stage) {
    const alt = stage.querySelectorAll('[data-pres-updates="' + String(row).replace(/["\\]/g, '\\$&') + '"]');
    alt.forEach(function (el) { if (el !== btn) el.textContent = hidden ? 'Show submissions' : 'Hide submissions'; });
  }
}

/* Mark as Completed — reuses the existing review-completion semantics
   (ApiService.markReviewDone / reviewStatus) plus the same confirm pattern as
   the dashboard, then refreshes the slide in place and keeps dashboard state. */
function presentationMarkDone_(row, btn) {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  showConfirm({
    title: 'Mark review done',
    message: 'Mark this record\'s review as completed?',
    okLabel: 'Mark done'
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Marking review as done…');
    ApiService.markReviewDone(row).then(function (data) {
      hideOverlay();
      const item = presentationState.items[presentationState.index];
      if (item && String(item.row) === String(row)) item.reviewStatus = 'done';
      if (data && data.items) appState.items = data.items;
      if (data && data.summary) appState.summary = data.summary;
      renderDashboard(true);
      renderPresentationSlide_();
      showToast('Marked review as done', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Failed: ' + (err.message || err), 'error');
    });
  });
}

function presentationUndoDone_(row) {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  showOverlay('Undoing review completion…');
  ApiService.markReviewNotDone(row).then(function (data) {
    hideOverlay();
    const item = presentationState.items[presentationState.index];
    if (item && String(item.row) === String(row)) item.reviewStatus = 'due';
    if (data && data.items) appState.items = data.items;
    if (data && data.summary) appState.summary = data.summary;
    renderDashboard(true);
    renderPresentationSlide_();
    showToast('Review marked as not done', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Failed: ' + (err.message || err), 'error');
  });
}

/* ---- Slide navigation ---- */
function presentationNext_() {
  if (!presentationState.active) return;
  presentationState.index++;
  renderPresentationSlide_();
  warmNearbySlides_();
}

function presentationPrev_() {
  if (!presentationState.active) return;
  presentationState.index--;
  renderPresentationSlide_();
  warmNearbySlides_();
}

/* ---- Keyboard ---- */
function getPresentationKeydown_() {
  return function (e) {
    if (!presentationState.active) return;
    // Never hijack keys while a dialog/preview is open above the slideshow.
    if (document.querySelector('.modal-backdrop:not(.hidden)')) return;
    const target = e.target;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
    if (typing) return;

    const key = e.key;
    if (key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      } else {
        exitPresentationMode();
      }
      return;
    }
    if (key === ' ' || key === 'ArrowRight' || key === 'PageDown') {
      e.preventDefault();
      e.stopPropagation();
      presentationNext_();
      return;
    }
    if (key === 'ArrowLeft' || key === 'PageUp') {
      e.preventDefault();
      e.stopPropagation();
      presentationPrev_();
      return;
    }
    if (key === 'Home') {
      e.preventDefault(); e.stopPropagation();
      presentationState.index = 0; renderPresentationSlide_(); warmNearbySlides_(); return;
    }
    if (key === 'End') {
      e.preventDefault(); e.stopPropagation();
      presentationState.index = presentationState.items.length - 1; renderPresentationSlide_(); warmNearbySlides_(); return;
    }
    if (key === 'f' || key === 'F') {
      e.preventDefault(); e.stopPropagation(); togglePresentationFullscreen_(); return;
    }
    if (key === 's' || key === 'S') {
      e.preventDefault(); e.stopPropagation();
      const btn = getEl('presentationStage') && getEl('presentationStage').querySelector('[data-pres-updates]');
      if (btn) presentationToggleUpdates_(presentationState.items[presentationState.index].row, btn);
      return;
    }
    if (key === '?') {
      e.preventDefault(); e.stopPropagation();
      showToast('←/→ navigate · Space next · Home/End first/last · F fullscreen · S submissions · C complete · Esc exit', 'info');
      return;
    }
    if (key === 'c' || key === 'C') {
      e.preventDefault(); e.stopPropagation();
      const item = presentationState.items[presentationState.index];
      if (item && appState.isAdmin && item.reviewStatus !== 'done') presentationMarkDone_(item.row);
      return;
    }
  };
}

/* Ctrl/Cmd+Shift+P toggles Presentation Mode. Only fires when not typing and
   not already handled by another dialog. Registered once at module load. */
function getPresentationToggle_() {
  return function (e) {
    const mod = e.ctrlKey || e.metaKey;
    if (!(mod && e.shiftKey && (e.key === 'P' || e.key === 'p'))) return;
    const target = e.target;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
    if (typing) return;
    e.preventDefault();
    e.stopPropagation();
    togglePresentationMode();
  };
}

function togglePresentationFullscreen_() {
  const overlay = getEl('presentationOverlay');
  if (!overlay) return;
  if (document.fullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
    return;
  }
  if (overlay.requestFullscreen) {
    overlay.requestFullscreen().catch(function () { showToast('Fullscreen is not available in this browser.', 'warning'); });
  } else {
    showToast('Fullscreen is not available in this browser.', 'warning');
  }
}

function wirePresentationEvents_() {
  document.addEventListener('keydown', getPresentationKeydown_(), true);
  document.addEventListener('keydown', getPresentationToggle_(), true);

  ['presentationPrevBtn', 'presentationNextBtn', 'presentationExitBtn', 'presentationFullscreenBtn'].forEach(function (id) {
    const btn = getEl(id);
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (id === 'presentationPrevBtn') presentationPrev_();
      else if (id === 'presentationNextBtn') presentationNext_();
      else if (id === 'presentationFullscreenBtn') togglePresentationFullscreen_();
      else exitPresentationMode();
    });
  });
}

/* ---- Touch swipe (left → next, right → prev) ---- */
function wirePresentationTouch_() {
  const overlay = getEl('presentationOverlay');
  if (!overlay || overlay.getAttribute('data-pres-touch-wired')) return;
  overlay.setAttribute('data-pres-touch-wired', '1');

  overlay.addEventListener('touchstart', function (e) {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    presentationState.touchStartX = t.clientX;
    presentationState.touchStartY = t.clientY;
    presentationState.touchTarget = e.target;
  }, { passive: true });

  overlay.addEventListener('touchend', function (e) {
    if (!presentationState.active) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - presentationState.touchStartX;
    const dy = t.clientY - presentationState.touchStartY;
    // Ignore taps, vertical scrolls, and touches inside interactive elements.
    const el = presentationState.touchTarget;
    if (el && el.closest && el.closest('button, a, iframe, input, textarea, select, [data-pres-updates], .card-updates')) return;
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dy) > Math.abs(dx) * 1.2) return;
    if (dx < 0) presentationNext_();
    else presentationPrev_();
  }, { passive: true });
}

/* ---- Links ---- */

function presentationLinksHtml_(item) {
  const links = (item && item.linkUrls) || {};
  const keys = Object.keys(links);
  if (!keys.length) return '';
  let html = '<div class="presentation-links">';
  keys.forEach(function (key) {
    const url = String(links[key] || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) return;
    const text = (item.linkTexts && item.linkTexts[key]) || key;
    html += '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" data-embed class="presentation-link">' + escapeHtml(text) + '</a><br>';
  });
  html += '</div>';
  return html;
}

/* ---- Link preloading / buffering ---- */
/* Warm the URL the popup actually loads (toEmbeddableUrl). A small state
   machine keeps URLs from disappearing at the concurrency cap, retries
   transient failures twice, and uses a generation token so late iframe
   events after exit cannot mutate the current presentation. */
function warmPresentationLinks_(targets) {
  if (!presentationState.active) return;
  const now = Date.now();
  const urls = [];

  targets.forEach(function (item) {
    const links = (item && item.linkUrls) || {};
    Object.keys(links).forEach(function (k) {
      const raw = String(links[k] || '').trim();
      if (!/^https?:\/\//i.test(raw)) return;
      let target = raw;
      try { target = (typeof toEmbeddableUrl === 'function' && toEmbeddableUrl(raw)) || raw; } catch (err) {}
      const state = presentationWarm.status[target];
      if (state === 'loading' || state === 'ready' || state === 'queued') return;
      if (state === 'failed' && (presentationWarm.retryAt[target] || 0) > now) return;
      presentationWarm.status[target] = 'queued';
      urls.push(target);
    });
  });

  urls.forEach(function (target) {
    warmPresentationOrigin_(target);
    presentationWarm.queue.push(target);
  });
  pumpPresentationWarm_();
}

function pumpPresentationWarm_() {
  if (!presentationState.active) return;
  while (presentationWarm.inflight < presentationWarm.MAX_CONCURRENCY && presentationWarm.queue.length) {
    const url = presentationWarm.queue.shift();
    if (presentationWarm.status[url] !== 'queued') continue;
    if ((presentationWarm.retryAt[url] || 0) > Date.now()) {
      presentationWarm.queue.push(url);
      break;
    }
    warmPresentationUrl_(url);
  }
}

function schedulePresentationRetry_(url, generation) {
  if (!presentationState.active || generation !== presentationWarm.generation) return;
  const used = presentationWarm.retryCount[url] || 0;
  if (used >= presentationWarm.MAX_RETRIES) {
    presentationWarm.status[url] = 'failed';
    return;
  }
  presentationWarm.retryCount[url] = used + 1;
  const delay = presentationWarm.RETRY_BASE_MS * Math.pow(2, used);
  presentationWarm.retryAt[url] = Date.now() + delay;
  presentationWarm.status[url] = 'failed';
  setTimeout(function () {
    if (!presentationState.active || generation !== presentationWarm.generation) return;
    if ((presentationWarm.retryAt[url] || 0) > Date.now()) return;
    if (presentationWarm.status[url] !== 'failed') return;
    presentationWarm.status[url] = 'queued';
    presentationWarm.queue.push(url);
    pumpPresentationWarm_();
  }, delay);
}

function warmPresentationUrl_(url) {
  if (!presentationState.active) return;
  const generation = presentationWarm.generation;
  presentationWarm.inflight++;
  presentationWarm.status[url] = 'loading';

  const holder = document.createElement('div');
  holder.setAttribute('data-pres-warm-frame', '1');
  holder.className = 'pres-warm-frame';
  const frame = document.createElement('iframe');
  frame.setAttribute('data-pres-warm-url', url);
  frame.setAttribute('loading', 'eager');
  frame.setAttribute('aria-hidden', 'true');
  holder.appendChild(frame);
  document.body.appendChild(holder);

  let finished = false;
  let timer = null;

  const finishWarm_ = function (keepHolder, ready) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);

    if (generation !== presentationWarm.generation || !presentationState.active || !keepHolder) {
      try { if (holder.parentNode) holder.parentNode.removeChild(holder); } catch (err) {}
    }

    presentationWarm.inflight = Math.max(0, presentationWarm.inflight - 1);
    if (generation === presentationWarm.generation && presentationState.active) {
      if (ready) {
        presentationWarm.status[url] = 'ready';
        presentationWarm.retryAt[url] = 0;
        presentationWarm.frames[url] = { node: holder, frame: frame, ready: true };
      } else {
        schedulePresentationRetry_(url, generation);
      }
      pumpPresentationWarm_();
    }
  };

  timer = setTimeout(function () {
    finishWarm_(false, false);
  }, presentationWarm.TIMEOUT_MS);

  frame.addEventListener('load', function () {
    finishWarm_(true, true);
  });
  frame.addEventListener('error', function () {
    finishWarm_(false, false);
  });

  frame.src = url;
}

function warmPresentationOrigin_(url) {
  try {
    const target = (typeof toEmbeddableUrl === 'function' && toEmbeddableUrl(url)) || url;
    const origin = new URL(target, window.location.href).origin;
    if (presentationWarm.seenOrigins[origin]) return;
    presentationWarm.seenOrigins[origin] = true;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.setAttribute('data-pres-warm', '1');
    document.head.appendChild(link);
  } catch (err) { /* malformed URL — ignore */ }
}

function removePresentationPreconnects_() {
  document.querySelectorAll('link[data-pres-warm]').forEach(function (l) { l.parentNode && l.parentNode.removeChild(l); });
  presentationWarm.seenOrigins = {};
}

wirePresentationEvents_();
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
  touchTarget: null
};

/* ---- Link warming state: deduped, concurrency-limited, abortable ---- */
var presentationWarm = {
  aborted: false,
  MAX_CONCURRENCY: 4,
  queue: [],       // pending URLs to warm (FIFO; survives calls)
  seenUrls: {},    // dedupe across all slides for the whole session
  seenOrigins: {},
  inflight: 0,
  controllers: []
};

function warmNearbySlides_() {
  const items = presentationState.items;
  const idx = presentationState.index;
  const targets = [];
  if (items[idx - 1]) targets.push(items[idx - 1]);
  if (items[idx]) targets.push(items[idx]);
  if (items[idx + 1]) targets.push(items[idx + 1]);
  if (items[idx + 2]) targets.push(items[idx + 2]);
  warmPresentationLinks_(targets);
}

function enterPresentationMode() {
  const items = sortedItems(); // respects current search/sector/review/hidden filters + sort
  if (!items || !items.length) {
    showToast('No records to present.', 'warning');
    return;
  }
  presentationState.items = items.slice();
  presentationState.index = 0;
  presentationState.active = true;
  presentationWarm.aborted = false;
  presentationWarm.queue = [];
  presentationWarm.seenUrls = {};
  presentationWarm.seenOrigins = {};
  presentationWarm.inflight = 0;
  presentationWarm.controllers = [];
  const overlay = getEl('presentationOverlay');
  if (overlay) {
    overlay.classList.add('presentation-open');
    renderPresentationSlide_();
    wirePresentationTouch_();
    const nextBtn = getEl('presentationNextBtn');
    if (nextBtn) nextBtn.focus();
  }
  warmNearbySlides_();
  warmRestOfDeck_();
}

/* Buffer every remaining slide's links in the background so later slides
   load instantly too. Deduping (seenUrls) makes the whole deck's links a
   bounded warm set; the FIFO queue + concurrency pump keeps it polite. */
function warmRestOfDeck_() {
  const items = presentationState.items;
  const idx = presentationState.index;
  const targets = items.filter(function (_, i) { return i > idx + 2; });
  warmPresentationLinks_(targets);
}

function exitPresentationMode() {
  presentationState.active = false;
  presentationWarm.aborted = true;
  presentationWarm.controllers.forEach(function (c) { try { c.abort(); } catch (err) {} });
  presentationWarm.controllers = [];
  presentationWarm.queue = [];
  presentationWarm.inflight = 0;
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
  const fieldsHtml = (groups.top.length
    ? `<div class="card-fields-row card-fields-row-top">${groups.top.map(function (f) { return cardFieldHtml_(item, f); }).join('')}</div>`
    : '') + (groups.action.length
    ? groups.action.map(function (f) { return cardFieldHtml_(item, f); }).join('')
    : '') + (groups.bottom.length
    ? `<div class="card-fields-row card-fields-row-bottom">${groups.bottom.map(function (f) { return cardFieldHtml_(item, f); }).join('')}</div>`
    : '');

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
      actions += '<span class="presentation-done-label">Completed</span>';
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
  toggleCardUpdates(row, btn);
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
      exitPresentationMode();
      return;
    }
    if (key === 'ArrowRight' || key === 'PageDown') {
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

function wirePresentationEvents_() {
  document.addEventListener('keydown', getPresentationKeydown_(), true);
  document.addEventListener('keydown', getPresentationToggle_(), true);

  ['presentationPrevBtn', 'presentationNextBtn', 'presentationExitBtn'].forEach(function (id) {
    const btn = getEl(id);
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (id === 'presentationPrevBtn') presentationPrev_();
      else if (id === 'presentationNextBtn') presentationNext_();
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
/* Warm links in the background while presentation mode is open so a click
   loads instantly. Warms the URL the popup actually loads (toEmbeddableUrl,
   which rewrites Drive links to their /preview form) rather than the raw
   href. Targets queue up FIFO and are processed with a bounded concurrency —
   URLs are never silently dropped at the cap. Current slide is appended
   first so it always gets priority over later slides. */
function warmPresentationLinks_(targets) {
  if (!presentationState.active) return;
  const urls = [];
  targets.forEach(function (item) {
    const links = (item && item.linkUrls) || {};
    Object.keys(links).forEach(function (k) {
      const url = String(links[k] || '').trim();
      if (/^https?:\/\//i.test(url) && !presentationWarm.seenUrls[url]) {
        presentationWarm.seenUrls[url] = true;
        urls.push(url);
      }
    });
  });
  urls.forEach(warmPresentationOrigin_);
  urls.forEach(function (url) {
    presentationWarm.queue.push(url);
  });
  pumpPresentationWarm_();
}

function pumpPresentationWarm_() {
  if (presentationWarm.aborted) return;
  while (presentationWarm.inflight < presentationWarm.MAX_CONCURRENCY && presentationWarm.queue.length) {
    const url = presentationWarm.queue.shift();
    warmPresentationUrl_(url);
  }
}

function warmPresentationUrl_(url) {
  presentationWarm.inflight++;
  const ctrl = new AbortController();
  presentationWarm.controllers.push(ctrl);
  const timer = setTimeout(function () { try { ctrl.abort(); } catch (err) {} }, 8000);
  const target = (typeof toEmbeddableUrl === 'function' && toEmbeddableUrl(url)) || url;
  fetch(target, { mode: 'no-cors', cache: 'default', signal: ctrl.signal })
    .catch(function () { /* opaque/no-cors may still fail on redirects — fine */ })
    .then(function () {
      clearTimeout(timer);
      presentationWarm.inflight--;
      pumpPresentationWarm_();
    });
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

function warmPresentationUrl_(url) {
  if (presentationWarm.inflight >= presentationWarm.MAX_CONCURRENCY) return;
  presentationWarm.inflight++;
  const ctrl = new AbortController();
  presentationWarm.controllers.push(ctrl);
  const timer = setTimeout(function () { try { ctrl.abort(); } catch (err) {} }, 8000);
  fetch(url, { mode: 'no-cors', cache: 'default', signal: ctrl.signal })
    .catch(function () { /* opaque/no-cors may still fail on redirects — fine */ })
    .then(function () {
      clearTimeout(timer);
      presentationWarm.inflight--;
    });
}

wirePresentationEvents_();
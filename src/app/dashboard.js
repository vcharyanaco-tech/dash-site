
/* ---------------------------------- Dashboard: filters ---------------------------------- */

function populateFilters() {
  const filter = getEl('sectorFilter');
  if (!filter) return;
  const selected = filter.value;
  const sectors = [...new Set(appState.items.map(function (item) { return item.sector; }).filter(Boolean))].sort();
  filter.innerHTML = '<option value="">All sectors</option>' + sectors.map(function (s) {
    return `<option value="${escAttr(s)}">${escapeHtml(s)}</option>`;
  }).join('');
  filter.value = selected;
}

/* Populate the edit-dialog responsibility multi-select with every responsibility
   entry returned by the server (all records, not just the current view). */
function populateResponsibilitySelect() {
  const hiddenInput = getEl('editResponsibility');
  if (!hiddenInput) return;
  const selected = hiddenInput.value || '';
  const list = appState.responsibilities || [];
  const options = list.map(function (r) {
    return { value: r, label: r };
  });
  populateMultiSelectOptions('editResponsibilityMs', options);
  // Restore selected value
  if (selected) {
    hiddenInput.value = selected;
    var container = document.getElementById('editResponsibilityMs');
    if (container) {
      var chipsContainer = container.querySelector('.ms-chips');
      var labels = {};
      options.forEach(function (o) { labels[o.value] = o.label; });
      var vals = selected.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      chipsContainer.innerHTML = vals.map(function (v) {
        return '<span class="ms-chip" data-value="' + escAttr(v) + '">' + escapeHtml(labels[v] || v) + '<button type="button" class="ms-chip-remove" aria-label="Remove" data-remove="' + escAttr(v) + '">&times;</button></span>';
      }).join('');
      var triggerBtn = container.querySelector('.ms-trigger');
      triggerBtn.textContent = vals.length ? vals.length + ' selected' : 'Select...';
      container.querySelectorAll('.ms-option').forEach(function (it) {
        it.classList.toggle('ms-selected', vals.indexOf(it.getAttribute('data-value')) !== -1);
      });
    }
  }
}

/* Generate review-due in-app notifications for the signed-in user, then load
   the notification center so the unread bell reflects any new entries. */
function generateReviewNotifications() {
  ApiService.generateReviewNotifications().then(function () {
    return loadNotifications(true);
  }).catch(function () {
    loadNotifications(true);
  });
}

function applyFilters(preservePage) {
  const query = appState.searchQuery.toLowerCase();
  const sector = appState.sector;
  const review = appState.dashReviewFilter;
  appState.filtered = appState.items.filter(function (item) {
    const haystack = [item.sector, item.id, item.description, item.action, item.responsibility, item.reviewDate]
      .join(' ').toLowerCase();
    const reviewOk = review === 'due'
      ? item.reviewStatus === 'due'
      : review === 'notdue'
        ? item.reviewStatus !== 'due'
        : true;
    return (!query || haystack.indexOf(query) !== -1) && (!sector || item.sector === sector) && reviewOk;
  });
  // Reset to page 1 only when the filter inputs changed (search/sector); a
  // plain re-render after an edit/update/delete keeps the current page.
  if (!preservePage) appState.page = 1;
  const pages = Math.max(1, Math.ceil(appState.filtered.length / PAGE_SIZE));
  if (appState.page > pages) appState.page = pages;
}

function handleSectorFilterChange() {
  appState.sector = getEl('sectorFilter').value;
  updateFilterChips();
  renderDashboard();
}

function handleDashSortSelectChange() {
  const value = getEl('dashSortSelect').value;
  appState.dashSortKey = value === 'default' ? 'id' : value;
  appState.dashSortDir = 'asc';
  renderDashboard();
  scheduleDashboardPrefsSave();
}

function handleDashReviewFilterChange() {
  appState.dashReviewFilter = getEl('dashReviewFilter').value;
  updateFilterChips();
  renderDashboard();
  scheduleDashboardPrefsSave();
}

function resetFilters() {
  appState.searchQuery = '';
  appState.sector = '';
  appState.dashReviewFilter = '';
  const search = getEl('searchInput');
  if (search) search.value = '';
  const filter = getEl('sectorFilter');
  if (filter) filter.value = '';
  const reviewFilter = getEl('dashReviewFilter');
  if (reviewFilter) reviewFilter.value = '';
  const sortSelect = getEl('dashSortSelect');
  if (sortSelect) sortSelect.value = 'default';
  appState.dashSortKey = 'id';
  appState.dashSortDir = 'asc';
  updateFilterChips();
  renderDashboard();
  scheduleDashboardPrefsSave();
}

function updateFilterChips() {
  const chips = getEl('filterChips');
  if (!chips) return;
  const parts = [];
  if (appState.searchQuery) {
    parts.push(`<span class="filter-chip">Search: ${escapeHtml(appState.searchQuery)} <button type="button" aria-label="Remove search filter" onclick="removeChip('search')">✕</button></span>`);
  }
  if (appState.sector) {
    parts.push(`<span class="filter-chip">Sector: ${escapeHtml(appState.sector)} <button type="button" aria-label="Remove sector filter" onclick="removeChip('sector')">✕</button></span>`);
  }
  if (appState.dashReviewFilter) {
    const reviewLabel = appState.dashReviewFilter === 'due' ? 'Review due' : 'Review not due';
    parts.push(`<span class="filter-chip">${escapeHtml(reviewLabel)} <button type="button" aria-label="Remove review filter" onclick="removeChip('review')">✕</button></span>`);
  }
  chips.innerHTML = parts.join('');
  const resetBtn = getEl('resetFiltersBtn');
  if (resetBtn) resetBtn.classList.toggle('hidden', parts.length === 0);
}

function removeChip(kind) {
  if (kind === 'search') appState.searchQuery = '';
  if (kind === 'sector') appState.sector = '';
  if (kind === 'review') appState.dashReviewFilter = '';
  const search = getEl('searchInput');
  if (search) search.value = appState.searchQuery;
  const filter = getEl('sectorFilter');
  if (filter) filter.value = appState.sector;
  const reviewFilter = getEl('dashReviewFilter');
  if (reviewFilter) reviewFilter.value = appState.dashReviewFilter;
  updateFilterChips();
  renderDashboard();
  if (kind === 'review') scheduleDashboardPrefsSave();
}

/* ---------------------------------- Dashboard: KPI cards ---------------------------------- */

function monthlyTrendArray() {
  const trend = (appState.analytics && appState.analytics.trend) || [];
  if (Array.isArray(trend)) {
    return trend.slice().sort(function (a, b) {
      return String(a && a.key).localeCompare(String(b && b.key));
    });
  }
  return Object.keys(trend).sort().map(function (key) {
    return { key: key, value: trend[key] };
  });
}

function trendPill() {
  const points = monthlyTrendArray();
  if (points.length < 2) return '';
  const last = points[points.length - 1].value;
  const prev = points[points.length - 2].value;
  const diff = last - prev;
  const cls = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'flat');
  const arrow = diff > 0 ? '↑' : (diff < 0 ? '↓' : '—');
  const label = diff !== 0 ? `${arrow} ${Math.abs(diff)} this month` : 'Flat this month';
  return `<span class="kpi-trend ${cls}">${label}</span>`;
}

function renderKpiCards() {
  const grid = getEl('summaryCards');
  if (!grid) return;
  const summary = appState.summary || {};
  const counts = appState.counts || {};
  const hasCounts = !!appState.counts;
  const sectorCount = Object.keys(summary.sectors || {}).length;
  const total = hasCounts && counts.totalRecords !== undefined ? counts.totalRecords : (summary.total || 0);
  // When a review-status filter is active, the Review due tile reflects the
  // filtered set instead of the global count, so the KPI stays consistent
  // with the cards/table on screen.
  const reviewFilter = appState.dashReviewFilter;
  const flaggedInView = appState.filtered.filter(function (i) { return i.reviewStatus === 'due'; }).length;
  const flagged = reviewFilter
    ? flaggedInView
    : (hasCounts && counts.flaggedRecords !== undefined ? counts.flaggedRecords : (summary.flagged || 0));
  const openTasks = counts.openTasks;
  const dueToday = counts.dueToday;
  const trend = trendPill();
  const dash = function (v) { return (v === undefined || v === null) ? '—' : v; };

  grid.innerHTML =
    `<div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-icon tone-secondary">${svgIcon('database')}</span>
        ${trend}
      </div>
      <div class="kpi-label">Total records</div>
      <div class="kpi-value">${total}</div>
      <div class="kpi-subtitle">Across ${sectorCount} sector${sectorCount === 1 ? '' : 's'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-icon tone-warning">${svgIcon('flag')}</span>
      </div>
      <div class="kpi-label">Review due</div>
      <div class="kpi-value">${flagged}</div>
      <div class="kpi-subtitle">${reviewFilter ? 'Within current filter' : 'Flagged for follow-up'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-icon tone-success">${svgIcon('layers')}</span>
      </div>
      <div class="kpi-label">Open sectors</div>
      <div class="kpi-value">${sectorCount}</div>
      <div class="kpi-subtitle">Active operations</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-icon tone-warning">${svgIcon('check')}</span>
      </div>
      <div class="kpi-label">Open tasks</div>
      <div class="kpi-value">${dash(openTasks)}</div>
      <div class="kpi-subtitle">Not yet completed</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-icon tone-secondary">${svgIcon('calendar')}</span>
      </div>
      <div class="kpi-label">Due today</div>
      <div class="kpi-value">${dash(dueToday)}</div>
      <div class="kpi-subtitle">Tasks due today</div>
    </div>`;
}

/* Fetches live task counts (open tasks, due today) and refreshes the homepage
   KPI cards without a full data reload — mirrors the GAS project. */
function refreshCounts() {
  if (typeof ApiService.getTaskCounts !== 'function') return;
  ApiService.getTaskCounts().then(function (counts) {
    appState.counts = counts || {};
    renderKpiCards();
  }).catch(function () {
    /* non-fatal: homepage falls back to summary-derived values */
  });
}

/* ---------------------------------- Dashboard: cards ---------------------------------- */

function dashboardColumnKey_(label) {
  const l = String(label || '').trim().toLowerCase();
  if (l === '#' || l === 'id' || l === 'sr no' || l === 'sr no.') return 'id';
  if (l === 'sector') return 'sector';
  if (l === 'description') return 'description';
  if (l.indexOf('entry') !== -1) return 'entryDate';
  if (l.indexOf('review') !== -1) return 'reviewDate';
  if (l === 'responsibility') return 'responsibility';
  if (l === 'action') return 'action';
  if (l.indexOf('actions') !== -1) return 'actions';
  return '';
}

function dashboardColumnVisible_(label) {
  const columns = (appState.dashboardPrefs && appState.dashboardPrefs.columns) || {};
  const key = dashboardColumnKey_(label);
  return key ? columns[key] !== false : true;
}

/* Renders one dashboard field as a card block. Groups are assembled in
   buildCardHtml so the card reads: Description | Entry Date | Sector on the
   top row, the Action field as its own full-width horizontal block below, and
   Responsibility | Review Date on the bottom row. */
function cardFieldHtml_(item, field) {
  const isHeaderRowValue = field && field.label && String(field.label).trim() !== '';
  const isActionField = dashboardColumnKey_(field && field.label) === 'action';
  const actionStateClass = isActionField
    ? (item.reviewStatus === 'due' ? ' card-field-action-due' : ' card-field-action-ok')
    : '';
  const valueHtml = field.html
    ? `<div class="field-value preserve-whitespace field-html">${field.html}</div>`
    : `<div class="field-value preserve-whitespace">${escapeHtml(field.value)}</div>`;
  return `
      <div class="card-field ${isHeaderRowValue ? 'card-field-highlight' : ''}${isActionField ? ' card-field-action' : ''}${actionStateClass}">
        <span class="field-label ${isHeaderRowValue ? 'field-label-highlight' : ''}${isActionField ? ' field-label-action' : ''}">${escapeHtml(field.label || 'Value')}</span>
        ${valueHtml}
      </div>`;
}

/* Group display fields for the 3-1-2 card layout: top row = Description,
   Entry Date, Sector; the Action field keeps its own horizontal block;
   bottom row = Responsibility, Review Date. The id field is excluded (the
   card title / modal heading already shows the record number). Any
   unrecognised field falls into the top row as a fallback. */
function groupCardFields_(fields) {
  const topFields = [];
  const actionFields = [];
  const bottomFields = [];
  (fields || []).forEach(function (field) {
    const key = dashboardColumnKey_(field && field.label);
    if (key === 'id') return;
    if (key === 'action') {
      actionFields.push(field);
    } else if (key === 'responsibility' || key === 'reviewDate') {
      bottomFields.push(field);
    } else {
      topFields.push(field);
    }
  });
  // Top row reads Description | Entry Date | Sector (user-specified order).
  const topOrder = { description: 0, entryDate: 1, sector: 2 };
  topFields.sort(function (a, b) {
    const ka = dashboardColumnKey_(a && a.label);
    const kb = dashboardColumnKey_(b && b.label);
    const oa = topOrder[ka] !== undefined ? topOrder[ka] : 9;
    const ob = topOrder[kb] !== undefined ? topOrder[kb] : 9;
    return oa - ob;
  });
  return { top: topFields, action: actionFields, bottom: bottomFields };
}

function buildCardHtml(item) {
  const visibleFields = (item.displayFields || []).filter(function (field) {
    const key = dashboardColumnKey_(field && field.label);
    if (key === 'id') return false;
    return dashboardColumnVisible_(field && field.label);
  });

  const groups = groupCardFields_(visibleFields);
  const topRowHtml = groups.top.length
    ? `<div class="card-fields-row card-fields-row-top">${groups.top.map(function (f) { return cardFieldHtml_(item, f); }).join('')}</div>`
    : '';
  const actionRowHtml = groups.action.length
    ? groups.action.map(function (f) { return cardFieldHtml_(item, f); }).join('')
    : '';
  const bottomRowHtml = groups.bottom.length
    ? `<div class="card-fields-row card-fields-row-bottom">${groups.bottom.map(function (f) { return cardFieldHtml_(item, f); }).join('')}</div>`
    : '';
  const fieldsHtml = topRowHtml + actionRowHtml + bottomRowHtml;

  const subCount = (appState.submissionCounts || {})[item.row] || 0;
  const subFlash = !!(appState.submissionFlash || {})[item.row];

  const updateFieldsHtml = (appState.displayedSubmissions || [])
    .filter(function (s) { return Number(s.cardRow) === Number(item.row); })
    .map(function (s) {
      return `
        <div class="card-field submission-display">
          <span class="field-label submission-display-label">Update by ${escapeHtml(s.email)} <span class="submission-display-time">${escapeHtml(formatTimestamp(s.createdAt))}</span></span>
          <div class="field-value preserve-whitespace">${escapeHtml(s.text || '')}</div>
        </div>`;
    }).join('');

  const reviewBadgeHtml = item.reviewStatus === 'due'
    ? `<span class="review-badge review-due">Review due${appState.isAdmin ? `
        <span class="review-dropdown">
          <button type="button" class="review-dropdown-toggle" aria-label="Review actions" onclick="event.stopPropagation(); toggleReviewDropdown(this);">&#9662;</button>
          <span class="review-dropdown-menu">
            <button type="button" class="review-dropdown-item" onclick="event.stopPropagation(); markReviewDone('${escAttr(item.row)}');">Mark as review done</button>
          </span>
        </span>` : ''}</span>`
    : item.reviewStatus === 'done'
      ? `<span class="review-badge review-done">Review done${appState.isAdmin ? `
        <span class="review-dropdown">
          <button type="button" class="review-dropdown-toggle" aria-label="Review actions" onclick="event.stopPropagation(); toggleReviewDropdown(this);">&#9662;</button>
          <span class="review-dropdown-menu">
            <button type="button" class="review-dropdown-item" onclick="event.stopPropagation(); markReviewNotDone('${escAttr(item.row)}');">Mark as not done</button>
          </span>
        </span>` : ''}</span>`
      : '';

  const actionsHtml = `
    <div class="submit-update-wrap">
      <button class="btn btn-secondary btn-small" onclick="openSubmissionsModal('${escAttr(item.row)}','${escAttr(item.id)}')">Submit update</button>
      ${subCount > 0 ? `<span class="submission-badge${subFlash ? ' flash' : ''}">${subCount}</span>` : ''}
    </div>
    <div class="menu-dropdown">
      <button class="btn btn-secondary btn-small" type="button" onclick="event.stopPropagation(); toggleDropdown(this);">Print</button>
      <span class="menu-dropdown-menu">
        <button class="menu-dropdown-item" type="button" onclick="event.stopPropagation(); closeDropdowns(); printCard('${escAttr(item.row)}', true);">With submissions</button>
        <button class="menu-dropdown-item" type="button" onclick="event.stopPropagation(); closeDropdowns(); printCard('${escAttr(item.row)}', false);">Without submissions</button>
      </span>
    </div>
    ${appState.isEditor ? `<button class="btn btn-secondary btn-small" onclick="toggleCardAi('${escAttr(item.row)}', this)">AI insight</button>` : ''}
    ${appState.isEditor && itemHasLink_(item) ? `<button class="btn btn-secondary btn-small" onclick="toggleCardLink('${escAttr(item.row)}', this)">Analyze link</button>` : ''}
    ${appState.isEditor ? `<button class="btn btn-secondary btn-small" onclick="editItem('${escAttr(item.row)}')">Edit</button>` : ''}
    ${appState.isEditor ? `<button class="btn btn-danger btn-small" onclick="deleteItem('${escAttr(item.row)}')">Delete</button>` : ''}`;

  const showId = dashboardColumnVisible_('id');
  const showActions = dashboardColumnVisible_('actions');
  return `
    <article class="card ${item.reviewStatus === 'due' ? 'review-due' : ''}" data-row="${escAttr(item.row)}">
      ${reviewBadgeHtml}
      ${showId ? '<div class="card-title preserve-whitespace"><span class="id-badge">#' + escapeHtml(item.id) + '</span></div>' : ''}
      <div class="card-fields">${fieldsHtml || '<div class="card-field"><span class="field-label">Details</span><div class="field-value preserve-whitespace">No details available</div></div>'}${updateFieldsHtml}</div>
      ${showActions ? '<div class="card-footer"><div class="actions">' + actionsHtml + '</div></div>' : ''}
      ${aiPanelHtmlFromCache_(item.row)}
      ${linkPanelHtmlFromCache_(item.row)}
    </article>`;
}

function emptyStateHtml() {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${svgIcon('search')}</div>
      <div class="empty-state-title">No records found</div>
      <div class="empty-state-subtitle">Try adjusting your search or clearing the active filters.</div>
    </div>`;
}

/* Incremental card renderer. Renders the first N cards, then appends the
   next batch only when a sentinel div scrolls into view. No libraries:
   IntersectionObserver is native in every modern browser. */
var dashScroll = { sentinel: null, io: null, rendered: 0, BATCH: 15 };

function renderDashboardCards() {
  const grid = getEl('dashboardCards');
  if (!grid) return;
  const start = (appState.page - 1) * PAGE_SIZE;
  const pageItems = sortedItems().slice(start, start + PAGE_SIZE);

  if (!pageItems.length) { grid.innerHTML = emptyStateHtml(); teardownDashScroller_(); return; }

  // Batch 1 synchronously (keeps above-the-fold instant). BATCH can exceed
  // the page size, so cap the rendered count at the actual number inserted.
  grid.innerHTML = pageItems.slice(0, dashScroll.BATCH).map(buildCardHtml).join('');
  dashScroll.rendered = Math.min(dashScroll.BATCH, pageItems.length);
  ensureDashSentinel_(grid, pageItems);
}

function ensureDashSentinel_(grid, pageItems) {
  // teardown resets dashScroll.rendered to 0, so snapshot it first: without
  // this the "all rendered" check below is always false and scrolling
  // re-appends the whole page (double-rendered cards).
  const alreadyRendered = dashScroll.rendered;
  teardownDashScroller_();
  dashScroll.rendered = alreadyRendered;
  if (dashScroll.rendered >= pageItems.length) return; // all rendered

  dashScroll.sentinel = document.createElement('div');
  dashScroll.sentinel.className = 'cards-sentinel';
  grid.appendChild(dashScroll.sentinel);

  dashScroll.io = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) return;
    const next = pageItems.slice(dashScroll.rendered, dashScroll.rendered + dashScroll.BATCH);
    if (!next.length) { teardownDashScroller_(); return; }

    const frag = document.createDocumentFragment();
    next.forEach(function (item) { frag.appendChild(htmlToNode_(buildCardHtml(item))); });
    if (dashScroll.sentinel && dashScroll.sentinel.parentNode) {
      dashScroll.sentinel.parentNode.insertBefore(frag, dashScroll.sentinel);
    }
    dashScroll.rendered += next.length;
    if (dashScroll.rendered >= pageItems.length) teardownDashScroller_();
  }, { rootMargin: '300px 0px' }); // lookahead so there is no visible blank gap

  dashScroll.io.observe(dashScroll.sentinel);
}

function teardownDashScroller_() {
  if (dashScroll.io) { dashScroll.io.disconnect(); dashScroll.io = null; }
  if (dashScroll.sentinel && dashScroll.sentinel.parentNode) {
    dashScroll.sentinel.parentNode.removeChild(dashScroll.sentinel);
  }
  dashScroll.sentinel = null;
  dashScroll.rendered = 0;
}

function htmlToNode_(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstChild;
}

/* ---------------------------------- Dashboard: table view ---------------------------------- */
/* Enterprise-style sortable table, additive alongside the card view. Rows use
   the same filters + pagination as the cards; clicking a row opens the record
   detail dialog (S8). */

function toggleDashboardView(view) {
  appState.dashboardView = view === 'table' ? 'table' : 'cards';
  renderDashboard();
}

function dashCompare(a, b) {
  const av = a == null ? '' : a;
  const bv = b == null ? '' : b;
  const an = Number(av);
  const bn = Number(bv);
  const aIsNum = av !== '' && isFinite(an);
  const bIsNum = bv !== '' && isFinite(bn);
  if (aIsNum && bIsNum) return an - bn;
  return String(av).toLowerCase() < String(bv).toLowerCase() ? -1
    : (String(av).toLowerCase() > String(bv).toLowerCase() ? 1 : 0);
}

function sortedItems() {
  const key = appState.dashSortKey;
  const dir = appState.dashSortDir === 'desc' ? -1 : 1;
  return appState.filtered.slice().sort(function (a, b) {
    return dashCompare(a[key], b[key]) * dir;
  });
}

function buildTableRowHtml(item) {
  const subCount = (appState.submissionCounts || {})[item.row] || 0;
  const statusBadge = item.reviewStatus === 'due'
    ? '<span class="review-badge review-due">Review due</span>'
    : item.reviewStatus === 'done'
      ? '<span class="review-badge review-done">Review done</span>'
      : '';
  const actions = `
    <div class="row-actions">
      <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); openSubmissionsModal('${escAttr(item.row)}','${escAttr(item.id)}')">Update${subCount ? ' (' + subCount + ')' : ''}</button>
      ${appState.isEditor ? `<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); toggleRowAi('${escAttr(item.row)}', this)">AI insight</button>` : ''}
      ${appState.isEditor && itemHasLink_(item) ? `<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); toggleRowLink('${escAttr(item.row)}', this)">Analyze link</button>` : ''}
      ${appState.isEditor ? `<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); editItem('${escAttr(item.row)}')">Edit</button>` : ''}
      ${appState.isEditor ? `<button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteItem('${escAttr(item.row)}')">Delete</button>` : ''}
    </div>`;
  let persistedPanels = '';
  const aiPanel = aiPanelHtmlFromCache_(item.row);
  if (aiPanel) persistedPanels += '<tr class="ai-insight-tr"><td colspan="8">' + aiPanel + '</td></tr>';
  const linkPanel = linkPanelHtmlFromCache_(item.row);
  if (linkPanel) persistedPanels += '<tr class="ai-link-tr"><td colspan="8">' + linkPanel + '</td></tr>';
  return `
    <tr class="row-clickable ${item.reviewStatus === 'due' ? 'row-flagged' : ''}" data-row="${escAttr(item.row)}" tabindex="0">
      <td><span class="id-badge">#${escapeHtml(item.id)}</span></td>
      <td class="preserve-whitespace">${escapeHtml(item.sector || '')}</td>
      <td class="details-cell preserve-whitespace">${escapeHtml(item.description || '')}</td>
      <td class="action-cell ${item.reviewStatus === 'due' ? 'action-cell-due' : 'action-cell-ok'} preserve-whitespace">${item.actionHtml || renderLinkableText(item.action || '')}</td>
      <td class="preserve-whitespace">${escapeHtml(item.entryDate || '')}</td>
      <td class="preserve-whitespace">${escapeHtml(item.reviewDate || '')}</td>
      <td>${statusBadge}</td>
      <td>${actions}</td>
    </tr>` + persistedPanels;
}

/* Visible result count above the cards so filter changes are obvious even
   when page 1 stays full (PAGE_SIZE caps the rendered cards). */
function renderDashboardCount() {
  const el = getEl('dashboardCardsSummary');
  if (!el) return;
  const total = appState.items.length;
  const shown = appState.filtered.length;
  const filtering = !!(appState.searchQuery || appState.sector || appState.dashReviewFilter);
  const plural = function (n) { return n === 1 ? 'record' : 'records'; };
  el.textContent = filtering
    ? 'Showing ' + shown + ' of ' + total + ' ' + plural(total)
    : shown + ' ' + plural(shown) + ' found';
}

function renderDashboardTable() {
  const wrap = getEl('dashboardTableWrap');
  const table = getEl('dashboardTable');
  if (!wrap || !table) return;
  const start = (appState.page - 1) * PAGE_SIZE;
  const pageItems = sortedItems().slice(start, start + PAGE_SIZE);

  table.querySelectorAll('thead th[data-dash-sort]').forEach(function (th) {
    const sortKey = th.getAttribute('data-dash-sort');
    if (sortKey === appState.dashSortKey) {
      th.setAttribute('aria-sort', appState.dashSortDir === 'asc' ? 'ascending' : 'descending');
    } else {
      th.removeAttribute('aria-sort');
    }
  });

  table.querySelector('tbody').innerHTML = pageItems.length
    ? pageItems.map(buildTableRowHtml).join('')
    : '<tr><td colspan="8">No records found.</td></tr>';

  const summaryEl = getEl('dashboardTableSummary');
  if (summaryEl) summaryEl.textContent = appState.filtered.length + ' record' + (appState.filtered.length === 1 ? '' : 's') + ' found';

  applyColumnVisibility();
}

function applyColumnVisibility() {
  const prefs = appState.dashboardPrefs || {};
  const columns = prefs.columns || {};
  const table = getEl('dashboardTable');
  if (!table) return;
  table.querySelectorAll('th[data-col]').forEach(function (th) {
    const col = th.getAttribute('data-col');
    const show = columns[col] !== false;
    th.style.display = show ? '' : 'none';
  });
  table.querySelectorAll('tbody tr').forEach(function (tr) {
    const cells = tr.querySelectorAll('td');
    const headers = table.querySelectorAll('th[data-col]');
    headers.forEach(function (th, idx) {
      if (cells[idx]) cells[idx].style.display = th.style.display;
    });
  });
}

function setDashSort(key) {
  if (key === appState.dashSortKey) {
    appState.dashSortDir = appState.dashSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    appState.dashSortKey = key;
    appState.dashSortDir = 'asc';
  }
  const sortSelect = getEl('dashSortSelect');
  if (sortSelect) {
    const optionValue = appState.dashSortKey === 'id' ? 'default' : appState.dashSortKey;
    if (sortSelect.querySelector('option[value="' + optionValue + '"]')) {
      sortSelect.value = optionValue;
    }
  }
  renderDashboard();
  scheduleDashboardPrefsSave();
}

function renderPagination() {
  const bar = getEl('paginationBar');
  if (!bar) return;
  const total = appState.filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (appState.page > pages) appState.page = pages;
  if (total <= PAGE_SIZE) {
    bar.innerHTML = '';
    return;
  }
  let html = `<button class="page-btn" type="button" onclick="setPage(${appState.page - 1})" ${appState.page <= 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>`;
  const start = Math.max(1, appState.page - 2);
  const end = Math.min(pages, start + 4);
  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn ${p === appState.page ? 'active' : ''}" type="button" onclick="setPage(${p})" ${p === appState.page ? 'aria-current="page"' : ''}>${p}</button>`;
  }
  html += `<button class="page-btn" type="button" onclick="setPage(${appState.page + 1})" ${appState.page >= pages ? 'disabled' : ''} aria-label="Next page">›</button>`;
  html += `<span class="page-info">${total} record${total === 1 ? '' : 's'}</span>`;
  bar.innerHTML = html;
}

function setPage(page) {
  const pages = Math.max(1, Math.ceil(appState.filtered.length / PAGE_SIZE));
  appState.page = Math.min(Math.max(1, page), pages);
  renderDashboardCards();
  renderDashboardTable();
  renderPagination();
  const target = appState.dashboardView === 'table' ? getEl('dashboardTableWrap') : getEl('dashboardCards');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDashboard(preservePage) {
  teardownDashScroller_();
  applyFilters(preservePage);
  renderKpiCards();
  updateFilterChips();
  renderDashboardCount();
  const grid = getEl('dashboardCards');
  const tableWrap = getEl('dashboardTableWrap');
  const viewCardsBtn = getEl('viewCardsBtn');
  const viewTableBtn = getEl('viewTableBtn');
  const isTable = appState.dashboardView === 'table';
  if (grid) grid.classList.toggle('hidden', isTable);
  if (tableWrap) tableWrap.classList.toggle('hidden', !isTable);
  if (viewCardsBtn) viewCardsBtn.classList.toggle('active', !isTable);
  if (viewTableBtn) viewTableBtn.classList.toggle('active', isTable);
  if (isTable) {
    renderDashboardTable();
  } else {
    renderDashboardCards();
  }
  renderPagination();
}

function refreshData() {
  showOverlay('Refreshing data…');
  ApiService.getAppData().then(function (data) {
    hideOverlay();
    applyAppData(data);
    populateFilters();
    populateResponsibilitySelect();
  renderDashboard(true);
    refreshCounts();
    generateReviewNotifications();
    auditLoaded = false;
    const auditPanel = getEl('audit');
    if (auditPanel && !auditPanel.classList.contains('hidden')) {
      renderAuditPanel();
    }
    EventBus.emit('DataRefreshed');
    showToast('Dashboard refreshed', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Refresh failed: ' + (err.message || err), 'error');
  });
}

/* ---------------------------------- Analytics ---------------------------------- */

function renderAnalytics() {
  const summary = appState.summary || {};
  const analytics = appState.analytics || {};
  const trendPrev = (analytics.trendPrev && analytics.trendPrev.length) ? analytics.trendPrev[analytics.trendPrev.length - 1].value : 0;
  const trendCurr = (analytics.trend && analytics.trend.length) ? analytics.trend[analytics.trend.length - 1].value : 0;
  const trendDir = trendCurr > trendPrev ? 'up' : trendCurr < trendPrev ? 'down' : 'flat';
  const trendLabel = trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '→';
  const trendClass = trendDir === 'up' ? 'trend-up' : trendDir === 'down' ? 'trend-down' : 'trend-flat';

  const cards = [
    { title: 'Total records', value: summary.total || 0, trend: '' },
    { title: 'Review due', value: summary.flagged || 0, trend: '' },
    { title: 'Normal items', value: summary.normal || 0, trend: '' },
    { title: 'This month', value: trendCurr, trend: trendLabel, trendClass: trendClass }
  ].map(function (item) {
    return `<div class="analytics-card"><h3>${item.title}</h3><p>${item.value}${item.trend ? ' <span class="' + item.trendClass + '">' + item.trend + '</span>' : ''}</p></div>`;
  }).join('');
  getEl('analyticsCards').innerHTML = cards;

  const sectors = (analytics.sectors) || [];
  const offices = (analytics.offices) || [];
  const flagged = (analytics.flaggedItems) || [];
  const trend = (analytics.trend) || [];

  let reportHtml = `
    <div class="card">
      <h3>Records by sector</h3>
      <ul>${sectors.length ? sectors.map(function (s) {
        return `<li>${escapeHtml(s.sector)}: ${s.total}</li>`;
      }).join('') : '<li>No sector data</li>'}</ul>
    </div>`;

  if (offices.length) {
    reportHtml += `
    <div class="card">
      <h3>Records by office</h3>
      <ul>${offices.map(function (o) {
        return `<li>${escapeHtml(o.office)}: ${o.total}</li>`;
      }).join('')}</ul>
    </div>`;
  }

  if (trend.length) {
    reportHtml += `
    <div class="card">
      <h3>New records by month</h3>
      <ul>${trend.slice(-12).map(function (t) {
        return `<li>${escapeHtml(t.key)}: ${t.value}</li>`;
      }).join('')}</ul>
    </div>`;
  }

  reportHtml += `
    <div class="card">
      <h3>Flagged items (review due)</h3>
      <ul>${flagged.length ? flagged.slice(0, 50).map(function (item) {
        return `<li>#${escapeHtml(item.id)} — ${escapeHtml(item.sector)}${item.reviewDate ? ' · due ' + escapeHtml(item.reviewDate) : ''}</li>`;
      }).join('') : '<li>No flagged items</li>'}</ul>
    </div>`;

  getEl('analyticsReport').innerHTML = reportHtml;
}


/* ---------------------------------- Per-record AI insight (cards + table rows) ---------------------------------- */
/* "AI insight" toggles an inline collapsible panel under a card / table row
   (editors and admins). If the record has a linked file, an "Analyze linked
   file" button fetches the link content and runs AI analysis over it. */

/* Inline style carrying a persisted drag-resized panel size, or '' when the
   panel was never resized. Keeps a resized analyze/AI panel's dimensions
   across background refreshes and re-renders. */
function panelSizeStyle_(cached) {
  if (!cached || !cached.w || !cached.h) return '';
  return ' style="width:' + cached.w + 'px;max-width:none;height:' + cached.h + 'px;max-height:none;"';
}

function applyPanelSize_(panel, row, isLink) {
  if (!panel) return;
  const cached = isLink ? cachedLinkPanel_(row) : cachedAiPanel_(row);
  if (!cached || !cached.w || !cached.h) return;
  panel.style.width = cached.w + 'px';
  panel.style.maxWidth = 'none';
  panel.style.height = cached.h + 'px';
  panel.style.maxHeight = 'none';
  // Restore the inner analyze-table window height so the table keeps its
  // expanded/contracted size after a re-render.
  if (cached.wrapH) {
    const wrap = panel.querySelector('.card-ai-table-wrap');
    if (wrap) {
      wrap.style.maxHeight = 'none';
      wrap.style.height = cached.wrapH + 'px';
    }
  }
}

function cardAiPanelHtml_() {
  return '<div class="card-ai-head">' +
    '<span class="card-ai-title">AI insight</span>' +
    '<button class="btn btn-small btn-ghost" type="button" onclick="collapseCardAi(this)">Collapse</button>' +
    '</div>' +
    '<div class="card-ai-body"></div>' +
    '<div class="panel-resize-grip" title="Drag to resize"></div>';
}

function toggleCardAi(row, btn) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const article = btn.closest('.card');
  if (!article) return;
  let panel = article.querySelector('.card-ai-insight');
  if (panel) {
    panel.classList.toggle('card-ai-collapsed');
    const cached = cachedAiPanel_(row);
    if (cached) cached.collapsed = panel.classList.contains('card-ai-collapsed');
    return;
  }
  panel = document.createElement('div');
  panel.className = 'card-ai-panel card-ai-insight';
  panel.innerHTML = cardAiPanelHtml_();
  article.appendChild(panel);
  loadCardAi(panel, row);
}

function collapseCardAi(btn) {
  const panel = btn.closest('.card-ai-panel');
  if (!panel) return;
  panel.classList.add('card-ai-collapsed');
  const rowEl = panel.closest('[data-row]');
  if (!rowEl) return;
  const row = String(rowEl.getAttribute('data-row'));
  const isLink = panel.classList.contains('card-link-panel');
  if (isLink) {
    const cached = cachedLinkPanel_(row);
    if (cached) cached.collapsed = true;
    else persistLinkPanel_(row, null, true);
  } else {
    const cached = cachedAiPanel_(row);
    if (cached) cached.collapsed = true;
    else persistAiPanel_(row, null, true);
  }
}

function toggleRowAi(row, btn) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const tr = btn.closest('tr');
  if (!tr) return;
  const next = tr.nextElementSibling;
  if (next && next.classList && next.classList.contains('ai-insight-tr')) {
    next.remove();
    delete appState.aiAnalysis[String(row)];
    return;
  }
  const panelTr = document.createElement('tr');
  panelTr.className = 'ai-insight-tr';
  const td = document.createElement('td');
  td.setAttribute('colspan', '7');
  td.className = 'card-ai-panel card-ai-insight';
  td.innerHTML = cardAiPanelHtml_();
  panelTr.appendChild(td);
  tr.parentNode.insertBefore(panelTr, tr.nextSibling);
  loadCardAi(td, row);
}

function aiBulletsHtml_(text, tag) {
  const t = tag === 'li' ? 'li' : 'div';
  const lines = String(text || '').split(/\r?\n/).map(function (line) {
    return line.replace(/^[-*\u2022\u25CF\s]+/, '').trim();
  }).filter(function (line) { return line; });
  const items = lines.length ? lines : [String(text || '')];
  return items.map(function (line) {
    return '<' + t + ' style="display:flex;gap:8px;align-items:flex-start;font-size:14px;line-height:1.5;">' +
      '<span style="color:var(--accent,#2563eb);font-weight:700;">&rsaquo;</span>' +
      '<span>' + escapeHtml(line) + '</span></' + t + '>';
  }).join('');
}

function cachedAiPanel_(row) {
  return appState.aiAnalysis[String(row)] || null;
}

function persistAiPanel_(row, data, collapsed) {
  const prev = appState.aiAnalysis[String(row)] || {};
  appState.aiAnalysis[String(row)] = { data: data || null, collapsed: !!collapsed, w: prev.w, h: prev.h };
}

function aiPanelHtmlFromCache_(row) {
  const cached = cachedAiPanel_(row);
  if (!cached || !cached.data) return '';
  return '<div class="card-ai-panel card-ai-insight' + (cached.collapsed ? ' card-ai-collapsed' : '') + '"' +
    panelSizeStyle_(cached) + '>' +
    '<div class="card-ai-head">' +
    '<span class="card-ai-title">AI insight</span>' +
    '<button class="btn btn-small btn-ghost" type="button" onclick="collapseCardAi(this)">Collapse</button>' +
    '</div>' +
    '<div class="card-ai-body">' + aiBulletsHtml_(cached.data.insights || '', 'div') + '</div>' +
    '<div class="panel-resize-grip" title="Drag to resize"></div>' +
    '</div>';
}

function loadCardAi(panel, row) {
  const body = panel.querySelector('.card-ai-body');
  if (!body) return;
  applyPanelSize_(panel, row, false);
  const cached = cachedAiPanel_(row);
  if (cached && cached.data) {
    body.innerHTML = aiBulletsHtml_(cached.data.insights || '', 'div');
    if (cached.collapsed) panel.classList.add('card-ai-collapsed');
    return;
  }
  body.innerHTML = '<div class="card-ai-loading">Generating insight…</div>';
  ApiService.getCardAiInsight(row).then(function (data) {
    if (!data || data.success !== true) {
      const msg = (data && data.message) || 'Could not generate AI insight.';
      body.innerHTML = '<div class="card-ai-error">' + escapeHtml(msg) + '</div>';
      return;
    }
    persistAiPanel_(row, data, false);
    body.innerHTML = aiBulletsHtml_(data.insights || '', 'div');
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    const msg = err && err.message ? err.message : String(err || 'Unknown error');
    body.innerHTML = '<div class="card-ai-error">' + escapeHtml(msg) + '</div>';
  });
}

function cardLinkPanelHtml_() {
  return '<div class="card-ai-head">' +
    '<span class="card-ai-title">Linked file analysis</span>' +
    '<button class="btn btn-small btn-ghost" type="button" onclick="collapseCardAi(this)">Collapse</button>' +
    '</div>' +
    '<div class="card-ai-body"></div>' +
    '<div class="panel-resize-grip" title="Drag to resize"></div>';
}

function cachedLinkPanel_(row) {
  return appState.linkAnalysis[String(row)] || null;
}

function persistLinkPanel_(row, data, collapsed) {
  const prev = appState.linkAnalysis[String(row)] || {};
  appState.linkAnalysis[String(row)] = { data: data || null, collapsed: !!collapsed, w: prev.w, h: prev.h, wrapH: prev.wrapH };
}

/* Full persisted link panel HTML (head + body filled from the cached result),
   or '' when nothing is cached for that row. Embedded by the card / row
   builders so open analyses survive background refreshes and re-renders. */
function linkPanelHtmlFromCache_(row) {
  const cached = cachedLinkPanel_(row);
  if (!cached || !cached.data) return '';
  return '<div class="card-ai-panel card-link-panel' + (cached.collapsed ? ' card-ai-collapsed' : '') + '"' +
    panelSizeStyle_(cached) + '>' +
    '<div class="card-ai-head">' +
    '<span class="card-ai-title">Linked file analysis</span>' +
    '<button class="btn btn-small btn-ghost" type="button" onclick="collapseCardAi(this)">Collapse</button>' +
    '</div>' +
    '<div class="card-ai-body">' + linkAiResultHtml_(cached.data, cached.wrapH) + '</div>' +
    '<div class="panel-resize-grip" title="Drag to resize"></div>' +
    '</div>';
}

function toggleCardLink(row, btn) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const article = btn.closest('.card');
  if (!article) return;
  let panel = article.querySelector('.card-link-panel');
  if (panel) {
    panel.classList.toggle('card-ai-collapsed');
    const cached = cachedLinkPanel_(row);
    if (cached) cached.collapsed = panel.classList.contains('card-ai-collapsed');
    return;
  }
  panel = document.createElement('div');
  panel.className = 'card-ai-panel card-link-panel';
  panel.innerHTML = cardLinkPanelHtml_();
  article.appendChild(panel);
  loadCardLink(panel, row);
}

function toggleRowLink(row, btn) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const tr = btn.closest('tr');
  if (!tr) return;
  const next = tr.nextElementSibling;
  if (next && next.classList && next.classList.contains('ai-link-tr')) {
    // Explicit close by the user — drop the persisted panel so it stays closed.
    next.remove();
    delete appState.linkAnalysis[String(row)];
    return;
  }
  const panelTr = document.createElement('tr');
  panelTr.className = 'ai-link-tr';
  const td = document.createElement('td');
  td.setAttribute('colspan', '7');
  td.className = 'card-ai-panel card-link-panel';
  td.innerHTML = cardLinkPanelHtml_();
  panelTr.appendChild(td);
  tr.parentNode.insertBefore(panelTr, tr.nextSibling);
  loadCardLink(td, row);
}

function itemHasLink_(item) {
  const links = (item && item.linkUrls) || {};
  return Object.keys(links).some(function (k) { return !!links[k]; });
}

/* Draggable column resize for tables (records, audit, users, tasks, activity
   and the link-analysis preview). A handle is appended to each header cell;
   dragging sets an explicit pixel width on the whole column (header + every
   body cell) with no minimum or maximum — text wraps to fit the new width.
   The first drag snapshots the content-sized widths and switches the table
   to fixed layout so the widths stick across re-renders. */
function makeTableResizable_(table) {
  if (!table || table.getAttribute('data-resizable')) return;
  table.setAttribute('data-resizable', '1');
  const ths = Array.prototype.slice.call(table.querySelectorAll('thead th'));
  if (!ths.length) return;

  ths.forEach(function (th, idx) {
    if (th.querySelector('.col-resizer')) return;
    const grip = document.createElement('div');
    grip.className = 'col-resizer';
    grip.title = 'Drag to resize column';
    th.appendChild(grip);
    // Dragging must not trigger the column's sort on mouseup.
    grip.addEventListener('click', function (e) { e.stopPropagation(); });

    let startX = 0;
    let startW = 0;
    grip.addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startW = th.getBoundingClientRect().width;
      // First drag: freeze current content-sized widths, then use fixed layout.
      if (table.style.tableLayout !== 'fixed') {
        ths.forEach(function (t, i) {
          const w = t.getBoundingClientRect().width;
          t.style.width = w + 'px';
          const rows = table.querySelectorAll('tbody tr');
          for (let r = 0; r < rows.length; r++) {
            const cell = rows[r].children[i];
            if (cell) cell.style.width = w + 'px';
          }
        });
        table.style.tableLayout = 'fixed';
      }
      grip.classList.add('active');
      document.body.classList.add('col-resizing');

      function onMove(ev) {
        const w = startW + (ev.clientX - startX); // no min/max — follow the pointer
        th.style.width = w + 'px';
        const rows = table.querySelectorAll('tbody tr');
        for (let r = 0; r < rows.length; r++) {
          const cell = rows[r].children[idx];
          if (cell) cell.style.width = w + 'px';
        }
      }
      function onUp() {
        grip.classList.remove('active');
        document.body.classList.remove('col-resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

function loadCardLink(panel, row) {
  const body = panel.querySelector('.card-ai-body');
  if (!body) return;
  applyPanelSize_(panel, row, true);
  // Already analyzed and persisted? Render instantly from the cache so the
  // result survives background refreshes without re-hitting the API.
  const cached = cachedLinkPanel_(row);
  if (cached && cached.data) {
    body.innerHTML = linkAiResultHtml_(cached.data, cached.wrapH);
    makeTableResizable_(body.querySelector('.card-ai-table'));
    if (cached.collapsed) panel.classList.add('card-ai-collapsed');
    return;
  }
  body.innerHTML = '<div class="card-ai-loading">Analyzing linked file…</div>';
  ApiService.getLinkContentAiInsight(row).then(function (data) {
    if (!data || data.success !== true) {
      const msg = (data && data.message) || 'Could not analyze the linked file.';
      body.innerHTML = '<div class="card-ai-error">' + escapeHtml(msg) + '</div>';
      return;
    }
    persistLinkPanel_(row, data, false);
    body.innerHTML = linkAiResultHtml_(data);
    makeTableResizable_(body.querySelector('.card-ai-table'));
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    const msg = err && err.message ? err.message : String(err || 'Unknown error');
    body.innerHTML = '<div class="card-ai-error">' + escapeHtml(msg) + '</div>';
  });
}

function linkAiResultHtml_(data, wrapH) {
  const head = '<div class="card-ai-link-label">' + escapeHtml(data.source || '') +
    (data.contentRead && data.contentLength ? ' <span class="card-ai-size">' +
      Number(data.contentLength).toLocaleString() + ' chars' +
      (data.contentTruncated ? ' · truncated' : '') + '</span>' : '') +
    (data.contentRead ? '' : ' <em>(content not readable — analyzed from record only)</em>') + '</div>';
  let html = head + aiBulletsHtml_(data.insights || '', 'div');
  if (data.previewFormat === 'table' && data.previewRows && data.previewRows.length) {
    let rows = data.previewRows.slice();
    let title = '';
    if (rows.length > 1) {
      const n0 = rows[0].filter(function (c) { return String(c).trim() !== ''; }).length;
      const n1 = rows[1].filter(function (c) { return String(c).trim() !== ''; }).length;
      if (n0 === 1 && n1 > n0) {
        title = rows[0].filter(function (c) { return String(c).trim() !== ''; })[0];
        rows = rows.slice(1);
      }
    }
    const thead = '<thead><tr>' + (rows[0] || []).map(function (c) {
      return '<th>' + escapeHtml(c) + '</th>';
    }).join('') + '</tr></thead>';
    const tbody = '<tbody>' + rows.slice(1).map(function (r) {
      return '<tr>' + r.map(function (c) { return '<td>' + escapeHtml(c) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody>';
    const note = (data.previewRowTotal && data.previewRowTotal > data.previewRows.length)
      ? '<div class="card-ai-table-note">Showing first ' + data.previewRows.length + ' of ' +
        Number(data.previewRowTotal).toLocaleString() + ' rows</div>'
      : '';
    const wrapStyle = wrapH ? ' style="max-height:none;height:' + wrapH + 'px;"' : '';
    html += '<details class="card-ai-preview" open><summary>Linked file preview</summary>' +
      (title ? '<div class="card-ai-table-title">' + escapeHtml(title) + '</div>' : '') +
      linkAskHtml_(data.row) +
      '<div class="card-ai-table-wrap"' + wrapStyle + '><table class="card-ai-table">' + thead + tbody + '</table></div>' +
      note + '</details>';
  } else if (data.preview) {
    html += '<details class="card-ai-preview"><summary>Linked file preview</summary>' +
      '<div class="card-ai-preview-text">' + escapeHtml(data.preview) + '</div></details>';
  }
  return html;
}

/* Ask-AI bar shown above the linked-file table: type a question, hit Enter
   or Ask, and the configured AI provider (Groq by default) answers in the
   result box below the bar — still above the table. Each row keeps a Q&A
   history in appState.linkAskQa (row -> [{question, answer}, ...], newest
   last) so answers survive background refreshes; the ✕ button clears a
   row's history (client-side only). */
function linkAskHtml_(row) {
  return '<div class="card-ai-ask">' +
    '<div class="card-ai-ask-bar">' +
    '<input class="card-ai-ask-input" type="text" placeholder="Ask AI…" ' +
    'data-row="' + escAttr(row) + '" ' +
    'onkeydown="if(event.key===\'Enter\'){askLinkAi(this);}">' +
    '<button class="btn btn-small btn-primary card-ai-ask-btn" type="button" onclick="askLinkAi(this)">Ask</button>' +
    '</div>' + linkAskResultHtml_(row) + '</div>';
}

/* Renders just the result box for a row: latest Q&A on top with a ✕ clear
   button, older Q&As collapsed under a "Previous questions" toggle. */
function linkAskResultHtml_(row) {
  const hist = (appState.linkAskQa && appState.linkAskQa[String(row)]) || [];
  if (!hist.length) return '<div class="card-ai-ask-result" hidden></div>';
  const latest = hist[hist.length - 1];
  let html = '<div class="card-ai-ask-result">' +
    '<div class="card-ai-ask-result-head">' +
    '<div class="card-ai-ask-q">' + escapeHtml(latest.question) + '</div>' +
    '<button class="card-ai-ask-clear" type="button" title="Clear answer history" ' +
    'data-row="' + escAttr(row) + '" onclick="clearLinkAsk(this)">✕</button>' +
    '</div>' +
    '<div class="card-ai-ask-a">' + escapeHtml(latest.answer) + '</div>';
  if (hist.length > 1) {
    html += '<details class="card-ai-ask-history"><summary>Previous questions (' + (hist.length - 1) + ')</summary>';
    for (let i = hist.length - 2; i >= 0; i--) {
      html += '<div class="card-ai-ask-history-item"><div class="card-ai-ask-q">' + escapeHtml(hist[i].question) + '</div>' +
        '<div class="card-ai-ask-a">' + escapeHtml(hist[i].answer) + '</div></div>';
    }
    html += '</details>';
  }
  return html + '</div>';
}

/* Dismisses a row's Ask-AI answer history. Clears the local cache and the
   server copy so the history is gone after a reload too. */
function clearLinkAsk(elm) {
  const ask = elm.closest('.card-ai-ask');
  if (!ask) return;
  const row = elm.getAttribute('data-row');
  if (!row) return;
  delete appState.linkAskQa[String(row)];
  const result = ask.querySelector('.card-ai-ask-result');
  if (result) result.outerHTML = linkAskResultHtml_(row);
  persistAskLinkHistory(row, []);
}

/* Persists one record's Ask-AI Q&A history to the server (fire-and-forget;
   failures are non-fatal — the local cache still works for the session). */
function persistAskLinkHistory(row, hist) {
  if (!appState.isEditor) return;
  if (!ApiService.saveAskLinkHistory) return;
  ApiService.saveAskLinkHistory(row, hist).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

/* Loads every record's persisted Ask-AI Q&A history into appState.linkAskQa
   so questions survive a page reload. Called once after login. */
function loadAskLinkHistory() {
  if (!appState.isEditor) return;
  if (!ApiService.getAllAskLinkHistory) return;
  ApiService.getAllAskLinkHistory().then(function (data) {
    if (!data || data.success !== true || !data.history) return;
    const merged = Object.assign({}, data.history, appState.linkAskQa || {});
    appState.linkAskQa = merged;
    EventBus.emit('AskLinkHistoryLoaded');
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

function askLinkAi(elm) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const ask = elm.closest('.card-ai-ask');
  if (!ask) return;
  const input = ask.querySelector('.card-ai-ask-input');
  const result = ask.querySelector('.card-ai-ask-result');
  const askBtn = ask.querySelector('.card-ai-ask-btn');
  const question = (input.value || '').trim();
  if (!question) { input.focus(); return; }
  const row = input.getAttribute('data-row');
  if (!row) return;
  askBtn.disabled = true;
  result.hidden = false;
  result.className = 'card-ai-ask-result card-ai-ask-loading';
  result.textContent = 'Asking AI…';
  ApiService.askLinkAi(row, question).then(function (data) {
    if (!data || data.success !== true) {
      const msg = (data && data.message) || 'Could not get an answer.';
      result.className = 'card-ai-ask-result card-ai-ask-error';
      result.textContent = msg;
      askBtn.disabled = false;
      return;
    }
    const hist = appState.linkAskQa[String(row)] || (appState.linkAskQa[String(row)] = []);
    // Re-asking the same question moves it to the top instead of duplicating.
    let dup = -1;
    for (let i = 0; i < hist.length; i++) {
      if (hist[i].question === question) { dup = i; break; }
    }
    if (dup !== -1) hist.splice(dup, 1);
    hist.push({ question: question, answer: data.insights || '' });
    if (hist.length > 10) hist.splice(0, hist.length - 10);
    result.outerHTML = linkAskResultHtml_(row);
    askBtn.disabled = false;
    persistAskLinkHistory(row, hist);
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    result.className = 'card-ai-ask-result card-ai-ask-error';
    result.textContent = (err && err.message) ? err.message : String(err || 'Unknown error');
    askBtn.disabled = false;
  });
}

/* ---------------------------------- In-page link preview ---------------------------------- */
/* Opens a URL in an embedded iframe inside the dashboard instead of a new tab.
   Drive document previews use the Google Drive /preview host; plain URLs are
   attempted too, with a fallback "Open in new tab" button for sites that block
   embedding. */

/* Rewrite shareable URLs to an embeddable form where possible (Drive file
   links -> /preview host). Returns the URL unchanged when not recognized. */
function toEmbeddableUrl(url) {
  if (!url) return '';
  const m = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
  const o = url.match(/drive\.google\.com\/open\?id=([^&#]+)/);
  if (o) return 'https://drive.google.com/file/d/' + o[1] + '/preview';
  return url;
}

function openLinkPreview(url, title) {
  const frame = getEl('previewFrame');
  const openNew = getEl('previewOpenNew');
  if (!frame) { window.open(url, '_blank'); return; }
  const titleEl = getEl('previewModalTitle');
  if (titleEl) titleEl.textContent = title || 'Preview';
  if (openNew) openNew.href = url;
  previewZoom = 100;
  applyPreviewZoom();
  frame.src = toEmbeddableUrl(url) || '';
  openDialog('previewModal');
}

function closeLinkPreview() {
  const frame = getEl('previewFrame');
  if (frame) frame.src = 'about:blank';
  closeDialog('previewModal');
}

/* ---------------------------------- Preview zoom ---------------------------------- */
/* Scales the embedded iframe so Sheets/Docs/Presentations (and any other
   preview) can be zoomed in/out. Zoom buttons call these directly; trackpad
   pinch (browsers send Ctrl+wheel) is wired by wirePreviewPinch(). */

let previewZoom = 100;

function applyPreviewZoom() {
  const frame = getEl('previewFrame');
  const value = getEl('previewZoomValue');
  if (frame) frame.style.zoom = previewZoom / 100;
  if (value) value.textContent = previewZoom + '%';
}

function adjustPreviewZoom(delta) {
  previewZoom = Math.min(300, Math.max(50, previewZoom + delta));
  applyPreviewZoom();
}

function previewZoomIn() { adjustPreviewZoom(10); }
function previewZoomOut() { adjustPreviewZoom(-10); }
function previewZoomReset() { previewZoom = 100; applyPreviewZoom(); }

/* Trackpad pinch-to-zoom (and Ctrl+scroll on a mouse) scales the preview. */
function wirePreviewPinch() {
  const stage = getEl('previewStage');
  if (!stage) return;
  stage.addEventListener('wheel', function (e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    adjustPreviewZoom(e.deltaY < 0 ? 10 : -10);
  }, { passive: false });
}

/* Preview handler for file attachments: file key -> local /api/files/<key> stream. */
function openDriveDocPreview(fileKey, fileName) {
  if (!fileKey) return;
  openLinkPreview(API_URL + '/files/' + encodeURIComponent(fileKey), fileName || 'Document preview');
}

/* Delegated handler: intercept links that would otherwise open in a new tab
   (auto-linkified URLs in records, table cells, Drive attachments) so they
   render in the in-page preview modal instead. The "Open in new tab" button
   inside the preview modal itself is exempt, and non-http(s) schemes like
   mailto:/tel: keep their default behaviour. */
function wireEmbeddedLinkPreview() {
  document.addEventListener('click', function (event) {
    const link = event.target.closest ? event.target.closest('a[data-embed], a[target="_blank"]') : null;
    if (!link) return;
    if (link.closest && link.closest('#previewModal')) return;
    const href = link.getAttribute('href') || '';
    if (!/^https?:/i.test(href)) return;
    event.preventDefault();
    openLinkPreview(href, link.textContent.trim());
  });
}

let confirmDialogState = null;

function showConfirm(options) {
  return new Promise(function (resolve) {
    confirmDialogState = { onConfirm: resolve };
    getEl('confirmMessage').textContent = options.message || 'Are you sure?';
    getEl('confirmModalTitle').textContent = options.title || 'Confirm';
    const okBtn = getEl('confirmOkBtn');
    okBtn.textContent = options.okLabel || 'OK';
    okBtn.classList.toggle('btn-danger', !!options.danger);
    okBtn.classList.toggle('btn-primary', !options.danger);
    openDialog('confirmModal');
  });
}

function runConfirmDialog() {
  const cb = confirmDialogState ? confirmDialogState.onConfirm : null;
  confirmDialogState = null;
  closeDialog('confirmModal');
  if (cb) cb(true);
}

function cancelConfirmDialog() {
  const cb = confirmDialogState ? confirmDialogState.onConfirm : null;
  confirmDialogState = null;
  closeDialog('confirmModal');
  if (cb) cb(false);
}

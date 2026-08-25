
/* ---------------------------------- Edit modal ---------------------------------- */

function openEditModal() {
  openDialog('editModal');
  const modal = getEl('editModal');
  const firstInput = modal.querySelector('input:not([type=hidden]):not([readonly])');
  if (firstInput) firstInput.focus();
}

function closeEditModal() {
  closeDialog('editModal');
}

const linkFields_ = {
  action: 'editAction'
};

function updateFieldLinkButton(fieldKey) {
  const btn = document.querySelector('.field-link-btn[data-link-field="' + fieldKey + '"]');
  if (!btn) return;
  const list = (appState.fieldLinks && appState.fieldLinks[fieldKey]) || [];
  const count = Array.isArray(list) ? list.filter(function (l) { return l && l.url; }).length : (list && list.url ? 1 : 0);
  btn.classList.toggle('is-linked', count > 0);
  btn.textContent = count > 0 ? 'Edit links (' + count + ')' : 'Link';
  btn.setAttribute('aria-label', (count > 0 ? 'Edit hyperlinks for ' : 'Add hyperlinks to ') + fieldKey);
}

function openLinkModal(fieldKey) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const inputId = linkFields_[fieldKey];
  if (!inputId) return;
  appState.linkField = fieldKey;
  const raw = (appState.fieldLinks && appState.fieldLinks[fieldKey]) || [];
  const existing = Array.isArray(raw) ? raw : (raw && raw.url ? [raw] : []);
  getEl('linkField').value = fieldKey;
  getEl('linkList').innerHTML = '';
  (existing.length ? existing : [{}]).forEach(function (link) {
    appendLinkRow_(link || {});
  });
  const status = getEl('linkStatus');
  if (status) { status.textContent = ''; status.classList.remove('success', 'error'); }
  openDialog('linkModal');
  const firstInput = getEl('linkList').querySelector('input');
  if (firstInput) firstInput.focus();
}

function appendLinkRow_(link) {
  const list = getEl('linkList');
  if (!list) return;
  const index = list.children.length;
  const row = document.createElement('div');
  row.className = 'link-row';
  row.innerHTML =
    '<div class="link-row-head"><span class="link-row-label">Link ' + (index + 1) + '</span>' +
    (index > 0 ? '<button type="button" class="btn btn-danger btn-small" onclick="removeLinkRow(this)" aria-label="Remove this link">Remove</button>' : '') +
    '</div>' +
    '<div class="field">' +
    '  <label>Display text</label>' +
    '  <input type="text" class="input link-row-text" placeholder="Link text shown in the field" value="' + escAttr(String(link.text || '')) + '">' +
    '  <span class="field-error"></span>' +
    '</div>' +
    '<div class="field">' +
    '  <label>Link URL</label>' +
    '  <input type="text" class="input link-row-url" placeholder="https://example.com" value="' + escAttr(String(link.url || '')) + '">' +
    '  <span class="field-error"></span>' +
    '</div>';
  list.appendChild(row);
}

function addLinkRow() {
  appendLinkRow_({});
}

function removeLinkRow(btn) {
  const row = btn && btn.closest('.link-row');
  if (!row) return;
  const list = getEl('linkList');
  row.remove();
  // re-number the remaining rows
  Array.prototype.forEach.call(list.children, function (child, i) {
    const label = child.querySelector('.link-row-label');
    if (label) label.textContent = 'Link ' + (i + 1);
    const removeBtn = child.querySelector('[onclick^="removeLinkRow"]');
    if (removeBtn) removeBtn.style.visibility = i === 0 ? 'hidden' : '';
  });
}

function closeLinkModal() {
  closeDialog('linkModal');
}

function normalizeLinkUrl_(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) return value;
  if (/^www\./i.test(value)) return 'https://' + value;
  return 'https://' + value;
}

function saveLinkModal(e) {
  e.preventDefault();
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const fieldKey = getEl('linkField').value;
  const rows = getEl('linkList').querySelectorAll('.link-row');
  const collected = [];
  let valid = true;
  Array.prototype.forEach.call(rows, function (row) {
    const textEl = row.querySelector('.link-row-text');
    const urlEl = row.querySelector('.link-row-url');
    const text = (textEl && textEl.value || '').trim();
    const url = (urlEl && urlEl.value || '').trim();
    if (!text && !url) return; // skip empty rows
    let rowValid = true;
    rowValid = setFieldInvalid(textEl, text ? '' : 'Display text is required.') && rowValid;
    rowValid = setFieldInvalid(urlEl, url ? '' : 'Link URL is required.') && rowValid;
    if (!rowValid) { valid = false; return; }
    collected.push({ text: text, url: normalizeLinkUrl_(url) });
  });
  if (!valid) return;
  if (!appState.fieldLinks) appState.fieldLinks = {};
  if (collected.length) {
    appState.fieldLinks[fieldKey] = collected;
  } else {
    delete appState.fieldLinks[fieldKey];
  }
  // Keep the field's own text as the user typed it: the hyperlink display
  // texts live in fieldLinks and are rendered below the field text.
  updateFieldLinkButton(fieldKey);
  closeLinkModal();
  showToast(collected.length ? 'Hyperlinks applied to ' + fieldKey : 'Hyperlinks removed', collected.length ? 'success' : 'info');
}

function resetEditForm() {
  getEl('editRow').value = '';
  getEl('editId').value = '';
  getEl('editSector').value = '';
  getEl('editDescription').value = '';
  getEl('editEntryDate').value = '';
  getEl('editAction').value = '';
  populateResponsibilitySelect();
  getEl('editResponsibility').value = '';
  // Clear multi-select chips
  var msContainer = document.getElementById('editResponsibilityMs');
  if (msContainer) {
    msContainer.querySelectorAll('.ms-chip').forEach(function (c) { c.remove(); });
    msContainer.querySelectorAll('.ms-option').forEach(function (o) { o.classList.remove('ms-selected'); });
    var triggerBtn = msContainer.querySelector('.ms-trigger');
    if (triggerBtn) triggerBtn.textContent = 'Select...';
  }
  getEl('editReviewDate').value = '';
  getEl('editFlagged').checked = false;
  appState.fieldLinks = {};
  Object.keys(linkFields_).forEach(function (fieldKey) { updateFieldLinkButton(fieldKey); });
  const status = getEl('editStatus');
  if (status) { status.textContent = ''; status.classList.remove('success', 'error'); }
  ['editSector', 'editDescription'].forEach(function (id) {
    const el = getEl(id);
    if (el) setFieldInvalid(el, '');
  });
}

// Returns the current link list for a field as an array of {text, url} (or
// null when no links are set). Used when saving so the payload carries the
// multi-link array form the server now expects.
function readFieldLinks_(fieldKey) {
  const raw = appState.fieldLinks && appState.fieldLinks[fieldKey];
  if (!raw) return null;
  const list = Array.isArray(raw) ? raw : [raw];
  const cleaned = list.filter(function (l) { return l && l.url; }).map(function (l) {
    return { text: (l.text || '').trim(), url: String(l.url || '').trim() };
  });
  return cleaned.length ? cleaned : null;
}

function addNewItem() {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  appState.editMode = 'add';
  resetEditForm();
  openEditModal();
}

function editItem(row) {
  const item = appState.items.find(function (i) { return String(i.row) === String(row); });
  if (!item) return;
  appState.editMode = 'edit';
  getEl('editRow').value = item.row;
  getEl('editId').value = item.id || '';
  getEl('editSector').value = item.sector || '';
  getEl('editDescription').value = item.description || '';
  getEl('editEntryDate').value = item.entryDate || '';
  getEl('editAction').value = item.action || '';
  populateResponsibilitySelect();
  getEl('editResponsibility').value = item.responsibility || '';
  // Populate multi-select chips from comma-separated value
  var msContainer = document.getElementById('editResponsibilityMs');
  if (msContainer) {
    var chipsContainer = msContainer.querySelector('.ms-chips');
    var vals = (item.responsibility || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    chipsContainer.innerHTML = vals.map(function (v) {
      return '<span class="ms-chip" data-value="' + escAttr(v) + '">' + escapeHtml(v) + '<button type="button" class="ms-chip-remove" aria-label="Remove" data-remove="' + escAttr(v) + '">&times;</button></span>';
    }).join('');
    var triggerBtn = msContainer.querySelector('.ms-trigger');
    triggerBtn.textContent = vals.length ? vals.length + ' selected' : 'Select...';
    msContainer.querySelectorAll('.ms-option').forEach(function (it) {
      it.classList.toggle('ms-selected', vals.indexOf(it.getAttribute('data-value')) !== -1);
    });
  }
  getEl('editReviewDate').value = item.reviewDate || '';
  getEl('editFlagged').checked = !!item.flagged;
  appState.fieldLinks = {};
  Object.keys(linkFields_).forEach(function (fieldKey) {
    // Prefer the full per-field link list (array form); fall back to the
    // legacy single {url, text} shape from linkUrls/linkTexts.
    const list = (item.links && item.links[fieldKey]) || null;
    if (Array.isArray(list) && list.length) {
      appState.fieldLinks[fieldKey] = list.map(function (l) {
        return { text: (l && l.text) || '', url: (l && l.url) || '' };
      });
    } else if (list && list.url) {
      appState.fieldLinks[fieldKey] = [{ text: list.text || '', url: list.url }];
    } else {
      const url = item.linkUrls && item.linkUrls[fieldKey];
      if (url) {
        const text = (item.linkTexts && item.linkTexts[fieldKey]) || item[fieldKey] || '';
        appState.fieldLinks[fieldKey] = [{ text: text, url: url }];
      }
    }
    updateFieldLinkButton(fieldKey);
  });
  const status = getEl('editStatus');
  if (status) { status.textContent = ''; status.classList.remove('success', 'error'); }
  ['editSector', 'editDescription'].forEach(function (id) {
    const el = getEl(id);
    if (el) setFieldInvalid(el, '');
  });
  openEditModal();
}

function saveEditModal(e) {
  e.preventDefault();
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }

  const sectorEl = getEl('editSector');
  const descEl = getEl('editDescription');
  let valid = true;
  valid = setFieldInvalid(sectorEl, sectorEl.value.trim() ? '' : 'Sector is required.') && valid;
  valid = setFieldInvalid(descEl, descEl.value.trim() ? '' : 'Description is required.') && valid;
  if (!valid) return;

  const item = {
    row: Number(getEl('editRow').value || 0),
    id: getEl('editId').value,
    sector: sectorEl.value.trim(),
    description: descEl.value,
    entryDate: getEl('editEntryDate').value.trim(),
    action: getEl('editAction').value,
    responsibility: getEl('editResponsibility').value.trim(),
    reviewDate: getEl('editReviewDate').value.trim(),
    flagged: getEl('editFlagged').checked,
    links: {
      action: readFieldLinks_('action')
    }
  };

  if (appState.editMode === 'add') {
    submitNewItem(item);
  } else if (item.row) {
    saveItem(item);
  }
}

function submitNewItem(item) {
  showOverlay('Adding record…');
  ApiService.addItem(item).then(function (data) {
    hideOverlay();
    closeEditModal();
    appState.items = data.items || [];
    appState.summary = data.summary || {};
    appState.analytics = data.analytics || {};
    populateFilters();
    renderDashboard(true);
    showToast('New item created', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Add failed: ' + (err.message || err), 'error');
  });
}

function saveItem(item) {
  showOverlay('Saving record…');
  ApiService.updateItem(item).then(function (data) {
    hideOverlay();
    closeEditModal();
    appState.items = data.items || [];
    appState.summary = data.summary || {};
    appState.analytics = data.analytics || {};
    renderDashboard(true);
    showToast('Record saved', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Save failed: ' + (err.message || err), 'error');
  });
}

function deleteItem(row) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  showConfirm({
    title: 'Delete record',
    message: 'Delete this record permanently? This cannot be undone.',
    okLabel: 'Delete',
    danger: true
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Deleting record…');
    ApiService.deleteItem(row).then(function (data) {
      hideOverlay();
      appState.items = data.items || [];
      appState.summary = data.summary || {};
      appState.analytics = data.analytics || {};
      renderDashboard(true);
      showToast('Record deleted', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Delete failed: ' + (err.message || err), 'error');
    });
  });
}

/* ---------------------------------- Review badge ---------------------------------- */

function toggleDropdown(btn) {
  const wrap = btn.closest ? btn.closest('.menu-dropdown') : btn.parentElement;
  const menu = wrap ? wrap.querySelector('.menu-dropdown-menu') : null;
  if (!menu) return;
  const isOpen = menu.classList.toggle('open');
  closeDropdowns(menu);
  return isOpen;
}

function closeDropdowns(exceptMenu) {
  document.querySelectorAll('.menu-dropdown-menu.open').forEach(function (m) {
    if (m !== exceptMenu) m.classList.remove('open');
  });
  document.querySelectorAll('.review-dropdown-menu.open').forEach(function (m) {
    if (m !== exceptMenu) m.classList.remove('open');
  });
}

function toggleReviewDropdown(btn) {
  const menu = btn.parentElement.querySelector('.review-dropdown-menu');
  if (!menu) return;
  const isOpen = menu.classList.toggle('open');
  document.querySelectorAll('.review-dropdown-menu.open').forEach(function (m) {
    if (m !== menu) m.classList.remove('open');
  });
  return isOpen;
}

function markReviewDone(row) {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  showConfirm({
    title: 'Mark review done',
    message: 'Mark this record as review done?',
    okLabel: 'Mark done'
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Marking review as done…');
    ApiService.markReviewDone(row).then(function (data) {
      hideOverlay();
      appState.items = data.items || [];
      appState.summary = data.summary || {};
      renderDashboard(true);
      showToast('Marked review as done', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Failed: ' + (err.message || err), 'error');
    });
  });
}

function markReviewNotDone(row) {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  showConfirm({
    title: 'Mark as not done',
    message: 'Reopen this record so it returns to review due?',
    okLabel: 'Mark not done'
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Reopening review…');
    ApiService.markReviewNotDone(row).then(function (data) {
      hideOverlay();
      appState.items = data.items || [];
      appState.summary = data.summary || {};
      renderDashboard(true);
      showToast('Review reopened — record is review due', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Failed: ' + (err.message || err), 'error');
    });
  });
}

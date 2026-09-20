
/* ---------------------------------- Tasks ---------------------------------- */

function renderTasks() {
  const statusFilter = getEl('taskStatusFilter');
  const priorityFilter = getEl('taskPriorityFilter');
  const mineToggle = getEl('taskMineToggle');
  const filters = {};
  if (statusFilter && statusFilter.value) filters.status = statusFilter.value;
  if (priorityFilter && priorityFilter.value) filters.priority = priorityFilter.value;

  showOverlay('Loading tasks…');
  ApiService.getTasks(filters).then(function (tasks) {
    hideOverlay();
    appState.tasks = tasks || [];

    const mineOnly = mineToggle && mineToggle.checked;
    if (mineOnly && appState.user) {
      const me = appState.user.email;
      appState.tasks = (appState.tasks || []).filter(function (t) {
        return String(t.assignee || '').indexOf(me) !== -1 || String(t.createdBy || '').indexOf(me) !== -1;
      });
    }

    renderTaskList();
    if (appState.taskView === 'board') renderKanbanBoard_();
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not load tasks: ' + (err.message || err), 'error');
  });
}

function renderTaskList() {
  const tasks = appState.tasks || [];
  const tbody = getEl('tasksBody');
  const empty = getEl('tasksEmpty');
  const user = appState.user;
  const isAdminOrEditor = user && (user.role === 'ADMIN' || user.role === 'EDITOR');
  
  if (tbody) {
    tbody.innerHTML = tasks.map(function (t) {
        const statusClass = t.status === 'DONE' ? 'badge-success' : t.status === 'IN_PROGRESS' ? 'badge-warning' : t.status === 'CANCELLED' ? 'badge-muted' : 'badge-danger';
        const isOverdue = t.status !== 'DONE' && t.status !== 'CANCELLED' && t.dueDate && new Date(t.dueDate).getTime() < Date.now();
        const overdueFlag = isOverdue ? ' <span class="badge badge-danger" data-overdue title="This task is past its due date">Overdue</span>' : '';
      const priorityClass = t.priority === 'URGENT' ? 'badge-danger' : t.priority === 'HIGH' ? 'badge-warning' : t.priority === 'MEDIUM' ? 'badge-info' : 'badge-muted';
      
      // Build action buttons
      let actionButtons = '';
      if (t.status !== 'DONE' && t.status !== 'CANCELLED') {
        actionButtons += '<button class="btn btn-ghost btn-small" type="button" onclick="completeTask(\'' + escAttr(t.id) + '\')">Complete</button>';
        actionButtons += '<button class="btn btn-ghost btn-small" type="button" data-download-ics="' + escAttr(t.id) + '" style="margin-left:4px;">ICS</button>';
        actionButtons += '<button class="btn btn-ghost btn-small" type="button" data-complete-task-offline="' + escAttr(t.id) + '" style="margin-left:4px;">Complete offline</button>';
      }
      if (isAdminOrEditor) {
        actionButtons += '<button class="btn btn-ghost btn-small" type="button" onclick="editTask(\'' + escAttr(t.id) + '\')" style="margin-left:4px;">Edit</button>';
        actionButtons += '<button class="btn btn-ghost btn-small" type="button" onclick="deleteTaskConfirm(\'' + escAttr(t.id) + '\')" style="margin-left:4px;color:var(--danger,#dc3545);">Delete</button>';
      }
      
      // Display a friendly label for the assignee (may be comma-separated).
      var assigneeDisplay = (t.assignee || '').split(',').map(function (a) {
        a = a.trim();
        if (a === 'group:all-divisional-heads') return 'All Divisional Heads';
        return a;
      }).filter(Boolean).join(', ');

      return '<tr data-task-id="' + escAttr(t.id) + '">' +
        '<td class="preserve-whitespace">' + escapeHtml(t.title || '') + '</td>' +
        '<td>' + escapeHtml(assigneeDisplay) + '</td>' +
        '<td><span class="badge ' + statusClass + '" id="task-status-' + escAttr(t.id) + '">' + escapeHtml(t.status || '') + '</span></td>' +
        '<td><span class="badge ' + priorityClass + '">' + escapeHtml(t.priority || '') + '</span></td>' +
        '<td>' + (t.dueDate ? escapeHtml(formatDate(t.dueDate)) : '') + '</td>' +
        '<td>' + actionButtons + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="6">No tasks found.</td></tr>';
  }
  if (empty) empty.classList.toggle('hidden', !!tasks.length);
}

/* ---------------------------------- Kanban board ---------------------------------- */

var KANBAN_COLUMNS = [
  { status: 'OPEN', label: 'Open' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'DONE', label: 'Done' },
  { status: 'CANCELLED', label: 'Cancelled' }
];

var KANBAN_LABELS = { OPEN: 'Open', IN_PROGRESS: 'In progress', DONE: 'Done', CANCELLED: 'Cancelled' };

function setTaskView(view) {
  appState.taskView = view;
  const listBtn = getEl('taskViewListBtn');
  const boardBtn = getEl('taskViewBoardBtn');
  const listView = getEl('taskListView');
  const empty = getEl('tasksEmpty');
  const board = getEl('kanbanBoard');
  if (listBtn) listBtn.setAttribute('aria-pressed', String(view === 'list'));
  if (boardBtn) boardBtn.setAttribute('aria-pressed', String(view === 'board'));
  if (listView) listView.classList.toggle('hidden', view !== 'list');
  if (empty) empty.classList.toggle('hidden', view !== 'list');
  if (board) board.classList.toggle('hidden', view !== 'board');
  if (view === 'board') {
    // The board shows every status as a column; drop the list's status filter
    // so columns populate fully.
    const statusFilter = getEl('taskStatusFilter');
    if (statusFilter) statusFilter.value = '';
    if (!appState.tasks || !appState.tasks.length) {
      renderTasks();
    } else {
      renderKanbanBoard_();
    }
  } else {
    renderTasks();
  }
}

function renderKanbanBoard_() {
  const board = getEl('kanbanBoard');
  if (!board) return;
  const tasks = appState.tasks || [];
  const user = appState.user;
  const isAdminOrEditor = user && (user.role === 'ADMIN' || user.role === 'EDITOR');

  board.innerHTML = KANBAN_COLUMNS.map(function (col) {
    const colTasks = tasks.filter(function (t) { return String(t.status || 'OPEN') === col.status; });
    const cards = colTasks.map(function (t) { return kanbanCardHtml_(t, isAdminOrEditor); }).join('');
    return '<section class="kanban-column" data-status="' + col.status + '" aria-label="' + col.label + ' tasks">' +
      '<header class="kanban-col-head"><span class="kanban-col-title">' + col.label + '</span>' +
      '<span class="kanban-col-count">' + colTasks.length + '</span></header>' +
      '<div class="kanban-col-body">' +
      (cards || '<div class="kanban-empty">No tasks</div>') +
      '</div>' +
      '</section>';
  }).join('');
}

function kanbanCardHtml_(t, isAdminOrEditor) {
  const id = escAttr(t.id);
  const status = String(t.status || 'OPEN');
  const isOverdue = status !== 'DONE' && status !== 'CANCELLED' && t.dueDate && new Date(t.dueDate).getTime() < Date.now();
  const overdueFlag = isOverdue ? ' <span class="badge badge-danger" data-overdue title="This task is past its due date">Overdue</span>' : '';
  const priorityClass = t.priority === 'URGENT' ? 'badge-danger' : t.priority === 'HIGH' ? 'badge-warning' : t.priority === 'MEDIUM' ? 'badge-info' : 'badge-muted';
  const assigneeDisplay = (t.assignee || '').split(',').map(function (a) {
    a = a.trim();
    if (a === 'group:all-divisional-heads') return 'All Divisional Heads';
    return a;
  }).filter(Boolean).join(', ');
  const options = KANBAN_COLUMNS.map(function (col) {
    const selected = col.status === status ? ' selected' : '';
    return '<option value="' + col.status + '"' + selected + '>' + col.label + '</option>';
  }).join('');
  const quickComplete = (status !== 'DONE' && status !== 'CANCELLED')
    ? '<button class="btn btn-ghost btn-small" type="button" onclick="kanbanMoveTask(\'' + id + '\',\'DONE\')">Complete</button>'
    : '';
  const editBtn = isAdminOrEditor
    ? '<button class="btn btn-ghost btn-small" type="button" onclick="editTask(\'' + id + '\')">Edit</button>'
    : '';
  return '<article class="kanban-card" draggable="true" data-task-id="' + id + '" data-status="' + status + '">' +
    '<div class="kanban-card-title">' + escapeHtml(t.title || '') + '</div>' +
    '<div class="kanban-card-meta">' + escapeHtml(assigneeDisplay || 'Unassigned') + '</div>' +
    '<div class="kanban-card-sub">' +
    '<span class="badge ' + priorityClass + '">' + escapeHtml(t.priority || '') + '</span>' +
    '<span class="kanban-card-due">' + (t.dueDate ? escapeHtml(formatDate(t.dueDate)) : '') + '</span>' + overdueFlag +
    '</div>' +
    '<div class="kanban-card-actions">' +
    quickComplete +
    editBtn +
    '<label class="kanban-move-label">Move' +
    '<select class="kanban-move" data-move-task="' + id + '" aria-label="Move to status">' + options + '</select>' +
    '</label>' +
    '</div>' +
    '</article>';
}

function kanbanMoveTask(id, newStatus) {
  const task = (appState.tasks || []).find(function (t) { return t.id === id; });
  if (!task || task.status === newStatus) { renderKanbanBoard_(); return; }
  ApiService.updateTask(id, { status: newStatus }).then(function () {
    task.status = newStatus;
    if (newStatus === 'DONE') task.completedAt = Date.now();
    if (appState.taskView === 'board') renderKanbanBoard_();
    showToast('Task moved to ' + (KANBAN_LABELS[newStatus] || newStatus) + '.', 'success');
    refreshCounts();
  }).catch(function (err) {
    renderKanbanBoard_();
    if (handleServerFailure(err)) return;
    showToast('Could not move task: ' + (err.message || err), 'error');
  });
}

function wireKanbanBoard() {
  document.addEventListener('change', function (e) {
    const sel = e.target && e.target.closest ? e.target.closest('select[data-move-task]') : null;
    if (!sel) return;
    kanbanMoveTask(sel.getAttribute('data-move-task'), sel.value);
  });
  document.addEventListener('dragstart', function (e) {
    const card = e.target && e.target.closest ? e.target.closest('.kanban-card[data-task-id]') : null;
    if (!card) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.getAttribute('data-task-id'));
    card.classList.add('kanban-dragging');
  });
  document.addEventListener('dragend', function (e) {
    const card = e.target && e.target.closest ? e.target.closest('.kanban-card') : null;
    if (card) card.classList.remove('kanban-dragging');
  });
  document.addEventListener('dragover', function (e) {
    if (!e.dataTransfer || !e.dataTransfer.types || e.dataTransfer.types.indexOf('text/plain') === -1) return;
    const col = e.target && e.target.closest ? e.target.closest('.kanban-column[data-status]') : null;
    if (!col) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    col.classList.add('kanban-over');
  });
  document.addEventListener('dragleave', function (e) {
    const col = e.target && e.target.closest ? e.target.closest('.kanban-column') : null;
    if (col) col.classList.remove('kanban-over');
  });
  document.addEventListener('drop', function (e) {
    const col = e.target && e.target.closest ? e.target.closest('.kanban-column[data-status]') : null;
    if (!col) return;
    e.preventDefault();
    col.classList.remove('kanban-over');
    const id = e.dataTransfer && e.dataTransfer.getData('text/plain');
    if (id) kanbanMoveTask(id, col.getAttribute('data-status'));
  });
}

wireKanbanBoard();

function populateTaskAssigneeDropdown() {
  const hiddenInput = getEl('taskAssignee');
  if (!hiddenInput) return;
  
  const users = appState.allUsers || [];
  const options = users.map(function (u) {
    var displayLabel = u.email === 'group:all-divisional-heads'
      ? 'All Divisional Heads'
      : u.email + (u.username ? ' (' + u.username + ')' : '');
    return { value: u.email, label: displayLabel };
  });
  populateMultiSelectOptions('taskAssigneeMs', options);
}

function openTaskModal(recordRow) {
  // Reset editing state if opening fresh
  if (!appState.editingTaskId) {
    getEl('taskModalTitle').textContent = 'New task';
    closeTaskModal(); // Clear all fields
  }
  if (recordRow !== undefined && recordRow !== null && recordRow !== '') {
    getEl('taskRecordRow').value = String(recordRow);
  }
  
  // Load and populate users dropdown
  if (!appState.allUsers) {
    ApiService.getAssignableUsers().then(function (users) {
      appState.allUsers = users;
      populateTaskAssigneeDropdown();
    }).catch(function (err) {
      console.error('Could not load users for assignee dropdown:', err);
      showToast('Could not load users list.', 'warning');
    });
  } else {
    populateTaskAssigneeDropdown();
  }
  
  openDialog('taskModal');
  const modal = getEl('taskModal');
  const firstInput = modal.querySelector('input:not([type=hidden]):not([readonly])');
  if (firstInput) firstInput.focus();
}

function closeTaskModal() {
  closeDialog('taskModal');
  appState.editingTaskId = null;
  getEl('taskModalTitle').textContent = 'New task';
  getEl('taskTitle').value = '';
  getEl('taskDescription').value = '';
  getEl('taskAssignee').value = '';
  clearMultiSelect('taskAssigneeMs');
  getEl('taskPriority').value = 'MEDIUM';
  getEl('taskDueDate').value = '';
  getEl('taskRecordRow').value = '';
}

function saveTask() {
  const title = getEl('taskTitle').value.trim();
  if (!title) {
    showToast('Task title is required.', 'error');
    return;
  }
  
  const assignee = getEl('taskAssignee').value.trim();
  if (!assignee) {
    showToast('Please select an assignee.', 'error');
    return;
  }
  
  const params = {
    title: title,
    description: getEl('taskDescription').value.trim(),
    assignee: assignee,
    priority: getEl('taskPriority').value,
    dueDate: dmyToIso(getEl('taskDueDate').value),
    recordRow: getEl('taskRecordRow').value ? Number(getEl('taskRecordRow').value) : 0
  };
  
  // Check if we're editing or creating
  if (appState.editingTaskId) {
    showOverlay('Updating task…');
    ApiService.updateTask(appState.editingTaskId, params).then(function () {
      hideOverlay();
      closeTaskModal();
      showToast('Task updated.', 'success');
      renderTasks();
      refreshCounts();
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not update task: ' + (err.message || err), 'error');
    });
  } else {
    showOverlay('Creating task…');
    ApiService.createTask(params).then(function () {
      hideOverlay();
      closeTaskModal();
      showToast('Task created.', 'success');
      renderTasks();
      refreshCounts();
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not create task: ' + (err.message || err), 'error');
    });
  }
}

function completeTask(id) {
  showConfirm({
    title: 'Mark task complete',
    message: 'Mark this task as done?',
    okLabel: 'Done'
  }).then(function (confirmed) {
    if (!confirmed) return;
    completeTaskOptimistic(id);
  });
}

/** Optimistically toggles a task to DONE. DOM flips instantly; on server
 *  failure the row is rolled back and a Toast explains the problem. */
function completeTaskOptimistic(id) {
  const row = document.querySelector('tr[data-task-id="' + String(id).replace(/["\\]/g, '\\$&') + '"]');
  if (!row) { renderTasks(); return; }

  const statusEl = row.querySelector('.badge');
  const buttons = Array.prototype.slice.call(row.querySelectorAll('button'));
  const snapshot = row.innerHTML; // cheap rollback image (a single row)
  const prevText = statusEl ? statusEl.textContent : '';

  // 1) Apply the optimistic state BEFORE the network call resolves
  if (statusEl) {
    statusEl.textContent = 'DONE';
    statusEl.className = 'badge badge-success';
  }
  row.classList.add('task-pending');
  buttons.forEach(function (b) { b.disabled = true; });

  // 2) Fire the real call
  ApiService.updateTask(id, { status: 'DONE' }).then(function () {
    const task = (appState.tasks || []).find(function (t) { return t.id === id; });
    if (task) { task.status = 'DONE'; task.completedAt = Date.now(); }
    row.classList.remove('task-pending');
    buttons.forEach(function (b) { b.disabled = false; });
    refreshCounts();
    showToast('Task marked complete.', 'success');
  }).catch(function (err) {
    // 3) ROLLBACK: restore the exact prior DOM + re-enable buttons
    row.innerHTML = snapshot;
    if (statusEl) statusEl.textContent = prevText;
    row.classList.remove('task-pending');
    if (handleServerFailure(err)) return;
    showToast('Could not update task: ' + (err.message || err), 'error');
  });
}

function editTask(id) {
  const task = (appState.tasks || []).find(function (t) { return t.id === id; });
  if (!task) {
    showToast('Task not found.', 'error');
    return;
  }
  
  // Store the task ID for editing
  appState.editingTaskId = id;
  
  // Populate the modal
  getEl('taskTitle').value = task.title || '';
  getEl('taskDescription').value = task.description || '';
  getEl('taskPriority').value = task.priority || 'MEDIUM';
  getEl('taskDueDate').value = task.dueDate ? formatDate(task.dueDate) : '';
  getEl('taskRecordRow').value = task.recordRow || '';
  
  // Update modal title
  getEl('taskModalTitle').textContent = 'Edit task';
  
  // Populate assignee (will be populated after users are loaded)
  if (appState.allUsers) {
    getEl('taskAssignee').value = task.assignee || '';
    populateTaskAssigneeDropdown();
  } else {
    // Load users if not already loaded
    ApiService.getAssignableUsers().then(function (users) {
      appState.allUsers = users;
      getEl('taskAssignee').value = task.assignee || '';
      populateTaskAssigneeDropdown();
    }).catch(function (err) {
      console.error('Could not load users:', err);
    });
  }
  
  openTaskModal();
}

function deleteTaskConfirm(id) {
  showConfirm({
    title: 'Delete task',
    message: 'Permanently delete this task?',
    okLabel: 'Delete',
    danger: true
  }).then(function (confirmed) {
    if (!confirmed) return;
    showOverlay('Deleting task…');
    ApiService.deleteTask(id).then(function () {
      hideOverlay();
      showToast('Task deleted.', 'success');
      renderTasks();
      refreshCounts();
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not delete task: ' + (err.message || err), 'error');
    });
  });
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return day + '/' + month + '/' + year;
}

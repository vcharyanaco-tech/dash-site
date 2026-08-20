
/* ---------------------------------- Tasks ---------------------------------- */

function renderTasks() {
  const statusFilter = getEl('taskStatusFilter');
  const priorityFilter = getEl('taskPriorityFilter');
  const filters = {};
  if (statusFilter && statusFilter.value) filters.status = statusFilter.value;
  if (priorityFilter && priorityFilter.value) filters.priority = priorityFilter.value;

  showOverlay('Loading tasks…');
  ApiService.getTasks(filters).then(function (tasks) {
    hideOverlay();
    appState.tasks = tasks || [];
    renderTaskList();
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
      
      // Display a friendly label for the 'All Divisional Heads' group marker.
      var assigneeDisplay = t.assignee || '';
      if (assigneeDisplay === 'group:all-divisional-heads') assigneeDisplay = 'All Divisional Heads';

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

function populateTaskAssigneeDropdown() {
  const select = getEl('taskAssignee');
  if (!select) return;
  
  const users = appState.allUsers || [];
  select.innerHTML = '<option value="">Select assignee...</option>' +
    users.map(function (u) {
      // Use the friendly label for the 'All Divisional Heads' group entry.
      var displayLabel = u.email === 'group:all-divisional-heads'
        ? 'All Divisional Heads'
        : u.email + (u.username ? ' (' + u.username + ')' : '');
      return '<option value="' + escAttr(u.email) + '">' + escapeHtml(displayLabel) + '</option>';
    }).join('');
}

function openTaskModal() {
  // Reset editing state if opening fresh
  if (!appState.editingTaskId) {
    getEl('taskModalTitle').textContent = 'New task';
    closeTaskModal(); // Clear all fields
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
    populateTaskAssigneeDropdown();
    getEl('taskAssignee').value = task.assignee || '';
  } else {
    // Load users if not already loaded
    ApiService.getAssignableUsers().then(function (users) {
      appState.allUsers = users;
      populateTaskAssigneeDropdown();
      getEl('taskAssignee').value = task.assignee || '';
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


/* ---------------------------------- My Day ---------------------------------- */
/* Operational daily summary: "What do I need to do now?" (Part 5).
   Fetches the user's own tasks + notifications, then renders a TODAY
   summary strip + a priority action list with direct-action buttons. */

function renderMyDay() {
  var panel = getEl('myDayPanel');
  if (!panel) return;

  panel.innerHTML =
    '<div class="myday-loading"><div class="spinner"></div><span>Loading your day…</span></div>';

  // Load tasks (user's own) + notifications concurrently, then build.
  Promise.all([
    ApiService.getMyTasks().catch(function () { return []; }),
    loadNotifications(true).catch(function () { /* badge still shows */ })
  ]).then(function (results) {
    var myTasks = results[0] || [];
    var data = buildMyDayData_(myTasks);
    renderMyDayContent_(panel, data);
  }).catch(function () {
    panel.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-state-icon">' + svgIcon('alert') + '</div>' +
      '<div class="empty-state-title">Could not load your day</div>' +
      '<div class="empty-state-subtitle">Please try again later.</div>' +
      '</div>';
  });
}

/* ---------------------------------- Data ---------------------------------- */

function buildMyDayData_(myTasks) {
  var now = new Date();
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var todayEnd = todayStart + 86400000;

  var items = appState.items || [];

  // ── Reviews ────────────────────────────────────────────────────────────
  var reviewsDue = items.filter(function (i) { return i.reviewStatus === 'due'; });
  var reviewsOverdue = [];
  var reviewsToday = [];
  reviewsDue.forEach(function (i) {
    var rd = parseDateFieldValue(i.reviewDate);
    if (!rd || rd.getTime() < todayStart) reviewsOverdue.push(i);
    else reviewsToday.push(i);
  });

  // ── Tasks ──────────────────────────────────────────────────────────────
  var openTasks = myTasks.filter(function (t) {
    return t.status !== 'DONE' && t.status !== 'CANCELLED';
  });
  var tasksOverdue = openTasks.filter(function (t) {
    return t.dueDate && t.dueDate < todayStart;
  });
  var tasksToday = openTasks.filter(function (t) {
    return t.dueDate >= todayStart && t.dueDate < todayEnd;
  });

  // ── Submissions (unread flash rows) ────────────────────────────────────
  var flash = appState.submissionFlash || {};
  var submissionCounts = appState.submissionCounts || {};
  var unreadSubRows = Object.keys(flash).filter(function (k) { return flash[k]; });
  var unreadSubmissions = unreadSubRows.map(function (row) {
    var r = Number(row);
    var item = items.find(function (i) { return Number(i.row) === r; });
    return {
      row: r,
      id: item ? item.id : '',
      sector: item ? item.sector : '',
      description: item ? item.description : '',
      count: submissionCounts[r] || 0
    };
  }).filter(function (s) { return s.id; }); // drop orphans

  // ── Notifications (unread) ─────────────────────────────────────────────
  var notifData = appState.notifications || {};
  var unreadNotifs = (notifData.recent || []).filter(function (n) { return !n.readAt; });

  // Build a single ranked "Focus" queue so the first thing on My Day is
  // always the work with the most immediate operational value. This is a
  // presentation layer only: it does not change task/review state.
  var focus = [];
  reviewsOverdue.forEach(function (i) {
    focus.push({ kind: 'review', priority: 100, title: '#' + i.id + ' — ' + (i.sector || 'Review'),
      meta: truncate_(i.description || i.action || '', 90), label: 'Overdue review',
      action: '<button class="btn btn-primary btn-small" type="button" onclick="event.stopPropagation(); openRecordDetail(\'' + escAttr(i.row) + '\')">Open</button>' });
  });
  tasksOverdue.forEach(function (t) {
    focus.push({ kind: 'task', priority: 90, title: t.title || 'Task',
      meta: (t.priority || 'MEDIUM') + (t.recordRow ? ' · Record #' + t.recordRow : ''),
      label: 'Overdue · ' + formatDate(t.dueDate),
      action: '<button class="btn btn-primary btn-small" type="button" onclick="event.stopPropagation(); completeMyDayTask(\'' + escAttr(t.id) + '\')">Complete</button>' });
  });
  reviewsToday.forEach(function (i) {
    focus.push({ kind: 'review', priority: 75, title: '#' + i.id + ' — ' + (i.sector || 'Review'),
      meta: truncate_(i.description || i.action || '', 90), label: 'Review due today',
      action: '<button class="btn btn-primary btn-small" type="button" onclick="event.stopPropagation(); openRecordDetail(\'' + escAttr(i.row) + '\')">Open</button>' });
  });
  tasksToday.forEach(function (t) {
    focus.push({ kind: 'task', priority: 65, title: t.title || 'Task',
      meta: (t.priority || 'MEDIUM') + (t.recordRow ? ' · Record #' + t.recordRow : ''),
      label: 'Due today',
      action: '<button class="btn btn-primary btn-small" type="button" onclick="event.stopPropagation(); completeMyDayTask(\'' + escAttr(t.id) + '\')">Complete</button>' });
  });
  unreadSubmissions.forEach(function (s) {
    if (!appState.isEditor) return;
    focus.push({ kind: 'submission', priority: 55, title: (s.sector || 'Update') + ' — #' + s.id,
      meta: truncate_(s.description || '', 90), label: s.count + ' unread',
      action: '<button class="btn btn-primary btn-small" type="button" onclick="event.stopPropagation(); openSubmissionsModal(\'' + escAttr(s.row) + '\', \''
        + escAttr(s.id) + '\')">Review</button>' });
  });
  focus.sort(function (a, b) { return b.priority - a.priority; });

  var openTaskTotal = openTasks.length;
  var actionableTotal = reviewsDue.length + openTaskTotal + unreadSubmissions.length + unreadNotifs.length;
  var taskDoneToday = myTasks.filter(function (t) {
    return t.status === 'DONE' && t.completedAt &&
      new Date(t.completedAt).getTime() >= todayStart &&
      new Date(t.completedAt).getTime() < todayEnd;
  }).length;
  var taskProgressDenom = openTaskTotal + taskDoneToday;
  var taskProgress = taskProgressDenom ? Math.round((taskDoneToday / taskProgressDenom) * 100) : 100;

  return {
    reviewsOverdue: reviewsOverdue,
    reviewsToday: reviewsToday,
    tasksOverdue: tasksOverdue,
    tasksToday: tasksToday,
    unreadSubmissions: unreadSubmissions,
    unreadNotifs: unreadNotifs,
    focus: focus.slice(0, 8),
    stats: { openTasks: openTaskTotal, taskDoneToday: taskDoneToday, taskProgress: taskProgress, actionable: actionableTotal },
    summary: {
      reviewsDue: reviewsDue.length,
      tasksOverdue: tasksOverdue.length,
      tasksToday: tasksToday.length,
      submissions: unreadSubmissions.length,
      notifications: unreadNotifs.length
    }
  };
}

/* ---------------------------------- Rendering ---------------------------------- */

function renderMyDayContent_(panel, data) {
  var s = data.summary;
  var st = data.stats || {};
  var totalItems = s.reviewsDue + s.tasksOverdue + s.tasksToday + s.submissions + s.notifications;
  var now = new Date();
  var hour = now.getHours();
  var greeting = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');
  var dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  var focus = data.focus || [];

  var html =
    '<div class="myday-hero">' +
      '<div class="myday-hero-copy">' +
        '<div class="myday-eyebrow">' + escapeHtml(dateLabel) + '</div>' +
        '<h2 class="text-heading" id="myDayTitle">' + escapeHtml(greeting) + '</h2>' +
        '<p class="section-copy">Here is what needs your attention today.</p>' +
      '</div>' +
      '<div class="myday-hero-actions">' +
        '<button class="btn btn-secondary" type="button" onclick="renderMyDay()" title="Refresh My Day">' + svgIcon('refresh') + ' Refresh</button>' +
        '<button class="btn btn-primary" type="button" onclick="enterPresentationMode()" title="Start presentation mode">' + svgIcon('play') + ' Present</button>' +
      '</div>' +
    '</div>' +

    '<div class="myday-overview">' +
      '<div class="myday-focus-card">' +
        '<div class="myday-card-head"><div><div class="myday-card-kicker">FOCUS NEXT</div><div class="myday-card-title">' +
          (focus.length ? escapeHtml(focus[0].title) : 'You are all caught up') +
        '</div></div>' +
        '<span class="myday-focus-badge">' + (focus.length ? 'Priority' : 'Clear') + '</span></div>' +
        '<div class="myday-focus-meta">' +
          (focus.length ? escapeHtml(focus[0].meta || focus[0].label) : 'No urgent reviews, tasks, or updates are waiting.') +
        '</div>' +
        '<div class="myday-focus-footer">' +
          (focus.length ? '<span>' + escapeHtml(focus[0].label) + '</span>' + focus[0].action : '<button class="btn btn-secondary btn-small" type="button" onclick="openTab(\'dashboard\')">View dashboard</button>') +
        '</div>' +
      '</div>' +
      '<div class="myday-progress-card">' +
        '<div class="myday-card-kicker">TODAY\'S WORKLOAD</div>' +
        '<div class="myday-progress-row"><strong>' + Number(st.taskDoneToday || 0) + '</strong><span>tasks completed today</span><strong class="myday-progress-percent">' + Number(st.taskProgress || 0) + '%</strong></div>' +
        '<div class="myday-progress-track"><span style="width:' + Math.max(0, Math.min(100, Number(st.taskProgress || 0))) + '%"></span></div>' +
        '<div class="myday-progress-foot"><span>' + Number(st.openTasks || 0) + ' open tasks</span><span>' + Number(st.actionable || 0) + ' items needing attention</span></div>' +
      '</div>' +
    '</div>' +

    '<div class="section-header myday-section-head">' +
      '<div><h3 class="text-heading">Today at a glance</h3><p class="section-copy">Live counts from your dashboard, tasks and notifications.</p></div>' +
      '<div class="myday-quick-actions">' +
        '<button class="btn btn-secondary btn-small" type="button" onclick="openTab(\'tasks\')">Tasks</button>' +
        '<button class="btn btn-secondary btn-small" type="button" onclick="openTab(\'dashboard\')">Dashboard</button>' +
      '</div>' +
    '</div>' +

    '<div class="kpi-grid myday-kpis">' +
      myDayKpiCard_(svgIcon('flag'), 'Reviews due', s.reviewsDue, s.reviewsDue ? 'Needs attention' : 'Nothing pending', 'tone-warning') +
      myDayKpiCard_(svgIcon('alert'), 'Tasks overdue', s.tasksOverdue, s.tasksOverdue ? 'Past due date' : 'No overdue tasks', 'tone-danger') +
      myDayKpiCard_(svgIcon('check'), 'Tasks today', s.tasksToday, 'Due by end of day', 'tone-success') +
      myDayKpiCard_(svgIcon('inbox'), 'New submissions', s.submissions, 'Updates to review', 'tone-secondary') +
      myDayKpiCard_(svgIcon('info'), 'Notifications', s.notifications, 'Unread alerts', 'tone-info') +
    '</div>';

  if (focus.length) {
    html += '<div class="myday-focus-list">' +
      '<div class="section-header myday-section-head"><div><h3 class="text-heading">Priority queue</h3><p class="section-copy">Ordered by urgency so you can work from the top down.</p></div></div>' +
      '<div class="myday-group">' +
        '<div class="myday-group-list">' +
          focus.map(function (f, idx) {
            return myDayItemHtml_(
              '<span class="myday-rank">' + (idx + 1) + '</span>' + escapeHtml(f.title),
              escapeHtml(f.meta || ''),
              f.label,
              f.action
            );
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  if (totalItems === 0) {
    html += '<div class="empty-state myday-all-clear">' +
      '<div class="empty-state-icon">' + svgIcon('check') + '</div>' +
      '<div class="empty-state-title">All clear</div>' +
      '<div class="empty-state-subtitle">Nothing urgent needs your attention right now.</div>' +
    '</div>';
    panel.innerHTML = html;
    return;
  }

  html += '<div class="myday-details">' +
    '<div class="section-header myday-section-head"><div><h3 class="text-heading">By category</h3><p class="section-copy">Open the item directly from here.</p></div></div>' +
    '<div class="myday-priority">';

  if (data.reviewsOverdue.length) {
    html += myDayGroupHtml_('Overdue reviews', 'tone-danger', data.reviewsOverdue.map(function (i) {
      return myDayItemHtml_(
        '#' + escapeHtml(String(i.id)) + ' — ' + escapeHtml(i.sector || ''),
        truncate_(i.description || i.action || '', 80),
        'Review overdue · ' + (i.reviewDate || ''),
        '<button class="btn btn-primary btn-small" type="button" onclick="event.stopPropagation(); openRecordDetail(\'' + escAttr(i.row) + '\')">Open record</button>'
      );
    }));
  }
  if (data.tasksOverdue.length) {
    html += myDayGroupHtml_('Overdue tasks', 'tone-danger', data.tasksOverdue.map(function (t) {
      return myDayItemHtml_(
        escapeHtml(t.title || ''),
        escapeHtml(t.priority || 'MEDIUM') + (t.recordRow ? ' · Record #' + escapeHtml(String(t.recordRow)) : ''),
        'Overdue · due ' + formatDate(t.dueDate),
        '<button class="btn btn-primary btn-small" type="button" onclick="event.stopPropagation(); completeMyDayTask(\'' + escAttr(t.id) + '\')">Complete</button>'
      );
    }));
  }
  if (data.reviewsToday.length) {
    html += myDayGroupHtml_('Due today — reviews', 'tone-warning', data.reviewsToday.map(function (i) {
      return myDayItemHtml_(
        '#' + escapeHtml(String(i.id)) + ' — ' + escapeHtml(i.sector || ''),
        truncate_(i.description || i.action || '', 80),
        'Review due today',
        '<button class="btn btn-primary btn-small" type="button" onclick="event.stopPropagation(); openRecordDetail(\'' + escAttr(i.row) + '\')">Open record</button>'
      );
    }));
  }
  if (data.tasksToday.length) {
    html += myDayGroupHtml_('Due today — tasks', 'tone-warning', data.tasksToday.map(function (t) {
      return myDayItemHtml_(
        escapeHtml(t.title || ''),
        escapeHtml(t.priority || 'MEDIUM') + (t.recordRow ? ' · Record #' + escapeHtml(String(t.recordRow)) : ''),
        'Due today',
        '<button class="btn btn-primary btn-small" type="button" onclick="event.stopPropagation(); completeMyDayTask(\'' + escAttr(t.id) + '\')">Complete</button>'
      );
    }));
  }
  if (data.unreadSubmissions.length && appState.isEditor) {
    html += myDayGroupHtml_('Updates to review', 'tone-secondary', data.unreadSubmissions.map(function (s) {
      return myDayItemHtml_(
        escapeHtml(s.sector || '') + ' — #' + escapeHtml(String(s.id)),
        truncate_(s.description || '', 60),
        s.count + ' unread submission' + (s.count === 1 ? '' : 's'),
        '<button class="btn btn-primary btn-small" type="button" onclick="event.stopPropagation(); openSubmissionsModal(\'' + escAttr(s.row) + '\', \'' + escAttr(s.id) + '\')">Review</button>'
      );
    }));
  }
  if (data.unreadNotifs.length) {
    html += myDayGroupHtml_('Unread notifications', 'tone-info', data.unreadNotifs.slice(0, 10).map(function (n) {
      return myDayItemHtml_(
        escapeHtml(n.title || 'Notification'),
        escapeHtml(truncate_(n.body || '', 80)),
        formatNotifTime(n.createdAt),
        '<button class="btn btn-secondary btn-small" type="button" onclick="event.stopPropagation(); openNotification(\'' + escAttr(n.id) + '\', \'' + escAttr(n.type || 'system') + '\', \'' + escAttr(String(n.recordRow || 0)) + '\')">Open</button>'
      );
    }));
  }

  html += '</div></div>';
  panel.innerHTML = html;
}

/* ---------------------------------- Helpers ---------------------------------- */

function myDayKpiCard_(icon, label, value, subtitle, tone) {
  return '<div class="kpi-card">' +
    '<div class="kpi-top"><span class="kpi-icon ' + (tone || '') + '">' + icon + '</span></div>' +
    '<div class="kpi-label">' + escapeHtml(label) + '</div>' +
    '<div class="kpi-value">' + value + '</div>' +
    '<div class="kpi-subtitle">' + escapeHtml(subtitle) + '</div>' +
    '</div>';
}

function myDayGroupHtml_(title, tone, itemsHtml) {
  return '<div class="myday-group">' +
    '<div class="myday-group-head"><span class="badge" data-tone="' + (tone || 'muted') + '">' + escapeHtml(title) + '</span><span class="myday-group-count">' + itemsHtml.length + '</span></div>' +
    '<div class="myday-group-list">' + itemsHtml.join('') + '</div>' +
    '</div>';
}

function myDayItemHtml_(title, subtitle, dateLabel, actionHtml) {
  return '<div class="myday-item">' +
    '<div class="myday-item-body">' +
      '<div class="myday-item-title">' + title + '</div>' +
      '<div class="myday-item-meta">' + escapeHtml(subtitle) + '</div>' +
    '</div>' +
    '<div class="myday-item-date">' + escapeHtml(dateLabel) + '</div>' +
    '<div class="myday-item-actions">' + actionHtml + '</div>' +
    '</div>';
}

function truncate_(str, max) {
  str = String(str == null ? '' : str);
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

/* Complete a task from the My Day view (self-contained — does not depend on
   the Tasks tab DOM). Shows confirm, updates state, re-renders My Day. */
function completeMyDayTask(id) {
  showConfirm({
    title: 'Mark task complete',
    message: 'Mark this task as done?',
    okLabel: 'Done'
  }).then(function (confirmed) {
    if (!confirmed) return;
    showOverlay('Completing task…');
    ApiService.updateTask(id, { status: 'DONE' }).then(function () {
      hideOverlay();
      // Update local task list if loaded
      var task = (appState.tasks || []).find(function (t) { return t.id === id; });
      if (task) { task.status = 'DONE'; task.completedAt = Date.now(); }
      showToast('Task marked complete.', 'success');
      renderMyDay();
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not complete task: ' + (err.message || err), 'error');
    });
  });
}

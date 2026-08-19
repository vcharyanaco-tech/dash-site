/**
 * ============================================================
 * India Post Dashboard — Node port
 * tasks.js
 * Task management (port of Tasks.gs against the 'tasks' table).
 * ============================================================
 */

const { db } = require('./db');
const { NOTIFICATION_TYPES, TASK_STATUS, TASK_PRIORITY } = require('./config');
const { uuid_, now_, formatDate_, runWithLock_ } = require('./helpers');
const auth = require('./auth');

/* Helper: check if an assignee value is the 'All Divisional Heads' group */
function isGroupAssignee_(assignee) {
  return String(assignee || '').toLowerCase().trim() === auth.ALL_DIVISIONAL_HEADS_MARKER;
}

/* Helper: resolve an assignee value to a list of email addresses.
   Group markers are expanded to the individual emails of every member.
   Plain emails are returned as a single-element list. */
function resolveAssigneeEmails_(assignee) {
  if (isGroupAssignee_(assignee)) {
    return auth.getDivisionalHeadEmails_();
  }
  const email = String(assignee || '').toLowerCase().trim();
  return email ? [email] : [];
}

/* Helper: send notification + email to one or more recipients */
function notifyRecipients_(emails, type, title, body, mailSubject, mailBody) {
  const notify = require('./notifications');
  const { sendMail_ } = require('./mailer');
  emails.forEach(function (email) {
    try { notify.notify_(email, type, title, body, ''); } catch (err) {}
    if (mailSubject && mailBody) {
      try { sendMail_(email, mailSubject, mailBody); } catch (err) {}
    }
  });
}

function taskRecordFromRow_(row) {
  return {
    id: String(row.id || ''),
    recordRow: Number(row.record_row) || 0,
    recordId: String(row.record_id || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    assignee: String(row.assignee || '').toLowerCase(),
    status: String(row.status || TASK_STATUS.OPEN),
    priority: String(row.priority || TASK_PRIORITY.MEDIUM),
    dueDate: row.due_date ? Number(row.due_date) : 0,
    createdBy: String(row.created_by || '').toLowerCase(),
    createdAt: row.created_at ? Number(row.created_at) : 0,
    updatedAt: row.updated_at ? Number(row.updated_at) : 0,
    completedAt: row.completed_at ? Number(row.completed_at) : 0
  };
}

function findTask_(id) {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(String(id));
  return row ? taskRecordFromRow_(row) : null;
}

function createTask(params, token) {
  const user = auth.requireEditor(token);
  params = params || {};
  const title = String(params.title || '').trim();
  if (!title) throw new Error('Task title required.');
  const recordRow = Number(params.recordRow) || 0;
  const assignee = String(params.assignee || '').toLowerCase().trim();
  const priority = String(params.priority || TASK_PRIORITY.MEDIUM).toUpperCase();
  const dueDate = params.dueDate ? new Date(params.dueDate) : null;
  if ([TASK_PRIORITY.LOW, TASK_PRIORITY.MEDIUM, TASK_PRIORITY.HIGH, TASK_PRIORITY.URGENT].indexOf(priority) === -1) {
    throw new Error('Invalid priority.');
  }

  return runWithLock_(function () {
    const id = uuid_();
    const now = Date.now();
    db.prepare(
      'INSERT INTO tasks (id, record_row, record_id, title, description, assignee, status, priority, due_date, created_by, created_at, updated_at, completed_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      recordRow,
      String(params.recordId || ''),
      title,
      String(params.description || ''),
      assignee,
      TASK_STATUS.OPEN,
      priority,
      dueDate ? dueDate.getTime() : null,
      user.email,
      now,
      now,
      null
    );

    const recipientEmails = resolveAssigneeEmails_(assignee);
    const dueDateStr = dueDate ? ' (due ' + formatDate_(dueDate, 'dd.MM.yyyy') + ')' : '';
    const isGroup = isGroupAssignee_(assignee);
    const notifyTitle = 'Task assigned';
    const notifyBody = 'You were assigned: ' + title + dueDateStr;
    const mailSubject = '[India Post Dashboard] New task assigned: ' + title;
    const mailBody = 'Hello,\n\n' +
      'A new task has been assigned to you on the India Post Dashboard.\n\n' +
      'Task: ' + title + '\n' +
      (String(params.description || '').trim() ? 'Description: ' + String(params.description || '').trim() + '\n' : '') +
      'Priority: ' + priority + '\n' +
      (dueDate ? 'Due date: ' + formatDate_(dueDate, 'dd.MM.yyyy') + '\n' : '') +
      'Assigned by: ' + user.email + '\n\n' +
      'Please log in to the dashboard to view and update this task.\n\n' +
      '- India Post Dashboard, Circle Office Haryana';

    notifyRecipients_(recipientEmails.length ? recipientEmails : [user.email],
      NOTIFICATION_TYPES.USER, notifyTitle, notifyBody, mailSubject, mailBody);
    if (isGroup && !recipientEmails.length) {
      console.error('All Divisional Heads group: no do_* users found for notification.');
    }

    return {
      id: id,
      recordRow: recordRow,
      recordId: String(params.recordId || ''),
      title: title,
      description: String(params.description || ''),
      assignee: assignee,
      status: TASK_STATUS.OPEN,
      priority: priority,
      dueDate: dueDate ? dueDate.getTime() : 0,
      createdBy: user.email,
      createdAt: now,
      updatedAt: now,
      completedAt: 0
    };
  });
}

function updateTask(id, fields, token) {
  const user = auth.requireLogin(token);
  id = String(id || '').trim();
  if (!id) throw new Error('Task id required.');

  return runWithLock_(function () {
    const existing = findTask_(id);
    if (!existing) throw new Error('Task not found.');

    const isAssignee = existing.assignee === user.email;
    const isEditorRole = auth.isEditor(user.email);

    if (!isEditorRole && !isAssignee) throw new Error('Permission denied.');

    fields = fields || {};
    const updates = {};
    if ('title' in fields) updates.title = String(fields.title || '').trim();
    if ('description' in fields) updates.description = String(fields.description || '');
    if ('assignee' in fields) {
      if (!isEditorRole) throw new Error('Only editors can reassign tasks.');
      updates.assignee = String(fields.assignee || '').toLowerCase().trim();
    }
    if ('status' in fields) {
      const status = String(fields.status).toUpperCase();
      if (Object.keys(TASK_STATUS).map(function (k) { return TASK_STATUS[k]; }).indexOf(status) === -1) throw new Error('Invalid status.');
      updates.status = status;
    }
    if ('priority' in fields) {
      const priority = String(fields.priority).toUpperCase();
      if (Object.keys(TASK_PRIORITY).map(function (k) { return TASK_PRIORITY[k]; }).indexOf(priority) === -1) throw new Error('Invalid priority.');
      updates.priority = priority;
    }
    if ('dueDate' in fields) {
      updates.dueDate = fields.dueDate ? new Date(fields.dueDate).getTime() : null;
    }

    const now = Date.now();
    const completedAt = (updates.status === TASK_STATUS.DONE && existing.status !== TASK_STATUS.DONE) ? now : existing.completedAt;

    db.prepare(
      'UPDATE tasks SET title = ?, description = ?, assignee = ?, status = ?, priority = ?, due_date = ?, updated_at = ?, completed_at = ? WHERE id = ?'
    ).run(
      updates.title !== undefined ? updates.title : existing.title,
      updates.description !== undefined ? updates.description : existing.description,
      updates.assignee !== undefined ? updates.assignee : existing.assignee,
      updates.status !== undefined ? updates.status : existing.status,
      updates.priority !== undefined ? updates.priority : existing.priority,
      updates.dueDate !== undefined ? updates.dueDate : existing.dueDate,
      now,
      completedAt,
      id
    );

    const fresh = findTask_(id);

    if (updates.assignee && updates.assignee !== existing.assignee) {
      const taskTitle = updates.title || existing.title;
      const reassignEmails = resolveAssigneeEmails_(updates.assignee);
      const reassignNotifyBody = 'Task "' + taskTitle + '" was reassigned to you.';
      const reassignMailSubject = '[India Post Dashboard] Task reassigned to you: ' + taskTitle;
      const reassignMailBody = 'Hello,\n\nThe task "' + taskTitle + '" has been reassigned to you by ' + user.email + '.\n\nPlease log in to the dashboard to view and update this task.\n\n- India Post Dashboard, Circle Office Haryana';
      notifyRecipients_(reassignEmails, NOTIFICATION_TYPES.USER, 'Task reassigned', reassignNotifyBody, reassignMailSubject, reassignMailBody);
    }
    if (updates.status && updates.status !== existing.status) {
      // For status-change notifications, resolve the existing assignee (which
      // may be a group marker) so every member learns about the change.
      const statusEmails = resolveAssigneeEmails_(existing.assignee);
      const statusBody = 'Task "' + existing.title + '" is now ' + updates.status + '.';
      notifyRecipients_(statusEmails, NOTIFICATION_TYPES.USER, 'Task status changed', statusBody, '', '');

      if (updates.status === TASK_STATUS.DONE && existing.assignee) {
        const completedBy = existing.createdBy || existing.assignee;
        const completionEmails = resolveAssigneeEmails_(completedBy);
        const completionMailSubject = '[India Post Dashboard] Task completed: ' + existing.title;
        const completionMailBody = 'Hello,\n\nThe task "' + existing.title + '" assigned to ' + existing.assignee + ' has been marked as completed.\n\n- India Post Dashboard, Circle Office Haryana';
        notifyRecipients_(completionEmails.length ? completionEmails : [existing.createdBy],
          NOTIFICATION_TYPES.USER, 'Task completed', 'Task "' + existing.title + '" has been completed.', completionMailSubject, completionMailBody);
      }
    }

    return fresh;
  });
}

function getTasks(filters, token) {
  const caller = auth.requireLogin(token);
  filters = filters || {};
  const rows = db.prepare('SELECT * FROM tasks').all().map(taskRecordFromRow_);
  const out = [];
  rows.forEach(function (rec) {
    if (filters.assignee) {
      const filterEmail = String(filters.assignee).toLowerCase();
      if (isGroupAssignee_(rec.assignee)) {
        // Tasks assigned to 'All Divisional Heads' match any do_* user
        const callerUser = auth.findUserRecord_(caller.email);
        if (!callerUser || !auth.isDivisionalHeadUser_(callerUser)) return;
      } else if (rec.assignee !== filterEmail) {
        return;
      }
    }
    if (filters.status && rec.status !== String(filters.status).toUpperCase()) return;
    if (filters.recordRow && rec.recordRow !== Number(filters.recordRow)) return;
    if (filters.recordId && rec.recordId !== String(filters.recordId)) return;
    out.push(rec);
  });
  out.sort(function (a, b) {
    const statusOrder = { OPEN: 0, IN_PROGRESS: 1, DONE: 2, CANCELLED: 3 };
    const sa = statusOrder[a.status] !== undefined ? statusOrder[a.status] : 99;
    const sb = statusOrder[b.status] !== undefined ? statusOrder[b.status] : 99;
    if (sa !== sb) return sa - sb;
    if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.createdAt - a.createdAt;
  });
  return out;
}

function deleteTask(id, token) {
  auth.requireEditor(token);
  id = String(id || '').trim();
  if (!id) throw new Error('Task id required.');

  return runWithLock_(function () {
    const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return info.changes > 0;
  });
}

function getMyTasks(token) {
  const user = auth.requireLogin(token);
  return getTasks({ assignee: user.email }, token);
}

/* Returns homepage KPI task counts: tasks still open (not DONE/CANCELLED)
   and tasks whose due date falls on the current calendar day. */
function getTaskCounts(token) {
  auth.requireLogin(token);
  const rows = db.prepare('SELECT status, due_date FROM tasks').all();
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  let openTasks = 0;
  let dueToday = 0;
  rows.forEach(function (row) {
    const status = String(row.status || TASK_STATUS.OPEN);
    if (status === TASK_STATUS.DONE || status === TASK_STATUS.CANCELLED) return;
    openTasks++;
    const due = row.due_date ? Number(row.due_date) : 0;
    if (due >= dayStart && due < dayEnd) dueToday++;
  });
  return { openTasks: openTasks, dueToday: dueToday };
}

module.exports = {
  createTask,
  updateTask,
  getTasks,
  deleteTask,
  getMyTasks,
  getTaskCounts
};

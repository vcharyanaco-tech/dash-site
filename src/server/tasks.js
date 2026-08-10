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

    const recipientEmail = assignee || user.email;
    const dueDateStr = dueDate ? ' (due ' + formatDate_(dueDate, 'dd.MM.yyyy') + ')' : '';

    try {
      require('./notifications').notify_(recipientEmail, NOTIFICATION_TYPES.USER, 'Task assigned', 'You were assigned: ' + title + dueDateStr, '');
    } catch (err) {}

    try {
      if (recipientEmail) {
        const subject = '[India Post Dashboard] New task assigned: ' + title;
        const body = 'Hello,\n\n' +
          'A new task has been assigned to you on the India Post Dashboard.\n\n' +
          'Task: ' + title + '\n' +
          (String(params.description || '').trim() ? 'Description: ' + String(params.description || '').trim() + '\n' : '') +
          'Priority: ' + priority + '\n' +
          (dueDate ? 'Due date: ' + formatDate_(dueDate, 'dd.MM.yyyy') + '\n' : '') +
          'Assigned by: ' + user.email + '\n\n' +
          'Please log in to the dashboard to view and update this task.\n\n' +
          '- India Post Dashboard, Circle Office Haryana';
        require('./mailer').sendMail_(recipientEmail, subject, body);
      }
    } catch (emailErr) {
      console.error('Task assignment email failed: ' + emailErr.message);
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
      try { require('./notifications').notify_(updates.assignee, NOTIFICATION_TYPES.USER, 'Task reassigned', 'Task "' + taskTitle + '" was reassigned to you.', ''); } catch (err) {}
      try {
        require('./mailer').sendMail_(
          updates.assignee,
          '[India Post Dashboard] Task reassigned to you: ' + taskTitle,
          'Hello,\n\nThe task "' + taskTitle + '" has been reassigned to you by ' + user.email + '.\n\nPlease log in to the dashboard to view and update this task.\n\n- India Post Dashboard, Circle Office Haryana'
        );
      } catch (emailErr) { console.error('Reassign email failed: ' + emailErr.message); }
    }
    if (updates.status && updates.status !== existing.status) {
      try { require('./notifications').notify_(existing.assignee, NOTIFICATION_TYPES.USER, 'Task status changed', 'Task "' + existing.title + '" is now ' + updates.status + '.', ''); } catch (err) {}
      if (updates.status === TASK_STATUS.DONE && existing.assignee) {
        try {
          require('./mailer').sendMail_(
            existing.createdBy || existing.assignee,
            '[India Post Dashboard] Task completed: ' + existing.title,
            'Hello,\n\nThe task "' + existing.title + '" assigned to ' + existing.assignee + ' has been marked as completed.\n\n- India Post Dashboard, Circle Office Haryana'
          );
        } catch (emailErr) { console.error('Completion email failed: ' + emailErr.message); }
      }
    }

    return fresh;
  });
}

function getTasks(filters, token) {
  auth.requireLogin(token);
  filters = filters || {};
  const rows = db.prepare('SELECT * FROM tasks').all().map(taskRecordFromRow_);
  const out = [];
  rows.forEach(function (rec) {
    if (filters.assignee && rec.assignee !== String(filters.assignee).toLowerCase()) return;
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

module.exports = {
  createTask,
  updateTask,
  getTasks,
  deleteTask,
  getMyTasks
};

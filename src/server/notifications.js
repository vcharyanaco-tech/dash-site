/**
 * ============================================================
 * India Post Dashboard — Node port
 * notifications.js
 * In-app notification center (port of Notifications.gs).
 * ============================================================
 */

const { db } = require('./db');
const { CONFIG, ROLES, NOTIFICATION_TYPES, NOTIFICATION_RECENT_LIMIT, ADMIN_USERS } = require('./config');
const { primaryEmail_, isValidEmail_, uuid_, now_, runWithLock_ } = require('./helpers');

const auth = require('./auth');

function notificationRecordFromRow_(row) {
  return {
    id: String(row.id || ''),
    email: String(row.email || '').toLowerCase(),
    type: String(row.type || NOTIFICATION_TYPES.SYSTEM),
    title: String(row.title || ''),
    body: String(row.body || ''),
    link: String(row.link || ''),
    createdAt: row.created_at ? Number(row.created_at) : 0,
    readAt: row.read_at ? Number(row.read_at) : 0
  };
}

function appendNotification_(email, type, title, body, link) {
  email = primaryEmail_(email);
  if (!isValidEmail_(email)) return;
  const id = uuid_();
  db.prepare(
    'INSERT INTO notifications (id, email, type, title, body, link, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, email, String(type || NOTIFICATION_TYPES.SYSTEM), String(title || ''), String(body || ''), String(link || ''), Date.now(), null);
  pruneNotifications_(email);
}

function notify_(email, type, title, body, link) {
  return runWithLock_(function () {
    appendNotification_(email, type, title, body, link);
  });
}

function pruneNotifications_(email) {
  const rows = db.prepare('SELECT id, created_at FROM notifications WHERE email = ?').all(email);
  if (rows.length <= CONFIG.NOTIFICATIONS.MAX_PER_USER) return;
  rows.sort(function (a, b) { return (Number(b.created_at) || 0) - (Number(a.created_at) || 0); });
  const keep = {};
  rows.slice(0, CONFIG.NOTIFICATIONS.MAX_PER_USER).forEach(function (r) { keep[r.id] = true; });
  const drop = rows.filter(function (r) { return !keep[r.id]; }).map(function (r) { return r.id; });
  drop.forEach(function (id) {
    db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
  });
}

function staffRecipients_(excludeEmail) {
  excludeEmail = primaryEmail_(excludeEmail);
  const recipients = {};
  auth.listUserRecords().forEach(function (u) {
    const email = String(u.primaryEmail || '').toLowerCase().trim();
    if (!email || email === excludeEmail) return;
    if (u.role === ROLES.ADMIN || u.role === ROLES.EDITOR) recipients[email] = true;
    const groups = String(u.group || '').split(',').map(function (g) { return g.trim().toUpperCase(); });
    if (groups.indexOf('APPROVER') !== -1) recipients[email] = true;
  });
  ADMIN_USERS.forEach(function (email) {
    email = String(email).toLowerCase().trim();
    if (email && email !== excludeEmail) recipients[email] = true;
  });
  return Object.keys(recipients);
}

function notifyStaff_(type, title, body, link, excludeEmail) {
  staffRecipients_(excludeEmail).forEach(function (email) {
    appendNotification_(email, type, title, body, link);
  });
}

function notifyStaffLocked_(type, title, body, link, excludeEmail) {
  notifyStaff_(type, title, body, link, excludeEmail);
}

function getMyNotifications(token) {
  const user = auth.requireLogin(token);
  const rows = db.prepare('SELECT * FROM notifications WHERE email = ?').all(user.email);
  const all = rows.map(notificationRecordFromRow_);
  all.sort(function (a, b) { return b.createdAt - a.createdAt; });
  let unread = 0;
  for (let i = 0; i < all.length; i++) if (!all[i].readAt) unread++;
  return {
    unread: unread,
    recent: all.slice(0, NOTIFICATION_RECENT_LIMIT),
    count: all.length
  };
}

function markNotificationsRead(ids, token) {
  const user = auth.requireLogin(token);
  const idList = Array.isArray(ids) ? ids : [ids];
  const wantAll = idList.indexOf('all') !== -1;
  const idSet = {};
  idList.forEach(function (id) { idSet[String(id)] = true; });

  const rows = db.prepare('SELECT * FROM notifications WHERE email = ?').all(user.email);
  rows.forEach(function (r) {
    if (r.read_at) return;
    if (wantAll || idSet[String(r.id)]) {
      db.prepare('UPDATE notifications SET read_at = ? WHERE id = ?').run(Date.now(), r.id);
    }
  });
  return getMyNotifications(token);
}

function clearMyNotifications(token) {
  const user = auth.requireLogin(token);
  db.prepare('DELETE FROM notifications WHERE email = ?').run(user.email);
  return getMyNotifications(token);
}

module.exports = {
  appendNotification_,
  notify_,
  notifyStaff_,
  notifyStaffLocked_,
  getMyNotifications,
  markNotificationsRead,
  clearMyNotifications
};

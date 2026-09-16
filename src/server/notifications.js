/**
 * ============================================================
 * India Post Dashboard — Node port
 * notifications.js
 * In-app notification center (port of Notifications.gs).
 * ============================================================
 */

const { db } = require('./db');
const { CONFIG, ROLES, NOTIFICATION_TYPES, NOTIFICATION_RECENT_LIMIT, ADMIN_USERS, NOTIFICATION_LOCALIZED_TYPES, NOTIFICATION_PRIORITY } = require('./config');
const { primaryEmail_, isValidEmail_, uuid_, now_, runWithLock_ } = require('./helpers');
const settings = require('./settings');

const auth = require('./auth');

const NOTIFICATION_PREFS_DEFAULT = Object.freeze({
  record: true,
  submission: true,
  user: true,
  system: true,
  push: true
});

function notificationRecordFromRow_(row) {
  return {
    id: String(row.id || ''),
    email: String(row.email || '').toLowerCase(),
    type: String(row.type || NOTIFICATION_TYPES.SYSTEM),
    title: String(row.title || ''),
    body: String(row.body || ''),
    link: String(row.link || ''),
    createdAt: row.created_at ? Number(row.created_at) : 0,
    readAt: row.read_at ? Number(row.read_at) : 0,
    priority: row.priority !== undefined && row.priority !== null ? Number(row.priority) : NOTIFICATION_PRIORITY.NORMAL,
    recordRow: row.record_row !== undefined && row.record_row !== null ? Number(row.record_row) : 0
  };
}

function prefsKey_(email) {
  return 'notif_prefs_' + primaryEmail_(email).toLowerCase();
}

function getPrefs_(email) {
  const row = settings.get(prefsKey_(email));
  let parsed = {};
  if (row) {
    try { parsed = JSON.parse(String(row.value)); } catch (err) { parsed = {}; }
  }
  const merged = {};
  Object.keys(NOTIFICATION_PREFS_DEFAULT).forEach(function (k) {
    merged[k] = parsed[k] === undefined ? NOTIFICATION_PREFS_DEFAULT[k] : !!parsed[k];
  });
  return merged;
}

function setPrefs_(email, prefs) {
  const clean = getPrefs_(email);
  if (prefs && typeof prefs === 'object') {
    Object.keys(clean).forEach(function (k) {
      if (typeof prefs[k] === 'boolean') clean[k] = prefs[k];
    });
  }
  settings.set(prefsKey_(email), JSON.stringify(clean));
  return clean;
}

function allowTypeFor_(email, type) {
  const prefs = getPrefs_(email);
  return prefs[String(type || 'system')] !== false;
}

/**
 * Send a notification with full Part-9 metadata.
 * opts: { priority, recordRow, dedupeKey, dedupeTtlSeconds }
 */
function appendNotification_(email, type, title, body, link, opts) {
  email = primaryEmail_(email);
  if (!isValidEmail_(email)) return;
  if (!allowTypeFor_(email, type)) return;

  opts = opts || {};
  const dedupeKey = opts.dedupeKey;
  if (dedupeKey) {
    const key = 'ntf_' + dedupeKey;
    if (require('./db').cacheGetTTL(key)) return;
    const ttl = opts.dedupeTtlSeconds || 21600;
    require('./db').cachePut(key, '1', ttl);
  }

  const id = uuid_();
  db.prepare(
    'INSERT INTO notifications (id, email, type, title, body, link, created_at, read_at, priority, record_row) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    email,
    String(type || NOTIFICATION_TYPES.SYSTEM),
    String(title || ''),
    String(body || ''),
    String(link || ''),
    Date.now(),
    null,
    opts.priority !== undefined && opts.priority !== null ? Number(opts.priority) : NOTIFICATION_PRIORITY.NORMAL,
    opts.recordRow !== undefined && opts.recordRow !== null ? Number(opts.recordRow) : 0
  );
  pruneNotifications_(email);
}

function notify_(email, type, title, body, link, opts) {
  return runWithLock_(function () {
    appendNotification_(email, type, title, body, link, opts);
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
    // Divisional heads (do_*) receive record notifications regardless of
    // role so they stay aware of cards assigned to 'All Divisional Heads'.
    const username = String((u.username || '')).trim().toLowerCase();
    if (username.indexOf('do_') === 0) recipients[email] = true;
  });
  ADMIN_USERS.forEach(function (email) {
    email = String(email).toLowerCase().trim();
    if (email && email !== excludeEmail) recipients[email] = true;
  });
  return Object.keys(recipients);
}

function notifyStaff_(type, title, body, link, excludeEmail, opts) {
  staffRecipients_(excludeEmail).forEach(function (email) {
    appendNotification_(email, type, title, body, link, opts);
  });
}

function notifyStaffLocked_(type, title, body, link, excludeEmail, opts) {
  notifyStaff_(type, title, body, link, excludeEmail, opts);
}

function getMyNotifications(token) {
  const user = auth.requireLogin(token);
  const rows = db.prepare('SELECT * FROM notifications WHERE email = ?').all(user.email);
  const all = rows.map(notificationRecordFromRow_);
  all.sort(function (a, b) { return b.createdAt - a.createdAt; });
  let unread = 0;
  const byTypeUnread = {};
  const byTypeCount = {};
  for (let i = 0; i < all.length; i++) {
    const n = all[i];
    if (!n.readAt) {
      unread++;
      byTypeUnread[n.type] = (byTypeUnread[n.type] || 0) + 1;
    }
    byTypeCount[n.type] = (byTypeCount[n.type] || 0) + 1;
  }
  return {
    unread: unread,
    recent: all.slice(0, NOTIFICATION_RECENT_LIMIT),
    count: all.length,
    history: all,
    byTypeUnread: byTypeUnread,
    byTypeCount: byTypeCount,
    prefs: getPrefs_(user.email)
  };
}

function markNotificationsRead(ids, token) {
  const user = auth.requireLogin(token);
  const idList = Array.isArray(ids) ? ids : [ids];
  const wantAll = idList.indexOf('all') !== -1;
  const typeFilters = idList.filter(function (id) {
    return typeof id === 'string' && id !== 'all' && NOTIFICATION_LOCALIZED_TYPES[id];
  });
  const idSet = {};
  idList.forEach(function (id) {
    if (typeof id !== 'object' && !NOTIFICATION_LOCALIZED_TYPES[id] && String(id) !== 'all') idSet[String(id)] = true;
  });

  const rows = db.prepare('SELECT * FROM notifications WHERE email = ?').all(user.email);
  rows.forEach(function (r) {
    if (r.read_at) return;
    if (wantAll) {
      db.prepare('UPDATE notifications SET read_at = ? WHERE id = ?').run(Date.now(), r.id);
    } else if (typeFilters.length) {
      if (typeFilters.indexOf(String(r.type)) !== -1) {
        db.prepare('UPDATE notifications SET read_at = ? WHERE id = ?').run(Date.now(), r.id);
      }
    } else if (idSet[String(r.id)]) {
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

function getNotificationPrefs(token) {
  const user = auth.requireLogin(token);
  return { prefs: getPrefs_(user.email) };
}

function setNotificationPrefs(prefs, token) {
  const user = auth.requireLogin(token);
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
    throw new Error('prefs must be an object');
  }
  const clean = setPrefs_(user.email, prefs);
  return { prefs: clean };
}

module.exports = {
  appendNotification_,
  notify_,
  notifyStaff_,
  notifyStaffLocked_,
  getMyNotifications,
  markNotificationsRead,
  clearMyNotifications,
  getNotificationPrefs,
  setNotificationPrefs,
  allowTypeFor_,
  getPrefs_
};

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
const events = require('./events');

const NOTIFICATION_PREFS_DEFAULT = Object.freeze({
  record: true,
  submission: true,
  user: true,
  system: true,
  push: true,
  digest: true,
  digestHour: 8
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
    recordRow: row.record_row !== undefined && row.record_row !== null ? Number(row.record_row) : 0,
    snoozedUntil: row.snoozed_until ? Number(row.snoozed_until) : 0,
    dismissedAt: row.dismissed_at ? Number(row.dismissed_at) : 0,
    groupKey: String(row.group_key || '')
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
    'INSERT INTO notifications (id, email, type, title, body, link, created_at, read_at, priority, record_row, snoozed_until, dismissed_at, group_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
    opts.recordRow !== undefined && opts.recordRow !== null ? Number(opts.recordRow) : 0,
    0, 0, String(opts.groupKey || '')
  );
  pruneNotifications_(email);
  try { events.broadcast('notificationChanged', { id: id, type: String(type || 'system') }); } catch (e) {}
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
  const all = rows.map(notificationRecordFromRow_).filter(function (n) { return !n.dismissedAt; });
  all.sort(function (a, b) { return b.createdAt - a.createdAt; });
  const now = Date.now();
  const active = all.filter(function (n) { return !n.snoozedUntil || n.snoozedUntil <= now; });
  let unread = 0;
  const byTypeUnread = {};
  const byTypeCount = {};
  for (let i = 0; i < active.length; i++) {
    const n = active[i];
    if (!n.readAt) { unread++; byTypeUnread[n.type] = (byTypeUnread[n.type] || 0) + 1; }
    byTypeCount[n.type] = (byTypeCount[n.type] || 0) + 1;
  }
  return {
    unread: unread,
    recent: active.slice(0, NOTIFICATION_RECENT_LIMIT),
    count: active.length,
    history: active,
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
  const result = getMyNotifications(token);
  try { events.broadcast('notificationChanged', { action: 'read' }); } catch (e) {}
  return result;
}

function clearMyNotifications(token) {
  const user = auth.requireLogin(token);
  db.prepare('DELETE FROM notifications WHERE email = ?').run(user.email);
  try { events.broadcast('notificationChanged', { action: 'clear' }); } catch (e) {}
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

function updateNotificationState(id, state, token) {
  const user = auth.requireLogin(token); id=String(id||''); state=state||{};
  const row=db.prepare('SELECT id FROM notifications WHERE id=? AND email=?').get(id,user.email); if(!row) throw new Error('Notification not found.');
  if(state.read===true) db.prepare('UPDATE notifications SET read_at=? WHERE id=?').run(Date.now(),id);
  if(state.read===false) db.prepare('UPDATE notifications SET read_at=NULL WHERE id=?').run(id);
  if(state.dismiss===true) db.prepare('UPDATE notifications SET dismissed_at=? WHERE id=?').run(Date.now(),id);
  if(state.dismiss===false) db.prepare('UPDATE notifications SET dismissed_at=0 WHERE id=?').run(id);
  if(state.snoozeUntil!==undefined) db.prepare('UPDATE notifications SET snoozed_until=? WHERE id=?').run(Math.max(0,Number(state.snoozeUntil)||0),id);
  try { events.broadcast('notificationChanged', { id: id, action: 'state' }); } catch (e) {}
  return getMyNotifications(token);
}
function snoozeNotification(id, minutes, token){return updateNotificationState(id,{snoozeUntil:Date.now()+Math.max(1,Math.min(7*24*60,Number(minutes)||60))*60000},token);}
function dismissNotification(id, token){return updateNotificationState(id,{dismiss:true},token);}
function restoreNotification(id, token){return updateNotificationState(id,{dismiss:false,snoozeUntil:0},token);}
function getNotificationDigest(token){
  const user=auth.requireLogin(token); const prefs=getPrefs_(user.email); const rows=db.prepare('SELECT type,priority,title,body,created_at FROM notifications WHERE email=? AND created_at>=? AND (dismissed_at IS NULL OR dismissed_at=0) ORDER BY created_at DESC').all(user.email,Date.now()-86400000);
  const groups={}; rows.forEach(r=>{const k=String(r.type||'system');if(!groups[k])groups[k]={type:k,count:0,high:0,items:[]};groups[k].count++;if(Number(r.priority)>=1)groups[k].high++;if(groups[k].items.length<5)groups[k].items.push({title:r.title,body:r.body,createdAt:Number(r.created_at)||0,priority:Number(r.priority)||0});});
  return {enabled:prefs.digest!==false,prefs,periodHours:24,total:rows.length,groups:Object.keys(groups).map(k=>groups[k])};
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
  updateNotificationState,
  snoozeNotification,
  dismissNotification,
  restoreNotification,
  getNotificationDigest,
  allowTypeFor_,
  getPrefs_
};

/**
 * ============================================================
 * India Post Dashboard — Node port
 * auth.js
 * Password-based authentication, sessions and user management
 * (port of Auth.gs against the 'users' table).
 * ============================================================
 */

const { db, createSession_, sessionEmail_, destroySession_, destroySessionsForEmail_, cacheGetTTL, cachePut, cacheRemove } = require('./db');
const {
  CONFIG,
  ROLES,
  PERMISSIONS,
  USER_GROUPS,
  USER_GROUP_KEYS,
  ADMIN_USERS,
  EDITOR_USERS,
  VIEWER_USERS,
  DEFAULT_ADMIN_PASSWORD
} = require('./config');
const {
  isValidEmail_,
  emailList_,
  primaryEmail_,
  emailsOverlap_,
  emailsMatch_,
  isValidEmailList_,
  isValidUsername_,
  validatePassword_,
  hashPassword_,
  generateSalt_,
  safeCacheKey_,
  uuid_,
  now_,
  runWithLock_
} = require('./helpers');

/* ============================================================
 * Helpers
 * ============================================================ */

function isBootstrapAdmin_(email) {
  const list = emailList_(email);
  for (let i = 0; i < list.length; i++) {
    if (ADMIN_USERS.indexOf(list[i]) !== -1) return true;
  }
  return false;
}

function getCurrentUser() {
  return '';
}

/* ============================================================
 * User Store (users table)
 * ============================================================ */

const USER_FIELDS = [
  'id', 'email', 'role', 'salt', 'password_hash', 'must_change', 'created_by',
  'created_at', 'reset_token', 'reset_expires', 'group_name', 'department',
  'office', 'preferences', 'reset_requested', 'username'
];

function userRecordFromRow_(row) {
  return {
    role: row.role || ROLES.VIEWER,
    salt: row.salt || '',
    passwordHash: row.password_hash || '',
    mustChange: !!row.must_change,
    createdBy: row.created_by || '',
    createdAt: row.created_at,
    resetToken: row.reset_token || '',
    resetExpires: row.reset_expires || null,
    group: row.group_name || '',
    department: row.department || '',
    office: row.office || '',
    preferences: row.preferences || '',
    resetRequested: row.reset_requested ? String(row.reset_requested) : '',
    username: row.username ? String(row.username) : ''
  };
}

function findUserRecord_(email) {
  if (!emailList_(email).length) return null;
  const rows = db.prepare('SELECT * FROM users').all();
  for (let i = 0; i < rows.length; i++) {
    if (emailsMatch_(rows[i].email, email)) {
      const rec = userRecordFromRow_(rows[i]);
      rec.id = rows[i].id;
      rec.rawEmail = String(rows[i].email || '').trim();
      rec.email = primaryEmail_(rows[i].email);
      return rec;
    }
  }
  return null;
}

function findUserRecord(email) {
  return findUserRecord_(email);
}

function findUserByUsername_(username) {
  username = String(username || '').toLowerCase().trim();
  if (!username) return null;
  const rows = db.prepare('SELECT * FROM users').all();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i].username || '').toLowerCase().trim() === username) {
      const rec = userRecordFromRow_(rows[i]);
      rec.id = rows[i].id;
      rec.rawEmail = String(rows[i].email || '').trim();
      rec.email = primaryEmail_(rows[i].email);
      return rec;
    }
  }
  return null;
}

function resolveUserByIdentifier_(identifier) {
  identifier = String(identifier || '').toLowerCase().trim();
  if (!identifier) return null;
  const rows = db.prepare('SELECT * FROM users').all();
  for (let i = 0; i < rows.length; i++) {
    const rowUsername = String(rows[i].username || '').toLowerCase().trim();
    if (emailsMatch_(rows[i].email, identifier) || (rowUsername && rowUsername === identifier)) {
      const rec = userRecordFromRow_(rows[i]);
      rec.id = rows[i].id;
      rec.rawEmail = String(rows[i].email || '').trim();
      rec.email = primaryEmail_(rows[i].email);
      return rec;
    }
  }
  return null;
}

const FIELD_COL = {
  email: 'email',
  role: 'role',
  salt: 'salt',
  passwordHash: 'password_hash',
  mustChange: 'must_change',
  createdBy: 'created_by',
  createdAt: 'created_at',
  resetToken: 'reset_token',
  resetExpires: 'reset_expires',
  group: 'group_name',
  department: 'department',
  office: 'office',
  resetRequested: 'reset_requested',
  username: 'username',
  preferences: 'preferences'
};

function setUserField_(email, field, value) {
  const rec = findUserRecord_(email);
  if (!rec) return;
  const col = FIELD_COL[field];
  if (!col) return;
  let bound = value;
  if (typeof bound === 'boolean') bound = bound ? 1 : 0;
  if (bound !== null && bound !== undefined && typeof bound !== 'number' && typeof bound !== 'string') {
    bound = String(bound);
  }
  db.prepare('UPDATE users SET ' + col + ' = ? WHERE id = ?').run(bound, rec.id);
}

function setUserField(email, field, value) {
  setUserField_(email, field, value);
}

function addUserRecord_(email, role, salt, passwordHash, createdBy, group, department, office, username) {
  db.prepare(
    'INSERT INTO users (email, role, salt, password_hash, must_change, created_by, created_at, reset_token, reset_expires, group_name, department, office, preferences, reset_requested, username) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    email, role, salt, passwordHash, 0, createdBy || '', Date.now(), '',
    null, group || '', department || '', office || '', '', '', username || ''
  );
}

function addUserRecord(email, role, salt, passwordHash, createdBy, group, department, office, username) {
  addUserRecord_(email, role, salt, passwordHash, createdBy, group, department, office, username);
}

function deleteUserRecord_(email) {
  const rec = findUserRecord_(email);
  if (!rec) return false;
  db.prepare('DELETE FROM users WHERE id = ?').run(rec.id);
  return true;
}

function renameUserEmail_(oldEmail, newEmail) {
  oldEmail = String(oldEmail || '').toLowerCase().trim();
  newEmail = String(newEmail || '').toLowerCase().trim();
  if (!oldEmail || !newEmail) return;

  const oldList = emailList_(oldEmail);
  const newPrimary = primaryEmail_(newEmail);
  const matches = function (value) {
    return emailList_(value).some(function (e) { return oldList.indexOf(e) !== -1; });
  };

  const replaceColumn = function (table, column) {
    const rows = db.prepare('SELECT id, ' + column + ' AS v FROM ' + table).all();
    rows.forEach(function (r) {
      if (r.v !== null && r.v !== undefined && matches(r.v)) {
        db.prepare('UPDATE ' + table + ' SET ' + column + ' = ? WHERE id = ?').run(newPrimary, r.id);
      }
    });
  };

  replaceColumn('submissions', 'email');
  replaceColumn('submissions', 'locked_by');
  replaceColumn('tasks', 'assignee');
  replaceColumn('tasks', 'created_by');
  replaceColumn('notifications', 'email');
  replaceColumn('approvals', 'submitted_by');
  replaceColumn('approvals', 'reviewed_by');

  const users = db.prepare('SELECT id, email FROM users').all();
  for (let i = 0; i < users.length; i++) {
    if (matches(users[i].email)) {
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(newEmail, users[i].id);
      break;
    }
  }
  db.prepare('SELECT id, created_by AS v FROM users').all().forEach(function (r) {
    if (r.v !== null && r.v !== undefined && matches(r.v)) {
      db.prepare('UPDATE users SET created_by = ? WHERE id = ?').run(newPrimary, r.id);
    }
  });
}

function listUserRecords_() {
  const rows = db.prepare('SELECT * FROM users').all();
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    if (!String(rows[i].email || '').trim()) continue;
    out.push({
      email: String(rows[i].email || '').trim(),
      emailList: emailList_(rows[i].email),
      primaryEmail: primaryEmail_(rows[i].email),
      role: rows[i].role || ROLES.VIEWER,
      mustChange: !!rows[i].must_change,
      createdAt: rows[i].created_at ? String(rows[i].created_at) : '',
      group: rows[i].group_name || '',
      department: rows[i].department || '',
      office: rows[i].office || '',
      resetRequested: rows[i].reset_requested ? String(rows[i].reset_requested) : '',
      username: rows[i].username ? String(rows[i].username) : ''
    });
  }
  return out;
}

function listUserRecords() {
  return listUserRecords_();
}

function ensureUserRecord_(email) {
  email = String(email || '').toLowerCase().trim();
  if (!email) return null;
  if (!isBootstrapAdmin_(email)) return null;

  let rec = findUserRecord_(email);
  if (!rec) {
    const salt = generateSalt_();
    addUserRecord_(email, ROLES.ADMIN, salt, hashPassword_(DEFAULT_ADMIN_PASSWORD, salt), 'system');
    setUserField_(email, 'mustChange', true);
    rec = findUserRecord_(email);
  }
  if (rec && !String(rec.username || '').trim()) {
    setUserField_(email, 'username', 'co_admin');
  }
  return rec;
}

function ensureBootstrapAdmin(email) {
  return ensureUserRecord_(email || ADMIN_USERS[0]);
}

function verifyPasswordRecord_(rec, password) {
  if (!rec || !rec.salt || !rec.passwordHash) return false;
  return hashPassword_(password, rec.salt) === rec.passwordHash;
}

function verifyPassword_(email, password) {
  return verifyPasswordRecord_(findUserRecord_(email), password);
}

/* ============================================================
 * Login attempt throttling
 * ============================================================ */

function recordFailedAttempt_(identifier) {
  const key = 'loginfail_' + safeCacheKey_(identifier);
  const count = Number(cacheGetTTL(key) || 0) + 1;
  cachePut(key, String(count), 60 * CONFIG.USERS.LOCK_MINUTES);
  return count;
}

function isAttemptBlocked_(identifier) {
  const key = 'loginfail_' + safeCacheKey_(identifier);
  return Number(cacheGetTTL(key) || 0) >= CONFIG.USERS.MAX_LOGIN_ATTEMPTS;
}

function clearAttempts_(identifier) {
  cacheRemove('loginfail_' + safeCacheKey_(identifier));
}

/* ============================================================
 * Authorization
 * ============================================================ */

const roleCache = {};

function getUserRole(email) {
  email = String(email || getCurrentUser() || '').toLowerCase().trim();
  if (!email) return ROLES.VIEWER;
  if (roleCache[email]) return roleCache[email];

  const rec = findUserRecord_(email);
  let role = ROLES.VIEWER;
  if (rec && rec.role) role = rec.role;
  else if (ADMIN_USERS.indexOf(email) !== -1) role = ROLES.ADMIN;
  else if (EDITOR_USERS.indexOf(email) !== -1) role = ROLES.EDITOR;
  else if (VIEWER_USERS.indexOf(email) !== -1) role = ROLES.VIEWER;

  roleCache[email] = role;
  return role;
}

function isAdmin(email) {
  return getUserRole(email) === ROLES.ADMIN;
}

function isEditor(email) {
  const role = getUserRole(email);
  return role === ROLES.ADMIN || role === ROLES.EDITOR;
}

function getUserGroups(email) {
  email = String(email || '').toLowerCase().trim();
  if (!email) return [];
  const rec = findUserRecord_(email);
  const groups = String((rec && rec.group) || '')
    .split(',')
    .map(function (g) { return String(g).toUpperCase().trim(); })
    .filter(function (g) { return g && USER_GROUP_KEYS.indexOf(g) !== -1; });
  return groups;
}

function rolePermissions_(role) {
  return PERMISSIONS[role] || PERMISSIONS[ROLES.VIEWER] || {};
}

function groupPermissions_(groups) {
  const merged = {};
  groups.forEach(function (g) {
    const grants = (USER_GROUPS[g] && USER_GROUPS[g].permissions) || {};
    Object.keys(grants).forEach(function (module) {
      if (!merged[module]) merged[module] = [];
      grants[module].forEach(function (action) {
        if (merged[module].indexOf(action) === -1) merged[module].push(action);
      });
    });
  });
  return merged;
}

function getUserPermissions(email) {
  email = String(email || '').toLowerCase().trim();
  if (!email) return {};
  const role = getUserRole(email);
  const rolePerms = rolePermissions_(role);
  const groupPerms = groupPermissions_(getUserGroups(email));

  const out = {};
  Object.keys(rolePerms).forEach(function (module) {
    const set = [];
    (rolePerms[module] || []).forEach(function (a) {
      if (set.indexOf(a) === -1) set.push(a);
    });
    (groupPerms[module] || []).forEach(function (a) {
      if (set.indexOf(a) === -1) set.push(a);
    });
    out[module] = set;
  });
  Object.keys(groupPerms).forEach(function (module) {
    if (!out[module]) out[module] = (groupPerms[module] || []).slice();
  });
  return out;
}

function getUserContext(email) {
  email = String(email || '').toLowerCase().trim();
  const rec = findUserRecord_(email) || {};
  return {
    email: email,
    username: rec.username || '',
    role: getUserRole(email),
    group: rec.group || '',
    department: rec.department || '',
    office: rec.office || '',
    groups: getUserGroups(email),
    permissions: getUserPermissions(email)
  };
}

function authenticate_(token) {
  const email = sessionEmail_(token);
  if (!email) throw new Error('Login required. Please log in again.');
  return { email: email, role: getUserRole(email) };
}

function requireLogin_(token) {
  return authenticate_(token);
}

function requireLogin(token) {
  return requireLogin_(token);
}

function requireEditor_(token) {
  const user = requireLogin_(token);
  if (!isEditor(user.email)) throw new Error('Editor permission required.');
  return user;
}

function requireEditor(token) {
  return requireEditor_(token);
}

function requireAdmin_(token) {
  const user = requireLogin_(token);
  if (!isAdmin(user.email)) throw new Error('Admin permission required.');
  return user;
}

function requireAdmin(token) {
  return requireAdmin_(token);
}

function requireViewer() {
  return true;
}

/* ============================================================
 * Login / Logout / Session
 * ============================================================ */

function login(identifier, password) {
  identifier = String(identifier || '').toLowerCase().trim();

  if (!identifier) {
    return { success: false, message: 'Enter your email or username.' };
  }
  if (!password) {
    return { success: false, message: 'Enter your password.' };
  }
  if (isAttemptBlocked_(identifier)) {
    return {
      success: false,
      message: 'Too many failed attempts. Try again in ' + CONFIG.USERS.LOCK_MINUTES + ' minutes.'
    };
  }

  let rec = resolveUserByIdentifier_(identifier);

  if (!rec && isValidEmail_(identifier) && isBootstrapAdmin_(identifier)) {
    ensureUserRecord_(identifier);
    rec = findUserRecord_(identifier);
  }

  if (!rec || !verifyPasswordRecord_(rec, password)) {
    recordFailedAttempt_(identifier);
    return { success: false, message: 'Invalid email, username or password.' };
  }

  clearAttempts_(identifier);

  const email = rec.email;
  const token = createSession_(email);
  try { logAudit_(require('./audit'), 'LOGIN', '', 'Signed in', email); } catch (err) {}

  const context = getUserContext(email);
  return {
    success: true,
    token: token,
    mustChange: rec.mustChange === true,
    user: {
      email: email,
      username: rec.username || '',
      role: context.role,
      loggedIn: true,
      group: context.group,
      department: context.department,
      office: context.office,
      groups: context.groups,
      permissions: context.permissions
    }
  };
}

function logAudit_(auditModule, action, id, details, email) {
  try { auditModule.logAudit_(action, id, details, email); } catch (err) {}
}

function logout(token) {
  destroySession_(token);
  return { success: true };
}

function validateSession(token) {
  try {
    const user = authenticate_(token);
    return { success: true, user: user };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/* ============================================================
 * Password Reset (admin request)
 * ============================================================ */

function requestPasswordReset(identifier) {
  identifier = String(identifier || '').toLowerCase().trim();

  if (!identifier) {
    return { success: false, message: 'Enter your email or username.' };
  }

  const rec = resolveUserByIdentifier_(identifier);
  if (!rec) {
    return { success: true, message: 'If an account exists, your administrator has been notified.' };
  }
  const email = rec.email;

  runWithLock_(function () {
    setUserField_(email, 'resetRequested', new Date());
    setUserField_(email, 'resetToken', '');
    setUserField_(email, 'resetExpires', null);
    const notifications = require('./notifications');
    notifications.notifyStaff_('user', 'Password reset requested', 'The user ' + email + ' requested a password reset. Open Settings to review the request.', '');
  });

  try { logAudit_(require('./audit'), 'PASSWORD_RESET_REQUESTED', '', 'Reset requested; administrator notified', email); } catch (err) {}

  const { sendMail_ } = require('./mailer');
  const resetBody = 'A password reset was requested for the dashboard user:\n\n' +
    '  Email: ' + email + '\n' +
    '  Time:  ' + new Date().toISOString() + '\n\n' +
    'Open the dashboard Settings to review and reset the password.';
  ADMIN_USERS.forEach(function (adminEmail) {
    adminEmail = String(adminEmail || '').toLowerCase().trim();
    if (adminEmail && adminEmail !== email) {
      try { sendMail_(adminEmail, 'Password reset requested - India Post Dashboard', resetBody); } catch (err) {}
    }
  });

  return { success: true, message: 'A reset request has been sent to your administrator.' };
}

function changePassword(currentPassword, newPassword, token) {
  const user = requireLogin_(token);

  if (!verifyPassword_(user.email, currentPassword)) {
    return { success: false, message: 'Current password is incorrect.' };
  }

  const pwError = validatePassword_(newPassword);
  if (pwError) return { success: false, message: pwError };

  runWithLock_(function () {
    const salt = generateSalt_();
    setUserField_(user.email, 'salt', salt);
    setUserField_(user.email, 'passwordHash', hashPassword_(newPassword, salt));
    setUserField_(user.email, 'mustChange', false);
    setUserField_(user.email, 'resetToken', '');
    setUserField_(user.email, 'resetExpires', null);
    setUserField_(user.email, 'resetRequested', null);
  });

  try { logAudit_(require('./audit'), 'CHANGE_PASSWORD', '', '', user.email); } catch (err) {}
  try { require('./notifications').notify_(user.email, 'user', 'Password changed', 'Your dashboard password was changed successfully.', ''); } catch (err) {}
  return { success: true, message: 'Password updated.' };
}

/* ============================================================
 * Admin: User Management
 * ============================================================ */

function adminGetUsers(token) {
  requireAdmin_(token);
  return listUserRecords_();
}

function getAssignableUsers(token) {
  requireEditor_(token);
  return listUserRecords_().map(function (u) {
    return { email: u.email, username: u.username || '', role: u.role };
  });
}

function adminAddUser(email, username, role, password, group, department, office, token) {
  const admin = requireAdmin_(token);

  return runWithLock_(function () {
    email = String(email || '').toLowerCase().trim();
    username = String(username || '').trim();
    role = String(role || '').toUpperCase().trim();

    if (!isValidEmailList_(email)) throw new Error('Invalid email address(es).');
    if (username && !isValidUsername_(username)) throw new Error('Username must be 3-30 characters (letters, digits, dot, underscore, hyphen).');
    if ([ROLES.VIEWER, ROLES.EDITOR, ROLES.ADMIN].indexOf(role) === -1) throw new Error('Role must be VIEWER, EDITOR or ADMIN.');

    if (findUserRecord_(email)) throw new Error('A user with that email already exists.');
    if (username && findUserByUsername_(username)) throw new Error('Username already taken.');

    const pwError = validatePassword_(password);
    if (pwError) throw new Error(pwError);

    const salt = generateSalt_();
    addUserRecord_(email, role, salt, hashPassword_(password, salt), admin.email, group, department, office, username);

    try { logAudit_(require('./audit'), 'USER_ADD', '', email + ' as ' + role, admin.email); } catch (err) {}
    try { require('./notifications').notify_(email, 'user', 'Account created', 'Your dashboard account was created with the ' + role + ' role. Use the credentials given by your administrator.', ''); } catch (err) {}

    try {
      const { sendMail_ } = require('./mailer');
      sendMail_(
        email,
        'Your India Post Dashboard account',
        'An administrator created a dashboard account for you.\n\n' +
        '  Email: ' + email + '\n' +
        (username ? '  Username: ' + username + '\n' : '') +
        '  Role: ' + role + '\n' +
        '  Password: ' + password + '\n\n' +
        'Sign in and change your password after first login.'
      );
    } catch (err) {}

    return listUserRecords_();
  });
}

function adminUpdateUser(email, fields, token) {
  const admin = requireAdmin_(token);

  return runWithLock_(function () {
    email = String(email || '').toLowerCase().trim();
    if (!findUserRecord_(email)) throw new Error('User not found.');

    const f = fields || {};
    const changes = [];
    let reAuth = false;

    if (f.email !== undefined) {
      const newEmail = String(f.email || '').toLowerCase().trim();
      const currentRec = findUserRecord_(email);
      const oldRaw = currentRec ? currentRec.rawEmail : email;
      const oldPrimary = primaryEmail_(oldRaw);
      const changed = (emailList_(newEmail).join(',') !== emailList_(oldRaw).join(','));
      if (changed) {
        if (!isValidEmailList_(newEmail)) throw new Error('Invalid email address(es).');
        if (isBootstrapAdmin_(oldPrimary) && primaryEmail_(newEmail) !== oldPrimary) {
          throw new Error('The primary admin account email cannot be changed.');
        }
        const collides = findUserRecord_(newEmail);
        if (collides && (!currentRec || collides.id !== currentRec.id)) {
          throw new Error('A user with that email already exists.');
        }

        renameUserEmail_(oldRaw, newEmail);
        changes.push('email ' + oldRaw + ' -> ' + newEmail);
        try { require('./notifications').notify_(primaryEmail_(newEmail), 'user', 'Account updated', 'Your dashboard login email was changed to ' + newEmail + ' by an administrator.', ''); } catch (err) {}
        if (oldPrimary === admin.email) {
          destroySession_(token);
          reAuth = true;
        }
        email = newEmail;
      }
    }

    if (f.role !== undefined) {
      const role = String(f.role || '').toUpperCase().trim();
      if ([ROLES.VIEWER, ROLES.EDITOR, ROLES.ADMIN].indexOf(role) === -1) throw new Error('Role must be VIEWER, EDITOR or ADMIN.');
      if (isBootstrapAdmin_(email)) throw new Error('The primary admin account role cannot be changed.');
      if (primaryEmail_(email) === admin.email && role !== ROLES.ADMIN) throw new Error('You cannot change your own role.');
      if (role !== ROLES.ADMIN && getUserRole(email) === ROLES.ADMIN) {
        const adminCount = listUserRecords_().filter(function (u) { return u.role === ROLES.ADMIN; }).length;
        if (adminCount <= 1) throw new Error('Cannot demote the last admin.');
      }
      if (getUserRole(email) !== role) {
        setUserField_(email, 'role', role);
        changes.push('role -> ' + role);
        try { require('./notifications').notify_(email, 'user', 'Role changed', 'Your dashboard role was changed to ' + role + ' by an administrator.', ''); } catch (err) {}
      }
    }

    if (f.username !== undefined) {
      const uname = String(f.username || '').trim();
      if (uname && !isValidUsername_(uname)) throw new Error('Username must be 3-30 characters (letters, digits, dot, underscore, hyphen).');
      const holder = uname ? findUserByUsername_(uname) : null;
      if (holder && primaryEmail_(holder.email) !== primaryEmail_(email)) throw new Error('Username already taken.');
      setUserField_(email, 'username', uname);
      changes.push('username updated');
    }
    if (f.group !== undefined) setUserField_(email, 'group', String(f.group || ''));
    if (f.department !== undefined) setUserField_(email, 'department', String(f.department || ''));
    if (f.office !== undefined) setUserField_(email, 'office', String(f.office || ''));

    const summary = changes.length ? changes.join(', ') : 'metadata updated';
    try { logAudit_(require('./audit'), 'USER_UPDATE', '', email + ' (' + summary + ')', admin.email); } catch (err) {}

    return {
      users: listUserRecords_(),
      reAuth: reAuth,
      message: changes.length ? 'User updated: ' + summary : 'No changes were made.'
    };
  });
}

function adminExportUsers(token) {
  requireAdmin_(token);
  const users = listUserRecords_();
  const header = ['Email', 'Username', 'Role', 'Group', 'Department', 'Office', 'CreatedAt', 'MustChange'];
  const lines = users.map(function (u) {
    return [
      u.email,
      u.username || '',
      u.role,
      u.group || '',
      u.department || '',
      u.office || '',
      u.createdAt || '',
      u.mustChange ? 'TRUE' : 'FALSE'
    ].map(function (cell) {
      const s = String(cell == null ? '' : cell);
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(',');
  });
  return [header.map(function (h) { return '"' + h + '"'; }).join(',')].concat(lines).join('\n');
}

function adminImportUsers(csv, token) {
  const admin = requireAdmin_(token);

  const result = { users: listUserRecords_(), added: 0, updated: 0, errors: [] };
  if (!csv || !String(csv).trim()) throw new Error('Paste CSV content to import.');

  return runWithLock_(function () {
    const lines = String(csv)
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter(function (l) { return String(l).trim() !== ''; });

    if (!lines.length) throw new Error('No rows to import.');

    const rows = lines.map(require('./helpers').parseCsvLine_);

    for (let r = 0; r < rows.length; r++) {
      const cols = rows[r];
      const email = String(cols[0] || '').toLowerCase().trim();
      const role = String(cols[1] || '').toUpperCase().trim();

      if (r === 0 && !isValidEmailList_(email)) continue;

      if (!email) { result.errors.push('Row ' + (r + 1) + ': missing email.'); continue; }
      if (!isValidEmailList_(email)) { result.errors.push('Row ' + (r + 1) + ': invalid email "' + email + '".'); continue; }
      if ([ROLES.VIEWER, ROLES.EDITOR, ROLES.ADMIN].indexOf(role) === -1) {
        result.errors.push('Row ' + (r + 1) + ': invalid role "' + (role || '') + '".');
        continue;
      }

      const group = String(cols[2] || '').trim();
      const department = String(cols[3] || '').trim();
      const office = String(cols[4] || '').trim();
      const password = String(cols[5] || '').trim();
      const username = String(cols[6] || '').trim();

      if (username && !isValidUsername_(username)) {
        result.errors.push('Row ' + (r + 1) + ': invalid username "' + username + '".');
        continue;
      }

      const existing = findUserRecord_(email);

      if (existing) {
        if (username) {
          const holder = findUserByUsername_(username);
          if (holder && holder.email !== email) {
            result.errors.push('Row ' + (r + 1) + ': username "' + username + '" already taken.');
            continue;
          }
          setUserField_(email, 'username', username);
        }
        if (group) setUserField_(email, 'group', group);
        if (department) setUserField_(email, 'department', department);
        if (office) setUserField_(email, 'office', office);
        if (password) {
          const pwError = validatePassword_(password);
          if (pwError) { result.errors.push('Row ' + (r + 1) + ': ' + pwError); continue; }
          const salt = generateSalt_();
          setUserField_(email, 'salt', salt);
          setUserField_(email, 'passwordHash', hashPassword_(password, salt));
          setUserField_(email, 'mustChange', false);
        }
        result.updated++;
      } else {
        const pw = password || uuid_().slice(0, 12);
        const pwError = validatePassword_(pw);
        if (pwError) { result.errors.push('Row ' + (r + 1) + ': ' + pwError); continue; }
        if (username && findUserByUsername_(username)) {
          result.errors.push('Row ' + (r + 1) + ': username "' + username + '" already taken.');
          continue;
        }
        const salt = generateSalt_();
        addUserRecord_(email, role, salt, hashPassword_(pw, salt), admin.email, group, department, office, username);
        if (!password) setUserField_(email, 'mustChange', true);
        result.added++;
        try { require('./notifications').notify_(email, 'user', 'Account created', 'Your dashboard account was created with the ' + role + ' role during a bulk import.', ''); } catch (err) {}

        try {
          const { sendMail_ } = require('./mailer');
          sendMail_(
            email,
            'Your India Post Dashboard account',
            'An administrator created a dashboard account for you (bulk import).\n\n' +
            '  Email: ' + email + '\n' +
            (username ? '  Username: ' + username + '\n' : '') +
            '  Role: ' + role + '\n' +
            '  Password: ' + pw + '\n\n' +
            'Sign in and change your password after first login.'
          );
        } catch (err) {}
      }
    }

    try { logAudit_(require('./audit'), 'USER_IMPORT', '', 'Imported users: +' + result.added + ' added, ' + result.updated + ' updated, ' + result.errors.length + ' errors', admin.email); } catch (err) {}

    result.users = listUserRecords_();
    return result;
  });
}

function adminGetUserActivity(token) {
  requireAdmin_(token);

  const auditRows = db.prepare('SELECT * FROM audit').all();
  if (!auditRows.length) {
    return { users: [], recent: [], totals: { events: 0, logins: 0, activeUsers: 0 } };
  }

  const startRow = Math.max(0, auditRows.length - CONFIG.USERS.ACTIVITY_LIMIT);
  const sliced = auditRows.slice(startRow);

  const parsed = sliced.map(function (row) {
    return {
      ts: Number(row.timestamp) || 0,
      timestamp: row.timestamp ? String(row.timestamp) : '',
      email: String(row.user || '').toLowerCase().trim() || '(system)',
      action: String(row.action || ''),
      recordId: row.record_id || '',
      details: row.details || ''
    };
  });

  parsed.sort(function (a, b) { return b.ts - a.ts; });

  const recent = parsed.slice(0, 30).map(function (row) {
    return { timestamp: row.timestamp, user: row.email, action: row.action, recordId: row.recordId, details: row.details };
  });

  const perUser = {};
  let logins = 0;

  parsed.forEach(function (row) {
    if (!perUser[row.email]) {
      perUser[row.email] = { email: row.email, actions: 0, logins: 0, lastSeenMs: -1, lastSeen: '' };
    }
    perUser[row.email].actions++;
    if (row.ts > perUser[row.email].lastSeenMs) {
      perUser[row.email].lastSeenMs = row.ts;
      perUser[row.email].lastSeen = row.timestamp;
    }
    if (row.action === 'LOGIN') {
      perUser[row.email].logins++;
      logins++;
    }
  });

  const userList = Object.keys(perUser)
    .map(function (k) { return perUser[k]; })
    .sort(function (a, b) { return b.actions - a.actions; });

  return {
    users: userList,
    recent: recent,
    totals: { events: sliced.length, logins: logins, activeUsers: userList.length }
  };
}

function adminDeleteUser(email, token) {
  const admin = requireAdmin_(token);

  return runWithLock_(function () {
    email = String(email || '').toLowerCase().trim();

    if (primaryEmail_(email) === admin.email) throw new Error('You cannot delete your own account.');
    if (isBootstrapAdmin_(email)) throw new Error('The primary admin account cannot be deleted.');
    if (!deleteUserRecord_(email)) throw new Error('User not found.');

    destroySessionsForEmail_(email);

    try { logAudit_(require('./audit'), 'USER_DELETE', '', email, admin.email); } catch (err) {}
    return listUserRecords_();
  });
}

function adminResetPassword(email, newPassword, token) {
  const admin = requireAdmin_(token);

  return runWithLock_(function () {
    email = String(email || '').toLowerCase().trim();

    if (!findUserRecord_(email)) throw new Error('User not found.');

    const pwError = validatePassword_(newPassword);
    if (pwError) throw new Error(pwError);

    const salt = generateSalt_();
    setUserField_(email, 'salt', salt);
    setUserField_(email, 'passwordHash', hashPassword_(newPassword, salt));
    setUserField_(email, 'mustChange', false);
    setUserField_(email, 'resetToken', '');
    setUserField_(email, 'resetExpires', null);
    setUserField_(email, 'resetRequested', null);

    try { logAudit_(require('./audit'), 'USER_RESET_PASSWORD', '', email, admin.email); } catch (err) {}
    try { require('./notifications').notify_(email, 'user', 'Password reset', 'An administrator reset your dashboard password. Please sign in with the new password.', ''); } catch (err) {}
    return listUserRecords_();
  });
}

function adminEmailAllUsers(subject, body, token) {
  const admin = requireAdmin_(token);
  subject = String(subject || '').trim();
  body = String(body || '').trim();

  if (!subject) throw new Error('A subject is required.');
  if (!body) throw new Error('A message body is required.');

  const users = listUserRecords_();
  const recipients = [];
  const seen = {};
  users.forEach(function (u) {
    const email = primaryEmail_(u.primaryEmail || u.email);
    if (!email || seen[email]) return;
    seen[email] = true;
    recipients.push(email);
  });

  const { sendMail_ } = require('./mailer');
  let sent = 0;
  recipients.forEach(function (email) {
    if (sendMail_(email, subject, body)) sent++;
  });

  try { logAudit_(require('./audit'), 'USER_UPDATE', '', 'Broadcast email sent to ' + sent + '/' + recipients.length + ' users', admin.email); } catch (err) {}

  return { success: true, sent: sent, recipients: recipients };
}

function getCurrentUserInfo() {
  const email = getCurrentUser();
  const context = getUserContext(email);
  return {
    email: email,
    role: context.role,
    loggedIn: !!email,
    group: context.group,
    department: context.department,
    office: context.office,
    groups: context.groups,
    permissions: context.permissions
  };
}

module.exports = {
  isBootstrapAdmin_,
  getCurrentUser,
  findUserRecord,
  findUserRecord_,
  findUserByUsername_,
  resolveUserByIdentifier_,
  setUserField,
  setUserField_,
  addUserRecord,
  addUserRecord_,
  deleteUserRecord_,
  listUserRecords,
  listUserRecords_,
  ensureBootstrapAdmin,
  ensureUserRecord_,
  verifyPasswordRecord_,
  verifyPassword_,
  getUserRole,
  isAdmin,
  isEditor,
  getUserGroups,
  getUserPermissions,
  getUserContext,
  authenticate_,
  requireLogin_,
  requireLogin,
  requireEditor_,
  requireEditor,
  requireAdmin_,
  requireAdmin,
  requireViewer,
  login,
  logout,
  validateSession,
  requestPasswordReset,
  changePassword,
  adminGetUsers,
  getAssignableUsers,
  adminAddUser,
  adminUpdateUser,
  adminExportUsers,
  adminImportUsers,
  adminGetUserActivity,
  adminDeleteUser,
  adminResetPassword,
  adminEmailAllUsers,
  getCurrentUserInfo
};

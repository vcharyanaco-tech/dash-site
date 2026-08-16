/**
 * ============================================================
 * India Post Dashboard — Node port
 * dashboardstudio.js
 * Dashboard customization: column visibility, view mode, layout
 * (port of DashboardStudio.gs against the users.preferences JSON).
 * ============================================================
 */

const { DASHBOARD_PREF_KEYS, VIEW_MODES, DEFAULT_COLUMNS } = require('./config');
const auth = require('./auth');

function getUserPreferences_(email) {
  const user = auth.findUserRecord_(email);
  if (!user) return {};
  try {
    const raw = String(user.preferences || '').trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function setUserPreferences_(email, prefs) {
  auth.setUserField_(email, 'preferences', JSON.stringify(prefs || {}));
  return true;
}

function getDashboardPreferences(token) {
  const user = auth.requireLogin(token);
  const prefs = getUserPreferences_(user.email);
  const columns = Object.assign({}, DEFAULT_COLUMNS, (prefs[DASHBOARD_PREF_KEYS.COLUMNS] || {}));
  return {
    viewMode: prefs[DASHBOARD_PREF_KEYS.VIEW_MODE] || VIEW_MODES.CARDS,
    columns: columns,
    layout: prefs[DASHBOARD_PREF_KEYS.LAYOUT] || {},
    sortKey: prefs[DASHBOARD_PREF_KEYS.SORT_KEY] || 'id',
    sortDir: prefs[DASHBOARD_PREF_KEYS.SORT_DIR] || 'asc',
    reviewFilter: prefs[DASHBOARD_PREF_KEYS.REVIEW_FILTER] || ''
  };
}

function saveDashboardPreferences(prefs, token) {
  const user = auth.requireLogin(token);
  prefs = prefs || {};
  const merged = getUserPreferences_(user.email);
  merged[DASHBOARD_PREF_KEYS.VIEW_MODE] = prefs.viewMode || merged[DASHBOARD_PREF_KEYS.VIEW_MODE] || VIEW_MODES.CARDS;
  merged[DASHBOARD_PREF_KEYS.COLUMNS] = Object.assign({}, DEFAULT_COLUMNS, prefs.columns || merged[DASHBOARD_PREF_KEYS.COLUMNS] || {});
  merged[DASHBOARD_PREF_KEYS.LAYOUT] = prefs.layout || merged[DASHBOARD_PREF_KEYS.LAYOUT] || {};
  if (prefs.sortKey !== undefined) merged[DASHBOARD_PREF_KEYS.SORT_KEY] = prefs.sortKey;
  if (prefs.sortDir !== undefined) merged[DASHBOARD_PREF_KEYS.SORT_DIR] = prefs.sortDir;
  if (prefs.reviewFilter !== undefined) merged[DASHBOARD_PREF_KEYS.REVIEW_FILTER] = prefs.reviewFilter;
  setUserPreferences_(user.email, merged);
  return { success: true };
}

module.exports = {
  getUserPreferences_,
  setUserPreferences_,
  getDashboardPreferences,
  saveDashboardPreferences
};

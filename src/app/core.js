'use strict';

/* ==========================================================================
   India Post Dashboard — Client (script.html)
   Renders against the enterprise design system in styles.html. All inline
   onclick handlers referenced by index.html are defined here.
   ========================================================================== */

const APP_VERSION = '1.0.0';
const APP_BUILD = '2026.08.19';
const PAGE_SIZE = 10;
const AUDIT_PAGE_SIZE = 20;
const STORAGE_THEME = 'indiaPostDarkMode';
const STORAGE_SIDEBAR = 'indiaPostSidebarCollapsed';
const STORAGE_TOKEN = 'indiaPostAuthToken';
const STORAGE_REAUTH_MSG = 'indiaPostReauthMsg';

/* Original (pre-edit) email cell of the user being edited, used as the
   identifier for adminUpdateUser so the record is found even after the
   admin changes the email value in the edit dialog. */
let editUserOriginalEmail = '';

/* ---------------------------------- Event bus (pub/sub) ---------------------------------- */
/* Lightweight publish/subscribe used across the UI. Named events follow the
   convention: UserLoggedIn, DataRefreshed, ReportSaved, SettingsUpdated,
   ThemeChanged. */

const EventBus = {
  listeners: {},
  on: function (event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
    return this;
  },
  off: function (event, fn) {
    const list = this.listeners[event];
    if (!list) return this;
    const idx = list.indexOf(fn);
    if (idx !== -1) list.splice(idx, 1);
    return this;
  },
  emit: function (event, payload) {
    (this.listeners[event] || []).slice().forEach(function (fn) { fn(payload); });
    return this;
  }
};

/* ---------------------------------- API service layer ---------------------------------- */
/* Central gateway for every server call: owns fetch, argument
    order and token injection, and turns results into Promises. No UI code
    calls fetch directly. */

// In production the Cloudflare Worker forwards /api/* to the Node server;
// locally it can point at the dev server. Derive from the page origin so the
// same build works on dashboardharyana.site and localhost.
var API_URL = (window.location.protocol + '//' + window.location.host + '/api');

function apiCall_(fn) {
  const args = Array.prototype.slice.call(arguments, 1);
  return fetchApiWithRetry_(fn, args, 0);
}

// Auto-retries 503s: the Cloudflare worker returns 503 maintenance while the
// backend is restarting (Render free deploys have no zero-downtime, and the
// service sleeps 21:00-06:00 IST). Retry a few times on the Retry-After cadence
// so a deploy/cold start self-heals instead of erroring the user's screen.
function fetchApiWithRetry_(fn, args, attempt) {
  return fetch(API_URL, {
    method: 'POST',
    // text/plain avoids a CORS preflight (application/json would require OPTIONS)
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: fn, args: args })
  }).then(function (res) {
    if (res.status === 503 && attempt < 3) {
      if (attempt === 0) showToast('Server is restarting — retrying automatically…', 'warning');
      const retrySec = Number(res.headers.get('Retry-After')) || 15;
      const delay = Math.min(30, Math.max(5, retrySec) * (attempt + 1));
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(fetchApiWithRetry_(fn, args, attempt + 1));
        }, delay * 1000);
      });
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }).then(function (data) {
    if (data.error) throw new Error(data.error);
    return data.result;
  });
}

const ApiService = {
  getServerTime: function () { return apiCall_('getServerTime'); },
  getAppData: function () { return apiCall_('getAppData', getAuthToken()); },
  getData: function () { return apiCall_('getData'); },
  addItem: function (item) { return apiCall_('addItem', item, getAuthToken()); },
  updateItem: function (item) { return apiCall_('updateItem', item, getAuthToken()); },
  deleteItem: function (row) { return apiCall_('deleteItem', row, getAuthToken()); },
  markReviewDone: function (row) { return apiCall_('markReviewDone', row, getAuthToken()); },
  markReviewNotDone: function (row) { return apiCall_('markReviewNotDone', row, getAuthToken()); },
  login: function (email, password) { return apiCall_('login', email, password); },
  logout: function () { return apiCall_('logout', getAuthToken()); },
  validateSession: function () { return apiCall_('validateSession', getAuthToken()); },
  requestPasswordReset: function (email) { return apiCall_('requestPasswordReset', email); },
  changePassword: function (currentPassword, newPassword) { return apiCall_('changePassword', currentPassword, newPassword, getAuthToken()); },
  adminGetUsers: function () { return apiCall_('adminGetUsers', getAuthToken()); },
  adminAddUser: function (email, username, role, password, group, department, office) { return apiCall_('adminAddUser', email, username, role, password, group, department, office, getAuthToken()); },
  adminUpdateUser: function (email, fields) { return apiCall_('adminUpdateUser', email, fields, getAuthToken()); },
  adminExportUsers: function () { return apiCall_('adminExportUsers', getAuthToken()); },
  adminImportUsers: function (csv) { return apiCall_('adminImportUsers', csv, getAuthToken()); },
  adminGetUserActivity: function () { return apiCall_('adminGetUserActivity', getAuthToken()); },
  adminDeleteUser: function (email) { return apiCall_('adminDeleteUser', email, getAuthToken()); },
  adminResetPassword: function (email, newPassword) { return apiCall_('adminResetPassword', email, newPassword, getAuthToken()); },
  adminEmailAllUsers: function (subject, body) { return apiCall_('adminEmailAllUsers', subject, body, getAuthToken()); },
  adminSyncFromSheet: function () { return apiCall_('adminSyncFromSheet', getAuthToken()); },
  adminPushToSheet: function () { return apiCall_('adminPushToSheet', getAuthToken()); },
  adminPreviewSyncFromSheet: function () { return apiCall_('adminPreviewSyncFromSheet', getAuthToken()); },
  exportFullBackup: function () { return apiCall_('exportFullBackup', getAuthToken()); },
  getSyncStatus: function () { return apiCall_('getSyncStatus'); },
  getMyNotifications: function () { return apiCall_('getMyNotifications', getAuthToken()); },
  generateReviewNotifications: function () { return apiCall_('generateReviewNotifications', getAuthToken()); },
  markNotificationsRead: function (ids) { return apiCall_('markNotificationsRead', ids, getAuthToken()); },
  clearMyNotifications: function () { return apiCall_('clearMyNotifications', getAuthToken()); },
  createTask: function (params) { return apiCall_('createTask', params, getAuthToken()); },
  getTaskCounts: function () { return apiCall_('getTaskCounts', getAuthToken()); },
  getTasks: function (filters) { return apiCall_('getTasks', filters || {}, getAuthToken()); },
  getAssignableUsers: function () { return apiCall_('getAssignableUsers', getAuthToken()); },
  getMyTasks: function () { return apiCall_('getMyTasks', getAuthToken()); },
  updateTask: function (id, fields) { return apiCall_('updateTask', id, fields, getAuthToken()); },
  deleteTask: function (id) { return apiCall_('deleteTask', id, getAuthToken()); },
  getDashboardPreferences: function () { return apiCall_('getDashboardPreferences', getAuthToken()); },
  saveDashboardPreferences: function (prefs) { return apiCall_('saveDashboardPreferences', prefs, getAuthToken()); },
  getReportTemplates: function () { return apiCall_('getReportTemplates'); },
  getReportData: function (templateKey) { return apiCall_('getReportData', templateKey, getAuthToken()); },
  getRecordDocuments: function (row) { return apiCall_('getRecordDocuments', row, getAuthToken()); },
  uploadDocument: function (row, recordId, fileName, fileBytes, mimeType) { return apiCall_('uploadDocument', row, recordId, fileName, fileBytes, mimeType, getAuthToken()); },
  deleteDocument: function (docId) { return apiCall_('deleteDocument', docId, getAuthToken()); },
  setDocumentKeep: function (docId, keep) { return apiCall_('setDocumentKeep', docId, keep, getAuthToken()); },
  getSubmissions: function (cardRow) { return apiCall_('getSubmissions', getAuthToken(), cardRow); },
  addSubmission: function (cardRow, cardId, text) { return apiCall_('addSubmission', cardRow, cardId, text, getAuthToken()); },
  updateSubmission: function (submissionId, text) { return apiCall_('updateSubmission', submissionId, text, getAuthToken()); },
  lockSubmission: function (submissionId) { return apiCall_('lockSubmission', submissionId, getAuthToken()); },
  unlockSubmission: function (submissionId) { return apiCall_('unlockSubmission', submissionId, getAuthToken()); },
  deleteSubmission: function (submissionId) { return apiCall_('deleteSubmission', submissionId, getAuthToken()); },
  toggleSubmissionDisplay: function (submissionId) { return apiCall_('toggleSubmissionDisplay', submissionId, getAuthToken()); },
  markAllSubmissionsRead: function () { return apiCall_('markAllSubmissionsRead', getAuthToken()); },
  getAuditEntries: function (limit) { return apiCall_('getAuditEntries', limit || 80); },
  adminDeleteAuditRows: function (rowNumbers) { return apiCall_('adminDeleteAuditRows', rowNumbers, getAuthToken()); },
  adminClearAudit: function () { return apiCall_('adminClearAudit', getAuthToken()); },
  exportToSpreadsheet: function () { return apiCall_('exportToSpreadsheet', getAuthToken()); },
  createPdfReport: function () { return apiCall_('createPdfReport', getAuthToken()); },
  emailReport: function (recipient, templateKey) { return apiCall_('emailReport', getAuthToken(), recipient, templateKey); },
  exportReviewCalendarIcs: function () { return apiCall_('exportReviewCalendarIcs', getAuthToken()); },
  sendWhatsAppReviewReminders: function () { return apiCall_('sendWhatsAppReviewReminders', getAuthToken()); },
  getAiInsights: function () { return apiCall_('getAiInsights', getAuthToken()); },
  getCardAiInsight: function (row) { return apiCall_('getCardAiInsight', getAuthToken(), row); },
  getLinkContentAiInsight: function (row) { return apiCall_('getLinkContentAiInsight', getAuthToken(), row); },
  askLinkAi: function (row, question) { return apiCall_('askLinkAi', getAuthToken(), row, question); },
  getAllAskLinkHistory: function () { return apiCall_('getAllAskLinkHistory', getAuthToken()); },
  saveAskLinkHistory: function (row, history) { return apiCall_('saveAskLinkHistory', getAuthToken(), row, history); },
  processMeetingRecording: function (payload) { return apiCall_('processMeetingRecording', payload, getAuthToken()); },
  transcribeMeetingSegment: function (payload) { return apiCall_('transcribeMeetingSegment', payload, getAuthToken()); },
  generateMeetingMinutes: function (payload) { return apiCall_('generateMeetingMinutes', payload, getAuthToken()); },
  listMeetingFiles: function () { return apiCall_('listMeetingFiles', getAuthToken()); },
  getMeetingFile: function (name) { return apiCall_('getMeetingFile', getAuthToken(), name); },
  deleteMeetingFile: function (name) { return apiCall_('deleteMeetingFile', getAuthToken(), name); },
  getFathomStatus: function () { return apiCall_('getFathomStatus', getAuthToken()); },
  setFathomApiKey: function (apiKey) { return apiCall_('setFathomApiKey', getAuthToken(), apiKey); },
  listFathomMeetings: function (opts) { return apiCall_('listFathomMeetings', getAuthToken(), opts || {}); },
  getFathomMeetingContent: function (recordingId) { return apiCall_('getFathomMeetingContent', getAuthToken(), recordingId); },
  getRecordingDownloadLink: function (recordingId) { return apiCall_('getRecordingDownloadLink', getAuthToken(), recordingId); },
  listFathomUsers: function () { return apiCall_('listFathomUsers', getAuthToken()); },
  // Push notifications
  subscribePush: function (subscription) { return apiCall_('subscribePush', subscription, getAuthToken()); },
  unsubscribePush: function (endpoint) { return apiCall_('unsubscribePush', endpoint, getAuthToken()); },
  sendReviewDeadlinePushNotifications: function () { return apiCall_('sendReviewDeadlinePushNotifications', getAuthToken()); },
  // Weekly reports
  sendWeeklyReport: function () { return apiCall_('sendWeeklyReport', getAuthToken()); },
  // i18n
  getTranslations: function (lang) { return apiCall_('getTranslations', lang); },
  // Session refresh
  refreshSession: function () { return apiCall_('refreshSession', getAuthToken()); },
  // Admin CSV import
  adminImportCsv: function (csvText) { return apiCall_('adminImportCsv', csvText, getAuthToken()); }
};

const appState = {
  items: [],
  filtered: [],
  summary: {},
  analytics: {},
  // Persisted "Analyze link" panels: row -> { data, collapsed }. Kept across
  // background refreshes so an analysis stays visible until the user closes it.
  linkAnalysis: {},
  // Persisted "AI insight" panels — same persistence as the link panels.
  aiAnalysis: {},
  // Persisted Ask-AI history for the linked-file panels: row -> [{ question, answer }] (newest last).
  linkAskQa: {},
  // Bumped on every submission mutation (add/update/delete/read-all) so a
  // background refresh that started BEFORE the mutation can be detected as
  // stale and discarded instead of reverting the card's submission state.
  submissionSeq: 0,
  audit: [],
  user: {},
  settings: {},
  isAdmin: false,
  isEditor: false,
  mustChange: false,
  editMode: 'edit',
  fieldLinks: {},
  submissions: [],
  submissionCardRow: '',
  submissionCardId: '',
  submissionEditingId: '',
  submissionCounts: {},
  submissionFlash: {},
  displayedSubmissions: [],
  responsibilities: [],
  reminders: [],
  counts: {},
  searchQuery: '',
  sector: '',
  page: 1,
  auditSortKey: 'timestamp',
  auditSortDir: 'desc',
  auditPage: 1,
  selectedAuditRows: [],
  dashboardView: 'cards',
  dashSortKey: 'id',
  dashSortDir: 'asc',
  dashReviewFilter: '',
  permissions: {},
  notifications: { unread: 0, recent: [] }
};

/* ---------------------------------- Helpers ---------------------------------- */

function getEl(id) { return document.getElementById(id); }

function can(module, action) {
  const perms = appState.permissions || {};
  return (perms[module] || []).indexOf(action) !== -1;
}

/* Apply a full server payload (getAppData shape) to the client state in one
   place so every refresh path keeps the same fields in sync. */
function applyAppData(data) {
  appState.lastUpdated = (data && data.lastUpdated) || '';
  appState.items = (data && data.items) || [];
  appState.summary = (data && data.summary) || {};
  appState.analytics = (data && data.analytics) || {};
  appState.audit = (data && data.audit) || [];
  appState.selectedAuditRows = [];
  appState.settings = (data && data.settings) || {};
  appState.submissionCounts = (data && data.submissionCounts) || {};
  appState.submissionFlash = (data && data.submissionFlash) || {};
  appState.displayedSubmissions = (data && data.displayedSubmissions) || [];
  appState.permissions = (data && data.user && data.user.permissions) || {};
  appState.responsibilities = (data && data.responsibilities) || [];
  appState.reminders = (data && data.reminders) || [];
  appState.auditPage = 1;
}

let auditLoaded = false;

function ensureAuditLoaded() {
  if (auditLoaded) return Promise.resolve(appState.audit);
  return ApiService.getAuditEntries(80).then(function (entries) {
    appState.audit = entries || [];
    appState.auditPage = 1;
    auditLoaded = true;
    return appState.audit;
  });
}

function renderAuditPanel() {
  ensureAuditLoaded().then(function () {
    renderAudit();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not load audit log: ' + (err.message || err), 'error');
    renderAudit();
  });
}

function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(value) {
  return escapeHtml(value);
}

function renderLinkableText(value) {
  const text = value == null ? '' : String(value);
  if (!text) return '';
  const normalized = text.trim();
  if (!normalized) return '';
  const isUrl = /^(https?:\/\/|mailto:|ftp:\/\/|www\.)/i.test(normalized) || /(?:\.[a-z]{2,})(?:\/|$)/i.test(normalized);
  if (!isUrl) return escapeHtml(text);
  const href = /^www\./i.test(normalized) ? 'https://' + normalized : normalized;
  return `<a href="${escAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

function parseQueryParams() {
  const params = {};
  const query = window.location.search || '';
  if (!query) return params;
  query.substring(1).split('&').forEach(pair => {
    const parts = pair.split('=');
    const key = decodeURIComponent(parts[0] || '');
    if (key) params[key] = decodeURIComponent(parts[1] || '');
  });
  return params;
}

function debounce(fn, ms) {
  let timer = null;
  return function () {
    const args = arguments;
    const ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, ms || 200);
  };
}

function svgIcon(name) {
  const paths = {
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>',
    search: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>',
    check: '<polyline points="20 6 9 17 4 12"></polyline>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
  };
  const body = paths[name] || paths.info;
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/* ---------------------------------- Toasts ---------------------------------- */

function showToast(message, type) {
  const container = getEl('toastContainer');
  if (!container) return;
  const kind = type || 'success';
  const icons = {
    success: svgIcon('check'),
    warning: svgIcon('alert'),
    error: svgIcon('alert'),
    info: svgIcon('info')
  };
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + kind;
  toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  toast.innerHTML = icons[kind] + '<span>' + escapeHtml(message) + '</span>';
  container.appendChild(toast);
  setTimeout(function () {
    toast.classList.add('out');
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
  }, 3600);
}

/* ---------------------------------- Overlay ---------------------------------- */

function showOverlay(message) {
  const overlay = getEl('overlay');
  const text = overlay.querySelector('.overlay-text');
  if (text) text.textContent = message || 'Working…';
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  getEl('overlay').classList.add('hidden');
}

/* ---------------------------------- Splash ---------------------------------- */

function hideSplash() {
  const splash = getEl('splashScreen');
  if (splash) splash.classList.add('hide');
}

/* ---------------------------------- Shared dialog system ---------------------------------- */
/* Central open/close for every modal plus a styled confirm that replaces the
   native confirm() boxes. openDialog/closeDialog also manage the body scroll
   lock and aria state so all dialogs behave consistently. */

function openDialog(id) {
  const modal = getEl(id);
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  restoreModalSize_(modal);
  const focusable = modal.querySelector('input:not([type=hidden]), textarea, select, button, [tabindex]');
  if (focusable) focusable.focus();
}

function closeDialog(id) {
  const modal = getEl(id);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.modal-backdrop:not(.hidden)')) {
    document.body.classList.remove('modal-open');
  }
}

/* ---------------------------------- Drag-resizable windows ---------------------------------- */
/* Every modal window and the inline analyze/AI panels get a corner grip that
   drag-resizes them. Modal sizes are remembered per dialog id in localStorage;
   panel sizes live in the persisted panel state so they survive re-renders. */

function makeModalResizable_(card) {
  if (!card || card.querySelector('.modal-resize-grip')) return;
  const grip = document.createElement('div');
  grip.className = 'modal-resize-grip';
  grip.title = 'Drag to resize';
  card.appendChild(grip);
  grip.addEventListener('mousedown', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const rect = card.getBoundingClientRect();
    const startW = rect.width, startH = rect.height;
    document.body.classList.add('modal-resizing');
    function onMove(ev) {
      const w = Math.max(280, Math.min(window.innerWidth - 32, startW + (ev.clientX - startX)));
      const h = Math.max(200, Math.min(window.innerHeight - 32, startH + (ev.clientY - startY)));
      card.style.width = w + 'px';
      card.style.maxWidth = 'none';
      card.style.height = h + 'px';
      card.style.maxHeight = 'none';
      const modal = card.closest('.modal-backdrop');
      if (modal && modal.id) {
        try { window.localStorage.setItem('dashModalSize_' + modal.id, w + 'x' + h); } catch (err) {}
      }
    }
    function onUp() {
      document.body.classList.remove('modal-resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function restoreModalSize_(modal) {
  if (!modal) return;
  const card = modal.querySelector('.modal-card');
  if (!card) return;
  let saved = null;
  try { saved = window.localStorage.getItem('dashModalSize_' + modal.id); } catch (err) {}
  if (!saved) return;
  const m = String(saved).split('x').map(Number);
  if (m.length !== 2 || !isFinite(m[0]) || !isFinite(m[1])) return;
  if (m[0] >= 280 && m[1] >= 200) {
    card.style.width = m[0] + 'px';
    card.style.maxWidth = 'none';
    card.style.height = m[1] + 'px';
    card.style.maxHeight = 'none';
  }
}

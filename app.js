/**
 * ============================================================
 * India Post Dashboard — Client
 * i18n.js
 * Lightweight internationalization module. Supports English (default)
 * and Hindi. Translations are lazy-loaded on first use. All UI-facing
 * strings go through t() so the language can be switched at runtime.
 *
 * Usage:
 *   i18n.setLanguage('hi');   // switch to Hindi
 *   i18n.t('dashboard.title') // 'भारतीय डाक डैशबोर्ड'
 *   i18n.t('dashboard.title', 'en') // 'India Post Dashboard'
 * ============================================================
 */

var i18n = (function () {
  'use strict';

  var currentLang = (function () {
    try { return localStorage.getItem('indiaPostLang') || 'en'; } catch (e) { return 'en'; }
  })();

  /* ── Translation dictionaries ────────────────────────────────────────── */
  var translations = {
    en: {
      // Navigation & chrome
      'nav.dashboard': 'Dashboard',
      'nav.analytics': 'Analytics',
      'nav.audit': 'Audit Log',
      'nav.reports': 'Reports',
      'nav.tasks': 'Tasks',
      'nav.settings': 'Settings',
      'nav.signout': 'Sign out',

      // Dashboard
      'dashboard.title': 'India Post Dashboard',
      'dashboard.subtitle': 'Circle Office Haryana',
      'dashboard.total': 'Total Records',
      'dashboard.flagged': 'Review Due',
      'dashboard.normal': 'Normal',
      'dashboard.sectors': 'Sectors',
      'dashboard.search': 'Search records…',
      'dashboard.addRecord': 'Add record',
      'dashboard.refresh': 'Refresh',
      'dashboard.viewCards': 'Cards',
      'dashboard.viewTable': 'Table',
      'dashboard.markAllRead': 'Mark all as read',

      // Record actions
      'record.edit': 'Edit',
      'record.delete': 'Delete',
      'record.update': 'Update',
      'record.review': 'Review',
      'record.markDone': 'Mark review done',
      'record.markNotDone': 'Mark review not done',
      'record.documents': 'Documents',
      'record.submissions': 'Updates',
      'record.aiInsight': 'AI Insight',
      'record.analyzeLink': 'Analyze link',

      // Tasks
      'tasks.title': 'Tasks',
      'tasks.create': 'Create task',
      'tasks.open': 'Open',
      'tasks.inProgress': 'In Progress',
      'tasks.done': 'Done',
      'tasks.cancelled': 'Cancelled',
      'tasks.priority': 'Priority',
      'tasks.assignee': 'Assignee',
      'tasks.dueDate': 'Due date',
      'tasks.complete': 'Complete',

      // Audit
      'audit.title': 'Audit Log',
      'audit.export': 'Export CSV',
      'audit.copy': 'Copy',
      'audit.print': 'Print',
      'audit.clear': 'Clear log',
      'audit.delete': 'Delete selected',

      // Reports
      'reports.title': 'Reports',
      'reports.summary': 'Summary',
      'reports.detailed': 'Detailed',
      'reports.flagged': 'Flagged only',
      'reports.exportXlsx': 'Export XLSX',
      'reports.downloadPdf': 'Download PDF',
      'reports.email': 'Email report',

      // Settings
      'settings.title': 'Settings',
      'settings.users': 'User Management',
      'settings.password': 'Change Password',
      'settings.currentPassword': 'Current password',
      'settings.newPassword': 'New password',
      'settings.theme': 'Theme',
      'settings.darkMode': 'Dark mode',
      'settings.language': 'Language',
      'settings.hindi': 'हिन्दी',
      'settings.english': 'English',
      'settings.backup': 'Full backup',
      'settings.sync': 'Sync from sheet',

      // Auth
      'auth.login': 'Sign in',
      'auth.email': 'Email or username',
      'auth.password': 'Password',
      'auth.forgotPassword': 'Forgot password?',
      'auth.changePassword': 'Change password',
      'auth.mustChange': 'You must change your password before continuing.',

      // Submissions
      'submissions.title': 'Updates',
      'submissions.placeholder': 'Type your update…',
      'submissions.submit': 'Submit',
      'submissions.noUpdates': 'No updates yet.',

      // Meetings
      'meetings.title': 'Meeting Notes',
      'meetings.record': 'Record',
      'meetings.upload': 'Upload audio',
      'meetings.transcribe': 'Transcribe & summarize',
      'meetings.recording': 'Recording…',

      // Common
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.confirm': 'Confirm',
      'common.loading': 'Loading…',
      'common.error': 'An error occurred',
      'common.retry': 'Retry',
      'common.close': 'Close',
      'common.export': 'Export',
      'common.import': 'Import',
      'common.yes': 'Yes',
      'common.no': 'No',
      'common.today': 'Today',
      'common.yesterday': 'Yesterday',
      'common.earlier': 'Earlier',

      // About
      'about.title': 'About',
      'about.version': 'Version',
      'about.build': 'Build',
      'about.designedBy': 'Designed, developed and maintained by Circle Office, Haryana',
    },

    hi: {
      // Navigation & chrome
      'nav.dashboard': 'डैशबोर्ड',
      'nav.analytics': 'विश्लेषण',
      'nav.audit': 'ऑडिट लॉग',
      'nav.reports': 'रिपोर्ट',
      'nav.tasks': 'कार्य',
      'nav.settings': 'सेटिंग्स',
      'nav.signout': 'साइन आउट',

      // Dashboard
      'dashboard.title': 'भारतीय डाक डैशबोर्ड',
      'dashboard.subtitle': 'सर्कल कार्यालय हरियाणा',
      'dashboard.total': 'कुल रिकॉर्ड',
      'dashboard.flagged': 'समीक्षा बाकी',
      'dashboard.normal': 'सामान्य',
      'dashboard.sectors': 'क्षेत्र',
      'dashboard.search': 'रिकॉर्ड खोजें…',
      'dashboard.addRecord': 'रिकॉर्ड जोड़ें',
      'dashboard.refresh': 'रीफ्रेश',
      'dashboard.viewCards': 'कार्ड',
      'dashboard.viewTable': 'तालिका',
      'dashboard.markAllRead': 'सभी पढ़ा चिह्नित करें',

      // Record actions
      'record.edit': 'संपादित करें',
      'record.delete': 'हटाएं',
      'record.update': 'अपडेट करें',
      'record.review': 'समीक्षा',
      'record.markDone': 'समीक्षा पूर्ण चिह्नित करें',
      'record.markNotDone': 'समीक्षा अपूर्ण चिह्नित करें',
      'record.documents': 'दस्तावेज़',
      'record.submissions': 'अपडेट',
      'record.aiInsight': 'AI अंतर्दृष्टि',
      'record.analyzeLink': 'लिंक का विश्लेषण करें',

      // Tasks
      'tasks.title': 'कार्य',
      'tasks.create': 'कार्य बनाएं',
      'tasks.open': 'खुला',
      'tasks.inProgress': 'प्रगति में',
      'tasks.done': 'पूर्ण',
      'tasks.cancelled': 'रद्द',
      'tasks.priority': 'प्राथमिकता',
      'tasks.assignee': 'जिम्मेदार',
      'tasks.dueDate': 'नियत तिथि',
      'tasks.complete': 'पूर्ण करें',

      // Audit
      'audit.title': 'ऑडिट लॉग',
      'audit.export': 'CSV निर्यात',
      'audit.copy': 'कॉपी',
      'audit.print': 'प्रिंट',
      'audit.clear': 'लॉग साफ़ करें',
      'audit.delete': 'चयनित हटाएं',

      // Reports
      'reports.title': 'रिपोर्ट',
      'reports.summary': 'सारांश',
      'reports.detailed': 'विस्तृत',
      'reports.flagged': 'केवल समीक्षा बाकी',
      'reports.exportXlsx': 'XLSX निर्यात',
      'reports.downloadPdf': 'PDF डाउनलोड',
      'reports.email': 'रिपोर्ट ईमेल करें',

      // Settings
      'settings.title': 'सेटिंग्स',
      'settings.users': 'उपयोगकर्ता प्रबंधन',
      'settings.password': 'पासवर्ड बदलें',
      'settings.currentPassword': 'वर्तमान पासवर्ड',
      'settings.newPassword': 'नया पासवर्ड',
      'settings.theme': 'थीम',
      'settings.darkMode': 'डार्क मोड',
      'settings.language': 'भाषा',
      'settings.hindi': 'हिन्दी',
      'settings.english': 'English',
      'settings.backup': 'पूर्ण बैकअप',
      'settings.sync': 'शीट से सिंक',

      // Auth
      'auth.login': 'साइन इन',
      'auth.email': 'ईमेल या उपयोगकर्ता नाम',
      'auth.password': 'पासवर्ड',
      'auth.forgotPassword': 'पासवर्ड भूल गए?',
      'auth.changePassword': 'पासवर्ड बदलें',
      'auth.mustChange': 'जारी रखने के लिए आपको अपना पासवर्ड बदलना होगा।',

      // Submissions
      'submissions.title': 'अपडेट',
      'submissions.placeholder': 'अपना अपडेट लिखें…',
      'submissions.submit': 'जमा करें',
      'submissions.noUpdates': 'अभी तक कोई अपडेट नहीं।',

      // Meetings
      'meetings.title': 'बैठक नोट्स',
      'meetings.record': 'रिकॉर्ड',
      'meetings.upload': 'ऑडियो अपलोड',
      'meetings.transcribe': 'ट्रांसक्राइब और सारांश',
      'meetings.recording': 'रिकॉर्डिंग…',

      // Common
      'common.save': 'सहेजें',
      'common.cancel': 'रद्द करें',
      'common.delete': 'हटाएं',
      'common.confirm': 'पुष्टि करें',
      'common.loading': 'लोड हो रहा है…',
      'common.error': 'एक त्रुटि हुई',
      'common.retry': 'पुनः प्रयास करें',
      'common.close': 'बंद करें',
      'common.export': 'निर्यात',
      'common.import': 'आयात',
      'common.yes': 'हाँ',
      'common.no': 'नहीं',
      'common.today': 'आज',
      'common.yesterday': 'कल',
      'common.earlier': 'पहले',

      // About
      'about.title': 'परिचय',
      'about.version': 'संस्करण',
      'about.build': 'बिल्ड',
      'about.designedBy': 'डिज़ाइन, विकसित और रखरखाव: सर्कल कार्यालय, हरियाणा',
    }
  };

  /**
   * Returns the translated string for the given key.
   * Falls back to English, then to the key itself.
   * @param {string} key - Dot-notation translation key
   * @param {string} [lang] - Override language (default: current)
   * @returns {string}
   */
  function t(key, lang) {
    var useLang = lang || currentLang;
    var dict = translations[useLang] || translations.en || {};
    if (dict[key]) return dict[key];
    // Fallback to English
    if (useLang !== 'en' && translations.en && translations.en[key]) return translations.en[key];
    // Fallback to key itself (so missing translations are visible)
    return key;
  }

  /**
   * Switches the active language and persists the choice.
   * @param {string} lang - 'en' or 'hi'
   */
  function setLanguage(lang) {
    currentLang = (lang === 'hi') ? 'hi' : 'en';
    try { localStorage.setItem('indiaPostLang', currentLang); } catch (e) {}
    // Update the html lang attribute
    document.documentElement.lang = currentLang === 'hi' ? 'hi' : 'en';
    // Emit event so UI can re-render
    if (typeof EventBus !== 'undefined' && EventBus.emit) {
      EventBus.emit('LanguageChanged', { language: currentLang });
    }
  }

  /**
   * Returns the current language code.
   * @returns {string} 'en' or 'hi'
   */
  function getLanguage() {
    return currentLang;
  }

  /**
   * Applies translations to all elements with [data-i18n] attribute.
   * Text content is set from the translation dictionary.
   * Call after DOM update or language switch to re-render labels.
   */
  function applyTranslations() {
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    }
    // Also update placeholder attributes
    var placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < placeholders.length; j++) {
      var p = placeholders[j];
      var pk = p.getAttribute('data-i18n-placeholder');
      if (pk) p.setAttribute('placeholder', t(pk));
    }
  }

  /**
   * Returns a map of all keys for a given language (useful for admin UI).
   */
  function getTranslations(lang) {
    return translations[lang || currentLang] || {};
  }

  // Initialize html lang attribute
  document.documentElement.lang = currentLang === 'hi' ? 'hi' : 'en';

  return {
    t: t,
    setLanguage: setLanguage,
    getLanguage: getLanguage,
    applyTranslations: applyTranslations,
    getTranslations: getTranslations
  };
})();
'use strict';

/* ==========================================================================
   India Post Dashboard — Client (script.html)
   Renders against the enterprise design system in styles.html. All inline
   onclick handlers referenced by index.html are defined here.
   ========================================================================== */

const APP_VERSION = '1.2.0';
const APP_BUILD = '2026.08.19';
const PAGE_SIZE = 10;
const AUDIT_PAGE_SIZE = 20;
const STORAGE_THEME = 'indiaPostDarkMode';
const STORAGE_SIDEBAR = 'indiaPostSidebarCollapsed';
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
    credentials: 'include',
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
  getAppData: function () { return apiCall_('getAppData'); },
  getData: function () { return apiCall_('getData'); },
  addItem: function (item) { return apiCall_('addItem', item); },
  updateItem: function (item) { return apiCall_('updateItem', item); },
  deleteItem: function (row) { return apiCall_('deleteItem', row); },
  setRecordDisplay: function (row, displayed) { return apiCall_('setRecordDisplay', row, displayed); },
  markReviewDone: function (row) { return apiCall_('markReviewDone', row); },
  markReviewNotDone: function (row) { return apiCall_('markReviewNotDone', row); },
  login: function (email, password) { return apiCall_('login', email, password); },
  logout: function () { return apiCall_('logout'); },
  validateSession: function () { return apiCall_('validateSession'); },
  requestPasswordReset: function (email) { return apiCall_('requestPasswordReset', email); },
  changePassword: function (currentPassword, newPassword) { return apiCall_('changePassword', currentPassword, newPassword); },
  adminGetUsers: function () { return apiCall_('adminGetUsers'); },
  adminAddUser: function (email, username, role, password, group, department, office) { return apiCall_('adminAddUser', email, username, role, password, group, department, office); },
  adminUpdateUser: function (email, fields) { return apiCall_('adminUpdateUser', email, fields); },
  adminExportUsers: function () { return apiCall_('adminExportUsers'); },
  adminImportUsers: function (csv) { return apiCall_('adminImportUsers', csv); },
  adminGetUserActivity: function () { return apiCall_('adminGetUserActivity'); },
  adminDeleteUser: function (email) { return apiCall_('adminDeleteUser', email); },
  adminResetPassword: function (email, newPassword) { return apiCall_('adminResetPassword', email, newPassword); },
  adminEmailAllUsers: function (subject, body) { return apiCall_('adminEmailAllUsers', subject, body); },
  adminSyncFromSheet: function () { return apiCall_('adminSyncFromSheet'); },
  adminPushToSheet: function () { return apiCall_('adminPushToSheet'); },
  adminPreviewSyncFromSheet: function () { return apiCall_('adminPreviewSyncFromSheet'); },
  exportFullBackup: function () { return apiCall_('exportFullBackup'); },
  getSyncStatus: function () { return apiCall_('getSyncStatus'); },
getMyNotifications: function () { return apiCall_('getMyNotifications'); },
    generateReviewNotifications: function () { return apiCall_('generateReviewNotifications'); },
    markNotificationsRead: function (ids) { return apiCall_('markNotificationsRead', ids); },
    clearMyNotifications: function () { return apiCall_('clearMyNotifications'); },
    getNotificationPrefs: function () { return apiCall_('getNotificationPrefs'); },
    setNotificationPrefs: function (prefs) { return apiCall_('setNotificationPrefs', prefs); },
  updateNotificationState: function (id, state) { return apiCall_('updateNotificationState', id, state); },
  snoozeNotification: function (id, minutes) { return apiCall_('snoozeNotification', id, minutes); },
  dismissNotification: function (id) { return apiCall_('dismissNotification', id); },
  restoreNotification: function (id) { return apiCall_('restoreNotification', id); },
  getNotificationDigest: function () { return apiCall_('getNotificationDigest'); },
  createTask: function (params) { return apiCall_('createTask', params); },
  getTaskCounts: function () { return apiCall_('getTaskCounts'); },
  getTasks: function (filters) { return apiCall_('getTasks', filters || {}); },
  getAssignableUsers: function () { return apiCall_('getAssignableUsers'); },
  getMyTasks: function () { return apiCall_('getMyTasks'); },
  updateTask: function (id, fields) { return apiCall_('updateTask', id, fields); },
  deleteTask: function (id) { return apiCall_('deleteTask', id); },
  getDashboardPreferences: function () { return apiCall_('getDashboardPreferences'); },
  saveDashboardPreferences: function (prefs) { return apiCall_('saveDashboardPreferences', prefs); },
  getReportTemplates: function () { return apiCall_('getReportTemplates'); },
  getReportData: function (templateKey) { return apiCall_('getReportData', templateKey); },
  getRecordDocuments: function (row) { return apiCall_('getRecordDocuments', row); },
  getDocuments: function () { return apiCall_('getAllDocuments'); },
  getRecordHistory: function (row) { return apiCall_('getRecordHistory', row); },
  uploadDocument: function (row, recordId, fileName, fileBytes, mimeType) { return apiCall_('uploadDocument', row, recordId, fileName, fileBytes, mimeType); },
  deleteDocument: function (docId) { return apiCall_('deleteDocument', docId); },
  setDocumentKeep: function (docId, keep) { return apiCall_('setDocumentKeep', docId, keep); },
  getSubmissions: function (cardRow) { return apiCall_('getSubmissions', cardRow); },
  addSubmission: function (cardRow, cardId, text, attachment) { return apiCall_('addSubmission', cardRow, cardId, text, attachment || null); },
  updateSubmission: function (submissionId, text, attachment) { return apiCall_('updateSubmission', submissionId, text, attachment || null); },
  getMyDivisionalDashboard: function () { return apiCall_('getMyDivisionalDashboard'); },
  setMyDivisionalDashboard: function (url) { return apiCall_('setMyDivisionalDashboard', url); },
  getDivisionalDashboardLinks: function () { return apiCall_('getDivisionalDashboardLinks'); },
  adminSetDivisionalDashboard: function (email, url) { return apiCall_('adminSetDivisionalDashboard', email, url); },
  lockSubmission: function (submissionId) { return apiCall_('lockSubmission', submissionId); },
  unlockSubmission: function (submissionId) { return apiCall_('unlockSubmission', submissionId); },
  deleteSubmission: function (submissionId) { return apiCall_('deleteSubmission', submissionId); },
  toggleSubmissionDisplay: function (submissionId) { return apiCall_('toggleSubmissionDisplay', submissionId); },
  markAllSubmissionsRead: function () { return apiCall_('markAllSubmissionsRead'); },
  getInstructionEntries: function (cardRow) { return apiCall_('getInstructionEntries', cardRow); },
  addInstructionEntry: function (cardRow, cardId, text, attachment) { return apiCall_('addInstructionEntry', cardRow, cardId, text, attachment || null); },
  updateInstructionEntry: function (entryId, text, attachment) { return apiCall_('updateInstructionEntry', entryId, text, attachment || null); },
  deleteInstructionEntry: function (entryId) { return apiCall_('deleteInstructionEntry', entryId); },
  getAuditEntries: function (limit) { return apiCall_('getAuditEntries', limit || 80); },
  adminDeleteAuditRows: function (rowNumbers) { return apiCall_('adminDeleteAuditRows', rowNumbers); },
  adminClearAudit: function () { return apiCall_('adminClearAudit'); },
  exportToSpreadsheet: function () { return apiCall_('exportToSpreadsheet'); },
  createPdfReport: function () { return apiCall_('createPdfReport'); },
  emailReport: function (recipient, templateKey) { return apiCall_('emailReport', recipient, templateKey); },
  exportReviewCalendarIcs: function () { return apiCall_('exportReviewCalendarIcs'); },
  sendWhatsAppReviewReminders: function () { return apiCall_('sendWhatsAppReviewReminders'); },
  getAiInsights: function () { return apiCall_('getAiInsights'); },
  getCardAiInsight: function (row) { return apiCall_('getCardAiInsight', row); },
  getLinkContentAiInsight: function (row) { return apiCall_('getLinkContentAiInsight', row); },
  askLinkAi: function (row, question) { return apiCall_('askLinkAi', row, question); },
  askDashboardAi: function (question, context) { return apiCall_('askDashboardAi', question, context); },
  getAllAskLinkHistory: function () { return apiCall_('getAllAskLinkHistory'); },
  saveAskLinkHistory: function (row, history) { return apiCall_('saveAskLinkHistory', row, history); },
  processMeetingRecording: function (payload) { return apiCall_('processMeetingRecording', payload); },
  transcribeMeetingSegment: function (payload) { return apiCall_('transcribeMeetingSegment', payload); },
  generateMeetingMinutes: function (payload) { return apiCall_('generateMeetingMinutes', payload); },
  listMeetingFiles: function () { return apiCall_('listMeetingFiles'); },
  getMeetingFile: function (name) { return apiCall_('getMeetingFile', name); },
  deleteMeetingFile: function (name) { return apiCall_('deleteMeetingFile', name); },
  getFathomStatus: function () { return apiCall_('getFathomStatus'); },
  setFathomApiKey: function (apiKey) { return apiCall_('setFathomApiKey', apiKey); },
  listFathomMeetings: function (opts) { return apiCall_('listFathomMeetings', opts || {}); },
  getFathomMeetingContent: function (recordingId) { return apiCall_('getFathomMeetingContent', recordingId); },
  getRecordingDownloadLink: function (recordingId) { return apiCall_('getRecordingDownloadLink', recordingId); },
  listFathomUsers: function () { return apiCall_('listFathomUsers'); },
  searchFathomMeetings: function (opts) { return apiCall_('searchFathomMeetings', opts || {}); },
  getFathomMeetingStats: function () { return apiCall_('getFathomMeetingStats'); },
  bulkGetRecordingDownloadLinks: function (recordingIds) { return apiCall_('bulkGetRecordingDownloadLinks', recordingIds); },
  // Push notifications
  subscribePush: function (subscription) { return apiCall_('subscribePush', subscription); },
  unsubscribePush: function (endpoint) { return apiCall_('unsubscribePush', endpoint); },
  sendReviewDeadlinePushNotifications: function () { return apiCall_('sendReviewDeadlinePushNotifications'); },
  // Weekly reports
  sendWeeklyReport: function () { return apiCall_('sendWeeklyReport'); },
  // i18n
  getTranslations: function (lang) { return apiCall_('getTranslations', lang); },
  // Session refresh
  refreshSession: function () { return apiCall_('refreshSession'); },
  // Admin CSV import
  adminImportCsv: function (csvText) { return apiCall_('adminImportCsv', csvText); },
  // Part 17 — admin System Health
  getSystemHealth: function () { return apiCall_('getSystemHealth'); },
  getAnalytics: function (range) { return apiCall_('getAnalytics', range || { days: 30 }); },
  listAutomationRules: function () { return apiCall_('listAutomationRules'); },
  saveAutomationRule: function (rule) { return apiCall_('saveAutomationRule', rule); },
  deleteAutomationRule: function (id) { return apiCall_('deleteAutomationRule', id); },
  runAutomationNow: function () { return apiCall_('runAutomationNow'); },
  getSecurityStatus: function () { return apiCall_('getSecurityStatus'); },
  rotateSession: function () { return apiCall_('rotateSession'); }
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
  // Per-row "hide the update blocks on the dashboard card / detail modal"
  // state, persisted per-browser in localStorage so a user's show/hide
  // choices survive reloads, pagination and background re-renders.
  updatesHiddenByRow: {},
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
  dashShowHidden: false,
  permissions: {},
  notifications: { unread: 0, recent: [] },
  notifPrefs: null
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
  applyNavPermissions();
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

function linkableHref(value) {
  const url = String(value == null ? '' : value).trim();
  if (!url) return '';
  if (/^www\./i.test(url)) return 'https://' + url;
  if (/^(https?|mailto|tel):/i.test(url)) return url;
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(\/[^\s]*)?$/i.test(url)) {
    return 'https://' + url;
  }
  return '';
}

function renderLinkableText(value) {
  const text = value == null ? '' : String(value);
  if (!text) return '';
  const normalized = text.trim();
  if (!normalized) return '';
  const href = linkableHref(normalized);
  if (!href) return escapeHtml(text);
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

/* The per-page CSP nonce, stamped by the server onto the app bundle's
 * <script> tag (see src/server/csp.js stampCspNonce). Print windows are
 * about:blank documents that inherit this page's CSP — including its nonce —
 * so document.write() builders must re-stamp the same value onto their own
 * inline <script> blocks or they'll be refused. Returns '' when no nonce is
 * present (e.g. file:// or a non-nonce environment). */
function pageCspNonce() {
  const el = document.querySelector('script[nonce]');
  return el ? (el.getAttribute('nonce') || '') : '';
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
    info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>'
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

var dialogReturnFocus_ = {};

function getDialogFocusable_(modal) {
  if (!modal) return [];
  const nodes = modal.querySelectorAll(
    'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return Array.prototype.filter.call(nodes, function (el) {
    return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
  });
}

function topOpenDialog_() {
  const modals = document.querySelectorAll('.modal-backdrop:not(.hidden)');
  return modals.length ? modals[modals.length - 1] : null;
}

function openDialog(id) {
  const modal = getEl(id);
  if (!modal) return;
  /* In fullscreen (presentation mode) the browser's top layer hides anything
     outside the fullscreen element, so a body-level modal would render behind
     it. Park it inside the fullscreen element so it stays visible. */
  parkModalForFullscreen_(modal);
  const active = document.activeElement;
  if (active && active !== document.body && active !== document.documentElement &&
      typeof active.focus === 'function' && !modal.contains(active)) {
    dialogReturnFocus_[id] = active;
  }
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  restoreModalSize_(modal);
  const focusable = getDialogFocusable_(modal);
  if (focusable.length) focusable[0].focus();
}

function closeDialog(id) {
  const modal = getEl(id);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.modal-backdrop:not(.hidden)')) {
    document.body.classList.remove('modal-open');
  }
  const returnEl = dialogReturnFocus_[id];
  delete dialogReturnFocus_[id];
  if (returnEl && document.contains(returnEl) && typeof returnEl.focus === 'function') {
    returnEl.focus();
  }
  if (typeof flushPendingAutoRefresh === 'function') flushPendingAutoRefresh();
}

/* ---------------------------------- Fullscreen modal parking ---------------------------------- */
/* When an element is fullscreen (presentation mode at fullscreen), content
   outside that element is hidden by the browser top layer — a body-level
   modal would render behind it. Park open modals inside the fullscreen
   element and restore them when fullscreen exits. */

function parkModalForFullscreen_(modal) {
  const fs = document.fullscreenElement;
  if (!fs || !modal) return;
  if (modal.parentNode && modal.parentNode === fs) return;
  modal.__modalHome = modal.parentNode || document.body;
  fs.appendChild(modal);
}

function restoreModalFromFullscreen_(modal) {
  const home = modal && modal.__modalHome;
  if (!modal || !home) return;
  delete modal.__modalHome;
  if (home.appendChild) home.appendChild(modal);
}

if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', function () {
    const anyOpen = document.querySelector('.modal-backdrop:not(.hidden)');
    if (document.fullscreenElement) {
      if (anyOpen) document.querySelectorAll('.modal-backdrop').forEach(parkModalForFullscreen_);
    } else {
      document.querySelectorAll('.modal-backdrop').forEach(restoreModalFromFullscreen_);
    }
  });
}

/* Trap Tab focus inside the top-most open dialog (WCAG 2.1.2 / 2.4.3). */
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    const modal = topOpenDialog_();
    if (!modal) return;
    const focusable = getDialogFocusable_(modal);
    if (!focusable.length) { e.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !modal.contains(active)) { e.preventDefault(); last.focus(); }
    } else if (active === last || !modal.contains(active)) {
      e.preventDefault(); first.focus();
    }
  }, true);
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

/* ---------------------------------- AI Meeting Notes ---------------------------------- */
/* Admin-only: records or uploads a review-meeting audio, transcribes it via
   Groq Whisper, saves audio + minutes to Drive and renders structured minutes.
   Action items become "Create task" buttons plus a bulk "Add all" (never
   auto-created). */

function openMeetingNotes() {
  if (!appState.isAdmin) { showToast('Admin access required', 'error'); return; }
  openDialog('meetingNotesModal');
  const title = getEl('meetingNotesTitleInput');
  const file = getEl('meetingNotesFile');
  const body = getEl('meetingNotesResult');
  const loading = getEl('meetingNotesLoading');
  const go = getEl('meetingNotesGo');
  const player = getEl('meetingNotesPlayer');
  if (meetingRecorder && meetingRecorder.state === 'recording') {
    // Reopening the dialog must NOT cancel an active recording. Restore the
    // recording UI (timer / End / Cancel) and keep capturing.
    const startBtn = getEl('meetingNotesStartBtn');
    const endBtn = getEl('meetingNotesEndBtn');
    const cancelBtn = getEl('meetingNotesCancelBtn');
    const timer = getEl('meetingNotesRecTimer');
    if (startBtn) startBtn.style.display = 'none';
    if (endBtn) { endBtn.style.display = 'inline-flex'; endBtn.disabled = false; endBtn.textContent = 'End recording'; }
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (timer) timer.style.display = 'inline-flex';
    if (go) { go.disabled = true; go.textContent = 'Recording\u2026'; }
    if (loading) loading.style.display = 'none';
    startMeetingRecTimer();
  } else {
    if (title) title.value = '';
    if (file) file.value = '';
    if (body) body.innerHTML = '';
    if (loading) loading.style.display = 'none';
    if (go) go.disabled = false;
    if (player) { player.removeAttribute('src'); player.style.display = 'none'; }
    resetMeetingRecUi_();
    setMeetingRecStatus('');
  }
  syncMeetingRecFloat_();
  initFathomPanel();
  loadPreviousMeetings();
}

function closeMeetingNotes() {
  closeDialog('meetingNotesModal');
  // A live recording keeps running in the background; the floating indicator
  // lets the user reopen the dialog and stop it later.
  syncMeetingRecFloat_();
}

/* Previous recordings + notes saved on the server (data/meetings). Admin-only,
   like the rest of the meeting-notes feature. Notes download as editable
   markdown; audio downloads as the original file. Delete removes from the
   server (and its backup) permanently. The search box filters client-side by
   title, file name, or formatted date. */
let previousMeetingsCache = null;

function loadPreviousMeetings() {
  const list = getEl('previousMeetingsList');
  if (!list) return;
  list.innerHTML = '<p class="meeting-notes-hint" style="padding:6px 0;">Loading saved recordings &amp; notes\u2026</p>';
  ApiService.listMeetingFiles().then(function (data) {
    if (!data || data.success !== true) {
      list.innerHTML = '<p class="meeting-notes-hint" style="padding:6px 0;">' +
        escapeHtml((data && data.message) || 'Could not load saved meetings.') + '</p>';
      return;
    }
    previousMeetingsCache = data;
    renderPreviousMeetings_();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    list.innerHTML = '<p class="meeting-notes-hint" style="padding:6px 0;">' +
      escapeHtml(err && err.message ? err.message : String(err)) + '</p>';
  });
}

function filterPreviousMeetings() {
  renderPreviousMeetings_();
}

function localDayKey_(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  const pad = function (v) { return String(v).padStart(2, '0'); };
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
}

function previousMeetingGroup_(modified) {
  const k = localDayKey_(modified);
  if (!k) return 'earlier';
  const todayKey = localDayKey_(new Date());
  if (k === todayKey) return 'today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (k === localDayKey_(y)) return 'yesterday';
  return 'earlier';
}

function renderPreviousMeetings_() {
  const list = getEl('previousMeetingsList');
  const input = getEl('meetingsSearchInput');
  if (!list) return;
  const data = previousMeetingsCache;
  if (!data) {
    list.innerHTML = '<p class="meeting-notes-hint" style="padding:6px 0;">No saved meetings yet — recordings and notes appear here after you transcribe one.</p>';
    return;
  }
  const q = input ? String(input.value || '').trim().toLowerCase() : '';
  const matches = function (f) {
    if (!q) return true;
    const hay = ((f.title || '') + ' ' + (f.name || '') + ' ' + formatTimestamp(f.modified)).toLowerCase();
    return hay.indexOf(q) !== -1;
  };
  const itemRow = function (f) {
    const kind = /\.md$/i.test(f.name) ? 'notes (.md)' : 'recording';
    return '<div class="fathom-meeting-item">' +
      '<div class="fathom-meeting-title">' + escapeHtml(f.title) + '</div>' +
      '<div class="fathom-meeting-meta">' + escapeHtml(formatTimestamp(f.modified)) + ' &middot; ' +
      formatFileSize(f.size) + ' &middot; ' + kind + '</div>' +
      '<div class="fathom-meeting-actions">' +
      '<button class="btn btn-small btn-secondary" type="button" onclick="downloadMeetingFile(\'' + escapeAttr(f.name) + '\')">Download</button>' +
      '<button class="btn btn-small btn-danger-ghost" type="button" onclick="deleteMeetingFile(\'' + escapeAttr(f.name) + '\')">Delete</button>' +
      '</div></div>';
  };
  const all = (data.notes || []).concat(data.audio || []).filter(matches);
  if (!all.length) {
    list.innerHTML = '<p class="meeting-notes-hint" style="padding:6px 0;">' +
      (q ? 'No saved meetings match \u201C' + escapeHtml(input ? input.value : '') + '\u201D.' : 'No saved meetings yet — recordings and notes appear here after you transcribe one.') +
      '</p>';
    return;
  }
  const groups = { today: [], yesterday: [], earlier: [] };
  all.forEach(function (f) { groups[previousMeetingGroup_(f.modified)].push(f); });
  const labels = { today: 'Today', yesterday: 'Yesterday', earlier: 'Earlier' };
  let html = '<div class="meeting-notes-list">';
  ['today', 'yesterday', 'earlier'].forEach(function (g) {
    if (!groups[g].length) return;
    html += '<div class="meeting-date-group">' + labels[g] + '</div>';
    groups[g].forEach(function (f) { html += itemRow(f); });
  });
  html += '</div>';
  list.innerHTML = html;
}

function downloadMeetingFile(name) {
  if (!name) return;
  showOverlay('Preparing download\u2026');
  ApiService.getMeetingFile(name).then(function (data) {
    hideOverlay();
    if (!data || data.success !== true) {
      showToast((data && data.message) || 'Could not download the file.', 'error');
      loadPreviousMeetings();
      return;
    }
    let bytes;
    try {
      bytes = atob(data.base64);
    } catch (err) {
      showToast('Could not decode the file.', 'error');
      return;
    }
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: data.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = data.name || name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    showToast('Downloaded ' + (data.name || name), 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Download failed: ' + (err && err.message ? err.message : String(err)), 'error');
  });
}

function deleteMeetingFile(name) {
  if (!name) return;
  if (!window.confirm('Delete \u201C' + name + '\u201D from the server? This cannot be undone.')) return;
  ApiService.deleteMeetingFile(name).then(function (data) {
    if (data && data.success === true) {
      showToast('Deleted ' + name, 'success');
    } else {
      showToast((data && data.message) || 'Could not delete the file.', 'error');
    }
    loadPreviousMeetings();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Delete failed: ' + (err && err.message ? err.message : String(err)), 'error');
    loadPreviousMeetings();
  });
}

function processMeetingNotes() {
  const fileInput = getEl('meetingNotesFile');
  const go = getEl('meetingNotesGo');
  const loading = getEl('meetingNotesLoading');
  const body = getEl('meetingNotesResult');
  let file = null;
  if (fileInput && fileInput.files && fileInput.files.length) {
    file = fileInput.files[0];
  } else if (meetingRecBlob) {
    file = new File([meetingRecBlob], meetingRecordingFileName_(), { type: meetingRecMimeType });
  }
  if (!file) {
    showToast('Record or choose an audio file first.', 'warning');
    return;
  }
  const titleEl = getEl('meetingNotesTitleInput');
  const title = titleEl ? titleEl.value.trim() : '';
  if (go) go.disabled = true;
  if (loading) loading.style.display = 'flex';
  if (body) body.innerHTML = '';

  // Files over the 25 MB cap cannot be sent in one request; re-encode locally
  // into ~5-minute segments so the raw file never crosses the limit. Long
  // recordings also go straight to segments: a single request on a long file
  // makes Groq churn for minutes and can trip Cloudflare's origin timeout.
  if (file.size > 25 * 1024 * 1024) {
    processMeetingNotesSegmented(file, title, go, loading);
    return;
  }

  readAudioBuffer_(file).then(function (audioBuffer) {
    if (audioBuffer.duration > MEETING_SEGMENT_SECONDS * 2) {
      processMeetingNotesSegmented(file, title, go, loading);
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      const base64 = String(reader.result || '').replace(/^data:[^;]*;base64,/, '');
      ApiService.processMeetingRecording({
        title: title,
        base64: base64,
        mimeType: file.type || 'audio/mpeg',
        fileName: file.name
      }).then(function (data) {
        if (!data || data.success !== true) {
          const msg = (data && data.message) || 'Could not process the recording.';
          // Groq rejects some encodings (e.g. mixed sample-rate VBR MP3) with a
          // generic "Internal Server Error". Retry through the local re-encode path.
          if (msg === 'Internal Server Error') {
            return processMeetingNotesSegmented(file, title, go, loading);
          }
          showToast(msg, 'error');
          renderMeetingMinutesError(msg);
          return;
        }
        renderMeetingMinutes(data);
      }).catch(function (err) {
        if (handleServerFailure(err)) return;
        const msg = err && err.message ? err.message : String(err || 'Unknown error');
        // Timeouts (e.g. Cloudflare 524 while Groq churns through a long file)
        // and transient failures retry through the local re-encode path.
        if (/^HTTP \d{3}/.test(msg)) {
          return processMeetingNotesSegmented(file, title, go, loading);
        }
        showToast(msg, 'error');
        renderMeetingMinutesError(msg);
      }).then(function () {
        if (go) go.disabled = false;
        if (go) go.textContent = 'Transcribe & summarize';
        if (loading) loading.style.display = 'none';
        resetMeetingRecUi_();
      });
    };
    reader.onerror = function () {
      showToast('Could not read the audio file.', 'error');
      if (go) go.disabled = false;
    };
    reader.readAsDataURL(file);
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    const msg = err && err.message ? err.message : String(err || 'Unknown error');
    showToast(msg, 'error');
    renderMeetingMinutesError(msg);
    if (go) go.disabled = false;
  });
}

/* Fallback for recordings that exceed the 25 MB single-request cap or that
   Groq refuses to decode: decode in the browser, split into ~5-minute chunks,
   re-encode each as a compact 16 kHz mono WAV, then transcribe + draft minutes
   via sequential API calls. Each segment is retried on transient failures and
   the run continues past a bad segment instead of aborting everything. */
const MEETING_SEGMENT_SECONDS = 5 * 60;
const MEETING_SEGMENT_SAMPLE_RATE = 16000;
const MEETING_SEGMENT_MAX_ATTEMPTS = 3;

function processMeetingNotesSegmented(file, title, go, loading) {
  if (go) go.disabled = true;
  if (loading) {
    loading.style.display = 'flex';
    setMeetingNotesLoadingText(loading, 'Decoding audio in the browser\u2026');
  }
  readAudioBuffer_(file).then(function (audioBuffer) {
    const totalSeconds = audioBuffer.duration;
    const count = Math.max(1, Math.ceil(totalSeconds / MEETING_SEGMENT_SECONDS));
    const transcripts = [];
    const failures = [];
    let index = 0;
    const runNext = function () {
      if (index >= count) {
        const combined = transcripts.join('\n').trim();
        if (!combined) {
          renderMeetingMinutesError('No segments could be transcribed' +
            (failures.length ? ' (parts ' + failures.join(', ') + ')' : '') + '.');
          return;
        }
        setMeetingNotesLoadingText(loading, 'Drafting minutes\u2026');
        return ApiService.generateMeetingMinutes({ title: title, transcript: combined }).then(function (data) {
          if (!data || data.success !== true) {
            const msg = (data && data.message) || 'Could not draft the minutes.';
            showToast(msg, 'error');
            renderMeetingMinutesError(msg);
            return;
          }
          renderMeetingMinutes(data);
        });
      }
      const partNum = index + 1;
      const start = index * MEETING_SEGMENT_SECONDS;
      const duration = Math.min(MEETING_SEGMENT_SECONDS, totalSeconds - start);
      setMeetingNotesLoadingText(loading, 'Re-encoding + transcribing part ' + partNum + ' of ' + count + '\u2026');
      return transcribeSegmentWithRetry_(audioBuffer, start, duration, partNum, title, loading).then(function (text) {
        if (text) transcripts.push(text);
        else failures.push(partNum);
        index++;
        return runNext();
      });
    };
    return runNext();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    const msg = err && err.message ? err.message : String(err || 'Unknown error');
    showToast(msg, 'error');
    renderMeetingMinutesError(msg);
  }).then(function () {
    if (go) go.disabled = false;
    if (go) go.textContent = 'Transcribe & summarize';
    if (loading) loading.style.display = 'none';
    resetMeetingRecUi_();
  });
}

/* Transcribes one segment, retrying on transient HTTP/network failures. Returns
   the transcript, or '' if the segment could not be transcribed after all
   attempts (the caller continues with the remaining segments). */
function transcribeSegmentWithRetry_(audioBuffer, start, duration, partNum, title, loading) {
  let attempt = 0;
  const tryOnce = function () {
    attempt++;
    if (attempt > 1) {
      setMeetingNotesLoadingText(loading, 'Retrying part ' + partNum + ' (attempt ' + attempt + ')\u2026');
    }
    return encodeWavSegment_(audioBuffer, start, duration).then(function (wav) {
      return ApiService.transcribeMeetingSegment({
        title: title,
        base64: wav.base64,
        mimeType: 'audio/wav',
        fileName: 'part_' + partNum + '.wav'
      });
    }).then(function (data) {
      if (!data || data.success !== true) {
        throw new Error((data && data.message) || 'Could not transcribe part ' + partNum + '.');
      }
      return String(data.transcript || '').trim();
    }).catch(function (err) {
      if (handleServerFailure(err)) throw err;
      const msg = err && err.message ? err.message : String(err || '');
      if (attempt < MEETING_SEGMENT_MAX_ATTEMPTS && /^(HTTP|TypeError|NetworkError|Failed to fetch)/.test(msg)) {
        return new Promise(function (resolve) { setTimeout(resolve, 1500 * attempt); }).then(tryOnce);
      }
      throw err;
    });
  };
  return tryOnce().catch(function () {
    return '';
  });
}

function setMeetingNotesLoadingText(loading, msg) {
  if (!loading) return;
  const span = loading.querySelector('span:last-child');
  if (span) span.textContent = msg || '';
}

function readAudioBuffer_(file) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    return Promise.reject(new Error('Audio decoding is not supported in this browser. Use Chrome, Edge, Firefox or Safari.'));
  }
  const ctx = new Ctx();
  return file.arrayBuffer().then(function (buf) {
    return ctx.decodeAudioData(buf);
  }).then(function (buffer) {
    if (ctx.close) ctx.close();
    return buffer;
  });
}

function encodeWavSegment_(audioBuffer, startSeconds, durationSeconds) {
  const rate = MEETING_SEGMENT_SAMPLE_RATE;
  const OffCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const frames = Math.max(1, Math.ceil(durationSeconds * rate));
  const off = new OffCtx(1, frames, rate);
  const src = off.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(off.destination);
  src.start(0, startSeconds, durationSeconds);
  return off.startRendering().then(function (rendered) {
    const samples = rendered.getChannelData(0);
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeStr = function (offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
    const blob = new Blob([buffer], { type: 'audio/wav' });
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve({ blob: blob, base64: String(reader.result || '').replace(/^data:[^;]*;base64,/, '') });
      };
      reader.onerror = function () { reject(new Error('Could not read the re-encoded audio.')); };
      reader.readAsDataURL(blob);
    });
  });
}

function renderMeetingMinutesError(msg) {
  const body = getEl('meetingNotesResult');
  if (!body) return;
  body.innerHTML = '<div class="meeting-notes-error">' + escapeHtml(msg) + '</div>';
}

function renderMeetingMinutes(data) {
  const body = getEl('meetingNotesResult');
  if (!body) return;
  const minutes = (data && data.minutes) || {};
  const summary = String(minutes.summary || '').trim();
  const decisions = Array.isArray(minutes.decisions) ? minutes.decisions : [];
  const actions = Array.isArray(minutes.actionItems) ? minutes.actionItems : [];
  const risks = Array.isArray(minutes.risks) ? minutes.risks : [];
  const meetingTitle = String((data && data.title) || 'Review meeting');
  const highlights = Array.isArray(data && data.highlights) ? data.highlights : [];
  let html = '<div class="meeting-notes-wrap">';
  if (data && data.fathomUrl) {
    html += '<div class="meeting-notes-drive">' +
      '<span>&#128279; Fathom recording: <a href="' + escapeHtml(data.fathomUrl) + '" target="_blank" rel="noopener noreferrer">Open in Fathom</a></span>' +
      '</div>';
  }
  if (highlights.length) {
    html += '<div class="card-ai-head"><span class="card-ai-title">Highlights (' + highlights.length + ')</span></div>' +
      '<div class="meeting-notes-section"><ul class="meeting-notes-list">';
    highlights.forEach(function (h) {
      const title = escapeHtml(h.title || 'Highlight');
      const note = h.note ? '<br><small>' + escapeHtml(h.note) + '</small>' : '';
      const time = h.startTime ? ' (' + formatTimestamp(h.startTime) + (h.endTime ? ' - ' + formatTimestamp(h.endTime) : '') + ')' : '';
      html += '<li><strong>' + title + '</strong>' + time + note + '</li>';
    });
    html += '</ul></div>';
  }
  if (summary) {
    html += '<div class="card-ai-head"><span class="card-ai-title">Summary</span></div>' +
      '<div class="meeting-notes-section"><p>' + escapeHtml(summary) + '</p></div>';
  }
  if (actions.length) {
    html += '<div class="card-ai-head"><span class="card-ai-title">Action items (' + actions.length + ')</span>' +
      '<button class="btn btn-small btn-secondary" type="button" onclick="addAllMeetingTasks()">Add all as tasks</button></div>' +
      '<table class="card-ai-table meeting-notes-table"><thead><tr>' +
      '<th>Task</th><th>Assignee</th><th>Priority</th><th>Due</th><th></th>' +
      '</tr></thead><tbody>';
    actions.forEach(function (a, i) {
      const task = String((a && a.task) || '').trim() || ('Action item ' + (i + 1));
      const assignee = String((a && a.assignee) || '').trim();
      const priority = String((a && a.priority) || 'MEDIUM').toUpperCase();
      const due = String((a && a.dueDate) || '').trim();
      html += '<tr>' +
        '<td>' + escapeHtml(task) + '</td>' +
        '<td>' + escapeHtml(assignee || '\u2014') + '</td>' +
        '<td><span class="meeting-priority" data-priority="' + escapeHtml(priority) + '">' + escapeHtml(priority) + '</span></td>' +
        '<td>' + escapeHtml(due || '\u2014') + '</td>' +
        '<td><button class="btn btn-small btn-secondary" type="button" onclick="createTaskFromMeetingAction(this)" data-title="' + escapeHtml(task) + '" data-assignee="' + escapeHtml(assignee) + '" data-priority="' + escapeHtml(priority) + '" data-due="' + escapeHtml(due) + '">Create task</button></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
  }
  if (decisions.length) {
    html += '<div class="card-ai-head"><span class="card-ai-title">Decisions</span></div>' +
      '<ul class="meeting-notes-list">' + decisions.map(function (d) {
        return '<li>' + escapeHtml(String(d)) + '</li>';
      }).join('') + '</ul>';
  }
  if (risks.length) {
    html += '<div class="card-ai-head"><span class="card-ai-title">Risks</span></div>' +
      '<ul class="meeting-notes-list">' + risks.map(function (r) {
        return '<li>' + escapeHtml(String(r)) + '</li>';
      }).join('') + '</ul>';
  }
  if (data && data.minutesText && !summary && !decisions.length && !actions.length && !risks.length) {
    html += '<div class="card-ai-head"><span class="card-ai-title">Minutes</span></div>' +
      '<div class="meeting-notes-section"><p>' + escapeHtml(data.minutesText) + '</p></div>';
  }
  if (data && data.transcript) {
    const chars = data.transcriptChars || data.transcript.length;
    html += '<div class="card-ai-head"><span class="card-ai-title">Full transcript (' + chars + ' chars)</span>' +
      '<button class="btn btn-small btn-ghost" type="button" onclick="toggleMeetingTranscript()">Show</button></div>' +
      '<div id="meetingTranscript" class="meeting-notes-transcript hidden"><pre>' + escapeHtml(data.transcript) + '</pre></div>';
  }
  if (data && (data.driveAudio || data.driveMinutes)) {
    html += '<div class="card-ai-head"><span class="card-ai-title">Saved to Drive</span></div>' +
      '<div class="meeting-notes-drive">' +
      (data.driveAudio ? '<span>&#127911; <a href="' + escapeHtml(data.driveAudio.url) + '" target="_blank" rel="noopener noreferrer">Audio</a></span>' : '') +
      (data.driveAudio && data.driveMinutes ? '<span class="meeting-drive-sep">&nbsp;&middot;&nbsp;</span>' : '') +
      (data.driveMinutes ? '<span>&#128196; <a href="' + escapeHtml(data.driveMinutes.url) + '" target="_blank" rel="noopener noreferrer">Minutes</a></span>' : '') +
      '</div>';
  }
  if (html === '<div class="meeting-notes-wrap">') {
    html += '<p style="color:var(--muted);font-size:14px;">Transcription succeeded (' + escapeHtml(meetingTitle) +
      '), but no minutes were generated. Try again.</p>';
  }
  html += '</div>';
  body.innerHTML = html;
  // A fresh transcription just saved new audio + notes on the server.
  loadPreviousMeetings();
}

function toggleMeetingTranscript() {
  const pre = getEl('meetingTranscript');
  if (!pre) return;
  pre.classList.toggle('hidden');
  const head = pre.previousElementSibling;
  const btn = head ? head.querySelector('button') : null;
  if (btn) btn.textContent = pre.classList.contains('hidden') ? 'Show' : 'Hide';
}

function createTaskFromMeetingAction(btn) {
  const params = {
    title: btn.getAttribute('data-title') || '',
    description: 'Created from meeting notes: ' + (btn.getAttribute('data-title') || ''),
    assignee: btn.getAttribute('data-assignee') || '',
    priority: btn.getAttribute('data-priority') || 'MEDIUM',
    dueDate: btn.getAttribute('data-due') || ''
  };
  showOverlay('Creating task\u2026');
  ApiService.createTask(params).then(function () {
    hideOverlay();
    btn.disabled = true;
    btn.textContent = 'Created';
    showToast('Task created.', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not create task: ' + (err.message || err), 'error');
  });
}

/* Bulk-creates tasks for every action item currently rendered. */
function addAllMeetingTasks() {
  const rows = Array.prototype.slice.call(document.querySelectorAll('#meetingNotesResult .meeting-notes-table tbody tr'));
  const items = [];
  rows.forEach(function (tr) {
    const btn = tr.querySelector('button[data-title]');
    if (!btn) return;
    items.push({
      title: btn.getAttribute('data-title') || '',
      assignee: btn.getAttribute('data-assignee') || '',
      priority: btn.getAttribute('data-priority') || 'MEDIUM',
      dueDate: btn.getAttribute('data-due') || ''
    });
  });
  if (!items.length) { showToast('No action items to add.', 'warning'); return; }
  showConfirm({
    title: 'Add ' + items.length + ' task(s)?',
    message: 'Create ' + items.length + ' task(s) from the meeting action items? They will appear in the Tasks dashboard.',
    okLabel: 'Add tasks'
  }).then(function (confirmed) {
    if (!confirmed) return;
    showOverlay('Adding tasks\u2026');
    const calls = items.map(function (it) {
      return ApiService.createTask({
        title: it.title,
        description: 'Created from meeting notes: ' + it.title,
        assignee: it.assignee,
        priority: it.priority,
        dueDate: it.dueDate
      });
    });
    Promise.all(calls).then(function () {
      hideOverlay();
      rows.forEach(function (tr) {
        const btn = tr.querySelector('button[data-title]');
        if (btn) { btn.disabled = true; btn.textContent = 'Created'; }
      });
      const bulkBtn = document.querySelector('#meetingNotesResult .card-ai-head button[onclick="addAllMeetingTasks()"]');
      if (bulkBtn) { bulkBtn.disabled = true; bulkBtn.textContent = 'Added'; }
      showToast(items.length + ' task(s) created.', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not add tasks: ' + (err && err.message ? err.message : String(err)), 'error');
    });
  });
}

/* ---------------------------------- Fathom AI meeting notes ---------------------------------- */
/* Admin-only: pulls summaries/transcripts/action items recorded by Fathom into
   the AI Meeting Notes modal. API key is stored server-side via setFathomApiKey
   (Script Properties) and never committed to the repo. */

let fathomMeetingsCache = [];

function initFathomPanel() {
  const list = getEl('fathomList');
  const keyRow = getEl('fathomKeyRow');
  const loadBtn = getEl('fathomLoadBtn');
  const statsBtn = getEl('fathomStatsBtn');
  const bulkDownloadBtn = getEl('fathomBulkDownloadBtn');
  const status = getEl('fathomStatus');
  const searchInput = getEl('fathomSearchInput');
  if (list) list.innerHTML = '';
  if (keyRow) keyRow.classList.add('hidden');
  if (loadBtn) loadBtn.disabled = false;
  if (statsBtn) statsBtn.style.display = 'none';
  if (bulkDownloadBtn) bulkDownloadBtn.style.display = 'none';
  if (searchInput) searchInput.value = '';
  if (status) status.textContent = '';
  ApiService.getFathomStatus().then(function (data) {
    const f = data && data.fathom;
    if (!f) return;
    if (!f.enabled) {
      if (status) status.textContent = 'Fathom integration is not enabled on the server.';
      if (loadBtn) loadBtn.style.display = 'none';
      return;
    }
    if (!f.configured) {
      if (status) status.textContent = 'Enter a Fathom API key to pull notes (Settings \u2192 API Access).';
      if (keyRow) keyRow.classList.remove('hidden');
      if (loadBtn) loadBtn.style.display = 'none';
      return;
    }
    if (loadBtn) loadBtn.style.display = 'inline-flex';
    if (statsBtn) statsBtn.style.display = 'inline-flex';
    if (bulkDownloadBtn) bulkDownloadBtn.style.display = 'inline-flex';
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    if (status) status.textContent = err && err.message ? err.message : String(err);
  });
}

function saveFathomApiKey() {
  const input = getEl('fathomApiKeyInput');
  const key = input ? input.value.trim() : '';
  if (!key) { showToast('Paste your Fathom API key first.', 'warning'); return; }
  showOverlay('Saving key\u2026');
  ApiService.setFathomApiKey(key).then(function (res) {
    hideOverlay();
    if (res && res.ok) {
      if (input) input.value = '';
      showToast('Fathom API key saved.', 'success');
      initFathomPanel();
    } else {
      showToast((res && res.message) || 'Could not save the key.', 'error');
    }
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not save the key: ' + (err && err.message ? err.message : String(err)), 'error');
  });
}

function loadFathomMeetings() {
  const list = getEl('fathomList');
  const status = getEl('fathomStatus');
  const loadBtn = getEl('fathomLoadBtn');
  if (loadBtn) loadBtn.disabled = true;
  if (status) status.textContent = 'Loading recent Fathom meetings\u2026';
  if (list) list.innerHTML = '';
  ApiService.listFathomMeetings({}).then(function (data) {
    if (loadBtn) loadBtn.disabled = false;
    if (status) status.textContent = '';
    if (!data || data.success !== true) {
      if (status) status.textContent = (data && data.message) || 'Could not load Fathom meetings.';
      return;
    }
    fathomMeetingsCache = data.items || [];
    renderFathomMeetingList(fathomMeetingsCache);
  }).catch(function (err) {
    if (loadBtn) loadBtn.disabled = false;
    if (handleServerFailure(err)) return;
    if (status) status.textContent = err && err.message ? err.message : String(err);
  });
}

function renderFathomMeetingList(items) {
  const list = getEl('fathomList');
  const status = getEl('fathomStatus');
  if (!list) return;
  if (!items.length) {
    if (status) status.textContent = 'No Fathom meetings found yet.';
    return;
  }
  if (status) status.textContent = items.length + ' meeting(s) found \u2014 pick one to pull its notes.';
  let html = '<div class="fathom-meeting-list">';
  items.forEach(function (m, i) {
    const date = m.createdAt ? formatTimestamp(m.createdAt) : '';
    const actionCount = (m.actionItems && m.actionItems.length) || 0;
    const highlightCount = (m.highlights && m.highlights.length) || 0;
    const sharedWith = m.sharedWith || 'none';
    const meetingUrl = m.meetingUrl || '';
    const meetingHref = linkableHref(meetingUrl);
    html += '<div class="fathom-meeting-item" role="button" tabindex="0" onclick="viewFathomMeeting(' + i + ')">' +
      '<div class="fathom-meeting-title">' + escapeHtml(m.title) + '</div>' +
      '<div class="fathom-meeting-meta">' + escapeHtml(date) +
      (m.recordedBy ? ' &middot; ' + escapeHtml(m.recordedBy) : '') +
      (actionCount ? ' &middot; ' + actionCount + ' action item(s)' : '') +
      (highlightCount ? ' &middot; ' + highlightCount + ' highlight(s)' : '') +
      (sharedWith !== 'none' ? ' &middot; Shared: ' + escapeHtml(sharedWith) : '') + '</div>' +
      (meetingHref ? '<div class="fathom-meeting-meta"><a href="' + escAttr(meetingHref) + '" target="_blank" rel="noopener noreferrer">Open in Fathom</a></div>' : '') +
      (m.summary ? '<div class="fathom-meeting-summary">' + escapeHtml(m.summary.substring(0, 220)) + '</div>' : '') +
      '<div class="fathom-meeting-actions">' +
      '<span class="btn btn-small btn-secondary" style="pointer-events:none;">View notes</span>' +
      (m.recordingId ? '<button class="btn btn-small btn-ghost" type="button" onclick="event.stopPropagation(); downloadRecording(\'' + escapeAttr(m.recordingId) + '\')">Download</button>' : '') +
      '</div>' +
      '</div>';
  });
  html += '</div>';
  list.innerHTML = html;
}

function viewFathomMeeting(index) {
  const m = fathomMeetingsCache[index];
  if (!m) return;
  const body = getEl('meetingNotesResult');
  if (body) body.innerHTML = '<p class="meeting-notes-hint">Loading Fathom notes\u2026</p>';
  ApiService.getFathomMeetingContent(m.recordingId).then(function (data) {
    if (!data || data.success !== true) {
      renderMeetingMinutesError((data && data.message) || 'Could not load this meeting\u2019s content.');
      return;
    }
    const actionItems = (m.actionItems || []).map(function (a) {
      return {
        task: a.task || '',
        assignee: a.assignee || '',
        priority: 'MEDIUM',
        dueDate: ''
      };
    });
    // Merge highlights from both the meeting card and the content response
    const highlights = (data.highlights && data.highlights.length) ? data.highlights : (m.highlights || []);
    renderMeetingMinutes({
      title: m.title,
      minutes: {
        summary: m.summary || '',
        decisions: [],
        actionItems: actionItems,
        risks: []
      },
      transcript: data.transcript || '',
      transcriptChars: data.transcriptChars || 0,
      fathomUrl: m.shareUrl || m.url || m.meetingUrl || '',
      highlights: highlights
    });
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    renderMeetingMinutesError(err && err.message ? err.message : String(err));
  });
}

function downloadRecording(recordingId) {
  if (!recordingId) return;
  showOverlay('Requesting download link\u2026');
  ApiService.getRecordingDownloadLink(recordingId).then(function (data) {
    hideOverlay();
    if (!data || data.success !== true) {
      showToast((data && data.message) || 'Could not get download link.', 'error');
      return;
    }
    if (data.downloadUrl) {
      window.open(data.downloadUrl, '_blank');
      showToast('Download link opened (valid for ~24 hours).', 'success');
    } else {
      showToast('No download URL returned.', 'warning');
    }
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Download failed: ' + (err && err.message ? err.message : String(err)), 'error');
  });
}

// Additional Fathom API features

function searchFathomMeetings() {
  const queryEl = getEl('fathomSearchInput');
  const query = queryEl ? queryEl.value.trim() : '';
  if (!query) {
    // If no query, just reload all meetings
    loadFathomMeetings();
    return;
  }
  
  const list = getEl('fathomList');
  const status = getEl('fathomStatus');
  if (list) list.innerHTML = '<p class="meeting-notes-hint" style="padding:6px 0;">Searching Fathom meetings\u2026</p>';
  
  ApiService.searchFathomMeetings({ query: query }).then(function (data) {
    if (!data || data.success !== true) {
      if (status) status.textContent = (data && data.message) || 'Search failed.';
      return;
    }
    fathomMeetingsCache = data.items || [];
    renderFathomMeetingList(fathomMeetingsCache);
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    if (status) status.textContent = err && err.message ? err.message : String(err);
  });
}

function showFathomStats() {
  const status = getEl('fathomStatus');
  if (status) status.textContent = 'Loading Fathom statistics\u2026';
  
  ApiService.getFathomMeetingStats().then(function (data) {
    if (!data || data.success !== true) {
      if (status) status.textContent = (data && data.message) || 'Could not load statistics.';
      return;
    }
    
    const stats = data.stats || {};
    const statsHtml = '<div class="fathom-stats" style="padding:10px; background:var(--surface-secondary); border-radius:8px; margin-top:10px;">' +
      '<div style="font-weight:600; margin-bottom:10px;">Fathom Meeting Statistics</div>' +
      '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
      '<div><strong>' + (stats.totalMeetings || 0) + '</strong><br>Total meetings</div>' +
      '<div><strong>' + (stats.totalActionItems || 0) + '</strong><br>Total action items</div>' +
      '<div><strong>' + (stats.averageActionItemsPerMeeting || 0) + '</strong><br>Avg action items/meeting</div>' +
      '</div>';
    
    // Show recorded by breakdown
    if (stats.recordedByCounts && Object.keys(stats.recordedByCounts).length) {
      statsHtml += '<div style="margin-top:10px;"><strong>Recorded by:</strong><ul style="margin:5px 0 0 20px;">';
      Object.keys(stats.recordedByCounts).forEach(function (name) {
        statsHtml += '<li>' + escapeHtml(name) + ': ' + stats.recordedByCounts[name] + ' meeting(s)</li>';
      });
      statsHtml += '</ul></div>';
    }
    
    statsHtml += '</div>';
    
    // Insert stats before the meeting list
    const list = getEl('fathomList');
    if (list) {
      list.insertAdjacentHTML('afterbegin', statsHtml);
    }
    if (status) status.textContent = 'Statistics loaded.';
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    if (status) status.textContent = err && err.message ? err.message : String(err);
  });
}

function bulkDownloadRecordings() {
  if (!fathomMeetingsCache.length) {
    showToast('No meetings loaded. Load meetings first.', 'warning');
    return;
  }
  
  const recordingIds = fathomMeetingsCache
    .filter(function (m) { return m.recordingId; })
    .map(function (m) { return m.recordingId; });
  
  if (!recordingIds.length) {
    showToast('No recordings available for download.', 'warning');
    return;
  }
  
  showOverlay('Requesting download links for ' + recordingIds.length + ' recording(s)\u2026');
  
  ApiService.bulkGetRecordingDownloadLinks(recordingIds).then(function (data) {
    hideOverlay();
    if (!data || data.success !== true) {
      showToast((data && data.message) || 'Bulk download failed.', 'error');
      return;
    }
    
    const results = data.results || [];
    const errors = data.errors || [];
    
    if (results.length) {
      // Open download links in new tabs (browser may block popups)
      results.forEach(function (r, i) {
        setTimeout(function () {
          if (r.downloadUrl) window.open(r.downloadUrl, '_blank');
        }, i * 500); // Stagger to avoid popup blocker
      });
      showToast('Opened ' + results.length + ' download link(s). Links valid for ~24 hours.', 'success');
    }
    
    if (errors.length) {
      showToast(errors.length + ' recording(s) failed to get download links.', 'warning');
    }
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Bulk download failed: ' + (err && err.message ? err.message : String(err)), 'error');
  });
}

/* ---------------------------------- Live browser recording ---------------------------------- */

let meetingRecorder = null;
let meetingRecChunks = [];
let meetingRecStream = null;
let meetingRecTimerId = null;
let meetingRecElapsed = 0;
let meetingRecBlob = null;
let meetingRecMimeType = 'audio/webm';
let meetingRecCancelFlag = false;
let meetingRecSourceTracks = null;
let meetingRecAudioCtx = null;

function meetingRecordingFileName_() {
  const titleEl = getEl('meetingNotesTitleInput');
  const raw = titleEl && titleEl.value.trim() ? titleEl.value.trim() : 'Review meeting';
  const safe = raw.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_');
  const d = new Date();
  const pad = function (n) { return String(n).padStart(2, '0'); };
  return safe + '_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + '.webm';
}

function getMeetingRecStream_(useDisplay) {
  var displayTracks = null;
  function fallbackToMic_() {
    if (displayTracks) { displayTracks.forEach(function (t) { try { t.stop(); } catch (e) {} }); displayTracks = null; }
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (mic) {
      return { stream: mic, sourceTracks: mic.getTracks(), sourceType: 'mic', audioCtx: null };
    });
  }
  if (!useDisplay) return fallbackToMic_();
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then(function (displayStream) {
    displayTracks = displayStream.getTracks();
    displayStream.getVideoTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
    var audio = displayStream.getAudioTracks();
    if (!audio.length) throw new Error('The shared tab has no audio to record.');
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (mic) {
      return mixAudioStreams_([audio, mic.getTracks()]).then(function (mixed) {
        return { stream: mixed.stream, sourceTracks: displayTracks.concat(mic.getTracks()), sourceType: 'tab+mic', audioCtx: mixed.audioCtx };
      }).catch(function () {
        return { stream: displayStream, sourceTracks: displayTracks, sourceType: 'tab', audioCtx: null };
      });
    }).catch(function () {
      return { stream: displayStream, sourceTracks: displayTracks, sourceType: 'tab', audioCtx: null };
    });
  }).catch(function (err) {
    return fallbackToMic_();
  });
}

function mixAudioStreams_(trackGroups) {
  return new Promise(function (resolve, reject) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { reject(new Error('AudioContext unsupported')); return; }
      var ctx = new Ctx();
      var dest = ctx.createMediaStreamDestination();
      trackGroups.forEach(function (group) {
        group.forEach(function (track) {
          var src = ctx.createMediaStreamSource(new MediaStream([track]));
          src.connect(dest);
        });
      });
      if (ctx.state === 'suspended') {
        ctx.resume().then(function () { resolve({ stream: dest.stream, audioCtx: ctx }); }, function () { resolve({ stream: dest.stream, audioCtx: ctx }); });
      } else {
        resolve({ stream: dest.stream, audioCtx: ctx });
      }
    } catch (e) { reject(e); }
  });
}

function meetingRecCleanup_() {
  if (meetingRecSourceTracks) {
    meetingRecSourceTracks.forEach(function (t) { try { t.stop(); } catch (e) {} });
    meetingRecSourceTracks = null;
  }
  if (meetingRecAudioCtx) { try { meetingRecAudioCtx.close(); } catch (e) {} meetingRecAudioCtx = null; }
  if (meetingRecStream) {
    try { meetingRecStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    meetingRecStream = null;
  }
}

function startMeetingRecording() {
  if (!appState.isAdmin) { showToast('Admin access required', 'error'); return; }
  if (meetingRecorder) { showToast('Recording already in progress.', 'warning'); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    showToast('Live recording is not supported in this browser. Use Chrome, Edge, Firefox or Safari.', 'error');
    return;
  }
  var useDisplay = !!(navigator.mediaDevices.getDisplayMedia);
  if (useDisplay) {
    showToast('Select the meeting tab and tick "Share tab audio" (or your screen) to record meeting audio.', 'info');
  }
  getMeetingRecStream_(useDisplay).then(function (result) {
    meetingRecStream = result.stream;
    meetingRecSourceTracks = result.sourceTracks;
    meetingRecAudioCtx = result.audioCtx || null;
    meetingRecChunks = [];
    meetingRecElapsed = 0;
    meetingRecMimeType = 'audio/webm';
    let options = {};
    if (window.MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) options = { mimeType: 'audio/webm;codecs=opus' };
    else if (window.MediaRecorder.isTypeSupported('audio/webm')) options = { mimeType: 'audio/webm' };
    meetingRecorder = new MediaRecorder(result.stream, options);
    meetingRecorder.ondataavailable = function (e) { if (e.data && e.data.size) meetingRecChunks.push(e.data); };
    meetingRecorder.onstop = function () {
      const type = (meetingRecorder && meetingRecorder.mimeType) || meetingRecMimeType || 'audio/webm';
      meetingRecBlob = new Blob(meetingRecChunks, { type: type });
      meetingRecChunks = [];
      stopMeetingRecTimer();
      const player = getEl('meetingNotesPlayer');
      if (player) { player.src = URL.createObjectURL(meetingRecBlob); player.style.display = 'block'; }
      meetingRecCleanup_();
      const wasCancel = meetingRecCancelFlag;
      meetingRecCancelFlag = false;
      if (wasCancel) {
        meetingRecBlob = null;
        setMeetingRecStatus('Recording cancelled.');
        return;
      }
      const titleEl = getEl('meetingNotesTitleInput');
      if (titleEl && !titleEl.value.trim()) {
        const d = new Date();
        titleEl.value = 'Review meeting ' + (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
      }
      setMeetingRecStatus('Recording finished \u2014 sending to Groq\u2026');
      processMeetingNotes();
    };
    meetingRecorder.start(1000);
    const startBtn = getEl('meetingNotesStartBtn');
    const endBtn = getEl('meetingNotesEndBtn');
    const cancelBtn = getEl('meetingNotesCancelBtn');
    const timer = getEl('meetingNotesRecTimer');
    const go = getEl('meetingNotesGo');
    const status = getEl('meetingNotesRecStatus');
    if (startBtn) startBtn.style.display = 'none';
    if (endBtn) endBtn.style.display = 'inline-flex';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (timer) timer.style.display = 'inline-flex';
    if (go) { go.disabled = true; go.textContent = 'Recording\u2026'; }
    if (status) status.textContent = '';
    startMeetingRecTimer();
    syncMeetingRecFloat_();
    const note = result.sourceType === 'tab+mic'
      ? 'Recording meeting tab audio + microphone.'
      : (result.sourceType === 'tab' ? 'Recording meeting tab audio. Your voice may not be included.' : 'Recording microphone only.');
    showToast('Recording started. ' + note + ' Click "End recording" when done.', 'info');
  }).catch(function (err) {
    showToast('Could not start recording: ' + (err && err.message ? err.message : String(err || 'error')), 'error');
  });
}

function startMeetingRecTimer() {
  stopMeetingRecTimer();
  const timer = getEl('meetingNotesRecTimer');
  if (timer) {
    timer.textContent = '\u25CF ' + fmtMeetingRecElapsed_();
    const floatTimer = getEl('meetingRecFloatTimer');
    if (floatTimer) floatTimer.textContent = fmtMeetingRecElapsed_();
    meetingRecTimerId = setInterval(function () {
      meetingRecElapsed++;
      const t = fmtMeetingRecElapsed_();
      timer.textContent = '\u25CF ' + t;
      const floatTimer2 = getEl('meetingRecFloatTimer');
      if (floatTimer2) floatTimer2.textContent = t;
    }, 1000);
  }
}

function fmtMeetingRecElapsed_() {
  const m = String(Math.floor(meetingRecElapsed / 60)).padStart(2, '0');
  const s = String(meetingRecElapsed % 60).padStart(2, '0');
  return m + ':' + s;
}

function syncMeetingRecFloat_() {
  const floatBtn = getEl('meetingRecFloat');
  if (!floatBtn) return;
  const recording = !!(meetingRecorder && meetingRecorder.state === 'recording');
  const modal = getEl('meetingNotesModal');
  const modalOpen = modal && !modal.classList.contains('hidden');
  if (recording && !modalOpen) {
    const floatTimer = getEl('meetingRecFloatTimer');
    if (floatTimer) floatTimer.textContent = fmtMeetingRecElapsed_();
    floatBtn.classList.remove('hidden');
  } else {
    floatBtn.classList.add('hidden');
  }
}

function stopMeetingRecTimer() {
  if (meetingRecTimerId) { clearInterval(meetingRecTimerId); meetingRecTimerId = null; }
}

function stopMeetingRecording() {
  if (!meetingRecorder) return;
  meetingRecCancelFlag = false;
  try { meetingRecorder.stop(); } catch (err) {}
  const endBtn = getEl('meetingNotesEndBtn');
  const cancelBtn = getEl('meetingNotesCancelBtn');
  const timer = getEl('meetingNotesRecTimer');
  if (endBtn) { endBtn.disabled = true; endBtn.textContent = 'Processing\u2026'; }
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (timer) timer.textContent = '\u25CF Saving\u2026';
  syncMeetingRecFloat_();
}

function cancelMeetingRecording() {
  meetingRecCancelFlag = true;
  if (meetingRecorder && meetingRecorder.state === 'recording') {
    try { meetingRecorder.stop(); } catch (err) {}
  } else {
    meetingRecBlob = null;
    meetingRecChunks = [];
    meetingRecCleanup_();
    meetingRecorder = null;
    stopMeetingRecTimer();
    resetMeetingRecUi_();
    setMeetingRecStatus('Recording cancelled.');
  }
  syncMeetingRecFloat_();
}

function resetMeetingRecUi_() {
  const startBtn = getEl('meetingNotesStartBtn');
  const endBtn = getEl('meetingNotesEndBtn');
  const cancelBtn = getEl('meetingNotesCancelBtn');
  const timer = getEl('meetingNotesRecTimer');
  if (startBtn) startBtn.style.display = 'inline-flex';
  if (endBtn) { endBtn.style.display = 'none'; endBtn.disabled = false; endBtn.textContent = 'End recording'; }
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (timer) timer.style.display = 'none';
  syncMeetingRecFloat_();
}

function setMeetingRecStatus(msg) {
  const status = getEl('meetingNotesRecStatus');
  if (status) status.textContent = msg || '';
}

/* ---------------------------------- Per-record AI insight (cards + table rows) ---------------------------------- */
/* "AI insight" toggles an inline collapsible panel under a card / table row
   (editors and admins). If the record has a linked file, an "Analyze linked
   file" button fetches the link content and runs AI analysis over it. */

/* Inline style carrying a persisted drag-resized panel size, or '' when the
   panel was never resized. Keeps a resized analyze/AI panel's dimensions
   across background refreshes and re-renders. */
function panelSizeStyle_(cached) {
  if (!cached || !cached.w || !cached.h) return '';
  return ' style="width:' + cached.w + 'px;max-width:none;height:' + cached.h + 'px;max-height:none;"';
}

function applyPanelSize_(panel, row, isLink) {
  if (!panel) return;
  const cached = isLink ? cachedLinkPanel_(row) : cachedAiPanel_(row);
  if (!cached || !cached.w || !cached.h) return;
  panel.style.width = cached.w + 'px';
  panel.style.maxWidth = 'none';
  panel.style.height = cached.h + 'px';
  panel.style.maxHeight = 'none';
  // Restore the inner analyze-table window height so the table keeps its
  // expanded/contracted size after a re-render.
  if (cached.wrapH) {
    const wrap = panel.querySelector('.card-ai-table-wrap');
    if (wrap) {
      wrap.style.maxHeight = 'none';
      wrap.style.height = cached.wrapH + 'px';
    }
  }
}

function cardAiPanelHtml_() {
  return '<div class="card-ai-head">' +
    '<span class="card-ai-title">AI insight</span>' +
    '<span class="ai-generated-tag" title="Generated by an AI model - verify before acting">AI-generated</span>' +
    '<button class="btn btn-small btn-ghost" type="button" onclick="collapseCardAi(this)">Collapse</button>' +
    '</div>' +
    '<div class="card-ai-body" aria-live="polite"></div>' +
    '<div class="panel-resize-grip" title="Drag to resize"></div>';
}

function toggleCardAi(row, btn) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const article = btn.closest('.card');
  if (!article) return;
  let panel = article.querySelector('.card-ai-insight');
  if (panel) {
    panel.classList.toggle('card-ai-collapsed');
    const cached = cachedAiPanel_(row);
    if (cached) cached.collapsed = panel.classList.contains('card-ai-collapsed');
    return;
  }
  panel = document.createElement('div');
  panel.className = 'card-ai-panel card-ai-insight';
  panel.innerHTML = cardAiPanelHtml_();
  article.appendChild(panel);
  loadCardAi(panel, row);
}

function collapseCardAi(btn) {
  const panel = btn.closest('.card-ai-panel');
  if (!panel) return;
  panel.classList.add('card-ai-collapsed');
  const rowEl = panel.closest('[data-row]');
  if (!rowEl) return;
  const row = String(rowEl.getAttribute('data-row'));
  const isLink = panel.classList.contains('card-link-panel');
  if (isLink) {
    const cached = cachedLinkPanel_(row);
    if (cached) cached.collapsed = true;
    else persistLinkPanel_(row, null, true);
  } else {
    const cached = cachedAiPanel_(row);
    if (cached) cached.collapsed = true;
    else persistAiPanel_(row, null, true);
  }
}

function toggleRowAi(row, btn) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const tr = btn.closest('tr');
  if (!tr) return;
  const next = tr.nextElementSibling;
  if (next && next.classList && next.classList.contains('ai-insight-tr')) {
    next.remove();
    delete appState.aiAnalysis[String(row)];
    return;
  }
  const panelTr = document.createElement('tr');
  panelTr.className = 'ai-insight-tr';
  const td = document.createElement('td');
  td.setAttribute('colspan', '7');
  td.className = 'card-ai-panel card-ai-insight';
  td.innerHTML = cardAiPanelHtml_();
  panelTr.appendChild(td);
  tr.parentNode.insertBefore(panelTr, tr.nextSibling);
  loadCardAi(td, row);
}

function aiBulletsHtml_(text, tag) {
  const t = tag === 'li' ? 'li' : 'div';
  const lines = String(text || '').split(/\r?\n/).map(function (line) {
    return line.replace(/^[-*\u2022\u25CF\s]+/, '').trim();
  }).filter(function (line) { return line; });
  const items = lines.length ? lines : [String(text || '')];
  return items.map(function (line) {
    return '<' + t + ' style="display:flex;gap:8px;align-items:flex-start;font-size:14px;line-height:1.5;">' +
      '<span style="color:var(--accent,#2563eb);font-weight:700;">&rsaquo;</span>' +
      '<span>' + escapeHtml(line) + '</span></' + t + '>';
  }).join('');
}

function cachedAiPanel_(row) {
  return appState.aiAnalysis[String(row)] || null;
}

function persistAiPanel_(row, data, collapsed) {
  const prev = appState.aiAnalysis[String(row)] || {};
  appState.aiAnalysis[String(row)] = { data: data || null, collapsed: !!collapsed, w: prev.w, h: prev.h };
}

function aiPanelHtmlFromCache_(row) {
  const cached = cachedAiPanel_(row);
  if (!cached || !cached.data) return '';
  return '<div class="card-ai-panel card-ai-insight' + (cached.collapsed ? ' card-ai-collapsed' : '') + '"' +
    panelSizeStyle_(cached) + '>' +
    '<div class="card-ai-head">' +
    '<span class="card-ai-title">AI insight</span>' +
    '<span class="ai-generated-tag" title="Generated by an AI model - verify before acting">AI-generated</span>' +
    '<button class="btn btn-small btn-ghost" type="button" onclick="collapseCardAi(this)">Collapse</button>' +
    '</div>' +
    '<div class="card-ai-body">' + aiBulletsHtml_(cached.data.insights || '', 'div') + '</div>' +
    '<div class="panel-resize-grip" title="Drag to resize"></div>' +
    '</div>';
}

function loadCardAi(panel, row) {
  const body = panel.querySelector('.card-ai-body');
  if (!body) return;
  applyPanelSize_(panel, row, false);
  const cached = cachedAiPanel_(row);
  if (cached && cached.data) {
    body.innerHTML = aiBulletsHtml_(cached.data.insights || '', 'div');
    if (cached.collapsed) panel.classList.add('card-ai-collapsed');
    return;
  }
  body.innerHTML = '<div class="card-ai-loading">Generating insight…</div>';
  ApiService.getCardAiInsight(row).then(function (data) {
    if (!data || data.success !== true) {
      const msg = (data && data.message) || 'Could not generate AI insight.';
      body.innerHTML = '<div class="card-ai-error">' + escapeHtml(msg) + '</div>';
      return;
    }
    persistAiPanel_(row, data, false);
    body.innerHTML = aiBulletsHtml_(data.insights || '', 'div');
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    const msg = err && err.message ? err.message : String(err || 'Unknown error');
    body.innerHTML = '<div class="card-ai-error">' + escapeHtml(msg) + '</div>';
  });
}

function cardLinkPanelHtml_() {
  return '<div class="card-ai-head">' +
    '<span class="card-ai-title">Linked file analysis</span>' +
    '<span class="ai-generated-tag" title="Generated by an AI model - verify before acting">AI-generated</span>' +
    '<button class="btn btn-small btn-ghost" type="button" onclick="collapseCardAi(this)">Collapse</button>' +
    '</div>' +
    '<div class="card-ai-body" aria-live="polite"></div>' +
    '<div class="panel-resize-grip" title="Drag to resize"></div>';
}

function cachedLinkPanel_(row) {
  return appState.linkAnalysis[String(row)] || null;
}

function persistLinkPanel_(row, data, collapsed) {
  const prev = appState.linkAnalysis[String(row)] || {};
  appState.linkAnalysis[String(row)] = { data: data || null, collapsed: !!collapsed, w: prev.w, h: prev.h, wrapH: prev.wrapH };
}

/* Full persisted link panel HTML (head + body filled from the cached result),
   or '' when nothing is cached for that row. Embedded by the card / row
   builders so open analyses survive background refreshes and re-renders. */
function linkPanelHtmlFromCache_(row) {
  const cached = cachedLinkPanel_(row);
  if (!cached || !cached.data) return '';
  return '<div class="card-ai-panel card-link-panel' + (cached.collapsed ? ' card-ai-collapsed' : '') + '"' +
    panelSizeStyle_(cached) + '>' +
    '<div class="card-ai-head">' +
    '<span class="card-ai-title">Linked file analysis</span>' +
    '<span class="ai-generated-tag" title="Generated by an AI model - verify before acting">AI-generated</span>' +
    '<button class="btn btn-small btn-ghost" type="button" onclick="collapseCardAi(this)">Collapse</button>' +
    '</div>' +
    '<div class="card-ai-body">' + linkAiResultHtml_(cached.data, cached.wrapH) + '</div>' +
    '<div class="panel-resize-grip" title="Drag to resize"></div>' +
    '</div>';
}

function toggleCardLink(row, btn) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const article = btn.closest('.card');
  if (!article) return;
  let panel = article.querySelector('.card-link-panel');
  if (panel) {
    panel.classList.toggle('card-ai-collapsed');
    const cached = cachedLinkPanel_(row);
    if (cached) cached.collapsed = panel.classList.contains('card-ai-collapsed');
    return;
  }
  panel = document.createElement('div');
  panel.className = 'card-ai-panel card-link-panel';
  panel.innerHTML = cardLinkPanelHtml_();
  article.appendChild(panel);
  loadCardLink(panel, row);
}

function toggleRowLink(row, btn) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const tr = btn.closest('tr');
  if (!tr) return;
  const next = tr.nextElementSibling;
  if (next && next.classList && next.classList.contains('ai-link-tr')) {
    // Explicit close by the user — drop the persisted panel so it stays closed.
    next.remove();
    delete appState.linkAnalysis[String(row)];
    return;
  }
  const panelTr = document.createElement('tr');
  panelTr.className = 'ai-link-tr';
  const td = document.createElement('td');
  td.setAttribute('colspan', '7');
  td.className = 'card-ai-panel card-link-panel';
  td.innerHTML = cardLinkPanelHtml_();
  panelTr.appendChild(td);
  tr.parentNode.insertBefore(panelTr, tr.nextSibling);
  loadCardLink(td, row);
}

function itemHasLink_(item) {
  const links = (item && item.linkUrls) || {};
  return Object.keys(links).some(function (k) { return !!links[k]; });
}

/* Draggable column resize for tables (records, audit, users, tasks, activity
   and the link-analysis preview). A handle is appended to each header cell;
   dragging sets an explicit pixel width on the whole column (header + every
   body cell) with no minimum or maximum — text wraps to fit the new width.
   The first drag snapshots the content-sized widths and switches the table
   to fixed layout so the widths stick across re-renders. */
function makeTableResizable_(table) {
  if (!table || table.getAttribute('data-resizable')) return;
  table.setAttribute('data-resizable', '1');
  const ths = Array.prototype.slice.call(table.querySelectorAll('thead th'));
  if (!ths.length) return;

  ths.forEach(function (th, idx) {
    if (th.querySelector('.col-resizer')) return;
    const grip = document.createElement('div');
    grip.className = 'col-resizer';
    grip.title = 'Drag to resize column';
    th.appendChild(grip);
    // Dragging must not trigger the column's sort on mouseup.
    grip.addEventListener('click', function (e) { e.stopPropagation(); });

    let startX = 0;
    let startW = 0;
    grip.addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startW = th.getBoundingClientRect().width;
      // First drag: freeze current content-sized widths, then use fixed layout.
      if (table.style.tableLayout !== 'fixed') {
        ths.forEach(function (t, i) {
          const w = t.getBoundingClientRect().width;
          t.style.width = w + 'px';
          const rows = table.querySelectorAll('tbody tr');
          for (let r = 0; r < rows.length; r++) {
            const cell = rows[r].children[i];
            if (cell) cell.style.width = w + 'px';
          }
        });
        table.style.tableLayout = 'fixed';
      }
      grip.classList.add('active');
      document.body.classList.add('col-resizing');

      function onMove(ev) {
        const w = startW + (ev.clientX - startX); // no min/max — follow the pointer
        th.style.width = w + 'px';
        const rows = table.querySelectorAll('tbody tr');
        for (let r = 0; r < rows.length; r++) {
          const cell = rows[r].children[idx];
          if (cell) cell.style.width = w + 'px';
        }
      }
      function onUp() {
        grip.classList.remove('active');
        document.body.classList.remove('col-resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

function loadCardLink(panel, row) {
  const body = panel.querySelector('.card-ai-body');
  if (!body) return;
  applyPanelSize_(panel, row, true);
  // Already analyzed and persisted? Render instantly from the cache so the
  // result survives background refreshes without re-hitting the API.
  const cached = cachedLinkPanel_(row);
  if (cached && cached.data) {
    body.innerHTML = linkAiResultHtml_(cached.data, cached.wrapH);
    makeTableResizable_(body.querySelector('.card-ai-table'));
    if (cached.collapsed) panel.classList.add('card-ai-collapsed');
    return;
  }
  body.innerHTML = '<div class="card-ai-loading">Analyzing linked file…</div>';
  ApiService.getLinkContentAiInsight(row).then(function (data) {
    if (!data || data.success !== true) {
      const msg = (data && data.message) || 'Could not analyze the linked file.';
      body.innerHTML = '<div class="card-ai-error">' + escapeHtml(msg) + '</div>';
      return;
    }
    persistLinkPanel_(row, data, false);
    body.innerHTML = linkAiResultHtml_(data);
    makeTableResizable_(body.querySelector('.card-ai-table'));
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    const msg = err && err.message ? err.message : String(err || 'Unknown error');
    body.innerHTML = '<div class="card-ai-error">' + escapeHtml(msg) + '</div>';
  });
}

function linkAiResultHtml_(data, wrapH) {
  const head = '<div class="card-ai-link-label">' + escapeHtml(data.source || '') +
    (data.contentRead && data.contentLength ? ' <span class="card-ai-size">' +
      Number(data.contentLength).toLocaleString() + ' chars' +
      (data.contentTruncated ? ' · truncated' : '') + '</span>' : '') +
    (data.contentRead ? '' : ' <em>(content not readable — analyzed from record only)</em>') + '</div>';
  let html = head + aiBulletsHtml_(data.insights || '', 'div');
  if (data.previewFormat === 'table' && data.previewRows && data.previewRows.length) {
    let rows = data.previewRows.slice();
    let title = '';
    if (rows.length > 1) {
      const n0 = rows[0].filter(function (c) { return String(c).trim() !== ''; }).length;
      const n1 = rows[1].filter(function (c) { return String(c).trim() !== ''; }).length;
      if (n0 === 1 && n1 > n0) {
        title = rows[0].filter(function (c) { return String(c).trim() !== ''; })[0];
        rows = rows.slice(1);
      }
    }
    const thead = '<thead><tr>' + (rows[0] || []).map(function (c) {
      return '<th>' + escapeHtml(c) + '</th>';
    }).join('') + '</tr></thead>';
    const tbody = '<tbody>' + rows.slice(1).map(function (r) {
      return '<tr>' + r.map(function (c) { return '<td>' + escapeHtml(c) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody>';
    const note = (data.previewRowTotal && data.previewRowTotal > data.previewRows.length)
      ? '<div class="card-ai-table-note">Showing first ' + data.previewRows.length + ' of ' +
        Number(data.previewRowTotal).toLocaleString() + ' rows</div>'
      : '';
    const wrapStyle = wrapH ? ' style="max-height:none;height:' + wrapH + 'px;"' : '';
    html += '<details class="card-ai-preview" open><summary>Linked file preview</summary>' +
      (title ? '<div class="card-ai-table-title">' + escapeHtml(title) + '</div>' : '') +
      linkAskHtml_(data.row) +
      '<div class="card-ai-table-wrap"' + wrapStyle + '><table class="card-ai-table">' + thead + tbody + '</table></div>' +
      note + '</details>';
  } else if (data.preview) {
    html += '<details class="card-ai-preview"><summary>Linked file preview</summary>' +
      '<div class="card-ai-preview-text">' + escapeHtml(data.preview) + '</div></details>';
  }
  return html;
}

/* Ask-AI bar shown above the linked-file table: type a question, hit Enter
   or Ask, and the configured AI provider (Groq by default) answers in the
   result box below the bar — still above the table. Each row keeps a Q&A
   history in appState.linkAskQa (row -> [{question, answer}, ...], newest
   last) so answers survive background refreshes; the ✕ button clears a
   row's history (client-side only). */
function linkAskHtml_(row) {
  return '<div class="card-ai-ask">' +
    '<div class="card-ai-ask-bar">' +
    '<input class="card-ai-ask-input" type="text" placeholder="Ask AI…" aria-label="Ask AI about this record and its linked file" ' +
    'data-row="' + escAttr(row) + '" ' +
    'onkeydown="if(event.key===\'Enter\'){askLinkAi(this);}">' +
    '<button class="btn btn-small btn-primary card-ai-ask-btn" type="button" onclick="askLinkAi(this)">Ask</button>' +
    '</div>' + linkAskResultHtml_(row) + '</div>';
}

/* Renders just the result box for a row: latest Q&A on top with a ✕ clear
   button, older Q&As collapsed under a "Previous questions" toggle. */
function linkAskResultHtml_(row) {
  const hist = (appState.linkAskQa && appState.linkAskQa[String(row)]) || [];
  if (!hist.length) return '<div class="card-ai-ask-result" hidden></div>';
  const latest = hist[hist.length - 1];
  let html = '<div class="card-ai-ask-result" aria-live="polite">' +
    '<div class="card-ai-ask-result-head">' +
    '<div class="card-ai-ask-q">' + escapeHtml(latest.question) + '</div>' +
    '<button class="card-ai-ask-clear" type="button" title="Clear answer history" ' +
    'data-row="' + escAttr(row) + '" onclick="clearLinkAsk(this)">✕</button>' +
    '</div>' +
    '<div class="card-ai-ask-a"><span class="ai-generated-tag">AI-generated</span> ' + escapeHtml(latest.answer) + '</div>';
  if (hist.length > 1) {
    html += '<details class="card-ai-ask-history"><summary>Previous questions (' + (hist.length - 1) + ')</summary>';
    for (let i = hist.length - 2; i >= 0; i--) {
      html += '<div class="card-ai-ask-history-item"><div class="card-ai-ask-q">' + escapeHtml(hist[i].question) + '</div>' +
        '<div class="card-ai-ask-a">' + escapeHtml(hist[i].answer) + '</div></div>';
    }
    html += '</details>';
  }
  return html + '</div>';
}

/* Dismisses a row's Ask-AI answer history. Clears the local cache and the
   server copy so the history is gone after a reload too. */
function clearLinkAsk(elm) {
  const ask = elm.closest('.card-ai-ask');
  if (!ask) return;
  const row = elm.getAttribute('data-row');
  if (!row) return;
  delete appState.linkAskQa[String(row)];
  const result = ask.querySelector('.card-ai-ask-result');
  if (result) result.outerHTML = linkAskResultHtml_(row);
  persistAskLinkHistory(row, []);
}

/* Persists one record's Ask-AI Q&A history to the server (fire-and-forget;
   failures are non-fatal — the local cache still works for the session). */
function persistAskLinkHistory(row, hist) {
  if (!appState.isEditor) return;
  if (!ApiService.saveAskLinkHistory) return;
  ApiService.saveAskLinkHistory(row, hist).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

/* Loads every record's persisted Ask-AI Q&A history into appState.linkAskQa
   so questions survive a page reload. Called once after login. */
function loadAskLinkHistory() {
  if (!appState.isEditor) return;
  if (!ApiService.getAllAskLinkHistory) return;
  ApiService.getAllAskLinkHistory().then(function (data) {
    if (!data || data.success !== true || !data.history) return;
    const merged = Object.assign({}, data.history, appState.linkAskQa || {});
    appState.linkAskQa = merged;
    EventBus.emit('AskLinkHistoryLoaded');
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

function askLinkAi(elm) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const ask = elm.closest('.card-ai-ask');
  if (!ask) return;
  const input = ask.querySelector('.card-ai-ask-input');
  const result = ask.querySelector('.card-ai-ask-result');
  const askBtn = ask.querySelector('.card-ai-ask-btn');
  const question = (input.value || '').trim();
  if (!question) { input.focus(); return; }
  const row = input.getAttribute('data-row');
  if (!row) return;
  askBtn.disabled = true;
  result.hidden = false;
  result.className = 'card-ai-ask-result card-ai-ask-loading';
  result.textContent = 'Asking AI…';
  ApiService.askLinkAi(row, question).then(function (data) {
    if (!data || data.success !== true) {
      const msg = (data && data.message) || 'Could not get an answer.';
      result.className = 'card-ai-ask-result card-ai-ask-error';
      result.textContent = msg;
      askBtn.disabled = false;
      return;
    }
    const hist = appState.linkAskQa[String(row)] || (appState.linkAskQa[String(row)] = []);
    // Re-asking the same question moves it to the top instead of duplicating.
    let dup = -1;
    for (let i = 0; i < hist.length; i++) {
      if (hist[i].question === question) { dup = i; break; }
    }
    if (dup !== -1) hist.splice(dup, 1);
    hist.push({ question: question, answer: data.insights || '' });
    if (hist.length > 10) hist.splice(0, hist.length - 10);
    result.outerHTML = linkAskResultHtml_(row);
    askBtn.disabled = false;
    persistAskLinkHistory(row, hist);
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    result.className = 'card-ai-ask-result card-ai-ask-error';
    result.textContent = (err && err.message) ? err.message : String(err || 'Unknown error');
    askBtn.disabled = false;
  });
}

/* ---------------------------------- In-page link preview ---------------------------------- */
/* Opens a URL in an embedded iframe inside the dashboard instead of a new tab.
   Drive document previews use the Google Drive /preview host; plain URLs are
   attempted too, with a fallback "Open in new tab" button for sites that block
   embedding. */

/* Rewrite shareable URLs to an embeddable form where possible (Drive file
   links -> /preview host, Google Spreadsheets -> htmlview grid-only view).
   Returns the URL unchanged when not recognized. */
function toEmbeddableUrl(url) {
  if (!url) return '';
  const m = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
  const o = url.match(/drive\.google\.com\/open\?id=([^&#]+)/);
  if (o) return 'https://drive.google.com/file/d/' + o[1] + '/preview';
  const s = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (s) {
    const gid = (url.match(/(?:[#&?]gid=)(\d+)/) || [])[1];
    const range = (url.match(/(?:[#&?]range=)([^#&=?]+)/) || [])[1];
    let out = 'https://docs.google.com/spreadsheets/d/' + s[1] + '/htmlview';
    const frag = [];
    if (gid) frag.push('gid=' + gid);
    if (range) frag.push('range=' + range);
    if (frag.length) out += '#' + frag.join('&');
    return out;
  }
  return url;
}

/* The preview stage must always end up with a #previewFrame. Presentation
   Mode parks the live frame in a hidden warm holder on close (and exit
   destroys those holders), so the stage can legitimately be frame-less on the
   next open — in that case rebuild a default frame instead of escaping to a
   real new tab. */
function ensurePreviewFrame_(stage) {
  let frame = getEl('previewFrame');
  if (frame && frame.parentNode === stage) return frame;
  frame = document.createElement('iframe');
  frame.id = 'previewFrame';
  frame.className = 'preview-frame';
  frame.title = 'Link preview';
  frame.setAttribute('aria-hidden', 'true');
  stage.appendChild(frame);
  return frame;
}

function openLinkPreview(url, title) {
  const safe = linkableHref(url);
  if (!safe) { showToast('Preview blocked: not a supported http(s) / mailto / tel link.', 'error'); return; }
  const stage = getEl('previewStage');
  if (!stage) { window.open(safe, '_blank'); return; }
  const openNew = getEl('previewOpenNew');
  const titleEl = getEl('previewModalTitle');
  if (titleEl) titleEl.textContent = title || 'Preview';
  if (openNew) openNew.href = safe;
  previewZoom = 80;

  let target = '';
  try { target = (typeof toEmbeddableUrl === 'function' && toEmbeddableUrl(safe)) || safe; } catch (err) { target = safe; }

  /* Presentation Mode keeps two levels of reuse:
     1) a background warm frame that has already finished loading;
     2) a small cache of frames previously shown in the preview.
     In both cases the SAME iframe element is adopted, so opening does not
     trigger a second navigation. */
  const warm = window.presentationWarm || null;
  let cached = null;
  if (warm && warm.previewCache && warm.previewCache[target]) {
    cached = warm.previewCache[target];
    delete warm.previewCache[target];
    if (warm.previewCacheOrder) {
      warm.previewCacheOrder = warm.previewCacheOrder.filter(function (key) { return key !== target; });
    }
  }
  const warmed = warm && warm.frames && warm.frames[target];
  const reusable = cached || (warmed && warmed.ready ? warmed : null);

  if (reusable && reusable.node && reusable.frame) {
    try {
      const existing = getEl('previewFrame');
      reusable.frame.id = 'previewFrame';
      reusable.frame.className = 'preview-frame';
      reusable.frame.title = 'Link preview';
      reusable.frame.setAttribute('aria-hidden', 'true');
      if (existing && existing !== reusable.frame && existing.parentNode === stage) {
        stage.replaceChild(reusable.frame, existing);
      } else {
        stage.appendChild(reusable.frame);
      }
      if (reusable.node.parentNode) reusable.node.parentNode.removeChild(reusable.node);
      if (warm && warm.frames && warm.frames[target]) delete warm.frames[target];
      if (warm) warm.activePreviewTarget = target;
    } catch (err) {
      const frame = ensurePreviewFrame_(stage);
      try { frame.src = target || ''; } catch (err2) {}
      if (warm) warm.activePreviewTarget = target;
    }
  } else {
    const frame = ensurePreviewFrame_(stage);
    try { frame.src = target || ''; } catch (err) {}
    if (warm) warm.activePreviewTarget = target;
  }
  applyPreviewZoom();
  openDialog('previewModal');
}

/* Closes the preview. Runs for the X button, the backdrop, and Escape — it
   always closes the dialog AND blanks the frame so the next open starts from
   a clean #previewFrame. */
function closeLinkPreview() {
  const frame = getEl('previewFrame');
  const warm = window.presentationWarm || null;
  const target = warm && warm.activePreviewTarget;

  /* In presentation mode, preserve the loaded iframe instead of blanking it.
     It is moved into the same hidden warm-frame holder used by the preload
     system and can be adopted instantly on the next open. */
  if (frame && warm && presentationState && presentationState.active && target) {
    try {
      const holder = document.createElement('div');
      holder.className = 'pres-warm-frame';
      holder.setAttribute('data-pres-warm-frame', '1');
      frame.id = '';
      frame.setAttribute('aria-hidden', 'true');
      holder.appendChild(frame);
      document.body.appendChild(holder);

      if (warm.previewCache[target] && warm.previewCache[target].node &&
          warm.previewCache[target].node.parentNode) {
        warm.previewCache[target].node.parentNode.removeChild(warm.previewCache[target].node);
      }
      warm.previewCache[target] = { node: holder, frame: frame, ready: true };
      warm.previewCacheOrder = (warm.previewCacheOrder || []).filter(function (key) { return key !== target; });
      warm.previewCacheOrder.push(target);

      while (warm.previewCacheOrder.length > 6) {
        const evict = warm.previewCacheOrder.shift();
        const entry = warm.previewCache[evict];
        delete warm.previewCache[evict];
        if (entry && entry.node && entry.node.parentNode) {
          entry.node.parentNode.removeChild(entry.node);
        }
      }
      warm.activePreviewTarget = null;
      closeDialog('previewModal');
      return;
    } catch (err) {
      /* Fall through to the normal blanking path if caching fails. */
    }
  }

  try { if (frame) frame.src = 'about:blank'; } catch (err) {}
  if (warm) warm.activePreviewTarget = null;
  closeDialog('previewModal');
}

/* ---------------------------------- Preview zoom ---------------------------------- */
/* Scales the embedded iframe so Sheets/Docs/Presentations (and any other
   preview) can be zoomed in/out. Zoom buttons call these directly; trackpad
   pinch (browsers send Ctrl+wheel) is wired by wirePreviewPinch(). */

let previewZoom = 80;

function applyPreviewZoom() {
  const frame = getEl('previewFrame');
  const value = getEl('previewZoomValue');
  if (frame) frame.style.zoom = previewZoom / 100;
  if (value) value.textContent = previewZoom + '%';
}

function adjustPreviewZoom(delta) {
  previewZoom = Math.min(300, Math.max(50, previewZoom + delta));
  applyPreviewZoom();
}

function previewZoomIn() { adjustPreviewZoom(10); }
function previewZoomOut() { adjustPreviewZoom(-10); }
function previewZoomReset() { previewZoom = 80; applyPreviewZoom(); }

/* Trackpad pinch-to-zoom (and Ctrl+scroll on a mouse) scales the preview. */
function wirePreviewPinch() {
  const stage = getEl('previewStage');
  if (!stage) return;
  stage.addEventListener('wheel', function (e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    adjustPreviewZoom(e.deltaY < 0 ? 10 : -10);
  }, { passive: false });
}

/* Preview handler for file attachments: file key -> local /api/files/<key> stream. */
function openDriveDocPreview(fileKey, fileName) {
  if (!fileKey) return;
  openLinkPreview(API_URL + '/files/' + encodeURIComponent(fileKey), fileName || 'Document preview');
}

/* Delegated handler: intercept links that would otherwise open in a new tab
   (auto-linkified URLs in records, table cells, Drive attachments) so they
   render in the in-page preview modal instead. The "Open in new tab" button
   inside the preview modal itself is exempt, and non-http(s) schemes like
   mailto:/tel: keep their default behaviour. */
function wireEmbeddedLinkPreview() {
  document.addEventListener('click', function (event) {
    const link = event.target.closest ? event.target.closest('a[data-embed], a[target="_blank"]') : null;
    if (!link) return;
    if (link.closest && link.closest('#previewModal')) return;
    const href = link.getAttribute('href') || '';
    if (!/^https?:/i.test(href)) {
      if (!/^(mailto|tel):/i.test(href)) event.preventDefault();
      return;
    }
    event.preventDefault();
    openLinkPreview(href, link.textContent.trim());
  });
}

let confirmDialogState = null;

function showConfirm(options) {
  return new Promise(function (resolve) {
    confirmDialogState = { onConfirm: resolve };
    getEl('confirmMessage').textContent = options.message || 'Are you sure?';
    getEl('confirmModalTitle').textContent = options.title || 'Confirm';
    const okBtn = getEl('confirmOkBtn');
    okBtn.textContent = options.okLabel || 'OK';
    okBtn.classList.toggle('btn-danger', !!options.danger);
    okBtn.classList.toggle('btn-primary', !options.danger);
    openDialog('confirmModal');
  });
}

function runConfirmDialog() {
  const cb = confirmDialogState ? confirmDialogState.onConfirm : null;
  confirmDialogState = null;
  closeDialog('confirmModal');
  if (cb) cb(true);
}

function cancelConfirmDialog() {
  const cb = confirmDialogState ? confirmDialogState.onConfirm : null;
  confirmDialogState = null;
  closeDialog('confirmModal');
  if (cb) cb(false);
}

/* ---------------------------------- Auth helpers ---------------------------------- */

function isAuthError(message) {
  const msg = String(message || '');
  return msg.indexOf('Login required') !== -1 ||
    msg.indexOf('Session expired') !== -1 ||
    msg.indexOf('Please log in') !== -1 ||
    // Server-side token validators reject anonymous calls with
    // 'getAppData requires (token)' & co — these must route the user to
    // the login screen, not to the "Error loading app" panel.
    /requires \(.*token\)/i.test(msg);
}

function handleServerFailure(err) {
  hideOverlay();
  const msg = err && err.message ? err.message : String(err || 'Unknown error');
  if (isAuthError(msg)) {
    showScreen('login');
    showToast('Session expired. Please log in again.', 'warning');
    return true;
  }
  return false;
}

/* ---------------------------------- Screens ---------------------------------- */

function showScreen(screen) {
  ['login', 'forgot'].forEach(name => {
    const el = getEl(name + 'Screen');
    if (el) el.classList.add('hidden');
  });
  const target = getEl(screen + 'Screen');
  if (target) target.classList.remove('hidden');
}

function showAuthMessage(elementId, message) {
  const el = getEl(elementId);
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('hidden', !message);
}

/* ---------------------------------- Theme ---------------------------------- */

function applyTheme() {
  appState.darkMode = window.localStorage.getItem(STORAGE_THEME) === 'true';
  document.body.classList.toggle('dark-mode', appState.darkMode);
  const moon = getEl('iconMoon');
  const sun = getEl('iconSun');
  if (moon && sun) {
    moon.classList.toggle('hidden', appState.darkMode);
    sun.classList.toggle('hidden', !appState.darkMode);
  }
}

function toggleDarkMode() {
  appState.darkMode = !appState.darkMode;
  window.localStorage.setItem(STORAGE_THEME, String(appState.darkMode));
  applyTheme();
}

/* ---------------------------------- Sidebar ---------------------------------- */

function applySidebarPref() {
  const collapsed = window.localStorage.getItem(STORAGE_SIDEBAR) === '1';
  document.body.classList.toggle('sidebar-collapsed', collapsed);
}

function toggleSidebar() {
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  if (mobile) {
    const open = document.body.classList.toggle('sidebar-open');
    const backdrop = getEl('sidebarBackdrop');
    if (backdrop) backdrop.classList.toggle('hidden', !open);
  } else {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    window.localStorage.setItem(STORAGE_SIDEBAR, collapsed ? '1' : '0');
  }
}

/* ---------------------------------- Profile menu ---------------------------------- */

function toggleProfileMenu() {
  const dropdown = getEl('profileDropdown');
  const trigger = getEl('profileTrigger');
  const open = dropdown.classList.toggle('open');
  if (trigger) trigger.setAttribute('aria-expanded', String(open));
}

function renderProfile() {
  const user = appState.user || {};
  const email = user.email || '';
  const username = (user.username || '').trim();
  const role = user.role || 'VIEWER';
  const name = username || (email ? email.split('@')[0] : 'Guest');
  const initial = (username || email) ? (username || email).charAt(0).toUpperCase() : '?';
  const tone = role === 'ADMIN' ? 'danger' : (role === 'EDITOR' ? 'accent' : 'muted');

  const avatar = getEl('profileAvatar');
  if (avatar) avatar.textContent = initial;
  const nameEl = getEl('profileName');
  if (nameEl) nameEl.textContent = user.loggedIn ? name : 'Not signed in';
  const roleEl = getEl('profileRole');
  if (roleEl) roleEl.textContent = user.loggedIn ? role : '—';
  const emailEl = getEl('profileEmail');
  if (emailEl) emailEl.textContent = user.loggedIn ? email : 'Not signed in';
  const badge = getEl('profileRoleBadge');
  if (badge) {
    badge.textContent = user.loggedIn ? role : 'Guest';
    badge.setAttribute('data-tone', tone);
  }

  const addButton = getEl('addButton');
  if (addButton) addButton.style.display = appState.isEditor ? 'inline-flex' : 'none';
  const showHiddenWrap = getEl('showHiddenWrap');
  if (showHiddenWrap) showHiddenWrap.classList.toggle('hidden', !appState.isEditor);
  const meetingBtn = getEl('meetingNotesBtn');
  if (meetingBtn) meetingBtn.style.display = appState.isAdmin ? 'inline-flex' : 'none';
  updateMarkAllSubmissionsReadBtn();
}

// Show the "Mark all as read" action only to admins while at least one card
// badge is flashing; hide it once everything is read (or for non-admins).
function updateMarkAllSubmissionsReadBtn() {
  const btn = getEl('markAllSubmissionsReadBtn');
  if (!btn) return;
  const anyFlash = appState.isAdmin && Object.keys(appState.submissionFlash || {}).some(function (k) { return appState.submissionFlash[k]; });
  btn.style.display = anyFlash ? 'inline-flex' : 'none';
}

/* ---------------------------------- Notifications ---------------------------------- */

const NOTIF_TYPE_LABELS = {
  record: 'Records',
  submission: 'Submissions',
  user: 'User',
  system: 'System'
};
const NOTIF_TYPE_ORDER = ['record', 'submission', 'user', 'system'];

function loadNotifications(silent) {
  return ApiService.getMyNotifications().then(function (data) {
    appState.notifications = data || { unread: 0, recent: [] };
    appState.notifPrefs = (data && data.prefs) || null;
    renderNotifications();
    renderNotificationPrefsControls();
  }).catch(function (err) {
    if (!silent && handleServerFailure(err)) return;
  });
}

/* Group a notification list by type (stable by NOTIF_TYPE_ORDER). Returns an
   array of { type, label, items } for the dropdown / notification center. */
function groupNotifications_(items) {
  const groups = [];
  NOTIF_TYPE_ORDER.forEach(function (type) {
    const grouped = (items || []).filter(function (n) { return String(n.type || 'system') === type; });
    if (grouped.length) groups.push({ type: type, label: NOTIF_TYPE_LABELS[type] || type, items: grouped });
  });
  return groups;
}

function notifPriorityClass_(n) {
  return Number(n && n.priority) >= 1 ? ' notif-priority-high' : '';
}

function notifActionHtml_(n) {
  const parts = [];
  if (!n.readAt) {
    parts.push('<button class="btn btn-ghost btn-small notif-mark-read" type="button" onclick="event.stopPropagation(); markNotificationRead(\'' + escAttr(n.id) + '\')">Mark read</button>');
  }
  parts.push('<button class="btn btn-secondary btn-small" type="button" onclick="event.stopPropagation(); openNotification(\'' + escAttr(n.id) + '\', \'' + escAttr(n.type || 'system') + '\', \'' + escAttr(String(n.recordRow || 0)) + '\')">' +
    (Number(n.recordRow || 0) ? 'Open record' : 'Open') + '</button>');
  parts.push('<button class="btn btn-ghost btn-small" type="button" onclick="event.stopPropagation(); snoozeNotificationUi(\'' + escAttr(n.id) + '\',60)">Snooze</button>');
  parts.push('<button class="btn btn-ghost btn-small" type="button" onclick="event.stopPropagation(); dismissNotificationUi(\'' + escAttr(n.id) + '\')">Dismiss</button>');
  return parts.join('');
}

function renderNotifications() {
  const n = appState.notifications || { unread: 0, recent: [] };
  const badge = getEl('notifBadge');
  if (badge) {
    badge.textContent = n.unread > 99 ? '99+' : String(n.unread || 0);
    badge.classList.toggle('hidden', !n.unread);
    badge.setAttribute('aria-hidden', String(!n.unread));
  }
  const list = getEl('notifList');
  const empty = getEl('notifEmpty');
  const recent = n.recent || [];
  if (list) {
    const groups = groupNotifications_(recent);
    list.innerHTML = groups.map(function (g) {
      return '<li class="notif-group" role="group" aria-label="' + escAttr(g.label) + '">' +
        '<div class="notif-group-title">' + escapeHtml(g.label) + ' <span class="notif-group-count">' + g.items.length + '</span></div>' +
        '<ul class="notif-group-list">' + g.items.map(function (item) {
          const unreadClass = item.readAt ? '' : ' notif-item-unread';
          const unreadTag = item.readAt ? '' : '<span class="notif-unread-tag">Unread</span>';
          return '<li class="notif-item' + unreadClass + notifPriorityClass_(item) + '" data-notif-id="' + escAttr(String(item.id || '')) + '" data-notif-type="' + escAttr(String(item.type || 'system')) + '">' +
            '<div class="notif-item-title">' + unreadTag + (Number(item.priority) >= 1 ? '<span class="notif-urgent" title="Urgent">&#9888;</span> ' : '') + escapeHtml(item.title) + '</div>' +
            '<div class="notif-item-body">' + escapeHtml(item.body) + '</div>' +
            '<div class="notif-item-meta"><span class="notif-item-time">' + escapeHtml(formatNotifTime(item.createdAt)) + '</span>' +
            '<span class="notif-item-actions">' + notifActionHtml_(item) + '</span></div>' +
            '</li>';
        }).join('') + '</ul></li>';
    }).join('') || '<li class="notif-item-empty">No notifications yet.</li>';
  }
  if (empty) empty.classList.toggle('hidden', !!(recent && recent.length));
}

function openNotificationCenter() {
  closeNotificationsPanel();
  loadNotifications(true).then(function () {
    if (getEl('notifCenterModal')) {
      openDialog('notifCenterModal');
      renderNotificationCenter('all');
    }
  });
}

function closeNotificationCenter() {
  closeDialog('notifCenterModal');
}

function renderNotificationCenter(filter) {
  const view = appState.notifications || { unread: 0, recent: [], history: [] };
  const byTypeRemaining = Object.assign({}, view.byTypeUnread || {});
  const list = getEl('notifCenterList');
  const unreadAll = view.unread || 0;
  const counter = getEl('notifCenterCounter');
  if (counter) counter.textContent = unreadAll ? unreadAll + ' unread' : 'No unread notifications';

  let items = (view.history || view.recent || []).slice();
  if (filter === 'unread') items = items.filter(function (i) { return !i.readAt; });
  if (filter !== 'all' && filter !== 'unread' && NOTIF_TYPE_LABELS[filter]) {
    items = items.filter(function (i) { return String(i.type) === filter; });
  }

  const groups = groupNotifications_(items);
  list.innerHTML = groups.map(function (g) {
    const unread = byTypeRemaining[g.type] || 0;
    return '<div class="notif-center-group">' +
      '<div class="notif-center-group-head">' +
      '<span class="text-subheading">' + escapeHtml(g.label) + '</span>' +
      (unread ? '<span class="notif-center-unread">' + unread + ' unread</span>' : '') +
      '<button class="btn btn-ghost btn-small" type="button" onclick="markTypeRead(\'' + escAttr(g.type) + '\')">Mark group read</button>' +
      '</div>' +
      '<ul class="notif-center-group-list">' + g.items.map(notifCenterItemHtml_).join('') + '</ul>' +
      '</div>';
  }).join('') || '<div class="notif-center-empty">No notifications in this view.</div>';
  renderNotificationPrefsControls();
}

function notifCenterItemHtml_(item) {
  const unreadClass = item.readAt ? '' : ' notif-item-unread';
  const unreadTag = item.readAt ? '' : '<span class="notif-unread-tag">Unread</span>';
  return '<li class="notif-item' + unreadClass + notifPriorityClass_(item) + '" data-notif-id="' + escAttr(String(item.id || '')) + '">' +
    '<div class="notif-item-title">' + unreadTag + (Number(item.priority) >= 1 ? '<span class="notif-urgent" title="Urgent">&#9888;</span> ' : '') + escapeHtml(item.title) + '</div>' +
    '<div class="notif-item-body">' + escapeHtml(item.body) + '</div>' +
    '<div class="notif-item-meta"><span class="notif-item-time">' + escapeHtml(formatTimestamp(item.createdAt)) + '</span>' +
    '<span class="notif-item-actions">' + notifActionHtml_(item) + '</span></div>' +
    '</li>';
}

function renderNotificationPrefsControls() {
  const prefs = appState.notifPrefs;
  const wrap = getEl('notifPrefs');
  if (!wrap || !prefs) return;
  const defs = [['record', 'Record updates'], ['submission', 'Submissions'], ['user', 'User / account'], ['system', 'System']];
  wrap.innerHTML = '<div class="notif-prefs-grid">' + defs.map(function (d) {
      const key = d[0];
      return '<label class="notif-pref-item"><input type="checkbox" data-notif-pref-type="' + key + '" ' + (prefs[key] ? 'checked' : '') + ' onchange="setNotifPref(this)">' +
        '<span>' + escapeHtml(d[1]) + '</span></label>';
    }).join('') +
    '<label class="notif-pref-item"><input type="checkbox" data-notif-pref-type="push" ' + (prefs.push ? 'checked' : '') + ' onchange="setNotifPref(this)" data-notif-pref-push="1">' +
    '<span>Push notifications</span></label></div>';
}

function setNotifPref(input) {
  const type = input.getAttribute('data-notif-pref-type');
  if (!type) return;
  const isPush = input.hasAttribute('data-notif-pref-push');
  if (isPush) {
    if (input.checked) {
      subscribeToPushNotifications();
    } else {
      unsubscribeFromPushNotifications();
    }
  }
  const next = Object.assign({}, appState.notifPrefs || {});
  next[type] = !!input.checked;
  ApiService.setNotificationPrefs(next).then(function (data) {
    appState.notifPrefs = (data && data.prefs) || next;
    showToast('Notification preference saved.', 'success');
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    input.checked = !input.checked;
    showToast('Could not save preference: ' + (err.message || err), 'error');
  });
}

function markNotificationRead(id) {
  if (!id) return;
  ApiService.markNotificationsRead([id]).then(function (data) {
    appState.notifications = data || { unread: 0, recent: [] };
    appState.notifPrefs = (data && data.prefs) || appState.notifPrefs;
    renderNotifications();
    if (!getEl('notifCenterModal').classList.contains('hidden')) renderNotificationCenter(currentNotifCenterFilter_());
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

function markTypeRead(type) {
  if (!type) return;
  ApiService.markNotificationsRead([type]).then(function (data) {
    appState.notifications = data || { unread: 0, recent: [] };
    appState.notifPrefs = (data && data.prefs) || appState.notifPrefs;
    renderNotifications();
    if (!getEl('notifCenterModal').classList.contains('hidden')) renderNotificationCenter(currentNotifCenterFilter_());
    showToast('Notifications marked as read.', 'success');
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

function currentNotifCenterFilter_() {
  const active = document.querySelector('.notif-center-filter.active');
  return active ? active.getAttribute('data-notif-filter') || 'all' : 'all';
}

function setNotifCenterFilter(filter) {
  document.querySelectorAll('.notif-center-filter').forEach(function (b) { b.classList.remove('active'); });
  const match = document.querySelector('.notif-center-filter[data-notif-filter="' + filter + '"]');
  if (match) match.classList.add('active');
  renderNotificationCenter(filter);
}

function formatNotifTime(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - Number(ts)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return formatTimestamp(ts);
}

// Formats an epoch-ms timestamp as dd.MM.yyyy HH:mm (matches the project's
// dd.MM.yyyy date style used for record dates). Returns '' for invalid input.
function formatTimestamp(ts) {
  if (!ts) return '';
  const n = Number(ts);
  if (!isFinite(n) || n <= 0) return String(ts);
  const d = new Date(n);
  if (isNaN(d.getTime())) return String(ts);
  const pad = function (v) { return String(v).padStart(2, '0'); };
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function toggleNotifications() {
  const panel = getEl('notifPanel');
  if (!panel) return;
  const open = panel.classList.toggle('hidden');
  const trigger = getEl('notifTrigger');
  if (trigger) trigger.setAttribute('aria-expanded', String(!open));
  if (!open) loadNotifications(true);
}

function closeNotificationsPanel() {
  const panel = getEl('notifPanel');
  if (panel) panel.classList.add('hidden');
  const trigger = getEl('notifTrigger');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function markAllNotificationsRead() {
  ApiService.markNotificationsRead('all').then(function (data) {
    appState.notifications = data || { unread: 0, recent: [] };
    appState.notifPrefs = (data && data.prefs) || appState.notifPrefs;
    renderNotifications();
    if (!getEl('notifCenterModal').classList.contains('hidden')) renderNotificationCenter(currentNotifCenterFilter_());
    showToast('All notifications marked as read.', 'success');
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not update notifications: ' + (err.message || err), 'error');
  });
}

function clearAllNotifications() {
  ApiService.clearMyNotifications().then(function (data) {
    appState.notifications = data || { unread: 0, recent: [] };
    appState.notifPrefs = (data && data.prefs) || appState.notifPrefs;
    renderNotifications();
    if (!getEl('notifCenterModal').classList.contains('hidden')) renderNotificationCenter(currentNotifCenterFilter_());
    showToast('All notifications cleared.', 'success');
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not clear notifications: ' + (err.message || err), 'error');
  });
}

function openNotification(id, type, recordRow) {
  if (!id) {
    closeNotificationsPanel();
    return;
  }
  const readP = ApiService.markNotificationsRead([id]).then(function (data) {
    appState.notifications = data || { unread: 0, recent: [] };
    appState.notifPrefs = (data && data.prefs) || appState.notifPrefs;
    renderNotifications();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
  closeNotificationsPanel();
  if (recordRow && Number(recordRow) > 0) {
    const targetRow = Number(recordRow);
    const found = (appState.items || []).some(function (i) { return String(i.row) === String(targetRow); });
    if (found) {
      readP.then(function () { openRecordDetail(targetRow); });
    } else {
      readP.then(function () {
        return ApiService.getAppData().then(function (data) {
          applyAppData(data);
          renderDashboard(true);
          openRecordDetail(targetRow);
        }).catch(function (err) {
          if (handleServerFailure(err)) return;
          openTab('dashboard');
        });
      });
    }
    return;
  }
  const map = { record: 'dashboard', submission: 'dashboard', user: 'settings', system: 'dashboard' };
  readP.then(function () { openTab(map[type] || 'dashboard'); });
}

/* ---------------------------------- Tabs ---------------------------------- */

/* Part 4 — information architecture: the sidebar is grouped into
   Overview / Work / Insights / Admin. Items carry data-perm when the module
   permission map gates them (e.g. Audit is editor/admin + the Auditor group);
   a group label is hidden when every item in it is hidden, so viewers never
   see an empty "Admin" heading. Settings stays visible to all roles because it
   also holds personal controls (password change, theme, push preferences). */
function applyNavPermissions() {
  document.querySelectorAll('.nav-item[data-perm]').forEach(function (btn) {
    btn.classList.toggle('hidden', !can(btn.getAttribute('data-perm'), 'view'));
  });
  document.querySelectorAll('.sidebar-section-label[data-group-label]').forEach(function (label) {
    const group = label.getAttribute('data-group-label');
    const items = document.querySelectorAll('.nav-item[data-group="' + group + '"]');
    const anyVisible = Array.prototype.some.call(items, function (btn) {
      return !btn.classList.contains('hidden');
    });
    label.classList.toggle('hidden', items.length > 0 && !anyVisible);
  });
}

function openTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(function (btn) {
    btn.classList.remove('active');
    btn.removeAttribute('aria-current');
  });
  const panel = getEl(tabId);
  if (panel) panel.classList.remove('hidden');
  const nav = document.querySelector('.nav-item[data-tab="' + tabId + '"]');
  if (nav) {
    nav.classList.add('active');
    nav.setAttribute('aria-current', 'page');
  }
  if (tabId === 'analytics') renderAnalytics();
  if (tabId === 'audit') renderAuditPanel();
  if (tabId === 'reports') renderReportPreview();
  if (tabId === 'settings') renderSettings();
  if (tabId === 'dashboard') renderDashboard();
  if (tabId === 'tasks') renderTasks();
  if (tabId === 'myday') renderMyDay();
}

/* ---------------------------------- Auth flows ---------------------------------- */

function initApp() {
  startLiveClock();
  initDatePicker();

  // Initialize multi-select chip components (event delegation, survives innerHTML rebuilds)
  initMultiSelect('editResponsibilityMs', 'editResponsibility', 'Select...');
  initMultiSelect('taskAssigneeMs', 'taskAssignee', 'Select...');

  // Column-resize handles for every static data table (records, audit,
  // users, activity, tasks). Handlers attach once — the header cells persist
  // across tbody re-renders, so the widths keep working after any refresh.
  document.querySelectorAll('.data-table').forEach(function (t) { makeTableResizable_(t); });

  // Drag-resize grip on every modal window. The chosen size is remembered
  // per dialog id and re-applied in openDialog.
  document.querySelectorAll('.modal-card').forEach(function (card) { makeModalResizable_(card); });

  // Drag-resize for the inline analyze/AI panels. Delegated on document
  // because the panels are re-created on every refresh; the size is stored in
  // the persisted panel state so it survives re-renders.
  document.addEventListener('mousedown', function (e) {
    const grip = e.target && e.target.closest ? e.target.closest('.panel-resize-grip') : null;
    if (!grip) return;
    const panel = grip.closest('.card-ai-panel');
    if (!panel) return;
    const rowEl = panel.closest('[data-row]');
    if (!rowEl) return;
    const row = String(rowEl.getAttribute('data-row'));
    const isLink = panel.classList.contains('card-link-panel');
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    const startW = rect.width, startH = rect.height;
    const parent = panel.parentElement;
    // In table view the panel lives inside the records-table window; grow /
    // shrink that window with the panel so the analyze table is never
    // clipped by the window's max-height (the previous "limits at a
    // fraction" behaviour).
    const scroller = panel.closest('.table-scroll');
    const startScrollH = scroller ? scroller.getBoundingClientRect().height : 0;
    // Inner table window: the analyze table wrap follows the panel height.
    const wrap = panel.querySelector('.card-ai-table-wrap');
    const startWrapTop = wrap ? (wrap.getBoundingClientRect().top - panel.getBoundingClientRect().top) : 0;
    const maxW = parent ? Math.max(240, parent.clientWidth - 16) : window.innerWidth - 32;
    document.body.classList.add('modal-resizing');
    grip.classList.add('active');
    function onMove(ev) {
      const w = Math.max(240, Math.min(maxW, startW + (ev.clientX - startX)));
      const h = Math.max(140, Math.min(window.innerHeight - 12, startH + (ev.clientY - startY)));
      panel.style.width = w + 'px';
      panel.style.maxWidth = 'none';
      panel.style.height = h + 'px';
      panel.style.maxHeight = 'none';
      // Inner analyze table follows the panel height (expand + contract).
      if (wrap) {
        wrap.style.maxHeight = 'none';
        wrap.style.height = Math.max(120, h - startWrapTop - 8) + 'px';
      }
      // Surrounding records-table window follows the panel too.
      if (scroller) {
        const sh = Math.max(240, Math.min(window.innerHeight * 0.92, startScrollH + (h - startH)));
        scroller.style.maxHeight = 'none';
        scroller.style.height = sh + 'px';
        try { window.localStorage.setItem('dashTableHeight', String(Math.round(sh))); } catch (err) {}
      }
      let cached = isLink ? cachedLinkPanel_(row) : cachedAiPanel_(row);
      if (!cached) { cached = { data: null, collapsed: false }; if (isLink) persistLinkPanel_(row, null, false); else persistAiPanel_(row, null, false); }
      cached.w = Math.round(w); cached.h = Math.round(h);
      if (wrap) cached.wrapH = Math.round(Math.max(120, h - startWrapTop - 8));
    }
    function onUp() {
      document.body.classList.remove('modal-resizing');
      grip.classList.remove('active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Vertical drag-resize for the records table window (height). The chosen
  // height is remembered across sessions.
  (function () {
    const handle = getEl('dashboardTableResize');
    const scroller = document.querySelector('#dashboardTableWrap .table-scroll');
    if (!handle || !scroller) return;
    const saved = Number(window.localStorage.getItem('dashTableHeight'));
    if (saved && saved > 200) {
      scroller.style.maxHeight = 'none';
      scroller.style.height = saved + 'px';
    }
    handle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      const startY = e.clientY;
      const startH = scroller.getBoundingClientRect().height;
      document.body.classList.add('col-resizing');
      function onMove(ev) {
        const h = Math.max(240, Math.min(window.innerHeight * 0.92, startH + (ev.clientY - startY)));
        scroller.style.maxHeight = 'none';
        scroller.style.height = h + 'px';
        try { window.localStorage.setItem('dashTableHeight', String(h)); } catch (err) {}
      }
      function onUp() {
        document.body.classList.remove('col-resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  })();

  // The server validates the HttpOnly session cookie. This keeps the session
  // out of JavaScript while still allowing the app to restore a signed-in
  // session after a page reload.
  loadApp();
}

let divisionalPromptDismissed = false;

function maybePromptForDivisionalDashboard() {
  if (divisionalPromptDismissed) return;
  ApiService.getMyDivisionalDashboard().then(function (data) {
    if (!data || !data.eligible || data.url) return;
    const modal = getEl('divisionalDashboardModal');
    const input = getEl('divisionalDashboardUrl');
    if (!modal || !input) return;
    input.value = '';
    const status = getEl('divisionalDashboardStatus');
    if (status) status.textContent = '';
    modal.classList.remove('hidden');
    openDialog('divisionalDashboardModal');
    setTimeout(function () { input.focus(); }, 50);
  }).catch(function (err) { if (handleServerFailure(err)) return; });
}

function dismissMyDivisionalDashboardPrompt() {
  divisionalPromptDismissed = true;
  closeDialog('divisionalDashboardModal');
}

function saveMyDivisionalDashboard() {
  const input = getEl('divisionalDashboardUrl');
  const url = input ? input.value.trim() : '';
  const status = getEl('divisionalDashboardStatus');
  if (!/^https?:\/\//i.test(url)) { if (status) status.textContent = 'Enter a valid http:// or https:// URL.'; return; }
  const btn = getEl('saveDivisionalDashboardBtn');
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Saving…';
  ApiService.setMyDivisionalDashboard(url).then(function (res) {
    if (btn) btn.disabled = false;
    if (res && res.success) {
      appState.user.divisionalDashboardUrl = res.url;
      closeDialog('divisionalDashboardModal');
      showToast('Divisional dashboard link saved.', 'success');
      renderSettings();
    } else if (status) status.textContent = (res && res.message) || 'Could not save the link.';
  }).catch(function (err) {
    if (btn) btn.disabled = false;
    if (status) status.textContent = err.message || 'Could not save the link.';
  });
}

function loadApp() {
  showOverlay('Loading app…');
  ApiService.getAppData().then(function (data) {
    hideOverlay();
    hideSplash();
    if (!data || !data.user || !data.user.loggedIn) {
      showScreen('login');
      return;
    }
    appState.user = data.user || {};
    appState.isAdmin = data.user.role === 'ADMIN';
    appState.isEditor = data.user.role === 'ADMIN' || data.user.role === 'EDITOR';
    appState.mustChange = !!data.mustChange;
    appState.permissions = (data.user && data.user.permissions) || {};
    divisionalPromptDismissed = false;
    applyAppData(data);

    populateFilters();
    populateResponsibilitySelect();
  renderProfile();
    applyTheme();
    applySidebarPref();
    showScreen('login');
    getEl('loginScreen').classList.add('hidden');
    getEl('forgotScreen').classList.add('hidden');
    renderDashboard();
    updateOfflineBanner();
    refreshCounts();
    generateReviewNotifications();
    loadDashboardPreferences();
    loadAskLinkHistory();
    EventBus.emit('DataRefreshed');
    EventBus.emit('UserLoggedIn');
    maybePromptForDivisionalDashboard();
    startAutoRefresh();
    initRealtime();

    if (appState.mustChange) {
      getEl('mustChangeBanner').classList.remove('hidden');
      openTab('settings');
      showToast('Please set a new password to continue.', 'warning');
    }
  }).catch(function (err) {
    hideOverlay();
    hideSplash();
    if (handleServerFailure(err)) return;
    const message = err && err.message ? err.message : String(err || 'Unknown error');
    const panel = getEl('messagePanel');
    panel.classList.remove('hidden');
    panel.textContent = 'Error loading app: ' + message;
    console.error('App load failed', err);
  });
}

function handleLogin(e) {
  e.preventDefault();
  const emailEl = getEl('loginEmail');
  const passEl = getEl('loginPassword');
  const email = emailEl.value.trim();
  const password = passEl.value;
  let valid = true;
  valid = setFieldInvalid(emailEl, email ? '' : 'Enter your email or username.') && valid;
  valid = setFieldInvalid(passEl, password ? '' : 'Enter your password.') && valid;
  if (!valid) return;

  showOverlay('Logging in…');
  ApiService.login(email, password).then(function (res) {
    hideOverlay();
    if (!res || !res.success) {
      showAuthMessage('loginMessage', (res && res.message) || 'Login failed.');
      return;
    }
    appState.mustChange = !!res.mustChange;
    showAuthMessage('loginMessage', '');
    loadApp();
  }).catch(function (err) {
    hideOverlay();
    showAuthMessage('loginMessage', err && err.message ? err.message : 'Login failed.');
  });
}

function showForgotPassword() {
  showAuthMessage('forgotMessage', '');
  const loginEmail = getEl('loginEmail').value || '';
  getEl('forgotEmail').value = loginEmail;
  showScreen('forgot');
}

function showLogin() {
  ['loginMessage', 'forgotMessage'].forEach(id => showAuthMessage(id, ''));
  showScreen('login');
}

function handleForgotPassword(e) {
  e.preventDefault();
  const email = getEl('forgotEmail').value.trim();
  if (!setFieldInvalid(getEl('forgotEmail'), email ? '' : 'Enter your email or username.')) return;
  showOverlay('Submitting reset request…');
  ApiService.requestPasswordReset(email).then(function (res) {
    hideOverlay();
    showAuthMessage('forgotMessage', (res && res.message) || 'A reset request has been sent to your administrator.');
    showToast((res && res.message) || 'A reset request has been sent to your administrator.', 'success');
  }).catch(function (err) {
    hideOverlay();
    showAuthMessage('forgotMessage', err && err.message ? err.message : 'Could not submit the reset request.');
  });
}

function logout() {
  stopAutoRefresh();
  teardownRealtime();
  ApiService.logout().then(function () {
    window.location.href = window.location.href.split('?')[0];
  }).catch(function () {
    window.location.reload();
  });
}

/* ---------------------------------- Form validation ---------------------------------- */

function setFieldInvalid(inputEl, message) {
  if (!inputEl) return !message;
  const field = inputEl.closest('.field');
  if (!field) return !message;
  const err = field.querySelector('.field-error');
  if (err) {
    if (message && !err.id) {
      err.id = 'err-' + (inputEl.id || 'field') + '-' + Math.random().toString(36).slice(2, 8);
    }
    err.textContent = message || '';
    if (message) {
      inputEl.setAttribute('aria-invalid', 'true');
      inputEl.setAttribute('aria-describedby', err.id);
    } else {
      inputEl.removeAttribute('aria-invalid');
      if (err.id) {
        const describedBy = (inputEl.getAttribute('aria-describedby') || '')
          .split(/\s+/).filter(function (x) { return x && x !== err.id; });
        if (describedBy.length) inputEl.setAttribute('aria-describedby', describedBy.join(' '));
        else inputEl.removeAttribute('aria-describedby');
      }
    }
  } else if (!message) {
    inputEl.removeAttribute('aria-invalid');
  }
  field.classList.toggle('invalid', !!message);
  return !message;
}

function wireFieldClearing(container) {
  (container || document).querySelectorAll('input, select, textarea').forEach(function (input) {
    input.addEventListener('input', function () {
      setFieldInvalid(input, '');
    });
  });
}


function snoozeNotificationUi(id, minutes){ApiService.snoozeNotification(id,minutes).then(function(d){appState.notifications=d||appState.notifications;renderNotifications();}).catch(function(e){showToast(e.message||String(e),'error');});}
function dismissNotificationUi(id){ApiService.dismissNotification(id).then(function(d){appState.notifications=d||appState.notifications;renderNotifications();}).catch(function(e){showToast(e.message||String(e),'error');});}

/* ---------------------------------- Dashboard: filters ---------------------------------- */

function populateFilters() {
  const filter = getEl('sectorFilter');
  if (!filter) return;
  const selected = filter.value;
  const sectors = [...new Set(appState.items.map(function (item) { return item.sector; }).filter(Boolean))].sort();
  filter.innerHTML = '<option value="">All sectors</option>' + sectors.map(function (s) {
    return `<option value="${escAttr(s)}">${escapeHtml(s)}</option>`;
  }).join('');
  filter.value = selected;
}

/* Populate the edit-dialog responsibility multi-select with every responsibility
   entry returned by the server (all records, not just the current view). */
function populateResponsibilitySelect() {
  const hiddenInput = getEl('editResponsibility');
  if (!hiddenInput) return;
  const list = appState.responsibilities || [];
  const options = list.map(function (r) {
    return { value: r, label: r };
  });
  populateMultiSelectOptions('editResponsibilityMs', options);
}

/* Generate review-due in-app notifications for the signed-in user, then load
   the notification center so the unread bell reflects any new entries. */
function generateReviewNotifications() {
  ApiService.generateReviewNotifications().then(function () {
    return loadNotifications(true);
  }).catch(function () {
    loadNotifications(true);
  });
}

function applyFilters(preservePage) {
  const query = appState.searchQuery.toLowerCase();
  const sector = appState.sector;
  const review = appState.dashReviewFilter;
  const showHidden = appState.dashShowHidden && appState.isEditor;
  appState.filtered = appState.items.filter(function (item) {
    const haystack = [item.sector, item.id, item.description, item.action, item.responsibility, item.reviewDate]
      .join(' ').toLowerCase();
    const reviewOk = review === 'due'
      ? item.reviewStatus === 'due'
      : review === 'notdue'
        ? item.reviewStatus !== 'due'
        : true;
    const displayOk = showHidden || item.displayed !== false;
    return (!query || haystack.indexOf(query) !== -1) && (!sector || item.sector === sector) && reviewOk && displayOk;
  });
  // Reset to page 1 only when the filter inputs changed (search/sector); a
  // plain re-render after an edit/update/delete keeps the current page.
  if (!preservePage) appState.page = 1;
  const pages = Math.max(1, Math.ceil(appState.filtered.length / PAGE_SIZE));
  if (appState.page > pages) appState.page = pages;
}

function handleSectorFilterChange() {
  appState.sector = getEl('sectorFilter').value;
  updateFilterChips();
  renderDashboard();
}

function handleDashSortSelectChange() {
  const value = getEl('dashSortSelect').value;
  appState.dashSortKey = value === 'default' ? 'id' : value;
  appState.dashSortDir = 'asc';
  renderDashboard();
  scheduleDashboardPrefsSave();
}

function handleDashReviewFilterChange() {
  appState.dashReviewFilter = getEl('dashReviewFilter').value;
  updateFilterChips();
  renderDashboard();
  scheduleDashboardPrefsSave();
}

function handleDashShowHiddenChange() {
  appState.dashShowHidden = getEl('dashShowHidden').checked;
  renderDashboard();
}

function resetFilters() {
  appState.searchQuery = '';
  appState.sector = '';
  appState.dashReviewFilter = '';
  const search = getEl('searchInput');
  if (search) search.value = '';
  const filter = getEl('sectorFilter');
  if (filter) filter.value = '';
  const reviewFilter = getEl('dashReviewFilter');
  if (reviewFilter) reviewFilter.value = '';
  const sortSelect = getEl('dashSortSelect');
  if (sortSelect) sortSelect.value = 'default';
  appState.dashSortKey = 'id';
  appState.dashSortDir = 'asc';
  updateFilterChips();
  renderDashboard();
  scheduleDashboardPrefsSave();
}

function updateFilterChips() {
  const chips = getEl('filterChips');
  if (!chips) return;
  const parts = [];
  if (appState.searchQuery) {
    parts.push(`<span class="filter-chip">Search: ${escapeHtml(appState.searchQuery)} <button type="button" aria-label="Remove search filter" onclick="removeChip('search')">✕</button></span>`);
  }
  if (appState.sector) {
    parts.push(`<span class="filter-chip">Sector: ${escapeHtml(appState.sector)} <button type="button" aria-label="Remove sector filter" onclick="removeChip('sector')">✕</button></span>`);
  }
  if (appState.dashReviewFilter) {
    const reviewLabel = appState.dashReviewFilter === 'due' ? 'Review due' : 'Review not due';
    parts.push(`<span class="filter-chip">${escapeHtml(reviewLabel)} <button type="button" aria-label="Remove review filter" onclick="removeChip('review')">✕</button></span>`);
  }
  chips.innerHTML = parts.join('');
  const resetBtn = getEl('resetFiltersBtn');
  if (resetBtn) resetBtn.classList.toggle('hidden', parts.length === 0);
}

function removeChip(kind) {
  if (kind === 'search') appState.searchQuery = '';
  if (kind === 'sector') appState.sector = '';
  if (kind === 'review') appState.dashReviewFilter = '';
  const search = getEl('searchInput');
  if (search) search.value = appState.searchQuery;
  const filter = getEl('sectorFilter');
  if (filter) filter.value = appState.sector;
  const reviewFilter = getEl('dashReviewFilter');
  if (reviewFilter) reviewFilter.value = appState.dashReviewFilter;
  updateFilterChips();
  renderDashboard();
  if (kind === 'review') scheduleDashboardPrefsSave();
}

/* ---------------------------------- Dashboard: display toggle ---------------------------------- */

/* Editors/admins tick which records show on the dashboard for everyone;
   unticked (hidden) records only appear when "Show hidden" is on. */
function toggleRecordDisplay(row, displayed) {
  if (!appState.isEditor) { showToast('Editor access required', 'warning'); return; }
  showOverlay(displayed ? 'Showing record…' : 'Hiding record…');
  ApiService.setRecordDisplay(row, displayed).then(function (data) {
    hideOverlay();
    if (data && data.items) {
      appState.items = data.items;
      appState.summary = data.summary || {};
    }
    renderDashboard(true);
    showToast(displayed ? 'Record is now displayed' : 'Record hidden from dashboard', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    renderDashboard(true);
    showToast('Failed: ' + (err.message || err), 'error');
  });
}

/* ---------------------------------- Dashboard: KPI cards ---------------------------------- */

function monthlyTrendArray() {
  const trend = (appState.analytics && appState.analytics.trend) || [];
  if (Array.isArray(trend)) {
    return trend.slice().sort(function (a, b) {
      return String(a && a.key).localeCompare(String(b && b.key));
    });
  }
  return Object.keys(trend).sort().map(function (key) {
    return { key: key, value: trend[key] };
  });
}

function trendPill() {
  const points = monthlyTrendArray();
  if (points.length < 2) return '';
  const last = points[points.length - 1].value;
  const prev = points[points.length - 2].value;
  const diff = last - prev;
  const cls = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'flat');
  const arrow = diff > 0 ? '↑' : (diff < 0 ? '↓' : '—');
  const label = diff !== 0 ? `${arrow} ${Math.abs(diff)} this month` : 'Flat this month';
  return `<span class="kpi-trend ${cls}">${label}</span>`;
}

function renderKpiCards() {
  const grid = getEl('summaryCards');
  if (!grid) return;
  const summary = appState.summary || {};
  const counts = appState.counts || {};
  const hasCounts = !!appState.counts;
  const sectorCount = Object.keys(summary.sectors || {}).length;
  const total = hasCounts && counts.totalRecords !== undefined ? counts.totalRecords : (summary.total || 0);
  // When a review-status filter is active, the Review due tile reflects the
  // filtered set instead of the global count, so the KPI stays consistent
  // with the cards/table on screen.
  const reviewFilter = appState.dashReviewFilter;
  const flaggedInView = appState.filtered.filter(function (i) { return i.reviewStatus === 'due'; }).length;
  const flagged = reviewFilter
    ? flaggedInView
    : (hasCounts && counts.flaggedRecords !== undefined ? counts.flaggedRecords : (summary.flagged || 0));
  const openTasks = counts.openTasks;
  const dueToday = counts.dueToday;
  const trend = trendPill();
  const dash = function (v) { return (v === undefined || v === null) ? '—' : v; };

  grid.innerHTML =
    `<div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-icon tone-secondary">${svgIcon('database')}</span>
        ${trend}
      </div>
      <div class="kpi-label">Total records</div>
      <div class="kpi-value">${total}</div>
      <div class="kpi-subtitle">Across ${sectorCount} sector${sectorCount === 1 ? '' : 's'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-icon tone-warning">${svgIcon('flag')}</span>
      </div>
      <div class="kpi-label">Review due</div>
      <div class="kpi-value">${flagged}</div>
      <div class="kpi-subtitle">${reviewFilter ? 'Within current filter' : 'Flagged for follow-up'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-icon tone-success">${svgIcon('layers')}</span>
      </div>
      <div class="kpi-label">Open sectors</div>
      <div class="kpi-value">${sectorCount}</div>
      <div class="kpi-subtitle">Active operations</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-icon tone-warning">${svgIcon('check')}</span>
      </div>
      <div class="kpi-label">Open tasks</div>
      <div class="kpi-value">${dash(openTasks)}</div>
      <div class="kpi-subtitle">Not yet completed</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-icon tone-secondary">${svgIcon('calendar')}</span>
      </div>
      <div class="kpi-label">Due today</div>
      <div class="kpi-value">${dash(dueToday)}</div>
      <div class="kpi-subtitle">Tasks due today</div>
    </div>`;
}

/* Fetches live task counts (open tasks, due today) and refreshes the homepage
   KPI cards without a full data reload — mirrors the GAS project. */
function refreshCounts() {
  if (typeof ApiService.getTaskCounts !== 'function') return;
  ApiService.getTaskCounts().then(function (counts) {
    appState.counts = counts || {};
    renderKpiCards();
  }).catch(function () {
    /* non-fatal: homepage falls back to summary-derived values */
  });
}

/* ---------------------------------- Dashboard: cards ---------------------------------- */

function dashboardColumnKey_(label) {
  const l = String(label || '').trim().toLowerCase();
  if (l === '#' || l === 'id' || l === 'sr no' || l === 'sr no.') return 'id';
  if (l === 'sector') return 'sector';
  if (l === 'description') return 'description';
  if (l.indexOf('entry') !== -1) return 'entryDate';
  if (l.indexOf('review') !== -1) return 'reviewDate';
  if (l === 'responsibility') return 'responsibility';
  if (l === 'action') return 'action';
  if (l === 'last meeting instructions' || l.indexOf('last meeting instruction') !== -1) return 'lastMeetingInstructions';
  if (l.indexOf('actions') !== -1) return 'actions';
  return '';
}

function dashboardColumnVisible_(label) {
  const columns = (appState.dashboardPrefs && appState.dashboardPrefs.columns) || {};
  const key = dashboardColumnKey_(label);
  return key ? columns[key] !== false : true;
}

/* Renders one dashboard field as a card block. Groups are assembled in
   buildCardHtml so the card reads: Description | Entry Date | Sector on the
   top row, the Action field as its own full-width horizontal block below, and
   Responsibility | Review Date on the bottom row. */
function cardFieldHtml_(item, field) {
  const isHeaderRowValue = field && field.label && String(field.label).trim() !== '';
  const fieldKey = dashboardColumnKey_(field && field.label);
  const isActionField = fieldKey === 'action';
  const isInstructionField = fieldKey === 'lastMeetingInstructions';
  const actionStateClass = isActionField
    ? (item.reviewStatus === 'due' ? ' card-field-action-due' : ' card-field-action-ok')
    : '';
  const valueHtml = field.html
    ? `<div class="field-value preserve-whitespace field-html">${field.html}</div>`
    : `<div class="field-value preserve-whitespace">${escapeHtml(field.value)}</div>`;
  const editBtn = (isInstructionField && appState.isEditor)
    ? `<button class="icon-btn card-field-edit-btn" type="button" title="Edit last meeting instructions" aria-label="Edit last meeting instructions" onclick="event.stopPropagation(); openLastMeetingInstructions('${escAttr(item.row)}')">${svgIcon('edit')}</button>`
    : '';
  return `
      <div class="card-field ${isHeaderRowValue ? 'card-field-highlight' : ''}${isActionField ? ' card-field-action' : ''}${isInstructionField ? ' card-field-last-meeting-instructions' : ''}${actionStateClass}${editBtn ? ' card-field-with-edit' : ''}">
        <span class="field-label ${isHeaderRowValue ? 'field-label-highlight' : ''}${isActionField ? ' field-label-action' : ''}">${escapeHtml(field.label || 'Value')}</span>
        ${editBtn}
        ${valueHtml}
      </div>`;
}

/* Group display fields for the 3-1-2 card layout: top row = Description,
   Entry Date, Sector; the Action field keeps its own horizontal block;
   bottom row = Responsibility, Review Date. The id field is excluded (the
   card title / modal heading already shows the record number). Any
   unrecognised field falls into the top row as a fallback. */
function groupCardFields_(fields) {
  const topFields = [];
  const actionFields = [];
  const instructionFields = [];
  const bottomFields = [];
  (fields || []).forEach(function (field) {
    const key = dashboardColumnKey_(field && field.label);
    if (key === 'id') return;
    if (key === 'action') {
      actionFields.push(field);
    } else if (key === 'lastMeetingInstructions') {
      instructionFields.push(field);
    } else if (key === 'responsibility' || key === 'reviewDate') {
      bottomFields.push(field);
    } else {
      topFields.push(field);
    }
  });
  // Top row reads Description | Entry Date | Sector (user-specified order).
  const topOrder = { description: 0, entryDate: 1, sector: 2 };
  topFields.sort(function (a, b) {
    const ka = dashboardColumnKey_(a && a.label);
    const kb = dashboardColumnKey_(b && b.label);
    const oa = topOrder[ka] !== undefined ? topOrder[ka] : 9;
    const ob = topOrder[kb] !== undefined ? topOrder[kb] : 9;
    return oa - ob;
  });
  return { top: topFields, action: actionFields, instructions: instructionFields, bottom: bottomFields };
}

/* ---------------------------------- Show/Hide updates toggle ---------------------------------- */
/* "Show/Hide updates" sits beside the Submit update button on every card (and
   in the record detail dialog). Clicking it collapses or expands the update
   blocks rendered on that card. State is persisted per-browser in
   localStorage so a user's choices survive reloads and re-renders. */
var updatesHiddenStorageKey_ = 'dashUpdatesHiddenByRow';

function loadUpdatesHiddenByRow_() {
  if (appState.updatesHiddenByRow && Object.keys(appState.updatesHiddenByRow).length) return;
  try {
    const raw = window.localStorage.getItem(updatesHiddenStorageKey_);
    appState.updatesHiddenByRow = raw ? (JSON.parse(raw) || {}) : {};
  } catch (err) {
    appState.updatesHiddenByRow = {};
  }
}

function saveUpdatesHiddenByRow_() {
  try {
    window.localStorage.setItem(updatesHiddenStorageKey_, JSON.stringify(appState.updatesHiddenByRow || {}));
  } catch (err) { /* storage full or blocked — non-fatal, toggle stays in-memory */ }
}

function isRowUpdatesHidden_(row) {
  loadUpdatesHiddenByRow_();
  return !!(appState.updatesHiddenByRow || {})[String(row)];
}

/* Rebuild the update blocks for one row (shared by the card + detail dialog). */
function rowUpdatesHtml_(row) {
  return (appState.displayedSubmissions || [])
    .filter(function (s) { return Number(s.cardRow) === Number(row); })
    .map(function (s) {
      const actionsHtml = submissionInlineActionsHtml_(s);
      return `
        <div class="card-field submission-display">
          <span class="field-label submission-display-label">Update by ${escapeHtml((s.office || '').trim() ? s.office : s.email)} <span class="submission-display-time">${escapeHtml(formatTimestamp(s.createdAt))}</span></span>
          <div class="field-value preserve-whitespace">${escapeHtml(s.text || '')}</div>
          ${actionsHtml ? '<div class="submission-actions">' + actionsHtml + '</div>' : ''}
        </div>`;
    }).join('');
}

/* Editor/admin management actions rendered on the updates shown on the card /
   detail — the same Edit / Lock / Display / Delete the modal offers, driven
   by the per-submission flags the overview carries. */
function submissionInlineActionsHtml_(s) {
  if (!appState.isEditor || !s || !s.id) return '';
  const stop = 'event.stopPropagation(); ';
  let html = '';
  if (s.editable) {
    html += `<button class="btn btn-secondary btn-small" type="button" onclick="${stop}editCardSubmission('${escAttr(s.cardRow)}','${escAttr(s.cardId || '')}','${escAttr(s.id)}')">Edit</button>`;
  }
  if (s.canUnlock) {
    html += `<button class="btn btn-secondary btn-small" type="button" onclick="${stop}unlockSubmission('${escAttr(s.id)}')">Unlock</button>`;
  } else if (s.canLock) {
    html += `<button class="btn btn-secondary btn-small" type="button" onclick="${stop}lockSubmission('${escAttr(s.id)}')">Lock</button>`;
  }
  html += `<button class="btn btn-danger btn-small" type="button" onclick="${stop}deleteSubmission('${escAttr(s.id)}')">Delete</button>`;
  if (appState.isAdmin) {
    html += `<button class="btn btn-secondary btn-small" type="button" onclick="${stop}toggleDisplaySubmission('${escAttr(s.id)}')">${s.displayed ? 'Hide from card' : 'Display on card'}</button>`;
  }
  return html;
}

/* Inline Edit opens the submissions modal for the row and auto-enters edit
   mode once that card's submission list has loaded. */
function editCardSubmission(row, cardId, id) {
  appState.pendingInlineEditId = '';
  openSubmissionsModal(row, cardId);
  appState.pendingInlineEditId = id;
}

/* Flip the show/hide state for a row, persist it, then sync every matching
   card / dialog element in the DOM to the new state without a re-render. */
function toggleCardUpdates(row, btn, allowViewer) {
  if (!appState.isEditor && !allowViewer) { showToast('Admin/editor access required', 'warning'); return; }
  loadUpdatesHiddenByRow_();
  const key = String(row);
  appState.updatesHiddenByRow[key] = !appState.updatesHiddenByRow[key];
  saveUpdatesHiddenByRow_();

  const hidden = appState.updatesHiddenByRow[key];
  document.querySelectorAll('[data-updates-row="' + key + '"]').forEach(function (el) {
    el.classList.toggle('updates-hidden', hidden);
  });
  const label = (hidden ? 'Show updates' : 'Hide updates') +
    ' <span class="submission-badge">' + (Number((appState.submissionCounts || {})[Number(key)] || 0)) + '</span>';
  document.querySelectorAll('[data-updates-toggle="' + key + '"]').forEach(function (el) {
    el.innerHTML = label;
  });
  if (btn) btn.innerHTML = label;
}

function buildCardHtml(item) {
  const visibleFields = (item.displayFields || []).filter(function (field) {
    const key = dashboardColumnKey_(field && field.label);
    if (key === 'id') return false;
    return dashboardColumnVisible_(field && field.label);
  });
  const groups = groupCardFields_(visibleFields);
  const topRowHtml = groups.top.length
    ? `<div class="card-fields-row card-fields-row-top">${groups.top.map(function (f) { return cardFieldHtml_(item, f); }).join('')}</div>`
    : '';
  const actionRowHtml = groups.action.length
    ? groups.action.map(function (f) { return cardFieldHtml_(item, f); }).join('')
    : '';
  const instructionsHtml = groups.instructions.length
    ? groups.instructions.map(function (f) { return cardFieldHtml_(item, f); }).join('')
    : '';
  const bottomRowHtml = groups.bottom.length
    ? `<div class="card-fields-row card-fields-row-bottom">${groups.bottom.map(function (f) { return cardFieldHtml_(item, f); }).join('')}</div>`
    : '';
  const fieldsHtml = topRowHtml + actionRowHtml + instructionsHtml + bottomRowHtml;

  const subCount = (appState.submissionCounts || {})[item.row] || 0;
  const subFlash = !!(appState.submissionFlash || {})[item.row];

  const updateFieldsHtml = rowUpdatesHtml_(item.row);

  const updatesCount = (appState.displayedSubmissions || [])
    .filter(function (s) { return Number(s.cardRow) === Number(item.row); })
    .length;

  const updatesHidden = isRowUpdatesHidden_(item.row);

  const reviewBadgeHtml = item.reviewStatus === 'due'
    ? `<span class="review-badge review-due">Review due${appState.isAdmin ? `
        <span class="review-dropdown">
          <button type="button" class="review-dropdown-toggle" aria-label="Review actions" onclick="event.stopPropagation(); toggleReviewDropdown(this);">&#9662;</button>
          <span class="review-dropdown-menu">
            <button type="button" class="review-dropdown-item" onclick="event.stopPropagation(); markReviewDone('${escAttr(item.row)}');">Mark as review done</button>
          </span>
        </span>` : ''}</span>`
    : item.reviewStatus === 'done'
      ? `<span class="review-badge review-done">Review done${appState.isAdmin ? `
        <span class="review-dropdown">
          <button type="button" class="review-dropdown-toggle" aria-label="Review actions" onclick="event.stopPropagation(); toggleReviewDropdown(this);">&#9662;</button>
          <span class="review-dropdown-menu">
            <button type="button" class="review-dropdown-item" onclick="event.stopPropagation(); markReviewNotDone('${escAttr(item.row)}');">Mark as not done</button>
          </span>
        </span>` : ''}</span>`
      : '';

  const actionsHtml = `
    ${!appState.isEditor ? `<div class="submit-update-wrap">
      <button class="btn btn-secondary btn-small" onclick="openSubmissionsModal('${escAttr(item.row)}','${escAttr(item.id)}')">Submit update</button>
      ${subCount > 0 ? `<span class="submission-badge${subFlash ? ' flash' : ''}">${subCount}</span>` : ''}
    </div>` : ''}
    ${appState.isEditor && subCount > 0 ? `<div class="submit-update-wrap">${updatesCount > 0
      ? `<button class="btn btn-secondary btn-small toggle-updates-btn" data-updates-toggle="${escAttr(item.row)}" onclick="toggleCardUpdates('${escAttr(item.row)}', this)">${updatesHidden ? 'Show updates' : 'Hide updates'}</button>`
      : `<button class="btn btn-secondary btn-small" onclick="openSubmissionsModal('${escAttr(item.row)}','${escAttr(item.id)}')">View updates</button>`}
      <span class="submission-badge${subFlash ? ' flash' : ''}">${subCount}</span></div>` : ''}
    <div class="menu-dropdown">
      <button class="btn btn-secondary btn-small" type="button" onclick="event.stopPropagation(); toggleDropdown(this);">Print</button>
      <span class="menu-dropdown-menu">
        <button class="menu-dropdown-item" type="button" onclick="event.stopPropagation(); closeDropdowns(); printCard('${escAttr(item.row)}', true);">With submissions</button>
        <button class="menu-dropdown-item" type="button" onclick="event.stopPropagation(); closeDropdowns(); printCard('${escAttr(item.row)}', false);">Without submissions</button>
      </span>
    </div>
    ${appState.isEditor ? `<button class="btn btn-secondary btn-small" onclick="toggleCardAi('${escAttr(item.row)}', this)">AI insight</button>` : ''}
    ${appState.isEditor && itemHasLink_(item) ? `<button class="btn btn-secondary btn-small" onclick="toggleCardLink('${escAttr(item.row)}', this)">Analyze link</button>` : ''}
    ${appState.isEditor ? `<button class="btn btn-secondary btn-small" onclick="editItem('${escAttr(item.row)}')">Edit</button>` : ''}
    ${appState.isEditor ? `<button class="btn btn-danger btn-small" onclick="deleteItem('${escAttr(item.row)}')">Delete</button>` : ''}`;

  const showId = dashboardColumnVisible_('id');
  const showActions = dashboardColumnVisible_('actions');
  const displayToggleHtml = appState.isEditor ? `
    <label class="display-toggle" title="${item.displayed !== false ? 'Hide this record from viewers' : 'Show this record to viewers'}">
      <input type="checkbox" ${item.displayed !== false ? 'checked' : ''} onchange="toggleRecordDisplay('${escAttr(item.row)}', this.checked)">
      <span>Display</span>
    </label>` : '';
  return `
    <article class="card ${item.reviewStatus === 'due' ? 'review-due' : ''} ${item.displayed === false ? 'card-hidden' : ''}" data-row="${escAttr(item.row)}">
      ${reviewBadgeHtml}
      ${showId ? '<div class="card-title preserve-whitespace"><span class="id-badge">#' + escapeHtml(item.id) + '</span>' + displayToggleHtml + '</div>' : ''}
      <div class="card-fields">${fieldsHtml || '<div class="card-field"><span class="field-label">Details</span><div class="field-value preserve-whitespace">No details available</div></div>'}${updateFieldsHtml ? `<div class="card-updates${updatesHidden ? ' updates-hidden' : ''}" data-updates-row="${escAttr(item.row)}">${updateFieldsHtml}</div>` : ''}</div>
      ${showActions ? '<div class="card-footer"><div class="actions">' + actionsHtml + '</div></div>' : ''}
      ${aiPanelHtmlFromCache_(item.row)}
      ${linkPanelHtmlFromCache_(item.row)}
    </article>`;
}

/* ---------------------------------- Last meeting instructions ---------------------------------- */
/* Full "submit update"-style field: dated text entries (timestamp + office,
   optional attachments) shown in a modal list. Managed by admins/editors
   only; records.last_meeting_instructions mirrors the joined entry text. */

function openLastMeetingInstructions(row) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const item = (appState.items || []).find(function (i) { return Number(i.row) === Number(row); });
  if (!item) { showToast('Record not found.', 'error'); return; }
  appState.lastMeetingRow = item.row;
  appState.lastMeetingCardId = item.id;
  appState.lastMeetingEditingId = '';
  getEl('lastMeetingInstructionsRow').value = item.row;
  getEl('lastMeetingInstructionsText').value = '';
  const fileInput = getEl('lastMeetingAttachment');
  if (fileInput) fileInput.value = '';
  const fileName = getEl('lastMeetingAttachmentName');
  if (fileName) fileName.textContent = '';
  resetLastMeetingCompose();
  getEl('lastMeetingInstructionsRecord').textContent = 'Record #' + item.id + (item.sector ? ' · ' + item.sector : '');
  const status = getEl('lastMeetingInstructionsStatus');
  if (status) { status.textContent = ''; status.classList.remove('success', 'error'); }
  openDialog('lastMeetingInstructionsModal');
  loadLastMeetingEntries();
  setTimeout(function () { getEl('lastMeetingInstructionsText').focus(); }, 0);
}

function closeLastMeetingInstructions() { closeDialog('lastMeetingInstructionsModal'); }

function resetLastMeetingCompose() {
  getEl('submitLastMeetingBtn').textContent = 'Add entry';
  getEl('cancelLastMeetingBtn').classList.add('hidden');
}

function loadLastMeetingEntries() {
  ApiService.getInstructionEntries(Number(appState.lastMeetingRow)).then(function (list) {
    appState.lastMeetingEntries = list || [];
    renderLastMeetingEntries();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not load instructions: ' + (err.message || err), 'error');
  });
}

function renderLastMeetingEntries() {
  const list = appState.lastMeetingEntries || [];
  getEl('lastMeetingCount').textContent = list.length + ' instruction entr' + (list.length === 1 ? 'y' : 'ies');
  getEl('lastMeetingEntriesList').innerHTML = list.length
    ? list.map(renderLastMeetingEntryCard).join('')
    : '<div class="empty-state"><div class="empty-state-icon">' + svgIcon('inbox') + '</div><div class="empty-state-title">No instructions yet</div><div class="empty-state-subtitle">Add instructions from the last meeting for this record.</div></div>';
}

function renderLastMeetingEntryCard(s) {
  const attachmentsHtml = (s.attachments || []).map(function (a) {
    return '<div class="submission-attachment">📎 <a href="/api/files/' + encodeURIComponent(a.fileKey) + '?download=1" target="_blank" rel="noopener">' + escapeHtml(a.fileName) + '</a> <span class="form-status">(' + formatFileSize(a.size) + ')</span></div>';
  }).join('');
  const author = s.office ? s.office : (s.email ? s.email : 'Pre-existing');
  const editBtn = appState.isEditor
    ? `<button class="btn btn-secondary btn-small" type="button" onclick="editLastMeetingEntry('${escAttr(s.id)}')">Edit</button>`
    : '';
  const deleteBtn = appState.isEditor
    ? `<button class="btn btn-danger btn-small" type="button" onclick="deleteLastMeetingEntry('${escAttr(s.id)}')">Delete</button>`
    : '';
  return `
    <div class="submission-card">
      <div class="submission-meta">
        <span>${escapeHtml(author)}</span>
        <span>${escapeHtml(s.createdAt || '')}</span>
      </div>
      <div class="submission-text preserve-whitespace">${renderSubmissionText(s.text || '')}</div>
      ${attachmentsHtml ? '<div class="submission-attachments">' + attachmentsHtml + '</div>' : ''}
      <div class="submission-actions">${editBtn}${deleteBtn}</div>
    </div>`;
}

function editLastMeetingEntry(id) {
  const s = (appState.lastMeetingEntries || []).find(function (x) { return String(x.id) === String(id); });
  if (!s) return;
  appState.lastMeetingEditingId = s.id;
  getEl('lastMeetingInstructionsText').value = s.text;
  const fileInput = getEl('lastMeetingAttachment');
  if (fileInput) fileInput.value = '';
  const fileName = getEl('lastMeetingAttachmentName');
  if (fileName) fileName.textContent = '';
  getEl('submitLastMeetingBtn').textContent = 'Save changes';
  getEl('cancelLastMeetingBtn').classList.remove('hidden');
  getEl('lastMeetingInstructionsStatus').textContent = 'Editing entry';
}

function cancelLastMeetingEdit() {
  appState.lastMeetingEditingId = '';
  getEl('lastMeetingInstructionsText').value = '';
  const fileInput = getEl('lastMeetingAttachment');
  if (fileInput) fileInput.value = '';
  const fileName = getEl('lastMeetingAttachmentName');
  if (fileName) fileName.textContent = '';
  getEl('lastMeetingInstructionsStatus').textContent = '';
  resetLastMeetingCompose();
}

function insertLastMeetingLink() {
  const text = prompt('Link text:', 'Open link');
  if (text === null) return;
  const url = prompt('URL (https://…):', 'https://');
  if (url === null) return;
  const trimmed = String(url).trim();
  if (!/^https?:\/\//i.test(trimmed)) { showToast('Please enter a valid http:// or https:// URL.', 'warning'); return; }
  const ta = getEl('lastMeetingInstructionsText');
  const link = '[' + String(text || trimmed).replace(/\]/g, '') + '](' + trimmed.replace(/[()]/g, '') + ')';
  const start = ta.selectionStart == null ? ta.value.length : ta.selectionStart;
  const end = ta.selectionEnd == null ? ta.value.length : ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + link + ta.value.slice(end);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = start + link.length;
}

function handleLastMeetingAttachmentChange(input) {
  const file = input && input.files && input.files[0];
  const label = getEl('lastMeetingAttachmentName');
  if (!file) { if (label) label.textContent = ''; return; }
  if (file.size > 1024 * 1024) { input.value = ''; if (label) label.textContent = ''; getEl('lastMeetingInstructionsStatus').textContent = 'Attachment exceeds the 1 MB limit.'; return; }
  if (label) label.textContent = file.name + ' (' + formatFileSize(file.size) + ')';
}

function submitLastMeetingEntry() {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const text = getEl('lastMeetingInstructionsText').value;
  const fileInput = getEl('lastMeetingAttachment');
  const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  if (file && file.size > 1024 * 1024) { getEl('lastMeetingInstructionsStatus').textContent = 'Attachment exceeds the 1 MB limit.'; return; }
  if (!text || !text.trim()) {
    getEl('lastMeetingInstructionsStatus').textContent = 'Write the instructions before saving.';
    return;
  }
  const editingId = appState.lastMeetingEditingId;
  function buildAttachment(cb) {
    if (!file) { cb(null); return; }
    const reader = new FileReader();
    reader.onload = function () { const result = String(reader.result || ''); cb({ fileName: file.name, mimeType: file.type || 'application/octet-stream', base64: result.split(',')[1] || '' }); };
    reader.onerror = function () { getEl('lastMeetingInstructionsStatus').textContent = 'Could not read attachment.'; };
    reader.readAsDataURL(file);
  }
  buildAttachment(function (attachment) {
    if (editingId) {
      showOverlay('Saving entry…');
      ApiService.updateInstructionEntry(editingId, text, attachment).then(function (list) {
        hideOverlay();
        appState.lastMeetingEntries = list || [];
        appState.lastMeetingEditingId = '';
        getEl('lastMeetingInstructionsText').value = '';
        resetLastMeetingCompose();
        getEl('lastMeetingInstructionsStatus').textContent = '';
        renderLastMeetingEntries();
        showToast('Entry updated', 'success');
        refreshData();
      }).catch(function (err) {
        hideOverlay();
        if (handleServerFailure(err)) return;
        getEl('lastMeetingInstructionsStatus').textContent = err.message || 'Could not save entry';
      });
    } else {
      showOverlay('Adding entry…');
      ApiService.addInstructionEntry(Number(appState.lastMeetingRow), appState.lastMeetingCardId, text, attachment).then(function (list) {
        hideOverlay();
        appState.lastMeetingEntries = list || [];
        getEl('lastMeetingInstructionsText').value = '';
        resetLastMeetingCompose();
        getEl('lastMeetingInstructionsStatus').textContent = '';
        renderLastMeetingEntries();
        showToast('Entry added', 'success');
        refreshData();
      }).catch(function (err) {
        hideOverlay();
        if (handleServerFailure(err)) return;
        getEl('lastMeetingInstructionsStatus').textContent = err.message || 'Could not add entry';
      });
    }
  });
}

function deleteLastMeetingEntry(id) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  showConfirm({
    title: 'Delete instruction entry',
    message: 'Delete this instruction entry permanently?',
    okLabel: 'Delete',
    danger: true
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Deleting entry…');
    ApiService.deleteInstructionEntry(id).then(function (list) {
      hideOverlay();
      appState.lastMeetingEntries = list || [];
      renderLastMeetingEntries();
      showToast('Entry deleted', 'success');
      refreshData();
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not delete entry: ' + (err.message || err), 'error');
    });
  });
}

function emptyStateHtml() {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${svgIcon('search')}</div>
      <div class="empty-state-title">No records found</div>
      <div class="empty-state-subtitle">Try adjusting your search or clearing the active filters.</div>
    </div>`;
}

/* Incremental card renderer. Renders the first N cards, then appends the
   next batch only when a sentinel div scrolls into view. No libraries:
   IntersectionObserver is native in every modern browser. */
var dashScroll = { sentinel: null, io: null, rendered: 0, BATCH: 15 };

function renderDashboardCards() {
  const grid = getEl('dashboardCards');
  if (!grid) return;
  const start = (appState.page - 1) * PAGE_SIZE;
  const pageItems = sortedItems().slice(start, start + PAGE_SIZE);

  if (!pageItems.length) { grid.innerHTML = emptyStateHtml(); teardownDashScroller_(); return; }

  // Batch 1 synchronously (keeps above-the-fold instant). BATCH can exceed
  // the page size, so cap the rendered count at the actual number inserted.
  grid.innerHTML = pageItems.slice(0, dashScroll.BATCH).map(buildCardHtml).join('');
  dashScroll.rendered = Math.min(dashScroll.BATCH, pageItems.length);
  ensureDashSentinel_(grid, pageItems);
}

function ensureDashSentinel_(grid, pageItems) {
  // teardown resets dashScroll.rendered to 0, so snapshot it first: without
  // this the "all rendered" check below is always false and scrolling
  // re-appends the whole page (double-rendered cards).
  const alreadyRendered = dashScroll.rendered;
  teardownDashScroller_();
  dashScroll.rendered = alreadyRendered;
  if (dashScroll.rendered >= pageItems.length) return; // all rendered

  dashScroll.sentinel = document.createElement('div');
  dashScroll.sentinel.className = 'cards-sentinel';
  grid.appendChild(dashScroll.sentinel);

  dashScroll.io = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) return;
    const next = pageItems.slice(dashScroll.rendered, dashScroll.rendered + dashScroll.BATCH);
    if (!next.length) { teardownDashScroller_(); return; }

    const frag = document.createDocumentFragment();
    next.forEach(function (item) { frag.appendChild(htmlToNode_(buildCardHtml(item))); });
    if (dashScroll.sentinel && dashScroll.sentinel.parentNode) {
      dashScroll.sentinel.parentNode.insertBefore(frag, dashScroll.sentinel);
    }
    dashScroll.rendered += next.length;
    if (dashScroll.rendered >= pageItems.length) teardownDashScroller_();
  }, { rootMargin: '300px 0px' }); // lookahead so there is no visible blank gap

  dashScroll.io.observe(dashScroll.sentinel);
}

function teardownDashScroller_() {
  if (dashScroll.io) { dashScroll.io.disconnect(); dashScroll.io = null; }
  if (dashScroll.sentinel && dashScroll.sentinel.parentNode) {
    dashScroll.sentinel.parentNode.removeChild(dashScroll.sentinel);
  }
  dashScroll.sentinel = null;
  dashScroll.rendered = 0;
}

function htmlToNode_(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstChild;
}

/* ---------------------------------- Dashboard: table view ---------------------------------- */
/* Enterprise-style sortable table, additive alongside the card view. Rows use
   the same filters + pagination as the cards; clicking a row opens the record
   detail dialog (S8). */

function toggleDashboardView(view) {
  appState.dashboardView = view === 'table' ? 'table' : 'cards';
  renderDashboard();
}

function dashCompare(a, b) {
  const av = a == null ? '' : a;
  const bv = b == null ? '' : b;
  const an = Number(av);
  const bn = Number(bv);
  const aIsNum = av !== '' && isFinite(an);
  const bIsNum = bv !== '' && isFinite(bn);
  if (aIsNum && bIsNum) return an - bn;
  return String(av).toLowerCase() < String(bv).toLowerCase() ? -1
    : (String(av).toLowerCase() > String(bv).toLowerCase() ? 1 : 0);
}

function sortedItems() {
  const key = appState.dashSortKey;
  const dir = appState.dashSortDir === 'desc' ? -1 : 1;
  return appState.filtered.slice().sort(function (a, b) {
    return dashCompare(a[key], b[key]) * dir;
  });
}

function buildTableRowHtml(item) {
  const subCount = (appState.submissionCounts || {})[item.row] || 0;
  const statusBadge = item.reviewStatus === 'due'
    ? '<span class="review-badge review-due">Review due</span>'
    : item.reviewStatus === 'done'
      ? '<span class="review-badge review-done">Review done</span>'
      : '';
  const actions = `
    <div class="row-actions">
      ${!appState.isEditor ? `<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); openSubmissionsModal('${escAttr(item.row)}','${escAttr(item.id)}')">Update${subCount ? ' (' + subCount + ')' : ''}</button>` : ''}
      ${appState.isEditor ? `<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); toggleRowAi('${escAttr(item.row)}', this)">AI insight</button>` : ''}
      ${appState.isEditor && itemHasLink_(item) ? `<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); toggleRowLink('${escAttr(item.row)}', this)">Analyze link</button>` : ''}
      ${appState.isEditor ? `<button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); editItem('${escAttr(item.row)}')">Edit</button>` : ''}
      ${appState.isEditor ? `<button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteItem('${escAttr(item.row)}')">Delete</button>` : ''}
    </div>`;
  let persistedPanels = '';
  const aiPanel = aiPanelHtmlFromCache_(item.row);
  if (aiPanel) persistedPanels += '<tr class="ai-insight-tr"><td colspan="8">' + aiPanel + '</td></tr>';
  const linkPanel = linkPanelHtmlFromCache_(item.row);
  if (linkPanel) persistedPanels += '<tr class="ai-link-tr"><td colspan="8">' + linkPanel + '</td></tr>';
  return `
    <tr class="row-clickable ${item.reviewStatus === 'due' ? 'row-flagged' : ''} ${item.displayed === false ? 'row-hidden' : ''}" data-row="${escAttr(item.row)}" tabindex="0">
      <td><span class="id-badge">#${escapeHtml(item.id)}</span>${appState.isEditor ? `<label class="display-toggle" title="${item.displayed !== false ? 'Hide this record from viewers' : 'Show this record to viewers'}"><input type="checkbox" aria-label="Show this record to viewers" ${item.displayed !== false ? 'checked' : ''} onchange="event.stopPropagation(); toggleRecordDisplay('${escAttr(item.row)}', this.checked)"><span></span></label>` : ''}</td>
      <td class="preserve-whitespace">${escapeHtml(item.sector || '')}</td>
      <td class="details-cell preserve-whitespace">${escapeHtml(item.description || '')}</td>
      <td class="action-cell ${item.reviewStatus === 'due' ? 'action-cell-due' : 'action-cell-ok'} preserve-whitespace">${item.actionHtml || renderLinkableText(item.action || '')}</td>
      <td class="preserve-whitespace">${escapeHtml(item.entryDate || '')}</td>
      <td class="preserve-whitespace">${escapeHtml(item.reviewDate || '')}</td>
      <td>${statusBadge}</td>
      <td>${actions}</td>
    </tr>` + persistedPanels;
}

/* Visible result count above the cards so filter changes are obvious even
   when page 1 stays full (PAGE_SIZE caps the rendered cards). */
function renderDashboardCount() {
  const el = getEl('dashboardCardsSummary');
  if (!el) return;
  const total = appState.items.length;
  const shown = appState.filtered.length;
  const filtering = !!(appState.searchQuery || appState.sector || appState.dashReviewFilter);
  const plural = function (n) { return n === 1 ? 'record' : 'records'; };
  el.textContent = filtering
    ? 'Showing ' + shown + ' of ' + total + ' ' + plural(total)
    : shown + ' ' + plural(shown) + ' found';
}

function renderDashboardTable() {
  const wrap = getEl('dashboardTableWrap');
  const table = getEl('dashboardTable');
  if (!wrap || !table) return;
  const start = (appState.page - 1) * PAGE_SIZE;
  const pageItems = sortedItems().slice(start, start + PAGE_SIZE);

  table.querySelectorAll('thead th[data-dash-sort]').forEach(function (th) {
    const sortKey = th.getAttribute('data-dash-sort');
    if (sortKey === appState.dashSortKey) {
      th.setAttribute('aria-sort', appState.dashSortDir === 'asc' ? 'ascending' : 'descending');
    } else {
      th.removeAttribute('aria-sort');
    }
  });

  table.querySelector('tbody').innerHTML = pageItems.length
    ? pageItems.map(buildTableRowHtml).join('')
    : '<tr><td colspan="8">No records found.</td></tr>';

  const summaryEl = getEl('dashboardTableSummary');
  if (summaryEl) summaryEl.textContent = appState.filtered.length + ' record' + (appState.filtered.length === 1 ? '' : 's') + ' found';

  applyColumnVisibility();
}

function applyColumnVisibility() {
  const prefs = appState.dashboardPrefs || {};
  const columns = prefs.columns || {};
  const table = getEl('dashboardTable');
  if (!table) return;
  table.querySelectorAll('th[data-col]').forEach(function (th) {
    const col = th.getAttribute('data-col');
    const show = columns[col] !== false;
    th.style.display = show ? '' : 'none';
  });
  table.querySelectorAll('tbody tr').forEach(function (tr) {
    const cells = tr.querySelectorAll('td');
    const headers = table.querySelectorAll('th[data-col]');
    headers.forEach(function (th, idx) {
      if (cells[idx]) cells[idx].style.display = th.style.display;
    });
  });
}

function setDashSort(key) {
  if (key === appState.dashSortKey) {
    appState.dashSortDir = appState.dashSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    appState.dashSortKey = key;
    appState.dashSortDir = 'asc';
  }
  const sortSelect = getEl('dashSortSelect');
  if (sortSelect) {
    const optionValue = appState.dashSortKey === 'id' ? 'default' : appState.dashSortKey;
    if (sortSelect.querySelector('option[value="' + optionValue + '"]')) {
      sortSelect.value = optionValue;
    }
  }
  renderDashboard();
  scheduleDashboardPrefsSave();
}

function renderPagination() {
  const bar = getEl('paginationBar');
  if (!bar) return;
  const total = appState.filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (appState.page > pages) appState.page = pages;
  if (total <= PAGE_SIZE) {
    bar.innerHTML = '';
    return;
  }
  let html = `<button class="page-btn" type="button" onclick="setPage(${appState.page - 1})" ${appState.page <= 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>`;
  const start = Math.max(1, appState.page - 2);
  const end = Math.min(pages, start + 4);
  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn ${p === appState.page ? 'active' : ''}" type="button" onclick="setPage(${p})" ${p === appState.page ? 'aria-current="page"' : ''}>${p}</button>`;
  }
  html += `<button class="page-btn" type="button" onclick="setPage(${appState.page + 1})" ${appState.page >= pages ? 'disabled' : ''} aria-label="Next page">›</button>`;
  html += `<span class="page-info">${total} record${total === 1 ? '' : 's'}</span>`;
  bar.innerHTML = html;
}

function setPage(page) {
  const pages = Math.max(1, Math.ceil(appState.filtered.length / PAGE_SIZE));
  appState.page = Math.min(Math.max(1, page), pages);
  renderDashboardCards();
  renderDashboardTable();
  renderPagination();
  const target = appState.dashboardView === 'table' ? getEl('dashboardTableWrap') : getEl('dashboardCards');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDashboard(preservePage) {
  teardownDashScroller_();
  applyFilters(preservePage);
  renderKpiCards();
  updateFilterChips();
  renderDashboardCount();
  const grid = getEl('dashboardCards');
  const tableWrap = getEl('dashboardTableWrap');
  const viewCardsBtn = getEl('viewCardsBtn');
  const viewTableBtn = getEl('viewTableBtn');
  const isTable = appState.dashboardView === 'table';
  if (grid) grid.classList.toggle('hidden', isTable);
  if (tableWrap) tableWrap.classList.toggle('hidden', !isTable);
  if (viewCardsBtn) viewCardsBtn.classList.toggle('active', !isTable);
  if (viewTableBtn) viewTableBtn.classList.toggle('active', isTable);
  if (isTable) {
    renderDashboardTable();
  } else {
    renderDashboardCards();
  }
  renderPagination();
}

function refreshData() {
  showOverlay('Refreshing data…');
  ApiService.getAppData().then(function (data) {
    hideOverlay();
    // A modal may have opened while the request was in flight — defer the
    // repaint (and the toast) so the open modal is not disturbed; the
    // closeDialog/visibility flush re-runs this refresh once it is safe.
    if (hasOpenModal_()) { autoRefreshPending = true; return; }
    applyAppData(data);
    populateFilters();
    populateResponsibilitySelect();
  renderDashboard(true);
    refreshCounts();
    generateReviewNotifications();
    auditLoaded = false;
    const auditPanel = getEl('audit');
    if (auditPanel && !auditPanel.classList.contains('hidden')) {
      renderAuditPanel();
    }
    EventBus.emit('DataRefreshed');
    showToast('Dashboard refreshed', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Refresh failed: ' + (err.message || err), 'error');
  });
}

/* ---------------------------------- Analytics ---------------------------------- */

function renderAnalytics() {
  const summary = appState.summary || {};
  const analytics = appState.analytics || {};
  const trendPrev = (analytics.trendPrev && analytics.trendPrev.length) ? analytics.trendPrev[analytics.trendPrev.length - 1].value : 0;
  const trendCurr = (analytics.trend && analytics.trend.length) ? analytics.trend[analytics.trend.length - 1].value : 0;
  const trendDir = trendCurr > trendPrev ? 'up' : trendCurr < trendPrev ? 'down' : 'flat';
  const trendLabel = trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '→';
  const trendClass = trendDir === 'up' ? 'trend-up' : trendDir === 'down' ? 'trend-down' : 'trend-flat';

  const cards = [
    { title: 'Total records', value: summary.total || 0, trend: '' },
    { title: 'Review due', value: summary.flagged || 0, trend: '' },
    { title: 'Normal items', value: summary.normal || 0, trend: '' },
    { title: 'This month', value: trendCurr, trend: trendLabel, trendClass: trendClass }
  ].map(function (item) {
    return `<div class="analytics-card"><h3>${item.title}</h3><p>${item.value}${item.trend ? ' <span class="' + item.trendClass + '">' + item.trend + '</span>' : ''}</p></div>`;
  }).join('');
  getEl('analyticsCards').innerHTML = cards;

  const sectors = (analytics.sectors) || [];
  const offices = (analytics.offices) || [];
  const flagged = (analytics.flaggedItems) || [];
  const trend = (analytics.trend) || [];

  let reportHtml = `
    <div class="card">
      <h3>Records by sector</h3>
      <ul>${sectors.length ? sectors.map(function (s) {
        return `<li>${escapeHtml(s.sector)}: ${s.total}</li>`;
      }).join('') : '<li>No sector data</li>'}</ul>
    </div>`;

  if (offices.length) {
    reportHtml += `
    <div class="card">
      <h3>Records by office</h3>
      <ul>${offices.map(function (o) {
        return `<li>${escapeHtml(o.office)}: ${o.total}</li>`;
      }).join('')}</ul>
    </div>`;
  }

  if (trend.length) {
    reportHtml += `
    <div class="card">
      <h3>New records by month</h3>
      <ul>${trend.slice(-12).map(function (t) {
        return `<li>${escapeHtml(t.key)}: ${t.value}</li>`;
      }).join('')}</ul>
    </div>`;
  }

  reportHtml += `
    <div class="card">
      <h3>Flagged items (review due)</h3>
      <ul>${flagged.length ? flagged.slice(0, 50).map(function (item) {
        return `<li>#${escapeHtml(item.id)} — ${escapeHtml(item.sector)}${item.reviewDate ? ' · due ' + escapeHtml(item.reviewDate) : ''}</li>`;
      }).join('') : '<li>No flagged items</li>'}</ul>
    </div>`;

  getEl('analyticsReport').innerHTML = reportHtml;
  if (typeof renderExecutiveSnapshot === 'function') renderExecutiveSnapshot();
}

/* ---------------------------------- Audit ---------------------------------- */

function auditValue(row, key) {
  if (key === 'timestamp' && row.timestampMs != null) {
    return String(row.timestampMs).padStart(16, '0');
  }
  return row[key] == null ? '' : String(row[key]);
}

function renderAudit() {
  const table = getEl('auditTable');
  if (!table) return;
  const key = appState.auditSortKey;
  const dir = appState.auditSortDir;
  const rows = appState.audit.slice().sort(function (a, b) {
    const av = auditValue(a, key).toLowerCase();
    const bv = auditValue(b, key).toLowerCase();
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  table.querySelectorAll('thead th[data-sort]').forEach(function (th) {
    const sortKey = th.getAttribute('data-sort');
    if (sortKey === key) {
      th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
    } else {
      th.removeAttribute('aria-sort');
    }
  });

  const selected = {};
  appState.selectedAuditRows.forEach(function (r) { selected[r] = true; });

  const tbody = table.querySelector('tbody');
  const totalRows = rows.length;
  const pages = Math.max(1, Math.ceil(totalRows / AUDIT_PAGE_SIZE));
  if (appState.auditPage > pages) appState.auditPage = pages;
  const start = (appState.auditPage - 1) * AUDIT_PAGE_SIZE;
  const pageRows = rows.slice(start, start + AUDIT_PAGE_SIZE);

  tbody.innerHTML = pageRows.length ? pageRows.map(function (row) {
    const rowNum = Number(row.row);
    const selectable = isFinite(rowNum) && rowNum >= 2;
    const checkbox = appState.isAdmin && selectable
      ? `<input type="checkbox" class="audit-row-check" data-row="${rowNum}"${selected[rowNum] ? ' checked' : ''} onchange="updateAuditSelection()" aria-label="Select this audit entry">`
      : '';
    return `
      <tr>
        <td class="audit-check-col">${checkbox}</td>
        <td class="preserve-whitespace">${escapeHtml(formatTimestamp(row.timestampMs != null ? row.timestampMs : row.timestamp))}</td>
        <td class="preserve-whitespace">${escapeHtml(row.user)}</td>
        <td class="preserve-whitespace">${renderLinkableText(row.action)}</td>
        <td class="preserve-whitespace">${renderLinkableText(row.recordId)}</td>
        <td class="details-cell preserve-whitespace">${renderLinkableText(row.details)}</td>
      </tr>`;
  }).join('') : '<tr><td colspan="6">No audit entries yet.</td></tr>';

  updateAuditSelection();

  const summaryEl = getEl('auditSummary');
  if (summaryEl) summaryEl.textContent = totalRows
    ? (start + 1) + '–' + Math.min(start + AUDIT_PAGE_SIZE, totalRows) + ' of ' + totalRows + ' entries'
    : 'No entries';
  renderAuditPager();
}

function renderAuditPager() {
  const pager = getEl('auditPager');
  if (!pager) return;
  const total = appState.audit.length;
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  pager.innerHTML = pages <= 1 ? '' : `
    <button class="page-btn" type="button" onclick="setAuditPage(${appState.auditPage - 1})" ${appState.auditPage <= 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>
    <span class="page-info">Page ${appState.auditPage} of ${pages}</span>
    <button class="page-btn" type="button" onclick="setAuditPage(${appState.auditPage + 1})" ${appState.auditPage >= pages ? 'disabled' : ''} aria-label="Next page">›</button>`;
}

function setAuditPage(page) {
  const pages = Math.max(1, Math.ceil(appState.audit.length / AUDIT_PAGE_SIZE));
  appState.auditPage = Math.min(Math.max(1, page), pages);
  renderAudit();
}

function auditSelectedRows() {
  const selected = [];
  document.querySelectorAll('#auditTable .audit-row-check:checked').forEach(function (cb) {
    selected.push(Number(cb.getAttribute('data-row')));
  });
  return selected;
}

function updateAuditSelection() {
  appState.selectedAuditRows = auditSelectedRows();
  const boxes = document.querySelectorAll('#auditTable .audit-row-check');
  const selectAll = getEl('auditSelectAll');
  if (selectAll) {
    selectAll.checked = boxes.length > 0 && appState.selectedAuditRows.length === boxes.length;
    selectAll.disabled = !appState.isAdmin || boxes.length === 0;
  }
  const deleteBtn = getEl('deleteAuditBtn');
  if (deleteBtn) deleteBtn.disabled = appState.selectedAuditRows.length === 0;
  const clearBtn = getEl('clearAuditBtn');
  if (clearBtn) clearBtn.classList.toggle('hidden', !appState.isAdmin);
}

function toggleAuditSelectAll() {
  const selectAll = getEl('auditSelectAll');
  const checked = !!selectAll && selectAll.checked;
  document.querySelectorAll('#auditTable .audit-row-check').forEach(function (cb) {
    cb.checked = checked;
  });
  updateAuditSelection();
}

function deleteAuditRows() {
  const rows = appState.selectedAuditRows.slice().sort(function (a, b) { return a - b; });
  if (!rows.length) { showToast('Select audit entries to delete', 'warning'); return; }
  showConfirm({
    title: 'Delete audit entries',
    message: 'Delete ' + rows.length + ' selected audit entr' + (rows.length === 1 ? 'y' : 'ies') + '?',
    okLabel: 'Delete',
    danger: true
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Deleting audit entries…');
    ApiService.adminDeleteAuditRows(rows).then(function (result) {
      hideOverlay();
      appState.audit = result || [];
      appState.selectedAuditRows = [];
      appState.auditPage = 1;
      auditLoaded = true;
      renderAudit();
      showToast('Deleted ' + rows.length + ' audit entr' + (rows.length === 1 ? 'y' : 'ies'), 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not delete audit entries: ' + (err.message || err), 'error');
    });
  });
}

function clearAuditLog() {
  showConfirm({
    title: 'Clear audit log',
    message: 'Delete the ENTIRE audit log? This cannot be undone.',
    okLabel: 'Clear log',
    danger: true
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Clearing audit log…');
    ApiService.adminClearAudit().then(function (result) {
      hideOverlay();
      appState.audit = result || [];
      appState.selectedAuditRows = [];
      appState.auditPage = 1;
      auditLoaded = true;
      renderAudit();
      showToast('Audit log cleared', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not clear audit log: ' + (err.message || err), 'error');
    });
  });
}

function setAuditSort(key) {
  if (key === appState.auditSortKey) {
    appState.auditSortDir = appState.auditSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    appState.auditSortKey = key;
    appState.auditSortDir = key === 'timestamp' ? 'desc' : 'asc';
  }
  appState.auditPage = 1;
  renderAudit();
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
  }
  fallbackCopy(text);
  return Promise.resolve();
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (err) {}
  document.body.removeChild(ta);
}

function auditAsText() {
  return appState.audit.map(function (row) {
    return [formatTimestamp(row.timestampMs != null ? row.timestampMs : row.timestamp), row.user, row.action, row.recordId, row.details].join('\t');
  }).join('\n');
}

function copyAudit() {
  copyText(auditAsText()).then(function () {
    showToast('Audit log copied to clipboard', 'success');
  }, function () {
    showToast('Could not copy audit log', 'error');
  });
}

function toCsv(rows) {
  return rows.map(function (row) {
    return row.map(function (cell) {
      return '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\r\n');
}

function downloadTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

function downloadAuditCsv() {
  const headers = ['Time', 'User', 'Action', 'Record', 'Details'];
  const rows = appState.audit.map(function (row) {
    return [formatTimestamp(row.timestampMs != null ? row.timestampMs : row.timestamp), row.user, row.action, row.recordId, row.details];
  });
  downloadTextFile('IndiaPostDashboard_Audit_' + new Date().toISOString().slice(0, 10) + '.csv', toCsv([headers].concat(rows)), 'text/csv;charset=utf-8');
  showToast('Audit CSV downloaded', 'success');
}

function printAudit() {
  const entries = appState.audit || [];
  const rowsHtml = entries.length ? entries.map(function (row) {
    return `
      <tr>
        <td class="preserve-whitespace">${escapeHtml(formatTimestamp(row.timestampMs != null ? row.timestampMs : row.timestamp))}</td>
        <td>${escapeHtml(row.user)}</td>
        <td>${escapeHtml(row.action)}</td>
        <td>${escapeHtml(row.recordId)}</td>
        <td>${escapeHtml(row.details)}</td>
      </tr>`;
  }).join('') : '<tr><td colspan="5" class="empty">No audit entries yet.</td></tr>';

  const count = entries.length;
  const title = appState.settings.appName || 'India Post Dashboard';
  const now = new Date().toLocaleString();
  // about:blank print windows inherit this page's CSP including its nonce, so
  // the inline script below must carry the same value (see pageCspNonce).
  const cspNonce = pageCspNonce();
  const scriptNonce = cspNonce ? ' nonce="' + cspNonce + '"' : '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} - Audit Log</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; font-size: 12px; }
  .report-header { border-bottom: 3px solid #1f5c2e; padding-bottom: 8px; margin-bottom: 12px; }
  .report-header h1 { margin: 0; font-size: 18px; color: #1f5c2e; }
  .report-header .meta { margin-top: 4px; color: #6b7280; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
  th { background: #1f5c2e; color: #fff; font-weight: 600; white-space: nowrap; }
  td.preserve-whitespace { white-space: pre-wrap; }
  tr:nth-child(even) td { background: #f9fafb; }
  .empty { text-align: center; color: #6b7280; padding: 16px; }
  .report-footer { margin-top: 12px; color: #6b7280; font-size: 10px; }
</style>
</head>
<body>
  <div class="report-header">
    <h1>${escapeHtml(title)} - Audit Log</h1>
    <div class="meta">Generated ${escapeHtml(now)} &middot; ${count} entr${count === 1 ? 'y' : 'ies'}</div>
  </div>
  <table>
    <thead>
      <tr><th>Time</th><th>User</th><th>Action</th><th>Record</th><th>Details</th></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="report-footer">India Post Dashboard &middot; Circle Office Haryana</div>
  <script${scriptNonce}>window.onload = function () { window.focus(); setTimeout(function () { window.print(); }, 100); };<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=980,height=720');
  if (!win) { showToast('Pop-up blocked. Please allow pop-ups to print the audit log.', 'error'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/* ---------------------------------- Reports ---------------------------------- */

function renderReportPreview() {
  const wrap = getEl('reportPreview');
  if (!wrap) return;
  const templateKey = getEl('reportTemplate') ? getEl('reportTemplate').value : 'summary';
  let items = appState.items || [];
  if (templateKey === 'flagged') items = items.filter(function (i) { return i.flagged; });
  const itemsHtml = items.map(function (item) {
    return `
      <tr>
        <td class="preserve-whitespace">${escapeHtml(item.id)}</td>
        <td class="preserve-whitespace">${renderLinkableText(item.sector)}</td>
        <td class="preserve-whitespace">${renderLinkableText(item.description)}</td>
        <td class="preserve-whitespace">${item.actionHtml || renderLinkableText(item.action)}</td>
        <td class="preserve-whitespace">${renderLinkableText(item.responsibility)}</td>
        <td class="preserve-whitespace">${renderLinkableText(item.reviewDate)}</td>
      </tr>`;
  }).join('');
  wrap.innerHTML = `
    <h3>Report preview (${templateKey})</h3>
    <div class="report-preview-scroll">
      <table class="data-table">
        <thead><tr><th>#</th><th>Sector</th><th>Description</th><th>Action</th><th>Responsibility</th><th>Review</th></tr></thead>
        <tbody>${itemsHtml || '<tr><td colspan="6">No records to report.</td></tr>'}</tbody>
      </table>
    </div>`;
}

function downloadReportCsv() {
  const headers = ['#', 'Sector', 'Description', 'Entry Date', 'Action', 'Responsibility', 'Review Date', 'Flagged'];
  const rows = (appState.items || []).map(function (item) {
    return [item.id, item.sector, item.description, item.entryDate, item.action, item.responsibility, item.reviewDate, item.flagged ? 'YES' : 'NO'];
  });
  downloadTextFile('IndiaPostDashboard_Report_' + new Date().toISOString().slice(0, 10) + '.csv', toCsv([headers].concat(rows)), 'text/csv;charset=utf-8');
  showToast('Report CSV downloaded', 'success');
}

function openPrintWindow(html) {
  const win = window.open('', '_blank', 'width=980,height=720');
  if (!win) { showToast('Pop-up blocked. Please allow pop-ups to print.', 'error'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function buildPrintPage(opts) {
  const title = opts.title || (appState.settings.appName || 'India Post Dashboard');
  const now = new Date().toLocaleString();
  const subtitle = opts.subtitle ? ' &middot; ' + escapeHtml(opts.subtitle) : '';
  const initialOrient = opts.landscape ? 'landscape' : 'portrait';
  // about:blank print windows inherit this page's CSP including its nonce, so
  // the inline script below must carry the same value (see pageCspNonce).
  const cspNonce = pageCspNonce();
  const scriptNonce = cspNonce ? ' nonce="' + cspNonce + '"' : '';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; font-size: 14px; line-height: 1.6; }
  .print-toolbar {
    display: flex; align-items: center; gap: 10px;
    position: sticky; top: 0; z-index: 10;
    background: #eef3ef; border-bottom: 1px solid #d1d5db;
    padding: 10px 14px; margin-bottom: 18px;
  }
  .print-toolbar .toolbar-title { font-weight: 600; color: #1f5c2e; margin-right: 4px; }
  .print-toolbar button {
    border: 1px solid #1f5c2e; background: #fff; color: #1f5c2e;
    padding: 6px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .print-toolbar button.active { background: #1f5c2e; color: #fff; }
  .print-toolbar .print-btn { background: #1f5c2e; color: #fff; margin-left: auto; }
  .print-toolbar label.print-toggle { color: #1f5c2e; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .print-links-block { break-inside: avoid; page-break-inside: avoid; }
  body.no-links .print-links-block { display: none !important; }
  @media print { .print-toolbar { display: none; } }
  .report-header { border-bottom: 3px solid #1f5c2e; padding-bottom: 14px; margin-bottom: 20px; }
  .report-header h1 { margin: 0; font-size: 26px; color: #1f5c2e; letter-spacing: 0.2px; }
  .report-header .meta { margin-top: 8px; color: #6b7280; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.55; }
  th { background: #1f5c2e; color: #fff; font-weight: 600; white-space: nowrap; font-size: 13.5px; letter-spacing: 0.2px; }
  td.num { white-space: nowrap; }
  tr:nth-child(even) td { background: #f9fafb; }
  .empty { text-align: center; color: #6b7280; padding: 28px 16px; font-size: 14px; }
  .sub-block { background: #f3f7f4; border-left: 4px solid #1f5c2e; margin-top: 10px; padding: 14px 16px; }
  .record-print-block { border: 1px solid #d1d5db; border-radius: 8px; padding: 14px 16px; margin: 0 0 14px; break-inside: avoid; page-break-inside: avoid; }
  .record-print-block .fields-table { margin: 0; }
  .sub-block h2, .sub-block h4 { margin: 0 0 10px; font-size: 14px; color: #1f5c2e; }
  .sub-item { padding: 8px 0; border-bottom: 1px dotted #d1d5db; }
  .sub-item:last-child { border-bottom: none; }
  .sub-meta { color: #6b7280; font-size: 12px; margin-bottom: 4px; }
  .preserve-whitespace { white-space: pre-wrap; }
  .report-footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
  #pageRule { display: none; }
</style>
</head>
<body>
  <div class="print-toolbar">
    <span class="toolbar-title">Print layout</span>
    <button type="button" id="btnOrientV" class="${initialOrient === 'portrait' ? 'active' : ''}" onclick="setOrient('portrait')">Vertical</button>
    <button type="button" id="btnOrientH" class="${initialOrient === 'landscape' ? 'active' : ''}" onclick="setOrient('landscape')">Horizontal</button>
    <label class="print-toggle" title="Include the hyperlink data table on each record"><input type="checkbox" id="toggleLinks" checked onchange="toggleLinks(this.checked)"> Include hyperlink data</label>
    <button type="button" class="print-btn" onclick="doPrint()">Print</button>
  </div>
  <style id="pageRule">@page { size: ${opts.landscape ? 'A4 landscape' : 'A4 portrait'}; margin: 16mm; }</style>
  <div class="report-header">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated ${escapeHtml(now)}${subtitle}</div>
  </div>
  ${opts.body}
  <div class="report-footer">India Post Dashboard &middot; Circle Office Haryana</div>
  <script${scriptNonce}>
    function setOrient(o) {
      var rule = '@page { size: ' + (o === 'landscape' ? 'A4 landscape' : 'A4 portrait') + '; margin: 16mm; }';
      document.getElementById('pageRule').textContent = rule;
      document.getElementById('btnOrientV').classList.toggle('active', o === 'portrait');
      document.getElementById('btnOrientH').classList.toggle('active', o === 'landscape');
    }
    function toggleLinks(on) {
      document.body.classList.toggle('no-links', !on);
    }
    function doPrint() {
      window.focus();
      setTimeout(function () { window.print(); }, 60);
    }
  <\/script>
</body>
</html>`;
}

/* Hyperlink data table for print: a compact Field / Link text / URL table
   drawn from item.links (per-field array form) with a fallback to the legacy
   linkUrls/linkTexts shape. Returns '' when the record has no links. */
function printLinksHtml_(item) {
  const labelFor = function (key) {
    const map = { action: 'Action', description: 'Description', sector: 'Sector', entryDate: 'Entry Date', responsibility: 'Responsibility', reviewDate: 'Review Date', lastMeetingInstructions: 'Last meeting instructions' };
    return map[key] || String(key || '').replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); });
  };
  const rows = [];
  const links = (item && item.links) || {};
  Object.keys(links).forEach(function (key) {
    const list = links[key];
    if (Array.isArray(list)) {
      list.forEach(function (l) {
        if (l && l.url) rows.push({ label: labelFor(key), text: (l.text || l.url), url: l.url });
      });
    } else if (list && list.url) {
      rows.push({ label: labelFor(key), text: (list.text || list.url), url: list.url });
    }
  });
  if (!rows.length) {
    const urls = (item && item.linkUrls) || {};
    const texts = (item && item.linkTexts) || {};
    Object.keys(urls).forEach(function (key) {
      rows.push({ label: labelFor(key), text: ((texts && texts[key]) || urls[key]), url: urls[key] });
    });
  }
  if (!rows.length) return '';
  return `<div class="print-links-block"><h2 style="margin:20px 0 10px;font-size:16px;color:#1f5c2e;">Hyperlinks</h2><div class="sub-block">
    <table style="margin:0"><thead><tr><th style="width:22%">Field</th><th style="width:58%">Link text</th><th>URL</th></tr></thead><tbody>
      ${rows.map(function (r) {
        const href = linkableHref(r.url);
        return '<tr><td>' + escapeHtml(r.label) + '</td><td>' + escapeHtml(r.text) + '</td><td>' + (href
          ? '<a href="' + escAttr(href) + '" target="_blank" rel="noopener">' + escapeHtml(r.url) + '</a>'
          : escapeHtml(r.url)) + '</td></tr>';
      }).join('')}
    </tbody></table>
  </div></div>`;
}

function groupSubmissionsByCard_(list) {
  const map = {};
  (list || []).forEach(function (s) {
    const key = Number(s.cardRow);
    if (!map[key]) map[key] = [];
    map[key].push(s);
  });
  return map;
}

function countSubmissions_(map) {
  let n = 0;
  Object.keys(map || {}).forEach(function (k) { n += map[k].length; });
  return n;
}

function printCard(row, includeSubmissions) {
  const item = (appState.items || []).find(function (x) { return Number(x.row) === Number(row); });
  if (!item) { showToast('Record not found.', 'error'); return; }
  const useSubs = includeSubmissions === true;

  const build = function (subs) {
    const fields = (item.displayFields || []).map(function (field) {
      const label = String(field && field.label || '').trim();
      const value = field.html ? field.html : escapeHtml(field.value);
      return `
        <tr>
          <th style="width:32%">${escapeHtml(label || 'Value')}</th>
          <td class="preserve-whitespace">${value}</td>
        </tr>`;
    }).join('');

    const subsHtml = (subs && subs.length) ? `
      <h2 style="margin:20px 0 10px;font-size:16px;color:#1f5c2e;">Submissions (${subs.length})</h2>
      <div class="sub-block">
        ${subs.map(function (s) {
          return `
          <div class="sub-item">              <div class="sub-meta">${escapeHtml(s.email)} &middot; ${escapeHtml(formatTimestamp(s.createdAt))}</div>
            <div class="preserve-whitespace">${escapeHtml(s.text || '')}</div>
          </div>`;
        }).join('')}
      </div>` : '';

    openPrintWindow(buildPrintPage({
      title: (appState.settings.appName || 'India Post Dashboard') + ' - Record #' + item.id,
      subtitle: (useSubs ? 'with submissions' : 'without submissions') + ' &middot; Record #' + item.id + (item.sector ? ' &middot; ' + item.sector : ''),
      body: `<div class="record-print-block"><table class="fields-table">
        <tbody>${fields || '<tr><td colspan="2" class="empty">No details available.</td></tr>'}</tbody>
      </table>${printLinksHtml_(item)}${subsHtml}</div>`
    }));
  };

  if (useSubs) {
    showOverlay('Preparing print…');
    ApiService.getSubmissions(Number(row)).then(function (list) {
      hideOverlay();
      build(list || []);
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not load submissions: ' + (err.message || err), 'error');
    });
  } else {
    build([]);
  }
}

/* Print a report of the records. scope: 'all' (every record, the full
   appState.items set) or 'visible' (the current search/sector/review-filtered
   and sorted list, exactly what the dashboard shows). */
function printReport(scope, includeSubmissions) {
  const useSubs = includeSubmissions === true;
  const items = scope === 'visible' ? sortedItems() : (appState.items || []).slice();
  const scopeLabel = scope === 'visible' ? 'visible records' : 'all records';

  const run = function (subMap) {
    let bodyHtml = '';
    if (!items.length) {
      bodyHtml = '<div class="empty">No records to report.</div>';
    } else if (useSubs) {
      bodyHtml = items.map(function (item) {
        const subs = (subMap && subMap[Number(item.row)]) || [];
        const subsHtml = subs.length ? `
          <div class="sub-block">
            <h4>Submissions (${subs.length})</h4>
            ${subs.map(function (s) {
              return `<div class="sub-item"><div class="sub-meta">${escapeHtml(s.email)} &middot; ${escapeHtml(formatTimestamp(s.createdAt))}</div><div class="preserve-whitespace">${escapeHtml(s.text || '')}</div></div>`;
            }).join('')}
          </div>` : '';
        return `<div class="record-print-block"><table class="fields-table"><tbody>
          <tr><th style="width:18%">#</th><td>${escapeHtml(item.id)}</td></tr>
          <tr><th>Sector</th><td>${escapeHtml(item.sector)}</td></tr>
          <tr><th>Description</th><td class="preserve-whitespace">${escapeHtml(item.description)}</td></tr>
          <tr><th>Action</th><td class="preserve-whitespace">${item.actionHtml || renderLinkableText(item.action || '')}</td></tr>
          <tr><th>Last Meeting Instructions</th><td class="preserve-whitespace">${escapeHtml(item.lastMeetingInstructions || '')}</td></tr>
          <tr><th>Responsibility</th><td>${escapeHtml(item.responsibility)}</td></tr>
          <tr><th>Review</th><td>${escapeHtml(item.reviewDate)}</td></tr>
        </tbody></table>${printLinksHtml_(item)}${subsHtml}</div>`;
      }).join('');
    } else {
      const rowsHtml = items.map(function (item) {
        return `<tr><td class="num">${escapeHtml(item.id)}</td><td>${escapeHtml(item.sector)}</td><td>${escapeHtml(item.description)}</td><td class="preserve-whitespace">${item.actionHtml || renderLinkableText(item.action || '')}</td><td class="preserve-whitespace">${escapeHtml(item.lastMeetingInstructions || '')}</td><td>${escapeHtml(item.responsibility)}</td><td>${escapeHtml(item.reviewDate)}</td></tr>`;
      }).join('');
      bodyHtml = `<table><thead><tr><th>#</th><th>Sector</th><th>Description</th><th>Action</th><th>Last Meeting Instructions</th><th>Responsibility</th><th>Review</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
    }
    const count = items.length;
    const subCount = useSubs ? countSubmissions_(subMap) : 0;
    const subtitle = (scopeLabel + ' &middot; ' + (useSubs
      ? count + ' record' + (count === 1 ? '' : 's') + ' with submissions (' + subCount + ')'
      : count + ' record' + (count === 1 ? '' : 's') + ' without submissions'));

    openPrintWindow(buildPrintPage({
      title: (appState.settings.appName || 'India Post Dashboard') + ' - Report',
      landscape: true,
      subtitle: subtitle,
      body: bodyHtml
    }));
  };

  if (useSubs) {
    showOverlay('Preparing report…');
    ApiService.getSubmissions().then(function (list) {
      hideOverlay();
      run(groupSubmissionsByCard_(list || []));
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not load submissions: ' + (err.message || err), 'error');
    });
  } else {
    run(null);
  }
}

function downloadFromBase64(base64, filename, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'IndiaPostDashboard_Report';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

function exportSpreadsheet() {
  showOverlay('Exporting Excel file…');
  ApiService.exportToSpreadsheet().then(function (result) {
    hideOverlay();
    if (result && result.base64) {
      downloadFromBase64(result.base64, result.filename || 'IndiaPostDashboard_Report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      showToast('Excel file downloaded', 'success');
    } else {
      showToast('Excel export failed', 'error');
    }
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Excel export failed: ' + (err.message || err), 'error');
  });
}

function downloadPdf() {
  showOverlay('Generating PDF…');
  ApiService.createPdfReport().then(function (result) {
    hideOverlay();
    if (result && result.base64) {
      downloadFromBase64(result.base64, result.filename || 'IndiaPostDashboard_Report.pdf', 'application/pdf');
      showToast('PDF downloaded', 'success');
    } else {
      showToast('PDF export failed', 'error');
    }
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('PDF export failed: ' + (err.message || err), 'error');
  });
}

/* ---------------------------------- Email report ---------------------------------- */

function openEmailReportDialog() {
  const templateSelect = getEl('reportTemplate');
  const emailTemplate = getEl('emailReportTemplate');
  if (templateSelect && emailTemplate) emailTemplate.value = templateSelect.value;
  const recipient = getEl('emailReportRecipient');
  const user = appState.user || {};
  if (recipient && !recipient.value && user.email) recipient.value = user.email;
  getEl('emailReportStatus').textContent = '';
  openDialog('emailReportModal');
}

function closeEmailReportDialog() {
  closeDialog('emailReportModal');
}

function sendEmailReport() {
  const recipient = (getEl('emailReportRecipient').value || '').trim();
  const templateKey = (getEl('emailReportTemplate') ? getEl('emailReportTemplate').value : 'summary') || 'summary';
  const status = getEl('emailReportStatus');
  const sendBtn = getEl('emailReportSendBtn');
  if (!recipient) {
    status.textContent = 'Enter a recipient email address.';
    status.classList.add('error');
    return;
  }
  status.textContent = '';
  status.classList.remove('error');
  if (sendBtn) sendBtn.disabled = true;
  showOverlay('Sending report by email…');
  ApiService.emailReport(recipient, templateKey).then(function (result) {
    hideOverlay();
    if (sendBtn) sendBtn.disabled = false;
    closeEmailReportDialog();
    showToast('Report sent to ' + result.sentTo, 'success');
  }).catch(function (err) {
    hideOverlay();
    if (sendBtn) sendBtn.disabled = false;
    if (handleServerFailure(err)) return;
    status.textContent = 'Failed to send: ' + (err.message || err);
    status.classList.add('error');
  });
}

/* ---------------------------------- Email all users (broadcast) ---------------------------------- */

function openEmailAllUsersDialog() {
  const subjectEl = getEl('emailAllUsersSubject');
  const bodyEl = getEl('emailAllUsersBody');
  if (subjectEl) subjectEl.value = '';
  if (bodyEl) bodyEl.value = '';
  getEl('emailAllUsersStatus').textContent = '';
  getEl('emailAllUsersStatus').classList.remove('error', 'success');
  openDialog('emailAllUsersModal');
}

function closeEmailAllUsersDialog() {
  closeDialog('emailAllUsersModal');
}

function sendEmailAllUsers() {
  const subject = (getEl('emailAllUsersSubject').value || '').trim();
  const body = (getEl('emailAllUsersBody').value || '').trim();
  const status = getEl('emailAllUsersStatus');
  const sendBtn = getEl('emailAllUsersSendBtn');
  if (!subject) {
    status.textContent = 'Enter a subject.';
    status.classList.add('error');
    return;
  }
  if (!body) {
    status.textContent = 'Enter a message body.';
    status.classList.add('error');
    return;
  }
  status.textContent = '';
  status.classList.remove('error');
  if (sendBtn) sendBtn.disabled = true;
  showOverlay('Sending to all users…');
  ApiService.adminEmailAllUsers(subject, body).then(function (result) {
    hideOverlay();
    if (sendBtn) sendBtn.disabled = false;
    closeEmailAllUsersDialog();
    showToast('Email sent to ' + result.sent + ' user(s)', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (sendBtn) sendBtn.disabled = false;
    if (handleServerFailure(err)) return;
    status.textContent = 'Failed to send: ' + (err.message || err);
    status.classList.add('error');
  });
}

/* ---------------------------------- Settings ---------------------------------- */

function renderSettings() {
  loadDivisionalDashboardLinks();
  getEl('mustChangeBanner').classList.toggle('hidden', !appState.mustChange);

  // CSV import drop zone — editors and admins
  var csvImportCard = getEl('csvImportCard');
  if (csvImportCard) csvImportCard.classList.toggle('hidden', !appState.isEditor);
  wireCsvImportDropZone();

  // Google Sheet sync + full backup — admin only.
  const sheetSyncCard = getEl('sheetSyncCard');
  if (sheetSyncCard) sheetSyncCard.classList.toggle('hidden', !appState.isAdmin);
  const backupCard = getEl('backupCard');
  if (backupCard) backupCard.classList.toggle('hidden', !appState.isAdmin);
  if (appState.isAdmin) loadAutoSyncStatus();

  // System health — admin only (Part 17)
  const systemHealthCard = getEl('systemHealthCard');
  if (systemHealthCard) {
    systemHealthCard.classList.toggle('hidden', !appState.isAdmin);
    if (appState.isAdmin) loadSystemHealth();
  }

  const usersAdmin = getEl('usersAdmin');
  const userActivityCard = getEl('userActivityCard');
  if (appState.isAdmin && can('users', 'view')) {
    usersAdmin.classList.remove('hidden');
    if (userActivityCard) userActivityCard.classList.remove('hidden');
    loadUsers();
    loadUserActivity();
  } else {
    usersAdmin.classList.add('hidden');
    if (userActivityCard) userActivityCard.classList.add('hidden');
  }

  // Fathom API key — admin only
  var fathomCard = getEl('fathomSettingsCard');
  if (fathomCard) {
    if (appState.isAdmin) {
      fathomCard.classList.remove('hidden');
      ApiService.getFathomStatus().then(function (data) {
        var f = data && data.fathom;
        var st = getEl('fathomSettingsStatus');
        if (!f) return;
        if (f.configured) {
          if (st) { st.textContent = '\u2713 Configured'; st.style.color = 'var(--success, #16a34a)'; }
        } else if (f.enabled) {
          if (st) { st.textContent = 'Not configured — paste your key above'; st.style.color = 'var(--warning, #d97706)'; }
        } else {
          if (st) { st.textContent = 'Fathom integration is disabled on the server'; st.style.color = 'var(--muted)'; }
        }
      }).catch(function () {});
    } else {
      fathomCard.classList.add('hidden');
    }
  }
}

/* ---------------------------- System health (Part 17) ---------------------------- */

function healthDuration_(sec) {
  sec = Number(sec) || 0;
  var d = Math.floor(sec / 86400);
  var h = Math.floor((sec % 86400) / 3600);
  var m = Math.floor((sec % 3600) / 60);
  if (d) return d + 'd ' + h + 'h';
  if (h) return h + 'h ' + m + 'm';
  if (m) return m + 'm';
  return sec + 's';
}

function healthAge_(ms) {
  if (ms == null) return 'never';
  var s = Math.round(Number(ms) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.round(s / 60) + 'm ago';
  if (s < 172800) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
}

function healthBytes_(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
  return (n / 1073741824).toFixed(2) + ' GB';
}

function healthPill_(ok, okText, badText) {
  var text = ok ? (okText || 'OK') : (badText || 'Error');
  return '<span class="health-pill ' + (ok ? 'health-pill-ok' : 'health-pill-bad') + '">' + escapeHtml(text) + '</span>';
}

function healthRow_(label, valueHtml) {
  return '<div class="health-row"><span class="health-label">' + escapeHtml(label) + '</span><span class="health-value">' + valueHtml + '</span></div>';
}

function renderSystemHealth(h) {
  var body = getEl('systemHealthBody');
  if (!body || !h) return;
  var b = h.backend || {};
  var mem = b.memory || {};
  var metrics = h.metrics || {};
  var c = h.counters || {};
  var parts = ['<div class="health-grid">'];

  parts.push('<div class="health-card"><div class="health-card-title">Backend</div>' +
    healthRow_('Status', healthPill_(!!b.ok)) +
    healthRow_('Uptime', escapeHtml(healthDuration_(b.uptimeSec))) +
    healthRow_('Node', escapeHtml(b.node || '—')) +
    healthRow_('Memory', escapeHtml((mem.heapUsedMb || 0) + ' / ' + (mem.rssMb || 0) + ' MB')) +
    '</div>');

  parts.push('<div class="health-card"><div class="health-card-title">Database</div>' +
    healthRow_('Status', healthPill_(!!(h.database && h.database.ok))) +
    healthRow_('Size', escapeHtml(healthBytes_(h.database && h.database.sizeBytes))) +
    healthRow_('P95 latency', escapeHtml((metrics.p95LatencyMs == null ? '—' : metrics.p95LatencyMs + ' ms'))) +
    healthRow_('Requests', escapeHtml(String(metrics.requestCount == null ? '—' : metrics.requestCount))) +
    '</div>');

  var bk = h.backup || {};
  parts.push('<div class="health-card"><div class="health-card-title">KV backup</div>' +
    healthRow_('Bridge', healthPill_(!!bk.enabled, 'Enabled', 'Disabled')) +
    healthRow_('Last backup', escapeHtml(bk.lastBackupAt ? healthAge_(bk.ageMs) : 'never')) +
    healthRow_('Budget left', escapeHtml(String(bk.budgetLeft == null ? '—' : bk.budgetLeft) + ' / ' + String(bk.budget == null ? '—' : bk.budget))) +
    (bk.error ? healthRow_('Error', '<span class="health-error">' + escapeHtml(bk.error) + '</span>') : '') +
    '</div>');

  var w = h.worker || {};
  var ai = h.ai || {};
  parts.push('<div class="health-card"><div class="health-card-title">Worker + AI</div>' +
    healthRow_('Worker URL', healthPill_(!!w.urlSet, 'Set', 'Not set')) +
    healthRow_('Worker token', healthPill_(!!w.tokenSet, 'Set', 'Not set')) +
    healthRow_('AI enabled', healthPill_(!!ai.enabled, 'Yes', 'No')) +
    healthRow_('AI key', healthPill_(!!ai.keySet, 'Set', 'Not set')) +
    '</div>');

  var nf = h.notifications || {};
  parts.push('<div class="health-card"><div class="health-card-title">Notifications</div>' +
    healthRow_('Unread', escapeHtml(nf.unread == null ? '—' : String(nf.unread))) +
    healthRow_('Last generated', escapeHtml(nf.lastGeneratedAt ? healthAge_(Date.now() - new Date(nf.lastGeneratedAt).getTime()) : '—')) +
    healthRow_('Error rate', escapeHtml((metrics.errorRatePct == null ? '—' : metrics.errorRatePct + '%'))) +
    healthRow_('Server errors', escapeHtml(String(metrics.errorCount == null ? '—' : metrics.errorCount))) +
    '</div>');

  parts.push('</div>');

  parts.push('<div class="health-counters">' +
    '<span class="health-counter">API errors <b>' + escapeHtml(String(c.apiErrors || 0)) + '</b></span>' +
    '<span class="health-counter">Auth failures <b>' + escapeHtml(String(c.authFailures || 0)) + '</b></span>' +
    '<span class="health-counter">Rate-limit events <b>' + escapeHtml(String(c.rateLimitEvents || 0)) + '</b></span>' +
    '<span class="health-counter">AI failures <b>' + escapeHtml(String(c.aiFailures || 0)) + '</b></span>' +
    '</div>');

  var errors = h.recentErrors || [];
  parts.push('<div class="health-errors"><div class="health-errors-title">Recent errors (' + errors.length + ')</div>');
  if (!errors.length) {
    parts.push('<p class="section-copy muted">No errors recorded since the server started.</p>');
  } else {
    parts.push('<ul class="health-error-list">' + errors.slice(0, 20).map(function (e) {
      return '<li><span class="health-error-src">' + escapeHtml(e.source) + '</span>' +
        '<span class="health-error-msg">' + escapeHtml(e.message) + '</span>' +
        '<span class="health-error-time">' + escapeHtml(new Date(e.at).toLocaleString()) + '</span></li>';
    }).join('') + '</ul>');
  }
  parts.push('</div>');

  body.innerHTML = parts.join('');
}

function loadSystemHealth(userTriggered) {
  var body = getEl('systemHealthBody');
  if (body && !body.innerHTML.trim()) body.innerHTML = '<p class="section-copy muted">Loading system health…</p>';
  var btn = getEl('systemHealthRefreshBtn');
  if (btn) btn.disabled = true;
  return ApiService.getSystemHealth().then(function (data) {
    if (!data || data.success === false) throw new Error((data && data.message) || 'System health unavailable');
    renderSystemHealth(data);
    if (userTriggered) showToast('System health refreshed.', 'success');
  }).catch(function (err) {
    if (body) body.innerHTML = '<p class="section-copy health-error">Could not load system health: ' + escapeHtml(err && err.message || String(err)) + '</p>';
    if (userTriggered) showToast('Could not load system health.', 'error');
  }).then(function () {
    if (btn) btn.disabled = false;
  });
}

function saveSettingsFathomKey() {
  var input = getEl('settingsFathomApiKey');
  var key = input ? input.value.trim() : '';
  if (!key) { showToast('Paste your Fathom API key first.', 'warning'); return; }
  showOverlay('Saving Fathom API key…');
  ApiService.setFathomApiKey(key).then(function (res) {
    hideOverlay();
    if (res && res.ok) {
      if (input) input.value = '';
      showToast('Fathom API key saved.', 'success');
      renderSettings();
    } else {
      showToast((res && res.message) || 'Could not save the key.', 'error');
    }
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Error saving key: ' + (err.message || err), 'error');
  });
}

function loadDivisionalDashboardLinks() {
  const body = getEl('divisionalDashboardLinksBody');
  if (!body) return;
  ApiService.getDivisionalDashboardLinks().then(function (rows) {
    renderDivisionalDashboardRows(rows || []);
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    body.innerHTML = '<div class="form-status error">Could not load dashboard links.</div>';
  });
}

function renderDivisionalDashboardRows(rows) {
  const body = getEl('divisionalDashboardLinksBody');
  if (!body) return;
  if (!rows.length) { body.innerHTML = '<div class="form-status">No DO/RMS users found.</div>'; return; }
  const actionsHead = appState.isAdmin ? '<th>Actions</th>' : '';
  body.innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>Designation / username</th><th>Office</th><th>Dashboard</th>' + actionsHead + '</tr></thead><tbody>' + rows.map(function (r) {
    const dashHref = linkableHref(r.url || '');
    const link = dashHref ? '<a href="' + escAttr(dashHref) + '" target="_blank" rel="noopener noreferrer">Open dashboard</a>' : '<span class="form-status">Not provided</span>';
    const actions = appState.isAdmin
      ? '<button class="btn btn-secondary btn-small" type="button" onclick="openAdminEditDivisionalDashboard(this)" data-email="' + escAttr(r.email) + '" data-username="' + escAttr(r.username || '') + '" data-url="' + escAttr(r.url || '') + '">Edit</button>'
      : '';
    return '<tr><td><strong>' + escapeHtml(r.designation || r.username || '—') + '</strong></td><td>' + escapeHtml(r.office || r.department || '—') + '</td><td>' + link + '</td>' + (appState.isAdmin ? '<td>' + actions + '</td>' : '') + '</tr>';
  }).join('') + '</tbody></table></div>';
}

let adminEditDivisionalDashboardEmail = '';

function openAdminEditDivisionalDashboard(btn) {
  const modal = getEl('adminEditDivisionalDashboardModal');
  if (!modal) return;
  const email = (btn && btn.dataset && btn.dataset.email) || '';
  const username = (btn && btn.dataset && btn.dataset.username) || '';
  const currentUrl = (btn && btn.dataset && btn.dataset.url) || '';
  adminEditDivisionalDashboardEmail = email;
  const userEl = getEl('adminEditDivisionalDashboardUser');
  if (userEl) userEl.textContent = (username || email) + ' (' + email + ')';
  const urlEl = getEl('adminEditDivisionalDashboardUrl');
  if (urlEl) urlEl.value = String(currentUrl || '');
  const statusEl = getEl('adminEditDivisionalDashboardStatus');
  if (statusEl) { statusEl.textContent = ''; statusEl.className = 'form-status'; }
  const removeBtn = getEl('adminEditDivisionalDashboardRemove');
  if (removeBtn) removeBtn.style.display = String(currentUrl || '').trim() ? '' : 'none';
  openDialog('adminEditDivisionalDashboardModal');
}

function closeAdminEditDivisionalDashboard() {
  closeDialog('adminEditDivisionalDashboardModal');
}

function saveAdminEditDivisionalDashboard() {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  const urlEl = getEl('adminEditDivisionalDashboardUrl');
  const statusEl = getEl('adminEditDivisionalDashboardStatus');
  const url = urlEl ? String(urlEl.value || '').trim() : '';
  if (!url) {
    if (statusEl) { statusEl.textContent = 'Enter a URL, or use Remove link to clear it.'; statusEl.className = 'form-status error'; }
    return;
  }
  if (!/^https?:\/\//i.test(url)) {
    if (statusEl) { statusEl.textContent = 'Enter a valid http:// or https:// URL.'; statusEl.className = 'form-status error'; }
    return;
  }
  if (statusEl) { statusEl.textContent = 'Saving…'; statusEl.className = 'form-status'; }
  ApiService.adminSetDivisionalDashboard(adminEditDivisionalDashboardEmail, url).then(function (res) {
    if (res && res.success) {
      closeAdminEditDivisionalDashboard();
      renderDivisionalDashboardRows((res && res.rows) || []);
      showToast('Dashboard link updated.', 'success');
    } else {
      if (statusEl) { statusEl.textContent = (res && res.message) || 'Could not update the link.'; statusEl.className = 'form-status error'; }
    }
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    if (statusEl) { statusEl.textContent = 'Update failed: ' + (err.message || err); statusEl.className = 'form-status error'; }
  });
}

function removeAdminEditDivisionalDashboard() {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  showConfirm({
    title: 'Remove dashboard link',
    message: 'Remove the dashboard link for ' + adminEditDivisionalDashboardEmail + '?',
    okLabel: 'Remove',
    danger: true
  }).then(function (ok) {
    if (!ok) return;
    ApiService.adminSetDivisionalDashboard(adminEditDivisionalDashboardEmail, '').then(function (res) {
      closeAdminEditDivisionalDashboard();
      renderDivisionalDashboardRows((res && res.rows) || []);
      showToast('Dashboard link removed.', 'success');
    }).catch(function (err) {
      if (handleServerFailure(err)) return;
      showToast('Remove failed: ' + (err.message || err), 'error');
    });
  });
}

function loadUsers() {
  ApiService.adminGetUsers().then(function (users) {
    renderUsersTable(users || []);
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not load users: ' + (err.message || err), 'error');
  });
}

/* Pull the latest records + hyperlinks from the origin Google Sheet. The
   pull is previewed first — the admin reviews exactly what would change and
   confirms before anything is applied. Dashboard-added records and links are
   always preserved (the pull never prunes app-created rows, and links are
   merged, not replaced). */
let syncPreviewData = null;

function downloadFullBackup() {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  const status = getEl('backupStatus');
  if (status) { status.textContent = 'Building backup…'; status.className = 'form-status'; }
  showOverlay('Building backup…');
  ApiService.exportFullBackup().then(function (data) {
    hideOverlay();
    if (!data || data.success !== true) {
      const msg = (data && data.message) || 'Could not build the backup.';
      if (status) { status.textContent = msg; status.className = 'form-status error'; }
      showToast(msg, 'error');
      return;
    }
    let bin;
    try { bin = atob(data.base64); } catch (err) {
      if (status) { status.textContent = 'Could not decode the backup file.'; status.className = 'form-status error'; }
      return;
    }
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: data.mimeType || 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.name || 'india-post-dashboard-backup.db';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    if (status) { status.textContent = 'Downloaded ' + (data.name || '') + ' (' + formatFileSize(data.size) + ').';
      status.className = 'form-status'; }
    showToast('Full backup downloaded.', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    const msg = err && err.message ? err.message : String(err);
    if (status) { status.textContent = msg; status.className = 'form-status error'; }
    showToast('Backup failed: ' + msg, 'error');
  });
}

function syncFromSheet() {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  const btn = getEl('syncSheetBtn');
  const status = getEl('syncSheetStatus');
  if (!btn || !status) return;
  btn.disabled = true;
  status.textContent = 'Fetching sheet preview…';
  status.className = 'form-status';
  ApiService.adminPreviewSyncFromSheet().then(function (preview) {
    btn.disabled = false;
    if (!preview) {
      status.textContent = 'Preview failed: no data returned.';
      status.className = 'form-status error';
      return;
    }
    const added = (preview.added || []).length;
    const updated = (preview.updated || []).length;
    const removed = (preview.removed || []).length;
    if (!preview.pending) {
      status.textContent = 'Sheet is already in sync — no changes to apply.';
      status.className = 'form-status success';
      showToast('Sheet is up to date', 'success');
      return;
    }
    syncPreviewData = preview;
    renderSyncPreview(preview);
    openDialog('syncPreviewModal');
    status.textContent = 'Review the preview above, then apply or cancel.';
    status.className = 'form-status';
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    btn.disabled = false;
    status.textContent = 'Preview failed: ' + (err.message || err);
    status.className = 'form-status error';
  });
}

// Renders the preview payload into the sync preview modal.
function renderSyncPreview(preview) {
  const summary = getEl('syncPreviewSummary');
  const list = getEl('syncPreviewList');
  const added = (preview.added || []).length;
  const updated = (preview.updated || []).length;
  const removed = (preview.removed || []).length;
  const linksRead = preview.linksRead != null ? preview.linksRead : '—';
  summary.textContent = 'Pull would affect ' + preview.pending + ' record(s) from the sheet: ' +
    added + ' new, ' + updated + ' updated, ' + removed + ' removed. (' + linksRead + ' hyperlink(s) read.)';
  const parts = [];
  (preview.added || []).forEach(function (r) {
    parts.push('<div class="sync-preview-item"><strong class="sync-preview-tag sync-preview-add">NEW</strong> ' +
      escRec(r) + '</div>');
  });
  (preview.updated || []).forEach(function (r) {
    const changes = (r.changes || []).join(', ') || 'content';
    parts.push('<div class="sync-preview-item"><strong class="sync-preview-tag sync-preview-upd">UPDATE</strong> ' +
      escRec(r) + ' <span class="muted">(' + escapeHtml(changes) + ')</span></div>');
  });
  (preview.removed || []).forEach(function (r) {
    parts.push('<div class="sync-preview-item"><strong class="sync-preview-tag sync-preview-rem">REMOVE</strong> ' +
      escRec(r) + '</div>');
  });
  list.innerHTML = parts.length ? parts.join('') : '<p class="muted">No changes detected.</p>';
}

function escRec(r) {
  const label = escapeHtml(String(r.description || r.sector || ('Record ' + r.displayId)));
  const idTag = r.displayId != null ? ' <span class="muted">#' + escapeHtml(String(r.displayId)) + '</span>' : '';
  return label + idTag;
}

function applySyncPreview() {
  const applyBtn = getEl('syncPreviewApplyBtn');
  const status = getEl('syncPreviewStatus');
  if (!applyBtn) return;
  applyBtn.disabled = true;
  if (status) { status.textContent = 'Applying…'; status.className = 'form-status'; }
  ApiService.adminSyncFromSheet().then(function (data) {
    closeDialog('syncPreviewModal');
    syncPreviewData = null;
    const pull = (data && data.pull) || {};
    const push = (data && data.push) || {};
    const lines = [];
    if (pull.pulled) {
      lines.push('Pull: ' + pull.sheetRows + ' rows from sheet (' + pull.inserted + ' inserted, ' + pull.updated + ' updated' +
        (pull.pruned ? ', ' + pull.pruned + ' pruned' : '') + ').');
      if (pull.linksRead) lines.push('Hyperlinks read from sheet: ' + pull.linksRead + '.');
      else lines.push('Hyperlinks: ' + pull.linksSource + '.');
    } else {
      lines.push('Pull failed: ' + ((pull && pull.reason) || 'unknown error'));
    }
    if (push.pushed) {
      lines.push('Push: ' + push.rows + ' records written back to sheet' + (push.linkedCells ? ' (' + push.linkedCells + ' linked cells).' : '.'));
    } else {
      lines.push('Push: ' + (push.reason || 'not configured') + '.');
    }
    const statusEl = getEl('syncSheetStatus');
    if (statusEl) {
      statusEl.textContent = lines.join(' ');
      statusEl.className = 'form-status ' + (pull.pulled && (push.ok || !push.pushed) ? 'success' : 'error');
    }
    showToast('Sync complete', 'success');
    refreshData();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    applyBtn.disabled = false;
    if (status) { status.textContent = 'Apply failed: ' + (err.message || err); status.className = 'form-status error'; }
  });
}

function cancelSyncPreview() {
  closeDialog('syncPreviewModal');
  syncPreviewData = null;
  const status = getEl('syncSheetStatus');
  if (status) { status.textContent = 'Sync cancelled — no changes applied.'; status.className = 'form-status'; }
}

/** Push: send all DB records back to the Google Spreadsheet. */
function pushAllToSheet() {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  if (!confirm('This will overwrite the Google Spreadsheet with the current database records. Continue?')) return;
  const btn = getEl('pushSheetBtn');
  const status = getEl('syncSheetStatus');
  if (btn) btn.disabled = true;
  if (status) { status.textContent = 'Pushing records to spreadsheet…'; status.className = 'form-status'; }
  showOverlay('Pushing to spreadsheet…');
  ApiService.adminPushToSheet().then(function (result) {
    hideOverlay();
    if (btn) btn.disabled = false;
    if (!result || result.pushed === false) {
      const msg = (result && result.reason) || 'Push failed';
      if (status) { status.textContent = msg; status.className = 'form-status error'; }
      showToast(msg, 'error');
      return;
    }
    const msg = 'Pushed ' + (result.rows || 0) + ' records to the spreadsheet' + (result.linkedCells ? ' (' + result.linkedCells + ' linked cells).' : '.');
    if (status) { status.textContent = msg; status.className = 'form-status success'; }
    showToast(msg, 'success');
  }).catch(function (err) {
    hideOverlay();
    if (btn) btn.disabled = false;
    if (handleServerFailure(err)) return;
    const msg = 'Push failed: ' + (err.message || err);
    if (status) { status.textContent = msg; status.className = 'form-status error'; }
    showToast(msg, 'error');
  });
}

// Shows the periodic auto-sync configuration + last run in the Settings card.
function loadAutoSyncStatus() {
  const el = getEl('autoSyncStatus');
  if (!el) return;
  ApiService.getSyncStatus().then(function (data) {
    const mins = data && data.intervalMinutes;
    const enabled = !!(data && data.enabled);
    const parts = [];
    parts.push(enabled ? 'Auto-sync every ' + mins + ' min' : 'Auto-sync disabled');
    const last = data && data.lastRun;
    if (last && last.at) {
      if (last.error) {
        parts.push('last run ' + formatTimestamp(last.at) + ' failed: ' + last.error);
      } else {
        const pull = last.pull || {};
        const push = last.push || {};
        parts.push('last run ' + formatTimestamp(last.at) + ': pulled ' + (pull.sheetRows != null ? pull.sheetRows + ' rows' : '—') +
          (push && push.pushed ? ', pushed ' + push.rows + ' back' : ''));
      }
    } else {
      parts.push('no run yet');
    }
    el.textContent = parts.join(' — ');
  }).catch(function () {
    el.textContent = 'Auto-sync status unavailable';
  });
}

function renderUsersTable(users) {
  const tbody = getEl('usersTable').querySelector('tbody');
  tbody.dataset.users = JSON.stringify(users);
  tbody.innerHTML = users.length ? users.map(function (u, i) {
    const username = escapeHtml(u.username || '');
    const office = escapeHtml(u.office || '');
    const resetPending = !!(u.resetRequested && String(u.resetRequested).trim());
    const resetBadge = resetPending
      ? ' <span class="badge" data-tone="warning" title="Requested at ' + escapeHtml(formatTimestamp(u.resetRequested)) + '">Reset request received</span>'
      : '';
    return `
      <tr${resetPending ? ' class="row-reset-requested"' : ''}>
        <td class="preserve-whitespace">${escapeHtml(u.email)}${u.mustChange ? ' <em>(must change)</em>' : ''}${resetBadge}</td>
        <td class="preserve-whitespace">${username || '<span class="badge" data-tone="muted">—</span>'}</td>
        <td>${escapeHtml(u.role)}</td>
        <td class="preserve-whitespace">${office || '<span class="badge" data-tone="muted">—</span>'}</td>
        <td class="preserve-whitespace">${escapeHtml(formatTimestamp(u.createdAt))}</td>
        <td><button class="btn btn-secondary btn-small" type="button" data-action="reset" data-index="${i}">Reset password</button></td>
        <td><button class="btn btn-secondary btn-small" type="button" data-action="edit" data-index="${i}">Edit</button></td>
        <td><button class="btn btn-danger btn-small" type="button" data-action="delete" data-index="${i}">Delete</button></td>
      </tr>`;
  }).join('') : '<tr><td colspan="8">No users found.</td></tr>';
}

function loadUserActivity() {
  ApiService.adminGetUserActivity().then(function (activity) {
    renderUserActivity(activity || {});
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not load user activity: ' + (err.message || err), 'error');
  });
}

function renderUserActivity(activity) {
  const totals = activity.totals || {};
  const statsEl = getEl('activityStats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="activity-stat"><span class="activity-stat-value">${totals.events || 0}</span><span class="activity-stat-label">Events (tracked)</span></div>
      <div class="activity-stat"><span class="activity-stat-value">${totals.logins || 0}</span><span class="activity-stat-label">Logins</span></div>
      <div class="activity-stat"><span class="activity-stat-value">${totals.activeUsers || 0}</span><span class="activity-stat-label">Active users</span></div>`;
  }
  const tbody = getEl('activityTableBody');
  if (tbody) {
    tbody.innerHTML = (activity.users || []).map(function (u) {
      return `
        <tr>
          <td class="preserve-whitespace">${escapeHtml(u.email)}</td>
          <td>${u.actions || 0}</td>
          <td>${u.logins || 0}</td>
          <td class="preserve-whitespace">${escapeHtml(u.lastSeenMs > 0 ? formatTimestamp(u.lastSeenMs) : (u.lastSeen || ''))}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="4">No activity recorded yet.</td></tr>';
  }
  const recent = getEl('activityRecentList');
  if (recent) {
    recent.innerHTML = (activity.recent || []).map(function (row) {
      return `
        <li class="activity-recent-item">
          <span class="badge" data-tone="muted">${escapeHtml(row.action)}</span>
          <span class="preserve-whitespace">${escapeHtml(row.user)}</span>
          <span class="preserve-whitespace activity-recent-time">${escapeHtml(formatTimestamp(row.timestampMs != null ? row.timestampMs : row.timestamp))}</span>
        </li>`;
    }).join('') || '<li class="activity-recent-item">No recent activity.</li>';
  }
}

function exportUsers() {
  if (!appState.isAdmin) { showToast('Admin access required', 'error'); return; }
  showOverlay('Preparing CSV…');
  ApiService.adminExportUsers().then(function (csv) {
    hideOverlay();
    downloadTextFile('IndiaPostDashboard_Users_' + new Date().toISOString().slice(0, 10) + '.csv', csv || '', 'text/csv;charset=utf-8');
    showToast('Users CSV downloaded', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Export failed: ' + (err.message || err), 'error');
  });
}

function importUsersFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const csv = String(e.target.result || '');
    if (!csv.trim()) { showToast('The file is empty', 'error'); return; }
    showOverlay('Importing users…');
    ApiService.adminImportUsers(csv).then(function (result) {
      hideOverlay();
      renderUsersTable((result && result.users) || []);
      const errors = (result && result.errors) || [];
      const summary = 'Imported: ' + (result.added || 0) + ' added, ' + (result.updated || 0) + ' updated' + (errors.length ? ', ' + errors.length + ' errors' : '');
      showToast(summary, errors.length ? 'warning' : 'success');
      if (errors.length) {
        console.warn('User import errors', errors);
      }
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Import failed: ' + (err.message || err), 'error');
    });
  };
  reader.readAsText(file);
}

function triggerUserImport() {
  const input = getEl('userImportFile');
  if (input) input.click();
}

function openEditUser(email) {
  const usersTable = getEl('usersTable');
  const tbody = usersTable ? usersTable.querySelector('tbody') : null;
  const users = JSON.parse((tbody && tbody.dataset.users) || '[]');
  const u = users.find(function (x) { return String(x.email).toLowerCase() === String(email).toLowerCase(); });
  if (!u) return;
  editUserOriginalEmail = String(email);
  getEl('editUserEmail').value = u.email;
  getEl('editUserUsername').value = u.username || '';
  getEl('editUserRole').value = u.role || 'VIEWER';
  getEl('editUserOffice').value = u.office || '';
  openDialog('editUserModal');
}

function closeEditUser() {
  closeDialog('editUserModal');
}

function isValidEmailList(value) {
  const list = String(value || '').split(',').map(function (e) { return e.trim(); }).filter(function (e) { return e; });
  if (!list.length) return false;
  return list.every(function (e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); });
}

function saveEditUser() {
  const emailEl = getEl('editUserEmail');
  const email = emailEl.value.trim();
  const fields = {
    email: email,
    username: getEl('editUserUsername').value.trim(),
    role: getEl('editUserRole').value,
    office: getEl('editUserOffice').value.trim()
  };
  if (!setFieldInvalid(emailEl, isValidEmailList(email) ? '' : 'Enter a valid email address.')) return;
  showOverlay('Saving user…');
  ApiService.adminUpdateUser(editUserOriginalEmail, fields).then(function (res) {
    hideOverlay();
    closeEditUser();
    const result = res || {};
    renderUsersTable(result.users || []);
    showToast(result.message || 'User updated', 'success');
    if (result.reAuth) {
      try { window.sessionStorage.setItem(STORAGE_REAUTH_MSG, 'Your email was changed. Please log in with your new email.'); } catch (err) {}
      window.location.reload();
    }
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Update failed: ' + (err.message || err), 'error');
  });
}

function handleAddUser(e) {
  e.preventDefault();
  if (!appState.isAdmin) { showToast('Admin access required', 'error'); return; }
  const emailEl = getEl('newUserEmail');
  const usernameEl = getEl('newUserUsername');
  const roleEl = getEl('newUserRole');
  const passwordEl = getEl('newUserPassword');
  const groupEl = getEl('newUserGroup');
  const departmentEl = getEl('newUserDepartment');
  const officeEl = getEl('newUserOffice');
  const email = emailEl.value.trim();
  const username = (usernameEl && usernameEl.value.trim()) || '';
  const role = roleEl.value;
  const password = passwordEl.value;
  const group = (groupEl && groupEl.value) || '';
  const department = (departmentEl && departmentEl.value) || '';
  const office = (officeEl && officeEl.value) || '';

  let valid = true;
  valid = setFieldInvalid(emailEl, isValidEmailList(email) ? '' : 'Enter a valid email address.') && valid;
  valid = setFieldInvalid(passwordEl, password.length >= 8 ? '' : 'Password must be at least 8 characters.') && valid;
  if (!valid) return;

  showOverlay('Adding user…');
  ApiService.adminAddUser(email, username, role, password, group, department, office).then(function (users) {
    hideOverlay();
    emailEl.value = '';
    if (usernameEl) usernameEl.value = '';
    passwordEl.value = '';
    if (groupEl) groupEl.value = '';
    if (departmentEl) departmentEl.value = '';
    if (officeEl) officeEl.value = '';
    const status = getEl('addUserStatus');
    status.textContent = 'User added';
    status.classList.add('success');
    setTimeout(function () {
      status.textContent = '';
      status.classList.remove('success');
    }, 3000);
    renderUsersTable(users || []);
    showToast('User added', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    const status = getEl('addUserStatus');
    status.textContent = err.message || 'Could not add user';
    status.classList.add('error');
  });
}

function handleChangePassword(e) {
  e.preventDefault();
  const currentEl = getEl('changeCurrentPassword');
  const newEl = getEl('changeNewPassword');
  const confirmEl = getEl('changeConfirmPassword');
  const current = currentEl.value;
  const np = newEl.value;
  const cp = confirmEl.value;

  let valid = true;
  valid = setFieldInvalid(currentEl, current ? '' : 'Enter your current password.') && valid;
  valid = setFieldInvalid(newEl, np.length >= 8 ? '' : 'Password must be at least 8 characters.') && valid;
  if (np !== cp) {
    setFieldInvalid(confirmEl, 'Passwords do not match.');
    valid = false;
  } else {
    setFieldInvalid(confirmEl, '');
  }
  if (!valid) return;

  showOverlay('Updating password…');
  ApiService.changePassword(current, np).then(function (res) {
    hideOverlay();
    const status = getEl('changePasswordStatus');
    if (res && res.success) {
      currentEl.value = '';
      newEl.value = '';
      confirmEl.value = '';
      appState.mustChange = false;
      getEl('mustChangeBanner').classList.add('hidden');
      status.textContent = (res && res.message) || 'Password updated';
      status.classList.add('success');
      showToast('Password updated', 'success');
      EventBus.emit('SettingsUpdated');
    } else {
      status.textContent = (res && res.message) || 'Could not update password';
      status.classList.add('error');
    }
    setTimeout(function () {
      status.textContent = '';
      status.classList.remove('success');
      status.classList.remove('error');
    }, 3500);
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    const status = getEl('changePasswordStatus');
    status.textContent = err.message || 'Could not update password';
    status.classList.add('error');
  });
}

function deleteUser(email) {
  showConfirm({
    title: 'Delete user',
    message: 'Delete user ' + email + '? They will no longer be able to sign in.',
    okLabel: 'Delete',
    danger: true
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Deleting user…');
    ApiService.adminDeleteUser(email).then(function (users) {
      hideOverlay();
      renderUsersTable(users || []);
      showToast('User deleted', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Delete failed: ' + (err.message || err), 'error');
    });
  });
}

function resetUserPassword(email) {
  const newPassword = prompt('New password for ' + email + ' (min 8 characters):');
  if (!newPassword) return;
  showOverlay('Resetting password…');
  ApiService.adminResetPassword(email, newPassword).then(function (users) {
    hideOverlay();
    renderUsersTable(users || []);
    showToast('Password reset for ' + email, 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Reset failed: ' + (err.message || err), 'error');
  });
}

/* ---------------------------------- CSV Import (drag-and-drop) ---------------------------------- */
/* Admin/editor can drag a CSV file onto the drop zone (or click to browse).
   The file is parsed, sent to the server, and records are imported. */

function wireCsvImportDropZone() {
  var dropZone = getEl('csvImportDropZone');
  if (!dropZone) return; // not on this page

  dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) handleCsvFileImport(files[0]);
  });

  // Click to browse
  dropZone.addEventListener('click', function (e) {
    if (e.target.tagName === 'INPUT') return; // don't double-trigger
    var fileInput = getEl('csvImportFileInput');
    if (fileInput) fileInput.click();
  });
}

function handleCsvFileImport(file) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  if (!file) return;
  if (!file.name.match(/\.csv$/i)) {
    showToast('Please select a .csv file.', 'error');
    return;
  }
  var status = getEl('csvImportStatus');
  if (status) { status.textContent = 'Reading file…'; status.className = 'form-status'; }
  var reader = new FileReader();
  reader.onload = function (e) {
    var csvText = e.target.result;
    if (!csvText || !csvText.trim()) {
      if (status) { status.textContent = 'File is empty.'; status.className = 'form-status error'; }
      return;
    }
    if (status) { status.textContent = 'Importing records…'; status.className = 'form-status'; }
    showOverlay('Importing CSV…');
    ApiService.adminImportCsv(csvText).then(function (result) {
      hideOverlay();
      if (!result || !result.success) {
        var msg = (result && result.message) || 'Import failed.';
        if (status) { status.textContent = msg; status.className = 'form-status error'; }
        showToast(msg, 'error');
        return;
      }
      var lines = [result.added + ' record(s) imported successfully.'];
      if (result.errors && result.errors.length) {
        lines.push(result.errors.length + ' error(s): ' + result.errors.slice(0, 3).join('; '));
      }
      var msg = lines.join(' ');
      if (status) { status.textContent = msg; status.className = 'form-status success'; }
      showToast(msg, result.errors && result.errors.length ? 'warning' : 'success');
      refreshData();
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      var msg = 'Import failed: ' + (err.message || err);
      if (status) { status.textContent = msg; status.className = 'form-status error'; }
      showToast(msg, 'error');
    });
  };
  reader.readAsText(file);
}

function handleCsvFileInputChange(e) {
  var file = e.target && e.target.files && e.target.files[0];
  if (file) handleCsvFileImport(file);
  // Reset the input so the same file can be re-selected
  e.target.value = '';
}

/* ---------------------------------- Record detail drawer ---------------------------------- */
/* Read-only drill-down for any record: shows every display field, review
   status, submissions, links, documents, tasks, history, and AI insight in
   a single context. Actions: Edit, Create task, Add submission, Attach
   document, Mark review done, Ask AI. */

function detailRowHtml_(field) {
  const valueHtml = field.html
    ? `<div class="detail-value preserve-whitespace field-html">${field.html}</div>`
    : `<div class="detail-value preserve-whitespace">${escapeHtml(field.value)}</div>`;
  return `
      <div class="about-row detail-row">
        <span class="detail-label">${escapeHtml(field.label || 'Value')}</span>
        ${valueHtml}
      </div>`;
}

function detailLinksHtml_(item) {
  if (!item.linkUrls || !Object.keys(item.linkUrls).length) return '';
  var html = '<div class="detail-links-section"><span class="text-subheading">Links</span>';
  Object.keys(item.linkUrls).forEach(function (key) {
    var url = item.linkUrls[key];
    if (!url) return;
    var text = (item.linkTexts && item.linkTexts[key]) || key;
    const href = linkableHref(url);
    html += '<div class="about-row detail-row">' +
      '<span class="detail-label">' + escapeHtml(text) + '</span>' +
      '<div class="detail-value">' + (href
        ? '<a href="' + escAttr(href) + '" target="_blank" rel="noopener" data-embed>' + escapeHtml(url) + '</a>'
        : escapeHtml(url)) + '</div></div>';
  });
  html += '</div>';
  return html;
}

function openRecordDetail(row) {
  const item = appState.items.find(function (i) { return String(i.row) === String(row); });
  if (!item) return;
  const groups = groupCardFields_(item.displayFields);
  const fieldsHtml = (groups.top.length
    ? `<div class="detail-fields-row detail-fields-row-top">${groups.top.map(detailRowHtml_).join('')}</div>`
    : '') + (groups.action.length
    ? groups.action.map(detailRowHtml_).join('')
    : '') + (groups.bottom.length
    ? `<div class="detail-fields-row detail-fields-row-bottom">${groups.bottom.map(detailRowHtml_).join('')}</div>`
    : '');

  const linksHtml = detailLinksHtml_(item);
  const subCount = (appState.submissionCounts || {})[item.row] || 0;
  const statusBadge = item.reviewStatus === 'due'
    ? '<span class="review-badge review-due">Review due</span>'
    : item.reviewStatus === 'done'
      ? '<span class="review-badge review-done">Review done</span>'
      : '<span class="badge" data-tone="muted">Not reviewed</span>';

  const detailUpdatesHtml = rowUpdatesHtml_(item.row);
  const detailUpdatesCount = (appState.displayedSubmissions || [])
    .filter(function (s) { return Number(s.cardRow) === Number(item.row); })
    .length;
  const detailUpdatesHidden = isRowUpdatesHidden_(item.row);
  const detailUpdatesSection = detailUpdatesHtml
    ? `<div class="detail-updates"><span class="text-subheading">Updates</span><div class="card-updates${detailUpdatesHidden ? ' updates-hidden' : ''}" data-updates-row="${escAttr(item.row)}">${detailUpdatesHtml}</div></div>`
    : '';

  getEl('recordDetailTitle').textContent = 'Record #' + (item.id || item.row);
  getEl('recordDetailBody').innerHTML = `
    <div class="detail-status">${statusBadge}<span class="form-status">${subCount} submission${subCount === 1 ? '' : 's'}</span></div>
    <div class="about-rows">${fieldsHtml}</div>
    ${linksHtml}
    ${detailUpdatesSection}`;

  /* ---- actions ---- */
  let actionsHtml = '';
  if (!appState.isEditor) {
    actionsHtml += `<button class="btn btn-secondary" type="button" onclick="closeRecordDetail(); openSubmissionsModal('${escAttr(item.row)}','${escAttr(item.id)}');">Submit update</button>`;
  }
  if (appState.isEditor) {
    actionsHtml += `<button class="btn btn-primary" type="button" onclick="closeRecordDetail(); editItem('${escAttr(item.row)}');">Edit</button>`;
  }
  if (appState.isEditor && subCount > 0) {
    actionsHtml += detailUpdatesCount > 0
      ? `<button class="btn btn-secondary" data-updates-toggle="${escAttr(item.row)}" type="button" onclick="toggleCardUpdates('${escAttr(item.row)}', this)">${detailUpdatesHidden ? 'Show updates' : 'Hide updates'}</button>`
      : `<button class="btn btn-secondary" type="button" onclick="closeRecordDetail(); openSubmissionsModal('${escAttr(item.row)}','${escAttr(item.id)}');">View updates (${subCount})</button>`;
  }
  if (appState.isEditor) {
    actionsHtml += `<button class="btn btn-secondary" type="button" onclick="closeRecordDetail(); openTaskModal(${escAttr(item.row)});">Create task</button>`;
    actionsHtml += `<label class="btn btn-secondary" style="cursor:pointer">Attach document<input type="file" style="display:none" onchange="handleDocUpload(${escAttr(item.row)}, this)"></label>`;
  }
  if (appState.isAdmin) {
    if (item.reviewStatus === 'due') {
      actionsHtml += `<button class="btn btn-secondary" type="button" onclick="detailMarkReviewDone_(${escAttr(item.row)})">Mark done</button>`;
    } else if (item.reviewStatus === 'done') {
      actionsHtml += `<button class="btn btn-secondary" type="button" onclick="detailMarkReviewNotDone_(${escAttr(item.row)})">Mark not done</button>`;
    }
  }
  if (appState.isEditor) {
    actionsHtml += `<button class="btn btn-secondary" type="button" onclick="detailAskAi_(${escAttr(item.row)})">Ask AI</button>`;
  }
  actionsHtml += `<button class="btn btn-ghost" type="button" onclick="closeRecordDetail()">Close</button>`;
  getEl('recordDetailActions').innerHTML = actionsHtml;

  loadRecordDocuments(item.row);
  loadDetailTasks_(item.row);
  loadDetailHistory_(item.row);

  openDialog('recordDetailModal');
}

/* ---- Tasks section ---- */
function loadDetailTasks_(row) {
  const el = getEl('recordDetailTasks');
  if (!el) return;
  el.innerHTML = '';
  ApiService.getTasks({ recordRow: Number(row) }).then(function (tasks) {
    const list = tasks || [];
    if (!list.length) return;
    const listHtml = list.map(function (t) {
      const statusClass = t.status === 'DONE' ? 'badge-success' : t.status === 'IN_PROGRESS' ? 'badge-primary' : 'badge-warning';
      const assignee = t.assignee || '';
      const due = t.dueDate ? ' · Due ' + formatDate(t.dueDate) : '';
      return '<div class="detail-task-row">' +
        '<span class="detail-task-title">' + escapeHtml(t.title || 'Untitled') + '</span>' +
        '<span class="badge ' + statusClass + '">' + escapeHtml(t.status) + '</span>' +
        (assignee ? '<span class="detail-task-assignee">' + escapeHtml(assignee) + '</span>' : '') +
        (due ? '<span class="detail-task-due">' + due + '</span>' : '') +
        '</div>';
    }).join('');
    el.innerHTML = '<div class="detail-section-block"><span class="text-subheading">Tasks</span>' + listHtml + '</div>';
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

/* ---- History section ---- */
function loadDetailHistory_(row) {
  const el = getEl('recordDetailHistory');
  if (!el) return;
  el.innerHTML = '';
  ApiService.getRecordHistory(row).then(function (entries) {
    if (!entries || !entries.length) return;
    const listHtml = entries.map(function (e) {
      const diff = e.diff || {};
      const fields = Object.keys(diff);
      const desc = fields.length
        ? fields.map(function (f) { return '<em>' + escapeHtml(f) + '</em>' + (diff[f] && diff[f].new !== undefined ? ' → ' + escapeHtml(String(diff[f].new)) : ''); }).join(', ')
        : 'metadata update';
      const when = e.changedAt ? formatTimestamp(e.changedAt) : '';
      return '<div class="detail-history-row">' +
        '<span class="detail-history-when">' + escapeHtml(when) + '</span>' +
        '<span class="detail-history-who">' + escapeHtml(e.changedBy || 'system') + '</span>' +
        '<span class="detail-history-what">' + desc + '</span></div>';
    }).join('');
    el.innerHTML = '<div class="detail-section-block"><span class="text-subheading">History</span>' + listHtml + '</div>';
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

/* ---- AI insight in drawer ---- */
function detailAskAi_(row) {
  const body = getEl('recordDetailBody');
  if (!body) return;
  let panel = body.querySelector('.card-ai-insight');
  if (panel) {
    panel.classList.toggle('card-ai-collapsed');
    return;
  }
  panel = document.createElement('div');
  panel.className = 'card-ai-panel card-ai-insight';
  panel.innerHTML = cardAiPanelHtml_();
  body.appendChild(panel);
  loadCardAi(panel, row);
}

/* ---- Mark review done / not done (from drawer) ---- */
function detailMarkReviewDone_(row) {
  showConfirm({ title: 'Mark review done', message: 'Confirm mark this record\'s review as done?', okLabel: 'Done' }).then(function (confirmed) {
    if (!confirmed) return;
    showOverlay('Marking review done…');
    ApiService.markReviewDone(row).then(function () {
      hideOverlay();
      showToast('Review marked done.', 'success');
      const item = appState.items.find(function (i) { return String(i.row) === String(row); });
      if (item) item.reviewStatus = 'done';
      renderDashboard(true);
      openRecordDetail(row);
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not mark review done: ' + (err.message || err), 'error');
    });
  });
}

function detailMarkReviewNotDone_(row) {
  showConfirm({ title: 'Mark review not done', message: 'Revert this record\'s review to not done?', okLabel: 'Revert', danger: true }).then(function (confirmed) {
    if (!confirmed) return;
    showOverlay('Reverting review…');
    ApiService.markReviewNotDone(row).then(function () {
      hideOverlay();
      showToast('Review reverted.', 'success');
      const item = appState.items.find(function (i) { return String(i.row) === String(row); });
      if (item) item.reviewStatus = 'due';
      renderDashboard(true);
      openRecordDetail(row);
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not revert review: ' + (err.message || err), 'error');
    });
  });
}

/* ---- Documents (preserved from original) ---- */

function loadRecordDocuments(row) {
  const docsEl = getEl('recordDetailDocs');
  if (!docsEl) return;
  ApiService.getRecordDocuments(row).then(function (docs) {
    const docsList = docs || [];
    docsEl.innerHTML = docsList.length ? `
      <div class="detail-docs-head">
        <span class="text-subheading">Documents</span>
        <label class="btn btn-ghost btn-small" style="cursor:pointer;">
          <input type="file" id="docUploadInput" style="display:none" onchange="handleDocUpload(${escAttr(row)}, this)">
          Upload
        </label>
      </div>
      <ul class="detail-docs-list">${docsList.map(function (d) {
        return '<li class="detail-doc-item">' +
          '<button class="btn btn-ghost btn-small" type="button" onclick="openDriveDocPreview(\'' + escAttr(d.driveFileId) + '\', \'' + escAttr(d.fileName) + '\')">Preview</button>' +
          '<a href="' + escapeHtml(d.url || '#') + '" target="_blank" rel="noopener">' + escapeHtml(d.fileName) + '</a>' +
          (d.keep
            ? '<button class="btn btn-small btn-keep" type="button" title="Kept: exempt from the 30-day retention cleanup. Click to un-keep." onclick="toggleDocKeep(\'' + escAttr(d.id) + '\', 0, ' + escAttr(row) + ')">Kept ✓</button>'
            : '<button class="btn btn-ghost btn-small" type="button" title="Keep this document so the 30-day retention cleanup never deletes it." onclick="toggleDocKeep(\'' + escAttr(d.id) + '\', 1, ' + escAttr(row) + ')">Keep</button>') +
          '<button class="btn btn-ghost btn-small" type="button" onclick="deleteRecordDoc(\'' + escAttr(d.id) + '\', \'' + escAttr(row) + '\')">Remove</button>' +
          '</li>';
      }).join('')}</ul>` : '';
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
  });
}

function handleDocUpload(row, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const item = appState.items.find(function (i) { return String(i.row) === String(row); });
  const recordId = (item && item.recordId) || '';
  const reader = new FileReader();
  reader.onload = function (e) {
    const bytes = e.target.result;
    const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(bytes)));
    showOverlay('Uploading document…');
    ApiService.uploadDocument(row, recordId, file.name, base64, file.type || 'application/octet-stream').then(function () {
      hideOverlay();
      showToast('Document uploaded.', 'success');
      loadRecordDocuments(row);
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Upload failed: ' + (err.message || err), 'error');
    });
  };
  reader.readAsArrayBuffer(file);
}

function toggleDocKeep(docId, keep, row) {
  ApiService.setDocumentKeep(docId, keep).then(function (res) {
    showToast(keep ? 'Document kept — exempt from retention cleanup.' : 'Document un-kept — retention applies again.', 'success');
    loadRecordDocuments(row);
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not update document: ' + (err.message || err), 'error');
  });
}

function deleteRecordDoc(docId, row) {
  showConfirm({
    title: 'Delete document',
    body: 'Remove this document permanently?',
    confirmLabel: 'Delete',
    onConfirm: function () {
      showOverlay('Deleting document…');
      ApiService.deleteDocument(docId).then(function () {
        hideOverlay();
        showToast('Document removed.', 'success');
        loadRecordDocuments(row);
      }).catch(function (err) {
        hideOverlay();
        if (handleServerFailure(err)) return;
        showToast('Could not delete document.', 'error');
      });
    }
  });
}

function closeRecordDetail() {
  closeDialog('recordDetailModal');
}

/* ---------------------------------- Tasks ---------------------------------- */

function renderTasks() {
  const statusFilter = getEl('taskStatusFilter');
  const priorityFilter = getEl('taskPriorityFilter');
  const mineToggle = getEl('taskMineToggle');
  const filters = {};
  if (statusFilter && statusFilter.value) filters.status = statusFilter.value;
  if (priorityFilter && priorityFilter.value) filters.priority = priorityFilter.value;

  showOverlay('Loading tasks…');
  ApiService.getTasks(filters).then(function (tasks) {
    hideOverlay();
    appState.tasks = tasks || [];

    const mineOnly = mineToggle && mineToggle.checked;
    if (mineOnly && appState.user) {
      const me = appState.user.email;
      appState.tasks = (appState.tasks || []).filter(function (t) {
        return String(t.assignee || '').indexOf(me) !== -1 || String(t.createdBy || '').indexOf(me) !== -1;
      });
    }

    renderTaskList();
    if (appState.taskView === 'board') renderKanbanBoard_();
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
        const isOverdue = t.status !== 'DONE' && t.status !== 'CANCELLED' && t.dueDate && new Date(t.dueDate).getTime() < Date.now();
        const overdueFlag = isOverdue ? ' <span class="badge badge-danger" data-overdue title="This task is past its due date">Overdue</span>' : '';
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
      
      // Display a friendly label for the assignee (may be comma-separated).
      var assigneeDisplay = (t.assignee || '').split(',').map(function (a) {
        a = a.trim();
        if (a === 'group:all-divisional-heads') return 'All Divisional Heads';
        return a;
      }).filter(Boolean).join(', ');

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

/* ---------------------------------- Kanban board ---------------------------------- */

var KANBAN_COLUMNS = [
  { status: 'OPEN', label: 'Open' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'DONE', label: 'Done' },
  { status: 'CANCELLED', label: 'Cancelled' }
];

var KANBAN_LABELS = { OPEN: 'Open', IN_PROGRESS: 'In progress', DONE: 'Done', CANCELLED: 'Cancelled' };

function setTaskView(view) {
  appState.taskView = view;
  const listBtn = getEl('taskViewListBtn');
  const boardBtn = getEl('taskViewBoardBtn');
  const listView = getEl('taskListView');
  const empty = getEl('tasksEmpty');
  const board = getEl('kanbanBoard');
  if (listBtn) listBtn.setAttribute('aria-pressed', String(view === 'list'));
  if (boardBtn) boardBtn.setAttribute('aria-pressed', String(view === 'board'));
  if (listView) listView.classList.toggle('hidden', view !== 'list');
  if (empty) empty.classList.toggle('hidden', view !== 'list');
  if (board) board.classList.toggle('hidden', view !== 'board');
  if (view === 'board') {
    // The board shows every status as a column; drop the list's status filter
    // so columns populate fully.
    const statusFilter = getEl('taskStatusFilter');
    if (statusFilter) statusFilter.value = '';
    if (!appState.tasks || !appState.tasks.length) {
      renderTasks();
    } else {
      renderKanbanBoard_();
    }
  } else {
    renderTasks();
  }
}

function renderKanbanBoard_() {
  const board = getEl('kanbanBoard');
  if (!board) return;
  const tasks = appState.tasks || [];
  const user = appState.user;
  const isAdminOrEditor = user && (user.role === 'ADMIN' || user.role === 'EDITOR');

  board.innerHTML = KANBAN_COLUMNS.map(function (col) {
    const colTasks = tasks.filter(function (t) { return String(t.status || 'OPEN') === col.status; });
    const cards = colTasks.map(function (t) { return kanbanCardHtml_(t, isAdminOrEditor); }).join('');
    return '<section class="kanban-column" data-status="' + col.status + '" aria-label="' + col.label + ' tasks">' +
      '<header class="kanban-col-head"><span class="kanban-col-title">' + col.label + '</span>' +
      '<span class="kanban-col-count">' + colTasks.length + '</span></header>' +
      '<div class="kanban-col-body">' +
      (cards || '<div class="kanban-empty">No tasks</div>') +
      '</div>' +
      '</section>';
  }).join('');
}

function kanbanCardHtml_(t, isAdminOrEditor) {
  const id = escAttr(t.id);
  const status = String(t.status || 'OPEN');
  const isOverdue = status !== 'DONE' && status !== 'CANCELLED' && t.dueDate && new Date(t.dueDate).getTime() < Date.now();
  const overdueFlag = isOverdue ? ' <span class="badge badge-danger" data-overdue title="This task is past its due date">Overdue</span>' : '';
  const priorityClass = t.priority === 'URGENT' ? 'badge-danger' : t.priority === 'HIGH' ? 'badge-warning' : t.priority === 'MEDIUM' ? 'badge-info' : 'badge-muted';
  const assigneeDisplay = (t.assignee || '').split(',').map(function (a) {
    a = a.trim();
    if (a === 'group:all-divisional-heads') return 'All Divisional Heads';
    return a;
  }).filter(Boolean).join(', ');
  const options = KANBAN_COLUMNS.map(function (col) {
    const selected = col.status === status ? ' selected' : '';
    return '<option value="' + col.status + '"' + selected + '>' + col.label + '</option>';
  }).join('');
  const quickComplete = (status !== 'DONE' && status !== 'CANCELLED')
    ? '<button class="btn btn-ghost btn-small" type="button" onclick="kanbanMoveTask(\'' + id + '\',\'DONE\')">Complete</button>'
    : '';
  const editBtn = isAdminOrEditor
    ? '<button class="btn btn-ghost btn-small" type="button" onclick="editTask(\'' + id + '\')">Edit</button>'
    : '';
  return '<article class="kanban-card" draggable="true" data-task-id="' + id + '" data-status="' + status + '">' +
    '<div class="kanban-card-title">' + escapeHtml(t.title || '') + '</div>' +
    '<div class="kanban-card-meta">' + escapeHtml(assigneeDisplay || 'Unassigned') + '</div>' +
    '<div class="kanban-card-sub">' +
    '<span class="badge ' + priorityClass + '">' + escapeHtml(t.priority || '') + '</span>' +
    '<span class="kanban-card-due">' + (t.dueDate ? escapeHtml(formatDate(t.dueDate)) : '') + '</span>' + overdueFlag +
    '</div>' +
    '<div class="kanban-card-actions">' +
    quickComplete +
    editBtn +
    '<label class="kanban-move-label">Move' +
    '<select class="kanban-move" data-move-task="' + id + '" aria-label="Move to status">' + options + '</select>' +
    '</label>' +
    '</div>' +
    '</article>';
}

function kanbanMoveTask(id, newStatus) {
  const task = (appState.tasks || []).find(function (t) { return t.id === id; });
  if (!task || task.status === newStatus) { renderKanbanBoard_(); return; }
  ApiService.updateTask(id, { status: newStatus }).then(function () {
    task.status = newStatus;
    if (newStatus === 'DONE') task.completedAt = Date.now();
    if (appState.taskView === 'board') renderKanbanBoard_();
    showToast('Task moved to ' + (KANBAN_LABELS[newStatus] || newStatus) + '.', 'success');
    refreshCounts();
  }).catch(function (err) {
    renderKanbanBoard_();
    if (handleServerFailure(err)) return;
    showToast('Could not move task: ' + (err.message || err), 'error');
  });
}

function wireKanbanBoard() {
  document.addEventListener('change', function (e) {
    const sel = e.target && e.target.closest ? e.target.closest('select[data-move-task]') : null;
    if (!sel) return;
    kanbanMoveTask(sel.getAttribute('data-move-task'), sel.value);
  });
  document.addEventListener('dragstart', function (e) {
    const card = e.target && e.target.closest ? e.target.closest('.kanban-card[data-task-id]') : null;
    if (!card) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.getAttribute('data-task-id'));
    card.classList.add('kanban-dragging');
  });
  document.addEventListener('dragend', function (e) {
    const card = e.target && e.target.closest ? e.target.closest('.kanban-card') : null;
    if (card) card.classList.remove('kanban-dragging');
  });
  document.addEventListener('dragover', function (e) {
    if (!e.dataTransfer || !e.dataTransfer.types || e.dataTransfer.types.indexOf('text/plain') === -1) return;
    const col = e.target && e.target.closest ? e.target.closest('.kanban-column[data-status]') : null;
    if (!col) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    col.classList.add('kanban-over');
  });
  document.addEventListener('dragleave', function (e) {
    const col = e.target && e.target.closest ? e.target.closest('.kanban-column') : null;
    if (col) col.classList.remove('kanban-over');
  });
  document.addEventListener('drop', function (e) {
    const col = e.target && e.target.closest ? e.target.closest('.kanban-column[data-status]') : null;
    if (!col) return;
    e.preventDefault();
    col.classList.remove('kanban-over');
    const id = e.dataTransfer && e.dataTransfer.getData('text/plain');
    if (id) kanbanMoveTask(id, col.getAttribute('data-status'));
  });
}

wireKanbanBoard();

function populateTaskAssigneeDropdown() {
  const hiddenInput = getEl('taskAssignee');
  if (!hiddenInput) return;
  
  const users = appState.allUsers || [];
  const options = users.map(function (u) {
    var displayLabel = u.email === 'group:all-divisional-heads'
      ? 'All Divisional Heads'
      : u.email + (u.username ? ' (' + u.username + ')' : '');
    return { value: u.email, label: displayLabel };
  });
  populateMultiSelectOptions('taskAssigneeMs', options);
}

function openTaskModal(recordRow) {
  // Reset editing state if opening fresh
  if (!appState.editingTaskId) {
    getEl('taskModalTitle').textContent = 'New task';
    closeTaskModal(); // Clear all fields
  }
  if (recordRow !== undefined && recordRow !== null && recordRow !== '') {
    getEl('taskRecordRow').value = String(recordRow);
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
  clearMultiSelect('taskAssigneeMs');
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
  
  const taskRow = getEl('taskRecordRow').value ? Number(getEl('taskRecordRow').value) : 0;
  const linkedItem = appState.items.find(function (i) { return Number(i.row) === Number(taskRow); });
  const params = {
    title: title,
    description: getEl('taskDescription').value.trim(),
    assignee: assignee,
    priority: getEl('taskPriority').value,
    dueDate: dmyToIso(getEl('taskDueDate').value),
    recordRow: taskRow,
    recordId: (linkedItem && linkedItem.recordId) || ''
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
    getEl('taskAssignee').value = task.assignee || '';
    populateTaskAssigneeDropdown();
  } else {
    // Load users if not already loaded
    ApiService.getAssignableUsers().then(function (users) {
      appState.allUsers = users;
      getEl('taskAssignee').value = task.assignee || '';
      populateTaskAssigneeDropdown();
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

/* ---------------------------------- Date picker ---------------------------------- */

var DP_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var DP_WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

var datePickerState = {
  open: false,
  input: null,
  month: new Date().getMonth(),
  year: new Date().getFullYear()
};

function parseDateFieldValue(str) {
  if (!str) return null;
  str = String(str).trim();
  let m = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }
  m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }
  return null;
}

function formatDmy(date) {
  return String(date.getDate()).padStart(2, '0') + '.' +
    String(date.getMonth() + 1).padStart(2, '0') + '.' +
    date.getFullYear();
}

function dmyToIso(str) {
  const d = parseDateFieldValue(str);
  if (!d || isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function ensureDatePickerPopup() {
  if (getEl('datePickerPopup')) return;
  const div = document.createElement('div');
  div.id = 'datePickerPopup';
  div.className = 'datepicker-popup hidden';
  div.innerHTML =
    '<div class="dp-head">' +
    '<button type="button" class="dp-nav" data-dp="prev" aria-label="Previous month">&#8249;</button>' +
    '<div class="dp-title"></div>' +
    '<button type="button" class="dp-nav" data-dp="next" aria-label="Next month">&#8250;</button>' +
    '</div>' +
    '<div class="dp-weekdays">' + DP_WEEKDAYS.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
    '<div class="dp-grid"></div>' +
    '<div class="dp-foot">' +
    '<button type="button" class="dp-btn dp-today" data-dp="today">Today</button>' +
    '<button type="button" class="dp-btn dp-clear" data-dp="clear">Clear</button>' +
    '</div>';
  div.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-dp]');
    if (!btn) return;
    const act = btn.getAttribute('data-dp');
    if (act === 'prev') {
      datePickerState.month--;
      if (datePickerState.month < 0) { datePickerState.month = 11; datePickerState.year--; }
      renderDatePicker();
    } else if (act === 'next') {
      datePickerState.month++;
      if (datePickerState.month > 11) { datePickerState.month = 0; datePickerState.year++; }
      renderDatePicker();
    } else if (act === 'today') {
      const now = new Date();
      datePickerState.month = now.getMonth();
      datePickerState.year = now.getFullYear();
      renderDatePicker();
      if (datePickerState.input) {
        datePickerState.input.value = formatDmy(now);
        datePickerState.input.dispatchEvent(new Event('change', { bubbles: true }));
        closeDatePicker();
      }
    } else if (act === 'clear') {
      if (datePickerState.input) {
        datePickerState.input.value = '';
        datePickerState.input.dispatchEvent(new Event('change', { bubbles: true }));
        closeDatePicker();
      }
    }
  });
  div.addEventListener('click', function (e) {
    const dayBtn = e.target.closest('[data-dp-day]');
    if (!dayBtn) return;
    const d = new Date(datePickerState.year, datePickerState.month, Number(dayBtn.getAttribute('data-dp-day')));
    if (datePickerState.input) {
      datePickerState.input.value = formatDmy(d);
      datePickerState.input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closeDatePicker();
  });
  document.body.appendChild(div);
}

function renderDatePicker() {
  const popup = getEl('datePickerPopup');
  if (!popup) return;
  popup.querySelector('.dp-title').textContent = DP_MONTHS[datePickerState.month] + ' ' + datePickerState.year;
  const grid = popup.querySelector('.dp-grid');
  grid.innerHTML = '';
  const first = new Date(datePickerState.year, datePickerState.month, 1);
  const startCol = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(datePickerState.year, datePickerState.month + 1, 0).getDate();
  const today = new Date();
  const todayStr = formatDmy(today);
  const parsedSel = datePickerState.input ? parseDateFieldValue(datePickerState.input.value) : null;
  const selStr = parsedSel ? formatDmy(parsedSel) : '';
  for (let i = 0; i < startCol; i++) {
    const blank = document.createElement('span');
    blank.className = 'dp-cell dp-blank';
    grid.appendChild(blank);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'dp-cell';
    cell.setAttribute('data-dp-day', String(d));
    cell.textContent = String(d);
    const dstr = formatDmy(new Date(datePickerState.year, datePickerState.month, d));
    if (dstr === todayStr) cell.classList.add('dp-today');
    if (dstr === selStr) cell.classList.add('dp-selected');
    grid.appendChild(cell);
  }
}

function openDatePicker(input) {
  ensureDatePickerPopup();
  const popup = getEl('datePickerPopup');
  const field = input.closest('.date-field') || input.parentElement;
  const parsed = parseDateFieldValue(input.value);
  if (parsed) {
    datePickerState.month = parsed.getMonth();
    datePickerState.year = parsed.getFullYear();
  } else {
    const now = new Date();
    datePickerState.month = now.getMonth();
    datePickerState.year = now.getFullYear();
  }
  datePickerState.input = input;
  popup.classList.remove('hidden');
  field.appendChild(popup);
  popup.style.top = 'calc(100% + 4px)';
  popup.style.bottom = 'auto';
  const card = input.closest('.modal-card');
  const inputRect = input.getBoundingClientRect();
  const popupH = popup.offsetHeight;
  const cardRect = card ? card.getBoundingClientRect() : null;
  if (cardRect && (inputRect.bottom + popupH + 8 > cardRect.bottom)) {
    popup.style.top = 'auto';
    popup.style.bottom = 'calc(100% + 4px)';
  }
  renderDatePicker();
  datePickerState.open = true;
}

function closeDatePicker() {
  const popup = getEl('datePickerPopup');
  if (popup) popup.classList.add('hidden');
  datePickerState.open = false;
  datePickerState.input = null;
}

function initDatePicker() {
  document.addEventListener('click', function (e) {
    const field = e.target.closest('input[data-datepicker]');
    if (field) {
      e.preventDefault();
      openDatePicker(field);
      return;
    }
    const popup = getEl('datePickerPopup');
    if (popup && !popup.classList.contains('hidden') && !popup.contains(e.target)) {
      closeDatePicker();
    }
  });
}

/* ---------------------------------- Live clock ---------------------------------- */

var clockOffsetMs = 0;

function startLiveClock() {
  renderClock(new Date());
  setInterval(function () { renderClock(new Date(Date.now() + clockOffsetMs)); }, 1000);
  ApiService.getServerTime().then(function (ts) {
    const serverNow = Number(ts);
    if (serverNow > 0) clockOffsetMs = serverNow - Date.now();
  }).catch(function () {});
}

function renderClock(d) {
  const el = getEl('liveClock');
  if (!el) return;
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  el.textContent = h + ':' + mm + ':' + ss + ' ' + ampm;
}

/* ---------------------------------- Auto refresh ---------------------------------- */
/* Periodically re-fetches dashboard data in the background (silently) so edits
   made directly in the spreadsheet appear without a manual refresh. Skips when
   the tab is hidden, a modal is open, or a request is already in flight. */

var autoRefreshTimerId = null;
var autoRefreshInFlight = false;
var autoRefreshPending = false;

function startAutoRefresh(intervalMs) {
  stopAutoRefresh();
  autoRefreshTimerId = setInterval(function () { autoRefreshTick(); }, intervalMs || 60000);
}

function stopAutoRefresh() {
  if (autoRefreshTimerId) { clearInterval(autoRefreshTimerId); autoRefreshTimerId = null; }
}

// A dataChanged event arriving while a modal is open or the tab is hidden is
// deferred instead of dropped, so edits are reflected as soon as the UI can
// safely repaint (modal closed / tab visible) rather than on the next tick.
function flushPendingAutoRefresh() {
  if (!autoRefreshPending) return;
  autoRefreshPending = false;
  if (autoRefreshInFlight) return;
  autoRefreshTick();
}

// True while any modal is on screen. Checks the body.modal-open scroll lock
// first, then falls back to any visible .modal-backdrop so modals opened
// without openDialog() (legacy path: openSubmissionsModal) are respected too.
function hasOpenModal_() {
  if (typeof document === 'undefined') return false;
  if (document.body.classList.contains('modal-open')) return true;
  return Array.prototype.some.call(document.querySelectorAll('.modal-backdrop'), function (b) {
    return !b.classList.contains('hidden');
  });
}

function autoRefreshTick() {
  if (autoRefreshInFlight) return;
  if (!appState.user || !appState.user.loggedIn) return;
  if (typeof document !== 'undefined' && document.hidden) { autoRefreshPending = true; return; }
  if (hasOpenModal_()) { autoRefreshPending = true; return; }
  autoRefreshInFlight = true;
  const seqAtStart = appState.submissionSeq || 0;
  ApiService.getAppData().then(function (data) {
    autoRefreshInFlight = false;
    if (!data || !data.user || !data.user.loggedIn) {
      return;
    }
    // A modal may have opened while this request was in flight. Repainting
    // the dashboard then would clobber it, so defer the render here too;
    // closeDialog()/visibilitychange flush the pending refresh later.
    if (hasOpenModal_()) { autoRefreshPending = true; return; }
    if ((appState.submissionSeq || 0) !== seqAtStart) {
      // A submission changed while this request was in flight — the payload is
      // stale for submission fields and would revert the card's badge/updates.
      // Discard it and retry shortly so the fresh state wins.
      if (!appState.refreshRetryScheduled) {
        appState.refreshRetryScheduled = true;
        setTimeout(function () {
          appState.refreshRetryScheduled = false;
          autoRefreshTick();
        }, 2000);
      }
      return;
    }
    applyAppData(data);
    populateFilters();
    populateResponsibilitySelect();
    renderDashboard(true);
    refreshCounts();
    generateReviewNotifications();
    EventBus.emit('DataRefreshed');
  }).catch(function (err) {
    autoRefreshInFlight = false;
    if (handleServerFailure(err)) return;
  });
}

// Flush any deferred refresh when the tab becomes visible again.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) flushPendingAutoRefresh();
  });
}

/* ---------------------------------- Multi-Select Chips ---------------------------------- */

/* Initialize multi-select component with event delegation.
   Called once per container at page load — all handlers survive innerHTML
   rebuilds because they listen on stable parent elements. */
var msInstances = {};

function initMultiSelect(containerId, hiddenInputId, placeholder) {
  var container = document.getElementById(containerId);
  var hiddenInput = document.getElementById(hiddenInputId);
  if (!container || !hiddenInput) return null;

  var triggerBtn = container.querySelector('.ms-trigger');
  var chipsContainer = container.querySelector('.ms-chips');
  var dropdown = container.querySelector('.ms-dropdown');

  function getValues() {
    var raw = hiddenInput.value || '';
    return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function renderChips() {
    var vals = getValues();
    // Build labels from current DOM options
    var labels = {};
    container.querySelectorAll('.ms-option').forEach(function (it) {
      labels[it.getAttribute('data-value')] = it.textContent.trim();
    });
    chipsContainer.innerHTML = vals.map(function (v) {
      return '<span class="ms-chip" data-value="' + escAttr(v) + '">' + escapeHtml(labels[v] || v) + '<button type="button" class="ms-chip-remove" aria-label="Remove ' + escAttr(labels[v] || v) + '" data-remove="' + escAttr(v) + '">&times;</button></span>';
    }).join('');
    triggerBtn.textContent = vals.length ? vals.length + ' selected' : (placeholder || 'Select...');
    container.querySelectorAll('.ms-option').forEach(function (it) {
      var on = vals.indexOf(it.getAttribute('data-value')) !== -1;
      it.classList.toggle('ms-selected', on);
      it.setAttribute('aria-selected', String(on));
    });
  }

  function setValues(vals) {
    hiddenInput.value = vals.join(', ');
    renderChips();
  }

  function toggleValue(val) {
    var vals = getValues();
    var idx = vals.indexOf(val);
    if (idx === -1) { vals.push(val); } else { vals.splice(idx, 1); }
    setValues(vals);
  }

  // Trigger button — open/close dropdown
  triggerBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    document.querySelectorAll('.ms-dropdown.open').forEach(function (d) {
      if (d !== dropdown) d.classList.remove('open');
    });
    var open = dropdown.classList.toggle('open');
    triggerBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      var first = dropdown.querySelector('.ms-option');
      if (first) first.focus();
    }
  });

  // Keyboard support for the option list (listbox semantics)
  dropdown.addEventListener('keydown', function (e) {
    var opts = Array.prototype.slice.call(dropdown.querySelectorAll('.ms-option'));
    var idx = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (opts.length) opts[Math.min(idx + 1, opts.length - 1)].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (opts.length) opts[Math.max(idx - 1, 0)].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (idx !== -1) toggleValue(opts[idx].getAttribute('data-value'));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dropdown.classList.remove('open');
      triggerBtn.setAttribute('aria-expanded', 'false');
      triggerBtn.focus();
    }
  });

  // Chip removal — event delegation on stable parent
  chipsContainer.addEventListener('click', function (e) {
    var rm = e.target.closest('.ms-chip-remove');
    if (rm) {
      e.stopPropagation();
      toggleValue(rm.getAttribute('data-remove'));
    }
  });

  // Option clicks — event delegation on stable dropdown parent
  dropdown.addEventListener('click', function (e) {
    var opt = e.target.closest('.ms-option');
    if (!opt) return;
    e.stopPropagation();
    toggleValue(opt.getAttribute('data-value'));
  });

  renderChips();
  var inst = { getValues: getValues, setValues: setValues, renderChips: renderChips };
  msInstances[containerId] = inst;
  return inst;
}

/* Populate options into a multi-select dropdown. Options are rebuilt from
   scratch each time (caller provides the full list). Existing selected
   values in the hidden input are preserved. */
function populateMultiSelectOptions(containerId, options) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var dropdown = container.querySelector('.ms-dropdown');
  if (!dropdown) return;
  dropdown.innerHTML = options.map(function (opt) {
    return '<div class="ms-option" role="option" tabindex="0" aria-selected="false" data-value="' + escAttr(opt.value) + '">' + escapeHtml(opt.label) + '</div>';
  }).join('');
  // Re-render chips so labels match the new options
  var inst = msInstances[containerId];
  if (inst) inst.renderChips();
}

function setMultiSelectValues(containerId, csv) {
  var inst = msInstances[containerId];
  if (inst) {
    inst.setValues((csv || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean));
  } else {
    var el = document.getElementById(containerId.replace('Ms', ''));
    if (el) el.value = csv || '';
  }
}

function getMultiSelectValues(containerId) {
  var inst = msInstances[containerId];
  return inst ? inst.getValues() : [];
}

function clearMultiSelect(containerId) {
  var inst = msInstances[containerId];
  if (inst) inst.setValues([]);
}

function closeAllMultiSelects() {
  document.querySelectorAll('.ms-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
}

document.addEventListener('click', function () { closeAllMultiSelects(); });

/* ---------------------------------- Dashboard Studio ---------------------------------- */

function loadDashboardPreferences() {
  return ApiService.getDashboardPreferences().then(function (prefs) {
    appState.dashboardPrefs = prefs || { viewMode: 'cards', columns: {}, layout: {} };
    applyDashboardPreferences();
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    appState.dashboardPrefs = { viewMode: 'cards', columns: {}, layout: {} };
  });
}

function applyDashboardPreferences() {
  const prefs = appState.dashboardPrefs || {};
  // Restore persisted sort + review-status filter before rendering so the
  // first paint honours them.
  if (prefs.sortKey) appState.dashSortKey = prefs.sortKey;
  if (prefs.sortDir === 'asc' || prefs.sortDir === 'desc') appState.dashSortDir = prefs.sortDir;
  // Legacy 'pending' (old "not done / not due" value) maps to 'notdue'.
  appState.dashReviewFilter = prefs.reviewFilter === 'pending' ? 'notdue' : (prefs.reviewFilter || '');
  syncDashSortFilterControls();
  toggleDashboardView(prefs.viewMode === 'table' ? 'table' : 'cards');
}

/* Reflect the current sort/review-filter state in the dropdowns + chips. */
function syncDashSortFilterControls() {
  const sortSelect = getEl('dashSortSelect');
  if (sortSelect) {
    const optionValue = appState.dashSortKey === 'id' ? 'default' : appState.dashSortKey;
    if (sortSelect.querySelector('option[value="' + optionValue + '"]')) {
      sortSelect.value = optionValue;
    }
  }
  const reviewFilter = getEl('dashReviewFilter');
  if (reviewFilter) reviewFilter.value = appState.dashReviewFilter;
  updateFilterChips();
}

/* Debounced silent save of the dashboard prefs (sort, review filter, view
   mode, columns) so sort/filter choices survive reloads without a modal. */
var dashPrefsSaveTimer = null;

function scheduleDashboardPrefsSave() {
  if (dashPrefsSaveTimer) clearTimeout(dashPrefsSaveTimer);
  dashPrefsSaveTimer = setTimeout(function () {
    dashPrefsSaveTimer = null;
    persistDashboardPrefs();
  }, 800);
}

function persistDashboardPrefs() {
  const current = appState.dashboardPrefs || {};
  const prefs = {
    viewMode: current.viewMode || 'cards',
    columns: current.columns || {},
    layout: current.layout || {},
    sortKey: appState.dashSortKey,
    sortDir: appState.dashSortDir,
    reviewFilter: appState.dashReviewFilter
  };
  ApiService.saveDashboardPreferences(prefs).then(function () {
    appState.dashboardPrefs = prefs;
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    // Non-critical persistence failure; the next change will retry.
  });
}

function saveDashboardPreferences() {
  const columns = {};
  document.querySelectorAll('.col-toggle').forEach(function (cb) {
    columns[cb.dataset.col] = cb.checked;
  });
  const modeRadio = document.querySelector('input[name="viewMode"]:checked');
  const viewMode = modeRadio ? modeRadio.value : 'cards';
  const prefs = {
    viewMode: viewMode,
    columns: columns,
    layout: (appState.dashboardPrefs && appState.dashboardPrefs.layout) || {},
    sortKey: appState.dashSortKey,
    sortDir: appState.dashSortDir,
    reviewFilter: appState.dashReviewFilter
  };
  showOverlay('Saving preferences…');
  ApiService.saveDashboardPreferences(prefs).then(function () {
    hideOverlay();
    showToast('Dashboard preferences saved.', 'success');
    appState.dashboardPrefs = prefs;
    applyDashboardPreferences();
    closeColumnDialog();
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not save preferences.', 'error');
  });
}

function toggleColumnVisibility(colKey) {
  const cb = document.querySelector('.col-toggle[data-col="' + colKey + '"]');
  if (cb) {
    cb.checked = !cb.checked;
    renderDashboard();
  }
}

function openColumnDialog() {
  const prefs = appState.dashboardPrefs || {};
  const columns = prefs.columns || {};
  document.querySelectorAll('.col-toggle').forEach(function (cb) {
    cb.checked = columns[cb.dataset.col] !== false;
  });
  const modeRadio = document.querySelector('input[name="viewMode"][value="' + (prefs.viewMode || 'cards') + '"]');
  if (modeRadio) modeRadio.checked = true;
  openDialog('columnModal');
}

function closeColumnDialog() {
  closeDialog('columnModal');
}

/* ---------------------------------- Command Palette ---------------------------------- */

function fuzzyMatch_(query, text) {
  var q = String(query || '').toLowerCase().trim();
  var t = String(text || '').toLowerCase();
  if (!q) return true;
  if (t.indexOf(q) !== -1) return true;
  var qi = 0;
  for (var i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function commandScore_(query, item) {
  var q = String(query || '').toLowerCase().trim();
  if (!q) return 0;
  var label = String(item.label || '').toLowerCase();
  var subtitle = String(item.subtitle || '').toLowerCase();
  var score = 0;
  if (label === q) score += 1000;
  if (label.indexOf(q) === 0) score += 700;
  else if (label.indexOf(q) !== -1) score += 500;
  if (subtitle.indexOf(q) !== -1) score += 120;
  if (fuzzyMatch_(q, label)) score += 80;
  return score;
}


const COMMAND_ACTIONS = [
  { key: 'goto-myday', label: 'Open My Day', subtitle: 'Today’s priorities and workload', shortcut: 'G D', action: function () { openTab('myday'); closeCommandPalette(); } },
  { key: 'focus-next', label: 'Focus next priority', subtitle: 'Open the most urgent item', shortcut: '', action: function () { closeCommandPalette(); openMyDayFocus(); } },
  { key: 'start-presentation', label: 'Start Presentation Mode', subtitle: 'Project the dashboard one card at a time', shortcut: 'P', action: function () { closeCommandPalette(); enterPresentationMode(); } },
  { key: 'goto-dashboard', label: 'Go to Dashboard', subtitle: 'Records and dashboard cards', shortcut: '', action: function () { openTab('dashboard'); closeCommandPalette(); } },
  { key: 'goto-tasks', label: 'Go to Tasks', subtitle: 'Tasks and due dates', shortcut: '', action: function () { openTab('tasks'); closeCommandPalette(); } },
  { key: 'goto-reports', label: 'Go to Reports', subtitle: 'Reports and exports', shortcut: '', action: function () { openTab('reports'); closeCommandPalette(); } },
  { key: 'goto-audit', label: 'Go to Audit log', subtitle: 'Activity and audit history', shortcut: '', perm: 'audit', action: function () { openTab('audit'); closeCommandPalette(); } },
  { key: 'goto-settings', label: 'Go to Settings', subtitle: 'Application and account settings', shortcut: '', action: function () { openTab('settings'); closeCommandPalette(); } },
  { key: 'refresh', label: 'Refresh data', subtitle: 'Reload dashboard data', shortcut: 'R', action: function () { refreshData(); closeCommandPalette(); } },
  { key: 'add-record', label: 'Add new record', subtitle: 'Create a dashboard record', shortcut: 'N', action: function () { openAddModal(); closeCommandPalette(); }, requireEditor: true },
  { key: 'create-task', label: 'Create task', subtitle: 'Add a task to your workload', shortcut: '', action: function () { openTaskModal(); closeCommandPalette(); }, requireEditor: true },
  { key: 'toggle-theme', label: 'Toggle dark mode', subtitle: 'Switch appearance', shortcut: 'T', action: function () { toggleDarkMode(); closeCommandPalette(); } },
  { key: 'export-records', label: 'Export records to spreadsheet', subtitle: 'Download dashboard records', shortcut: '', action: function () { exportToSpreadsheet(); closeCommandPalette(); } },
  { key: 'export-pdf', label: 'Create PDF report', subtitle: 'Generate a report PDF', shortcut: '', action: function () { createPdfReport(); closeCommandPalette(); } },
  { key: 'email-report', label: 'Send report via email', subtitle: 'Open the report email workflow', shortcut: '', action: function () { openEmailReportDialog(); closeCommandPalette(); } },
  { key: 'generate-review-notifications', label: 'Generate review notifications', subtitle: 'Create due-review notifications', shortcut: '', action: function () { closeCommandPalette(); ApiService.generateReviewNotifications().then(function () { showToast('Review notifications generated.', 'success'); }).catch(function () { showToast('Could not generate.', 'error'); }); } },
  { key: 'mark-all-submissions-read', label: 'Mark all submissions read', subtitle: 'Clear unread submission indicators', shortcut: '', action: function () { markAllSubmissionsRead(); closeCommandPalette(); } },
  { key: 'logout', label: 'Sign out', subtitle: 'End the current session', shortcut: '', action: function () { handleLogout(); closeCommandPalette(); } }
];

var CMD_RESULTS = [];
var CMD_SELECTED_IDX = 0;
var RECENT_KEY = 'ipd_cmd_recent_v1';
var CMD_SEARCH_DEBOUNCE = null;
var CMD_SEARCHING = false;
var CMD_SEARCH_GEN = 0;

function getRecentItems() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; }
}

function saveRecentItems(items) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 10))); } catch (e) {}
}

function addRecentItem(item) {
  var recent = getRecentItems().filter(function (r) { return r.key !== item.key; });
  recent.unshift(item);
  saveRecentItems(recent);
}

function openCommandPalette(initialQuery) {
  openDialog('commandPalette');
  const input = getEl('commandInput');
  CMD_RESULTS = [];
  CMD_SELECTED_IDX = 0;
  CMD_SEARCH_GEN++;
  if (CMD_SEARCH_DEBOUNCE) clearTimeout(CMD_SEARCH_DEBOUNCE);
  CMD_SEARCHING = false;
  if (input) {
    input.value = String(initialQuery || '');
    input.focus();
    if (input.value) input.select();
    filterCommands(input.value);
  }
}

function closeCommandPalette() {
  CMD_SEARCH_GEN++;
  if (CMD_SEARCH_DEBOUNCE) clearTimeout(CMD_SEARCH_DEBOUNCE);
  CMD_SEARCHING = false;
  hideSearching();
  closeDialog('commandPalette');
}

function openMyDayFocus() {
  openTab('myday');
  setTimeout(function () {
    if (typeof renderMyDay === 'function') renderMyDay();
    setTimeout(function () {
      var focus = document.querySelector('.myday-focus-card button');
      if (focus) focus.focus();
    }, 180);
  }, 60);
}

function filterCommands(query) {
  const list = getEl('commandList');
  if (!list) return;
  const q = String(query || '').toLowerCase().trim();
  let actions = COMMAND_ACTIONS.slice();
  if (appState.isEditor === false) actions = actions.filter(function (a) { return !a.requireEditor; });
  actions = actions.filter(function (a) { return !a.perm || can(a.perm, 'view'); });
  if (q) {
    actions = actions.filter(function (a) { return fuzzyMatch_(q, a.label + ' ' + (a.subtitle || '')); });
    actions.sort(function (a, b) { return commandScore_(q, b) - commandScore_(q, a); });
  }
  let records = [];
  if (q.length >= 2) {
    records = (appState.items || []).filter(function (item) {
      return fuzzyMatch_(q, String(item.id)) || fuzzyMatch_(q, String(item.sector || '')) || fuzzyMatch_(q, String(item.description || ''));
    }).slice(0, 8).map(function (item) {
      return {
        key: 'record-' + item.row,
        label: 'Record #' + item.id + ' — ' + (item.sector || ''),
        subtitle: (item.description || '').slice(0, 60),
        category: 'Records',
        action: function () { openRecordDetail(item.row); closeCommandPalette(); addRecentItem({ key: 'record-' + item.row, label: 'Record #' + item.id, type: 'record' }); }
      };
    });
  }
  var recent = [];
  if (q.length >= 1) {
    recent = getRecentItems().filter(function (r) {
      return fuzzyMatch_(q, String(r.label));
    }).slice(0, 5).map(function (r) {
      return {
        key: r.key,
        label: r.label,
        subtitle: '',
        category: 'Recent',
        action: function () {
          if (r.type === 'record') {
            var row = r.key.replace('record-', '');
            openRecordDetail(row);
          }
          closeCommandPalette();
        }
      };
    });
  }
  CMD_RESULTS = [];
  var html = '';
  function addSection(title, items) {
    if (!items.length) return;
    html += '<div class="command-category">' + escapeHtml(title) + '</div>';
    items.forEach(function (item) {
      var idx = CMD_RESULTS.length;
      html += '<div class="command-item" data-cmd="' + escAttr(item.key) + '" data-idx="' + idx + '" role="option" aria-selected="' + (idx === 0 ? 'true' : 'false') + '" onclick="executeCommand(\'' + escAttr(item.key) + '\')">' +
        '<span class="command-copy"><strong>' + escapeHtml(item.label) + '</strong>' + (item.subtitle ? '<small>' + escapeHtml(item.subtitle) + '</small>' : '') + '</span>' +
        (item.shortcut ? '<kbd class="command-shortcut">' + escapeHtml(item.shortcut) + '</kbd>' : '') + '</div>';
      CMD_RESULTS.push({ key: item.key, action: item.action });
    });
  }
  addSection('Commands', actions);
  addSection('Recent', recent);
  addSection('Records', records);
      if (!html) html = '<div class="command-empty">No results</div>';
  list.innerHTML = html;
  CMD_SELECTED_IDX = 0;
  highlightSelected();
  if (q.length >= 3) paletteSearch(q);
}

function highlightSelected() {
  var items = document.querySelectorAll('#commandList .command-item');
  items.forEach(function (el, i) {
    var selected = i === CMD_SELECTED_IDX;
    el.classList.toggle('command-selected', selected);
    el.setAttribute('aria-selected', selected ? 'true' : 'false');
    if (selected) el.scrollIntoView({ block: 'nearest' });
  });
}

function executeCommand(key) {
  var found = CMD_RESULTS.find(function (r) { return r.key === key; });
  if (found) { found.action(); return; }
  var action = COMMAND_ACTIONS.find(function (a) { return a.key === key; });
  if (action && !action.requireEditor) action.action();
  else if (key.indexOf('record-') === 0) {
    var row = key.replace('record-', '');
    var item = (appState.items || []).find(function (i) { return String(i.row) === String(row); });
    if (item) openRecordDetail(item.row);
  }
}

/* Async cross-data search (tasks, users) */
function paletteSearch(query) {
  CMD_SEARCH_GEN++;
  var gen = CMD_SEARCH_GEN;
  if (CMD_SEARCH_DEBOUNCE) clearTimeout(CMD_SEARCH_DEBOUNCE);
  CMD_SEARCH_DEBOUNCE = setTimeout(function () {
    var q = String(query || '').toLowerCase().trim();
    if (q.length < 3) { hideSearching(); return; }
    CMD_SEARCHING = true;
    showSearching();
    var taskPromise = ApiService.getMyTasks().catch(function () { return []; });
    var userPromise = ApiService.getAssignableUsers().catch(function () { return []; });
    var submissionPromise = ApiService.getSubmissions().catch(function () { return []; });
    var documentPromise = ApiService.getDocuments().catch(function () { return []; });
    Promise.all([taskPromise, userPromise, submissionPromise, documentPromise]).then(function (results) {
      if (gen !== CMD_SEARCH_GEN) return;
      CMD_SEARCHING = false;
      var tasks = results[0];
      var users = results[1];
      var submissions = results[2];
      var documents = results[3];
      var taskResults = tasks.filter(function (t) {
        return fuzzyMatch_(q, String(t.title || '')) || fuzzyMatch_(q, String(t.description || ''));
      }).slice(0, 6).map(function (t) {
        return {
          key: 'task-' + (t.id || t.row || ''),
          label: String(t.title || '').slice(0, 80),
          subtitle: 'Task',
          category: 'Tasks',
          action: function () { openTaskModal(); closeCommandPalette(); }
        };
      });
      var userResults = users.filter(function (u) {
        return fuzzyMatch_(q, String(u.email || '')) || fuzzyMatch_(q, String(u.username || '')) || fuzzyMatch_(q, String(u.name || ''));
      }).slice(0, 6).map(function (u) {
        return {
          key: 'user-' + (u.email || u.username || ''),
          label: String(u.name || u.email || '').slice(0, 60) + ' <' + String(u.email || '').slice(0, 40) + '>',
          subtitle: 'User',
          category: 'Users',
          action: function () { closeCommandPalette(); showToast('User profile: ' + (u.email || u.username), 'info'); }
        };
      });
      var submissionResults = submissions.filter(function (s) {
        return fuzzyMatch_(q, String(s.text || '')) || fuzzyMatch_(q, String(s.cardRow || '')) || fuzzyMatch_(q, String(s.email || ''));
      }).slice(0, 6).map(function (s) {
        return {
          key: 'submission-' + (s.id || ''),
          label: 'Record #' + (s.cardRow || '') + ': ' + String(s.text || '').slice(0, 60),
          subtitle: 'Submission',
          category: 'Submissions',
          action: function () { openRecordDetail(Number(s.cardRow)); closeCommandPalette(); }
        };
      });
      var documentResults = documents.filter(function (d) {
        return fuzzyMatch_(q, String(d.fileName || '')) || fuzzyMatch_(q, String(d.recordId || '')) || fuzzyMatch_(q, String(d.recordRow || ''));
      }).slice(0, 6).map(function (d) {
        return {
          key: 'document-' + (d.id || ''),
          label: String(d.fileName || '').slice(0, 60),
          subtitle: 'Doc R#' + (d.recordRow || ''),
          category: 'Documents',
          action: function () { openRecordDetail(Number(d.recordRow)); closeCommandPalette(); }
        };
      });
      CMD_RESULTS = [];
      var html = '';
      if (taskResults.length) html += '<div class="command-category">Tasks</div>';
      taskResults.forEach(function (item) {
        var idx = CMD_RESULTS.length;
        html += '<div class="command-item" data-cmd="' + escAttr(item.key) + '" data-idx="' + idx + '" onclick="executeCommand(\'' + escAttr(item.key) + '\')">' +
          '<span>' + escapeHtml(item.label) + '</span>' +
          '<span class="command-meta">' + escapeHtml(item.subtitle || '') + '</span></div>';
        CMD_RESULTS.push({ key: item.key, action: item.action });
      });
      if (userResults.length) html += '<div class="command-category">Users</div>';
      userResults.forEach(function (item) {
        var idx = CMD_RESULTS.length;
        html += '<div class="command-item" data-cmd="' + escAttr(item.key) + '" data-idx="' + idx + '" onclick="executeCommand(\'' + escAttr(item.key) + '\')">' +
          '<span>' + escapeHtml(item.label) + '</span>' +
          '<span class="command-meta">' + escapeHtml(item.subtitle || '') + '</span></div>';
        CMD_RESULTS.push({ key: item.key, action: item.action });
      });
      if (submissionResults.length) html += '<div class="command-category">Submissions</div>';
      submissionResults.forEach(function (item) {
        var idx = CMD_RESULTS.length;
        html += '<div class="command-item" data-cmd="' + escAttr(item.key) + '" data-idx="' + idx + '" onclick="executeCommand(\'' + escAttr(item.key) + '\')">' +
          '<span>' + escapeHtml(item.label) + '</span>' +
          '<span class="command-meta">' + escapeHtml(item.subtitle || '') + '</span></div>';
        CMD_RESULTS.push({ key: item.key, action: item.action });
      });
      if (documentResults.length) html += '<div class="command-category">Documents</div>';
      documentResults.forEach(function (item) {
        var idx = CMD_RESULTS.length;
        html += '<div class="command-item" data-cmd="' + escAttr(item.key) + '" data-idx="' + idx + '" onclick="executeCommand(\'' + escAttr(item.key) + '\')">' +
          '<span>' + escapeHtml(item.label) + '</span>' +
          '<span style="margin-left:auto;color:var(--muted);font-size:12px;">' + escapeHtml(item.subtitle || '') + '</span></div>';
        CMD_RESULTS.push({ key: item.key, action: item.action });
      });
      var list = getEl('commandList');
      if (list) {
        var spinner = list.querySelector('.palette-searching');
        if (spinner) spinner.remove();
        if (html) list.insertAdjacentHTML('beforeend', html);
      }
      hideSearching();
      highlightSelected();
    });
  }, 150);
}

function showSearching() {
  var list = getEl('commandList');
  if (!list) return;
  if (list.querySelector('.palette-searching')) return;
  var div = document.createElement('div');
  div.className = 'palette-searching';
  div.style.cssText = 'padding:12px 16px;color:var(--muted);font-size:12px;text-align:center;';
  div.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite;margin-right:6px;vertical-align:middle;"></span>Searching…';
  list.appendChild(div);
}

function hideSearching() {
  var list = getEl('commandList');
  if (!list) return;
  var el = list.querySelector('.palette-searching');
  if (el) el.remove();
}

function paletteNavigate(dir) {
  var total = CMD_RESULTS.length;
  if (!total) return;
  CMD_SELECTED_IDX = (CMD_SELECTED_IDX + dir + total) % total;
  highlightSelected();
}

function paletteActivate() {
  if (CMD_RESULTS[CMD_SELECTED_IDX]) executeCommand(CMD_RESULTS[CMD_SELECTED_IDX].key);
}

/* Keyboard navigation inside palette */
(function () {
  var origOpen = openCommandPalette;
  var overrideInstalled = false;
  openCommandPalette = function () {
    origOpen();
    if (!overrideInstalled) {
      var input = getEl('commandInput');
      if (input) {
        input.removeEventListener('keydown', paletteKeydown);
        input.addEventListener('keydown', paletteKeydown);
      }
      overrideInstalled = true;
    }
  };

  function paletteKeydown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); paletteNavigate(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); paletteNavigate(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); paletteActivate(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeCommandPalette(); }
  }
})();

/* Debounced filter for oninput (keeps direct calls synchronous) */
var _filterTimer = null;
var _origFilterCommands = filterCommands;
function filterCommands(query) {
  if (document.activeElement && document.activeElement.id === 'commandInput') {
    if (_filterTimer) clearTimeout(_filterTimer);
    _filterTimer = setTimeout(function () { _origFilterCommands(query); }, 120);
    return;
  }
  _origFilterCommands(query);
}

/* ---------------------------------- Edit modal ---------------------------------- */

function openEditModal() {
  openDialog('editModal');
  const modal = getEl('editModal');
  const firstInput = modal.querySelector('input:not([type=hidden]):not([readonly])');
  if (firstInput) firstInput.focus();
}

function closeEditModal() {
  closeDialog('editModal');
}

const linkFields_ = {
  action: 'editAction'
};

function updateFieldLinkButton(fieldKey) {
  const btn = document.querySelector('.field-link-btn[data-link-field="' + fieldKey + '"]');
  if (!btn) return;
  const list = (appState.fieldLinks && appState.fieldLinks[fieldKey]) || [];
  const count = Array.isArray(list) ? list.filter(function (l) { return l && l.url; }).length : (list && list.url ? 1 : 0);
  btn.classList.toggle('is-linked', count > 0);
  btn.textContent = count > 0 ? 'Edit links (' + count + ')' : 'Link';
  btn.setAttribute('aria-label', (count > 0 ? 'Edit hyperlinks for ' : 'Add hyperlinks to ') + fieldKey);
}

function openLinkModal(fieldKey) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const inputId = linkFields_[fieldKey];
  if (!inputId) return;
  appState.linkField = fieldKey;
  const raw = (appState.fieldLinks && appState.fieldLinks[fieldKey]) || [];
  const existing = Array.isArray(raw) ? raw : (raw && raw.url ? [raw] : []);
  getEl('linkField').value = fieldKey;
  getEl('linkList').innerHTML = '';
  (existing.length ? existing : [{}]).forEach(function (link) {
    appendLinkRow_(link || {});
  });
  const status = getEl('linkStatus');
  if (status) { status.textContent = ''; status.classList.remove('success', 'error'); }
  openDialog('linkModal');
  const firstInput = getEl('linkList').querySelector('input');
  if (firstInput) firstInput.focus();
}

function appendLinkRow_(link) {
  const list = getEl('linkList');
  if (!list) return;
  const index = list.children.length;
  const row = document.createElement('div');
  row.className = 'link-row';
  row.innerHTML =
    '<div class="link-row-head"><span class="link-row-label">Link ' + (index + 1) + '</span>' +
    (index > 0 ? '<button type="button" class="btn btn-danger btn-small" onclick="removeLinkRow(this)" aria-label="Remove this link">Remove</button>' : '') +
    '</div>' +
    '<div class="field">' +
    '  <label>Display text</label>' +
    '  <input type="text" class="input link-row-text" aria-label="Link display text" placeholder="Link text shown in the field" value="' + escAttr(String(link.text || '')) + '">' +
    '  <span class="field-error"></span>' +
    '</div>' +
    '<div class="field">' +
    '  <label>Link URL</label>' +
    '  <input type="text" class="input link-row-url" aria-label="Link URL" placeholder="https://example.com" value="' + escAttr(String(link.url || '')) + '">' +
    '  <span class="field-error"></span>' +
    '</div>';
  list.appendChild(row);
}

function addLinkRow() {
  appendLinkRow_({});
}

function removeLinkRow(btn) {
  const row = btn && btn.closest('.link-row');
  if (!row) return;
  const list = getEl('linkList');
  row.remove();
  // re-number the remaining rows
  Array.prototype.forEach.call(list.children, function (child, i) {
    const label = child.querySelector('.link-row-label');
    if (label) label.textContent = 'Link ' + (i + 1);
    const removeBtn = child.querySelector('[onclick^="removeLinkRow"]');
    if (removeBtn) removeBtn.style.visibility = i === 0 ? 'hidden' : '';
  });
}

function closeLinkModal() {
  closeDialog('linkModal');
}

function normalizeLinkUrl_(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) return value;
  if (/^www\./i.test(value)) return 'https://' + value;
  return 'https://' + value;
}

function saveLinkModal(e) {
  e.preventDefault();
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  const fieldKey = getEl('linkField').value;
  const rows = getEl('linkList').querySelectorAll('.link-row');
  const collected = [];
  let valid = true;
  Array.prototype.forEach.call(rows, function (row) {
    const textEl = row.querySelector('.link-row-text');
    const urlEl = row.querySelector('.link-row-url');
    const text = (textEl && textEl.value || '').trim();
    const url = (urlEl && urlEl.value || '').trim();
    if (!text && !url) return; // skip empty rows
    let rowValid = true;
    rowValid = setFieldInvalid(textEl, text ? '' : 'Display text is required.') && rowValid;
    rowValid = setFieldInvalid(urlEl, url ? '' : 'Link URL is required.') && rowValid;
    if (!rowValid) { valid = false; return; }
    collected.push({ text: text, url: normalizeLinkUrl_(url) });
  });
  if (!valid) return;
  if (!appState.fieldLinks) appState.fieldLinks = {};
  if (collected.length) {
    appState.fieldLinks[fieldKey] = collected;
  } else {
    delete appState.fieldLinks[fieldKey];
  }
  // Keep the field's own text as the user typed it: the hyperlink display
  // texts live in fieldLinks and are rendered below the field text.
  updateFieldLinkButton(fieldKey);
  closeLinkModal();
  showToast(collected.length ? 'Hyperlinks applied to ' + fieldKey : 'Hyperlinks removed', collected.length ? 'success' : 'info');
}

function resetEditForm() {
  getEl('editRow').value = '';
  getEl('editId').value = '';
  getEl('editSector').value = '';
  getEl('editDescription').value = '';
  getEl('editEntryDate').value = '';
  getEl('editAction').value = '';
  getEl('editResponsibility').value = '';
  clearMultiSelect('editResponsibilityMs');
  getEl('editReviewDate').value = '';
  getEl('editFlagged').checked = false;
  appState.fieldLinks = {};
  Object.keys(linkFields_).forEach(function (fieldKey) { updateFieldLinkButton(fieldKey); });
  const status = getEl('editStatus');
  if (status) { status.textContent = ''; status.classList.remove('success', 'error'); }
  ['editSector', 'editDescription'].forEach(function (id) {
    const el = getEl(id);
    if (el) setFieldInvalid(el, '');
  });
}

// Returns the current link list for a field as an array of {text, url} (or
// null when no links are set). Used when saving so the payload carries the
// multi-link array form the server now expects.
function readFieldLinks_(fieldKey) {
  const raw = appState.fieldLinks && appState.fieldLinks[fieldKey];
  if (!raw) return null;
  const list = Array.isArray(raw) ? raw : [raw];
  const cleaned = list.filter(function (l) { return l && l.url; }).map(function (l) {
    return { text: (l.text || '').trim(), url: String(l.url || '').trim() };
  });
  return cleaned.length ? cleaned : null;
}

function addNewItem() {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  appState.editMode = 'add';
  resetEditForm();
  openEditModal();
}

function editItem(row) {
  const item = appState.items.find(function (i) { return String(i.row) === String(row); });
  if (!item) return;
  appState.editMode = 'edit';
  getEl('editRow').value = item.row;
  getEl('editId').value = item.id || '';
  getEl('editSector').value = item.sector || '';
  getEl('editDescription').value = item.description || '';
  getEl('editEntryDate').value = item.entryDate || '';
  getEl('editAction').value = item.action || '';
  getEl('editResponsibility').value = item.responsibility || '';
  populateResponsibilitySelect();
  getEl('editReviewDate').value = item.reviewDate || '';
  getEl('editFlagged').checked = !!item.flagged;
  appState.fieldLinks = {};
  Object.keys(linkFields_).forEach(function (fieldKey) {
    // Prefer the full per-field link list (array form); fall back to the
    // legacy single {url, text} shape from linkUrls/linkTexts.
    const list = (item.links && item.links[fieldKey]) || null;
    if (Array.isArray(list) && list.length) {
      appState.fieldLinks[fieldKey] = list.map(function (l) {
        return { text: (l && l.text) || '', url: (l && l.url) || '' };
      });
    } else if (list && list.url) {
      appState.fieldLinks[fieldKey] = [{ text: list.text || '', url: list.url }];
    } else {
      const url = item.linkUrls && item.linkUrls[fieldKey];
      if (url) {
        const text = (item.linkTexts && item.linkTexts[fieldKey]) || item[fieldKey] || '';
        appState.fieldLinks[fieldKey] = [{ text: text, url: url }];
      }
    }
    updateFieldLinkButton(fieldKey);
  });
  const status = getEl('editStatus');
  if (status) { status.textContent = ''; status.classList.remove('success', 'error'); }
  ['editSector', 'editDescription'].forEach(function (id) {
    const el = getEl(id);
    if (el) setFieldInvalid(el, '');
  });
  openEditModal();
}

function saveEditModal(e) {
  e.preventDefault();
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }

  const sectorEl = getEl('editSector');
  const descEl = getEl('editDescription');
  let valid = true;
  valid = setFieldInvalid(sectorEl, sectorEl.value.trim() ? '' : 'Sector is required.') && valid;
  valid = setFieldInvalid(descEl, descEl.value.trim() ? '' : 'Description is required.') && valid;
  if (!valid) return;

  const item = {
    row: Number(getEl('editRow').value || 0),
    id: getEl('editId').value,
    recordId: (appState.items.find(function (i) { return String(i.row) === String(Number(getEl('editRow').value || 0)); }) || {}).recordId || '',
    sector: sectorEl.value.trim(),
    description: descEl.value,
    entryDate: getEl('editEntryDate').value.trim(),
    action: getEl('editAction').value,
    responsibility: getEl('editResponsibility').value.trim(),
    reviewDate: getEl('editReviewDate').value.trim(),
    flagged: getEl('editFlagged').checked,
    links: {
      action: readFieldLinks_('action')
    }
  };

  if (appState.editMode === 'add') {
    submitNewItem(item);
  } else if (item.row) {
    saveItem(item);
  }
}

function submitNewItem(item) {
  showOverlay('Adding record…');
  ApiService.addItem(item).then(function (data) {
    hideOverlay();
    closeEditModal();
    appState.items = data.items || [];
    appState.summary = data.summary || {};
    appState.analytics = data.analytics || {};
    populateFilters();
    renderDashboard(true);
    showToast('New item created', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Add failed: ' + (err.message || err), 'error');
  });
}

function saveItem(item) {
  showOverlay('Saving record…');
  ApiService.updateItem(item).then(function (data) {
    hideOverlay();
    closeEditModal();
    appState.items = data.items || [];
    appState.summary = data.summary || {};
    appState.analytics = data.analytics || {};
    renderDashboard(true);
    showToast('Record saved', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Save failed: ' + (err.message || err), 'error');
  });
}

function deleteItem(row) {
  if (!appState.isEditor) { showToast('Admin/editor access required', 'warning'); return; }
  showConfirm({
    title: 'Delete record',
    message: 'Delete this record permanently? This cannot be undone.',
    okLabel: 'Delete',
    danger: true
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Deleting record…');
    ApiService.deleteItem(row).then(function (data) {
      hideOverlay();
      appState.items = data.items || [];
      appState.summary = data.summary || {};
      appState.analytics = data.analytics || {};
      // Deleting a record renumbers the rows below it, so the submission
      // overview must follow the shift immediately (not on the next
      // background refresh) or counts/badges point at the wrong records.
      appState.submissionCounts = data.submissionCounts || {};
      appState.submissionFlash = data.submissionFlash || {};
      appState.displayedSubmissions = data.displayedSubmissions || [];
      renderDashboard(true);
      showToast('Record deleted', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Delete failed: ' + (err.message || err), 'error');
    });
  });
}

/* ---------------------------------- Review badge ---------------------------------- */

function toggleDropdown(btn) {
  const wrap = btn.closest ? btn.closest('.menu-dropdown') : btn.parentElement;
  const menu = wrap ? wrap.querySelector('.menu-dropdown-menu') : null;
  if (!menu) return;
  const isOpen = menu.classList.toggle('open');
  closeDropdowns(menu);
  return isOpen;
}

function closeDropdowns(exceptMenu) {
  document.querySelectorAll('.menu-dropdown-menu.open').forEach(function (m) {
    if (m !== exceptMenu) m.classList.remove('open');
  });
  document.querySelectorAll('.review-dropdown-menu.open').forEach(function (m) {
    if (m !== exceptMenu) m.classList.remove('open');
  });
}

/* Pin/unpin a nested submenu (print-report parent items) on click. Only
   sibling submenus are closed; the outer menu stays open. */
function toggleSubmenu(trigger) {
  const wrap = trigger.closest ? trigger.closest('.menu-dropdown-parent') : trigger.parentElement;
  const menu = wrap ? wrap.querySelector('.menu-dropdown-submenu') : null;
  if (!menu) return;
  const isOpen = menu.classList.toggle('open');
  document.querySelectorAll('.menu-dropdown-submenu.open').forEach(function (m) {
    if (m !== menu) m.classList.remove('open');
  });
  return isOpen;
}

function toggleReviewDropdown(btn) {
  const menu = btn.parentElement.querySelector('.review-dropdown-menu');
  if (!menu) return;
  const isOpen = menu.classList.toggle('open');
  document.querySelectorAll('.review-dropdown-menu.open').forEach(function (m) {
    if (m !== menu) m.classList.remove('open');
  });
  return isOpen;
}

function markReviewDone(row) {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  showConfirm({
    title: 'Mark review done',
    message: 'Mark this record as review done?',
    okLabel: 'Mark done'
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Marking review as done…');
    ApiService.markReviewDone(row).then(function (data) {
      hideOverlay();
      appState.items = data.items || [];
      appState.summary = data.summary || {};
      renderDashboard(true);
      showToast('Marked review as done', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Failed: ' + (err.message || err), 'error');
    });
  });
}

function markReviewNotDone(row) {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  showConfirm({
    title: 'Mark as not done',
    message: 'Reopen this record so it returns to review due?',
    okLabel: 'Mark not done'
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Reopening review…');
    ApiService.markReviewNotDone(row).then(function (data) {
      hideOverlay();
      appState.items = data.items || [];
      appState.summary = data.summary || {};
      renderDashboard(true);
      showToast('Review reopened — record is review due', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Failed: ' + (err.message || err), 'error');
    });
  });
}

/* ---------------------------------- Submissions modal ---------------------------------- */

function openSubmissionsModal(row, cardId, onlyMine) {
  appState.submissionCardRow = row;
  appState.submissionCardId = cardId;
  appState.submissionEditingId = '';
  appState.pendingInlineEditId = '';
  getEl('submissionText').value = '';
  const fileInput = getEl('submissionAttachment');
  if (fileInput) fileInput.value = '';
  const fileName = getEl('submissionAttachmentName');
  if (fileName) fileName.textContent = '';
  resetSubmissionCompose();
  getEl('submissionStatus').textContent = '';
  getEl('submissionsOnlyMine').checked = !!onlyMine;
  getEl('submissionText').placeholder = 'Write your update for record #' + cardId + '…';
  const subsModal = getEl('submissionsModal');
  subsModal.classList.remove('hidden');
  loadSubmissions();
  // Route through the shared dialog system so body.modal-open (scroll lock +
  // the auto-refresh deferral guard) and the aria state stay consistent.
  openDialog('submissionsModal');
  const textarea = getEl('submissionText');
  if (textarea) textarea.focus();
}

function closeSubmissionsModal() {
  closeDialog('submissionsModal');
}

function markAllSubmissionsRead() {
  if (!appState.isAdmin) return;
  showOverlay('Marking all updates as read…');
  ApiService.markAllSubmissionsRead().then(function (overview) {
    hideOverlay();
    appState.submissionSeq++;
    appState.submissionCounts = (overview && overview.counts) || {};
    appState.submissionFlash = (overview && overview.flash) || {};
    appState.displayedSubmissions = (overview && overview.displayed) || [];
    renderDashboard(true);
    updateMarkAllSubmissionsReadBtn();
    showToast('All updates marked as read', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not mark updates as read: ' + (err.message || err), 'error');
  });
}

function resetSubmissionCompose() {
  getEl('submitSubmissionBtn').textContent = 'Submit update';
  getEl('cancelSubmissionBtn').classList.add('hidden');
}

function loadSubmissions() {
  ApiService.getSubmissions(Number(appState.submissionCardRow)).then(function (list) {
    appState.submissions = list || [];
    renderSubmissionList();
    // Inline "Edit" (card/detail) opened the modal with a target submission:
    // drop into edit mode for it now that this card's list is loaded.
    if (appState.pendingInlineEditId) {
      const pendingId = appState.pendingInlineEditId;
      appState.pendingInlineEditId = '';
      if ((list || []).some(function (s) { return String(s.id) === String(pendingId); })) {
        editSubmission(pendingId);
      }
    }
    // Reading a card's update list counts as reading it: an admin who opens
    // the modal stops that card's badge flashing (the counter stays).
    if (appState.isAdmin && appState.submissionCardRow) {
      const row = Number(appState.submissionCardRow);
      if (appState.submissionFlash[row]) {
        appState.submissionFlash[row] = false;
        renderDashboard(true);
        updateMarkAllSubmissionsReadBtn();
      }
    }
  }).catch(function (err) {
    if (handleServerFailure(err)) return;
    showToast('Could not load submissions: ' + (err.message || err), 'error');
  });
}

function renderSubmissionList() {
  const onlyMine = getEl('submissionsOnlyMine').checked;
  const all = appState.submissions || [];
  const list = all.filter(function (s) { return !onlyMine || s.isOwner; });
  getEl('submissionsCount').textContent = list.length + ' shown / ' + all.length + ' total';
  getEl('submissionsList').innerHTML = list.length
    ? list.map(renderSubmissionCard).join('')
    : '<div class="empty-state"><div class="empty-state-icon">' + svgIcon('inbox') + '</div><div class="empty-state-title">No submissions yet</div><div class="empty-state-subtitle">Submissions for this record will appear here.</div></div>';
}

function renderSubmissionCard(s) {
  const lockedBadge = s.locked ? '<span class="badge badge-locked">Locked</span>' : '';
  const displayedBadge = s.displayed ? '<span class="badge badge-displayed">On card</span>' : '';
  const attachmentsHtml = (s.attachments || []).map(function (a) { return '<div class="submission-attachment">📎 <a href="/api/files/' + encodeURIComponent(a.fileKey) + '?download=1" target="_blank" rel="noopener">' + escapeHtml(a.fileName) + '</a> <span class="form-status">(' + formatFileSize(a.size) + ')</span></div>'; }).join('');
  const ownerTag = s.isOwner ? ' <em>(you)</em>' : '';
  const editBtn = s.editable
    ? `<button class="btn btn-secondary btn-small" type="button" onclick="editSubmission('${escAttr(s.id)}')">Edit</button>`
    : '';
  let lockBtn = '';
  if (s.canUnlock) {
    lockBtn = `<button class="btn btn-secondary btn-small" type="button" onclick="unlockSubmission('${escAttr(s.id)}')">Unlock</button>`;
  } else if (s.canLock) {
    lockBtn = `<button class="btn btn-secondary btn-small" type="button" onclick="lockSubmission('${escAttr(s.id)}')">Lock</button>`;
  }
  const deleteBtn = appState.isEditor
    ? `<button class="btn btn-danger btn-small" type="button" onclick="deleteSubmission('${escAttr(s.id)}')">Delete</button>`
    : '';
  const displayBtn = appState.isAdmin
    ? `<button class="btn btn-secondary btn-small" type="button" onclick="toggleDisplaySubmission('${escAttr(s.id)}')">${s.displayed ? 'Hide from card' : 'Display on card'}</button>`
    : '';
  const lockRoleTag = s.lockRole ? ` (${escapeHtml(s.lockRole.toLowerCase())})` : '';
  const lockNote = s.lockedBy
    ? `<span class="submission-note">Locked by ${escapeHtml(s.lockedBy)}${lockRoleTag}${s.lockedAt ? ' on ' + escapeHtml(s.lockedAt) : ''}</span>`
    : '';
  return `
    <div class="submission-card">
      <div class="submission-meta">
        <span>${escapeHtml(s.email)}${ownerTag} ${lockedBadge} ${displayedBadge}</span>
        <span>${escapeHtml(formatTimestamp(s.createdAt))}</span>
      </div>
      <div class="submission-text preserve-whitespace">${renderSubmissionText(s.text || '')}</div>
      ${attachmentsHtml ? '<div class="submission-attachments">' + attachmentsHtml + '</div>' : ''}
      <div class="submission-actions">${editBtn}${lockBtn}${deleteBtn}${displayBtn}${lockNote}</div>
    </div>`;
}

function editSubmission(id) {
  const s = (appState.submissions || []).find(function (x) { return String(x.id) === String(id); });
  if (!s) return;
  appState.submissionEditingId = s.id;
  getEl('submissionText').value = s.text;
  const fileInput = getEl('submissionAttachment');
  if (fileInput) fileInput.value = '';
  const fileName = getEl('submissionAttachmentName');
  if (fileName) fileName.textContent = '';
  getEl('submitSubmissionBtn').textContent = 'Save changes';
  getEl('cancelSubmissionBtn').classList.remove('hidden');
  getEl('submissionStatus').textContent = 'Editing your submission';
}

function cancelSubmissionEdit() {
  appState.submissionEditingId = '';
  getEl('submissionText').value = '';
  const fileInput = getEl('submissionAttachment');
  if (fileInput) fileInput.value = '';
  const fileName = getEl('submissionAttachmentName');
  if (fileName) fileName.textContent = '';
  getEl('submissionStatus').textContent = '';
  resetSubmissionCompose();
}

function insertSubmissionLink() {
  const text = prompt('Link text:', 'Open link');
  if (text === null) return;
  const url = prompt('URL (https://…):', 'https://');
  if (url === null) return;
  const trimmed = String(url).trim();
  if (!/^https?:\/\//i.test(trimmed)) { showToast('Please enter a valid http:// or https:// URL.', 'warning'); return; }
  const ta = getEl('submissionText');
  const link = '[' + String(text || trimmed).replace(/\]/g, '') + '](' + trimmed.replace(/[()]/g, '') + ')';
  const start = ta.selectionStart == null ? ta.value.length : ta.selectionStart;
  const end = ta.selectionEnd == null ? ta.value.length : ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + link + ta.value.slice(end);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = start + link.length;
}

function handleSubmissionAttachmentChange(input) {
  const file = input && input.files && input.files[0];
  const label = getEl('submissionAttachmentName');
  if (!file) { if (label) label.textContent = ''; return; }
  if (file.size > 1024 * 1024) { input.value = ''; if (label) label.textContent = ''; getEl('submissionStatus').textContent = 'Attachment exceeds the 1 MB limit.'; return; }
  if (label) label.textContent = file.name + ' (' + formatFileSize(file.size) + ')';
}

function renderSubmissionText(value) {
  const source = String(value || '');
  const escaped = escapeHtml(source);
  return escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, function (_, label, url) {
    return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
  });
}

function submitSubmission() {
  const text = getEl('submissionText').value;
  const fileInput = getEl('submissionAttachment');
  const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  if (file && file.size > 1024 * 1024) { getEl('submissionStatus').textContent = 'Attachment exceeds the 1 MB limit.'; return; }
  if (!text || !text.trim()) {
    getEl('submissionStatus').textContent = 'Write your update before submitting.';
    return;
  }
  const editingId = appState.submissionEditingId;
  function buildAttachment(cb) {
    if (!file) { cb(null); return; }
    const reader = new FileReader();
    reader.onload = function () { const result = String(reader.result || ''); cb({ fileName: file.name, mimeType: file.type || 'application/octet-stream', base64: result.split(',')[1] || '' }); };
    reader.onerror = function () { getEl('submissionStatus').textContent = 'Could not read attachment.'; };
    reader.readAsDataURL(file);
  }
  buildAttachment(function (attachment) {
  if (editingId) {
    showOverlay('Saving submission…');
    ApiService.updateSubmission(editingId, text, attachment).then(function (list) {
      hideOverlay();
      appState.submissionSeq++;
      appState.submissions = list || [];
      appState.submissionEditingId = '';
      getEl('submissionText').value = '';
      resetSubmissionCompose();
      getEl('submissionStatus').textContent = '';
      renderSubmissionList();
      showToast('Submission updated', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      getEl('submissionStatus').textContent = err.message || 'Could not save submission';
    });
  } else {
    showOverlay('Submitting update…');
    ApiService.addSubmission(Number(appState.submissionCardRow), appState.submissionCardId, text, attachment).then(function (list) {
      hideOverlay();
      appState.submissionSeq++;
      appState.submissions = list || [];
      appState.submissionCounts[Number(appState.submissionCardRow)] = (list || []).length;
      appState.submissionFlash[Number(appState.submissionCardRow)] = true;
      getEl('submissionText').value = '';
      resetSubmissionCompose();
      getEl('submissionStatus').textContent = '';
      renderSubmissionList();
      renderDashboard(true);
      showToast('Update submitted', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      getEl('submissionStatus').textContent = err.message || 'Could not submit update';
    });
  }
  });
}

function lockSubmission(id) {
  if (!appState.isEditor) { showToast('Editor access required', 'warning'); return; }
  showOverlay('Locking submission…');
  ApiService.lockSubmission(id).then(function (list) {
    hideOverlay();
    appState.submissions = list || [];
    renderSubmissionList();
    showToast('Submission locked', 'success');
    renderDashboard(true);
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not lock submission: ' + (err.message || err), 'error');
  });
}

function unlockSubmission(id) {
  if (!appState.isEditor) { showToast('Editor access required', 'warning'); return; }
  showOverlay('Unlocking submission…');
  ApiService.unlockSubmission(id).then(function (list) {
    hideOverlay();
    appState.submissions = list || [];
    renderSubmissionList();
    showToast('Submission unlocked', 'success');
    renderDashboard(true);
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not unlock submission: ' + (err.message || err), 'error');
  });
}

function deleteSubmission(id) {
  if (!appState.isEditor) { showToast('Editor access required', 'warning'); return; }
  showConfirm({
    title: 'Delete submission',
    message: 'Delete this submission permanently?',
    okLabel: 'Delete',
    danger: true
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Deleting submission…');
    ApiService.deleteSubmission(id).then(function (list) {
      appState.submissionSeq++;
      hideOverlay();
      appState.submissions = list || [];
      renderSubmissionList();
      showToast('Submission deleted', 'success');
      refreshData();
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Could not delete submission: ' + (err.message || err), 'error');
    });
  });
}

function toggleDisplaySubmission(id) {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  showOverlay('Updating display…');
  ApiService.toggleSubmissionDisplay(id).then(function (list) {
    hideOverlay();
    appState.submissions = list || [];
    renderSubmissionList();
    showToast('Display updated', 'success');
    refreshData();
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Could not update display: ' + (err.message || err), 'error');
  });
}

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

    // Records (== the ones My Day turns into reviews/submissions counts) may
    // not have been applied on a cold boot — a user can land here via the
    // `goto-myday` command or a PWA shortcut before the first getAppData
    // resolves. Painting "All clear" from an empty appState.items would be a
    // false negative that hides overdue work. Wait for the first
    // DataRefreshed instead of guessing.
    if (!appState.lastUpdated) {
      waitForMyDayData_(panel);
      return;
    }

    var data = buildMyDayData_(myTasks);
    renderMyDayContent_(panel, data);
  })  .catch(function () {
    panel.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-state-icon">' + svgIcon('alert') + '</div>' +
      '<div class="empty-state-title">Could not load your day</div>' +
      '<div class="empty-state-subtitle">Please try again later.</div>' +
      '</div>';
  });
}

/* Cold-boot guard: My Day's records (reviews/overdue work/submissions) come
   from appState.items, which starts empty and is only filled after the first
   getAppData resolves. If the user lands here before that (PWA shortcut,
   command palette, or a deep link straight to My Day), painting the summary
   now would show a misleading "All clear". Instead hold a quiet "Preparing
   your day…" state and re-render the moment the first refresh lands —
   one-shot, so we never hot-replace My Day while a later refresh is also
   in flight. */
function waitForMyDayData_(panel) {
  var shown = false;
  var retry = function () {
    if (!shown) {
      panel.innerHTML =
        '<div class="myday-loading"><div class="spinner"></div><span>Preparing your day…</span></div>';
      shown = true;
    }
    EventBus.off('DataRefreshed', retry);
    renderMyDay();
  };
  EventBus.on('DataRefreshed', retry);
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
/* ---------------------------------- Presentation Mode ---------------------------------- */
/* Full-screen slideshow over the current dashboard record set: one record per
   slide using the same card-field rendering semantics. Only two record
   actions are exposed — Show/Hide Submissions (reuses the existing per-record
   visibility state) and Mark as Completed (reuses review-completion
   semantics). All links reuse the existing in-page preview popup (80% zoom
   default). */

var presentationState = {
  active: false,          // is the overlay open?
  index: 0,               // current slide index
  items: [],              // snapshot of the visible record set at entry
  touchStartX: 0,
  touchStartY: 0,
  touchTarget: null,
  resumeRow: null
};

/* ---- Link warming state: deduped, concurrency-limited, abortable ----
   Warms with hidden <iframe>s (not fetch no-cors) so the warmed document is
   the *same* browsing-context type the preview modal uses — the warmed frame
   can be reparented straight into the modal instead of re-navigating, which
   is what actually makes a click load instantly. */
var presentationWarm = {
  MAX_CONCURRENCY: 4,
  MAX_RETRIES: 2,
  RETRY_BASE_MS: 900,
  TIMEOUT_MS: 8000,
  queue: [],
  status: {},                // URL -> queued|loading|ready|failed
  retryAt: {},               // URL -> epoch ms before another attempt
  retryCount: {},            // URL -> number of retries already used
  seenOrigins: {},
  inflight: 0,
  generation: 0,             // invalidates late iframe events after exit
  frames: {},                // embeddable URL -> { node, frame, ready }
  previewCache: {},           // embeddable URL -> { node, frame, ready }
  previewCacheOrder: []      // cache order for adopted preview frames
};

/* Buffer the previous/current/next/next-next slides' links in the background
   so a click loads instantly. Deduping (seenUrls) keeps the warm set bounded;
   the FIFO queue + concurrency pump keeps it polite. */
function warmNearbySlides_() {
  const items = presentationState.items;
  const idx = presentationState.index;
  const targets = [];
  // Priority order: current → next → previous → next+1 → next+2 → previous+1.
  // This keeps the most likely click targets warm first without warming the
  // entire deck at entry. The concurrency-limited pump handles the rest.
  [idx, idx + 1, idx - 1, idx + 2, idx + 3, idx - 2].forEach(function (i) {
    if (items[i]) targets.push(items[i]);
  });
  warmPresentationLinks_(targets);
}

function enterPresentationMode() {
  const items = sortedItems(); // respects current search/sector/review/hidden filters + sort
  if (!items || !items.length) {
    showToast('No records to present.', 'warning');
    return;
  }

  let savedRow = '';
  try { savedRow = localStorage.getItem('dash.presentation.resumeRow') || ''; } catch (err) {}
  const savedIndex = items.findIndex(function (item) { return String(item.row) === savedRow; });
  const startPresentation_ = function (index, resumed) {
    presentationState.items = items.slice();
    presentationState.index = Math.max(0, index);
    presentationState.active = true;
    presentationState.resumeRow = String(presentationState.items[presentationState.index].row);
    presentationWarm.generation++;
    presentationWarm.queue = [];
    presentationWarm.status = {};
    presentationWarm.retryAt = {};
    presentationWarm.retryCount = {};
    presentationWarm.seenOrigins = {};
    presentationWarm.inflight = 0;
    presentationWarm.frames = {};
    presentationWarm.previewCache = {};
    presentationWarm.activePreviewTarget = null;
    presentationWarm.previewCacheOrder = [];
    const overlay = getEl('presentationOverlay');
    if (overlay) {
      overlay.classList.add('presentation-open');
      renderPresentationSlide_();
      wirePresentationTouch_();
      const nextBtn = getEl('presentationNextBtn');
      if (nextBtn) nextBtn.focus();
    }
    if (resumed) showToast('Resumed presentation from card ' + (index + 1) + '.', 'success');
    warmNearbySlides_();
  };

  if (savedIndex >= 0) {
    showConfirm({
      title: 'Resume presentation?',
      message: 'Resume from card ' + (savedIndex + 1) + ' of ' + items.length + '?',
      okLabel: 'Resume'
    }).then(function (ok) {
      startPresentation_(ok ? savedIndex : 0, ok);
    });
    return;
  }

  startPresentation_(0, false);
}

function exitPresentationMode() {
  /* Return any modal parked inside the fullscreen overlay back to the
     document before the overlay is hidden, so it stays usable after exit. */
  try {
    if (typeof restoreModalFromFullscreen_ === 'function') {
      document.querySelectorAll('.modal-backdrop').forEach(restoreModalFromFullscreen_);
    }
  } catch (err) {}
  presentationState.active = false;
  try { localStorage.setItem('dash.presentation.resumeRow', presentationState.resumeRow || ''); } catch (err) {}
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
  // Iframes do not support fetch-style AbortController cancellation. A
  // generation token makes late events harmless; removing the browsing
  // contexts releases the actual navigation/document.
  presentationWarm.generation++;
  presentationWarm.queue = [];
  presentationWarm.inflight = 0;
  presentationWarm.frames = {};
  presentationWarm.previewCache = {};
  presentationWarm.activePreviewTarget = null;
  presentationWarm.status = {};
  presentationWarm.retryAt = {};
  presentationWarm.retryCount = {};
  presentationWarm.previewCacheOrder = [];
  document.querySelectorAll('.pres-warm-frame').forEach(function (node) {
    if (node.parentNode) node.parentNode.removeChild(node);
  });
  removePresentationPreconnects_();
  const overlay = getEl('presentationOverlay');
  if (overlay) overlay.classList.remove('presentation-open');
  const stage = getEl('presentationStage');
  if (stage) stage.innerHTML = '';
}

function togglePresentationMode() {
  if (presentationState.active) exitPresentationMode();
  else enterPresentationMode();
}

/* ---- Render the current slide ---- */
function renderPresentationSlide_() {
  const stage = getEl('presentationStage');
  if (!stage) return;
  const items = presentationState.items;
  if (!items.length) return;
  // Wrap-around index guard
  if (presentationState.index < 0) presentationState.index = items.length - 1;
  if (presentationState.index > items.length - 1) presentationState.index = 0;
  const item = items[presentationState.index];
  stage.innerHTML = presentationSlideHtml_(item);

  const counter = getEl('presentationCounter');
  if (counter) counter.textContent = (presentationState.index + 1) + ' / ' + items.length;
  const progress = getEl('presentationProgress');
  if (progress) {
    const pct = items.length ? ((presentationState.index + 1) / items.length) * 100 : 0;
    progress.style.width = pct + '%';
    progress.setAttribute('aria-valuenow', String(Math.round(pct)));
  }
  presentationState.resumeRow = String(item.row);
  try { localStorage.setItem('dash.presentation.resumeRow', presentationState.resumeRow); } catch (err) {}

  // Re-apply the slide's submission visibility state to the slide's toggle.
  const updatesHidden = isRowUpdatesHidden_(item.row);
  const toggle = stage.querySelector('[data-pres-updates]');
  if (toggle) toggle.textContent = updatesHidden ? 'Show submissions' : 'Hide submissions';

  const prevBtn = getEl('presentationPrevBtn');
  const nextBtn = getEl('presentationNextBtn');
  if (prevBtn) prevBtn.disabled = items.length <= 1;
  if (nextBtn) nextBtn.disabled = items.length <= 1;
}

/* Reuses the same field traversal as dashboard cards (groupCardFields_ +
   cardFieldHtml_) so Presentation Mode shows exactly what users already see,
   with only the two allowed record actions. */
function presentationSlideHtml_(item) {
  const groups = groupCardFields_(item.displayFields);
  /* Presentation mode is intentionally meeting-focused: only Action and
     Last Meeting Instructions are shown. */
  const fieldsHtml = groups.action.concat(groups.instructions || [])
    .map(function (f) { return cardFieldHtml_(item, f); }).join('');

  const updatesHidden = isRowUpdatesHidden_(item.row);
  const updatesHtml = rowUpdatesHtml_(item.row);
  const updatesBlock = updatesHtml
    ? `<div class="card-updates${updatesHidden ? ' updates-hidden' : ''}" data-updates-row="${escAttr(item.row)}">${updatesHtml}</div>`
    : '';

  const subCount = (appState.submissionCounts || {})[item.row] || 0;
  const statusBadge = item.reviewStatus === 'due'
    ? '<span class="review-badge review-due">Review due</span>'
    : item.reviewStatus === 'done'
      ? '<span class="review-badge review-done">Review done</span>'
      : '<span class="badge" data-tone="muted">Not reviewed</span>';

  /* Only two controls per spec. Mark as Completed uses existing
     review-completion semantics and stays admin-gated like the dashboard. */
  let actions = '';
  if (updatesHtml) {
    actions += `<button class="btn btn-secondary btn-small presentation-act" data-pres-updates="${escAttr(item.row)}" type="button" onclick="presentationToggleUpdates_(${escAttr(item.row)}, this)">${updatesHidden ? 'Show submissions' : 'Hide submissions'}</button>`;
  }
  if (appState.isAdmin) {
    if (item.reviewStatus === 'done') {
      actions += `<button class="btn btn-ghost btn-small presentation-act" type="button" onclick="presentationUndoDone_(${escAttr(item.row)}, this)">Undo</button>`;
    } else {
      actions += `<button class="btn btn-primary btn-small presentation-act" type="button" onclick="presentationMarkDone_(${escAttr(item.row)}, this)">Mark as Completed</button>`;
    }
  }

  return `
    <article class="card presentation-slide-card" data-row="${escAttr(item.row)}">
      <div class="presentation-slide-head">
        <span class="id-badge">#${escapeHtml(item.id)}</span>
        ${statusBadge}
        <span class="presentation-subcount">${subCount} submission${subCount === 1 ? '' : 's'}</span>
      </div>
      <div class="presentation-slide-body">
        <div class="card-fields">${fieldsHtml || '<div class="card-field"><span class="field-label">Details</span><div class="field-value preserve-whitespace">No details available</div></div>'}${updatesBlock}</div>
        ${presentationLinksHtml_(item)}
      </div>
      <div class="presentation-slide-actions">${actions || '<span class="presentation-actions-empty">No actions available</span>'}</div>
    </article>`;
}

/* Show/Hide Submissions — reuses the existing toggle state (toggleCardUpdates
   owns the authoritative per-record visibility) and relabels with the
   presentation wording. */
function presentationToggleUpdates_(row, btn) {
  toggleCardUpdates(row, btn, true);
  const hidden = isRowUpdatesHidden_(row);
  if (btn) btn.textContent = hidden ? 'Show submissions' : 'Hide submissions';
  const stage = getEl('presentationStage');
  if (stage) {
    const alt = stage.querySelectorAll('[data-pres-updates="' + String(row).replace(/["\\]/g, '\\$&') + '"]');
    alt.forEach(function (el) { if (el !== btn) el.textContent = hidden ? 'Show submissions' : 'Hide submissions'; });
  }
}

/* Mark as Completed — reuses the existing review-completion semantics
   (ApiService.markReviewDone / reviewStatus) plus the same confirm pattern as
   the dashboard, then refreshes the slide in place and keeps dashboard state. */
function presentationMarkDone_(row, btn) {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  showConfirm({
    title: 'Mark review done',
    message: 'Mark this record\'s review as completed?',
    okLabel: 'Mark done'
  }).then(function (ok) {
    if (!ok) return;
    showOverlay('Marking review as done…');
    ApiService.markReviewDone(row).then(function (data) {
      hideOverlay();
      const item = presentationState.items[presentationState.index];
      if (item && String(item.row) === String(row)) item.reviewStatus = 'done';
      if (data && data.items) appState.items = data.items;
      if (data && data.summary) appState.summary = data.summary;
      renderDashboard(true);
      renderPresentationSlide_();
      showToast('Marked review as done', 'success');
    }).catch(function (err) {
      hideOverlay();
      if (handleServerFailure(err)) return;
      showToast('Failed: ' + (err.message || err), 'error');
    });
  });
}

function presentationUndoDone_(row) {
  if (!appState.isAdmin) { showToast('Admin access required', 'warning'); return; }
  showOverlay('Undoing review completion…');
  ApiService.markReviewNotDone(row).then(function (data) {
    hideOverlay();
    const item = presentationState.items[presentationState.index];
    if (item && String(item.row) === String(row)) item.reviewStatus = 'due';
    if (data && data.items) appState.items = data.items;
    if (data && data.summary) appState.summary = data.summary;
    renderDashboard(true);
    renderPresentationSlide_();
    showToast('Review marked as not done', 'success');
  }).catch(function (err) {
    hideOverlay();
    if (handleServerFailure(err)) return;
    showToast('Failed: ' + (err.message || err), 'error');
  });
}

/* ---- Slide navigation ---- */
function presentationNext_() {
  if (!presentationState.active) return;
  presentationState.index++;
  renderPresentationSlide_();
  warmNearbySlides_();
}

function presentationPrev_() {
  if (!presentationState.active) return;
  presentationState.index--;
  renderPresentationSlide_();
  warmNearbySlides_();
}

/* ---- Keyboard ---- */
function getPresentationKeydown_() {
  return function (e) {
    if (!presentationState.active) return;
    // Never hijack keys while a dialog/preview is open above the slideshow.
    if (document.querySelector('.modal-backdrop:not(.hidden)')) return;
    const target = e.target;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
    if (typing) return;

    const key = e.key;
    if (key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      } else {
        exitPresentationMode();
      }
      return;
    }
    if (key === ' ' || key === 'ArrowRight' || key === 'PageDown') {
      e.preventDefault();
      e.stopPropagation();
      presentationNext_();
      return;
    }
    if (key === 'ArrowLeft' || key === 'PageUp') {
      e.preventDefault();
      e.stopPropagation();
      presentationPrev_();
      return;
    }
    if (key === 'Home') {
      e.preventDefault(); e.stopPropagation();
      presentationState.index = 0; renderPresentationSlide_(); warmNearbySlides_(); return;
    }
    if (key === 'End') {
      e.preventDefault(); e.stopPropagation();
      presentationState.index = presentationState.items.length - 1; renderPresentationSlide_(); warmNearbySlides_(); return;
    }
    if (key === 'f' || key === 'F') {
      e.preventDefault(); e.stopPropagation(); togglePresentationFullscreen_(); return;
    }
    if (key === 's' || key === 'S') {
      e.preventDefault(); e.stopPropagation();
      const btn = getEl('presentationStage') && getEl('presentationStage').querySelector('[data-pres-updates]');
      if (btn) presentationToggleUpdates_(presentationState.items[presentationState.index].row, btn);
      return;
    }
    if (key === '?') {
      e.preventDefault(); e.stopPropagation();
      showToast('←/→ navigate · Space next · Home/End first/last · F fullscreen · S submissions · C complete · Esc exit', 'info');
      return;
    }
    if (key === 'c' || key === 'C') {
      e.preventDefault(); e.stopPropagation();
      const item = presentationState.items[presentationState.index];
      if (item && appState.isAdmin && item.reviewStatus !== 'done') presentationMarkDone_(item.row);
      return;
    }
  };
}

/* Ctrl/Cmd+Shift+P toggles Presentation Mode. Only fires when not typing and
   not already handled by another dialog. Registered once at module load. */
function getPresentationToggle_() {
  return function (e) {
    const mod = e.ctrlKey || e.metaKey;
    if (!(mod && e.shiftKey && (e.key === 'P' || e.key === 'p'))) return;
    const target = e.target;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
    if (typing) return;
    e.preventDefault();
    e.stopPropagation();
    togglePresentationMode();
  };
}

function togglePresentationFullscreen_() {
  const overlay = getEl('presentationOverlay');
  if (!overlay) return;
  if (document.fullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
    return;
  }
  if (overlay.requestFullscreen) {
    overlay.requestFullscreen().catch(function () { showToast('Fullscreen is not available in this browser.', 'warning'); });
  } else {
    showToast('Fullscreen is not available in this browser.', 'warning');
  }
}

function wirePresentationEvents_() {
  document.addEventListener('keydown', getPresentationKeydown_(), true);
  document.addEventListener('keydown', getPresentationToggle_(), true);

  ['presentationPrevBtn', 'presentationNextBtn', 'presentationExitBtn', 'presentationFullscreenBtn'].forEach(function (id) {
    const btn = getEl(id);
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (id === 'presentationPrevBtn') presentationPrev_();
      else if (id === 'presentationNextBtn') presentationNext_();
      else if (id === 'presentationFullscreenBtn') togglePresentationFullscreen_();
      else exitPresentationMode();
    });
  });
}

/* ---- Touch swipe (left → next, right → prev) ---- */
function wirePresentationTouch_() {
  const overlay = getEl('presentationOverlay');
  if (!overlay || overlay.getAttribute('data-pres-touch-wired')) return;
  overlay.setAttribute('data-pres-touch-wired', '1');

  overlay.addEventListener('touchstart', function (e) {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    presentationState.touchStartX = t.clientX;
    presentationState.touchStartY = t.clientY;
    presentationState.touchTarget = e.target;
  }, { passive: true });

  overlay.addEventListener('touchend', function (e) {
    if (!presentationState.active) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - presentationState.touchStartX;
    const dy = t.clientY - presentationState.touchStartY;
    // Ignore taps, vertical scrolls, and touches inside interactive elements.
    const el = presentationState.touchTarget;
    if (el && el.closest && el.closest('button, a, iframe, input, textarea, select, [data-pres-updates], .card-updates')) return;
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dy) > Math.abs(dx) * 1.2) return;
    if (dx < 0) presentationNext_();
    else presentationPrev_();
  }, { passive: true });
}

/* ---- Links ---- */

function presentationLinksHtml_(item) {
  const links = (item && item.linkUrls) || {};
  const keys = Object.keys(links);
  if (!keys.length) return '';
  let html = '<div class="presentation-links">';
  keys.forEach(function (key) {
    const url = String(links[key] || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) return;
    const text = (item.linkTexts && item.linkTexts[key]) || key;
    html += '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" data-embed class="presentation-link">' + escapeHtml(text) + '</a><br>';
  });
  html += '</div>';
  return html;
}

/* ---- Link preloading / buffering ---- */
/* Warm the URL the popup actually loads (toEmbeddableUrl). A small state
   machine keeps URLs from disappearing at the concurrency cap, retries
   transient failures twice, and uses a generation token so late iframe
   events after exit cannot mutate the current presentation. */
function warmPresentationLinks_(targets) {
  if (!presentationState.active) return;
  const now = Date.now();
  const urls = [];

  targets.forEach(function (item) {
    const links = (item && item.linkUrls) || {};
    Object.keys(links).forEach(function (k) {
      const raw = String(links[k] || '').trim();
      if (!/^https?:\/\//i.test(raw)) return;
      let target = raw;
      try { target = (typeof toEmbeddableUrl === 'function' && toEmbeddableUrl(raw)) || raw; } catch (err) {}
      const state = presentationWarm.status[target];
      if (state === 'loading' || state === 'ready' || state === 'queued') return;
      if (state === 'failed' && (presentationWarm.retryAt[target] || 0) > now) return;
      presentationWarm.status[target] = 'queued';
      urls.push(target);
    });
  });

  urls.forEach(function (target) {
    warmPresentationOrigin_(target);
    presentationWarm.queue.push(target);
  });
  pumpPresentationWarm_();
}

function pumpPresentationWarm_() {
  if (!presentationState.active) return;
  while (presentationWarm.inflight < presentationWarm.MAX_CONCURRENCY && presentationWarm.queue.length) {
    const url = presentationWarm.queue.shift();
    if (presentationWarm.status[url] !== 'queued') continue;
    if ((presentationWarm.retryAt[url] || 0) > Date.now()) {
      presentationWarm.queue.push(url);
      break;
    }
    warmPresentationUrl_(url);
  }
}

function schedulePresentationRetry_(url, generation) {
  if (!presentationState.active || generation !== presentationWarm.generation) return;
  const used = presentationWarm.retryCount[url] || 0;
  if (used >= presentationWarm.MAX_RETRIES) {
    presentationWarm.status[url] = 'failed';
    return;
  }
  presentationWarm.retryCount[url] = used + 1;
  const delay = presentationWarm.RETRY_BASE_MS * Math.pow(2, used);
  presentationWarm.retryAt[url] = Date.now() + delay;
  presentationWarm.status[url] = 'failed';
  setTimeout(function () {
    if (!presentationState.active || generation !== presentationWarm.generation) return;
    if ((presentationWarm.retryAt[url] || 0) > Date.now()) return;
    if (presentationWarm.status[url] !== 'failed') return;
    presentationWarm.status[url] = 'queued';
    presentationWarm.queue.push(url);
    pumpPresentationWarm_();
  }, delay);
}

function warmPresentationUrl_(url) {
  if (!presentationState.active) return;
  const generation = presentationWarm.generation;
  presentationWarm.inflight++;
  presentationWarm.status[url] = 'loading';

  const holder = document.createElement('div');
  holder.setAttribute('data-pres-warm-frame', '1');
  holder.className = 'pres-warm-frame';
  const frame = document.createElement('iframe');
  frame.setAttribute('data-pres-warm-url', url);
  frame.setAttribute('loading', 'eager');
  frame.setAttribute('aria-hidden', 'true');
  holder.appendChild(frame);
  document.body.appendChild(holder);

  let finished = false;
  let timer = null;

  const finishWarm_ = function (keepHolder, ready) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);

    if (generation !== presentationWarm.generation || !presentationState.active || !keepHolder) {
      try { if (holder.parentNode) holder.parentNode.removeChild(holder); } catch (err) {}
    }

    presentationWarm.inflight = Math.max(0, presentationWarm.inflight - 1);
    if (generation === presentationWarm.generation && presentationState.active) {
      if (ready) {
        presentationWarm.status[url] = 'ready';
        presentationWarm.retryAt[url] = 0;
        presentationWarm.frames[url] = { node: holder, frame: frame, ready: true };
      } else {
        schedulePresentationRetry_(url, generation);
      }
      pumpPresentationWarm_();
    }
  };

  timer = setTimeout(function () {
    finishWarm_(false, false);
  }, presentationWarm.TIMEOUT_MS);

  frame.addEventListener('load', function () {
    finishWarm_(true, true);
  });
  frame.addEventListener('error', function () {
    finishWarm_(false, false);
  });

  frame.src = url;
}

function warmPresentationOrigin_(url) {
  try {
    const target = (typeof toEmbeddableUrl === 'function' && toEmbeddableUrl(url)) || url;
    const origin = new URL(target, window.location.href).origin;
    if (presentationWarm.seenOrigins[origin]) return;
    presentationWarm.seenOrigins[origin] = true;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.setAttribute('data-pres-warm', '1');
    document.head.appendChild(link);
  } catch (err) { /* malformed URL — ignore */ }
}

function removePresentationPreconnects_() {
  document.querySelectorAll('link[data-pres-warm]').forEach(function (l) { l.parentNode && l.parentNode.removeChild(l); });
  presentationWarm.seenOrigins = {};
}

wirePresentationEvents_();/* ============================================================
 * Dash Workspace 2.0 — Global Search, Attention Center,
 * Executive Snapshot, Dash AI and Mobile Operating Mode.
 * Client-side orchestration layer; reuses existing APIs/UI.
 * ============================================================ */

var WORKSPACE_SEARCH_GEN = 0;
var WORKSPACE_SEARCH_TIMER = null;
var WORKSPACE_SEARCH_CACHE = { tasks: null, users: null, submissions: null, documents: null };
var WORKSPACE_MOBILE_KEY = 'dash_mobile_mode_v1';

function workspaceEnsureUi_() {
  if (!getEl('globalSearchModal')) {
    var s = document.createElement('div');
    s.id = 'globalSearchModal';
    s.className = 'modal-backdrop hidden workspace-search-modal';
    s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true');
    s.innerHTML = '<div class="modal-card workspace-search-card">' +
      '<div class="workspace-search-head"><div><h3 class="text-subheading">Global Search</h3><p class="section-copy">Find records, tasks, meetings, submissions, people and documents.</p></div><button class="icon-btn" type="button" onclick="closeGlobalSearch()" aria-label="Close search">×</button></div>' +
      '<div class="workspace-search-input-wrap"><span aria-hidden="true">⌕</span><input id="globalSearchInput" class="input workspace-search-input" type="search" placeholder="Search anything in Dash…" autocomplete="off" aria-label="Search anything in Dash"><kbd>Ctrl /</kbd></div>' +
      '<div id="globalSearchFilters" class="workspace-search-filters"><button class="btn btn-ghost btn-small active" data-filter="all" onclick="setGlobalSearchFilter(\'all\')">All</button><button class="btn btn-ghost btn-small" data-filter="record" onclick="setGlobalSearchFilter(\'record\')">Records</button><button class="btn btn-ghost btn-small" data-filter="task" onclick="setGlobalSearchFilter(\'task\')">Tasks</button><button class="btn btn-ghost btn-small" data-filter="submission" onclick="setGlobalSearchFilter(\'submission\')">Submissions</button><button class="btn btn-ghost btn-small" data-filter="user" onclick="setGlobalSearchFilter(\'user\')">People</button><button class="btn btn-ghost btn-small" data-filter="document" onclick="setGlobalSearchFilter(\'document\')">Documents</button></div>' +
      '<div id="globalSearchResults" class="workspace-search-results"></div>' +
      '<div class="workspace-search-foot"><span>↑ ↓ navigate · Enter open · Esc close</span><button class="btn btn-ghost btn-small" type="button" onclick="clearGlobalSearch()">Clear</button></div>' +
      '</div>';
    document.body.appendChild(s);
  }
  if (!getEl('attentionModal')) {
    var a = document.createElement('div');
    a.id = 'attentionModal'; a.className = 'modal-backdrop hidden'; a.setAttribute('role','dialog'); a.setAttribute('aria-modal','true');
    a.innerHTML = '<div class="modal-card workspace-attention-card"><div class="modal-header"><div><h3 class="text-subheading">Attention Center</h3><p class="section-copy">Everything currently asking for action.</p></div><button class="icon-btn" type="button" onclick="closeAttentionCenter()" aria-label="Close">×</button></div><div id="attentionBody"></div></div>';
    document.body.appendChild(a);
  }
  if (!getEl('aiAssistantModal')) {
    var ai = document.createElement('div');
    ai.id = 'aiAssistantModal'; ai.className = 'modal-backdrop hidden'; ai.setAttribute('role','dialog'); ai.setAttribute('aria-modal','true');
    ai.innerHTML = '<div class="modal-card workspace-ai-card"><div class="modal-header"><div><h3 class="text-subheading">Dash AI</h3><p class="section-copy">Ask questions about your current dashboard context. AI answers should be verified before acting.</p></div><button class="icon-btn" type="button" onclick="closeDashAi()" aria-label="Close">×</button></div><div class="workspace-ai-suggestions"><button class="btn btn-ghost btn-small" onclick="askDashAiPreset(\'What needs my attention today?\')">What needs my attention?</button><button class="btn btn-ghost btn-small" onclick="askDashAiPreset(\'Summarize the current dashboard workload.\')">Summarize workload</button><button class="btn btn-ghost btn-small" onclick="askDashAiPreset(\'What review risks should I look at first?\')">Review risks</button></div><div id="dashAiMessages" class="workspace-ai-messages"></div><div class="workspace-ai-input"><textarea id="dashAiInput" rows="2" maxlength="1000" placeholder="Ask Dash AI…" aria-label="Ask Dash AI"></textarea><button class="btn btn-primary" type="button" onclick="askDashAi()">Ask</button></div><div class="workspace-ai-note">AI-generated · do not treat as an authoritative record.</div></div>';
    document.body.appendChild(ai);
  }
}

function handleWorkspaceSearchInput_(value) { openGlobalSearch(value); var i=getEl('globalSearchInput'); if(i){i.value=String(value||''); renderGlobalSearch_(String(value||''));} }

function openGlobalSearch(initial) {
  workspaceEnsureUi_();
  openDialog('globalSearchModal');
  var input = getEl('globalSearchInput');
  if (input) { input.value = String(initial || ''); input.focus(); if (input.value) input.select(); }
  if (!initial) renderGlobalSearch_(''); else runGlobalSearch_(String(initial));
}
function closeGlobalSearch() { closeDialog('globalSearchModal'); }
function clearGlobalSearch() { var i=getEl('globalSearchInput'); if(i){i.value='';i.focus();} renderGlobalSearch_(''); }

var WORKSPACE_SEARCH_FILTER = 'all';
function setGlobalSearchFilter(filter) {
  WORKSPACE_SEARCH_FILTER = filter || 'all';
  document.querySelectorAll('#globalSearchFilters [data-filter]').forEach(function(b){b.classList.toggle('active', b.getAttribute('data-filter')===WORKSPACE_SEARCH_FILTER);});
  var i=getEl('globalSearchInput'); renderGlobalSearch_(i ? i.value : '');
}
function workspaceSearchText_(x) { return [x.id,x.row,x.title,x.name,x.username,x.email,x.sector,x.description,x.action,x.responsibility,x.status,x.type,x.filename,x.name].filter(Boolean).join(' '); }
function workspaceSearchMatch_(q, text) { if (!q) return true; return fuzzyMatch_(q.toLowerCase(), String(text||'').toLowerCase()); }
function workspaceHighlight_(text, q) { var s=escapeHtml(String(text||'')); if(!q) return s; var safe=String(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); try{return s.replace(new RegExp('('+safe+')','ig'),'<mark>$1</mark>');}catch(e){return s;} }

function renderGlobalSearch_(query) {
  var list=getEl('globalSearchResults'); if(!list) return;
  var q=String(query||'').trim();
  if(q.length<2){ list.innerHTML='<div class="workspace-search-empty"><strong>Search across Dash</strong><span>Try a record number, sector, task title, person or document name.</span></div>'; return; }
  if(WORKSPACE_SEARCH_TIMER) clearTimeout(WORKSPACE_SEARCH_TIMER);
  var gen=++WORKSPACE_SEARCH_GEN;
  list.innerHTML='<div class="workspace-search-loading"><span class="spinner"></span> Searching…</div>';
  WORKSPACE_SEARCH_TIMER=setTimeout(function(){runGlobalSearch_(q,gen);},140);
}
function workspaceFetch_(key, fn) { if(WORKSPACE_SEARCH_CACHE[key]) return Promise.resolve(WORKSPACE_SEARCH_CACHE[key]); return fn().then(function(v){WORKSPACE_SEARCH_CACHE[key]=v||[];return WORKSPACE_SEARCH_CACHE[key];}).catch(function(){return [];}); }
function runGlobalSearch_(query, expectedGen) {
  var q=String(query||'').trim(); if(q.length<2){renderGlobalSearch_(q);return;}
  var gen=expectedGen || ++WORKSPACE_SEARCH_GEN;
  Promise.all([
    Promise.resolve(appState.items||[]),
    workspaceFetch_('tasks',function(){return ApiService.getMyTasks();}),
    workspaceFetch_('users',function(){return ApiService.getAssignableUsers();}),
    workspaceFetch_('submissions',function(){return ApiService.getSubmissions();}),
    workspaceFetch_('documents',function(){return ApiService.getDocuments();})
  ]).then(function(all){ if(gen!==WORKSPACE_SEARCH_GEN)return; var types=[
    {type:'record',label:'Records',items:all[0],map:function(x){return {key:'record-'+x.row,title:'Record #'+x.id+' — '+(x.sector||''),meta:x.description||x.action||'',open:function(){closeGlobalSearch();openRecordDetail(x.row);}};}},
    {type:'task',label:'Tasks',items:all[1],map:function(x){return {key:'task-'+(x.id||x.row),title:x.title||'Task',meta:(x.status||'')+(x.dueDate?' · '+formatDate(x.dueDate):''),open:function(){closeGlobalSearch();openTab('tasks');}};}},
    {type:'submission',label:'Submissions',items:all[3],map:function(x){return {key:'submission-'+(x.id||x.row||x.cardRow),title:'Submission '+(x.id||x.row||''),meta:x.subject||x.title||x.description||'',open:function(){closeGlobalSearch();openSubmissionsModal(x.cardRow||x.row,x.id||'');}};}},
    {type:'user',label:'People',items:all[2],map:function(x){return {key:'user-'+(x.email||x.username),title:x.name||x.username||x.email||'User',meta:x.email||x.username||'',open:function(){closeGlobalSearch();showToast('User: '+(x.email||x.username||x.name),'info');}};}},
    {type:'document',label:'Documents',items:all[4],map:function(x){return {key:'document-'+(x.id||x.name||x.filename),title:x.name||x.filename||'Document',meta:x.mimeType||x.type||'',open:function(){closeGlobalSearch(); if(x.url)openLinkPreview(x.url,x.name||x.filename||'Document'); else showToast('Document found but no preview link is available.','info');}};}}
  ];
  var html='', results=[]; types.forEach(function(t){ if(WORKSPACE_SEARCH_FILTER!=='all'&&WORKSPACE_SEARCH_FILTER!==t.type)return; var matches=(t.items||[]).filter(function(x){return workspaceSearchMatch_(q,workspaceSearchText_(x));}).slice(0,8).map(t.map); if(!matches.length)return; html+='<div class="workspace-search-group"><div class="workspace-search-group-title">'+t.label+' <span>'+matches.length+'</span></div>'; matches.forEach(function(r){var idx=results.length;results.push(r);html+='<button class="workspace-search-result" type="button" data-search-index="'+idx+'"><span><strong>'+workspaceHighlight_(r.title,q)+'</strong><small>'+workspaceHighlight_(r.meta,q)+'</small></span><kbd>Enter</kbd></button>';});html+='</div>';});
  if(!html)html='<div class="workspace-search-empty"><strong>No matches</strong><span>Try a broader search or another category.</span></div>';
  list.innerHTML=html; list.querySelectorAll('[data-search-index]').forEach(function(b){b.addEventListener('click',function(){var r=results[Number(b.getAttribute('data-search-index'))];if(r)r.open();});});
  });
}

function openAttentionCenter() {
  workspaceEnsureUi_(); openDialog('attentionModal'); renderAttentionCenter_();
}
function closeAttentionCenter(){closeDialog('attentionModal');}
function renderAttentionCenter_(){
  var body=getEl('attentionBody'); if(!body)return;
  var items=appState.items||[], now=new Date(), today=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  var reviews=items.filter(function(i){return i.reviewStatus==='due';}).map(function(i){var d=parseDateFieldValue(i.reviewDate);var overdue=!d||d.getTime()<today;return {kind:'review',rank:overdue?100:70,title:'#'+i.id+' — '+(i.sector||'Review'),meta:overdue?'Overdue review':'Review due',open:function(){closeAttentionCenter();openRecordDetail(i.row);}};});
  var tasks=(appState.tasks||[]).filter(function(t){return t.status!=='DONE'&&t.status!=='CANCELLED';}).map(function(t){var due=t.dueDate?new Date(t.dueDate).getTime():Infinity;var overdue=due<today;return {kind:'task',rank:overdue?95:60,title:t.title||'Task',meta:overdue?'Overdue task':(t.dueDate?'Due '+formatDate(t.dueDate):'Open task'),open:function(){closeAttentionCenter();openTab('tasks');}};});
  var notifs=((appState.notifications||{}).recent||[]).filter(function(n){return !n.readAt;}).map(function(n){return {kind:'notification',rank:Number(n.priority)>=1?90:50,title:n.title||'Notification',meta:n.body||'',open:function(){closeAttentionCenter();openNotification(n.id,n.type);}};});
  var subs=Object.keys(appState.submissionFlash||{}).filter(function(k){return appState.submissionFlash[k];}).map(function(k){var row=Number(k),item=items.find(function(i){return Number(i.row)===row;});return item?{kind:'submission',rank:55,title:(item.sector||'Submission')+' — #'+item.id,meta:'Unread submission',open:function(){closeAttentionCenter();openSubmissionsModal(row,item.id);}}:null;}).filter(Boolean);
  var all=reviews.concat(tasks,notifs,subs).sort(function(a,b){return b.rank-a.rank;}).slice(0,20);
  var html='<div class="workspace-attention-summary"><strong>'+all.length+'</strong><span>items currently needing attention</span><button class="btn btn-ghost btn-small" onclick="renderAttentionCenter_()">Refresh</button></div>';
  if(!all.length)html+='<div class="workspace-search-empty"><strong>All clear</strong><span>No urgent reviews, open tasks, unread notifications or unread submissions were found.</span></div>';
  else html+='<div class="workspace-attention-list">'+all.map(function(x){return '<button class="workspace-attention-item" type="button"><span class="workspace-attention-dot '+x.kind+'"></span><span><strong>'+escapeHtml(x.title)+'</strong><small>'+escapeHtml(x.meta)+'</small></span><span>›</span></button>';}).join('')+'</div>';
  body.innerHTML=html; body.querySelectorAll('.workspace-attention-item').forEach(function(b,i){b.addEventListener('click',function(){all[i].open();});});
}

function renderExecutiveSnapshot(){
  var host=getEl('analyticsExecutiveSnapshot'); if(!host)return;
  var s=appState.summary||{}, items=appState.items||[], notifications=(appState.notifications||{}).unread||0;
  var due=items.filter(function(i){return i.reviewStatus==='due';}).length;
  var flagged=items.filter(function(i){return i.flagged;}).length;
  var trend=(appState.analytics&&appState.analytics.trend)||[]; var month=trend.length?trend[trend.length-1].value:0;
  var score=Math.max(0,Math.min(100,Math.round(((Number(s.total||0)-due)/Math.max(1,Number(s.total||0)))*100)));
  host.innerHTML='<div class="workspace-exec-head"><div><div class="workspace-exec-kicker">EXECUTIVE SNAPSHOT</div><h3>Operational pulse</h3><p>High-level view of workload, review exposure and attention signals.</p></div><div class="workspace-exec-actions"><button class="btn btn-secondary btn-small" onclick="openAttentionCenter()">Attention</button><button class="btn btn-primary btn-small" onclick="openDashAi()">Ask Dash AI</button></div></div><div class="workspace-exec-grid">'+
    [['Records',s.total||0,'Current records'],['Review due',due,'Needs review'],['Flagged',flagged,'Marked for attention'],['Unread',notifications,'Notifications'],['New this month',month,'Recent intake']].map(function(c){return '<div class="workspace-exec-kpi"><span>'+escapeHtml(String(c[0]))+'</span><strong>'+Number(c[1]||0).toLocaleString()+'</strong><small>'+escapeHtml(c[2])+'</small></div>';}).join('')+
    '</div><div class="workspace-exec-health"><div><span>Operational health</span><strong>'+score+'%</strong></div><div class="workspace-exec-track"><span style="width:'+score+'%"></span></div></div>';
}

function openDashAi(){ workspaceEnsureUi_(); openDialog('aiAssistantModal'); var input=getEl('dashAiInput'); if(input)input.focus(); if(!getEl('dashAiMessages').children.length) addDashAiMessage_('assistant','I can summarize the current dashboard, surface risks, or help you decide what to look at next.'); }
function closeDashAi(){closeDialog('aiAssistantModal');}
function askDashAiPreset(q){var i=getEl('dashAiInput');if(i)i.value=q;askDashAi();}
function addDashAiMessage_(role,text){var box=getEl('dashAiMessages');if(!box)return;var d=document.createElement('div');d.className='workspace-ai-message '+role;d.innerHTML='<span class="workspace-ai-role">'+(role==='assistant'?'Dash AI':'You')+'</span><div>'+escapeHtml(text)+'</div>';box.appendChild(d);box.scrollTop=box.scrollHeight;}
function buildDashAiContext_(){
  var items=(appState.items||[]).slice(0,120).map(function(i){return '#'+i.id+' | '+(i.sector||'')+' | '+(i.description||'').slice(0,180)+' | review '+(i.reviewDate||'')+' | '+(i.reviewStatus||'');}).join('\n');
  var s=appState.summary||{}; return 'Summary: total='+Number(s.total||0)+', reviewDue='+Number(s.flagged||0)+', normal='+Number(s.normal||0)+'.\nRecords:\n'+items;
}
function askDashAi(){
  var input=getEl('dashAiInput'); if(!input)return; var q=input.value.trim(); if(!q)return;
  addDashAiMessage_('user',q); input.value=''; var box=getEl('dashAiMessages'); var loading=document.createElement('div');loading.className='workspace-ai-message assistant workspace-ai-loading';loading.textContent='Thinking…';box.appendChild(loading);box.scrollTop=box.scrollHeight;
  if(!ApiService.askDashboardAi){loading.textContent='Dash AI is not available in this build.';return;}
  ApiService.askDashboardAi(q,buildDashAiContext_()).then(function(r){loading.remove();addDashAiMessage_('assistant',r&&r.success?r.text||r.answer||r.insights||'No answer returned.':(r&&r.message)||'AI could not answer right now.');}).catch(function(e){loading.remove();addDashAiMessage_('assistant','AI request failed: '+(e&&e.message?e.message:'Please try again.'));});
}

function toggleMobileOperatingMode(force){
  var next=typeof force==='boolean'?force:!document.body.classList.contains('mobile-operating-mode');
  document.body.classList.toggle('mobile-operating-mode',next); try{localStorage.setItem(WORKSPACE_MOBILE_KEY,next?'1':'0');}catch(e){}
  showToast(next?'Mobile operating mode enabled':'Mobile operating mode disabled','info');
}
function isMobileOperatingMode(){return document.body.classList.contains('mobile-operating-mode');}

function initWorkspaceFeatures(){
  workspaceEnsureUi_();
  if (typeof COMMAND_ACTIONS !== 'undefined') {
    var extras = [
      { key:'global-search', label:'Global Search', subtitle:'Search records, tasks, people and documents', shortcut:'Ctrl /', action:function(){closeCommandPalette();openGlobalSearch();} },
      { key:'attention-center', label:'Open Attention Center', subtitle:'See everything currently asking for action', shortcut:'', action:function(){closeCommandPalette();openAttentionCenter();} },
      { key:'executive-snapshot', label:'Executive Snapshot', subtitle:'Open the operational analytics view', shortcut:'', action:function(){closeCommandPalette();openTab('analytics');} },
      { key:'dash-ai', label:'Ask Dash AI', subtitle:'Ask a question about current dashboard context', shortcut:'', action:function(){closeCommandPalette();openDashAi();} },
      { key:'mobile-mode', label:'Toggle Mobile Operating Mode', subtitle:'Compact touch-first workspace layout', shortcut:'', action:function(){closeCommandPalette();toggleMobileOperatingMode();} }
    ];
    extras.forEach(function(x){ if(!COMMAND_ACTIONS.some(function(a){return a.key===x.key;})) COMMAND_ACTIONS.unshift(x); });
  }
  try{if(localStorage.getItem(WORKSPACE_MOBILE_KEY)==='1')document.body.classList.add('mobile-operating-mode');}catch(e){}
  var top=getEl('searchInput'); if(top){top.addEventListener('focus',function(){openGlobalSearch(top.value);});top.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();openGlobalSearch(top.value);}});}
  var aiBtn=document.createElement('button');aiBtn.className='icon-btn workspace-top-action';aiBtn.type='button';aiBtn.title='Ask Dash AI';aiBtn.setAttribute('aria-label','Ask Dash AI');aiBtn.innerHTML='✦';aiBtn.onclick=openDashAi;var actions=document.querySelector('.topbar-actions');if(actions)actions.insertBefore(aiBtn,actions.firstChild);
  var attBtn=document.createElement('button');attBtn.className='icon-btn workspace-top-action';attBtn.type='button';attBtn.title='Attention Center';attBtn.setAttribute('aria-label','Attention Center');attBtn.innerHTML='!';attBtn.onclick=openAttentionCenter;if(actions)actions.insertBefore(attBtn,actions.firstChild);
  document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='/'){e.preventDefault();openGlobalSearch();}if(e.key==='?'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='TEXTAREA'){openCommandPalette('?');}});
  var list=getEl('globalSearchResults');
  document.addEventListener('keydown',function(e){var modal=getEl('globalSearchModal');if(!modal||modal.classList.contains('hidden'))return;if(e.key==='Escape'){closeGlobalSearch();return;}if(e.key==='Enter'&&document.activeElement===getEl('globalSearchInput')){var first=list&&list.querySelector('[data-search-index="0"]');if(first)first.click();}});
  if(typeof renderExecutiveSnapshot==='function')setTimeout(renderExecutiveSnapshot,300);
}

/* Hook dashboard analytics without replacing its implementation. */
var _workspaceOriginalRenderAnalytics = null;
function installWorkspaceAnalyticsHook(){
  if(_workspaceOriginalRenderAnalytics||typeof renderAnalytics!=='function')return;
  _workspaceOriginalRenderAnalytics=renderAnalytics;
  renderAnalytics=function(){_workspaceOriginalRenderAnalytics();renderExecutiveSnapshot();};
}

/* ============================================================
 * Dash Workspace 3.0 — Targets 8–12
 * Smart Attention, Analytics 2.0, Automation Engine and Reliability/Security.
 * ============================================================ */
var DASHOPS_ANALYTICS_CACHE = null;
var DASHOPS_ANALYTICS_GEN = 0;
var DASHOPS_RULES = [];

function dashOpsEnsureUi_() {
  if (getEl('dashOpsAnalyticsModal')) return;
  var a=document.createElement('div'); a.id='dashOpsAnalyticsModal'; a.className='modal-backdrop hidden';
  a.innerHTML='<div class="modal-card workspace-ops-card"><div class="modal-header"><div><h3 class="text-subheading">Analytics 2.0</h3><p class="section-copy">Workload, completion, submissions and review trends.</p></div><button class="icon-btn" onclick="closeDialog(\'dashOpsAnalyticsModal\')">×</button></div><div class="workspace-ops-toolbar"><button class="btn btn-ghost btn-small" onclick="loadDashOpsAnalytics(7)">7 days</button><button class="btn btn-ghost btn-small" onclick="loadDashOpsAnalytics(30)">30 days</button><button class="btn btn-ghost btn-small" onclick="loadDashOpsAnalytics(90)">90 days</button><button class="btn btn-secondary btn-small" onclick="exportDashOpsAnalytics()">Export CSV</button></div><div id="dashOpsAnalyticsBody" class="workspace-ops-body"><div class="workspace-search-empty">Loading analytics…</div></div></div>';
  document.body.appendChild(a);
  var r=document.createElement('div'); r.id='dashOpsAutomationModal'; r.className='modal-backdrop hidden';
  r.innerHTML='<div class="modal-card workspace-ops-card"><div class="modal-header"><div><h3 class="text-subheading">Automation Engine</h3><p class="section-copy">IF → THEN rules with safe, notification-first actions.</p></div><button class="icon-btn" onclick="closeDialog(\'dashOpsAutomationModal\')">×</button></div><div id="dashOpsAutomationBody" class="workspace-ops-body"></div></div>';
  document.body.appendChild(r);
  var s=document.createElement('div'); s.id='dashOpsSecurityModal'; s.className='modal-backdrop hidden';
  s.innerHTML='<div class="modal-card workspace-ops-card"><div class="modal-header"><div><h3 class="text-subheading">Reliability & Security</h3><p class="section-copy">Session, database and offline-operation status.</p></div><button class="icon-btn" onclick="closeDialog(\'dashOpsSecurityModal\')">×</button></div><div id="dashOpsSecurityBody" class="workspace-ops-body"></div></div>';
  document.body.appendChild(s);
}
function openDashOpsAnalytics(){dashOpsEnsureUi_();openDialog('dashOpsAnalyticsModal');loadDashOpsAnalytics(30);}
function loadDashOpsAnalytics(days){
  var gen=++DASHOPS_ANALYTICS_GEN, host=getEl('dashOpsAnalyticsBody'); if(host)host.innerHTML='<div class="workspace-search-empty">Loading analytics…</div>';
  return ApiService.getAnalytics({days:days}).then(function(d){if(gen!==DASHOPS_ANALYTICS_GEN)return;DASHOPS_ANALYTICS_CACHE=d;renderDashOpsAnalytics_(d);}).catch(function(e){if(host)host.innerHTML='<div class="workspace-search-empty">Analytics unavailable: '+escapeHtml(e.message||String(e))+'</div>';});
}
function renderDashOpsAnalytics_(d){
  var h=getEl('dashOpsAnalyticsBody'); if(!h)return; var k=d.kpis||{},tr=d.trends||[];
  var max=Math.max.apply(null,tr.map(function(x){return Math.max(x.records||0,x.submissions||0,x.tasksCompleted||0);}).concat([1]));
  h.innerHTML='<div class="workspace-exec-grid">'+[['Records',k.records],['Reviews due',k.reviewsDue],['Overdue tasks',k.overdueTasks],['Open tasks',k.openTasks],['Submissions',k.submissionsInRange],['Task turnaround',String(k.avgTaskTurnaroundHours||0)+'h']].map(function(x){return '<div class="workspace-exec-kpi"><span>'+escapeHtml(x[0])+'</span><strong>'+escapeHtml(String(x[1]||0))+'</strong><small>Current window</small></div>';}).join('')+'</div><div class="workspace-trend-list">'+tr.map(function(x){var total=(x.records||0)+(x.submissions||0)+(x.tasksCompleted||0);return '<div class="workspace-trend-row"><span>'+escapeHtml(x.date)+'</span><div class="workspace-trend-bar"><i style="width:'+Math.round((total/max)*100)+'%"></i></div><small>'+total+'</small></div>';}).join('')+'</div>';
}
function exportDashOpsAnalytics(){
  if(!DASHOPS_ANALYTICS_CACHE){showToast('Load analytics first.','warning');return;}
  var rows=[['Date','Records','Submissions','Tasks completed','Notifications']].concat((DASHOPS_ANALYTICS_CACHE.trends||[]).map(function(x){return[x.date,x.records,x.submissions,x.tasksCompleted,x.notifications];}));
  var csv=rows.map(function(r){return r.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='dash-analytics-'+Date.now()+'.csv';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
}
function openDashAutomation(){dashOpsEnsureUi_();openDialog('dashOpsAutomationModal');loadDashAutomation();}
function loadDashAutomation(){return ApiService.listAutomationRules().then(function(r){DASHOPS_RULES=r.rules||[];renderDashAutomation_();});}
function renderDashAutomation_(){var h=getEl('dashOpsAutomationBody');if(!h)return;var rows=DASHOPS_RULES.map(function(r){return '<div class="workspace-rule-row"><div><strong>'+escapeHtml(r.name)+'</strong><small>IF '+escapeHtml(r.trigger)+' → '+escapeHtml(r.action)+'</small></div><label><input type="checkbox" '+(r.enabled?'checked':'')+' onchange="toggleDashRule(\''+escAttr(r.id)+'\',this.checked)"> Enabled</label><button class="btn btn-ghost btn-small" onclick="deleteDashRule(\''+escAttr(r.id)+'\')">Delete</button></div>';}).join('');
h.innerHTML='<div class="workspace-ops-toolbar"><button class="btn btn-primary btn-small" onclick="addDashRulePrompt()">Add rule</button><button class="btn btn-secondary btn-small" onclick="runDashAutomationNow()">Run scheduler now</button></div>'+(rows||'<div class="workspace-search-empty">No automation rules yet.</div>');}
function addDashRulePrompt(){var name=prompt('Rule name','Morning briefing');if(!name)return;var trigger=prompt('Trigger: SUBMISSION_CREATED, TASK_OVERDUE, REVIEW_DUE, MORNING_BRIEFING, REVIEW_COMPLETED','TASK_OVERDUE');if(!trigger)return;var action=prompt('Action: NOTIFY_SELF or NOTIFY_STAFF','NOTIFY_SELF');if(!action)return;ApiService.saveAutomationRule({name:name,trigger:trigger,action:action,enabled:true,config:{title:name,body:'Dash automation: '+name}}).then(loadDashAutomation).catch(function(e){showToast(e.message||String(e),'error');});}
function toggleDashRule(id,on){var r=DASHOPS_RULES.find(function(x){return x.id===id;});if(!r)return;r.enabled=!!on;ApiService.saveAutomationRule(r).then(loadDashAutomation);}
function deleteDashRule(id){if(!confirm('Delete this automation rule?'))return;ApiService.deleteAutomationRule(id).then(loadDashAutomation);}
function runDashAutomationNow(){ApiService.runAutomationNow().then(function(r){showToast('Automation checked: '+JSON.stringify(r),'success');}).catch(function(e){showToast(e.message||String(e),'error');});}
function openDashSecurity(){dashOpsEnsureUi_();openDialog('dashOpsSecurityModal');var h=getEl('dashOpsSecurityBody');h.innerHTML='<div class="workspace-search-empty">Loading security status…</div>';ApiService.getSecurityStatus().then(function(s){h.innerHTML='<div class="workspace-exec-grid">'+[['Signed-in user',s.admin],['Active sessions',s.sessions],['Users',s.users],['Audit rows',s.auditRows]].map(function(x){return '<div class="workspace-exec-kpi"><span>'+escapeHtml(x[0])+'</span><strong>'+escapeHtml(String(x[1]))+'</strong></div>';}).join('')+'</div><div class="workspace-ops-toolbar"><button class="btn btn-secondary btn-small" onclick="rotateDashSession()">Rotate session</button><span class="section-copy">API writes require trusted origins; sessions are server-side.</span></div>';}).catch(function(e){h.innerHTML='<div class="workspace-search-empty">'+escapeHtml(e.message||String(e))+'</div>';});}
function rotateDashSession(){ApiService.rotateSession().then(function(){showToast('Session rotated.','success');}).catch(function(e){showToast(e.message||String(e),'error');});}
function initDashOpsFeatures(){
  dashOpsEnsureUi_();
  var actions=document.querySelector('.topbar-actions'); if(!actions)return;
  if(!getEl('dashAnalyticsBtn')){var b=document.createElement('button');b.id='dashAnalyticsBtn';b.className='icon-btn workspace-top-action';b.title='Analytics 2.0';b.innerHTML='▥';b.onclick=openDashOpsAnalytics;actions.appendChild(b);}
  if(appState.isAdmin&&!getEl('dashAutomationBtn')){var a=document.createElement('button');a.id='dashAutomationBtn';a.className='icon-btn workspace-top-action';a.title='Automation Engine';a.innerHTML='⚙';a.onclick=openDashAutomation;actions.appendChild(a);var s=document.createElement('button');s.id='dashSecurityBtn';s.className='icon-btn workspace-top-action';s.title='Reliability & Security';s.innerHTML='✓';s.onclick=openDashSecurity;actions.appendChild(s);}
}
/* ---------------------------------- SSE real-time connection ---------------------------------- */
/* Connects to the server's GET /api/events SSE endpoint and listens for
   data-mutating events (recordChanged, submissionAdded, etc.). When an
   event arrives, the dashboard re-fetches data silently instead of waiting
   for the next auto-refresh tick. Reconnects automatically on close. */

var sseSource = null;
var sseRetryMs = 1000;
var sseMaxRetryMs = 30000;
var sseConnected = false;
var sseRetryBase = 1000;
var sseRetryFactor = 2;
var sseRetrySteps = [1000, 2000, 4000, 8000, 16000, 30000];
var sseRetryStepIndex = 0;

function connectSse() {
  if (sseSource) return; // already connected
  if (!appState.user || !appState.user.loggedIn) return; // not logged in
  if (typeof EventSource === 'undefined') return; // browser doesn't support SSE

  sseSource = new EventSource(API_URL.replace('/api', '/api/events'));

  sseSource.addEventListener('connected', function () {
    sseConnected = true;
    sseRetryStepIndex = 0; // reset backoff on successful connect
    sseRetryMs = sseRetrySteps[0];
    // Any events that were emitted while we were disconnected (or during the
    // reconnect handshake) are missed by this EventSource. Refresh data now so
    // the dashboard is never left stale, and mark the session healthy again.
    if (autoRefreshInFlight) return;
    autoRefreshTick();
    loadNotifications(true);
  });

  sseSource.addEventListener('dataChanged', function (e) {
    if (autoRefreshInFlight) return; // already refreshing
    autoRefreshTick();
  });

  sseSource.addEventListener('notificationChanged', function (e) {
    try { JSON.parse(e.data || '{}'); loadNotifications(true); if (typeof renderAttentionCenter_ === 'function') renderAttentionCenter_(); } catch (err) {}
  });

  sseSource.addEventListener('userLoggedIn', function () {
    // Another user logged in — not critical, just refresh if idle
    if (!autoRefreshInFlight) autoRefreshTick();
  });

  sseSource.onerror = function () {
    sseConnected = false;
    if (sseSource) { sseSource.close(); sseSource = null; }
    // Exponential backoff with jitter: 1s → 2s → 4s → 8s → 16s → 30s (capped).
    // Jitter spreads reconnects after mass disconnects so the server isn't
    // hit by a synchronized reconnect thundering herd.
    sseRetryStepIndex = Math.min(sseRetryStepIndex, sseRetrySteps.length - 1);
    var base = sseRetrySteps[sseRetryStepIndex] || sseMaxRetryMs;
    sseRetryMs = Math.floor(base * (0.5 + Math.random() * 0.5));
    if (sseRetryStepIndex < sseRetrySteps.length - 1) sseRetryStepIndex += 1;
    setTimeout(function () {
      if (appState.user && appState.user.loggedIn) connectSse();
    }, sseRetryMs);
  };
}

function disconnectSse() {
  if (sseSource) {
    sseSource.close();
    sseSource = null;
    sseConnected = false;
  }
}

/* ---------------------------------- Session auto-refresh ---------------------------------- */
/* The session token expires after 6 hours (SESSION_TTL_SECONDS). Instead of
   waiting for the user to get a 401 and be logged out, we silently refresh
   the token every 30 minutes by calling the refreshSession endpoint. This
   extends the server-side expiry by another 6 hours. */

var sessionRefreshTimerId = null;
var SESSION_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

function startSessionRefresh() {
  stopSessionRefresh();
  sessionRefreshTimerId = setInterval(function () {
    sessionRefreshTick();
  }, SESSION_REFRESH_INTERVAL_MS);
}

function stopSessionRefresh() {
  if (sessionRefreshTimerId) {
    clearInterval(sessionRefreshTimerId);
    sessionRefreshTimerId = null;
  }
}

function sessionRefreshTick() {
  if (!appState.user || !appState.user.loggedIn) return;
  ApiService.refreshSession().then(function (result) {
    if (!result || !result.success) {
      // Session expired or invalid — log out
      stopSessionRefresh();
      disconnectSse();
      showScreen('login');
      showToast('Session expired. Please log in again.', 'warning');
    }
    // success — session extended, nothing else to do
  }).catch(function () {
    // Network error — non-fatal, will retry next tick
  });
}

/* ---------------------------------- Keyboard shortcuts ---------------------------------- */
/* Global keyboard shortcuts for power users. All shortcuts use Ctrl/Cmd as
   the modifier to avoid conflicts with browser defaults and text input.

   Shortcuts:
     Ctrl+K     — Open command palette / focus search
     Ctrl+N     — New record (editor+)
     Ctrl+R     — Refresh dashboard data
     Ctrl+E     — Toggle edit mode (table/cards)
     Ctrl+1-6   — Switch tabs (1=Dashboard, 2=Analytics, 3=Audit, 4=Reports, 5=Tasks, 6=Settings)
     Ctrl+/     — Show keyboard shortcut help
     ?          — Show keyboard shortcut help (when not in input) */

function wireKeyboardShortcuts() {
  document.addEventListener('keydown', function (e) {
    var isInInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable;

    // Ctrl+K — Command palette (already in init.js, enhanced here)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      var input = getEl('searchInput');
      if (input) { input.focus(); input.select(); }
      return;
    }

    // Ctrl+N — New record (editor+ only)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
      if (appState.isEditor) {
        e.preventDefault();
        openEditModal(null);
      }
      return;
    }

    // Ctrl+R — Refresh (override browser refresh): burst the SW cache to
    // always load the latest dashboard version, else refresh data in place.
    if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      if (typeof window.refreshWithCacheBurst === 'function') window.refreshWithCacheBurst();
      else refreshData();
      return;
    }

    // Ctrl+E — Toggle view (cards/table)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault();
      var nextView = appState.dashboardView === 'cards' ? 'table' : 'cards';
      toggleDashboardView(nextView);
      return;
    }

    // Ctrl+1-6 — Switch tabs
    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
      var tabMap = { '1': 'dashboard', '2': 'analytics', '3': 'audit', '4': 'reports', '5': 'tasks', '6': 'settings' };
      var tabName = tabMap[e.key];
      if (tabName) {
        var navBtn = document.querySelector('.nav-item[data-tab="' + tabName + '"]');
        if (!navBtn || navBtn.classList.contains('hidden')) return;
        e.preventDefault();
        openTab(tabName);
      }
      return;
    }

    // Ctrl+/ — Show help
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      showShortcutHelp();
      return;
    }

    // ? — Show help (only when not typing in an input)
    if (!isInInput && e.key === '?' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      showShortcutHelp();
      return;
    }

    // Escape — close shortcuts help
    if (e.key === 'Escape') {
      var helpModal = getEl('shortcutsModal');
      if (helpModal && !helpModal.classList.contains('hidden')) {
        closeDialog('shortcutsModal');
      }
    }
  });
}

function showShortcutHelp() {
  var modal = getEl('shortcutsModal');
  if (!modal) {
    // Create the modal on first use
    var div = document.createElement('div');
    div.id = 'shortcutsModal';
    div.className = 'modal-backdrop hidden';
    div.innerHTML =
      '<div class="modal-card modal-card-sm" onclick="event.stopPropagation()">' +
      '<div class="modal-head"><h3>Keyboard Shortcuts</h3><button class="btn btn-ghost modal-close" onclick="closeDialog(\'shortcutsModal\')">&times;</button></div>' +
      '<div class="modal-body">' +
      '<table class="data-table" style="font-size:13px;">' +
      '<tbody>' +
      shortcutRow_('Ctrl+K', 'Open search / command palette') +
      shortcutRow_('Ctrl+N', 'New record (editor+)') +
      shortcutRow_('Ctrl+R', 'Refresh dashboard data') +
      shortcutRow_('Ctrl+E', 'Toggle card / table view') +
      shortcutRow_('Ctrl+1–6', 'Switch tabs (1=Dash, 2=Analytics, 3=Audit, 4=Reports, 5=Tasks, 6=Settings)') +
      shortcutRow_('Ctrl+/', 'Show this help') +
      shortcutRow_('?', 'Show this help') +
      shortcutRow_('Escape', 'Close dialogs and panels') +
      '</tbody></table>' +
      '</div>' +
      '</div>';
    div.addEventListener('click', function (e) {
      if (e.target === div) closeDialog('shortcutsModal');
    });
    document.body.appendChild(div);
    modal = div;
  }
  openDialog('shortcutsModal');
}

function shortcutRow_(keys, description) {
  return '<tr><td style="white-space:nowrap;font-weight:600;color:var(--accent,#2563eb);">' + escapeHtml(keys) + '</td><td>' + escapeHtml(description) + '</td></tr>';
}

/* ---------------------------------- Module init ---------------------------------- */
/* Called from init.js after login to wire up SSE, session refresh, and
   keyboard shortcuts. */

function initRealtime() {
  connectSse();
  startSessionRefresh();
  wireKeyboardShortcuts();
}

function teardownRealtime() {
  disconnectSse();
  stopSessionRefresh();
}

/* ---------------------------------- About ---------------------------------- */

function openAbout() {
  getEl('aboutVersion').textContent = APP_VERSION;
  // Build row shows the last update date (when the dashboard data was last
  // changed) rather than a hardcoded build string; falls back to APP_BUILD.
  getEl('aboutBuild').textContent = appState.lastUpdated || APP_BUILD;
  openDialog('aboutModal');
  getEl('profileDropdown').classList.remove('open');
}

function closeAbout() {
  closeDialog('aboutModal');
}

/* ---------------------------------- Offline ---------------------------------- */

function updateOfflineBanner() {
  const banner = getEl('offlineBanner');
  if (!banner) return;
  // Show the banner while offline, or whenever the offline queue has actions
  // that need attention (queued, syncing, failed, or conflicts) — even when
  // the connection is back. Failed mutations stay visible until retried or
  // removed so users never mistake them for synced.
  let attention = 0;
  if (window.OfflineQueue && window.OfflineQueue.status) {
    const s = window.OfflineQueue.status();
    attention = (s.queued || 0) + (s.syncing || 0) + (s.failed || 0) + (s.conflict || 0);
  }
  banner.classList.toggle('hidden', navigator.onLine && attention === 0);
}

/* ---------------------------------- Event wiring ---------------------------------- */

function wireGlobalEvents() {
  // Brand logos carry the name via aria-label on a role=img wrapper so the
  // inner (data-URI) image is decorative and can stay alt="".
  document.querySelectorAll('.brand-mark').forEach(function (el) {
    if (!el.hasAttribute('role')) el.setAttribute('role', 'img');
    el.querySelectorAll('img').forEach(function (img) { img.setAttribute('alt', ''); });
  });

  const searchInput = getEl('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(function () {
      if (typeof handleWorkspaceSearchInput_ === 'function') {
        handleWorkspaceSearchInput_(searchInput.value);
        return;
      }
      appState.searchQuery = searchInput.value.trim();
      updateFilterChips();
      renderDashboard();
    }, 180));
  }

  const notifList = getEl('notifList');
  if (notifList) {
    notifList.addEventListener('click', function (e) {
      const item = e.target.closest('.notif-item');
      if (!item) return;
      openNotification(item.getAttribute('data-notif-id'), item.getAttribute('data-notif-type'));
    });
  }

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      const palette = getEl('commandPalette');
      if (palette && !palette.classList.contains('hidden')) {
        const input = getEl('searchInput');
        if (input) { input.focus(); input.select(); }
      } else {
        openCommandPalette();
      }
    }
    if (e.key === 'Escape') {
      closeDropdowns();
      const profileDropdown = getEl('profileDropdown');
      if (profileDropdown && profileDropdown.classList.contains('open')) {
        profileDropdown.classList.remove('open');
        const trigger = getEl('profileTrigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
      closeNotificationsPanel();
      const confirmModal = getEl('confirmModal');
      if (confirmModal && !confirmModal.classList.contains('hidden')) {
        cancelConfirmDialog();
        return;
      }
      ['editModal', 'aboutModal', 'submissionsModal', 'recordDetailModal', 'editUserModal', 'taskModal', 'columnModal', 'commandPalette', 'linkModal', 'syncPreviewModal', 'offlineCenterModal', 'notifCenterModal'].forEach(function (id) {
        const el = getEl(id);
        if (el && !el.classList.contains('hidden')) closeDialog(id);
      });
      // Preview modal must close through closeLinkPreview(), not bare
      // closeDialog(): it also blanks/restores #previewFrame so the next
      // open never falls through to window.open (link swarming).
      const pm = getEl('previewModal');
      if (pm && !pm.classList.contains('hidden')) closeLinkPreview();
      const meetingModal = getEl('meetingNotesModal');
      if (meetingModal && !meetingModal.classList.contains('hidden')) closeMeetingNotes();
      document.body.classList.remove('sidebar-open');
      const backdrop = getEl('sidebarBackdrop');
      if (backdrop) backdrop.classList.add('hidden');
    }
  });

  document.addEventListener('click', function (event) {
    ['review-dropdown-menu', 'menu-dropdown-menu'].forEach(function (cls) {
      document.querySelectorAll('.' + cls + '.open').forEach(function (menu) {
        if (!menu.parentElement.contains(event.target)) menu.classList.remove('open');
      });
    });
    const profileDropdown = getEl('profileDropdown');
    const profileMenu = getEl('profileMenu');
    if (profileDropdown && profileMenu && profileDropdown.classList.contains('open') && !profileMenu.contains(event.target)) {
      profileDropdown.classList.remove('open');
      const trigger = getEl('profileTrigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
    const notifPanel = getEl('notifPanel');
    const notifMenu = getEl('notifMenu');
    if (notifPanel && notifMenu && !notifPanel.classList.contains('hidden') && !notifMenu.contains(event.target)) {
      closeNotificationsPanel();
    }
  });

  document.querySelectorAll('.modal-backdrop').forEach(function (backdrop) {
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) {
        if (backdrop.id === 'editModal') closeEditModal();
        else if (backdrop.id === 'aboutModal') closeAbout();
        else if (backdrop.id === 'submissionsModal') closeSubmissionsModal();
        else if (backdrop.id === 'recordDetailModal') closeRecordDetail();
        else if (backdrop.id === 'editUserModal') closeEditUser();
        else if (backdrop.id === 'confirmModal') cancelConfirmDialog();
        else if (backdrop.id === 'previewModal') closeLinkPreview();
        else if (backdrop.id === 'linkModal') closeLinkModal();
        else if (backdrop.id === 'meetingNotesModal') closeMeetingNotes();
        else if (backdrop.id === 'offlineCenterModal') closeOfflineCenter();
      }
    });
  });

  const dashboardTable = getEl('dashboardTable');
  if (dashboardTable) {
    dashboardTable.querySelectorAll('thead th[data-dash-sort]').forEach(function (th) {
      th.classList.add('sortable');
      th.setAttribute('tabindex', '0');
      th.setAttribute('title', 'Sort by ' + th.textContent.trim());
      th.addEventListener('click', function () {
        setDashSort(th.getAttribute('data-dash-sort'));
      });
      th.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setDashSort(th.getAttribute('data-dash-sort'));
        }
      });
    });
    const dashTbody = dashboardTable.querySelector('tbody');
    if (dashTbody) {
      dashTbody.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        const tr = e.target.closest('tr[data-row]');
        if (tr) openRecordDetail(tr.getAttribute('data-row'));
      });
      dashTbody.addEventListener('keydown', function (e) {
        const focused = document.activeElement;
        if (!focused || focused.tagName !== 'TR') return;
        const rows = Array.from(dashTbody.querySelectorAll('tr[data-row]'));
        const idx = rows.indexOf(focused);
        if (e.key === 'ArrowDown' && idx < rows.length - 1) { rows[idx + 1].focus(); e.preventDefault(); }
        if (e.key === 'ArrowUp' && idx > 0) { rows[idx - 1].focus(); e.preventDefault(); }
        if (e.key === 'Enter' || e.key === ' ') { openRecordDetail(focused.getAttribute('data-row')); e.preventDefault(); }
      });
    }
  }

  const auditTable = getEl('auditTable');
  if (auditTable) {
    auditTable.querySelectorAll('thead th[data-sort]').forEach(function (th) {
      th.classList.add('sortable');
      th.setAttribute('tabindex', '0');
      th.setAttribute('title', 'Sort by ' + th.textContent.trim());
      th.addEventListener('click', function () {
        setAuditSort(th.getAttribute('data-sort'));
      });
      th.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setAuditSort(th.getAttribute('data-sort'));
        }
      });
    });
  }

  const usersTable = getEl('usersTable');
  if (usersTable) {
    usersTable.addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const tbody = usersTable.querySelector('tbody');
      const users = JSON.parse((tbody && tbody.dataset.users) || '[]');
      const user = users[Number(btn.dataset.index)];
      if (!user) return;
      if (btn.dataset.action === 'delete') deleteUser(user.email);
      else if (btn.dataset.action === 'reset') resetUserPassword(user.email);
      else if (btn.dataset.action === 'edit') openEditUser(user.email);
    });
  }

  ['loginForm', 'forgotForm', 'changePasswordForm', 'addUserForm', 'editForm'].forEach(function (id) {
    const form = getEl(id);
    if (form) wireFieldClearing(form);
  });

  window.addEventListener('offline', updateOfflineBanner);
  window.addEventListener('online', function () {
    updateOfflineBanner();
    showToast('You are back online', 'info');
  });
}

wireGlobalEvents();
if (typeof initWorkspaceFeatures === 'function') initWorkspaceFeatures();
if (typeof initDashOpsFeatures === 'function') initDashOpsFeatures();
if (typeof installWorkspaceAnalyticsHook === 'function') installWorkspaceAnalyticsHook();
wireEmbeddedLinkPreview();
wirePreviewPinch();
window.addEventListener('load', initApp);

/* ============================ ENTERPRISE ADDONS ============================ */
window.EnterpriseAddons = window.EnterpriseAddons || {};

window.EnterpriseAddons.downloadTaskIcs = function (taskId) {
  const task = (appState.tasks || []).find(function (t) { return String(t.id) === String(taskId); });
  if (!task) {
    showToast('Task not found.', 'error');
    return;
  }
  const d = task.dueDate ? new Date(task.dueDate) : new Date();
  const two = function (n) { return (n < 10 ? '0' : '') + n; };
  const dateOnly = d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate());
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const title = (task.title || 'Task').replace(/[^a-zA-Z0-9 \-]/g, '').replace(/ /g, '_');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//India Post Dashboard//Task//EN',
    'BEGIN:VEVENT',
    'UID:task-' + taskId + '-' + dateOnly,
    'DTSTAMP:' + stamp,
    'DTSTART;VALUE=DATE:' + dateOnly,
    'SUMMARY:' + (task.title || 'Task'),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n') + '\r\n';
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = title + '.ics';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Calendar file downloaded.', 'success');
};

window.EnterpriseAddons.completeTaskOffline = function (taskId) {
  if (navigator.onLine) { completeTask(taskId); return; }
  if (window.OfflineQueue && window.OfflineQueue.enqueue) {
    window.OfflineQueue.enqueue('updateTask', [taskId, { status: 'DONE' }]).then(function () {
      showToast('Queued offline: task completion.', 'info');
    });
  } else {
    showToast('Offline queue not available.', 'error');
  }
};

window.EnterpriseAddons.submitRecordOffline = function (payload) {
  if (window.OfflineQueue && window.OfflineQueue.enqueue) {
    window.OfflineQueue.enqueue('addItem', [payload || {}]).then(function () {
      showToast('Queued offline: record submission.', 'info');
    });
  } else {
    showToast('Offline queue not available.', 'error');
  }
};

window.EnterpriseAddons.syncOfflineQueue = function () {
  if (window.OfflineQueue && window.OfflineQueue.flush) {
    return window.OfflineQueue.flush();
  }
  return Promise.resolve({ flushed: 0 });
};

function wireEnterpriseButtons() {
  document.addEventListener('click', function (event) {
    const icsButton = event.target.closest('[data-download-ics]');
    const completeButton = event.target.closest('[data-complete-task-offline]');

    if (icsButton && window.EnterpriseAddons) {
      EnterpriseAddons.downloadTaskIcs(icsButton.getAttribute('data-download-ics'));
    }

    if (completeButton && window.EnterpriseAddons) {
      EnterpriseAddons.completeTaskOffline(completeButton.getAttribute('data-complete-task-offline'));
    }
  });
}

wireEnterpriseButtons();

/* ---------------------------------- Push Notifications ---------------------------------- */
/* Registers the service worker for Web Push and subscribes to review
   deadline notifications. Push is opt-in: the user must click the bell
   icon in Settings to enable it. Requires VAPID_PUBLIC_KEY env var on
   the server. */

function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return; // Browser doesn't support push
  }
  navigator.serviceWorker.ready.then(function (reg) {
    return reg.pushManager.getSubscription();
  }).then(function (sub) {
    if (sub) {
      appState.pushSubscription = sub;
    }
  }).catch(function () {});
}

function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('Push notifications are not supported in this browser.', 'warning');
    return;
  }
  if (!('Notification' in window)) {
    showToast('Notifications API is not available.', 'warning');
    return;
  }
  Notification.requestPermission().then(function (perm) {
    if (perm !== 'granted') {
      showToast('Notification permission denied.', 'warning');
      return;
    }
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: getVapidPublicKey_()
      });
    }).then(function (sub) {
      appState.pushSubscription = sub;
      ApiService.subscribePush(sub.toJSON()).then(function () {
        showToast('Push notifications enabled!', 'success');
      }).catch(function (err) {
        showToast('Could not save push subscription: ' + (err.message || err), 'error');
      });
    }).catch(function (err) {
      showToast('Push subscription failed: ' + (err.message || err), 'error');
    });
  });
}

function unsubscribeFromPushNotifications() {
  if (appState.pushSubscription) {
    var endpoint = appState.pushSubscription.endpoint;
    appState.pushSubscription.unsubscribe().then(function () {
      appState.pushSubscription = null;
      return ApiService.unsubscribePush(endpoint);
    }).then(function () {
      showToast('Push notifications disabled.', 'info');
    }).catch(function () {});
  }
}

function getVapidPublicKey_() {
  // The VAPID public key must be configured on the server.
  // This is a placeholder — replace with the actual key.
  var keyEl = getEl('vapidPublicKey');
  if (keyEl) return new Uint8Array(JSON.parse(keyEl.textContent));
  return null;
}

/* ---------------------------------- Hindi / English toggle ---------------------------------- */
/* Adds a language toggle to the Settings tab. When switched, all [data-i18n]
   elements are re-translated and the preference is persisted in localStorage. */

function toggleLanguage() {
  var current = (typeof i18n !== 'undefined') ? i18n.getLanguage() : 'en';
  var next = current === 'en' ? 'hi' : 'en';
  if (typeof i18n !== 'undefined') {
    i18n.setLanguage(next);
    i18n.applyTranslations();
  }
  showToast(next === 'hi' ? 'भाषा हिन्दी में बदली' : 'Language set to English', 'success');
}
/*
 * OfflineQueue - PWA offline action queue for the India Post Dashboard.
 * Loaded AFTER app.js so the original global apiCall_ can be captured and
 * wrapped. Mutating calls made while offline are queued in localStorage and
 * replayed FIFO when the connection returns. Read-only calls pass through
 * unchanged. Also registers the service worker (sw.js).
 *
 * The offline activity center (modal) surfaces every queued / syncing /
 * failed / conflict / synced action so users can retry failures, discard
 * stuck actions, and never believe a queued mutation has synced unless it
 * actually completed.
 */
(function () {
  'use strict';

  var QUEUE_KEY = 'ipd_offline_queue_v1';
  var HISTORY_KEY = 'ipd_offline_history_v1';
  var MAX_QUEUE = 200;
  var MAX_HISTORY = 50;

  var MUTATIONS = {
    addItem: true, updateItem: true, deleteItem: true, markReviewDone: true,
    markReviewNotDone: true, setRecordDisplay: true,
    markNotificationsRead: true, clearMyNotifications: true,
    createTask: true, updateTask: true, deleteTask: true,
    saveDashboardPreferences: true,
    addSubmission: true, updateSubmission: true, deleteSubmission: true,
    lockSubmission: true, unlockSubmission: true, toggleSubmissionDisplay: true,
    deleteDocument: true
  };

  // Record-row-keyed mutations whose first data argument is a *physical row
  // number*: rows are renumbered when a record is deleted, so replaying the
  // stored row later can hit a different record. At enqueue time we capture
  // the record's stable UUID and rewrite the arg to it — the server resolves
  // record_id first (records.js resolveRecord_), so the queued action always
  // targets the same record the user acted on.
  var ROW_KEYED_RECORD = { deleteItem: 0, markReviewDone: 0, markReviewNotDone: 0, setRecordDisplay: 0 };

  function recordIdForRow_(row) {
    try {
      var items = (window.appState && window.appState.items) || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i] && Number(items[i].row) === Number(row) && items[i].recordId) {
          return String(items[i].recordId);
        }
      }
      if (window.appState && Array.isArray(window.appState.allItems)) {
        var all = window.appState.allItems;
        for (var j = 0; j < all.length; j++) {
          if (all[j] && Number(all[j].row) === Number(row) && all[j].recordId) {
            return String(all[j].recordId);
          }
        }
      }
    } catch (e) {}
    return '';
  }

  /* Rewrites a queued mutation's args so physical row numbers are replaced by
     the record's stable UUID when one is known. Returns a new array only when
     it actually changes something (identity preserved otherwise). */
  function stabilizeArgs_(fn, args) {
    var idx = ROW_KEYED_RECORD[fn];
    if (idx === undefined || !args || args[idx] == null) return args;
    if (!/^\d+$/.test(String(args[idx]).trim())) return args;
    var rid = recordIdForRow_(String(args[idx]));
    if (!rid) return args;
    var copy = args.slice();
    copy[idx] = rid;
    return copy;
  }

  var CID_COUNTER = 0;
  function cid() {
    CID_COUNTER++;
    return 'oq_' + Date.now().toString(36) + '_' + CID_COUNTER;
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function save(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) {}
  }

  function historyLoad() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function historySave(h) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch (e) {}
  }

  function pending() { return load().length; }

  function emit(name, detail) {
    try {
      if (window.EventBus) window.EventBus.emit(name, detail);
    } catch (e) {}
  }

  /* A rejected mutation is a generic "failed" action unless the server's
     answer reads like the target row is gone or the change no longer applies
     (not found / already done / deleted), which we surface as an
     understandable conflict. */
  var CONFLICT_HINTS = [
    /not found/i, /does not exist/i, /no longer/i, /was deleted/i,
    /already (deleted|removed|cancelled|done|exists|closed)/i,
    /conflict/i, /missing (row|record|id|task)/i,
    /invalid (row|record|id|task|item)/i
  ];

  function classifyError_(err) {
    var msg = String(err && err.message || err);
    for (var i = 0; i < CONFLICT_HINTS.length; i++) {
      if (CONFLICT_HINTS[i].test(msg)) return 'conflict';
    }
    return 'failed';
  }

  function describeError_(err) {
    var msg = String(err && err.message || err);
    return (msg && msg !== 'undefined') ? msg
      : 'The server rejected this action or was unavailable.';
  }

  function summary() {
    var q = load();
    var h = historyLoad();
    return {
      queued: q.filter(function (item) { return item.status === 'queued'; }).length,
      syncing: q.filter(function (item) { return item.status === 'syncing'; }).length,
      failed: q.filter(function (item) { return item.status === 'failed'; }).length,
      conflict: q.filter(function (item) { return item.status === 'conflict'; }).length,
      synced: h.length,
      backlog: q.length
    };
  }
  function totalProblems() {
    var s = summary();
    return s.failed + s.conflict + s.syncing + s.queued;
  }

  function renderQueueStatus() {
    var label = document.getElementById('offlineLabel');
    var view = document.getElementById('offlineViewBtn');
    var q = load();
    var n = q.length;
    var problems = summary();
    var failed = problems.failed + problems.conflict;
    if (label) {
      if (n > 0) {
        label.textContent = (
          failed ? (failed + (failed === 1 ? ' action failed' : ' actions failed') +
                    ' to sync and need retry. ') : ''
        ) + (
          (n - failed) ? (n - failed) + ' queued action(s) will sync when your connection returns.' : ''
        );
      } else {
        label.textContent = 'You appear to be offline. Some actions may not work until your connection returns.';
      }
    }
    if (view) view.classList.toggle('hidden', totalProblems() === 0);
    if (typeof window.updateOfflineBanner === 'function') window.updateOfflineBanner();
  }

  function enqueue(fn, args) {
    var q = load();
    q.push({
      id: cid(), fn: fn, args: args, ts: Date.now(),
      status: 'queued', attempts: 0
    });
    if (q.length > MAX_QUEUE) q.splice(0, q.length - MAX_QUEUE);
    save(q);
    renderQueueStatus();
    emit('OfflineQueueChange', { pending: q.length, status: summary() });
    return Promise.resolve({ queued: true, pending: q.length });
  }

  function findIndexById(q, id) {
    for (var i = 0; i < q.length; i++) {
      if (q[i].id === id) return i;
    }
    return -1;
  }

  function remove(item, q) {
    var arr = q || load();
    var i = findIndexById(arr, item.id);
    if (i !== -1) { arr.splice(i, 1); save(arr); }
    return arr.length;
  }

  function archiveSynced_(item) {
    var h = historyLoad();
    h.push({
      id: item.id, fn: item.fn, args: item.args, ts: item.ts,
      syncedAt: Date.now(), status: 'synced'
    });
    if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);
    historySave(h);
  }

  function callReal_(item) {
    try {
      return realApiCall.apply(null, [item.fn].concat(item.args || []));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function flush() {
    var q = load();
    var now = Date.now();
    q = q.filter(function(item){ return !item.nextRetryAt || item.nextRetryAt <= now || item.status === 'conflict'; });
    if (!q.length) return Promise.resolve({ flushed: 0, failed: 0, pending: 0, status: summary() });
    var flushed = 0;
    var failed = 0;
    var chain = Promise.resolve();
    q.forEach(function (item) {
      chain = chain.then(function () {
        item.status = 'syncing';
        item.attempts = (item.attempts || 0) + 1;
        item.lastError = null;
        save(q);
        emit('OfflineQueueChange', { pending: pending(), status: summary() });
        return callReal_(item).then(function () {
          flushed++;
          item.status = 'synced';
          item.syncedAt = Date.now();
          archiveSynced_(item);
          remove(item, q);
          renderQueueStatus();
          emit('OfflineQueueChange', { pending: pending(), status: summary() });
        }, function (err) {
          failed++;
          item.status = classifyError_(err);
          item.lastError = describeError_(err);
          if (item.status === 'failed' && item.attempts < 4) item.nextRetryAt = Date.now() + Math.min(120000, Math.pow(2, item.attempts) * 5000);
          else item.nextRetryAt = 0;
          item.lastErrorAt = Date.now();
          save(q);
          renderQueueStatus();
          emit('OfflineQueueChange', { pending: pending(), status: summary() });
        });
      });
    });
    return chain.then(function () {
      renderQueueStatus();
      emit('OfflineQueueFlushed', {
        flushed: flushed, failed: failed, pending: pending(), status: summary()
      });
      return { flushed: flushed, failed: failed, pending: pending(), status: summary() };
    });
  }

  /* Retry a single failed/conflict action: mark it queued again so it is
     picked up by the next flush, then attempt a flush immediately. */
  function retryItem(id) {
    var q = load();
    var i = findIndexById(q, id);
    if (i === -1) return Promise.resolve({ queued: 0, pending: q.length });
    q[i].status = 'queued';
    q[i].lastError = null;
    q[i].nextRetryAt = 0;
    save(q);
    renderQueueStatus();
    emit('OfflineQueueChange', { pending: q.length, status: summary() });
    return flush();
  }

  function retryAll() {
    var q = load();
    var reQueued = 0;
    q.forEach(function (item) {
      if (item.status === 'failed' || item.status === 'conflict') {
        item.status = 'queued';
        item.lastError = null;
        reQueued++;
      }
    });
    save(q);
    renderQueueStatus();
    emit('OfflineQueueChange', { pending: q.length, status: summary() });
    if (reQueued === 0) return Promise.resolve({ queued: 0, pending: q.length });
    return flush();
  }

  function discardItem(id) {
    var q = load();
    var i = findIndexById(q, id);
    if (i === -1) return false;
    q.splice(i, 1);
    save(q);
    renderQueueStatus();
    emit('OfflineQueueChange', { pending: q.length, status: summary() });
    emit('OfflineQueueDiscarded', { id: id });
    return true;
  }

  function clearHistory() {
    historySave([]);
    renderQueueStatus();
    emit('OfflineQueueChange', { pending: pending(), status: summary() });
  }

  /* ------------------------- Offline activity center ------------------------- */

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function shortArg_(a) {
    if (a == null) return String(a);
    if (typeof a === 'string') return a.length > 24 ? a.slice(0, 24) + '…' : a;
    if (typeof a === 'number' || typeof a === 'boolean') return String(a);
    if (Array.isArray(a)) return '[' + a.length + ' item(s)]';
    if (typeof a === 'object') {
      try {
        var s = JSON.stringify(a);
        return s.length > 48 ? s.slice(0, 48) + '…' : s;
      } catch (e) { return '[object]'; }
    }
    return String(a);
  }

  function describeItem_(item) {
    var parts = (item.args || []).map(shortArg_);
    return parts.length ? item.fn + ' · ' + parts.join(', ') : item.fn;
  }

  function timeText_(ts) {
    try { return new Date(ts).toLocaleString(); } catch (e) { return ''; }
  }

  var TONE = {
    queued: 'secondary',
    syncing: 'info',
    failed: 'danger',
    conflict: 'danger',
    synced: 'success'
  };
  var STATE_LABEL = {
    queued: 'Queued',
    syncing: 'Syncing…',
    failed: 'Failed',
    conflict: 'Conflict',
    synced: 'Synced'
  };

  function itemRow_(item, isHistory) {
    var tone = TONE[item.status] || 'muted';
    var label = STATE_LABEL[item.status] || item.status;
    var actions = '';
    if (!isHistory) {
      if (item.status === 'failed' || item.status === 'conflict') {
        actions += '<button class="btn btn-primary btn-small" type="button" data-oq-retry="' + esc(item.id) + '">Retry</button>';
      }
      if (item.status === 'queued' || item.status === 'failed' || item.status === 'conflict') {
        actions += '<button class="btn btn-ghost btn-small" type="button" data-oq-remove="' + esc(item.id) + '">Remove</button>';
      }
    }
    var errHtml = '';
    if (!isHistory && item.lastError) {
      errHtml = '<div class="oq-item-err">' + esc(item.lastError) + '</div>';
    }
    var when = isHistory ? 'Synced ' + timeText_(item.syncedAt) : 'Queued ' + timeText_(item.ts);
    var attempts = (item.attempts || 0) > 1 ? ' · ' + item.attempts + ' attempts' : '';
    return (
      '<div class="oq-item" data-state="' + esc(item.status) + '">' +
        '<div class="oq-item-head">' +
          '<span class="badge" data-tone="' + esc(tone) + '">' + esc(label) + '</span>' +
          '<strong class="oq-item-name">' + esc(item.fn) + '</strong>' +
          '<span class="oq-item-time">' + esc(when) + attempts + '</span>' +
        '</div>' +
        (item.args && item.args.length ? '<div class="oq-item-args">' + esc(describeItem_(item)) + '</div>' : '') +
        errHtml +
        (actions ? '<div class="oq-item-actions">' + actions + '</div>' : '') +
      '</div>'
    );
  }

  function renderOfflineCenter() {
    var list = document.getElementById('offlineCenterList');
    var summaryEl = document.getElementById('offlineCenterSummary');
    if (!list) return;
    var s = summary();
    var q = load();
    var h = historyLoad();
    var rows = q.map(function (item) { return itemRow_(item, false); });
    rows.push.apply(rows, h.map(function (item) { return itemRow_(item, true); }));
    if (summaryEl) {
      summaryEl.innerHTML =
        '<span class="badge" data-tone="secondary">' + s.queued + ' queued</span>' +
        '<span class="badge" data-tone="info">' + s.syncing + ' syncing</span>' +
        '<span class="badge" data-tone="danger">' + (s.failed + s.conflict) + ' failed</span>' +
        '<span class="badge" data-tone="success">' + s.synced + ' synced</span>';
    }
    list.innerHTML = rows.length
      ? rows.join('')
      : '<div class="oq-center-empty">No offline activity. Queued actions will appear here when you work without a connection.</div>';
    var foot = document.getElementById('offlineCenterFoot');
    if (foot) {
      var retryBtn = foot.querySelector('[data-oq-retry-all]');
      if (retryBtn) retryBtn.disabled = (s.failed + s.conflict) === 0;
      var historyBtn = foot.querySelector('[data-oq-clear-history]');
      if (historyBtn) historyBtn.disabled = s.synced === 0;
    }
  }

  function refreshAfterChange_() {
    renderOfflineCenter();
    renderQueueStatus();
  }

  function openOfflineCenter() {
    renderOfflineCenter();
    if (typeof window.openDialog === 'function') window.openDialog('offlineCenterModal');
  }

  function closeOfflineCenter() {
    if (typeof window.closeDialog === 'function') window.closeDialog('offlineCenterModal');
  }

  function wireOfflineCenter_() {
    var modal = document.getElementById('offlineCenterModal');
    if (!modal) return;
    modal.addEventListener('click', function (event) {
      var retry = event.target.closest('[data-oq-retry]');
      if (retry) {
        if (typeof window.showConfirm === 'function') {
          window.showConfirm({ message: 'Retry this action now?', okLabel: 'Retry' }).then(function (ok) {
            if (ok) retryItem(retry.getAttribute('data-oq-retry')).then(function (res) {
              if (res && res.flushed) {
                if (window.refreshData) window.refreshData();
                if (window.loadNotifications) window.loadNotifications(true);
              }
            });
          });
        } else {
          retryItem(retry.getAttribute('data-oq-retry'));
        }
        return;
      }
      var rm = event.target.closest('[data-oq-remove]');
      if (rm) {
        if (typeof window.showConfirm === 'function') {
          window.showConfirm({ message: 'Remove this action from the queue? It will not be synced.', okLabel: 'Remove', danger: true }).then(function (ok) {
            if (ok) {
              if (discardItem(rm.getAttribute('data-oq-remove')) && typeof window.showToast === 'function') {
                window.showToast('Removed from offline queue.', 'info');
              }
            }
          });
        } else {
          discardItem(rm.getAttribute('data-oq-remove'));
        }
        return;
      }
    });
  }

  function showUpdateBanner() {
    var banner = document.getElementById('updateBanner');
    if (!banner) return;
    banner.classList.remove('hidden');
    var label = document.getElementById('updateLabel');
    if (label) label.textContent = 'A new version of the dashboard is available.';
    renderQueueStatus();
  }

  function hideUpdateBanner() {
    var banner = document.getElementById('updateBanner');
    if (!banner) return;
    banner.classList.add('hidden');
  }

  function applyUpdate() {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
  }

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (registration) {
        registration.addEventListener('updatefound', function () {
          var installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', function () {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              emit('ServiceWorkerUpdateAvailable', { registration: registration });
              if (typeof window.showToast === 'function') {
                window.showToast('A new dashboard version is available. Reload to update.', 'info');
              }
              showUpdateBanner();
            }
          });
        });
      }).catch(function () {});
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (typeof window.showToast === 'function') {
        window.showToast('Dashboard updated. Reloading…', 'info');
      }
      window.location.reload();
    });
  }

  var realApiCall = window.apiCall_ || function () {
    throw new Error('apiCall_ not available');
  };

  window.apiCall_ = function (fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (MUTATIONS[fn] && navigator.onLine === false) {
      return enqueue(fn, stabilizeArgs_(fn, args));
    }
    return realApiCall.apply(null, arguments);
  };

  window.OfflineQueue = {
    enqueue: enqueue,
    flush: flush,
    pending: pending,
    isMutation: function (fn) { return !!MUTATIONS[fn]; },
    retry: retryItem,
    retryAll: retryAll,
    discard: discardItem,
    clearHistory: clearHistory,
    history: historyLoad,
    items: load,
    summary: summary,
    status: function () {
      var s = summary();
      return {
        queued: s.backlog,
        syncing: s.syncing,
        failed: s.failed + s.conflict,
        conflict: s.conflict,
        synced: s.synced,
        pending: s.backlog
      };
    }
  };

  registerServiceWorker();
  wireOfflineCenter_();

  if (window.EventBus) {
    EventBus.on('OfflineQueueChange', refreshAfterChange_);
    EventBus.on('OfflineQueueFlushed', refreshAfterChange_);
  }

  window.addEventListener('online', function () {
    renderQueueStatus();
    if (pending()) {
      flush().then(function (res) {
        renderQueueStatus();
        if (res.flushed && window.refreshData) window.refreshData();
        if (window.loadNotifications) window.loadNotifications(true);
      });
    }
  });
  window.addEventListener('offline', renderQueueStatus);

  window.openOfflineCenter = openOfflineCenter;
  window.closeOfflineCenter = closeOfflineCenter;
  window.refreshWithCacheBurst = refreshWithCacheBurst;

  window.OfflineQueueSyncNow = function () {
    flush().then(function (res) {
      if (res && res.flushed && window.refreshData) window.refreshData();
      if (typeof window.showToast === 'function') {
        if (res && res.failed) window.showToast(res.failed + ' failed action(s).', 'error');
        else if (res && res.flushed) window.showToast('All queued actions synced.', 'success');
        else window.showToast('Nothing to sync.', 'info');
      }
    });
  };

  window.OfflineQueueRetryAll = function () {
    retryAll().then(function (res) {
      if (typeof window.showToast === 'function') {
        if (res && res.flushed) window.showToast('Retried ' + res.flushed + ' action(s).', 'success');
        else window.showToast('No failed actions to retry.', 'info');
      }
    });
  };

  window.OfflineQueueClearHistory = function () {
    if (historyLoad().length === 0) {
      if (typeof window.showToast === 'function') window.showToast('No synced history to clear.', 'info');
      return;
    }
    clearHistory();
    if (typeof window.showToast === 'function') window.showToast('Synced history cleared.', 'info');
  };

  window.applyUpdate = function () {
    applyUpdate();
    if (typeof window.showToast === 'function') {
      window.showToast('Updating… Reloading.', 'info');
    }
  };

  /* Manual "Refresh" from the dashboard: burst the service-worker cache so the
     latest dashboard version is always loaded. When an update is available the
     new (installing) service worker is told to skip waiting and take control →
     the controllerchange handler reloads the app with the fresh shell. When no
     newer version exists we fall back to a plain data refresh so the button
     never feels dead. */
  var CHECK_WINDOW_MS = 3000;
  function refreshWithCacheBurst() {
    var settled = false;
    function finish(updateFound) {
      if (settled) return;
      settled = true;
      if (updateFound && navigator.serviceWorker.controller) {
        // applying: SKIP_WAITING already posted; controllerchange will reload.
        return;
      }
      if (typeof window.refreshData === 'function') window.refreshData();
    }
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      finish(false);
      return;
    }
    navigator.serviceWorker.ready.then(function (reg) {
      var sawUpdate = false;
      var applying = false;
      function installed() {
        if (applying || settled) return;
        applying = true;
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
          finish(true);
        } else {
          finish(false);
        }
      }
      function onUpdateFound() {
        sawUpdate = true;
        var w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed') installed();
          else if (w.state === 'redundant') finish(false);
        });
      }
      reg.addEventListener('updatefound', onUpdateFound);
      reg.update().then(function () {
        if (!sawUpdate) finish(false);
      }).catch(function () {
        finish(false);
      });
    }).catch(function () {
      finish(false);
    });
  }

  window.dismissUpdate = function () {
    hideUpdateBanner();
  };

  renderQueueStatus();
})();
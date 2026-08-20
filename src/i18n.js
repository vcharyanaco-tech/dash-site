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

/**
 * ============================================================
 * India Post Dashboard — Node port
 * i18n-server.js
 * Server-side translations endpoint. Serves the translation
 * dictionary so the client can load it without hardcoding.
 * ============================================================
 */

const translations = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.analytics': 'Analytics',
    'nav.audit': 'Audit Log',
    'nav.reports': 'Reports',
    'nav.tasks': 'Tasks',
    'nav.settings': 'Settings',
    'nav.signout': 'Sign out',
    'dashboard.title': 'India Post Dashboard',
    'dashboard.subtitle': 'Circle Office Haryana',
    'dashboard.total': 'Total Records',
    'dashboard.flagged': 'Review Due',
    'dashboard.normal': 'Normal',
    'dashboard.search': 'Search records…',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.loading': 'Loading…'
  },
  hi: {
    'nav.dashboard': 'डैशबोर्ड',
    'nav.analytics': 'विश्लेषण',
    'nav.audit': 'ऑडिट लॉग',
    'nav.reports': 'रिपोर्ट',
    'nav.tasks': 'कार्य',
    'nav.settings': 'सेटिंग्स',
    'nav.signout': 'साइन आउट',
    'dashboard.title': 'भारतीय डाक डैशबोर्ड',
    'dashboard.subtitle': 'सर्कल कार्यालय हरियाणा',
    'dashboard.total': 'कुल रिकॉर्ड',
    'dashboard.flagged': 'समीक्षा बाकी',
    'dashboard.normal': 'सामान्य',
    'dashboard.search': 'रिकॉर्ड खोजें…',
    'common.save': 'सहेजें',
    'common.cancel': 'रद्द करें',
    'common.loading': 'लोड हो रहा है…'
  }
};

/**
 * Returns the translation dictionary for the requested language.
 * @param {string} lang - 'en' or 'hi' (defaults to 'en')
 * @returns {Object} Translation dictionary
 */
function getTranslations(lang) {
  const key = String(lang || 'en').toLowerCase();
  return translations[key] || translations.en;
}

module.exports = {
  getTranslations
};

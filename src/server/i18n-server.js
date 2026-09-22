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
    'nav.myday': 'My Day',
    'nav.analytics': 'Analytics',
    'nav.audit': 'Audit Log',
    'nav.reports': 'Reports',
    'nav.tasks': 'Tasks',
    'nav.settings': 'Settings',
    'nav.signout': 'Sign out',
    'nav.sectionOverview': 'Overview',
    'nav.sectionWork': 'Work',
    'nav.sectionInsights': 'Insights',
    'nav.sectionAdmin': 'Admin',
    'dashboard.title': 'India Post Dashboard',
    'dashboard.live': 'Live Dashboard',
    'dashboard.subtitle': 'Circle Office Haryana',
    'dashboard.total': 'Total Records',
    'dashboard.flagged': 'Review Due',
    'dashboard.normal': 'Normal',
    'dashboard.search': 'Search records…',
    'about.designedBy': 'Designed, developed and maintained by Circle Office, Haryana',
    'settings.language': 'Language',
    'settings.languageCopy': 'Switch the dashboard chrome between English and Hindi.',
    'settings.switchLang': 'Switch to Hindi',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.loading': 'Loading…'
  },
  hi: {
    'nav.dashboard': 'डैशबोर्ड',
    'nav.myday': 'मेरा दिन',
    'nav.analytics': 'विश्लेषण',
    'nav.audit': 'ऑडिट लॉग',
    'nav.reports': 'रिपोर्ट',
    'nav.tasks': 'कार्य',
    'nav.settings': 'सेटिंग्स',
    'nav.signout': 'साइन आउट',
    'nav.sectionOverview': 'अवलोकन',
    'nav.sectionWork': 'कार्य',
    'nav.sectionInsights': 'अंतर्दृष्टि',
    'nav.sectionAdmin': 'प्रशासन',
    'dashboard.title': 'भारतीय डाक डैशबोर्ड',
    'dashboard.live': 'लाइव डैशबोर्ड',
    'dashboard.subtitle': 'सर्कल कार्यालय हरियाणा',
    'dashboard.total': 'कुल रिकॉर्ड',
    'dashboard.flagged': 'समीक्षा बाकी',
    'dashboard.normal': 'सामान्य',
    'dashboard.search': 'रिकॉर्ड खोजें…',
    'about.designedBy': 'डिज़ाइन, विकसित और रखरखाव: सर्कल कार्यालय, हरियाणा',
    'settings.language': 'भाषा',
    'settings.languageCopy': 'डैशबोर्ड का इंटरफ़ेस अंग्रेज़ी और हिन्दी के बीच बदलें।',
    'settings.switchLang': 'हिन्दी में बदलें',
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

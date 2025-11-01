import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import trCommon from '../locales/tr/common.json';
import enCommon from '../locales/en/common.json';
import deCommon from '../locales/de/common.json';
import frCommon from '../locales/fr/common.json';

// Translation resources
const resources = {
  tr: {
    common: trCommon,
  },
  en: {
    common: enCommon,
  },
  de: {
    common: deCommon,
  },
  fr: {
    common: frCommon,
  },
};

i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Init i18next
  .init({
    resources,
    fallbackLng: 'tr', // Varsayılan dil Türkçe
    defaultNS: 'common',
    ns: ['common'],
    keySeparator: '.',
    nsSeparator: ':',
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    detection: {
      // localStorage'dan dil tercihini oku
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import trCommon from '../locales/tr/common.json';
import enCommon from '../locales/en/common.json';
import deCommon from '../locales/de/common.json';
import frCommon from '../locales/fr/common.json';
// help namespace
import trHelp from '../locales/tr/help.json';
import enHelp from '../locales/en/help.json';
import deHelp from '../locales/de/help.json';
import frHelp from '../locales/fr/help.json';
// status namespace
import trStatus from '../locales/tr/status.json';
import enStatus from '../locales/en/status.json';
import deStatus from '../locales/de/status.json';
import frStatus from '../locales/fr/status.json';
// api namespace
import trApi from '../locales/tr/api.json';
import enApi from '../locales/en/api.json';
import deApi from '../locales/de/api.json';
import frApi from '../locales/fr/api.json';
// about namespace
import trAbout from '../locales/tr/about.json';
import enAbout from '../locales/en/about.json';
import deAbout from '../locales/de/about.json';
import frAbout from '../locales/fr/about.json';

// Translation resources
const resources = {
  tr: {
    common: trCommon,
    help: trHelp,
    status: trStatus,
    api: trApi,
    about: trAbout,
  },
  en: {
    common: enCommon,
    help: enHelp,
    status: enStatus,
    api: enApi,
    about: enAbout,
  },
  de: {
    common: deCommon,
    help: deHelp,
    status: deStatus,
    api: deApi,
    about: deAbout,
  },
  fr: {
    common: frCommon,
    help: frHelp,
    status: frStatus,
    api: frApi,
    about: frAbout,
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
  ns: ['common', 'help', 'status', 'api', 'about'],
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

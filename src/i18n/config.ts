import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import trCommonRaw from '../locales/tr/common.json';
import enCommonRaw from '../locales/en/common.json';
import deCommonRaw from '../locales/de/common.json';
import frCommonRaw from '../locales/fr/common.json';
// help namespace
import trHelp from '../locales/tr/help.json';
import enHelp from '../locales/en/help.json';
import deHelp from '../locales/de/help.json';
import frHelp from '../locales/fr/help.json';
// status namespace
import trStatusRaw from '../locales/tr/status.json';
import enStatusRaw from '../locales/en/status.json';
import deStatusRaw from '../locales/de/status.json';
import frStatusRaw from '../locales/fr/status.json';
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

// Normalize translation trees to ensure keys are at expected root paths
function normalizeCommonResource(obj: any) {
  try {
    if (!obj || typeof obj !== 'object') return obj || {};
    const copy: any = { ...obj };
    // If file mistakenly nests keys under a top-level `common`, hoist them to root
    if (copy.common && typeof copy.common === 'object') {
      Object.assign(copy, copy.common);
    }
    // If planTab was mistakenly placed under other nodes (e.g., pdf or dpa), hoist it
    if (!copy.planTab) {
      if (copy.pdf && typeof copy.pdf.planTab === 'object') {
        copy.planTab = copy.pdf.planTab;
      } else if (copy.dpa && typeof copy.dpa.planTab === 'object') {
        copy.planTab = copy.dpa.planTab;
      } else if (copy.common && typeof copy.common.planTab === 'object') {
        copy.planTab = copy.common.planTab;
      } else {
        // Deep search for any nested `planTab` object and hoist the first match
        const seen = new WeakSet();
        const stack: any[] = [copy];
        while (stack.length) {
          const cur = stack.pop();
          if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
          seen.add(cur);
          if (Object.prototype.hasOwnProperty.call(cur, 'planTab') && typeof cur.planTab === 'object') {
            copy.planTab = cur.planTab;
            break;
          }
          for (const k of Object.keys(cur)) {
            const v = (cur as any)[k];
            if (v && typeof v === 'object') stack.push(v);
          }
        }
      }
    }
    // If some locales mistakenly nested notifications/security under sales, hoist them
    if (!copy.notifications && copy.sales && typeof copy.sales.notifications === 'object') {
      copy.notifications = copy.sales.notifications;
    }
    if (!copy.security && copy.sales && typeof copy.sales.security === 'object') {
      copy.security = copy.sales.security;
    }

    // Ensure landing.pricing.* keys are properly nested under landing.pricing
    // Some locale files place pricing keys under landing with dotted keys like "pricing.title"
    // This block nests only the pricing section without touching other parts of landing
    if (copy.landing && typeof copy.landing === 'object') {
      const landingObj: any = copy.landing;

      const setPathIfMissing = (base: any, segments: string[], value: any) => {
        let cur = base;
        for (let i = 0; i < segments.length; i++) {
          const key = segments[i];
          const isLeaf = i === segments.length - 1;
          if (isLeaf) {
            if (cur[key] == null) {
              cur[key] = value;
            }
          } else {
            if (cur[key] == null || typeof cur[key] !== 'object') {
              cur[key] = {};
            }
            cur = cur[key];
          }
        }
      };

      Object.keys(landingObj).forEach((k) => {
        if (k.startsWith('pricing.')) {
          const rest = k.slice('pricing.'.length);
          if (rest) {
            const segments = ['pricing', ...rest.split('.')];
            setPathIfMissing(landingObj, segments, landingObj[k]);
          }
        }
      });
    }
    return copy;
  } catch {
    return obj || {};
  }
}

const trCommon = normalizeCommonResource(trCommonRaw as any);
const enCommon = normalizeCommonResource(enCommonRaw as any);
const deCommon = normalizeCommonResource(deCommonRaw as any);
const frCommon = normalizeCommonResource(frCommonRaw as any);

// Merge business statuses (paid, draft, etc.) into status namespace so both t('status.*') and t('common:status.*') work.
function mergeBusinessStatuses(statusNs: any, commonNs: any) {
  if (!statusNs || typeof statusNs !== 'object') return statusNs || {};
  if (!commonNs || typeof commonNs !== 'object') return statusNs;
  const businessStatuses = commonNs.status;
  if (businessStatuses && typeof businessStatuses === 'object') {
    // Only copy if key doesn't already exist to avoid overriding system status keys like operational.
    Object.keys(businessStatuses).forEach(k => {
      if (statusNs[k] == null) {
        statusNs[k] = businessStatuses[k];
      }
    });
  }
  return statusNs;
}

const trStatus = mergeBusinessStatuses(trStatusRaw as any, trCommon);
const enStatus = mergeBusinessStatuses(enStatusRaw as any, enCommon);
const deStatus = mergeBusinessStatuses(deStatusRaw as any, deCommon);
const frStatus = mergeBusinessStatuses(frStatusRaw as any, frCommon);

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
    fallbackLng: ['tr', 'en'], // Varsayılan TR, eksikler için EN'e düş
  defaultNS: 'common',
  ns: ['common', 'help', 'status', 'api', 'about'],
    keySeparator: '.',
    nsSeparator: ':',
    supportedLngs: ['tr', 'en', 'de', 'fr'],
    nonExplicitSupportedLngs: true, // fr-FR -> fr
    load: 'languageOnly',
    react: { useSuspense: false },
    
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

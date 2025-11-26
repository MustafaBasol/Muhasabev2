import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';
import { getCachedTenantId, readTenantScopedValue, safeLocalStorage, writeTenantScopedValue } from '../utils/localStorageSafe';

type Language = 'tr' | 'en' | 'de' | 'fr';

interface LanguageContextType {
  currentLanguage: Language;
  changeLanguage: (lang: Language) => void;
  languages: { code: Language; name: string; flag: string }[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const normalizeLang = (raw?: string): Language => {
  const s = String(raw || '').toLowerCase();
  if (!s) return 'tr';
  if (s.startsWith('tr') || s.includes('turk')) return 'tr';
  if (s.startsWith('en') || s.includes('engl')) return 'en';
  if (s.startsWith('de') || s.includes('deut') || s.includes('german')) return 'de';
  if (s.startsWith('fr') || s.includes('fran')) return 'fr';
  return 'tr';
};

const LANG_STORAGE_KEY = 'i18nextLng';
const LANG_PREF_BASE_KEY = 'language_preference';

const getLegacyTenantLangKey = (): string => {
  const tenantId = getCachedTenantId();
  return tenantId && tenantId !== 'default' ? `lang_${tenantId}` : LANG_STORAGE_KEY;
};

const readPersistedLanguage = (): Language => {
  try {
    const savedScoped = readTenantScopedValue(LANG_PREF_BASE_KEY, { fallbackToBase: true });
    const legacyScopedKey = getLegacyTenantLangKey();
    const savedLegacy = legacyScopedKey ? safeLocalStorage.getItem(legacyScopedKey) : null;
    const savedGlobal = legacyScopedKey === LANG_STORAGE_KEY ? null : safeLocalStorage.getItem(LANG_STORAGE_KEY);
    return normalizeLang(savedScoped || savedLegacy || savedGlobal);
  } catch (error) {
    logger.warn('Dil bilgisi yüklenemedi, varsayılan kullanılacak', error);
    return 'tr';
  }
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();

  const [currentLanguage, setCurrentLanguage] = useState<Language>(readPersistedLanguage);
  const pendingLanguageRef = useRef<Language | null>(null);

  const commitLanguageChange = useCallback((lang: Language) => {
    pendingLanguageRef.current = lang;
    return i18n.changeLanguage(lang).finally(() => {
      if (pendingLanguageRef.current === lang) {
        pendingLanguageRef.current = null;
      }
    });
  }, [i18n]);

  const languages = [
    { code: 'tr' as Language, name: 'Türkçe', flag: '🇹🇷' },
    { code: 'en' as Language, name: 'English', flag: '🇬🇧' },
    { code: 'de' as Language, name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr' as Language, name: 'Français', flag: '🇫🇷' },
  ];

  const changeLanguage = (lang: Language) => {
    const norm = normalizeLang(lang);
    void commitLanguageChange(norm); // Kaynaklar config'te zaten yüklendi; ek enjekte gerekmiyor.
    setCurrentLanguage(norm);
    try {
      writeTenantScopedValue(LANG_PREF_BASE_KEY, norm, { mirrorToBase: true });
    } catch (error) {
      logger.warn('Dil tercihi kaydedilemedi', error);
    }
  };

  useEffect(() => {
    // İlk yüklemede ve dil değişiminde dili ayarla (normalize ederek)
    const norm = normalizeLang(currentLanguage);
    if (pendingLanguageRef.current === norm) return;
    if (i18n.language !== norm) {
      void commitLanguageChange(norm);
    }
  }, [currentLanguage, i18n, commitLanguageChange]);

  return (
    <LanguageContext.Provider value={{ currentLanguage, changeLanguage, languages }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

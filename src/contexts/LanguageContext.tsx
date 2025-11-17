import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

type Language = 'tr' | 'en' | 'de' | 'fr';

interface LanguageContextType {
  currentLanguage: Language;
  changeLanguage: (lang: Language) => void;
  languages: { code: Language; name: string; flag: string }[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const normalizeLang = (raw?: string): Language => {
    const s = String(raw || '').toLowerCase();
    if (!s) return 'tr';
    if (s.startsWith('tr') || s.includes('turk')) return 'tr';
    if (s.startsWith('en') || s.includes('engl')) return 'en';
    if (s.startsWith('de') || s.includes('deut') || s.includes('german')) return 'de';
    if (s.startsWith('fr') || s.includes('fran')) return 'fr';
    return 'tr';
  };

  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    try {
      const tenantId = (localStorage.getItem('tenantId') || '').toString();
      const scopedKey = tenantId ? `lang_${tenantId}` : 'i18nextLng';
      const savedScoped = localStorage.getItem(scopedKey);
      const savedGlobal = localStorage.getItem('i18nextLng');
      return normalizeLang(savedScoped || savedGlobal);
    } catch {
      return 'tr';
    }
  });

  const languages = [
    { code: 'tr' as Language, name: 'Türkçe', flag: '🇹🇷' },
    { code: 'en' as Language, name: 'English', flag: '🇬🇧' },
    { code: 'de' as Language, name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr' as Language, name: 'Français', flag: '🇫🇷' },
  ];

  const changeLanguage = (lang: Language) => {
    const norm = normalizeLang(lang);
    i18n.changeLanguage(norm);
    setCurrentLanguage(norm);
    try {
      const tenantId = (localStorage.getItem('tenantId') || '').toString();
      const scopedKey = tenantId ? `lang_${tenantId}` : 'i18nextLng';
      localStorage.setItem(scopedKey, norm);
      // Global fallback'ı da güncel tut
      localStorage.setItem('i18nextLng', norm);
    } catch {}
  };

  useEffect(() => {
    // İlk yüklemede ve dil değişiminde dili ayarla (normalize ederek)
    const norm = normalizeLang(currentLanguage);
    if (i18n.language !== norm) {
      i18n.changeLanguage(norm);
      try { localStorage.setItem('i18nextLng', norm); } catch {}
    }
  }, [currentLanguage, i18n]);

  return (
    <LanguageContext.Provider value={{ currentLanguage, changeLanguage, languages }}>
      {children}
    </LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

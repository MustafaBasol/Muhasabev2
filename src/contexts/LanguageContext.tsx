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
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    try {
      const tenantId = (localStorage.getItem('tenantId') || '').toString();
      const scopedKey = tenantId ? `lang_${tenantId}` : 'i18nextLng';
      const savedScoped = localStorage.getItem(scopedKey);
      const savedGlobal = localStorage.getItem('i18nextLng');
      return ((savedScoped || savedGlobal) as Language) || 'tr';
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
    i18n.changeLanguage(lang);
    setCurrentLanguage(lang);
    try {
      const tenantId = (localStorage.getItem('tenantId') || '').toString();
      const scopedKey = tenantId ? `lang_${tenantId}` : 'i18nextLng';
      localStorage.setItem(scopedKey, lang);
      // Global fallback'ı da güncel tut
      localStorage.setItem('i18nextLng', lang);
    } catch {}
  };

  useEffect(() => {
    // İlk yüklemede ve dil değişiminde dili ayarla
    i18n.changeLanguage(currentLanguage);
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

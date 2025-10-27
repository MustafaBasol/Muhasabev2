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
    const saved = localStorage.getItem('i18nextLng');
    return (saved as Language) || 'tr';
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
    localStorage.setItem('i18nextLng', lang);
  };

  useEffect(() => {
    // İlk yüklemede dili ayarla
    i18n.changeLanguage(currentLanguage);
  }, []);

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

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Globe } from 'lucide-react';
import { Calculator } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const LegalHeader: React.FC = () => {
  const { t } = useTranslation('common');
  const { currentLanguage, changeLanguage, languages } = useLanguage();

  const handleLanguageChange = (langCode: string) => {
    changeLanguage(langCode as 'tr' | 'en' | 'de' | 'fr');
  };

  const handleBackToHome = () => {
    window.location.href = '/';
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left - Logo and Back Button */}
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackToHome}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">{t('common.backToHome', 'Back to Home')}</span>
            </button>
            
            <div className="h-4 w-px bg-gray-300" />
            
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Comptario</span>
            </div>
          </div>

          {/* Right - Language Selector */}
          <div className="relative">
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-gray-500" />
              <select
                value={currentLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-transparent border-none text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded cursor-pointer pr-8"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default LegalHeader;
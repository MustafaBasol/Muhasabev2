import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../contexts/LanguageContext';
import { Menu, X, ChevronDown } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';

interface LandingNavbarProps {
  onTryForFree: () => void;
  onSignIn: () => void;
}

const LandingNavbar: React.FC<LandingNavbarProps> = ({ onTryForFree, onSignIn }) => {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { key: 'features', href: '#features', label: t('landing.nav.features') },
    { key: 'pricing', href: '#pricing', label: t('landing.nav.pricing') },
    { key: 'faq', href: '#faq', label: t('landing.nav.faq') },
    { key: 'contact', href: '#contact', label: t('landing.nav.contact') },
  ];

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex items-center space-x-2">
              <BrandLogo className="h-16 w-auto" />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <button
                key={link.key}
                onClick={() => scrollToSection(link.href)}
                className="text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                className="flex items-center space-x-1 text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors"
                aria-expanded={isLanguageOpen}
                aria-haspopup="true"
              >
                <span className="text-lg">
                  {languages.find(lang => lang.code === currentLanguage)?.flag}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isLanguageOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isLanguageOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    {languages.map((language) => (
                      <button
                        key={language.code}
                        onClick={() => {
                          changeLanguage(language.code);
                          setIsLanguageOpen(false);
                        }}
                        className={`${
                          currentLanguage === language.code
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-700'
                        } group flex items-center px-4 py-2 text-sm w-full hover:bg-gray-50`}
                      >
                        <span className="mr-3 text-lg">{language.flag}</span>
                        {language.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onSignIn}
              className="text-gray-700 hover:text-gray-900 px-4 py-2 text-sm font-medium transition-colors"
            >
              {t('landing.cta.signin')}
            </button>
            <button
              onClick={onTryForFree}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
            >
              {t('landing.cta.try')}
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-gray-900 p-2"
              aria-expanded={isMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white border-t border-gray-200">
              {navLinks.map((link) => (
                <button
                  key={link.key}
                  onClick={() => scrollToSection(link.href)}
                  className="text-gray-700 hover:text-gray-900 block px-3 py-2 text-base font-medium w-full text-left"
                >
                  {link.label}
                </button>
              ))}
              
              {/* Mobile Language Switcher */}
              <div className="border-t border-gray-200 pt-4">
                <div className="px-3 py-2 text-sm font-medium text-gray-500">
                  Language
                </div>
                {languages.map((language) => (
                  <button
                    key={language.code}
                    onClick={() => {
                      changeLanguage(language.code);
                      setIsMenuOpen(false);
                    }}
                    className={`${
                      currentLanguage === language.code
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-700'
                    } flex items-center px-3 py-2 text-base font-medium w-full hover:bg-gray-50`}
                  >
                    <span className="mr-3 text-lg">{language.flag}</span>
                    {language.name}
                  </button>
                ))}
              </div>
              
              {/* Mobile Actions */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <button
                  onClick={onSignIn}
                  className="text-gray-700 hover:text-gray-900 block px-3 py-2 text-base font-medium w-full text-left"
                >
                  {t('landing.cta.signin')}
                </button>
                <button
                  onClick={onTryForFree}
                  className="bg-gray-900 text-white px-3 py-2 rounded-lg text-base font-medium hover:bg-gray-800 transition-colors w-full"
                >
                  {t('landing.cta.try')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default LandingNavbar;
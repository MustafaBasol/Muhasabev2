import React, { useEffect, useRef } from 'react';
import { X, Cookie, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCookieConsent } from '../contexts/CookieConsentContext';

const CookieConsentBanner: React.FC = () => {
  const { t } = useTranslation('common');
  const { showBanner, acceptAll, rejectAll, openModal, closeBanner } = useCookieConsent();
  const bannerRef = useRef<HTMLDivElement>(null);

  // Focus management for accessibility
  useEffect(() => {
    if (showBanner && bannerRef.current) {
      bannerRef.current.focus();
    }
  }, [showBanner]);

  // ESC key handler
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showBanner) {
        closeBanner();
      }
    };

    if (showBanner) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [showBanner, closeBanner]);

  if (!showBanner) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={closeBanner}
        aria-hidden="true"
      />
      
      {/* Banner */}
      <div
        ref={bannerRef}
        role="dialog"
        aria-labelledby="cookie-banner-title"
        aria-describedby="cookie-banner-description"
        aria-modal="true"
        tabIndex={-1}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg transform transition-transform duration-300 ease-in-out"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Icon and content */}
            <div className="flex items-start gap-3 flex-1">
              <div className="flex-shrink-0 mt-1">
                <Cookie className="h-6 w-6 text-blue-600" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 
                  id="cookie-banner-title"
                  className="text-lg font-semibold text-gray-900 mb-1"
                >
                  {t('cookie.banner.title')}
                </h2>
                <p 
                  id="cookie-banner-description"
                  className="text-sm text-gray-600 leading-relaxed"
                >
                  {t('cookie.banner.description')}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 lg:flex-shrink-0">
              <button
                onClick={rejectAll}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                {t('cookie.banner.rejectAll')}
              </button>
              
              <button
                onClick={openModal}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors inline-flex items-center gap-2"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                {t('cookie.banner.managePreferences')}
              </button>
              
              <button
                onClick={acceptAll}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                {t('cookie.banner.acceptAll')}
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={closeBanner}
              className="absolute top-2 right-2 lg:relative lg:top-auto lg:right-auto p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 rounded-lg"
              aria-label={t('cookie.banner.close')}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CookieConsentBanner;
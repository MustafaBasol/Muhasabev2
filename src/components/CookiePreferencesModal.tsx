import React, { useEffect, useRef, useState } from 'react';
import { X, Cookie, Check, Shield, BarChart3, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCookieConsent } from '../contexts/CookieConsentContext';

const CookiePreferencesModal: React.FC = () => {
  const { t } = useTranslation('common');
  const { 
    showModal, 
    consent, 
    closeModal, 
    updateConsent, 
    acceptAll, 
    rejectAll 
  } = useCookieConsent();
  
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  
  // Local state for preferences
  const [preferences, setPreferences] = useState({
    necessary: true,
    analytics: false,
    marketing: false
  });

  // Update local preferences when consent changes
  useEffect(() => {
    if (consent) {
      setPreferences({
        necessary: consent.necessary,
        analytics: consent.analytics,
        marketing: consent.marketing
      });
    }
  }, [consent]);

  // Focus management and ESC key handler
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    if (showModal) {
      // Focus the close button when modal opens
      if (closeButtonRef.current) {
        closeButtonRef.current.focus();
      }
      
      // Add ESC key listener
      document.addEventListener('keydown', handleEscapeKey);
      
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
        document.body.style.overflow = 'unset';
      };
    }
  }, [showModal, closeModal]);

  // Focus trap within modal
  useEffect(() => {
    if (!showModal || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [showModal]);

  const handlePreferenceChange = (category: 'analytics' | 'marketing', enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [category]: enabled
    }));
  };

  const handleSavePreferences = () => {
    updateConsent(preferences);
  };

  const handleAcceptAll = () => {
    setPreferences(prev => ({
      ...prev,
      analytics: true,
      marketing: true
    }));
    acceptAll();
  };

  const handleRejectAll = () => {
    setPreferences(prev => ({
      ...prev,
      analytics: false,
      marketing: false
    }));
    rejectAll();
  };

  if (!showModal) return null;

  const categories = [
    {
      id: 'necessary',
      title: t('cookie.modal.necessary.title'),
      description: t('cookie.modal.necessary.description'),
      icon: Shield,
      enabled: true,
      disabled: true,
      required: true
    },
    {
      id: 'analytics',
      title: t('cookie.modal.analytics.title'),
      description: t('cookie.modal.analytics.description'),
      icon: BarChart3,
      enabled: preferences.analytics,
      disabled: false,
      required: false
    },
    {
      id: 'marketing',
      title: t('cookie.modal.marketing.title'),
      description: t('cookie.modal.marketing.description'),
      icon: Target,
      enabled: preferences.marketing,
      disabled: false,
      required: false
    }
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={closeModal}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-labelledby="cookie-modal-title"
        aria-describedby="cookie-modal-description"
        aria-modal="true"
      >
        <div
          ref={modalRef}
          className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Cookie className="h-6 w-6 text-blue-600" aria-hidden="true" />
              <h2 id="cookie-modal-title" className="text-xl font-semibold text-gray-900">
                {t('cookie.modal.title')}
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              onClick={closeModal}
              className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-lg"
              aria-label={t('cookie.banner.close')}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p id="cookie-modal-description" className="text-gray-600 mb-6">
              {t('cookie.modal.description')}
            </p>

            {/* Cookie Categories */}
            <div className="space-y-6">
              {categories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <IconComponent className="h-5 w-5 text-gray-500 mt-1 flex-shrink-0" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 mb-1">
                            {category.title}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {category.description}
                          </p>
                        </div>
                      </div>
                      
                      {/* Toggle Switch */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {category.required ? (
                          <span className="text-xs text-gray-500 font-medium">
                            {t('cookie.modal.necessary.alwaysActive')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 font-medium">
                            {category.enabled 
                              ? t('cookie.modal.analytics.enabled')
                              : t('cookie.modal.analytics.disabled')
                            }
                          </span>
                        )}
                        
                        <button
                          onClick={() => !category.disabled && handlePreferenceChange(
                            category.id as 'analytics' | 'marketing', 
                            !category.enabled
                          )}
                          disabled={category.disabled}
                          className={`
                            relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                            ${category.enabled 
                              ? 'bg-blue-600' 
                              : 'bg-gray-200'
                            }
                            ${category.disabled 
                              ? 'cursor-not-allowed opacity-50' 
                              : 'cursor-pointer'
                            }
                          `}
                          aria-pressed={category.enabled}
                          aria-label={`Toggle ${category.title}`}
                        >
                          <span
                            className={`
                              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                              ${category.enabled ? 'translate-x-6' : 'translate-x-1'}
                            `}
                          />
                          {category.enabled && (
                            <Check className="absolute left-1.5 h-3 w-3 text-blue-600" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              onClick={handleRejectAll}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              {t('cookie.modal.rejectAll')}
            </button>
            
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              {t('cookie.modal.cancel')}
            </button>
            
            <div className="flex gap-3 sm:ml-auto">
              <button
                onClick={handleSavePreferences}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                {t('cookie.modal.acceptSelected')}
              </button>
              
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                {t('cookie.modal.acceptAll')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CookiePreferencesModal;
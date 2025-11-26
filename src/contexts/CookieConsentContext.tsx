import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { analyticsManager } from '../utils/analyticsManager';
import { logger } from '../utils/logger';
import { parseLocalObject, safeLocalStorage } from '../utils/localStorageSafe';

export interface CookieConsent {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  version: number;
  timestamp: number;
}

interface CookieConsentContextType {
  consent: CookieConsent | null;
  hasConsent: boolean;
  showBanner: boolean;
  showModal: boolean;
  updateConsent: (newConsent: Partial<CookieConsent>) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  openModal: () => void;
  closeModal: () => void;
  closeBanner: () => void;
  resetConsent: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

const CONSENT_VERSION = 1;
const CONSENT_KEY = `cookie_consent_v${CONSENT_VERSION}`;

const defaultConsent: Omit<CookieConsent, 'timestamp'> = {
  necessary: true,
  analytics: false,
  marketing: false,
  version: CONSENT_VERSION,
};

interface CookieConsentProviderProps {
  children: ReactNode;
}

export const CookieConsentProvider: React.FC<CookieConsentProviderProps> = ({ children }) => {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Load consent from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }
    // Hash tab ile doğrudan modal açma (#cookie-preferences)
    if (window.location.hash === '#cookie-preferences') {
      setShowModal(true);
    }
    const hashListener = () => {
      try {
        const hashValue = window.location.hash;
        logger.debug('[cookie] hashchange ->', hashValue);
        if (hashValue === '#cookie-preferences') {
          logger.debug('[cookie] setting showModal true via hash');
          setShowModal(true);
        } else {
          logger.debug('[cookie] hash cleared, closing modal');
          setShowModal(false);
        }
      } catch (e) {
        logger.warn('[cookie] hash listener error', e);
      }
    };
    window.addEventListener('hashchange', hashListener);
    // Global event-based open/close (yedek mekanizma)
    const openEvt: EventListener = () => {
      logger.debug('[cookie] open-cookie-preferences event');
      setShowModal(true);
    };
    const closeEvt: EventListener = () => {
      logger.debug('[cookie] close-cookie-preferences event');
      setShowModal(false);
    };
    window.addEventListener('open-cookie-preferences', openEvt);
    window.addEventListener('close-cookie-preferences', closeEvt);
    const parsed = parseLocalObject<CookieConsent>(safeLocalStorage.getItem(CONSENT_KEY), 'cookie consent cache');

    if (parsed) {
      if (parsed.version === CONSENT_VERSION) {
        setConsent(parsed);
        setHasConsent(true);
        setShowBanner(false);

        // Update analytics manager with loaded consent
        analyticsManager.updateConsent(parsed);

        logger.info('✅ Cookie consent loaded from storage:', parsed);
      } else {
        // Version mismatch, show banner again
        logger.warn('⚠️ Cookie consent version mismatch, showing banner');
        setShowBanner(true);
      }
    } else {
      // No consent found, show banner
      logger.info('ℹ️ No cookie consent found, showing banner');
      setShowBanner(true);
    }
    return () => {
      window.removeEventListener('hashchange', hashListener);
      window.removeEventListener('open-cookie-preferences', openEvt);
      window.removeEventListener('close-cookie-preferences', closeEvt);
    };
  }, []);

  const saveConsent = (newConsent: CookieConsent) => {
    const consentWithTimestamp = {
      ...newConsent,
      timestamp: Date.now(),
      version: CONSENT_VERSION
    };
    
    safeLocalStorage.setItem(CONSENT_KEY, JSON.stringify(consentWithTimestamp));
    setConsent(consentWithTimestamp);
    setHasConsent(true);
    setShowBanner(false);
    setShowModal(false);
    // Clear hash if it was used to open modal
    if (typeof window !== 'undefined' && window.location.hash === '#cookie-preferences') {
      const url = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', url);
      logger.debug('[cookie] cleared hash after save');
    }
    
    logger.info('💾 Cookie consent saved:', consentWithTimestamp);
    
    // Update analytics manager
    analyticsManager.updateConsent(consentWithTimestamp);
    
    // Trigger analytics initialization if analytics is enabled
    if (consentWithTimestamp.analytics && !consent?.analytics) {
      logger.info('📊 Analytics consent granted, initializing...');
    }
    
    // Trigger marketing initialization if marketing is enabled
    if (consentWithTimestamp.marketing && !consent?.marketing) {
      logger.info('📈 Marketing consent granted, initializing...');
    }
  };

  const updateConsent = (newConsent: Partial<CookieConsent>) => {
    const updatedConsent = {
      ...defaultConsent,
      ...consent,
      ...newConsent,
      necessary: true, // Always true
      timestamp: Date.now()
    };
    saveConsent(updatedConsent);
  };

  const acceptAll = () => {
    const allAcceptedConsent = {
      ...defaultConsent,
      analytics: true,
      marketing: true,
      timestamp: Date.now()
    };
    saveConsent(allAcceptedConsent);
  };

  const rejectAll = () => {
    const rejectedConsent = {
      ...defaultConsent,
      analytics: false,
      marketing: false,
      timestamp: Date.now()
    };
    saveConsent(rejectedConsent);
  };

  const openModal = () => {
    logger.debug('[cookie] openModal called');
    setShowModal(true);
  };

  const closeModal = () => {
    logger.debug('[cookie] closeModal called');
    setShowModal(false);
    // Clear hash to avoid re-open
    if (typeof window !== 'undefined' && window.location.hash === '#cookie-preferences') {
      const url = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', url);
      logger.debug('[cookie] cleared hash on close');
    }
    // Dispatch a close event for listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('close-cookie-preferences'));
    }
  };

  const closeBanner = () => {
    setShowBanner(false);
  };

  const resetConsent = () => {
    safeLocalStorage.removeItem(CONSENT_KEY);
    setConsent(null);
    setHasConsent(false);
    setShowBanner(true);
    setShowModal(false);
    logger.warn('🗑️ Cookie consent reset');
  };

  const value: CookieConsentContextType = {
    consent,
    hasConsent,
    showBanner,
    showModal,
    updateConsent,
    acceptAll,
    rejectAll,
    openModal,
    closeModal,
    closeBanner,
    resetConsent
  };

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
};

export const useCookieConsent = (): CookieConsentContextType => {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  }
  return context;
};

// Utility function to check if a specific category is consented
export const hasConsentFor = (category: keyof Omit<CookieConsent, 'version' | 'timestamp'>): boolean => {
  const consent = parseLocalObject<CookieConsent>(safeLocalStorage.getItem(CONSENT_KEY), 'cookie consent cache');
  if (!consent || consent.version !== CONSENT_VERSION) return false;
  return consent[category] === true;
};

// Utility function for analytics initialization
export const initializeAnalytics = () => {
  if (!hasConsentFor('analytics')) {
    logger.info('🚫 Analytics blocked: no consent');
    return;
  }
  
  logger.info('📊 Analytics consent granted, ready to initialize');
  // Your analytics initialization code here
  // Example: Google Analytics, Matomo, etc.
};
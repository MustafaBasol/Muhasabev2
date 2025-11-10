import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { analyticsManager } from '../utils/analyticsManager';
import { logger } from '../utils/logger';

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
    // Hash tab ile doğrudan modal açma (#cookie-preferences)
    try {
      if (window.location.hash === '#cookie-preferences') {
        setShowModal(true);
      }
    } catch {}
    const hashListener = () => {
      try {
        const h = window.location.hash;
        console.debug('[cookie] hashchange ->', h);
        if (h === '#cookie-preferences') {
          console.debug('[cookie] setting showModal true via hash');
          setShowModal(true);
        } else if (h !== '#cookie-preferences') {
          console.debug('[cookie] non-preferences hash, ensure modal closed');
          setShowModal(false);
        }
      } catch (e) {
        console.warn('[cookie] hash listener error', e);
      }
    };
    window.addEventListener('hashchange', hashListener);
  // Global event-based open/close (yedek mekanizma)
  const openEvt = () => { console.debug('[cookie] open-cookie-preferences event'); setShowModal(true); };
  const closeEvt = () => { console.debug('[cookie] close-cookie-preferences event'); setShowModal(false); };
  window.addEventListener('open-cookie-preferences', openEvt as EventListener);
  window.addEventListener('close-cookie-preferences', closeEvt as EventListener);
    const savedConsent = localStorage.getItem(CONSENT_KEY);
    
    if (savedConsent) {
      try {
        const parsed: CookieConsent = JSON.parse(savedConsent);
        
        // Check if version matches
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
      } catch (error) {
        console.error('Error parsing cookie consent:', error);
        setShowBanner(true);
      }
    } else {
      // No consent found, show banner
      logger.info('ℹ️ No cookie consent found, showing banner');
      setShowBanner(true);
    }
    return () => {
      window.removeEventListener('hashchange', hashListener);
      window.removeEventListener('open-cookie-preferences', openEvt as EventListener);
      window.removeEventListener('close-cookie-preferences', closeEvt as EventListener);
    };
  }, []);

  const saveConsent = (newConsent: CookieConsent) => {
    const consentWithTimestamp = {
      ...newConsent,
      timestamp: Date.now(),
      version: CONSENT_VERSION
    };
    
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consentWithTimestamp));
    setConsent(consentWithTimestamp);
    setHasConsent(true);
    setShowBanner(false);
    setShowModal(false);
    // Clear hash if it was used to open modal
    try {
      if (typeof window !== 'undefined' && window.location.hash === '#cookie-preferences') {
        const url = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', url);
        console.debug('[cookie] cleared hash after save');
      }
    } catch {}
    
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
    try { console.debug('[cookie] openModal called'); } catch {}
    setShowModal(true);
  };

  const closeModal = () => {
    try { console.debug('[cookie] closeModal called'); } catch {}
    setShowModal(false);
    // Clear hash to avoid re-open
    try {
      if (typeof window !== 'undefined' && window.location.hash === '#cookie-preferences') {
        const url = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', url);
        console.debug('[cookie] cleared hash on close');
      }
    } catch {}
    // Dispatch a close event for listeners
    try { window.dispatchEvent(new Event('close-cookie-preferences')); } catch {}
  };

  const closeBanner = () => {
    setShowBanner(false);
  };

  const resetConsent = () => {
    localStorage.removeItem(CONSENT_KEY);
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

// eslint-disable-next-line react-refresh/only-export-components
export const useCookieConsent = (): CookieConsentContextType => {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  }
  return context;
};

// Utility function to check if a specific category is consented
// eslint-disable-next-line react-refresh/only-export-components
export const hasConsentFor = (category: keyof Omit<CookieConsent, 'version' | 'timestamp'>): boolean => {
  const savedConsent = localStorage.getItem(CONSENT_KEY);
  if (!savedConsent) return false;
  
  try {
    const consent: CookieConsent = JSON.parse(savedConsent);
    return consent[category] === true;
  } catch {
    return false;
  }
};

// Utility function for analytics initialization
// eslint-disable-next-line react-refresh/only-export-components
export const initializeAnalytics = () => {
  if (!hasConsentFor('analytics')) {
    logger.info('🚫 Analytics blocked: no consent');
    return;
  }
  
  logger.info('📊 Analytics consent granted, ready to initialize');
  // Your analytics initialization code here
  // Example: Google Analytics, Matomo, etc.
};
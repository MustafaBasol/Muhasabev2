import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { analyticsManager } from '../utils/analyticsManager';

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
          
          console.log('✅ Cookie consent loaded from storage:', parsed);
        } else {
          // Version mismatch, show banner again
          console.log('⚠️ Cookie consent version mismatch, showing banner');
          setShowBanner(true);
        }
      } catch (error) {
        console.error('Error parsing cookie consent:', error);
        setShowBanner(true);
      }
    } else {
      // No consent found, show banner
      console.log('ℹ️ No cookie consent found, showing banner');
      setShowBanner(true);
    }
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
    
    console.log('💾 Cookie consent saved:', consentWithTimestamp);
    
    // Update analytics manager
    analyticsManager.updateConsent(consentWithTimestamp);
    
    // Trigger analytics initialization if analytics is enabled
    if (consentWithTimestamp.analytics && !consent?.analytics) {
      console.log('📊 Analytics consent granted, initializing...');
    }
    
    // Trigger marketing initialization if marketing is enabled
    if (consentWithTimestamp.marketing && !consent?.marketing) {
      console.log('📈 Marketing consent granted, initializing...');
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
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
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
    console.log('🗑️ Cookie consent reset');
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
export const initializeAnalytics = () => {
  if (!hasConsentFor('analytics')) {
    console.log('🚫 Analytics blocked: no consent');
    return;
  }
  
  console.log('📊 Analytics consent granted, ready to initialize');
  // Your analytics initialization code here
  // Example: Google Analytics, Matomo, etc.
};
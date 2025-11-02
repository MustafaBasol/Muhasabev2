import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { logger } from '../utils/logger';

export type Currency = 'TRY' | 'USD' | 'EUR';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatCurrency: (amount: number) => string;
  getCurrencySymbol: () => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

interface CurrencyProviderProps {
  children: ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
  // LocalStorage'dan currency tercihini oku, yoksa TRY kullan
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem('currency');
    return (saved as Currency) || 'TRY';
  });

  // Currency değiştiğinde localStorage'a kaydet
  useEffect(() => {
    logger.debug('[CurrencyContext] Currency changed, saving to localStorage:', currency);
    localStorage.setItem('currency', currency);
  }, [currency]);

  const setCurrency = (newCurrency: Currency) => {
    logger.info('[CurrencyContext] setCurrency called with:', newCurrency);
    setCurrencyState(newCurrency);
  };

  const getCurrencySymbol = (): string => {
    switch (currency) {
      case 'TRY':
        return '₺';
      case 'USD':
        return '$';
      case 'EUR':
        return '€';
      default:
        return '₺';
    }
  };

  const formatCurrency = (amount: number): string => {
    const safe = typeof amount === 'number' ? amount : 0;
    const symbol = getCurrencySymbol();
    
    // Farklı para birimleri için farklı formatlar
    switch (currency) {
      case 'TRY':
        // Türk Lirası: ₺1.234,56
        return `${symbol}${safe.toLocaleString('tr-TR', { 
          minimumFractionDigits: 2,
          maximumFractionDigits: 2 
        })}`;
      
      case 'USD':
      case 'EUR':
        // USD ve EUR: $1,234.56 veya €1,234.56
        return `${symbol}${safe.toLocaleString('en-US', { 
          minimumFractionDigits: 2,
          maximumFractionDigits: 2 
        })}`;
      
      default:
        return `${symbol}${safe.toLocaleString('tr-TR', { 
          minimumFractionDigits: 2,
          maximumFractionDigits: 2 
        })}`;
    }
  };

  const value: CurrencyContextType = {
    currency,
    setCurrency,
    formatCurrency,
    getCurrencySymbol,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

// Custom hook to use currency context
// eslint-disable-next-line react-refresh/only-export-components
export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

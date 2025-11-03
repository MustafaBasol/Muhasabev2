import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { logger } from '../utils/logger';

export type Currency = 'TRY' | 'USD' | 'EUR' | 'GBP';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  // Optional override to format in a specific currency (e.g., per-quote),
  // falls back to current system currency when not provided.
  formatCurrency: (amount: number, currencyOverride?: Currency) => string;
  getCurrencySymbol: (currencyOverride?: Currency) => string;
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

  const getCurrencySymbol = (currencyOverride?: Currency): string => {
    const c = currencyOverride ?? currency;
    switch (c) {
      case 'TRY':
        return '₺';
      case 'USD':
        return '$';
      case 'EUR':
        return '€';
      case 'GBP':
        return '£';
      default:
        return '₺';
    }
  };

  const formatCurrency = (amount: number, currencyOverride?: Currency): string => {
    const safe = typeof amount === 'number' ? amount : 0;
    const c = currencyOverride ?? currency;
    const symbol = getCurrencySymbol(c);
    
    // Farklı para birimleri için farklı formatlar
    switch (c) {
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
      case 'GBP':
        // GBP: £1,234.56 (en-GB)
        return `${symbol}${safe.toLocaleString('en-GB', {
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

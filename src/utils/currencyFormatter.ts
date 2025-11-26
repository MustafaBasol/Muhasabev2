import { safeLocalStorage } from './localStorageSafe';
export type Currency = 'TRY' | 'USD' | 'EUR';

export interface CurrencyConfig {
  symbol: string;
  locale: string;
  name: string;
}

export const currencyConfigs: Record<Currency, CurrencyConfig> = {
  TRY: {
    symbol: '₺',
    locale: 'tr-TR',
    name: 'Türk Lirası',
  },
  USD: {
    symbol: '$',
    locale: 'en-US',
    name: 'US Dollar',
  },
  EUR: {
    symbol: '€',
    locale: 'en-US', // EUR için en-US formatı kullanıyoruz (1,234.56)
    name: 'Euro',
  },
};

/**
 * Para birimi sembolünü döndürür
 */
export const getCurrencySymbol = (currency: Currency): string => {
  return currencyConfigs[currency]?.symbol || '₺';
};

/**
 * Miktarı para birimi formatında gösterir
 * TRY: ₺1.234,56
 * USD: $1,234.56
 * EUR: €1,234.56
 */
export const formatCurrency = (amount: number, currency: Currency = 'TRY'): string => {
  const safe = typeof amount === 'number' ? amount : 0;
  const config = currencyConfigs[currency];
  
  if (!config) {
    return `₺${safe.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return `${config.symbol}${safe.toLocaleString(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Kompakt format (büyük sayılar için)
 * Örn: ₺2.1M, $450K, €1.5B
 */
export const formatCurrencyCompact = (amount: number, currency: Currency = 'TRY'): string => {
  const safe = typeof amount === 'number' ? amount : 0;
  const symbol = getCurrencySymbol(currency);
  const absAmount = Math.abs(safe);

  if (absAmount >= 1_000_000_000) {
    return `${symbol}${(safe / 1_000_000_000).toFixed(2)}B`;
  }
  if (absAmount >= 1_000_000) {
    return `${symbol}${(safe / 1_000_000).toFixed(2)}M`;
  }
  if (absAmount >= 1_000) {
    return `${symbol}${(safe / 1_000).toFixed(2)}K`;
  }
  
  return formatCurrency(safe, currency);
};

/**
 * LocalStorage'dan currency tercihini oku
 */
export const getSavedCurrency = (): Currency => {
  const saved = safeLocalStorage.getItem('currency');
  return (saved as Currency) || 'TRY';
};

/**
 * LocalStorage'a currency tercihini kaydet
 */
export const saveCurrency = (currency: Currency): void => {
  safeLocalStorage.setItem('currency', currency);
};

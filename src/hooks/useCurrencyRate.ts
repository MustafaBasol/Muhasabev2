import { useState, useEffect } from 'react';

interface CurrencyRate {
  rate: number;
  lastUpdated: Date;
}

const FALLBACK_RATE = 32.45;

export const useCurrencyRate = () => {
  const [currencyRate, setCurrencyRate] = useState<CurrencyRate>({
    rate: FALLBACK_RATE,
    lastUpdated: new Date()
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        // 3 saniye timeout ile API çağrısı
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();
        
        if (data.rates && data.rates.TRY) {
          setCurrencyRate({
            rate: parseFloat(data.rates.TRY.toFixed(2)),
            lastUpdated: new Date()
          });
        } else {
          throw new Error('TRY rate not found');
        }
      } catch (error) {
        console.warn('Currency rate fetch failed, using fallback:', error);
        // Fallback rate kullan
        setCurrencyRate({
          rate: FALLBACK_RATE,
          lastUpdated: new Date()
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchRate();
    
    // Her 30 dakikada bir güncelle
    const interval = setInterval(fetchRate, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return { currencyRate, isLoading };
};
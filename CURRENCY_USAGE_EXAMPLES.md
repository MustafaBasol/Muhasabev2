# Para Birimi Kullanım Örnekleri

## 1. Context Hook Kullanımı (Component içinde)

```tsx
import { useCurrency } from '../contexts/CurrencyContext';

function MyComponent() {
  const { currency, setCurrency, formatCurrency, getCurrencySymbol } = useCurrency();

  return (
    <div>
      {/* Mevcut para birimi */}
      <p>Aktif Para Birimi: {currency}</p>
      
      {/* Sembol */}
      <p>Sembol: {getCurrencySymbol()}</p>
      
      {/* Formatlanmış miktar */}
      <p>Fiyat: {formatCurrency(1234.56)}</p>
      
      {/* Para birimi değiştir */}
      <button onClick={() => setCurrency('USD')}>USD'ye Geç</button>
      <button onClick={() => setCurrency('EUR')}>EUR'ya Geç</button>
      <button onClick={() => setCurrency('TRY')}>TRY'ye Geç</button>
    </div>
  );
}
```

## 2. Utility Fonksiyonları (Context dışında)

```tsx
import { formatCurrency, getCurrencySymbol, formatCurrencyCompact } from '../utils/currencyFormatter';

// Doğrudan formatla (currency parametresi ile)
const formatted = formatCurrency(1234.56, 'USD'); // $1,234.56

// Sembol al
const symbol = getCurrencySymbol('EUR'); // €

// Kompakt format (büyük sayılar için)
const compact = formatCurrencyCompact(2500000, 'TRY'); // ₺2.50M
```

## 3. Formatlar

### TRY (Türk Lirası)
- Format: `₺1.234,56`
- Locale: `tr-TR`
- Binlik ayracı: `.` (nokta)
- Ondalık ayracı: `,` (virgül)

### USD (US Dollar)
- Format: `$1,234.56`
- Locale: `en-US`
- Binlik ayracı: `,` (virgül)
- Ondalık ayracı: `.` (nokta)

### EUR (Euro)
- Format: `€1,234.56`
- Locale: `en-US`
- Binlik ayracı: `,` (virgül)
- Ondalık ayracı: `.` (nokta)

## 4. LocalStorage

Currency tercihi otomatik olarak `localStorage`'a kaydedilir:
- Key: `'currency'`
- Values: `'TRY'` | `'USD'` | `'EUR'`
- Sayfa yenilendiğinde tercih korunur

## 5. Kompakt Format Örnekleri

```tsx
formatCurrencyCompact(1500, 'TRY')        // ₺1.50K
formatCurrencyCompact(2500000, 'TRY')     // ₺2.50M
formatCurrencyCompact(1500000000, 'USD')  // $1.50B
```

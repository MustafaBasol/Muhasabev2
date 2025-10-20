# 🚀 Para Birimi Özelliği - Hızlı Başlangıç Kılavuzu

## 📖 Kullanıcı Kılavuzu

### Para Birimini Nasıl Değiştirebilirim?

1. **Settings Sayfasına Git**
   - Sol menüden ⚙️ Settings'e tıkla
   - Veya doğrudan: `http://localhost:5174/#/settings`

2. **Para Birimini Seç**
   - "Para Birimi" başlığını bul
   - Dropdown menüden birini seç:
     - 🇹🇷 **Türk Lirası (₺)** - Türkiye
     - 🇺🇸 **US Dollar ($)** - Amerika
     - 🇪🇺 **Euro (€)** - Avrupa

3. **Değişiklik Anında Uygulanır**
   - Kaydet butonuna basmana gerek yok
   - Tüm sayfalarda para birimi anında güncellenir
   - Tarayıcıyı kapatsana bile ayarın kalır

---

## 👨‍💻 Geliştirici Kılavuzu

### Yeni Bir Component'te Currency Kullanımı

```typescript
// 1. Import ekle
import { useCurrency } from '../contexts/CurrencyContext';

// 2. Component içinde hook kullan
export default function MyComponent() {
  const { formatCurrency, getCurrencySymbol, currency } = useCurrency();
  
  // 3. Formatla
  const price = 1234.56;
  const formatted = formatCurrency(price);
  // Çıktı: ₺1.234,56 veya $1,234.56 veya €1,234.56
  
  // 4. Sadece sembol lazımsa
  const symbol = getCurrencySymbol();
  // Çıktı: ₺ veya $ veya €
  
  // 5. Mevcut currency'i öğren
  console.log(currency); // 'TRY' | 'USD' | 'EUR'
  
  return (
    <div>
      <p>Fiyat: {formatted}</p>
      <p>Sembol: {symbol}</p>
    </div>
  );
}
```

### Context-Free Kullanım (Utility)

```typescript
// Context'e bağımlı değilsen, direkt utility kullan
import { formatCurrency, getCurrencySymbol } from '../utils/currencyFormatter';

// Belirli bir para birimiyle formatla
const tryAmount = formatCurrency(1000, 'TRY'); // ₺1.000,00
const usdAmount = formatCurrency(1000, 'USD'); // $1,000.00
const eurAmount = formatCurrency(1000, 'EUR'); // €1,000.00

// Kompakt format (büyük sayılar için)
import { formatCurrencyCompact } from '../utils/currencyFormatter';
const compact = formatCurrencyCompact(2500000, 'TRY'); // ₺2.50M
```

### Yeni Para Birimi Ekleme

```typescript
// 1. src/utils/currencyFormatter.ts dosyasını aç
// 2. Currency type'ına ekle
export type Currency = 'TRY' | 'USD' | 'EUR' | 'GBP'; // 👈 GBP eklendi

// 3. currencyConfigs'e ekle
export const currencyConfigs: Record<Currency, CurrencyConfig> = {
  // ... mevcut olanlar
  GBP: {
    symbol: '£',
    locale: 'en-GB',
    name: 'British Pound',
  },
};

// 4. src/components/SettingsPage.tsx'te dropdown'a ekle
<option value="GBP">🇬🇧 British Pound (£)</option>
```

---

## 🎯 Örnekler

### Örnek 1: Basit Fiyat Gösterimi

```typescript
import { useCurrency } from '../contexts/CurrencyContext';

function ProductCard({ product }) {
  const { formatCurrency } = useCurrency();
  
  return (
    <div className="product-card">
      <h3>{product.name}</h3>
      <p className="price">{formatCurrency(product.price)}</p>
    </div>
  );
}
```

### Örnek 2: Toplam Hesaplama

```typescript
import { useCurrency } from '../contexts/CurrencyContext';

function InvoiceTotal({ items }) {
  const { formatCurrency } = useCurrency();
  
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * 0.18; // KDV %18
  const total = subtotal + tax;
  
  return (
    <div className="invoice-total">
      <div>Ara Toplam: {formatCurrency(subtotal)}</div>
      <div>KDV (%18): {formatCurrency(tax)}</div>
      <div>Genel Toplam: {formatCurrency(total)}</div>
    </div>
  );
}
```

### Örnek 3: Para Birimi Değişikliğini Dinleme

```typescript
import { useCurrency } from '../contexts/CurrencyContext';
import { useEffect } from 'react';

function CurrencyWatcher() {
  const { currency } = useCurrency();
  
  useEffect(() => {
    console.log('Para birimi değişti:', currency);
    // Burada currency değişince yapılacak işlemler
  }, [currency]);
  
  return <div>Mevcut: {currency}</div>;
}
```

### Örnek 4: Multi-Currency (Banka Hesapları Gibi)

```typescript
import { formatCurrency as formatUtil } from '../utils/currencyFormatter';

function BankAccount({ account }) {
  // Her hesabın kendi currency'si var
  const formatted = formatUtil(account.balance, account.currency as Currency);
  
  return (
    <div className="bank-account">
      <h3>{account.name}</h3>
      <p className="balance">{formatted}</p>
      <small>Currency: {account.currency}</small>
    </div>
  );
}
```

---

## 🔧 Troubleshooting

### Sorun: Para birimi değişmiyor
**Çözüm:**
1. Component'in `useCurrency` hook'unu kullandığından emin ol
2. Browser'ı hard refresh yap (Ctrl+Shift+R)
3. LocalStorage'ı temizle: `localStorage.removeItem('currency')`

### Sorun: Format yanlış gösteriliyor
**Çözüm:**
1. `formatCurrency` fonksiyonunu kullandığından emin ol
2. Hardcoded formatlar kalmış olabilir (örn: `₺${amount}`)
3. Console'da hata var mı kontrol et

### Sorun: Tarayıcı kapatınca ayar kayboldu
**Çözüm:**
1. LocalStorage çalışıyor mu kontrol et
2. Incognito/Private mode kullanıyorsan LocalStorage çalışmaz
3. Browser ayarlarında "Cookies and site data" silinmeye ayarlanmış olabilir

### Sorun: TypeScript hatası alıyorum
**Çözüm:**
```typescript
// ✅ Doğru kullanım
import { useCurrency } from '../contexts/CurrencyContext';
const { formatCurrency } = useCurrency();

// ❌ Yanlış - direkt CurrencyContext'i import etme
import { CurrencyContext } from '../contexts/CurrencyContext';
```

---

## 📚 API Referansı

### useCurrency Hook

```typescript
const {
  currency,           // 'TRY' | 'USD' | 'EUR'
  setCurrency,        // (currency: Currency) => void
  formatCurrency,     // (amount: number) => string
  getCurrencySymbol   // () => string
} = useCurrency();
```

#### currency
- **Type**: `'TRY' | 'USD' | 'EUR'`
- **Description**: Aktif para birimi
- **Example**: `if (currency === 'TRY') { ... }`

#### setCurrency
- **Type**: `(currency: Currency) => void`
- **Description**: Para birimini değiştir
- **Example**: `setCurrency('USD')`

#### formatCurrency
- **Type**: `(amount: number) => string`
- **Description**: Sayıyı para birimi formatında döndür
- **Example**: `formatCurrency(1234.56)` → `"₺1.234,56"`

#### getCurrencySymbol
- **Type**: `() => string`
- **Description**: Aktif para biriminin sembolünü döndür
- **Example**: `getCurrencySymbol()` → `"₺"`

### Utility Functions

```typescript
import { 
  formatCurrency, 
  getCurrencySymbol,
  formatCurrencyCompact,
  getSavedCurrency,
  saveCurrency
} from '../utils/currencyFormatter';
```

#### formatCurrency(amount, currency)
- **Parameters**: 
  - `amount: number` - Formatlanacak sayı
  - `currency: Currency` - Para birimi (opsiyonel, default: 'TRY')
- **Returns**: `string`
- **Example**: `formatCurrency(1000, 'USD')` → `"$1,000.00"`

#### getCurrencySymbol(currency)
- **Parameters**: `currency: Currency`
- **Returns**: `string`
- **Example**: `getCurrencySymbol('EUR')` → `"€"`

#### formatCurrencyCompact(amount, currency)
- **Parameters**: 
  - `amount: number` - Büyük sayı
  - `currency: Currency`
- **Returns**: `string`
- **Example**: `formatCurrencyCompact(2500000, 'TRY')` → `"₺2.50M"`

#### getSavedCurrency()
- **Returns**: `Currency`
- **Description**: LocalStorage'dan kaydedilmiş para birimini al
- **Example**: `const saved = getSavedCurrency()` → `'TRY'`

#### saveCurrency(currency)
- **Parameters**: `currency: Currency`
- **Returns**: `void`
- **Description**: Para birimini LocalStorage'a kaydet
- **Example**: `saveCurrency('USD')`

---

## 🎓 Best Practices

### ✅ Yapılması Gerekenler

1. **Her zaman `useCurrency` kullan** (component içinde)
```typescript
const { formatCurrency } = useCurrency();
return <p>{formatCurrency(price)}</p>;
```

2. **Type safety sağla**
```typescript
import type { Currency } from '../utils/currencyFormatter';
const currency: Currency = 'TRY';
```

3. **Null/undefined kontrolü yap**
```typescript
const formatted = formatCurrency(price || 0);
```

4. **Dependency array'e ekle**
```typescript
useEffect(() => {
  // ...
}, [currency]); // 👈 currency değişince tetiklen
```

### ❌ Yapılmaması Gerekenler

1. **Hardcoded sembol kullanma**
```typescript
// ❌ Kötü
return <p>₺{price.toFixed(2)}</p>;

// ✅ İyi
return <p>{formatCurrency(price)}</p>;
```

2. **Manuel formatla**
```typescript
// ❌ Kötü
const formatted = `${currency === 'TRY' ? '₺' : '$'}${price}`;

// ✅ İyi
const formatted = formatCurrency(price);
```

3. **Context'i direkt kullan**
```typescript
// ❌ Kötü
import { CurrencyContext } from '../contexts/CurrencyContext';
const context = useContext(CurrencyContext);

// ✅ İyi
import { useCurrency } from '../contexts/CurrencyContext';
const { formatCurrency } = useCurrency();
```

---

## 📞 Yardım ve Destek

### Dokümantasyon
- [CURRENCY_IMPLEMENTATION_COMPLETE.md](./CURRENCY_IMPLEMENTATION_COMPLETE.md) - Tam implementasyon detayları
- [CURRENCY_USAGE_EXAMPLES.md](./CURRENCY_USAGE_EXAMPLES.md) - Kod örnekleri
- [CURRENCY_TEST_CHECKLIST.md](./CURRENCY_TEST_CHECKLIST.md) - Test kontrol listesi

### Kod Örnekleri
Güncellenen component'lerde örnekler:
- `src/components/RecentTransactions.tsx` - Basit kullanım
- `src/components/ProductList.tsx` - Liste formatı
- `src/components/BankList.tsx` - Multi-currency

### Debug
Browser Console'da:
```javascript
// Mevcut currency'i öğren
localStorage.getItem('currency')

// Currency'i manuel değiştir
localStorage.setItem('currency', 'USD')
window.location.reload()

// Currency'i sıfırla
localStorage.removeItem('currency')
window.location.reload()
```

---

## 🎉 Özet

Bu rehber ile:
- ✅ Para birimini nasıl değiştireceğini öğrendin (kullanıcı)
- ✅ Component'lerde nasıl kullanacağını öğrendin (geliştirici)
- ✅ Yeni para birimi nasıl ekleneceğini öğrendin
- ✅ Sorun giderme yöntemlerini öğrendin
- ✅ Best practice'leri öğrendin

**Artık para birimi özelliğini kullanmaya hazırsın! 🚀**

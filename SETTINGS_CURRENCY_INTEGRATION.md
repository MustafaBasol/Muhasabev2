# Settings Page - Currency Integration Test

## ✅ Tamamlanan Değişiklikler

### 1. **Import Eklendi**
```tsx
import { useCurrency } from '../contexts/CurrencyContext';
```

### 2. **Currency Hook Kullanımı**
```tsx
// Currency context
const { currency, setCurrency } = useCurrency();
```

### 3. **State'ten Currency Kaldırıldı**
```tsx
// ÖNCE:
const [systemSettings, setSystemSettings] = useState({
  language: 'tr',
  currency: 'TRY',  // ❌ Kaldırıldı
  dateFormat: 'DD/MM/YYYY',
  timezone: 'Europe/Istanbul',
  theme: 'light',
});

// SONRA:
const [systemSettings, setSystemSettings] = useState({
  language: 'tr',
  dateFormat: 'DD/MM/YYYY',
  timezone: 'Europe/Istanbul',
  theme: 'light',
});
```

### 4. **handleSystemChange Güncellendi**
```tsx
const handleSystemChange = (field: string, value: string | boolean) => {
  // Currency değişikliği context'e git
  if (field === 'currency') {
    setCurrency(value as 'TRY' | 'USD' | 'EUR');
  } else {
    setSystemSettings(prev => ({ ...prev, [field]: value }));
  }
  setUnsavedChanges(true);
};
```

### 5. **Currency Select Güncellendi**
```tsx
// ÖNCE:
<select
  value={systemSettings.currency}  // ❌
  onChange={e => handleSystemChange('currency', e.target.value)}
>

// SONRA:
<select
  value={currency}  // ✅ Context'ten geliyor
  onChange={e => handleSystemChange('currency', e.target.value)}
>
```

## 🧪 Test Senaryosu

1. **Settings sayfasını aç**
2. **Sistem tabına git**
3. **Para birimini değiştir** (TRY → USD → EUR)
4. **Beklenen Sonuç:**
   - ✅ Dropdown anında güncellenir
   - ✅ localStorage'a kaydedilir
   - ✅ Context state değişir
   - ✅ Tüm uygulama yeni currency'yi kullanır
5. **Sayfayı yenile**
6. **Beklenen Sonuç:**
   - ✅ Seçili currency korunur (localStorage'dan okunur)

## 📊 Etki Alanı

Currency değişikliği artık **global** olarak tüm uygulamayı etkiler:
- Dashboard
- Invoice/Fatura sayfaları
- Expense/Gider sayfaları
- Product/Ürün sayfaları
- Reports/Raporlar
- Chart of Accounts/Hesap Planı
- Tüm para birimi gösterimleri

## 🔄 Sıradaki Adım

**Aşama 4:** Tüm sayfalardaki hardcoded `₺` sembollerini `useCurrency()` ile değiştir

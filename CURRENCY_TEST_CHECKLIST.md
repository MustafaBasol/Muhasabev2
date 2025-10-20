# 🧪 Para Birimi (Currency) Test Kontrol Listesi

## Test Ortamı
- **Frontend**: http://localhost:5174
- **Backend**: http://localhost:3002
- **Tarih**: Ekim 2025

---

## ✅ Temel Testler

### 1. Settings Sayfası
- [ ] Settings sayfasına git
- [ ] "Para Birimi" dropdown'unu bul
- [ ] Dropdown'da 3 seçenek olmalı:
  - [ ] Türk Lirası (₺)
  - [ ] US Dollar ($)
  - [ ] Euro (€)

### 2. TRY (₺) Testi
- [ ] Settings'ten "Türk Lirası (₺)" seç
- [ ] Dashboard'a dön
- [ ] Tüm tutarlar ₺ sembolü ile gösteriliyor mu?
- [ ] Format: ₺1.234,56 (nokta bin ayracı, virgül ondalık)

### 3. USD ($) Testi
- [ ] Settings'ten "US Dollar ($)" seç
- [ ] Dashboard'a dön
- [ ] Tüm tutarlar $ sembolü ile gösteriliyor mu?
- [ ] Format: $1,234.56 (virgül bin ayracı, nokta ondalık)

### 4. EUR (€) Testi
- [ ] Settings'ten "Euro (€)" seç
- [ ] Dashboard'a dön
- [ ] Tüm tutarlar € sembolü ile gösteriliyor mu?
- [ ] Format: €1,234.56 (virgül bin ayracı, nokta ondalık)

### 5. LocalStorage Persistence
- [ ] Para birimini değiştir (örn: USD)
- [ ] Tarayıcıyı tamamen kapat
- [ ] Tarayıcıyı tekrar aç
- [ ] Aynı para birimi (USD) seçili mi?

---

## 📄 Sayfa Bazlı Testler

### Dashboard (Ana Sayfa)
- [ ] **Toplam Gelir Kartı**: Para birimi doğru mu?
- [ ] **Toplam Gider Kartı**: Para birimi doğru mu?
- [ ] **Net Kar Kartı**: Para birimi doğru mu?
- [ ] **Son İşlemler**: Tüm tutarlar doğru mu?
- [ ] **Grafik Kartları**: X ve Y ekseni para birimleri doğru mu?

### Ürünler Sayfası
- [ ] **Ürün Listesi**: Birim fiyat ve maliyet fiyatı
- [ ] **Stok Değeri Kartı**: Toplam stok değeri
- [ ] **Ürün Detay Modal**: Fiyatlar doğru mu?
- [ ] **Ürün Ekle/Düzenle**: Input alanları ve önizleme

### Faturalar Sayfası
- [ ] **Fatura Listesi**: Fatura tutarları
- [ ] **Fatura Detay Modal**: 
  - [ ] Alt toplam
  - [ ] KDV
  - [ ] Genel Toplam
- [ ] **Yeni Fatura**: Hesaplanan tutarlar

### Giderler Sayfası
- [ ] **Gider Listesi**: Gider tutarları
- [ ] **Gider Detay Modal**: Tutar
- [ ] **Gider Ekle Modal**: 
  - [ ] Tutar input alanı
  - [ ] "Toplam Gider" önizleme kutusu

### Satışlar Sayfası
- [ ] **Satış Listesi**: Satış tutarları
- [ ] **Satış Detay Modal**: Tutar detayları
- [ ] **Toplam Satış Kartı**: Toplam

### Banka Hesapları
- [ ] **Hesap Listesi**: Her hesabın bakiyesi (kendi currency'sinde)
- [ ] **Hesap Detay Modal**: Bakiye
- [ ] **Yeni Hesap**: Default para birimi global ayardan geliyor mu?

### Raporlar Sayfası
- [ ] **Gelir/Gider Özeti**: Tüm tutarlar
- [ ] **En Çok Satan Ürünler**: Ürün tutarları
- [ ] **Gider Kategorileri**: Kategori tutarları
- [ ] **Müşteri Analizleri**: Müşteri tutarları
- [ ] **Grafikler**: Tüm grafiklerde para birimi

### Genel Muhasebe Defteri
- [ ] **İşlem Listesi**: Borç/Alacak tutarları
- [ ] **Toplam Bakiyeler**: Alt kısım toplamları

### Arşiv Sayfası
- [ ] **Arşivlenmiş Faturalar**: Tutarlar
- [ ] **Arşivlenmiş Giderler**: Tutarlar
- [ ] **Arşivlenmiş Satışlar**: Tutarlar

### Hesap Planı
- [ ] **Hesap Bakiyeleri**: Tüm hesap bakiyeleri
- [ ] **Toplam Aktif/Pasif**: Toplamlar

### Modal Testleri
- [ ] **Müşteri Geçmişi Modal**: İşlem tutarları
- [ ] **Tedarikçi Geçmişi Modal**: İşlem tutarları
- [ ] **Ürün Görüntüleme**: Fiyatlar
- [ ] **Fatura Görüntüleme**: Tüm tutarlar
- [ ] **Gider Görüntüleme**: Tutar
- [ ] **Satış Görüntüleme**: Tutar

---

## 🔄 Dinamik Değişim Testi

### Test Senaryosu 1: Hızlı Geçiş
1. [ ] Dashboard'da ol
2. [ ] Para birimini TRY'den USD'ye değiştir
3. [ ] Dashboard'daki tüm tutarlar anında değişiyor mu?
4. [ ] USD'den EUR'a değiştir
5. [ ] Yine anında değişiyor mu?

### Test Senaryosu 2: Sayfa Geçişleri
1. [ ] Para birimini USD yap
2. [ ] Dashboard → Ürünler → Faturalar → Giderler'i gez
3. [ ] Tüm sayfalarda $ sembolü görünüyor mu?
4. [ ] Settings'e dön, EUR yap
5. [ ] Aynı sayfaları tekrar gez
6. [ ] Tüm sayfalarda € sembolü görünüyor mu?

### Test Senaryosu 3: Modal İçinde Değişim
1. [ ] Bir fatura detayını aç (modal)
2. [ ] Settings'ten para birimini değiştir
3. [ ] Modal'ı kapat ve tekrar aç
4. [ ] Yeni para birimi ile gösteriliyor mu?

---

## 💾 Veri Tutarlılığı

### Database Test
- [ ] Veritabanındaki veriler para biriminden bağımsız (sadece sayı olarak saklanıyor)
- [ ] Para birimi değişince veriler bozulmuyor
- [ ] Yeni kayıtlar eklenebiliyor
- [ ] Eski kayıtlar düzgün gösteriliyor

### LocalStorage Test
```javascript
// Developer Console'da test et:
localStorage.getItem('currency')  // 'TRY', 'USD' veya 'EUR' dönmeli
```

---

## 🎨 Format Doğrulama

### TRY Format Kontrolleri
- [ ] Sembol: ₺
- [ ] Bin ayracı: nokta (.)
- [ ] Ondalık ayracı: virgül (,)
- [ ] Örnek: ₺1.234,56

### USD Format Kontrolleri
- [ ] Sembol: $
- [ ] Bin ayracı: virgül (,)
- [ ] Ondalık ayracı: nokta (.)
- [ ] Örnek: $1,234.56

### EUR Format Kontrolleri
- [ ] Sembol: €
- [ ] Bin ayracı: virgül (,)
- [ ] Ondalık ayracı: nokta (.)
- [ ] Örnek: €1,234.56

---

## 🐛 Hata Durumları

### Negatif Sayılar
- [ ] Negatif tutarlar doğru gösteriliyor mu? (örn: -₺100,00)

### Sıfır Değerler
- [ ] Sıfır tutarlar doğru gösteriliyor mu? (₺0,00)

### Çok Büyük Sayılar
- [ ] 1 milyon: ₺1.000.000,00 veya ₺1.00M
- [ ] 1 milyar: ₺1.000.000.000,00 veya ₺1.00B

### Null/Undefined
- [ ] Undefined tutar gösterilirse → ₺0,00 göstermeli

---

## 📱 Responsive Test

### Desktop (1920x1080)
- [ ] Tüm para birimi gösterimleri okunabilir mi?

### Tablet (768x1024)
- [ ] Para birimi sembolleri düzgün hizalanmış mı?

### Mobile (375x667)
- [ ] Para birimi tutarları kesilmeden görünüyor mu?

---

## ⚡ Performans

### Hız Testi
- [ ] Para birimi değişimi < 100ms
- [ ] Sayfa geçişleri akıcı
- [ ] Modal açılma/kapanma etkilenmiyor

### Memory Leak
- [ ] Para birimini 10 kez değiştir
- [ ] Memory kullanımı artıyor mu? (Developer Tools → Performance)

---

## ✅ Son Kontroller

### Kod Kalitesi
- [ ] `npm run build` hatasız çalışıyor
- [ ] TypeScript hatası yok
- [ ] ESLint uyarısı yok (currency ile ilgili)
- [ ] Console'da error yok

### Dokümantasyon
- [ ] CURRENCY_IMPLEMENTATION_COMPLETE.md güncel
- [ ] CURRENCY_USAGE_EXAMPLES.md güncel
- [ ] README.md'de currency özelliği belirtilmiş

### User Experience
- [ ] Dropdown kullanımı kolay
- [ ] Para birimi değişimi anlaşılır
- [ ] Tutarlar okunabilir
- [ ] Formatlar tutarlı

---

## 📊 Test Sonuçları

### Test Tarihi: ___________
### Test Eden: ___________

| Kategori | Başarılı | Başarısız | Notlar |
|----------|----------|-----------|--------|
| Temel Testler | ___ / 5 | ___ | |
| Dashboard | ___ / 5 | ___ | |
| Ürünler | ___ / 4 | ___ | |
| Faturalar | ___ / 3 | ___ | |
| Giderler | ___ / 3 | ___ | |
| Satışlar | ___ / 3 | ___ | |
| Banka | ___ / 3 | ___ | |
| Raporlar | ___ / 5 | ___ | |
| Diğer Sayfalar | ___ / 3 | ___ | |
| Modals | ___ / 7 | ___ | |
| Format | ___ / 9 | ___ | |
| Hata Durumları | ___ / 4 | ___ | |
| **TOPLAM** | **___ / 54** | **___** | |

### Genel Değerlendirme
- [ ] ✅ Tüm testler başarılı - Production'a hazır
- [ ] ⚠️ Küçük sorunlar var - Düzeltme gerekli
- [ ] ❌ Ciddi sorunlar var - Yeniden implementasyon gerekli

### Bulunan Sorunlar
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

### Öneriler
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

---

## 🎉 Test Tamamlandı!

**İmza**: ___________  
**Tarih**: ___________  
**Onay**: ☐ Evet  ☐ Hayır

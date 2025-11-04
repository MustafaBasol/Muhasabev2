# Admin Panel: Tenant Bazlı Plan Limitleri

Bu sayfa, belirli bir şirkete (tenant) plan varsayılanlarının üzerine ek/override limitler tanımlamanızı sağlar. Örnekler:
- Pro plandaki A şirketine +1 kullanıcı hakkı
- Free (starter) plandaki bir şirkete bu ay +5 fatura hakkı

## Nerede?
- Uygulamada Admin Panel → "🎛️ Tenant Limitleri" sekmesi

## Ne görürüm?
- Plan Varsayılanları: Seçili tenant’ın planına göre merkezi değerler
- Override (Tenant Özel): Bu tenant için ayarladığınız özel değerler
- Efektif Limitler: Varsayılan + Override birleştirilmiş sonuç
- Kullanım: Kullanıcı, Müşteri, Tedarikçi, Banka Hesabı sayıları ve bu ayki Fatura/Gider sayıları

## Nasıl kullanırım?
1. Üstteki seçim kutusundan bir şirket (tenant) seçin.
2. Override bölümünde istediğiniz alanları düzenleyin.
   - Boş: plan varsayılanı kullanılacak
   - -1: sınırsız
   - Pozitif sayı: yeni sınır değeridir (mutlak)
3. "Kaydet" ile override’ları uygulayın.
4. "Varsayılanlara Eşitle" butonu override alanlarını plan değerleriyle doldurur (override kaydı plan değerine eşitlenir).

## Teknik Notlar
- Depolama: `Tenant.settings.planOverrides` JSON alanı
- Backend endpoint’ler:
  - GET `/admin/tenant/:tenantId/limits` → { default, overrides, effective, usage }
  - PATCH `/admin/tenant/:tenantId/limits` → override güncelleme
- Limit denetimlerinin tamamı efektif limitlere göre yapılır:
  - Kullanıcı, Müşteri, Tedarikçi, Banka Hesabı oluşturma
  - Bu ay Fatura/Gider ekleme
- Hata mesajları efektif limitleri baz alır.

## Örnek Senaryolar
- A şirketi (Pro plan) için maxUsers=3 varsayılan. +1 kullanıcı için override’da maxUsers=4 girin ve kaydedin.
- Free planda aylık fatura varsayılanı 5 ise, 10 yapmak için override’da monthly.maxInvoices=10 girin.

## Geri Alma / Temizleme
- Override’ı tamamen temizlemek için şu anki UI, alanları boş bırakıp kaydettiğinizde plan varsayılana dönmenizi sağlar. Daha "override clear" odaklı bir buton ileride eklenebilir.

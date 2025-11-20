# Admin: CSV İhracı ve Plan Düşürme Yönetimi

Bu doküman, yönetim panelindeki iki operasyonel özelliği özetler:
- Kullanıcıları CSV olarak dışa aktarma
- Plan düşürme (downgrade) sırasında kullanıcı kısıtlarının yönetimi ve zorunlu azaltımın uygulanması

## CSV Dışa Aktarım

- Uç nokta: `GET /api/admin/users/export-csv` (opsiyonel `tenantId` query parametresi)
- Kimlik doğrulama: `admin-token` başlığı zorunlu
- İçerik tipi: `text/csv; charset=utf-8` (UTF-8 BOM içerir)
- Dosya adı: `users-export.csv` şeklinde Content-Disposition ile gelir

### Sütunlar
Aşağıdaki genişletilmiş kolon seti döner:
- ID, Ad, Soyad, Ad Soyad
- E-posta, Rol
- Aktif mi
- Kayıt Tarihi
- Son Giriş, Son Giriş TZ, Son Giriş UTC Dakika
- Tenant ID, Tenant Adı, Tenant Şirket, Tenant Slug

### Örnek kullanım
- Tüm kullanıcılar:
  - `curl -H 'admin-token: $ADMIN_TOKEN' -H 'Accept: text/csv' -L -o users.csv http://localhost:3001/api/admin/users/export-csv`
- Belirli tenant:
  - `curl -H 'admin-token: $ADMIN_TOKEN' -H 'Accept: text/csv' -L -o users_t.csv 'http://localhost:3001/api/admin/users/export-csv?tenantId=TENANT_ID'`

### Frontend
- Admin -> Kullanıcılar sekmesinde “CSV İndir” düğmesi
- Tenant Konsolu’nda (tek tenant görünümü) “CSV İndir” düğmesi

## Plan Düşürme Akışı

Plan değişiminde, yeni kullanıcı limitinin altına inmek için azaltım gerekebilir. Sistem şu alanları `Tenant` üzerinde takip eder:
- `downgradePendingUntil: timestamp | null` — Grace süresinin biteceği tarih (varsayılan 7 gün)
- `requiredUserReduction: number | null` — Gerekli azaltım sayısı (aktif kullanıcı sayısı − yeni limit)

### Davranış
- Plan düşürüldüğünde, eğer aktif kullanıcı sayısı limitin üzerindeyse yukarıdaki alanlar set edilir.
- Yönetici panelinde uyarı ve geri sayım gösterilir; gerekiyorsa manuel azaltım yapılır.
- Limit altına inildiğinde alanlar otomatik temizlenir.

### Manuel Azaltım (Yeni)
- Tenant Konsolu kullanıcı listesinde çoklu seçim eklenmiştir.
- “Seçilenleri Pasifleştir” ile birden fazla kullanıcı tek işlemde pasifleştirilebilir.
- Pasifleştirme, kullanıcıları güvenli biçimde devre dışı bırakır (geri alınabilir).

### Zorunlu Azaltımı Uygulama (Otomatik)
- Uç nokta: `POST /api/admin/tenant/:tenantId/enforce-downgrade`
- Gövde: `{ "confirm": true }`
- Kimlik doğrulama: `admin-token` başlığı zorunlu
- Davranış: Deadline geçmişse, fazla kullanıcılar rastgele seçilerek pasifleştirilir.
- Hariç tutulan roller: `tenant_admin`, `super_admin` pasifleştirilmez.

#### Örnek
```
curl -X POST \
  -H 'Content-Type: application/json' \
  -H 'admin-token: $ADMIN_TOKEN' \
  -d '{"confirm": true}' \
  http://localhost:3001/api/admin/tenant/TENANT_ID/enforce-downgrade
```

### UI
- Tenant Konsolu: Uyarı bandı üzerinde gerekli sayı ve deadline geri sayımı görünür.
- “Fazlayı Otomatik Pasifleştir” düğmesi, deadline sonrası uygulamayı tetikler.
- Çoklu seçim paneli ile manuel pasifleştirme kolaylaştırılmıştır.

## Notlar ve Güvenlik
- Admin uç noktaları için `admin-token` zorunludur; 401 durumlarında token yenilemesi gerekir.
- CSV çıktısı PII içerir; yetkisiz paylaşımına karşı dikkatli olun.
- Pasifleştirme işlemleri audit log kapsamında takip edilir (uygulanıyorsa).

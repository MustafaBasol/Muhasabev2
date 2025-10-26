# Backup Yönetim Sistemi - Admin Panel

## 📋 Genel Bakış

Admin paneline tam özellikli yedekleme yönetim sistemi eklenmiştir. Bu sistem hem kullanıcı bazlı hem de sistem genelinde yedekleme ve geri yükleme imkanı sunar.

## 🎯 Özellikler

### 1. **Sistem Yedeği (Full Backup)**
- Tüm PostgreSQL veritabanının yedeğini alır
- `.sql` formatında saklanır
- Tüm tabloları, ilişkileri ve verileri içerir
- Geri yükleme işlemi tüm veritabanını sıfırlar

### 2. **Kullanıcı Yedeği (User-Specific Backup)**
- Belirli bir kullanıcının tenant'ına ait tüm verileri yedekler
- JSON formatında saklanır
- Yedeklenen veriler:
  - Müşteriler (Customers)
  - Tedarikçiler (Suppliers)
  - Ürünler (Products)
  - Faturalar (Invoices)
  - Giderler (Expenses)

### 3. **İzole Geri Yükleme**
- Kullanıcı bazlı geri yükleme sadece o kullanıcının verilerini etkiler
- Diğer kullanıcıların verileri korunur
- Transaction-based güvenli geri yükleme
- Rollback desteği

### 4. **Otomatik Temizleme**
- 30 günden eski yedekler otomatik silinebilir
- Manuel temizleme butonu
- Metadata takip sistemi

## 🚀 Kullanım

### Admin Paneline Erişim

1. **Giriş Yapın:**
   - Email: `admin@test.com`
   - Şifre: `Test123456`

2. **Admin Paneline Gidin:**
   - Sol menüden "Admin Paneli" seçin
   - Admin paneli açılınca "💾 Yedekleme" sekmesine tıklayın

### Yedek Alma

#### Sistem Yedeği
```
1. "Sistem Yedeği" kartında "Sistem Yedeği Al" butonuna tıklayın
2. İşlem tamamlanınca yedek listede görünür
3. Dosya: backups/system_backup_YYYYMMDD_HHMMSS.sql
```

#### Kullanıcı Yedeği
```
1. "Kullanıcı Yedeği" kartında dropdown'dan kullanıcı seçin
2. "Kullanıcı Yedeği Al" butonuna tıklayın
3. İşlem tamamlanınca yedek listede görünür
4. Dosya: backups/user_[userId]_backup_YYYYMMDD_HHMMSS.json
```

### Geri Yükleme

#### Kullanıcı Geri Yükleme (İzole)
```
1. Yedek listesinden istediğiniz kullanıcı yedeğini bulun
2. "Geri Yükle" butonuna tıklayın
3. Onay penceresinde "Onayla" butonuna basın
4. Sadece o kullanıcının verileri geri yüklenir
5. Diğer kullanıcılar etkilenmez
```

#### Sistem Geri Yükleme (Full Restore)
```
1. Yedek listesinden sistem yedeğini bulun
2. "Geri Yükle" butonuna tıklayın
3. ⚠️ UYARI: Tüm sistem geri yüklenecek!
4. Onay penceresinde "Onayla" butonuna basın
5. Tüm veritabanı geri yüklenir
6. Sayfa otomatik yenilenir
```

### Yedek Silme

```
1. Yedek listesinden silinecek yedeği bulun
2. "Sil" butonuna tıklayın
3. Onaylayın
4. Hem dosya hem de metadata silinir
```

### Eski Yedekleri Temizleme

```
1. "Eski Yedekleri Temizle (30+ gün)" butonuna tıklayın
2. Onaylayın
3. 30 günden eski tüm yedekler silinir
```

## 📊 İstatistikler

Dashboard üst kısmında şu istatistikler gösterilir:
- **Toplam Yedek:** Tüm yedek sayısı
- **Sistem Yedekleri:** Sistem yedeği sayısı
- **Kullanıcı Yedekleri:** Kullanıcı yedeği sayısı
- **Toplam Boyut:** Tüm yedeklerin toplam MB cinsinden boyutu

## 🔧 Backend API Endpoints

```typescript
// Yedekleri Listele
GET /admin/backups?type=system|user

// Kullanıcı Yedeklerini Listele
GET /admin/backups/user/:userId

// Sistem Yedeği Oluştur
POST /admin/backups/system
Body: { description?: string }

// Kullanıcı Yedeği Oluştur
POST /admin/backups/user/:userId
Body: { description?: string }

// Sistem Geri Yükle
POST /admin/backups/restore/system/:backupId

// Kullanıcı Geri Yükle (İzole)
POST /admin/backups/restore/user/:userId/:backupId

// Yedek Sil
DELETE /admin/backups/:backupId

// Eski Yedekleri Temizle
POST /admin/backups/cleanup

// İstatistikler
GET /admin/backups/statistics
```

## 🗂️ Dosya Yapısı

```
backend/
├── backups/
│   ├── metadata.json                          # Yedek metadata'ları
│   ├── system_backup_20251026_120000.sql     # Sistem yedeği
│   └── user_xxx_backup_20251026_120000.json  # Kullanıcı yedeği
└── src/
    └── admin/
        ├── backup.controller.ts               # REST API
        └── backup.service.ts                  # Business Logic

src/
├── api/
│   └── backups.ts                            # Frontend API client
└── components/
    ├── AdminPage.tsx                          # Admin ana sayfa
    └── admin/
        └── BackupManagementPage.tsx          # Backup yönetim UI
```

## 🔐 Güvenlik

- Tüm endpoint'ler JWT authentication gerektirir
- Role-based access control (sadece super_admin)
- Transaction-based restore (atomik işlemler)
- Metadata validation
- File system güvenliği

## ⚡ Performans

- Asenkron backup işlemleri
- Streaming için büyük dosya desteği
- Metadata caching
- Efficient PostgreSQL dump/restore
- JSON-based hafif kullanıcı yedekleri

## 🎨 UI Özellikleri

### Renkli Kartlar
- 🔵 Sistem yedekleri: Mavi
- 🟢 Kullanıcı yedekleri: Yeşil
- 🟣 Tenant yedekleri: Mor

### Filtreleme
- Tümü
- Sadece Sistem
- Sadece Kullanıcı
- Sadece Tenant

### Bildirimler
- ✅ Başarılı işlemler: Yeşil bildirim
- ❌ Hatalar: Kırmızı bildirim
- ⚠️ Uyarılar: Sarı modal

## 📝 Metadata Örneği

```json
{
  "id": "uuid-v4",
  "type": "user",
  "entityId": "user-uuid",
  "entityName": "John Doe",
  "filename": "user_xxx_backup_20251026_120000.json",
  "size": 1048576,
  "createdAt": "2025-10-26T12:00:00.000Z",
  "description": "Manuel kullanıcı yedeği"
}
```

## 🧪 Test Senaryoları

### 1. Kullanıcı Yedeği Test
```bash
# 1. Kullanıcı verisi ekle
# 2. Yedek al
# 3. Verileri değiştir/sil
# 4. Geri yükle
# 5. Verilerin eski haline döndüğünü kontrol et
```

### 2. İzolasyon Testi
```bash
# 1. Kullanıcı A ve B için veri ekle
# 2. Kullanıcı A için yedek al
# 3. Kullanıcı A'nın verilerini sil
# 4. Kullanıcı A'yı geri yükle
# 5. Kullanıcı B'nin verilerinin değişmediğini kontrol et
```

### 3. Sistem Yedeği Test
```bash
# 1. Tüm sistem için veri ekle
# 2. Sistem yedeği al
# 3. Veritabanını değiştir
# 4. Sistem yedeğini geri yükle
# 5. Tüm verilerin geri geldiğini kontrol et
```

## 🚨 Önemli Notlar

1. **Sistem Geri Yükleme**: Tüm veritabanını sıfırlar, dikkatli kullanın!
2. **Kullanıcı Geri Yükleme**: Sadece seçili kullanıcının verilerini etkiler
3. **30 Günlük Saklama**: Otomatik cleanup için ready
4. **Dosya Boyutları**: Sistem yedekleri büyük olabilir (100+ MB)
5. **Transaction Safety**: Kullanıcı geri yükleme rollback destekler

## 📞 Destek

Herhangi bir sorun için:
- Backend logs: `/tmp/backend.log`
- Frontend logs: Tarayıcı console
- Backup metadata: `backend/backups/metadata.json`

## 🎉 Başarı!

Artık admin panelinden:
- ✅ Kullanıcı bazlı yedek alabilir
- ✅ Sistem bazlı yedek alabilir
- ✅ İzole kullanıcı geri yüklemesi yapabilir
- ✅ Tam sistem geri yüklemesi yapabilir
- ✅ Eski yedekleri temizleyebilir
- ✅ Tüm yedekleri görüntüleyebilir ve yönetebilirsiniz!

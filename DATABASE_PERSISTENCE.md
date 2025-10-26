# 🗄️ Veritabanı Kalıcılığı ve Veri Güvenliği

## ❓ Sorular ve Cevaplar

### Soru 1: Codespace'ler arası veri paylaşımı?
**CEVAP:** Hayır, her Codespace ayrı bir container ortamıdır ve birbirinden izoledir.

**ÇÖZÜM:**
1. **GitHub ile senkronizasyon** - Veritabanı backup'larını GitHub'a commit edin
2. **Seed script kullanın** - Her Codespace'de aynı verileri yeniden oluşturun
3. **Harici veritabanı** - Dış bir PostgreSQL servisine bağlanın (Supabase, Railway, vb.)

### Soru 2: Production'da veriler kaybolur mu?
**CEVAP:** Hayır! Doğru yapılandırma ile kalıcıdır.

**ÇÖZÜM:** Aşağıdaki production yapılandırmasını kullanın.

### Soru 3: Docker container silinse veriler kaybolur mu?
**CEVAP:** Mevcut yapılandırmada evet, ama düzeltildi.

**ÇÖZÜM:** Named volumes veya host bind mounts kullanın.

---

## 🏗️ Ortam Bazlı Çözümler

### A) GELIŞTIRME (Development - Codespace)

**Durum:** Her Codespace izole, veriler paylaşılmaz.

**Çözüm 1: Seed Script (Önerilen)**
```bash
# Her Codespace açıldığında
cd /workspaces/Muhasabev2/backend
npm run seed:demo
```

**Çözüm 2: Database Dump'ı GitHub'a Kaydet**
```bash
# Veritabanını dışa aktar
docker exec moneyflow-db pg_dump -U moneyflow moneyflow_dev > backup.sql
git add backup.sql
git commit -m "Database backup"
git push

# Yeni Codespace'de geri yükle
docker exec -i moneyflow-db psql -U moneyflow moneyflow_dev < backup.sql
```

**Çözüm 3: Harici Veritabanı (Production-like)**
```env
# .env dosyasında
DATABASE_URL=postgresql://user:pass@external-db.com:5432/mydb
```

---

### B) PRODUCTION (Canlı Sunucu)

**Özellikler:**
- ✅ Kalıcı veri depolama
- ✅ Otomatik backup
- ✅ Container yeniden başlatılsa bile veri korunur

**Kullanım:**
```bash
# Production ortamında
docker-compose -f docker-compose.production.yml up -d
```

**Veri Konumu:**
- PostgreSQL: `/var/lib/postgresql/data` (host makinede)
- Redis: `/var/lib/redis` (host makinede)
- Backup'lar: `./backups` klasörü

---

### C) STAGING (Test Ortamı)

GitHub Codespaces için kalıcı depolama:

```bash
# Staging için
docker-compose -f docker-compose.staging.yml up -d
```

---

## 📋 Önerilen Çalışma Akışı

### Geliştirme (Codespace)
```bash
# 1. Codespace başlat
./start-dev-new.sh

# 2. Demo verileri yükle
cd backend && npm run seed:demo

# 3. Geliştirme yap

# 4. Önemli değişiklik varsa backup al
docker exec moneyflow-db pg_dump -U moneyflow moneyflow_dev > backups/dev-$(date +%Y%m%d).sql
git add backups/
git commit -m "Dev backup"
```

### Production Deployment
```bash
# 1. Production sunucuda
git clone <repo>
cd Muhasabev2/backend

# 2. Environment variables ayarla
cp .env.example .env.production
nano .env.production  # Güvenli şifreler ekle

# 3. Production başlat
docker-compose -f docker-compose.production.yml up -d

# 4. İlk kurulum için seed çalıştır (sadece 1 kez)
npm run seed:demo
```

---

## 🔒 Güvenlik ve Backup

### Otomatik Backup (Production)
Production'da `postgres-backup` container'ı:
- Her gün saat 03:00'te otomatik backup alır
- 30 günlük backup saklar
- `./backups` klasörüne kaydeder

### Manuel Backup
```bash
# Backup al
docker exec moneyflow-db pg_dump -U moneyflow moneyflow_dev > backup.sql

# Restore et
docker exec -i moneyflow-db psql -U moneyflow moneyflow_dev < backup.sql
```

### Backup'ı Güvenli Yere Taşı
```bash
# AWS S3'e yükle
aws s3 cp backup.sql s3://my-bucket/backups/

# Google Drive'a yükle (rclone ile)
rclone copy backup.sql gdrive:/backups/
```

---

## 🚀 Hızlı Komutlar

### Development
```bash
# Seed çalıştır
npm run seed:demo

# Backup al
docker exec moneyflow-db pg_dump -U moneyflow moneyflow_dev > backup.sql

# Restore et
docker exec -i moneyflow-db psql -U moneyflow moneyflow_dev < backup.sql
```

### Production
```bash
# Production başlat
docker-compose -f docker-compose.production.yml up -d

# Backup'ları kontrol et
ls -lh ./backups/

# Manuel backup
docker exec moneyflow-prod-db pg_dump -U moneyflow_prod moneyflow_production > backup.sql
```

---

## ⚠️ ÖNEMLİ NOTLAR

1. **Codespace Limiti:** GitHub Codespaces ücretsiz planda aylık 60 saat limiti var
2. **Veri Paylaşımı:** Codespace'ler arası direkt veri paylaşımı YOK
3. **Production:** Mutlaka harici managed database kullanın (Supabase, Railway, AWS RDS)
4. **Backup:** Production'da her zaman otomatik backup aktif tutun
5. **Git:** Hassas verileri (şifreler, API keys) Git'e PUSH ETMEYİN

---

## 🎯 Sonuç

- **Geliştirme:** Seed script kullanın, her Codespace'de tekrar oluşturun
- **Production:** Managed database + otomatik backup
- **Güvenlik:** Hassas bilgileri `.env` dosyasında tutun, Git'e eklemeyin

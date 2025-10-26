# 🚀 Veritabanı Yönetimi Rehberi

## 📌 Hızlı Başlangıç

### Yeni Codespace Açtığınızda

```bash
# 1. Servisleri başlat
./start-dev-new.sh

# 2. Demo verileri yükle
cd backend
npm run seed:demo

# Artık kullanıma hazır!
```

---

## 💾 Veri Kalıcılığı

### ❓ Verilerim Nerede Saklanıyor?

**Development (Docker Volumes):**
- PostgreSQL: Docker volume `backend_postgres_data`
- Redis: Docker volume `backend_redis_data`

**⚠️ ÖNEMLİ:** Docker container silinirse veriler de silinir!

**Staging (Codespace /workspaces):**
- PostgreSQL: `/workspaces/Muhasabev2/.data/postgres`
- Redis: `/workspaces/Muhasabev2/.data/redis`

**✅ AVANTAJ:** `/workspaces` klasörü Codespace'de kalıcıdır!

**Production (Host Filesystem):**
- PostgreSQL: `/var/lib/postgresql/data`
- Redis: `/var/lib/redis`
- Backups: `./backend/backups/`

**✅ AVANTAJ:** Host makinede saklanır, container silinse bile korunur!

---

## 🔄 Backup ve Restore

### Backup Al

```bash
cd backend
./backup-db.sh
```

**Çıktı:**
```
✅ Backup başarılı!
📄 Dosya: backups/moneyflow_backup_20251026_115705.sql
📊 Boyut: 2MB
```

### Restore Et

```bash
cd backend
./restore-db.sh backups/moneyflow_backup_20251026_115705.sql
```

### Manuel Backup

```bash
# Backup al
docker exec moneyflow-db pg_dump -U moneyflow moneyflow_dev > my_backup.sql

# Restore et
docker exec -i moneyflow-db psql -U moneyflow moneyflow_dev < my_backup.sql
```

---

## 🌍 Farklı Ortamlar

### Development (Varsayılan)

```bash
# docker-compose.yml kullanır
docker-compose up -d
```

**Özellikler:**
- ✅ Hızlı başlatma
- ✅ Kolay geliştirme
- ❌ Veriler kalıcı değil (container silinirse gider)

### Staging (Codespace için önerilir)

```bash
# docker-compose.staging.yml kullanır
docker-compose -f docker-compose.staging.yml up -d
```

**Özellikler:**
- ✅ Veriler `/workspaces/` altında kalıcı
- ✅ Codespace yeniden başlatılsa bile korunur
- ✅ Container silinse bile veriler kalır

### Production (Canlı Sunucu)

```bash
# docker-compose.production.yml kullanır
docker-compose -f docker-compose.production.yml up -d
```

**Özellikler:**
- ✅ Host filesystem'de kalıcı
- ✅ Otomatik günlük backup
- ✅ 30 gün backup saklama
- ✅ restart: unless-stopped

---

## 🔐 Güvenlik

### .env Dosyası (Asla Git'e Eklemeyin!)

```bash
# Production için
cp .env.example .env.production
nano .env.production
```

**Güçlü şifreler oluşturun:**

```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Hassas Verileri Koruma

```bash
# .gitignore içinde zaten var
.env
.env.production
.env.local
*.sql  # Backup dosyaları
.data/ # Staging data klasörü
```

---

## 📊 Veri Yönetimi Stratejileri

### Senaryo 1: Yeni Codespace Açtım

**Seçenek A: Seed Script (Hızlı)**
```bash
npm run seed:demo
# 5 saniyede hazır demo veriler
```

**Seçenek B: Backup'tan Yükle (Gerçek Veri)**
```bash
# 1. GitHub'dan son backup'ı çek
git pull

# 2. Restore et
./restore-db.sh backups/latest.sql
```

### Senaryo 2: Önemli Değişiklikler Yaptım

```bash
# 1. Backup al
./backup-db.sh

# 2. Git'e ekle
git add backups/*.sql
git commit -m "Database backup with new features"
git push

# Artık başka bir Codespace'de çekebilirsiniz
```

### Senaryo 3: Production'a Geçiyorum

```bash
# 1. Development'da son backup al
./backup-db.sh

# 2. Production sunucuda:
git clone <repo>
cd backend

# 3. Environment ayarla
cp .env.example .env.production
nano .env.production  # Güvenli şifreler

# 4. Production başlat
docker-compose -f docker-compose.production.yml up -d

# 5. Demo veri yükle VEYA backup restore et
npm run seed:demo
# VEYA
./restore-db.sh backups/production_init.sql
```

---

## 🛡️ Otomatik Backup (Production)

Production'da otomatik backup container'ı çalışır:

- **Ne zaman:** Her gün saat 03:00
- **Nereye:** `./backups/` klasörü
- **Ne kadar saklanır:** 30 gün
- **Format:** `moneyflow_YYYYMMDD_HHMMSS.sql`

**Backup'ları kontrol et:**
```bash
ls -lh backups/
```

**Backup'ı uzak sunucuya yükle:**
```bash
# AWS S3
aws s3 cp backups/ s3://my-bucket/backups/ --recursive

# Google Drive (rclone)
rclone sync backups/ gdrive:/backups/

# FTP
lftp -c "mirror -R backups/ ftp://user:pass@server/backups/"
```

---

## 🚨 Sorun Giderme

### Veriler Kayboldu!

```bash
# 1. Backup var mı kontrol et
ls -lh backups/

# 2. Varsa restore et
./restore-db.sh backups/en-son-backup.sql

# 3. Yoksa seed çalıştır
npm run seed:demo
```

### Container Başlamıyor

```bash
# Container'ları temizle
docker-compose down
docker volume prune  # DİKKAT: Tüm volumes silinir!

# Yeniden başlat
docker-compose up -d

# Seed çalıştır
npm run seed:demo
```

### Codespace'ler Arası Senkronizasyon

```bash
# Codespace A'da
./backup-db.sh
git add backups/*.sql
git commit -m "Backup"
git push

# Codespace B'de
git pull
./restore-db.sh backups/latest.sql
```

---

## 📚 Ek Kaynaklar

- [PostgreSQL Backup Dökümantasyonu](https://www.postgresql.org/docs/current/backup-dump.html)
- [Docker Volumes](https://docs.docker.com/storage/volumes/)
- [GitHub Codespaces Storage](https://docs.github.com/en/codespaces/developing-in-codespaces/persisting-environment-variables)

---

## ✅ Checklist

### Her Codespace Açışta
- [ ] `./start-dev-new.sh` çalıştır
- [ ] `npm run seed:demo` çalıştır
- [ ] Verileri kontrol et

### Önemli Değişiklik Öncesi
- [ ] `./backup-db.sh` çalıştır
- [ ] Backup'ı Git'e commit et

### Production'a Geçmeden
- [ ] `.env.production` oluştur ve güvenli şifreler kullan
- [ ] `docker-compose.production.yml` kullan
- [ ] Otomatik backup aktif mi kontrol et
- [ ] İlk backup'ı al ve güvenli yere kaydet

---

**🎯 Sonuç:** Artık verileriniz güvende! Development'da seed kullanın, Production'da otomatik backup ile çalışın.

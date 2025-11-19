# Comptario Production Deployment Guide

## Veri Güvenliği Garantisi İçin Adımlar

### 1. Sunucu Hazırlığı
```bash
# Kalıcı veri klasörleri oluştur
sudo mkdir -p /var/lib/postgresql/data
sudo mkdir -p /var/lib/redis
sudo mkdir -p /var/backups/moneyflow
sudo chown -R 999:999 /var/lib/postgresql/data
sudo chown -R 999:999 /var/lib/redis
```

### 2. Environment Dosyalarını Güncelle
```bash
# .env.production dosyasını düzenle
nano backend/.env.production

# ŞU DEĞERLERİ MUTLAKA DEĞİŞTİR:
- DATABASE_PASSWORD=GÜÇLÜ_ŞİFRE_BURASİ_DEĞİŞTİRİLECEK
- JWT_SECRET=GÜÇLÜ_JWT_SECRET_BURASİ_DEĞİŞTİRİLECEK
- CORS_ORIGIN=https://yourDomain.com
```

### 3. Production'a Deploy
```bash
# Repository'yi production sunucusuna klonla
git clone https://github.com/MustafaBasol/Muhasabev2.git
cd Muhasabev2

# Production compose ile başlat
cd backend
docker-compose -f docker-compose.production.yml up -d

# Veritabanı migration'ları çalıştır
npm run migration:run

# Uygulamayı build et ve başlat
npm run build
npm run start:prod
```

### 4. Otomatik Backup Kurulumu
```bash
# Backup script'ini crontab'a ekle
crontab -e

# Her gün saat 03:00'da backup al
0 3 * * * /path/to/Muhasabev2/backend/backup.sh

# Her hafta S3'e yükle (opsiyonel)
0 4 * * 0 aws s3 sync /var/backups/moneyflow/ s3://your-backup-bucket/
```

### 5. Monitoring ve Alerts
```bash
# Disk doluluk kontrolü
df -h
# PostgreSQL connection kontrolü  
psql -h localhost -U moneyflow_prod -d moneyflow_production -c "SELECT version();"
# Redis kontrolü
redis-cli ping
```

## ⚠️ KRİTİK GÜVENLİK NOTLARİ

1. **ŞİFRELER**: .env.production dosyasındaki tüm şifreleri değiştirin
2. **FIREWALL**: Sadece gerekli portları açın (80, 443, 22)
3. **SSL**: HTTPS sertifikası kullanın (Let's Encrypt önerilir)
4. **BACKUP**: Backup'ları farklı lokasyonda tutun (S3, Google Drive, vb.)
5. **MONITORING**: Disk doluluk, memory, CPU kullanımını izleyin

## Disaster Recovery (Felaket Kurtarma)

### Veri Geri Yükleme:
```bash
# Backup'dan veri geri yükle
gunzip /var/backups/moneyflow/db_backup_YYYYMMDD_HHMMSS.sql.gz
psql -h localhost -U moneyflow_prod -d moneyflow_production < db_backup_YYYYMMDD_HHMMSS.sql
```

### Sistem Yeniden Kurulumu:
```bash
# Docker volumes'ları koru
cp -r /var/lib/postgresql/data /backup/
cp -r /var/lib/redis /backup/

# Sistem yeniden kur
# Volumes'ları geri koy
cp -r /backup/data /var/lib/postgresql/
cp -r /backup/redis /var/lib/
```

## Performance Optimization

1. **PostgreSQL**: `postgresql.conf` dosyasını optimize et
2. **Redis**: Memory limit ayarla
3. **Node.js**: PM2 ile cluster mode kullan
4. **Nginx**: Reverse proxy ve caching
5. **CDN**: Static dosyalar için CloudFlare kullan
# 🤖 Otomatik Backup Sistemleri

## 📋 İçindekiler

1. [Codespace için Basit Scheduler](#codespace-için-basit-scheduler)
2. [Production için Docker Container](#production-için-docker-container)
3. [Production için Systemd Service](#production-için-systemd-service)
4. [GitHub Actions ile Cloud Backup](#github-actions-ile-cloud-backup)
5. [Karşılaştırma Tablosu](#karşılaştırma-tablosu)

---

## 1. Codespace için Basit Scheduler

### Kullanım

```bash
cd /workspaces/Muhasabev2/backend

# Arka planda başlat (varsayılan: her gün 03:00)
npm run backup:auto &

# Özel saat belirle (örnek: saat 14:30)
BACKUP_HOUR=14 BACKUP_MINUTE=30 npm run backup:auto &

# Git'e otomatik commit etsin
AUTO_GIT_COMMIT=true npm run backup:auto &
```

### Logları Görüntüle

```bash
tail -f /tmp/backup-scheduler.log
```

### Durdurma

```bash
# Process ID bul
ps aux | grep backup-scheduler

# Durdur
kill <PID>
```

### Özellikler

- ✅ Kolay kurulum
- ✅ Codespace'e uygun
- ✅ Anlık log takibi
- ❌ Sistem yeniden başlatınca durur
- ❌ Birden fazla Codespace için tekrar etmek gerekir

---

## 2. Production için Docker Container

### Kullanım

```bash
# Production ortamında
cd /opt/moneyflow/backend

# .env.production dosyasında DATABASE_PASSWORD belirtin
echo "DATABASE_PASSWORD=guclu_sifre" > .env.production

# Başlat
docker-compose -f docker-compose.production.yml up -d
```

### Backup Container'ı Kontrol Et

```bash
# Container çalışıyor mu?
docker ps | grep moneyflow-backup

# Logları görüntüle
docker logs moneyflow-backup

# Sonraki backup zamanını gör
docker exec moneyflow-backup cat /etc/crontabs/root
```

### Yapılandırma

`docker-compose.production.yml` dosyasında:

```yaml
postgres-backup:
  environment:
    CRON_SCHEDULE: "0 3 * * *"  # Her gün 03:00
    # CRON_SCHEDULE: "0 */6 * * *"  # Her 6 saatte bir
    # CRON_SCHEDULE: "0 */1 * * *"  # Her saat
```

### Özellikler

- ✅ Otomatik yeniden başlatma
- ✅ Sistem yeniden başlasa bile çalışır
- ✅ Loglar container içinde
- ✅ Kolay konfigürasyon
- ✅ Production için ideal

---

## 3. Production için Systemd Service

### Kurulum (Linux Sunucular)

```bash
# Root olarak çalıştır
cd /opt/moneyflow/backend
sudo ./install-backup-service.sh
```

### Kullanım

```bash
# Durumu kontrol et
systemctl status moneyflow-backup.timer

# Manuel backup al
sudo systemctl start moneyflow-backup.service

# Logları görüntüle
sudo journalctl -u moneyflow-backup.service -f

# Sonraki backup zamanı
systemctl list-timers moneyflow-backup.timer
```

### Yapılandırma Değiştirme

```bash
# Timer dosyasını düzenle
sudo nano /etc/systemd/system/moneyflow-backup.timer

# Örnek: Her 12 saatte bir
[Timer]
OnCalendar=*-*-* 00,12:00:00

# Değişiklikleri uygula
sudo systemctl daemon-reload
sudo systemctl restart moneyflow-backup.timer
```

### Kaldırma

```bash
sudo systemctl stop moneyflow-backup.timer
sudo systemctl disable moneyflow-backup.timer
sudo rm /etc/systemd/system/moneyflow-backup.*
sudo systemctl daemon-reload
```

### Özellikler

- ✅ Sistem seviyesi servis
- ✅ Güvenilir (systemd yönetir)
- ✅ Detaylı loglama
- ✅ Sistem yeniden başlasa bile çalışır
- ❌ Root yetkisi gerektirir
- ❌ Linux'a özel

---

## 4. GitHub Actions ile Cloud Backup

### Kurulum

```bash
cd /workspaces/Muhasabev2

# Workflow dosyası oluştur
./backend/generate-github-workflow.sh > .github/workflows/database-backup.yml
```

### GitHub Secrets Ekle

GitHub repository → Settings → Secrets → New repository secret:

```
SSH_PRIVATE_KEY       = Production sunucu SSH private key
SERVER_HOST          = production.yourdomain.com
SERVER_USER          = root veya deploy user
AWS_ACCESS_KEY_ID    = (Opsiyonel) AWS S3 için
AWS_SECRET_ACCESS_KEY = (Opsiyonel) AWS S3 için
AWS_REGION           = (Opsiyonel) us-east-1
S3_BACKUP_BUCKET     = (Opsiyonel) my-backups
SLACK_WEBHOOK        = (Opsiyonel) Bildirim için
```

### Manuel Çalıştırma

GitHub repository → Actions → Database Backup → Run workflow

### Özellikler

- ✅ GitHub üzerinde merkezi yönetim
- ✅ Cloud storage entegrasyonu
- ✅ Bildirim sistemi
- ✅ Otomatik sıkıştırma
- ✅ 30 günlük backup rotasyonu
- ❌ GitHub Actions limitleri var
- ❌ Kurulum biraz karmaşık

---

## 📊 Karşılaştırma Tablosu

| Özellik | Codespace Scheduler | Docker Container | Systemd Service | GitHub Actions |
|---------|-------------------|------------------|----------------|----------------|
| **Kolay Kurulum** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Güvenilirlik** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Production Uygunluğu** | ❌ | ✅ | ✅ | ✅ |
| **Otomatik Başlatma** | ❌ | ✅ | ✅ | ✅ |
| **Cloud Backup** | ❌ | ❌ | ❌ | ✅ |
| **Bildirim** | ❌ | ❌ | ⚠️ | ✅ |
| **Log Yönetimi** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 🎯 Öneriler

### Development (Codespace)
```bash
# Basit scheduler yeterli
npm run backup:auto &
```

### Production (Küçük/Orta Ölçek)
```bash
# Docker container (en kolay)
docker-compose -f docker-compose.production.yml up -d
```

### Production (Büyük Ölçek)
```bash
# Systemd + GitHub Actions
sudo ./install-backup-service.sh
# + GitHub Actions workflow'u aktif et
```

### Production (Enterprise)
- Managed Database Backup (AWS RDS, Google Cloud SQL)
- + Docker Container (ek güvenlik)
- + GitHub Actions (offsite backup)

---

## 🔔 Bildirim Sistemleri

### Email Bildirimi

`backup-db.sh` sonuna ekleyin:

```bash
# Email gönder
echo "Backup completed: $BACKUP_FILE" | mail -s "DB Backup Success" admin@yourdomain.com
```

### Slack Bildirimi

```bash
# Slack webhook
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
curl -X POST -H 'Content-type: application/json' \
  --data "{\"text\":\"✅ Backup başarılı: $BACKUP_FILE\"}" \
  $SLACK_WEBHOOK
```

### Telegram Bildirimi

```bash
# Telegram bot
TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_CHAT_ID="your_chat_id"
curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d chat_id=$TELEGRAM_CHAT_ID \
  -d text="✅ Database backup başarılı!"
```

---

## 🚨 Sorun Giderme

### Backup Çalışmıyor

```bash
# Log kontrol et
tail -f /tmp/backup-scheduler.log          # Scheduler
docker logs moneyflow-backup               # Docker
sudo journalctl -u moneyflow-backup.service # Systemd
```

### Container Başlamıyor

```bash
# Hata mesajı
docker logs moneyflow-backup

# Yeniden başlat
docker restart moneyflow-backup

# Manuel çalıştır
docker exec moneyflow-backup /bin/sh -c "pg_dump..."
```

### Disk Doldu

```bash
# Eski backup'ları temizle
find backups/ -name "*.sql" -mtime +7 -delete

# Backup'ları sıkıştır
gzip backups/*.sql
```

---

## 📚 İleri Seviye

### S3'e Otomatik Yükleme

```bash
# backup-db.sh sonuna ekle
aws s3 cp $BACKUP_FILE s3://my-bucket/backups/
```

### Backup Doğrulama

```bash
# Backup'ın geçerli olup olmadığını test et
docker exec -i moneyflow-db psql -U moneyflow -d template1 < $BACKUP_FILE
```

### Çoklu Veritabanı Backup

```bash
# Tüm veritabanlarını yedekle
docker exec moneyflow-db pg_dumpall -U postgres > all_databases.sql
```

---

## ✅ Hızlı Başlangıç

### Codespace'de

```bash
cd backend
npm run backup:auto &
```

### Production'da

```bash
# Docker ile (önerilen)
docker-compose -f docker-compose.production.yml up -d

# VEYA Systemd ile
sudo ./install-backup-service.sh
```

Artık backup'larınız otomatik olarak alınacak! 🎉

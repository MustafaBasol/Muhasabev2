# ⚡ Hızlı Başlangıç: Otomatik Backup

## 🎯 Hangi Yöntemi Seçmeliyim?

### Development (Codespace)
```bash
npm run backup:auto &
```
✅ En basit yöntem, hemen başlar

### Production (Docker ile - ÖNERİLEN)
```bash
docker-compose -f docker-compose.production.yml up -d
```
✅ En güvenilir, otomatik yeniden başlar

### Production (Linux Sunucu)
```bash
sudo ./install-backup-service.sh
```
✅ Sistem seviyesi, profesyonel

---

## 📝 Hızlı Komutlar

### Manuel Backup
```bash
npm run backup
```

### Otomatik Backup Başlat (Codespace)
```bash
# Varsayılan: Her gün 03:00
npm run backup:auto &

# Özel saat: Her gün 14:30
BACKUP_HOUR=14 BACKUP_MINUTE=30 npm run backup:auto &

# Git'e otomatik commit
AUTO_GIT_COMMIT=true npm run backup:auto &
```

### Backup Restore Et
```bash
npm run restore backups/dosya.sql
```

### Backup'ları Listele
```bash
ls -lh backups/
```

---

## 🔍 Kontrol Komutları

### Scheduler Çalışıyor mu?
```bash
ps aux | grep backup-scheduler
```

### Logları İzle
```bash
tail -f /tmp/backup-scheduler.log
```

### Son Backup Ne Zaman?
```bash
ls -lt backups/*.sql | head -1
```

---

## 🚨 Sorun Giderme

### Scheduler Başlamıyor
```bash
# Log kontrol et
cat /tmp/backup-scheduler.log

# Manuel test
./backup-db.sh
```

### Disk Doldu
```bash
# Eski backup'ları sil (7 günden eski)
find backups/ -name "*.sql" -mtime +7 -delete

# Backup'ları sıkıştır
gzip backups/*.sql
```

---

## 📚 Detaylı Bilgi

- `AUTO_BACKUP_GUIDE.md` - Tüm yöntemler
- `DATABASE_GUIDE.md` - Veritabanı yönetimi
- `DATABASE_PERSISTENCE.md` - Veri kalıcılığı

---

**🎉 Artık otomatik backup sisteminiz hazır!**

# 🛡️ Veri Kalıcılığı ve Yedekleme Kılavuzu

## ⚠️ ÖNEMLİ: Verileriniz Artık Güvende!

Veritabanı ayarları kalıcı hale getirildi. Verileriniz **Docker volume'lerinde** saklanıyor ve **asla silinmeyecek**.

## 📦 Veri Depolama

Verileriniz şurada saklanıyor:
```
Docker Volume: backend_backend_postgres_data
Fiziksel Konum: /var/lib/docker/volumes/backend_backend_postgres_data/_data
```

## 🔄 Otomatik Yedekleme

### Hızlı Yedek Alma
```bash
./quick-backup.sh
```

Yedekler `/workspaces/Muhasabev2/backups/` klasöründe saklanır.

### Yedeği Geri Yükleme
```bash
# Önce mevcut yedekleri listeleyin
./restore-backup.sh

# Sonra istediğiniz yedeği geri yükleyin
./restore-backup.sh /workspaces/Muhasabev2/backups/moneyflow_backup_20251027_092810.sql
```

## 📋 Manuel Yedekleme Komutları

### Manuel Yedek Al
```bash
docker exec moneyflow-db pg_dump -U moneyflow moneyflow_dev > my_backup.sql
```

### Manuel Geri Yükle
```bash
docker exec -i moneyflow-db psql -U moneyflow -d moneyflow_dev < my_backup.sql
```

## 🔍 Veri Kontrolü

Veritabanınızdaki verileri kontrol etmek için:
```bash
docker exec -it moneyflow-db psql -U moneyflow -d moneyflow_dev

# PostgreSQL'de:
\dt                          # Tabloları listele
SELECT COUNT(*) FROM users;  # Kullanıcı sayısı
SELECT * FROM users;         # Tüm kullanıcıları göster
\q                           # Çık
```

## ✅ Güvenlik Önlemleri

1. **synchronize: false** - Tablolar asla otomatik silinmez
2. **Docker Volumes** - Kalıcı veri depolama
3. **Otomatik Backup** - Son 10 yedek saklanır
4. **Kolay Geri Yükleme** - Tek komutla geri yükleme

## 🚨 Acil Durum

Eğer verileriniz kaybolursa:

1. **Yedeklerden geri yükleyin:**
   ```bash
   ./restore-backup.sh
   ```

2. **Docker volume'leri kontrol edin:**
   ```bash
   docker volume ls
   docker volume inspect backend_backend_postgres_data
   ```

3. **Container'ı yeniden başlatın:**
   ```bash
   cd /workspaces/Muhasabev2/backend
   docker-compose restart postgres
   ```

## 📊 Düzenli Yedekleme Önerisi

Her gün sonunda yedek almayı unutmayın:
```bash
./quick-backup.sh
```

---

**Son Güncelleme:** 27 Ekim 2025
**Durum:** ✅ Veriler güvende, yedekleme aktif

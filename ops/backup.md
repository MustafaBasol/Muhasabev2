# Veritabanı Yedekleme Rehberi

Bu doküman PostgreSQL veritabanı yedeklerini güvenli ve düzenli biçimde alma sürecini açıklar. Mevcut script: `ops/backup-db.sh`.

## Amaç
- Üretim verilerini düzenli aralıklarla kaybetmeden geri yükleyebilmek.
- Yedek dosyalarının bütünlüğünü (hash + boyut) hızlıca doğrulamak.
- Otomatik (cron) ve manuel tetikleme desteği.

## Script Özeti (`ops/backup-db.sh`)
- Çıktı dizini: `backups/<YYYYMMDD>/pgdump-<HHMMSS>.sql.gz`
- Argümanlar:
  - `--dry-run`: Komutu göstermesi için, gerçek yedek oluşturmaz.
  - `--no-compress`: `.gz` sıkıştırmasını kapatır.
- Kullanılan env değişkenleri: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` (gerekirse `.env` içinden yüklenir).
- Bütünlük: Dosya boşsa hata verir; SHA256 hash hesaplar.

## Örnek Manuel Kullanım
```bash
# Varsayılan ortam değişkenleri ile
bash ops/backup-db.sh

# Sıkıştırmasız backup
bash ops/backup-db.sh --no-compress

# Sadece komut önizleme
bash ops/backup-db.sh --dry-run
```

## Gereksinimler
- PostgreSQL client araçları (pg_dump). Örn. Ubuntu:
```bash
sudo apt update && sudo apt install -y postgresql-client
```
- Yedekleri saklamak için yeterli disk alanı.

## Cron ile Otomasyon Örneği
Her gece 02:15'te yedek almak için:
```cron
15 2 * * * /bin/bash /workspaces/Muhasabev2/ops/backup-db.sh >> /var/log/app_db_backup.log 2>&1
```
Rotate / temizlik için 14 günden eski yedekleri silmek (dikkatli kullanın):
```bash
find /workspaces/Muhasabev2/backups -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
```

## Geri Yükleme (Restore) Temel Örnek
Varsayım: Sıkıştırılmış dosya `backups/20251120/pgdump-112109.sql.gz`.
```bash
gunzip backups/20251120/pgdump-112109.sql.gz
psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -f backups/20251120/pgdump-112109.sql
```
Not: Üretim öncesi boş veya uygun bir hedef veritabanı kullanın. İhtiyaç halinde önce şema oluşturma/temizleme adımları planlanmalıdır.

## Bütünlük Doğrulama
Script çıktı sonunda SHA256 hash sunar. Dosya bütünlüğünü doğrulamak için:
```bash
sha256sum backups/20251120/pgdump-112109.sql.gz
```
Hash script çıktısındaki değer ile eşleşmelidir.

## Güvenlik Notları
- Yedek dosyaları hassas veri içerir; erişim izinlerini kısıtlayın:
```bash
chmod 600 backups/20251120/pgdump-*.sql.gz
```
- Mümkünse yedekleri şifrelenmiş bir depoya, obje depolama (S3) veya şifreli volume'a taşıyın.
- `PGPASSWORD` değişkenini kalıcı olarak tutmayın; CI/CD gizli değişkenleri veya Vault tercih edin.

## İyileştirme Fikirleri (Gelecek)
- S3'e otomatik yükleme (`aws s3 cp`).
- Artımlı yedek (WAL archiving) stratejisi.
- Otomatik geri yükleme testi (doğrulama job'ı).
- Şifreli yedek (gpg/age) desteği.

## Sorun Giderme
| Problem | Olası Neden | Çözüm |
|---------|-------------|-------|
| `pg_dump bulunamadı` | Paket kurulu değil | `apt install postgresql-client` |
| Dosya boş hatası | Kullanıcı yetkisi / network kopması | Ağ ve DB loglarını kontrol edin; yeniden deneyin |
| Yetki reddedildi | Kullanıcı rol yetkileri eksik | Gerekli SELECT/LOCK yetkilerini verin |

## Özet
`ops/backup-db.sh` minimum, güvenli ve doğrulanabilir bir PostgreSQL tam yedek alma mekanizması sağlar. Cron ile düzenli hale getirip, hash doğrulaması ile bütünlük garanti altına alınabilir.

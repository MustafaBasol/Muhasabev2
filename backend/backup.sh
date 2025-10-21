#!/bin/bash

# MoneyFlow Production Backup Script
# Kullanım: ./backup.sh

set -e

BACKUP_DIR="/var/backups/moneyflow"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="moneyflow_production"
DB_USER="moneyflow_prod"
DB_HOST="localhost"
DB_PORT="5432"

# Backup klasörü oluştur
mkdir -p $BACKUP_DIR

echo "🔄 MoneyFlow backup başlatılıyor..."
echo "📅 Tarih: $(date)"

# PostgreSQL Backup
echo "🗃️ Veritabanı backup'ı alınıyor..."
PGPASSWORD=$DATABASE_PASSWORD pg_dump \
  -h $DB_HOST \
  -p $DB_PORT \
  -U $DB_USER \
  -d $DB_NAME \
  --verbose \
  --clean \
  --no-acl \
  --no-owner \
  > $BACKUP_DIR/db_backup_$DATE.sql

# Compress backup
echo "📦 Backup sıkıştırılıyor..."
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Application files backup (uploads, configs)
echo "📁 Uygulama dosyaları backup'ı alınıyor..."
tar -czf $BACKUP_DIR/app_files_$DATE.tar.gz \
  /path/to/your/app/uploads \
  /path/to/your/app/.env.production \
  /path/to/your/app/docker-compose.production.yml

# Eski backup'ları temizle (30 günden eski)
echo "🧹 Eski backup'lar temizleniyor..."
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "✅ Backup tamamlandı!"
echo "📊 Backup boyutu: $(du -h $BACKUP_DIR/db_backup_$DATE.sql.gz | cut -f1)"
echo "📍 Backup konumu: $BACKUP_DIR"

# S3 veya uzak sunucuya yükleme (opsiyonel)
# aws s3 cp $BACKUP_DIR/db_backup_$DATE.sql.gz s3://your-backup-bucket/
# rsync -av $BACKUP_DIR/ backup-server:/backups/moneyflow/
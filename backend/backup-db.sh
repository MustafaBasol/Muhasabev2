#!/bin/bash

# Database Backup Script
# Veritabanını yedekler ve backups/ klasörüne kaydeder

set -e

BACKUP_DIR="/workspaces/Muhasabev2/backend/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/moneyflow_backup_$TIMESTAMP.sql"

echo "📦 Veritabanı yedekleniyor..."

# Container çalışıyor mu kontrol et
if ! docker ps | grep -q "moneyflow-db"; then
    echo "❌ PostgreSQL container çalışmıyor!"
    exit 1
fi

# Backup al
docker exec moneyflow-db pg_dump -U moneyflow moneyflow_dev > "$BACKUP_FILE"

# Dosya boyutunu kontrol et
SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
SIZE_MB=$((SIZE / 1024 / 1024))

echo "✅ Backup başarılı!"
echo "📄 Dosya: $BACKUP_FILE"
echo "📊 Boyut: ${SIZE_MB}MB"

# Eski backup'ları temizle (30 günden eski)
echo "🧹 Eski backup'lar temizleniyor..."
find "$BACKUP_DIR" -name "moneyflow_backup_*.sql" -mtime +30 -delete

# Toplam backup sayısı
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/moneyflow_backup_*.sql 2>/dev/null | wc -l)
echo "📚 Toplam backup sayısı: $BACKUP_COUNT"

echo ""
echo "💡 Restore için:"
echo "   ./restore-db.sh $BACKUP_FILE"

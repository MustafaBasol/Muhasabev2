#!/bin/bash
# Hızlı veritabanı yedekleme scripti

BACKUP_DIR="/workspaces/Muhasabev2/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/moneyflow_backup_$DATE.sql"

# Backup klasörünü oluştur
mkdir -p "$BACKUP_DIR"

echo "🔄 Veritabanı yedekleniyor..."
docker exec moneyflow-db pg_dump -U moneyflow moneyflow_dev > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Yedekleme başarılı: $BACKUP_FILE"
    # Son 10 yedeği tut, eskilerini sil
    ls -t "$BACKUP_DIR"/moneyflow_backup_*.sql | tail -n +11 | xargs -r rm
    echo "📊 Mevcut yedekler:"
    ls -lh "$BACKUP_DIR"/moneyflow_backup_*.sql 2>/dev/null | tail -5
else
    echo "❌ Yedekleme başarısız!"
    exit 1
fi

#!/bin/bash
# Veritabanını yedekten geri yükleme scripti

BACKUP_DIR="/workspaces/Muhasabev2/backups"

if [ -z "$1" ]; then
    echo "📋 Mevcut yedekler:"
    ls -lh "$BACKUP_DIR"/moneyflow_backup_*.sql 2>/dev/null | nl
    echo ""
    echo "Kullanım: ./restore-backup.sh <backup_dosyası>"
    echo "Örnek: ./restore-backup.sh $BACKUP_DIR/moneyflow_backup_20251027_093000.sql"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Yedek dosyası bulunamadı: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  DİKKAT: Bu işlem mevcut veritabanını silip yedeği geri yükleyecek!"
read -p "Devam etmek istiyor musunuz? (evet/hayır): " confirm

if [ "$confirm" != "evet" ]; then
    echo "❌ İşlem iptal edildi"
    exit 0
fi

echo "🔄 Veritabanı geri yükleniyor..."
docker exec -i moneyflow-db psql -U moneyflow -d moneyflow_dev < "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Geri yükleme başarılı!"
else
    echo "❌ Geri yükleme başarısız!"
    exit 1
fi

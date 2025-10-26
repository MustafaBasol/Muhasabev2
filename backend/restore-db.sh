#!/bin/bash

# Database Restore Script
# Veritabanını yedekten geri yükler

set -e

if [ -z "$1" ]; then
    echo "❌ Hata: Backup dosyası belirtilmedi!"
    echo ""
    echo "Kullanım: ./restore-db.sh <backup-file>"
    echo ""
    echo "Mevcut backup'lar:"
    ls -lh /workspaces/Muhasabev2/backend/backups/*.sql 2>/dev/null || echo "  Backup bulunamadı"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup dosyası bulunamadı: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  DİKKAT: Mevcut veritabanı silinecek!"
read -p "Devam etmek istiyor musunuz? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ İptal edildi"
    exit 1
fi

# Container çalışıyor mu kontrol et
if ! docker ps | grep -q "moneyflow-db"; then
    echo "❌ PostgreSQL container çalışmıyor!"
    exit 1
fi

echo "🔄 Veritabanı geri yükleniyor..."

# Veritabanını temizle
docker exec moneyflow-db psql -U moneyflow -d postgres -c "DROP DATABASE IF EXISTS moneyflow_dev;"
docker exec moneyflow-db psql -U moneyflow -d postgres -c "CREATE DATABASE moneyflow_dev;"

# Backup'ı geri yükle
docker exec -i moneyflow-db psql -U moneyflow moneyflow_dev < "$BACKUP_FILE"

echo "✅ Veritabanı başarıyla geri yüklendi!"
echo "📄 Kaynak: $BACKUP_FILE"

# Kullanıcı sayısını göster
USER_COUNT=$(docker exec moneyflow-db psql -U moneyflow -d moneyflow_dev -t -c "SELECT COUNT(*) FROM users;")
echo "👥 Kullanıcı sayısı: $USER_COUNT"

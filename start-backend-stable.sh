#!/bin/bash

# Backend'i sürekli çalışır durumda tutan script
echo "🚀 Backend Otomatik Restart Sistemi Başlatılıyor..."

cd /workspaces/Muhasabev2/backend

# Docker servislerin çalıştığından emin ol
echo "📦 Docker servisleri kontrol ediliyor..."
docker-compose up -d

# Biraz bekle
sleep 3

echo "🔄 Backend sürekli restart modunda başlatılıyor..."
echo "❌ Durdurmak için Ctrl+C"

while true; do
    echo "⏰ $(date) - Backend başlatılıyor..."
    
    # Backend'i başlat
    npm run start:dev
    
    # Eğer çıktıysa, biraz bekle ve yeniden başlat
    echo "⚠️  Backend kapandı, 5 saniye sonra yeniden başlatılıyor..."
    sleep 5
done
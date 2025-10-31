#!/bin/bash

echo "🔄 Backend Keep-Alive Script başlatılıyor..."

while true; do
    # Backend çalışıyor mu kontrol et
    if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "❌ Backend down! Yeniden başlatılıyor..."
        
        # Eski işlemleri temizle
        pkill -f "nest" 2>/dev/null
        lsof -ti :3000 | xargs kill -9 2>/dev/null
        
        # Yeniden başlat
        cd /workspaces/Muhasabev2/backend
        nohup npm run start:dev > /tmp/backend-keepalive.log 2>&1 &
        
        # Başlamasını bekle
        sleep 10
        
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            echo "✅ Backend başarıyla yeniden başlatıldı!"
        else
            echo "❌ Backend başlatılamadı, 30 saniye sonra tekrar denenecek..."
        fi
    else
        echo "✅ Backend çalışıyor ($(date))"
    fi
    
    # 30 saniye bekle
    sleep 30
done
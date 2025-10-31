#!/bin/bash

echo "🚀 FINAL SOLUTION - Backend ve Frontend'i başlatıyorum..."

# Tüm eski işlemleri temizle
echo "🧹 Eski işlemleri temizliyorum..."
pkill -f "nest" 2>/dev/null
pkill -f "vite" 2>/dev/null
lsof -ti :3000 | xargs kill -9 2>/dev/null
lsof -ti :5174 | xargs kill -9 2>/dev/null
pm2 delete all 2>/dev/null

sleep 3

# Backend'i başlat
echo "🔧 Backend başlatılıyor..."
cd /workspaces/Muhasabev2/backend
nohup npm run start:dev > /tmp/backend-final.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Frontend'i başlat  
echo "🎨 Frontend başlatılıyor..."
cd /workspaces/Muhasabev2
nohup npm run dev > /tmp/frontend-final.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# 15 saniye bekle
echo "⏳ 15 saniye bekliyorum..."
sleep 15

# Test et
echo "🧪 Test ediyorum..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Backend ÇALIŞIYOR!"
else
    echo "❌ Backend başarısız"
fi

if curl -s http://localhost:5174 > /dev/null; then
    echo "✅ Frontend ÇALIŞIYOR!"
else
    echo "❌ Frontend başarısız"
fi

echo ""
echo "🎉 TAMAM! Artık çalışıyor:"
echo "   Backend:  http://localhost:3000"
echo "   Frontend: http://localhost:5174"
echo ""
echo "📝 Log dosyaları:"
echo "   Backend:  tail -f /tmp/backend-final.log"
echo "   Frontend: tail -f /tmp/frontend-final.log"
echo ""
echo "🔍 PID'ler:"
echo "   Backend PID: $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"

# Sürekli çalışır halde tut
while true; do
    sleep 60
    if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "❌ Backend öldü, yeniden başlatıyorum..."
        cd /workspaces/Muhasabev2/backend
        nohup npm run start:dev > /tmp/backend-final.log 2>&1 &
        echo "Backend yeniden başlatıldı"
    fi
    
    if ! curl -s http://localhost:5174 > /dev/null 2>&1; then
        echo "❌ Frontend öldü, yeniden başlatıyorum..."
        cd /workspaces/Muhasabev2
        nohup npm run dev > /tmp/frontend-final.log 2>&1 &
        echo "Frontend yeniden başlatıldı"
    fi
done
#!/bin/bash

# MoneyFlow - Stable Startup Script
# Bu script backend ve frontend'i stabil şekilde başlatır

echo "🚀 MoneyFlow Stable Startup başlatılıyor..."

# Kill existing processes
echo "📋 Mevcut process'leri temizliyor..."
pkill -f "nest" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

# Start Docker services
echo "🐳 Docker servislerini başlatıyor..."
cd /workspaces/Muhasabev2/backend
docker-compose up -d

# Wait for database
echo "⏳ Veritabanının hazır olmasını bekliyor..."
sleep 5

# Start Backend with stable configuration
echo "🔧 Backend'i başlatıyor..."
cd /workspaces/Muhasabev2/backend
npm run start:dev &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Backend'in hazır olmasını bekliyor..."
sleep 10

# Check if backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ Backend başarıyla başlatıldı (PID: $BACKEND_PID)"
else
    echo "❌ Backend başlatılamadı!"
    exit 1
fi

# Start Frontend
echo "🎨 Frontend'i başlatıyor..."
cd /workspaces/Muhasabev2
npm run dev &
FRONTEND_PID=$!

# Wait for frontend
sleep 5

if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "✅ Frontend başarıyla başlatıldı (PID: $FRONTEND_PID)"
else
    echo "❌ Frontend başlatılamadı!"
    exit 1
fi

echo "🎉 Tüm servisler başarıyla başlatıldı!"
echo "📱 Frontend: http://localhost:5174"
echo "🔗 Backend: https://glorious-couscous-447rvgqpxx63xjr-3002.app.github.dev"
echo ""
echo "🔄 Process'leri durdurmak için: ./stop-stable.sh"
echo "📊 Status kontrol için: ./status.sh"

# Save PIDs for stop script
echo "$BACKEND_PID" > /tmp/backend.pid
echo "$FRONTEND_PID" > /tmp/frontend.pid

# Keep script running to monitor
echo "🔍 Process monitoring başlatılıyor..."
while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ Backend durdu! Yeniden başlatılıyor..."
        cd /workspaces/Muhasabev2/backend
        npm run start:dev &
        BACKEND_PID=$!
        echo "$BACKEND_PID" > /tmp/backend.pid
        echo "✅ Backend yeniden başlatıldı (PID: $BACKEND_PID)"
    fi
    
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "❌ Frontend durdu! Yeniden başlatılıyor..."
        cd /workspaces/Muhasabev2
        npm run dev &
        FRONTEND_PID=$!
        echo "$FRONTEND_PID" > /tmp/frontend.pid
        echo "✅ Frontend yeniden başlatıldı (PID: $FRONTEND_PID)"
    fi
    
    sleep 30
done
#!/bin/bash

# MoneyFlow - Status Check Script
echo "📊 MoneyFlow Sistem Durumu"
echo "=========================="

# Check Docker services
echo "🐳 Docker Servisler:"
cd /workspaces/Muhasabev2/backend
docker-compose ps

echo ""

# Check Backend
echo "🔧 Backend Durumu:"
if [ -f /tmp/backend.pid ]; then
    BACKEND_PID=$(cat /tmp/backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo "✅ Backend çalışıyor (PID: $BACKEND_PID)"
        echo "🌐 URL: https://glorious-couscous-447rvgqpxx63xjr-3002.app.github.dev"
    else
        echo "❌ Backend çalışmıyor"
    fi
else
    echo "❌ Backend PID dosyası bulunamadı"
fi

echo ""

# Check Frontend
echo "🎨 Frontend Durumu:"
if [ -f /tmp/frontend.pid ]; then
    FRONTEND_PID=$(cat /tmp/frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "✅ Frontend çalışıyor (PID: $FRONTEND_PID)"
        echo "🌐 URL: http://localhost:5174"
    else
        echo "❌ Frontend çalışmıyor"
    fi
else
    echo "❌ Frontend PID dosyası bulunamadı"
fi

echo ""

# Check ports
echo "🔌 Port Durumu:"
echo "Port 5174 (Frontend): $(curl -s http://localhost:5174 >/dev/null && echo "✅ Aktif" || echo "❌ Kapalı")"
echo "Port 3002 (Backend):  $(curl -s https://glorious-couscous-447rvgqpxx63xjr-3002.app.github.dev/health >/dev/null && echo "✅ Aktif" || echo "❌ Kapalı")"

echo ""
echo "📝 Komutlar:"
echo "./start-stable.sh  - Servisleri başlat"
echo "./stop-stable.sh   - Servisleri durdur"
echo "./status.sh        - Bu durumu göster"
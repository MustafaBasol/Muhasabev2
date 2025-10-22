#!/bin/bash#!/bin/bash



echo "🛑 MoneyFlow uygulamasını durduruyor..."# MoneyFlow - Stop Script

echo "🛑 MoneyFlow servislerini durduruyor..."

# PID dosyalarını kontrol et

if [ -f "/workspaces/Muhasabev2/logs/backend.pid" ]; then# Stop monitoring script

    BACKEND_PID=$(cat /workspaces/Muhasabev2/logs/backend.pid)pkill -f "start-stable.sh" 2>/dev/null || true

    if kill -0 $BACKEND_PID 2>/dev/null; then

        echo "🔧 Backend durduruluyor (PID: $BACKEND_PID)..."# Stop processes

        kill $BACKEND_PIDif [ -f /tmp/backend.pid ]; then

    fi    BACKEND_PID=$(cat /tmp/backend.pid)

    rm -f /workspaces/Muhasabev2/logs/backend.pid    if kill -0 $BACKEND_PID 2>/dev/null; then

fi        kill $BACKEND_PID

        echo "✅ Backend durduruldu (PID: $BACKEND_PID)"

if [ -f "/workspaces/Muhasabev2/logs/frontend.pid" ]; then    fi

    FRONTEND_PID=$(cat /workspaces/Muhasabev2/logs/frontend.pid)    rm -f /tmp/backend.pid

    if kill -0 $FRONTEND_PID 2>/dev/null; thenfi

        echo "🎨 Frontend durduruluyor (PID: $FRONTEND_PID)..."

        kill $FRONTEND_PIDif [ -f /tmp/frontend.pid ]; then

    fi    FRONTEND_PID=$(cat /tmp/frontend.pid)

    rm -f /workspaces/Muhasabev2/logs/frontend.pid    if kill -0 $FRONTEND_PID 2>/dev/null; then

fi        kill $FRONTEND_PID

        echo "✅ Frontend durduruldu (PID: $FRONTEND_PID)"

# Tüm süreçleri temizle    fi

echo "🧹 Kalan süreçleri temizliyor..."    rm -f /tmp/frontend.pid

pkill -f "vite\|nest\|node.*3003\|node.*5175" 2>/dev/null || truefi



sleep 2# Fallback - kill all related processes

echo "✅ Tüm servisler durduruldu!"pkill -f "nest" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo "🏁 Tüm servisler durduruldu!"
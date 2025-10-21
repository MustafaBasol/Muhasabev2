#!/bin/bash

# MoneyFlow - Stop Script
echo "🛑 MoneyFlow servislerini durduruyor..."

# Stop monitoring script
pkill -f "start-stable.sh" 2>/dev/null || true

# Stop processes
if [ -f /tmp/backend.pid ]; then
    BACKEND_PID=$(cat /tmp/backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID
        echo "✅ Backend durduruldu (PID: $BACKEND_PID)"
    fi
    rm -f /tmp/backend.pid
fi

if [ -f /tmp/frontend.pid ]; then
    FRONTEND_PID=$(cat /tmp/frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        kill $FRONTEND_PID
        echo "✅ Frontend durduruldu (PID: $FRONTEND_PID)"
    fi
    rm -f /tmp/frontend.pid
fi

# Fallback - kill all related processes
pkill -f "nest" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo "🏁 Tüm servisler durduruldu!"
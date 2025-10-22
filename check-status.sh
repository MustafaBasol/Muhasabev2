#!/bin/bash

echo "📊 MoneyFlow Durum Kontrolü"
echo "=========================="

# Backend kontrolü
if curl -s http://localhost:3003/health > /dev/null 2>&1; then
    echo "✅ Backend: ÇALIŞIYOR (Port 3003)"
else
    echo "❌ Backend: ÇALIŞMIYOR"
fi

# Frontend kontrolü
if curl -s http://localhost:5175 > /dev/null 2>&1; then
    echo "✅ Frontend: ÇALIŞIYOR (Port 5175)"
else
    echo "❌ Frontend: ÇALIŞMIYOR"
fi

# Veritabanı kontrolü
if docker ps | grep moneyflow-db > /dev/null; then
    echo "✅ Veritabanı: ÇALIŞIYOR"
else
    echo "❌ Veritabanı: ÇALIŞMIYOR"
fi

echo ""
echo "🔗 Bağlantılar:"
echo "Frontend: https://miniature-space-waddle-v4v5rgpjxgvfwjv-5175.app.github.dev"
echo "Backend:  https://miniature-space-waddle-v4v5rgpjxgvfwjv-3003.app.github.dev"

echo ""
echo "📝 Logları görmek için:"
echo "Backend: tail -f logs/backend.log"
echo "Frontend: tail -f logs/frontend.log"
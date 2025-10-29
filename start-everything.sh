#!/bin/bash

echo "🚀 MoneyFlow Ultimate Başlatma Scripti"
echo "====================================="

# Ana dizine git
cd /workspaces/Muhasabev2

# Backend dizinine git ve Docker'ı başlat
echo "📦 Docker servisleri başlatılıyor..."
cd backend
docker-compose up -d

# Docker'ın tamamen başlamasını bekle
echo "⏳ Docker servislerinin başlaması bekleniyor..."
sleep 10

# PM2'yi durdur (eğer çalışıyorsa)
echo "🛑 Eski PM2 süreçleri durduruluyor..."
pm2 delete all 2>/dev/null || true

# PM2 ile backend'i başlat
echo "🔥 PM2 ile backend başlatılıyor..."
pm2 start /workspaces/Muhasabev2/ecosystem.config.json

# Ana dizine dön ve frontend'i başlat
cd /workspaces/Muhasabev2
echo "🎨 Frontend başlatılıyor..."

# Eğer frontend çalışıyorsa durdur
pkill -f "vite" 2>/dev/null || true

# Frontend'i background'da başlat
nohup npm run dev > frontend.log 2>&1 &

sleep 5

echo ""
echo "✅ TAMAMLANDI!"
echo "==============="
echo "🔹 Backend: PM2 ile otomatik restart modunda"
echo "🔹 Frontend: Background'da çalışıyor"
echo "🔹 Docker: PostgreSQL, Redis, PgAdmin aktif"
echo ""
echo "📊 Durum kontrolü:"
echo "   pm2 status"
echo "   pm2 logs"
echo ""
echo "🛑 Durdurmak için:"
echo "   pm2 delete all"
echo "   pkill -f vite"
echo ""
echo "🌐 URL'ler:"
echo "   Frontend: http://localhost:5175"
echo "   Backend:  http://localhost:3000"
echo "   PgAdmin:  http://localhost:5050"
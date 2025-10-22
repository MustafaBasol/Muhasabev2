#!/bin/bash

echo "🚀 Muhasabe v2 - Codespace Geliştirme Ortamı Başlatılıyor..."
echo "=================================================="

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Mevcut process'leri temizle
echo -e "${YELLOW}🧹 Mevcut process'ler temizleniyor...${NC}"
pkill -f "nest|vite" 2>/dev/null || true
sleep 2

# Docker kontrol
echo -e "${BLUE}🐳 Docker servisleri kontrol ediliyor...${NC}"
if ! docker ps | grep -q "postgres\|redis"; then
    echo -e "${YELLOW}⚠️  Docker servisleri başlatılıyor...${NC}"
    cd /workspaces/Muhasabev2/backend
    docker-compose up -d
    sleep 5
fi

# Backend başlat
echo -e "${BLUE}🔧 Backend başlatılıyor (Port 3000)...${NC}"
cd /workspaces/Muhasabev2/backend

# Dependencies check
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Backend dependencies yükleniyor...${NC}"
    npm install
fi

npm run start:dev &
BACKEND_PID=$!

# Backend'in başlamasını bekle
echo -e "${YELLOW}⏳ Backend'in başlaması bekleniyor...${NC}"
sleep 8

# Health check
HEALTH_CHECK=$(curl -s "http://localhost:3000/health" 2>/dev/null || echo "failed")
if [[ "$HEALTH_CHECK" == *"Hello World"* ]]; then
    echo -e "${GREEN}✅ Backend başarıyla başlatıldı (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}❌ Backend başlatılamadı!${NC}"
    exit 1
fi

# Frontend başlat
echo -e "${BLUE}🎨 Frontend başlatılıyor (Port 5173)...${NC}"
cd /workspaces/Muhasabev2

# Dependencies check
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Frontend dependencies yükleniyor...${NC}"
    npm install
fi

npm run dev &
FRONTEND_PID=$!

# Frontend'in başlamasını bekle
echo -e "${YELLOW}⏳ Frontend'in başlaması bekleniyor...${NC}"
sleep 5

# URL'leri göster
echo ""
echo -e "${GREEN}🎉 TÜM SERVİSLER BAŞARILI BAŞLATILDI!${NC}"
echo "=================================================="
echo -e "${BLUE}🔧 Backend:${NC}"
echo "   • Local: http://localhost:3000"
echo "   • External: https://$CODESPACE_NAME-3000.app.github.dev"
echo "   • Health: http://localhost:3000/health"
echo ""
echo -e "${BLUE}🎨 Frontend:${NC}"
echo "   • Local: http://localhost:5173"  
echo "   • External: https://$CODESPACE_NAME-5173.app.github.dev"
echo ""
echo -e "${BLUE}👤 Demo Login:${NC}"
echo "   • Email: admin@test.com"
echo "   • Password: Test123456"
echo ""
echo -e "${YELLOW}📋 Process IDs:${NC}"
echo "   • Backend PID: $BACKEND_PID"
echo "   • Frontend PID: $FRONTEND_PID"
echo ""
echo -e "${GREEN}🌐 Frontend URL'i tarayıcıda aç:${NC}"
echo -e "${BLUE}https://$CODESPACE_NAME-5173.app.github.dev${NC}"
echo ""
echo -e "${YELLOW}💡 Servisleri durdurmak için: Ctrl+C${NC}"

# Process'leri bekle
wait
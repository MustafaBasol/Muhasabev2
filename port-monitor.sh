#!/bin/bash

echo "🛡️  Port Monitoring & Auto-Recovery Script"
echo "=========================================="

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Port kontrol fonksiyonu
check_backend() {
    curl -s http://localhost:3000/health > /dev/null 2>&1
    return $?
}

check_frontend() {
    curl -s http://localhost:5173 > /dev/null 2>&1
    return $?
}

# Backend başlatma fonksiyonu
start_backend() {
    echo -e "${BLUE}🔧 Backend başlatılıyor...${NC}"
    cd /workspaces/Muhasabev2/backend
    npm run start:dev > /tmp/backend.log 2>&1 &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    sleep 8
}

# Frontend başlatma fonksiyonu  
start_frontend() {
    echo -e "${BLUE}🎨 Frontend başlatılıyor...${NC}"
    cd /workspaces/Muhasabev2
    npm run dev > /tmp/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
    sleep 5
}

# İlk başlatma
echo -e "${YELLOW}🧹 Mevcut process'ler temizleniyor...${NC}"
pkill -f "nest|vite" 2>/dev/null || true
sudo lsof -ti:3000,5173 | xargs kill -9 2>/dev/null || true
sleep 3

start_backend
start_frontend

echo -e "${GREEN}🎉 İlk başlatma tamamlandı!${NC}"
echo "Frontend: https://$CODESPACE_NAME-5173.app.github.dev"
echo ""

# Sürekli monitoring
echo -e "${YELLOW}🛡️  Port monitoring başlatılıyor (30 sn aralıkla)...${NC}"
echo "Ctrl+C ile durdurmak için..."

while true; do
    sleep 30
    
    # Backend kontrol
    if ! check_backend; then
        echo -e "${RED}⚠️  Backend kapanmış! Yeniden başlatılıyor...${NC}"
        pkill -f "nest" 2>/dev/null || true
        sudo lsof -ti:3000 | xargs kill -9 2>/dev/null || true
        sleep 2
        start_backend
        echo -e "${GREEN}✅ Backend yeniden başlatıldı${NC}"
    else
        echo -e "${GREEN}✅ Backend çalışıyor${NC}"
    fi
    
    # Frontend kontrol
    if ! check_frontend; then
        echo -e "${RED}⚠️  Frontend kapanmış! Yeniden başlatılıyor...${NC}"
        pkill -f "vite" 2>/dev/null || true
        sudo lsof -ti:5173 | xargs kill -9 2>/dev/null || true
        sleep 2
        start_frontend
        echo -e "${GREEN}✅ Frontend yeniden başlatıldı${NC}"
        echo "Frontend: https://$CODESPACE_NAME-5173.app.github.dev"
    else
        echo -e "${GREEN}✅ Frontend çalışıyor${NC}"
    fi
    
    echo "---"
done
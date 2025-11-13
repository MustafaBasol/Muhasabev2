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
pkill -f "nest start|vite|dist/main|dist/src/main.js" 2>/dev/null || true
# Port 3001 dinleyen kalmış süreç varsa öldür
if command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -t -i:3001 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo -e "${YELLOW}🔪 Port 3001 kullanan süreçler sonlandırılıyor: $PIDS${NC}"
        kill -9 $PIDS 2>/dev/null || true
    fi
fi
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
echo -e "${BLUE}🔧 Backend başlatılıyor (Port 3001 - development)...${NC}"
cd /workspaces/Muhasabev2/backend

# Dependencies check
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Backend dependencies yükleniyor...${NC}"
    npm install
fi

# Backend loglarını dosyaya yaz
export NODE_ENV=development
export PORT=3001
# Development'ta Postgres kullan (docker-compose ile gelen servis)
export DATABASE_HOST=localhost
export DATABASE_PORT=5433
export DATABASE_USER=moneyflow
export DATABASE_PASSWORD=moneyflow123
export DATABASE_NAME=moneyflow_dev
echo -e "${BLUE}🗄️  DB: $DATABASE_USER@$DATABASE_HOST:$DATABASE_PORT/$DATABASE_NAME${NC}"
npm run start:dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Backend'in başlamasını bekle
echo -e "${YELLOW}⏳ Backend'in başlaması bekleniyor...${NC}"
sleep 8

# Health check
HEALTH_CHECK=$(curl -s "http://localhost:3001/health" 2>/dev/null || echo "failed")
if [[ "$HEALTH_CHECK" == *"Hello World"* ]]; then
    echo -e "${GREEN}✅ Backend başarıyla başlatıldı (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}❌ Backend başlatılamadı!${NC}"
    exit 1
fi

# Frontend başlat
echo -e "${BLUE}🎨 Frontend başlatılıyor (Port 5174)...${NC}"
cd /workspaces/Muhasabev2

# Dependencies check
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Frontend dependencies yükleniyor...${NC}"
    npm install
fi

npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Services:"
echo "  - Backend:  http://localhost:3001"
echo "  - Frontend: http://localhost:5174"
echo "  - Swagger:  http://localhost:3001/api/docs"
echo "  - pgAdmin:  http://localhost:5050"
echo ""
echo "📝 Logs:"
echo "  - Backend:  tail -f /tmp/backend.log"
echo "  - Frontend: tail -f /tmp/frontend.log"
echo ""
echo "🛑 To stop all services:"
echo "  - kill $BACKEND_PID $FRONTEND_PID"
echo "  - docker-compose -f /workspaces/Muhasabev2/backend/docker-compose.yml down"

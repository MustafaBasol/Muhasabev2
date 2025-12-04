#!/bin/bash

echo "🚀 Muhasabe v2 - Codespace Geliştirme Ortamı Başlatılıyor..."
echo "=================================================="

# .env yükle (varsa)
if [ -f ".env" ]; then
    echo -e "${BLUE}🔐 .env dosyası yükleniyor...${NC}"
    set -a
    . ./.env
    set +a
else
    echo -e "${YELLOW}ℹ️  .env bulunamadı, varsayılan değerler kullanılacak (MAIL_PROVIDER=log).${NC}"
fi

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
export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-3001}
# Development'ta Postgres kullan (docker-compose ile gelen servis)
export DATABASE_HOST=${DATABASE_HOST:-localhost}
export DATABASE_PORT=${DATABASE_PORT:-5433}
export DATABASE_USER=${DATABASE_USER:-moneyflow}
export DATABASE_PASSWORD=${DATABASE_PASSWORD:-moneyflow123}
export DATABASE_NAME=${DATABASE_NAME:-moneyflow_dev}
export MAIL_PROVIDER=${MAIL_PROVIDER:-log}
export MAIL_FROM=${MAIL_FROM:-no-reply@example.com}
export AWS_REGION=${AWS_REGION:-${SES_REGION:-us-east-1}}
export MAILERSEND_API_KEY=${MAILERSEND_API_KEY:-}

echo -e "${BLUE}📬 Mail provider: $MAIL_PROVIDER (from: $MAIL_FROM)${NC}"
if [ "$MAIL_PROVIDER" = "ses" ]; then
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        echo -e "${RED}❌ MAIL_PROVIDER=ses ancak AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY tanımlı değil. Gönderimler başarısız olacak.${NC}"
    else
        MASKED_KEY="${AWS_ACCESS_KEY_ID:0:6}***"
        echo -e "${GREEN}✅ SES kimlik bilgileri yüklendi (AWS_REGION=$AWS_REGION, KEY=$MASKED_KEY)${NC}"
    fi
elif [ "$MAIL_PROVIDER" = "mailersend" ] && [ -z "$MAILERSEND_API_KEY" ]; then
    echo -e "${RED}❌ MAIL_PROVIDER=mailersend ancak MAILERSEND_API_KEY tanımlı değil. Gönderimler başarısız olacak.${NC}"
fi
echo -e "${BLUE}🗄️  DB: $DATABASE_USER@$DATABASE_HOST:$DATABASE_PORT/$DATABASE_NAME${NC}"
npm run start:dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Backend'in başlamasını bekle ve health check'i retry ile yap
echo -e "${YELLOW}⏳ Backend'in başlaması bekleniyor...${NC}"
ATTEMPTS=0
MAX_ATTEMPTS=15
until [ $ATTEMPTS -ge $MAX_ATTEMPTS ]
do
    STATUS_CODE=$(curl -s -o /tmp/health.json -w "%{http_code}" "http://localhost:3001/health/email" || echo 000)
    if [ "$STATUS_CODE" = "200" ] && grep -q '"provider"' /tmp/health.json; then
        echo -e "${GREEN}✅ Backend başarıyla başlatıldı (PID: $BACKEND_PID)${NC}"
        break
    fi
    ATTEMPTS=$((ATTEMPTS+1))
    sleep 2
done

if [ $ATTEMPTS -ge $MAX_ATTEMPTS ]; then
    echo -e "${RED}❌ Backend başlatılamadı! (health check başarısız)${NC}"
    echo "--- Health response ($STATUS_CODE) ---"
    cat /tmp/health.json 2>/dev/null || true
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

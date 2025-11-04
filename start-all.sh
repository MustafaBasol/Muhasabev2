#!/bin/bash

# Renkli output için
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Tüm servisleri başlatıyorum...${NC}\n"

# Önce tüm servisleri durdur
echo -e "${YELLOW}📛 Eski servisleri durduruyor...${NC}"
pkill -f "nest start" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "node.*dist/main" 2>/dev/null
sleep 2

# Backend'i başlat
echo -e "${GREEN}🔧 Backend başlatılıyor...${NC}"
cd /workspaces/Muhasabev2/backend
npm run start:dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# 5 saniye bekle backend başlasın
sleep 5

# Backend'in çalışıp çalışmadığını kontrol et
if curl -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ Backend başarıyla başlatıldı (Port: 3000)${NC}"
else
    echo -e "${RED}❌ Backend başlatılamadı! Log: /tmp/backend.log${NC}"
fi

# Frontend'i başlat
echo -e "${GREEN}🎨 Frontend başlatılıyor...${NC}"
cd /workspaces/Muhasabev2
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# 3 saniye bekle frontend başlasın
sleep 3

# Frontend'in çalışıp çalışmadığını kontrol et
if curl -s http://localhost:5174 > /dev/null; then
    echo -e "${GREEN}✅ Frontend başarıyla başlatıldı (Port: 5174)${NC}"
else
    echo -e "${YELLOW}⏳ Frontend henüz hazır değil, biraz bekleyin...${NC}"
fi

echo -e "\n${GREEN}🎉 Tüm servisler başlatıldı!${NC}"
echo -e "${YELLOW}📝 Log dosyaları:${NC}"
echo "   Backend:  tail -f /tmp/backend.log"
echo "   Frontend: tail -f /tmp/frontend.log"
echo ""
echo -e "${YELLOW}🌐 Erişim URL'leri:${NC}"
echo "   Frontend: http://localhost:5174"
echo "   Backend:  http://localhost:3000"
echo "   Swagger:  http://localhost:3000/api/docs"
echo ""
echo -e "${YELLOW}🛑 Servisleri durdurmak için:${NC}"
echo "   pkill -f 'nest start' && pkill -f 'vite'"

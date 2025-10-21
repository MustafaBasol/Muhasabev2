#!/bin/bash

# Renkli output için
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🔍 Servis izleme başlatıldı...${NC}"
echo -e "${YELLOW}Her 10 saniyede bir servisleri kontrol ediyorum...${NC}\n"

while true; do
    # Backend kontrolü
    if ! curl -s http://localhost:3002/health > /dev/null 2>&1; then
        echo -e "${RED}❌ Backend çalışmıyor! Yeniden başlatılıyor...${NC}"
        cd /workspaces/Muhasabev2/backend
        pkill -f "nest start" 2>/dev/null
        npm run start:dev > /tmp/backend.log 2>&1 &
        sleep 5
        
        if curl -s http://localhost:3002/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Backend yeniden başlatıldı!${NC}"
        else
            echo -e "${RED}⚠️  Backend başlatılamadı! Log: /tmp/backend.log${NC}"
        fi
    fi
    
    # Frontend kontrolü
    if ! curl -s -o /dev/null http://localhost:5174 2>&1; then
        echo -e "${RED}❌ Frontend çalışmıyor! Yeniden başlatılıyor...${NC}"
        cd /workspaces/Muhasabev2
        pkill -f "vite" 2>/dev/null
        npm run dev > /tmp/frontend.log 2>&1 &
        sleep 3
        
        if curl -s -o /dev/null http://localhost:5174 2>&1; then
            echo -e "${GREEN}✅ Frontend yeniden başlatıldı!${NC}"
        else
            echo -e "${YELLOW}⏳ Frontend henüz hazır değil...${NC}"
        fi
    fi
    
    # 10 saniye bekle
    sleep 10
done

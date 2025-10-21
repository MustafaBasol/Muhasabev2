#!/bin/bash

# Renkli output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║       🚀 Muhasabe v2 - Servis Başlatıcı 🚀           ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Servisleri başlat
/workspaces/Muhasabev2/start-all.sh

echo -e "\n${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Sistem hazır! Artık kodlama yapabilirsiniz! ✨${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}📌 Kullanışlı Komutlar:${NC}"
echo "   🌐 Frontend: http://localhost:5174"
echo "   🔧 Backend:  http://localhost:3002"
echo "   📋 Loglar:   tail -f /tmp/backend.log"
echo "   📋 Loglar:   tail -f /tmp/frontend.log"
echo "   🛑 Durdur:   pkill -f 'nest start' && pkill -f 'vite'"
echo ""

echo -e "${BLUE}💡 İpucu: Servisler çökerse otomatik yeniden başlatma için:${NC}"
echo -e "${YELLOW}   ./watch-services.sh &${NC}"
echo ""

#!/bin/bash
# Güvenli başlatma scripti - Verilerinizi korur

echo "🚀 Muhasebe Uygulaması Başlatılıyor..."
echo ""

# 1. Docker servisleri kontrol et ve başlat
echo "📦 Docker servisleri kontrol ediliyor..."
if ! docker ps | grep -q moneyflow-db; then
    echo "🔄 PostgreSQL başlatılıyor..."
    cd /workspaces/Muhasabev2/backend
    docker-compose up -d postgres redis
    sleep 5
else
    echo "✅ PostgreSQL zaten çalışıyor"
fi

# 2. Backend'i başlat
echo "🔧 Backend başlatılıyor..."
pkill -f 'nest start' 2>/dev/null
cd /workspaces/Muhasabev2/backend
npm run start:dev > /tmp/backend.log 2>&1 &
sleep 8

# 3. Frontend'i başlat
echo "🎨 Frontend başlatılıyor..."
pkill -f 'vite' 2>/dev/null
cd /workspaces/Muhasabev2
npm run dev > /tmp/frontend.log 2>&1 &
sleep 5

# 4. Durum kontrolü
echo ""
echo "📊 Servis Durumu:"
if lsof -i :3000 >/dev/null 2>&1; then
    echo "✅ Backend çalışıyor (Port 3000)"
else
    echo "❌ Backend başlatılamadı!"
fi

if lsof -i :5173 >/dev/null 2>&1; then
    echo "✅ Frontend çalışıyor (Port 5173)"
else
    echo "❌ Frontend başlatılamadı!"
fi

# 5. Veritabanı kontrolü
echo ""
echo "🗄️  Veritabanı Durumu:"
USER_COUNT=$(docker exec moneyflow-db psql -U moneyflow -d moneyflow_dev -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ')
if [ ! -z "$USER_COUNT" ]; then
    echo "✅ Veritabanı bağlantısı OK - $USER_COUNT kullanıcı mevcut"
else
    echo "❌ Veritabanına bağlanılamadı!"
fi

# 6. URL'leri göster
echo ""
echo "🌐 Erişim URL'leri:"
if [ ! -z "$CODESPACE_NAME" ]; then
    echo "Frontend: https://$CODESPACE_NAME-5173.app.github.dev"
    echo "Backend:  https://$CODESPACE_NAME-3000.app.github.dev"
else
    echo "Frontend: http://localhost:5173"
    echo "Backend:  http://localhost:3000"
fi

echo ""
echo "👤 Demo Giriş:"
echo "   Email: admin@test.com"
echo "   Şifre: Test123456"
echo ""
echo "💾 Yedekleme: ./quick-backup.sh"
echo "📖 Dokümantasyon: DATA_PERSISTENCE.md"
echo ""
echo "✨ Uygulama hazır!"

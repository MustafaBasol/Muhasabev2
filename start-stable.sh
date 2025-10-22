#!/bin/bash#!/bin/bash



# MoneyFlow Uygulamasını Çalıştırma Script'i# MoneyFlow - Stable Startup Script

# Bu script her şeyi düzgün bir şekilde başlatır# Bu script backend ve frontend'i stabil şekilde başlatır



echo "🧹 Mevcut süreçleri temizliyor..."echo "🚀 MoneyFlow Stable Startup başlatılıyor..."

pkill -f "vite\|nest\|node.*3003\|node.*5175" 2>/dev/null || true

sleep 3# Kill existing processes

echo "📋 Mevcut process'leri temizliyor..."

echo "🗄️ Veritabanı durumunu kontrol ediyor..."pkill -f "nest" 2>/dev/null || true

docker ps | grep moneyflow-db || {pkill -f "vite" 2>/dev/null || true

    echo "❌ Veritabanı çalışmıyor! Docker'ı başlatın:"sleep 2

    echo "cd backend && docker-compose up -d"

    exit 1# Start Docker services

}echo "🐳 Docker servislerini başlatıyor..."

cd /workspaces/Muhasabev2/backend

echo "⚙️ Backend başlatılıyor..."docker-compose up -d

cd /workspaces/Muhasabev2/backend

nohup npm run start:dev > ../logs/backend.log 2>&1 &# Wait for database

BACKEND_PID=$!echo "⏳ Veritabanının hazır olmasını bekliyor..."

echo "Backend PID: $BACKEND_PID"sleep 5



echo "⏳ Backend'in başlamasını bekliyor..."# Start Backend with stable configuration

sleep 10echo "🔧 Backend'i başlatıyor..."

cd /workspaces/Muhasabev2/backend

# Backend'in çalışıp çalışmadığını kontrol etnpm run start:dev &

for i in {1..30}; doBACKEND_PID=$!

    if curl -s http://localhost:3003/health > /dev/null 2>&1; then

        echo "✅ Backend başarıyla çalışıyor!"# Wait for backend to be ready

        breakecho "⏳ Backend'in hazır olmasını bekliyor..."

    fisleep 10

    if [ $i -eq 30 ]; then

        echo "❌ Backend başlatılamadı!"# Check if backend is running

        exit 1if kill -0 $BACKEND_PID 2>/dev/null; then

    fi    echo "✅ Backend başarıyla başlatıldı (PID: $BACKEND_PID)"

    echo "⏳ Backend için bekleniyor... ($i/30)"else

    sleep 2    echo "❌ Backend başlatılamadı!"

done    exit 1

fi

echo "🎨 Frontend başlatılıyor..."

cd /workspaces/Muhasabev2# Start Frontend

nohup npm run dev > logs/frontend.log 2>&1 &echo "🎨 Frontend'i başlatıyor..."

FRONTEND_PID=$!cd /workspaces/Muhasabev2

echo "Frontend PID: $FRONTEND_PID"npm run dev &

FRONTEND_PID=$!

echo "⏳ Frontend'in başlamasını bekliyor..."

sleep 8# Wait for frontend

sleep 5

# Frontend'in çalışıp çalışmadığını kontrol et

for i in {1..20}; doif kill -0 $FRONTEND_PID 2>/dev/null; then

    if curl -s http://localhost:5175 > /dev/null 2>&1; then    echo "✅ Frontend başarıyla başlatıldı (PID: $FRONTEND_PID)"

        echo "✅ Frontend başarıyla çalışıyor!"else

        break    echo "❌ Frontend başlatılamadı!"

    fi    exit 1

    if [ $i -eq 20 ]; thenfi

        echo "❌ Frontend başlatılamadı!"

        exit 1echo "🎉 Tüm servisler başarıyla başlatıldı!"

    fiecho "📱 Frontend: http://localhost:5174"

    echo "⏳ Frontend için bekleniyor... ($i/20)"echo "🔗 Backend: https://glorious-couscous-447rvgqpxx63xjr-3002.app.github.dev"

    sleep 2echo ""

doneecho "🔄 Process'leri durdurmak için: ./stop-stable.sh"

echo "📊 Status kontrol için: ./status.sh"

echo "📝 PID'leri dosyaya kaydediyor..."

echo $BACKEND_PID > /workspaces/Muhasabev2/logs/backend.pid# Save PIDs for stop script

echo $FRONTEND_PID > /workspaces/Muhasabev2/logs/frontend.pidecho "$BACKEND_PID" > /tmp/backend.pid

echo "$FRONTEND_PID" > /tmp/frontend.pid

echo ""

echo "🎉 BAŞARILI! Uygulama çalışıyor:"# Keep script running to monitor

echo "👨‍💻 Frontend: https://miniature-space-waddle-v4v5rgpjxgvfwjv-5175.app.github.dev"echo "🔍 Process monitoring başlatılıyor..."

echo "🔧 Backend:  https://miniature-space-waddle-v4v5rgpjxgvfwjv-3003.app.github.dev"while true; do

echo "📚 API Docs: https://miniature-space-waddle-v4v5rgpjxgvfwjv-3003.app.github.dev/api"    if ! kill -0 $BACKEND_PID 2>/dev/null; then

echo ""        echo "❌ Backend durdu! Yeniden başlatılıyor..."

echo "🔍 Durum kontrolü için: ./status.sh"        cd /workspaces/Muhasabev2/backend

echo "🛑 Durdurmak için: ./stop-stable.sh"        npm run start:dev &

echo ""        BACKEND_PID=$!

echo "📊 Canlı loglar:"        echo "$BACKEND_PID" > /tmp/backend.pid

echo "Backend: tail -f logs/backend.log"        echo "✅ Backend yeniden başlatıldı (PID: $BACKEND_PID)"

echo "Frontend: tail -f logs/frontend.log"    fi
    
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "❌ Frontend durdu! Yeniden başlatılıyor..."
        cd /workspaces/Muhasabev2
        npm run dev &
        FRONTEND_PID=$!
        echo "$FRONTEND_PID" > /tmp/frontend.pid
        echo "✅ Frontend yeniden başlatıldı (PID: $FRONTEND_PID)"
    fi
    
    sleep 30
done
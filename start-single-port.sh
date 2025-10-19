#!/bin/bash

echo "🚀 MoneyFlow Starting (Single Port Mode)..."
echo ""

# Docker container'ları kontrol et ve başlat
echo "📦 Checking Docker containers..."
cd /workspaces/Muhasabev2/backend

RUNNING=$(docker ps -q -f name=moneyflow-db)
if [ -z "$RUNNING" ]; then
  echo "   Starting Docker containers..."
  docker-compose up -d
  echo "   ⏳ Waiting for database (8 seconds)..."
  sleep 8
else
  echo "   ✅ Docker containers already running"
fi

# Backend'i kontrol et
BACKEND_RUNNING=$(ps aux | grep "[n]est start" | grep -v grep)
if [ -z "$BACKEND_RUNNING" ]; then
  echo ""
  echo "🔧 Starting backend..."
  cd /workspaces/Muhasabev2/backend
  npm run start:dev > /tmp/backend.log 2>&1 &
  BACKEND_PID=$!
  echo "   Backend PID: $BACKEND_PID"
  echo "   ⏳ Waiting for backend to start (10 seconds)..."
  sleep 10
  
  # Backend'in başarıyla başladığını kontrol et
  if curl -s http://localhost:3002/health > /dev/null; then
    echo "   ✅ Backend started successfully!"
  else
    echo "   ⚠️  Backend may not be ready yet. Check logs: tail -f /tmp/backend.log"
  fi
else
  echo ""
  echo "✅ Backend already running"
fi

echo ""
echo "═══════════════════════════════════════════"
echo "🎉 MoneyFlow is ready!"
echo "═══════════════════════════════════════════"
echo ""
echo "🌐 Application URL:"
echo "   👉 http://localhost:3002"
echo ""
echo "📚 Other URLs:"
echo "   • API Swagger:  http://localhost:3002/api"
echo "   • Health Check: http://localhost:3002/health"
echo "   • pgAdmin:      http://localhost:5050"
echo ""
echo "🔨 Development:"
echo "   • Backend logs:  tail -f /tmp/backend.log"
echo "   • Rebuild frontend: ./build-and-deploy.sh"
echo ""
echo "🛑 Stop services:"
echo "   • ./stop-dev.sh"
echo ""

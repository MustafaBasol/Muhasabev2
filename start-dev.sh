#!/bin/bash

echo "🚀 MoneyFlow Development Environment Starting..."

# Docker container'ları başlat
echo "📦 Starting Docker containers..."
cd /workspaces/Muhasabev2/backend
docker-compose up -d

# Docker'ın hazır olmasını bekle
echo "⏳ Waiting for database..."
sleep 5

# Backend'i başlat
echo "🔧 Starting backend..."
cd /workspaces/Muhasabev2/backend
npm run start:dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Backend'in başlamasını bekle
echo "⏳ Waiting for backend to start..."
sleep 8

# Frontend'i başlat
echo "🎨 Starting frontend..."
cd /workspaces/Muhasabev2
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Services:"
echo "  - Backend:  http://localhost:3002"
echo "  - Frontend: http://localhost:5173"
echo "  - Swagger:  http://localhost:3002/api"
echo "  - pgAdmin:  http://localhost:5050"
echo ""
echo "📝 Logs:"
echo "  - Backend:  tail -f /tmp/backend.log"
echo "  - Frontend: tail -f /tmp/frontend.log"
echo ""
echo "🛑 To stop all services:"
echo "  - kill $BACKEND_PID $FRONTEND_PID"
echo "  - docker-compose -f /workspaces/Muhasabev2/backend/docker-compose.yml down"

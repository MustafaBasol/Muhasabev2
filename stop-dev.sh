#!/bin/bash

echo "🛑 Stopping MoneyFlow Development Environment..."

# Backend ve Frontend process'lerini durdur
echo "Stopping backend and frontend..."
pkill -f "nest start"
pkill -f "vite"

# Docker container'ları durdur
echo "Stopping Docker containers..."
cd /workspaces/Muhasabev2/backend
docker-compose down

# Log dosyalarını temizle
rm -f /tmp/backend.log /tmp/frontend.log

echo "✅ All services stopped!"

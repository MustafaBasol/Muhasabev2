#!/bin/bash

echo "� MoneyFlow Services Status (PM2)"
echo "=================================="
pm2 status

echo ""
echo "� Port Status:"
echo "Backend (Port 3000):"
lsof -i :3000 | head -2

echo "Frontend (Port 5174):"
lsof -i :5174 | head -2

echo ""
echo "🔗 Access URLs:"
echo "Frontend: https://damp-wraith-7q9x5r7j6qrcgg6-5174.app.github.dev"
echo "Backend API: https://damp-wraith-7q9x5r7j6qrcgg6-3000.app.github.dev"
echo "Swagger Docs: https://damp-wraith-7q9x5r7j6qrcgg6-3000.app.github.dev/api"

echo ""
echo "📋 Useful Commands:"
echo "pm2 status          - Show status"
echo "pm2 logs            - Show all logs"
echo "pm2 logs moneyflow-backend    - Show backend logs"
echo "pm2 logs moneyflow-frontend   - Show frontend logs"
echo "pm2 restart all     - Restart all services"
echo "pm2 stop all        - Stop all services"
echo "pm2 delete all      - Delete all services"
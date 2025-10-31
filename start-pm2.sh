#!/bin/bash

echo "🚀 Starting MoneyFlow Services with PM2..."

# PM2'yi başlat
pm2 start pm2.config.cjs

echo ""
echo "✅ Services started!"
echo ""
echo "🔗 Access URLs:"
echo "Frontend: https://damp-wraith-7q9x5r7j6qrcgg6-5174.app.github.dev"
echo "Backend API: https://damp-wraith-7q9x5r7j6qrcgg6-3000.app.github.dev"
echo ""
echo "📊 Check status: ./status.sh"
echo "📋 View logs: pm2 logs"
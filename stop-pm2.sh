#!/bin/bash

echo "🛑 Stopping MoneyFlow Services..."

# PM2 servislerini durdur
pm2 stop all

echo ""
echo "✅ All services stopped!"
echo ""
echo "📊 Check status: ./status.sh"
echo "🚀 Start again: ./start-pm2.sh"
#!/usr/bin/env bash
set -e

echo "🚀 Backend başlatılıyor (yalnızca backend)"
cd "$(dirname "$0")/backend"

# .env dosyasını erken yükle (dotenv öncesi), böylece script default'ları .env'i ezmez
if [ -f ./.env ]; then
  echo "📄 .env yükleniyor (backend/.env)"
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# Çakışan süreç/port temizliği
echo "🧹 Çakışan süreçler/portlar temizleniyor..."
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -t -i:3001 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "   🔪 Port 3001 kullanan süreçler sonlandırılıyor: $PIDS"
    kill -9 $PIDS 2>/dev/null || true
  fi
fi
pkill -f "nest start|dist/main|node dist/main|ts-node .*main" 2>/dev/null || true
sleep 1

# Docker servislerini ayağa kaldır
if ! docker ps | grep -q "moneyflow-db\|moneyflow-redis"; then
  echo "🐳 Docker servisleri başlatılıyor..."
  docker-compose up -d
  echo "⏳ Veritabanı için kısa bekleme..."; sleep 6
fi

# Bağımlılıklar
if [ ! -d node_modules ]; then
  echo "📦 npm install (backend)"
  npm install
fi

export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-3001}
export DATABASE_HOST=${DATABASE_HOST:-localhost}
export DATABASE_PORT=${DATABASE_PORT:-5433}
export DATABASE_USER=${DATABASE_USER:-moneyflow}
export DATABASE_PASSWORD=${DATABASE_PASSWORD:-moneyflow123}
export DATABASE_NAME=${DATABASE_NAME:-moneyflow_dev}
# E-posta değişkenlerini .env'den gelen değerler varsa koru; yoksa varsayılan ver
export MAIL_PROVIDER=${MAIL_PROVIDER:-log}
export MAIL_FROM=${MAIL_FROM:-no-reply@example.com}
export AWS_REGION=${AWS_REGION:-${SES_REGION:-us-east-1}}

echo "✉️  Email config: provider=$MAIL_PROVIDER from=$MAIL_FROM region=${AWS_REGION:-n/a}"

# Çalıştır ve logları arkaplana al
echo "🔧 nest start --watch (port $PORT)"
nohup npm run start:dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Health check (health endpoint global prefix dışında)
ATT=0; MAX=20
until [ $ATT -ge $MAX ]; do
  CODE=$(curl -s -o /tmp/health.json -w "%{http_code}" "http://localhost:${PORT}/health/email" || echo 000)
  if [ "$CODE" = "200" ]; then
    echo "✅ Backend ayakta (PID=$BACKEND_PID, PORT=$PORT)"
    echo "ℹ️  Loglar: tail -f /tmp/backend.log"
    exit 0
  fi
  ATT=$((ATT+1)); sleep 2
done

echo "❌ Health check başarısız. Logları kontrol edin: tail -n 200 /tmp/backend.log"
exit 1

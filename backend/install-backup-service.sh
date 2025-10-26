#!/bin/bash

# Systemd Service Installer for Auto Backup
# Production sunucular için systemd servisi oluşturur

SERVICE_NAME="moneyflow-backup"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
TIMER_FILE="/etc/systemd/system/${SERVICE_NAME}.timer"
SCRIPT_PATH="/opt/moneyflow/backend/backup-db.sh"

# Root kontrolü
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Bu script root olarak çalıştırılmalı"
    echo "Kullanım: sudo $0"
    exit 1
fi

echo "🔧 Moneyflow Otomatik Backup Servisi Kuruluyor..."

# Service dosyası oluştur
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=MoneyFlow Database Backup Service
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=root
WorkingDirectory=/opt/moneyflow/backend
ExecStart=$SCRIPT_PATH
StandardOutput=append:/var/log/moneyflow-backup.log
StandardError=append:/var/log/moneyflow-backup.log

[Install]
WantedBy=multi-user.target
EOF

# Timer dosyası oluştur (Her gün saat 03:00)
cat > "$TIMER_FILE" << EOF
[Unit]
Description=MoneyFlow Daily Backup Timer
Requires=${SERVICE_NAME}.service

[Timer]
# Her gün saat 03:00'te çalıştır
OnCalendar=daily
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Systemd'yi yeniden yükle
systemctl daemon-reload

# Timer'ı aktifleştir ve başlat
systemctl enable ${SERVICE_NAME}.timer
systemctl start ${SERVICE_NAME}.timer

echo "✅ Kurulum tamamlandı!"
echo ""
echo "📋 Kullanım:"
echo "  • Durumu kontrol et:    systemctl status ${SERVICE_NAME}.timer"
echo "  • Manuel backup al:     systemctl start ${SERVICE_NAME}.service"
echo "  • Logları görüntüle:    journalctl -u ${SERVICE_NAME}.service"
echo "  • Timer'ı durdur:       systemctl stop ${SERVICE_NAME}.timer"
echo "  • Timer'ı kaldır:       systemctl disable ${SERVICE_NAME}.timer"
echo ""
echo "🕐 Sonraki backup zamanı:"
systemctl list-timers ${SERVICE_NAME}.timer

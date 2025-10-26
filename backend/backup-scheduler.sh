#!/bin/bash

# Otomatik Backup Scheduler
# Cron job gibi çalışır, her gün belirtilen saatte backup alır

BACKUP_SCRIPT="/workspaces/Muhasabev2/backend/backup-db.sh"
BACKUP_DIR="/workspaces/Muhasabev2/backend/backups"
LOG_FILE="/tmp/backup-scheduler.log"

# Varsayılan: Her gün saat 03:00'te backup al
BACKUP_HOUR=${BACKUP_HOUR:-3}
BACKUP_MINUTE=${BACKUP_MINUTE:-0}

echo "⏰ Otomatik Backup Scheduler Başlatıldı" | tee -a "$LOG_FILE"
echo "📅 Backup zamanı: Her gün ${BACKUP_HOUR}:$(printf "%02d" $BACKUP_MINUTE)" | tee -a "$LOG_FILE"
echo "📂 Backup klasörü: $BACKUP_DIR" | tee -a "$LOG_FILE"
echo "📝 Log dosyası: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Son backup zamanı
last_backup_date=""

while true; do
    current_hour=$(date +%H)
    current_minute=$(date +%M)
    current_date=$(date +%Y-%m-%d)
    
    # Backup zamanı geldi mi ve bugün henüz alınmadı mı?
    if [ "$current_hour" -eq "$BACKUP_HOUR" ] && [ "$current_minute" -eq "$BACKUP_MINUTE" ]; then
        if [ "$last_backup_date" != "$current_date" ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔄 Otomatik backup başlatılıyor..." | tee -a "$LOG_FILE"
            
            # Backup al
            if $BACKUP_SCRIPT >> "$LOG_FILE" 2>&1; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Otomatik backup başarılı!" | tee -a "$LOG_FILE"
                last_backup_date=$current_date
                
                # Git'e commit et (opsiyonel)
                if [ "$AUTO_GIT_COMMIT" = "true" ]; then
                    cd /workspaces/Muhasabev2
                    git add backend/backups/*.sql
                    git commit -m "Automated backup: $(date '+%Y-%m-%d %H:%M')" >> "$LOG_FILE" 2>&1 || true
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📤 Backup Git'e commit edildi" | tee -a "$LOG_FILE"
                fi
            else
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Otomatik backup BAŞARISIZ!" | tee -a "$LOG_FILE"
            fi
            
            echo "" | tee -a "$LOG_FILE"
        fi
    fi
    
    # 60 saniye bekle
    sleep 60
done

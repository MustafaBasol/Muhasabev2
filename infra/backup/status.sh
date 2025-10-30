#!/bin/bash

# Backup Status and Statistics Script
# Shows current backup system status and statistics

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../" && pwd)"

# Source configuration
source "$SCRIPT_DIR/config/backup.conf" 2>/dev/null || {
    BACKUP_DIR="$PROJECT_ROOT/backend/backups"
    LOG_FILE="/tmp/backup.log"
}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 MoneyFlow Backup System Status${NC}"
echo ""

# System Health Check
echo -e "${BLUE}🔍 System Health Check:${NC}"

# Check backup directory
if [[ -d "$BACKUP_DIR" ]]; then
    echo -e "   Backup Directory: ${GREEN}✓ OK${NC} ($BACKUP_DIR)"
else
    echo -e "   Backup Directory: ${RED}✗ NOT FOUND${NC} ($BACKUP_DIR)"
fi

# Check Docker container
if docker ps | grep -q "moneyflow-db"; then
    echo -e "   Database Container: ${GREEN}✓ RUNNING${NC}"
else
    echo -e "   Database Container: ${RED}✗ NOT RUNNING${NC}"
fi

# Check database connectivity
if docker exec moneyflow-db pg_isready -U moneyflow >/dev/null 2>&1; then
    echo -e "   Database Connection: ${GREEN}✓ OK${NC}"
else
    echo -e "   Database Connection: ${RED}✗ FAILED${NC}"
fi

# Check encryption key
if [[ -f "$ENCRYPTION_KEY_FILE" ]]; then
    echo -e "   Encryption Key: ${GREEN}✓ PRESENT${NC}"
else
    echo -e "   Encryption Key: ${YELLOW}⚠ MISSING${NC}"
fi

# Check disk space
if [[ -d "$BACKUP_DIR" ]]; then
    available_gb=$(df -BG "$BACKUP_DIR" | tail -1 | awk '{print $4}' | sed 's/G//')
    if [[ $available_gb -gt 5 ]]; then
        echo -e "   Disk Space: ${GREEN}✓ OK${NC} (${available_gb}GB available)"
    elif [[ $available_gb -gt 1 ]]; then
        echo -e "   Disk Space: ${YELLOW}⚠ LOW${NC} (${available_gb}GB available)"
    else
        echo -e "   Disk Space: ${RED}✗ CRITICAL${NC} (${available_gb}GB available)"
    fi
fi

echo ""

# Backup Statistics
echo -e "${BLUE}📈 Backup Statistics:${NC}"

if [[ -d "$BACKUP_DIR" ]]; then
    backup_files=($(find "$BACKUP_DIR" -name "moneyflow_backup_*.sql*" -type f))
    total_backups=${#backup_files[@]}
    
    if [[ $total_backups -gt 0 ]]; then
        echo "   Total Backups: $total_backups"
        
        # Calculate total size
        total_size=0
        for file in "${backup_files[@]}"; do
            size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
            total_size=$((total_size + size))
        done
        total_size_human=$(numfmt --to=iec-i --suffix=B "$total_size" 2>/dev/null || echo "$((total_size / 1024 / 1024))MB")
        echo "   Total Size: $total_size_human"
        
        # Average backup size
        avg_size=$((total_size / total_backups))
        avg_size_human=$(numfmt --to=iec-i --suffix=B "$avg_size" 2>/dev/null || echo "$((avg_size / 1024 / 1024))MB")
        echo "   Average Size: $avg_size_human"
        
        # Latest backup info
        latest_backup=$(find "$BACKUP_DIR" -name "moneyflow_backup_*.sql*" -type f | sort -r | head -1)
        if [[ -n "$latest_backup" ]]; then
            latest_basename=$(basename "$latest_backup")
            latest_size=$(stat -f%z "$latest_backup" 2>/dev/null || stat -c%s "$latest_backup" 2>/dev/null)
            latest_size_human=$(numfmt --to=iec-i --suffix=B "$latest_size" 2>/dev/null || echo "$((latest_size / 1024 / 1024))MB")
            
            # Extract date from filename
            if [[ "$latest_basename" =~ moneyflow_backup_([0-9]{8}_[0-9]{6}) ]]; then
                timestamp="${BASH_REMATCH[1]}"
                latest_date=$(date -d "${timestamp:0:8} ${timestamp:9:2}:${timestamp:11:2}:${timestamp:13:2}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$timestamp")
                echo "   Latest Backup: $latest_date ($latest_size_human)"
                
                # Calculate age
                backup_time=$(date -d "${timestamp:0:8} ${timestamp:9:2}:${timestamp:11:2}:${timestamp:13:2}" +%s 2>/dev/null || echo 0)
                current_time=$(date +%s)
                if [[ $backup_time -gt 0 ]]; then
                    age_hours=$(((current_time - backup_time) / 3600))
                    if [[ $age_hours -lt 24 ]]; then
                        echo -e "   Backup Age: ${GREEN}${age_hours} hours${NC}"
                    elif [[ $age_hours -lt 48 ]]; then
                        echo -e "   Backup Age: ${YELLOW}${age_hours} hours${NC}"
                    else
                        echo -e "   Backup Age: ${RED}${age_hours} hours${NC}"
                    fi
                fi
            fi
        fi
        
        # Backup types
        encrypted_count=$(find "$BACKUP_DIR" -name "*.enc" -type f | wc -l)
        compressed_count=$(find "$BACKUP_DIR" -name "*.gz" -type f | wc -l)
        echo "   Encrypted: $encrypted_count"
        echo "   Compressed: $compressed_count"
        
    else
        echo -e "   ${YELLOW}No backup files found${NC}"
    fi
fi

echo ""

# Recent Activity
echo -e "${BLUE}📝 Recent Activity:${NC}"

if [[ -f "$LOG_FILE" ]]; then
    echo "   Log file: $LOG_FILE"
    echo ""
    echo "   Last 5 entries:"
    tail -5 "$LOG_FILE" | while IFS= read -r line; do
        if [[ "$line" =~ ERROR ]]; then
            echo -e "   ${RED}$line${NC}"
        elif [[ "$line" =~ WARN ]]; then
            echo -e "   ${YELLOW}$line${NC}"
        else
            echo "   $line"
        fi
    done
else
    echo -e "   ${YELLOW}No log file found${NC}"
fi

echo ""

# Recommendations
echo -e "${BLUE}💡 Recommendations:${NC}"

if [[ $total_backups -eq 0 ]]; then
    echo -e "   ${YELLOW}• Run './backup.sh' to create your first backup${NC}"
fi

latest_backup=$(find "$BACKUP_DIR" -name "moneyflow_backup_*.sql*" -type f | sort -r | head -1)
if [[ -n "$latest_backup" ]]; then
    latest_basename=$(basename "$latest_backup")
    if [[ "$latest_basename" =~ moneyflow_backup_([0-9]{8}_[0-9]{6}) ]]; then
        timestamp="${BASH_REMATCH[1]}"
        backup_time=$(date -d "${timestamp:0:8} ${timestamp:9:2}:${timestamp:11:2}:${timestamp:13:2}" +%s 2>/dev/null || echo 0)
        current_time=$(date +%s)
        age_hours=$(((current_time - backup_time) / 3600))
        
        if [[ $age_hours -gt 24 ]]; then
            echo -e "   ${YELLOW}• Latest backup is over 24 hours old - consider running './backup.sh'${NC}"
        fi
    fi
fi

if [[ ! -f "$ENCRYPTION_KEY_FILE" ]]; then
    echo -e "   ${YELLOW}• Generate encryption key: 'openssl rand -base64 32 > $ENCRYPTION_KEY_FILE'${NC}"
fi

available_gb=$(df -BG "$BACKUP_DIR" | tail -1 | awk '{print $4}' | sed 's/G//' 2>/dev/null || echo 999)
if [[ $available_gb -lt 2 ]]; then
    echo -e "   ${RED}• Low disk space - consider cleaning old backups or expanding storage${NC}"
fi

echo ""
echo -e "${BLUE}🔧 Quick Commands:${NC}"
echo "   ./backup.sh                    # Create new backup"
echo "   ./restore.sh --list           # List available backups"
echo "   ./restore.sh --latest          # Restore from latest backup"
echo "   ./list-backups.sh              # Show detailed backup list"
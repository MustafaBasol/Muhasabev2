#!/bin/bash

# List Available Backups Script
# Shows formatted list of all available backup files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../" && pwd)"

# Source configuration
source "$SCRIPT_DIR/config/backup.conf" 2>/dev/null || {
    BACKUP_DIR="$PROJECT_ROOT/backend/backups"
}

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📋 MoneyFlow Database Backups${NC}"
echo ""

if [[ ! -d "$BACKUP_DIR" ]]; then
    echo "❌ Backup directory not found: $BACKUP_DIR"
    exit 1
fi

backup_files=($(find "$BACKUP_DIR" -name "moneyflow_backup_*.sql*" -type f | sort -r))

if [[ ${#backup_files[@]} -eq 0 ]]; then
    echo "❌ No backup files found in $BACKUP_DIR"
    exit 1
fi

echo "📁 Location: $BACKUP_DIR"
echo "📊 Total backups: ${#backup_files[@]}"
echo ""

printf "%-3s %-20s %-12s %-10s %-15s %s\n" "ID" "Date & Time" "Age" "Size" "Type" "Filename"
printf "%-3s %-20s %-12s %-10s %-15s %s\n" "---" "-------------------" "-----------" "---------" "--------------" "--------"

id=1
current_time=$(date +%s)

for file in "${backup_files[@]}"; do
    basename_file=$(basename "$file")
    size_bytes=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    size_human=$(numfmt --to=iec-i --suffix=B "$size_bytes" 2>/dev/null || echo "$((size_bytes / 1024 / 1024))MB")
    
    # Extract date/time from filename
    datetime="Unknown"
    age="Unknown"
    if [[ "$basename_file" =~ moneyflow_backup_([0-9]{8}_[0-9]{6}) ]]; then
        timestamp="${BASH_REMATCH[1]}"
        datetime=$(date -d "${timestamp:0:8} ${timestamp:9:2}:${timestamp:11:2}:${timestamp:13:2}" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "$timestamp")
        
        # Calculate age
        backup_time=$(date -d "${timestamp:0:8} ${timestamp:9:2}:${timestamp:11:2}:${timestamp:13:2}" +%s 2>/dev/null || echo 0)
        if [[ $backup_time -gt 0 ]]; then
            age_seconds=$((current_time - backup_time))
            age_days=$((age_seconds / 86400))
            age_hours=$(((age_seconds % 86400) / 3600))
            
            if [[ $age_days -gt 0 ]]; then
                age="${age_days}d ${age_hours}h"
            else
                age="${age_hours}h"
            fi
        fi
    fi
    
    # Determine type
    type="Standard"
    if [[ "$file" =~ \.enc$ ]]; then
        type="Encrypted"
    elif [[ "$file" =~ \.gz$ ]]; then
        type="Compressed"
    fi
    
    # Color coding for age
    color=""
    if [[ "$age" != "Unknown" ]]; then
        age_days_num=$(echo "$age" | grep -o '^[0-9]\+' || echo 0)
        if [[ $age_days_num -le 1 ]]; then
            color="$GREEN"
        elif [[ $age_days_num -le 7 ]]; then
            color="$YELLOW"
        fi
    fi
    
    printf "${color}%-3s %-20s %-12s %-10s %-15s %s${NC}\n" "$id" "$datetime" "$age" "$size_human" "$type" "$basename_file"
    
    id=$((id + 1))
done

echo ""
echo -e "${YELLOW}💡 Usage Examples:${NC}"
echo "   ./restore.sh --latest                    # Restore from latest backup"
echo "   ./restore.sh \"$BACKUP_DIR/$(basename "${backup_files[0]}")\"  # Restore specific backup"
echo "   ./restore.sh --list                     # Show this list"
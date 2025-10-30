#!/bin/bash

# Enhanced Database Restore Script
# Features: Encrypted backup support, multiple restore modes, verification, rollback
# Author: Database Team
# Version: 2.0

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../" && pwd)"

# Source configuration
source "$SCRIPT_DIR/config/backup.conf" 2>/dev/null || {
    echo "⚠️  Configuration file not found, using defaults"
}

# Default configuration  
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backend/backups}"
DATABASE_NAME="${DATABASE_NAME:-moneyflow_dev}"
DATABASE_USER="${DATABASE_USER:-moneyflow}"
DATABASE_HOST="${DATABASE_HOST:-localhost}"
DATABASE_PORT="${DATABASE_PORT:-5432}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-moneyflow-db}"
ENABLE_ENCRYPTION="${ENABLE_ENCRYPTION:-true}"
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-$SCRIPT_DIR/config/encryption.key}"
LOG_FILE="${LOG_FILE:-/tmp/restore.log}"
WEBHOOK_URL="${WEBHOOK_URL:-}"
EMAIL_NOTIFICATIONS="${EMAIL_NOTIFICATIONS:-}"

# Restore options
BACKUP_FILE=""
RESTORE_MODE="full"  # full, schema-only, data-only, tables
RESTORE_TABLES=""
FORCE_RESTORE=false
CREATE_BACKUP_BEFORE_RESTORE=true
VERIFY_AFTER_RESTORE=true
DRY_RUN=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    send_notification "❌ Restore Failed" "$1" "critical"
    exit 1
}

# Success notification
success_notification() {
    log "INFO" "$1"
    send_notification "✅ Restore Success" "$1" "info"
}

# Send notification (Slack/Email)
send_notification() {
    local title="$1"
    local message="$2"
    local severity="${3:-info}"
    
    # Slack notification
    if [[ -n "$WEBHOOK_URL" ]]; then
        local color
        case $severity in
            critical) color="#ff0000" ;;
            warning) color="#ffa500" ;;
            *) color="#00ff00" ;;
        esac
        
        curl -s -X POST "$WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            -d "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"$title\",
                    \"text\": \"$message\",
                    \"footer\": \"MoneyFlow Restore System\",
                    \"ts\": $(date +%s)
                }]
            }" || log "WARN" "Failed to send Slack notification"
    fi
    
    # Email notification
    if [[ -n "$EMAIL_NOTIFICATIONS" ]] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "$title" "$EMAIL_NOTIFICATIONS" || \
            log "WARN" "Failed to send email notification"
    fi
}

# Show usage
show_usage() {
    echo "Enhanced Database Restore Script"
    echo ""
    echo "Usage: $0 [OPTIONS] <backup-file|--latest>"
    echo ""
    echo "Backup Selection:"
    echo "  <backup-file>         Path to specific backup file"
    echo "  --latest              Use the most recent backup"
    echo "  --list                List available backups and exit"
    echo ""
    echo "Restore Modes:"
    echo "  --full               Restore complete database (default)"
    echo "  --schema-only        Restore database structure only"
    echo "  --data-only          Restore data only (no structure)"
    echo "  --tables TABLE1,TABLE2  Restore specific tables only"
    echo ""
    echo "Options:"
    echo "  --force              Skip confirmation prompts"
    echo "  --no-backup          Don't create backup before restore"
    echo "  --no-verify          Skip post-restore verification"
    echo "  --dry-run            Show what would be done without executing"
    echo "  --config FILE        Use custom configuration file"
    echo "  --verbose            Enable verbose output"
    echo "  --quiet              Suppress non-essential output"
    echo "  --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --latest                                    # Restore from latest backup"
    echo "  $0 backup_20241030_120000.sql.gz.enc         # Restore specific backup"
    echo "  $0 --latest --schema-only                     # Restore structure only"
    echo "  $0 --latest --tables users,transactions       # Restore specific tables"
    echo "  $0 --latest --force --no-backup              # Fast restore without safety backup"
    echo "  $0 --dry-run --latest                        # Preview restore operation"
}

# List available backups
list_backups() {
    echo -e "${BLUE}📋 Available Backups:${NC}"
    echo ""
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        echo "❌ Backup directory not found: $BACKUP_DIR"
        return 1
    fi
    
    local backup_files=($(find "$BACKUP_DIR" -name "moneyflow_backup_*.sql*" -type f | sort -r))
    
    if [[ ${#backup_files[@]} -eq 0 ]]; then
        echo "❌ No backup files found in $BACKUP_DIR"
        return 1
    fi
    
    echo "Total backups found: ${#backup_files[@]}"
    echo ""
    printf "%-5s %-25s %-15s %-10s %s\n" "ID" "Date/Time" "Size" "Type" "File"
    printf "%-5s %-25s %-15s %-10s %s\n" "----" "------------------------" "--------------" "---------" "----"
    
    local id=1
    for file in "${backup_files[@]}"; do
        local basename_file=$(basename "$file")
        local size_bytes=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
        local size_human=$(numfmt --to=iec-i --suffix=B "$size_bytes" 2>/dev/null || echo "$((size_bytes / 1024 / 1024))MB")
        
        # Extract date/time from filename
        local datetime=""
        if [[ "$basename_file" =~ moneyflow_backup_([0-9]{8}_[0-9]{6}) ]]; then
            local timestamp="${BASH_REMATCH[1]}"
            datetime=$(date -d "${timestamp:0:8} ${timestamp:9:2}:${timestamp:11:2}:${timestamp:13:2}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$timestamp")
        fi
        
        # Determine backup type
        local type="Unknown"
        if [[ "$file" =~ \.enc$ ]]; then
            type="Encrypted"
        elif [[ "$file" =~ \.gz$ ]]; then
            type="Compressed"
        else
            type="Standard"
        fi
        
        printf "%-5s %-25s %-15s %-10s %s\n" "$id" "$datetime" "$size_human" "$type" "$basename_file"
        id=$((id + 1))
    done
    
    echo ""
    echo -e "${YELLOW}💡 To restore:${NC}"
    echo "   $0 --latest                    # Latest backup"
    echo "   $0 \"$BACKUP_DIR/$(basename "${backup_files[0]}")\"  # Specific backup"
}

# Find latest backup
find_latest_backup() {
    local latest_backup=$(find "$BACKUP_DIR" -name "moneyflow_backup_*.sql*" -type f | sort -r | head -1)
    
    if [[ -z "$latest_backup" ]]; then
        error_exit "No backup files found in $BACKUP_DIR"
    fi
    
    echo "$latest_backup"
}

# Decrypt backup if encrypted
decrypt_backup() {
    local backup_file="$1"
    
    if [[ ! "$backup_file" =~ \.enc$ ]]; then
        echo "$backup_file"
        return
    fi
    
    log "INFO" "Decrypting backup file..."
    
    if [[ ! -f "$ENCRYPTION_KEY_FILE" ]]; then
        error_exit "Encryption key file not found: $ENCRYPTION_KEY_FILE"
    fi
    
    local decrypted_file="${backup_file%.enc}"
    
    if ! openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 \
        -in "$backup_file" \
        -out "$decrypted_file" \
        -pass file:"$ENCRYPTION_KEY_FILE"; then
        error_exit "Failed to decrypt backup file"
    fi
    
    log "INFO" "Backup decrypted successfully"
    echo "$decrypted_file"
}

# Decompress backup if compressed
decompress_backup() {
    local backup_file="$1"
    
    if [[ ! "$backup_file" =~ \.gz$ ]]; then
        echo "$backup_file"
        return
    fi
    
    log "INFO" "Decompressing backup file..."
    
    local decompressed_file="${backup_file%.gz}"
    
    if ! gzip -dc "$backup_file" > "$decompressed_file"; then
        error_exit "Failed to decompress backup file"
    fi
    
    log "INFO" "Backup decompressed successfully"
    echo "$decompressed_file"
}

# Check database connectivity
check_database_connection() {
    log "INFO" "Checking database connectivity..."
    
    if [[ "$DATABASE_HOST" == "localhost" ]]; then
        if ! docker ps | grep -q "$DOCKER_CONTAINER"; then
            error_exit "Docker container '$DOCKER_CONTAINER' is not running"
        fi
        
        if ! docker exec "$DOCKER_CONTAINER" pg_isready -U "$DATABASE_USER" >/dev/null 2>&1; then
            error_exit "Database is not ready"
        fi
    else
        if ! pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" >/dev/null 2>&1; then
            error_exit "Cannot connect to database at $DATABASE_HOST:$DATABASE_PORT"
        fi
    fi
    
    log "INFO" "Database connectivity verified"
}

# Create safety backup before restore
create_safety_backup() {
    if [[ "$CREATE_BACKUP_BEFORE_RESTORE" != "true" ]]; then
        return
    fi
    
    log "INFO" "Creating safety backup before restore..."
    
    local safety_backup_file="$BACKUP_DIR/safety_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if [[ "$DATABASE_HOST" == "localhost" ]]; then
        if ! docker exec "$DOCKER_CONTAINER" pg_dump \
            -U "$DATABASE_USER" \
            -d "$DATABASE_NAME" \
            --no-password > "$safety_backup_file"; then
            error_exit "Failed to create safety backup"
        fi
    else
        if ! pg_dump \
            -h "$DATABASE_HOST" \
            -p "$DATABASE_PORT" \
            -U "$DATABASE_USER" \
            -d "$DATABASE_NAME" \
            --no-password > "$safety_backup_file"; then
            error_exit "Failed to create safety backup"
        fi
    fi
    
    log "INFO" "Safety backup created: $safety_backup_file"
}

# Get database statistics
get_database_stats() {
    local stats_output=""
    
    if [[ "$DATABASE_HOST" == "localhost" ]]; then
        stats_output=$(docker exec "$DOCKER_CONTAINER" psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -t -c "
            SELECT 
                schemaname,
                tablename,
                n_tup_ins as inserts,
                n_tup_upd as updates,
                n_tup_del as deletes
            FROM pg_stat_user_tables 
            ORDER BY schemaname, tablename;
        " 2>/dev/null || echo "Failed to get stats")
    else
        stats_output=$(psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -t -c "
            SELECT 
                schemaname,
                tablename,
                n_tup_ins as inserts,
                n_tup_upd as updates,
                n_tup_del as deletes
            FROM pg_stat_user_tables 
            ORDER BY schemaname, tablename;
        " 2>/dev/null || echo "Failed to get stats")
    fi
    
    echo "$stats_output"
}

# Perform database restore
perform_restore() {
    local backup_file="$1"
    
    log "INFO" "Starting database restore..."
    log "INFO" "Backup file: $backup_file"
    log "INFO" "Restore mode: $RESTORE_MODE"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}🔍 DRY RUN MODE - No actual changes will be made${NC}"
        echo "Would restore from: $backup_file"
        echo "Restore mode: $RESTORE_MODE"
        echo "Target database: $DATABASE_NAME"
        return
    fi
    
    # Build pg_restore command
    local restore_cmd="pg_restore"
    local restore_args=()
    
    if [[ "$DATABASE_HOST" == "localhost" ]]; then
        restore_cmd="docker exec -i $DOCKER_CONTAINER pg_restore"
    else
        restore_args+=("-h" "$DATABASE_HOST" "-p" "$DATABASE_PORT")
    fi
    
    restore_args+=("-U" "$DATABASE_USER" "-d" "$DATABASE_NAME" "--verbose" "--no-password")
    
    # Add mode-specific options
    case "$RESTORE_MODE" in
        schema-only)
            restore_args+=("--schema-only")
            ;;
        data-only)
            restore_args+=("--data-only")
            ;;
        tables)
            if [[ -n "$RESTORE_TABLES" ]]; then
                IFS=',' read -ra TABLES <<< "$RESTORE_TABLES"
                for table in "${TABLES[@]}"; do
                    restore_args+=("-t" "$table")
                done
            fi
            ;;
        full)
            # No additional options needed
            ;;
    esac
    
    # Check if backup is in custom format (pg_dump -Fc)
    if file "$backup_file" | grep -q "PostgreSQL custom database dump"; then
        # Use pg_restore for custom format
        if [[ "$DATABASE_HOST" == "localhost" ]]; then
            if ! docker exec -i "$DOCKER_CONTAINER" pg_restore "${restore_args[@]}" < "$backup_file"; then
                error_exit "pg_restore failed"
            fi
        else
            if ! pg_restore "${restore_args[@]}" "$backup_file"; then
                error_exit "pg_restore failed"
            fi
        fi
    else
        # Use psql for plain SQL format
        if [[ "$DATABASE_HOST" == "localhost" ]]; then
            if ! docker exec -i "$DOCKER_CONTAINER" psql -U "$DATABASE_USER" -d "$DATABASE_NAME" < "$backup_file"; then
                error_exit "psql restore failed"
            fi
        else
            if ! psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" < "$backup_file"; then
                error_exit "psql restore failed"
            fi
        fi
    fi
    
    log "INFO" "Database restore completed successfully"
}

# Verify restore
verify_restore() {
    if [[ "$VERIFY_AFTER_RESTORE" != "true" ]]; then
        return
    fi
    
    log "INFO" "Verifying restore..."
    
    # Check database connectivity
    check_database_connection
    
    # Get table counts
    local table_stats
    table_stats=$(get_database_stats)
    
    if [[ "$table_stats" == "Failed to get stats" ]]; then
        log "WARN" "Could not verify table statistics"
    else
        echo -e "${GREEN}📊 Database Statistics After Restore:${NC}"
        echo "$table_stats" | column -t
    fi
    
    # Check for critical tables (if they exist)
    local critical_tables=("users" "transactions" "accounts" "companies")
    for table in "${critical_tables[@]}"; do
        local count
        if [[ "$DATABASE_HOST" == "localhost" ]]; then
            count=$(docker exec "$DOCKER_CONTAINER" psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "N/A")
        else
            count=$(psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "N/A")
        fi
        
        if [[ "$count" != "N/A" ]]; then
            echo "  $table: $count records"
        fi
    done
    
    log "INFO" "Restore verification completed"
}

# Clean up temporary files
cleanup_temp_files() {
    log "INFO" "Cleaning up temporary files..."
    
    # Remove any temporary decrypted/decompressed files
    find /tmp -name "restore_temp_*" -mtime +1 -delete 2>/dev/null || true
    
    log "INFO" "Cleanup completed"
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --latest)
                BACKUP_FILE="latest"
                ;;
            --list)
                list_backups
                exit 0
                ;;
            --full)
                RESTORE_MODE="full"
                ;;
            --schema-only)
                RESTORE_MODE="schema-only"
                ;;
            --data-only)
                RESTORE_MODE="data-only"
                ;;
            --tables)
                if [[ -n "${2:-}" ]]; then
                    RESTORE_MODE="tables"
                    RESTORE_TABLES="$2"
                    shift
                else
                    error_exit "Table list required for --tables option"
                fi
                ;;
            --force)
                FORCE_RESTORE=true
                ;;
            --no-backup)
                CREATE_BACKUP_BEFORE_RESTORE=false
                ;;
            --no-verify)
                VERIFY_AFTER_RESTORE=false
                ;;
            --dry-run)
                DRY_RUN=true
                ;;
            --config)
                if [[ -n "${2:-}" ]]; then
                    source "$2" || error_exit "Failed to load configuration file: $2"
                    shift
                else
                    error_exit "Configuration file path required"
                fi
                ;;
            --verbose)
                set -x
                ;;
            --quiet)
                exec > /dev/null
                ;;
            --help)
                show_usage
                exit 0
                ;;
            -*)
                error_exit "Unknown option: $1"
                ;;
            *)
                if [[ -z "$BACKUP_FILE" ]]; then
                    BACKUP_FILE="$1"
                else
                    error_exit "Multiple backup files specified"
                fi
                ;;
        esac
        shift
    done
    
    # Check if backup file was specified
    if [[ -z "$BACKUP_FILE" ]]; then
        echo -e "${RED}❌ Error: No backup file specified${NC}"
        echo ""
        show_usage
        exit 1
    fi
}

# Main restore process
main() {
    local start_time=$(date +%s)
    log "INFO" "=== MoneyFlow Database Restore Started ==="
    
    # Parse arguments
    parse_arguments "$@"
    
    # Find backup file
    if [[ "$BACKUP_FILE" == "latest" ]]; then
        BACKUP_FILE=$(find_latest_backup)
        log "INFO" "Using latest backup: $BACKUP_FILE"
    else
        # Handle relative paths
        if [[ ! -f "$BACKUP_FILE" ]] && [[ -f "$BACKUP_DIR/$BACKUP_FILE" ]]; then
            BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
        fi
        
        if [[ ! -f "$BACKUP_FILE" ]]; then
            error_exit "Backup file not found: $BACKUP_FILE"
        fi
    fi
    
    # Display restore information
    echo -e "${BLUE}🔄 Database Restore Information:${NC}"
    echo "   Backup file: $(basename "$BACKUP_FILE")"
    echo "   Database: $DATABASE_NAME"
    echo "   Restore mode: $RESTORE_MODE"
    echo "   Create safety backup: $([ "$CREATE_BACKUP_BEFORE_RESTORE" == "true" ] && echo "Yes" || echo "No")"
    echo "   Verify after restore: $([ "$VERIFY_AFTER_RESTORE" == "true" ] && echo "Yes" || echo "No")"
    
    if [[ "$RESTORE_MODE" == "tables" ]]; then
        echo "   Tables to restore: $RESTORE_TABLES"
    fi
    
    # Confirmation prompt
    if [[ "$FORCE_RESTORE" != "true" ]] && [[ "$DRY_RUN" != "true" ]]; then
        echo ""
        echo -e "${YELLOW}⚠️  WARNING: This will modify/replace your current database!${NC}"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Restore cancelled by user"
            exit 0
        fi
    fi
    
    # Check database connection
    check_database_connection
    
    # Get pre-restore statistics
    echo -e "${BLUE}📊 Database Statistics Before Restore:${NC}"
    get_database_stats | column -t
    
    # Create safety backup
    create_safety_backup
    
    # Prepare backup file (decrypt/decompress if needed)
    local temp_files=()
    local processed_backup="$BACKUP_FILE"
    
    # Decrypt if encrypted
    if [[ "$processed_backup" =~ \.enc$ ]]; then
        processed_backup=$(decrypt_backup "$processed_backup")
        temp_files+=("$processed_backup")
    fi
    
    # Decompress if compressed
    if [[ "$processed_backup" =~ \.gz$ ]]; then
        processed_backup=$(decompress_backup "$processed_backup")
        temp_files+=("$processed_backup")
    fi
    
    # Perform restore
    perform_restore "$processed_backup"
    
    # Verify restore
    verify_restore
    
    # Clean up temporary files
    for temp_file in "${temp_files[@]}"; do
        [[ -f "$temp_file" ]] && rm -f "$temp_file"
    done
    cleanup_temp_files
    
    # Calculate duration
    local end_time=$(date +%s) 
    local duration=$((end_time - start_time))
    
    # Success message
    echo -e "${GREEN}✅ Database restore completed successfully!${NC}"
    echo -e "${GREEN}📊 Restore Summary:${NC}"
    echo "   • Source: $(basename "$BACKUP_FILE")"
    echo "   • Mode: $RESTORE_MODE"
    echo "   • Duration: ${duration}s"
    echo "   • Database: $DATABASE_NAME"
    
    # Send success notification
    success_notification "Database restore completed successfully. Source: $(basename "$BACKUP_FILE"), Mode: $RESTORE_MODE, Duration: ${duration}s"
    
    log "INFO" "=== MoneyFlow Database Restore Completed Successfully ==="
    
    echo ""
    echo -e "${YELLOW}💡 Next steps:${NC}"
    echo "   • Verify application functionality"
    echo "   • Run application tests if available"
    echo "   • Check critical business processes"
}

# Run main function with all arguments
main "$@"
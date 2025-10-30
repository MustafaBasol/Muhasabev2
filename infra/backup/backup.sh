#!/bin/bash

# Enhanced Database Backup Script
# Features: Timestamped backups, encryption, compression, verification, monitoring
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
RETENTION_DAYS="${RETENTION_DAYS:-30}"
COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-6}"
ENABLE_ENCRYPTION="${ENABLE_ENCRYPTION:-true}"
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-$SCRIPT_DIR/config/encryption.key}"
LOG_FILE="${LOG_FILE:-/tmp/backup.log}"
WEBHOOK_URL="${WEBHOOK_URL:-}"
EMAIL_NOTIFICATIONS="${EMAIL_NOTIFICATIONS:-}"

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
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE" >&2
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    send_notification "❌ Backup Failed" "$1" "critical"
    exit 1
}

# Success notification
success_notification() {
    log "INFO" "$1"
    send_notification "✅ Backup Success" "$1" "info"
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
                    \"footer\": \"MoneyFlow Backup System\",
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

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check if backup directory exists
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "INFO" "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR" || error_exit "Failed to create backup directory"
    fi
    
    # Check Docker container
    if [[ "$DATABASE_HOST" == "localhost" ]]; then
        if ! docker ps | grep -q "$DOCKER_CONTAINER"; then
            error_exit "Docker container '$DOCKER_CONTAINER' is not running"
        fi
    fi
    
    # Check database connectivity
    if [[ "$DATABASE_HOST" == "localhost" ]]; then
        if ! docker exec "$DOCKER_CONTAINER" pg_isready -U "$DATABASE_USER" -d "$DATABASE_NAME" >/dev/null 2>&1; then
            error_exit "Database is not ready"
        fi
    else
        if ! pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" >/dev/null 2>&1; then
            error_exit "Cannot connect to database at $DATABASE_HOST:$DATABASE_PORT"
        fi
    fi
    
    # Check encryption key if encryption is enabled
    if [[ "$ENABLE_ENCRYPTION" == "true" ]]; then
        if [[ ! -f "$ENCRYPTION_KEY_FILE" ]]; then
            log "WARN" "Encryption key file not found, generating new key..."
            openssl rand -base64 32 > "$ENCRYPTION_KEY_FILE"
            chmod 600 "$ENCRYPTION_KEY_FILE"
            log "INFO" "Generated new encryption key: $ENCRYPTION_KEY_FILE"
        fi
    fi
    
    # Check available disk space
    local available_space=$(df "$BACKUP_DIR" | tail -1 | awk '{print $4}')
    local required_space=1048576  # 1GB in KB
    if [[ $available_space -lt $required_space ]]; then
        error_exit "Insufficient disk space. Available: ${available_space}KB, Required: ${required_space}KB"
    fi
    
    log "INFO" "Prerequisites check completed successfully"
}

# Create database backup
create_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_filename="moneyflow_backup_${timestamp}.sql"
    local backup_file="$BACKUP_DIR/$backup_filename"
    
    log "INFO" "Starting database backup..."
    log "INFO" "Database: $DATABASE_NAME"
    log "INFO" "Output file: $backup_file"
    
    # Create backup using pg_dump
    if [[ "$DATABASE_HOST" == "localhost" ]]; then
        # Using Docker container
        if ! docker exec "$DOCKER_CONTAINER" pg_dump \
            -U "$DATABASE_USER" \
            -d "$DATABASE_NAME" \
            --no-password > "$backup_file" 2>>"$LOG_FILE"; then
            error_exit "pg_dump failed"
        fi
    else
        # Direct connection
        if ! pg_dump \
            -h "$DATABASE_HOST" \
            -p "$DATABASE_PORT" \
            -U "$DATABASE_USER" \
            -d "$DATABASE_NAME" \
            --no-password > "$backup_file" 2>>"$LOG_FILE"; then
            error_exit "pg_dump failed"
        fi
    fi
    
    # Check if backup file was created and has content
    if [[ ! -f "$backup_file" ]] || [[ ! -s "$backup_file" ]]; then
        error_exit "Backup file was not created or is empty"
    fi
    
    log "INFO" "Database backup completed successfully"
    echo "$backup_file"
}

# Compress backup
compress_backup() {
    local backup_file="$1"
    local compressed_file="${backup_file}.gz"
    
    log "INFO" "Compressing backup file..."
    
    if ! gzip -"$COMPRESSION_LEVEL" -c "$backup_file" > "$compressed_file"; then
        error_exit "Failed to compress backup file"
    fi
    
    # Remove original uncompressed file
    rm "$backup_file"
    
    log "INFO" "Backup compressed successfully"
    echo "$compressed_file"
}

# Encrypt backup
encrypt_backup() {
    local backup_file="$1"
    local encrypted_file="${backup_file}.enc"
    
    if [[ "$ENABLE_ENCRYPTION" != "true" ]]; then
        echo "$backup_file"
        return
    fi
    
    log "INFO" "Encrypting backup file..."
    
    if ! openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
        -in "$backup_file" \
        -out "$encrypted_file" \
        -pass file:"$ENCRYPTION_KEY_FILE"; then
        error_exit "Failed to encrypt backup file"
    fi
    
    # Remove original unencrypted file
    rm "$backup_file"
    
    log "INFO" "Backup encrypted successfully"
    echo "$encrypted_file"
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    log "INFO" "Verifying backup integrity..."
    
    # Check if file exists and is readable
    if [[ ! -f "$backup_file" ]] || [[ ! -r "$backup_file" ]]; then
        error_exit "Backup file is not accessible: $backup_file"
    fi
    
    # For encrypted files, try to decrypt and verify
    if [[ "$backup_file" =~ \.enc$ ]] && [[ "$ENABLE_ENCRYPTION" == "true" ]]; then
        local temp_file=$(mktemp)
        if ! openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 \
            -in "$backup_file" \
            -out "$temp_file" \
            -pass file:"$ENCRYPTION_KEY_FILE" 2>/dev/null; then
            rm -f "$temp_file"
            error_exit "Failed to decrypt backup file for verification"
        fi
        backup_file="$temp_file"
    fi
    
    # For compressed files, test compression integrity
    if [[ "$backup_file" =~ \.gz$ ]]; then
        if ! gzip -t "$backup_file" 2>/dev/null; then
            [[ -f "$temp_file" ]] && rm -f "$temp_file"
            error_exit "Backup file compression is corrupted"
        fi
    fi
    
    # Clean up temporary file if created
    [[ -f "$temp_file" ]] && rm -f "$temp_file"
    
    log "INFO" "Backup integrity verification passed"
}

# Calculate file statistics
calculate_stats() {
    local backup_file="$1"
    
    # Get file size
    local size_bytes=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    local size_mb=$((size_bytes / 1024 / 1024))
    local size_human=$(numfmt --to=iec-i --suffix=B "$size_bytes" 2>/dev/null || echo "${size_mb}MB")
    
    # Calculate checksum
    local checksum
    if command -v sha256sum >/dev/null 2>&1; then
        checksum=$(sha256sum "$backup_file" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
        checksum=$(shasum -a 256 "$backup_file" | awk '{print $1}')
    else
        checksum="N/A"
    fi
    
    echo "Size: $size_human ($size_bytes bytes)"
    echo "SHA256: $checksum"
    
    # Log statistics
    log "INFO" "Backup statistics - Size: $size_human, SHA256: $checksum"
}

# Clean up old backups
cleanup_old_backups() {
    log "INFO" "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local deleted_count=0
    while IFS= read -r -d '' file; do
        rm "$file"
        deleted_count=$((deleted_count + 1))
        log "INFO" "Deleted old backup: $(basename "$file")"
    done < <(find "$BACKUP_DIR" -name "moneyflow_backup_*.sql*" -mtime +$RETENTION_DAYS -print0 2>/dev/null)
    
    if [[ $deleted_count -gt 0 ]]; then
        log "INFO" "Cleaned up $deleted_count old backup files"
    else
        log "INFO" "No old backup files to clean up"
    fi
}

# Update backup catalog
update_catalog() {
    local backup_file="$1"
    local catalog_file="$BACKUP_DIR/backup_catalog.log"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local filename=$(basename "$backup_file")
    local size_bytes=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    
    echo "$timestamp|$filename|$size_bytes|SUCCESS" >> "$catalog_file"
    log "INFO" "Updated backup catalog"
}

# Show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --now                 Take backup immediately (default)"
    echo "  --config FILE         Use custom configuration file"
    echo "  --dir DIR            Override backup directory"
    echo "  --no-encryption      Disable encryption"
    echo "  --no-compression     Disable compression"
    echo "  --retention DAYS     Override retention period"
    echo "  --verbose            Enable verbose output"
    echo "  --quiet              Suppress non-essential output"
    echo "  --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                   # Take backup with default settings"
    echo "  $0 --no-encryption   # Take unencrypted backup"
    echo "  $0 --retention 60    # Keep backups for 60 days"
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --now)
                # Default behavior, just continue
                ;;
            --config)
                if [[ -n "${2:-}" ]]; then
                    source "$2" || error_exit "Failed to load configuration file: $2"
                    shift
                else
                    error_exit "Configuration file path required"
                fi
                ;;
            --dir)
                if [[ -n "${2:-}" ]]; then
                    BACKUP_DIR="$2"
                    shift
                else
                    error_exit "Backup directory path required"
                fi
                ;;
            --no-encryption)
                ENABLE_ENCRYPTION="false"
                ;;
            --no-compression)
                COMPRESSION_LEVEL="0"
                ;;
            --retention)
                if [[ -n "${2:-}" ]] && [[ "$2" =~ ^[0-9]+$ ]]; then
                    RETENTION_DAYS="$2"
                    shift
                else
                    error_exit "Valid retention days required"
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
            *)
                error_exit "Unknown option: $1"
                ;;
        esac
        shift
    done
}

# Main backup process
main() {
    local start_time=$(date +%s)
    log "INFO" "=== MoneyFlow Database Backup Started ==="
    
    # Parse arguments
    parse_arguments "$@"
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup
    local backup_file
    backup_file=$(create_backup)
    
    # Compress backup if compression is enabled
    if [[ "$COMPRESSION_LEVEL" -gt 0 ]]; then
        backup_file=$(compress_backup "$backup_file")
    fi
    
    # Encrypt backup
    backup_file=$(encrypt_backup "$backup_file")
    
    # Verify backup integrity
    verify_backup "$backup_file"
    
    # Calculate and display statistics
    echo -e "${GREEN}✅ Backup completed successfully!${NC}"
    echo -e "${BLUE}📄 File: $backup_file${NC}"
    calculate_stats "$backup_file"
    
    # Update catalog
    update_catalog "$backup_file"
    
    # Clean up old backups
    cleanup_old_backups
    
    # Show backup summary
    local backup_count=$(ls -1 "$BACKUP_DIR"/moneyflow_backup_*.sql* 2>/dev/null | wc -l)
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo -e "${GREEN}📊 Backup Summary:${NC}"
    echo "   • Total backups: $backup_count"
    echo "   • Backup time: ${duration}s"
    echo "   • Retention: $RETENTION_DAYS days"
    echo "   • Encryption: $([ "$ENABLE_ENCRYPTION" == "true" ] && echo "Enabled" || echo "Disabled")"
    
    # Send success notification
    success_notification "Database backup completed successfully. File: $(basename "$backup_file"), Size: $(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null | numfmt --to=iec-i --suffix=B), Duration: ${duration}s"
    
    log "INFO" "=== MoneyFlow Database Backup Completed Successfully ==="
    
    echo ""
    echo -e "${YELLOW}💡 To restore this backup:${NC}"
    echo "   ./restore.sh \"$backup_file\""
}

# Run main function with all arguments
main "$@"
#!/usr/bin/env bash
set -euo pipefail

# Usage: ./ops/backup-db.sh [--dry-run] [--no-compress]
# Requires: pg_dump installed and PG* env vars or .env file.
# Output: backups/YYYYMMDD/pgdump-HHMMSS.sql[.gz]
# Safe: Does not modify database.

DRY_RUN=0
COMPRESS=1
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-compress) COMPRESS=0 ;;
  esac
done

# Load .env if present (non-exported vars won't override existing exports)
if [ -f .env ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env | cut -d= -f1)
fi

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGDATABASE:=${DB_NAME:-app}}"
: "${PGUSER:=${DB_USER:-postgres}}"
: "${PGPASSWORD:=${DB_PASSWORD:-}}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[ERROR] pg_dump bulunamadı. Lütfen PostgreSQL client araçlarını kurun." >&2
  exit 1
fi

STAMP_DATE="$(date +%Y%m%d)"
STAMP_TIME="$(date +%H%M%S)"
TARGET_DIR="backups/${STAMP_DATE}"
mkdir -p "$TARGET_DIR"
BASENAME="pgdump-${STAMP_TIME}.sql"
OUTFILE="${TARGET_DIR}/${BASENAME}"

CMD=(pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -F p --no-owner --no-privileges)

if [ "$DRY_RUN" -eq 1 ]; then
  echo "[DRY-RUN] Çalıştırılacak komut: ${CMD[*]} > $OUTFILE" 
  exit 0
fi

# Export password for pg_dump non-interactive
export PGPASSWORD

echo "[INFO] Veritabanı yedeği alınıyor: $PGDATABASE@$PGHOST:$PGPORT"
"${CMD[@]}" > "$OUTFILE"

if [ "$COMPRESS" -eq 1 ]; then
  gzip -9 "$OUTFILE"
  OUTFILE="${OUTFILE}.gz"
fi

# Basic integrity check: ensure file not empty
if [ ! -s "$OUTFILE" ]; then
  echo "[ERROR] Yedek dosyası boş: $OUTFILE" >&2
  exit 2
fi

SHA256="$(sha256sum "$OUTFILE" | awk '{print $1}')"
SIZE="$(stat -c %s "$OUTFILE")"

cat <<EOF
[OK] Yedek oluşturuldu.
Dosya: $OUTFILE
Boyut: $SIZE byte
SHA256: $SHA256
EOF

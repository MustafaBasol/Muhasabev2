#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

load_env_file() {
  local file_path="${1}"
  if [ -f "${file_path}" ]; then
    set -a
    # shellcheck disable=SC1090
    source "${file_path}"
    set +a
  fi
}

load_env_file "${PROJECT_ROOT}/.env.test"
load_env_file "${PROJECT_ROOT}/.env"

export NODE_ENV=test
export TEST_DB=${TEST_DB:-postgres}
export TEST_DATABASE_TYPE=${TEST_DATABASE_TYPE:-postgres}
export TEST_DATABASE_NAME=${TEST_DATABASE_NAME:-app_test}
export TEST_DATABASE_HOST=${TEST_DATABASE_HOST:-${DATABASE_HOST:-127.0.0.1}}
export TEST_DATABASE_PORT=${TEST_DATABASE_PORT:-${DATABASE_PORT:-5432}}
export TEST_DATABASE_USER=${TEST_DATABASE_USER:-${DATABASE_USER:-moneyflow}}
export TEST_DATABASE_PASSWORD=${TEST_DATABASE_PASSWORD:-${DATABASE_PASSWORD:-moneyflow123}}
export TEST_DATABASE_SSL=${TEST_DATABASE_SSL:-${DATABASE_SSL:-false}}

# Force safe email provider in tests to avoid hitting AWS SES
export MAIL_PROVIDER=log
export AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-test}
export AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-test}

# Ensure legacy env vars remain populated for TypeORM consumers that don't read TEST_* values
default_db_host=${DATABASE_HOST:-${TEST_DATABASE_HOST}}
default_db_port=${DATABASE_PORT:-${TEST_DATABASE_PORT}}
default_db_user=${DATABASE_USER:-${TEST_DATABASE_USER}}
default_db_pass=${DATABASE_PASSWORD:-${TEST_DATABASE_PASSWORD}}
default_db_name=${DATABASE_NAME:-${TEST_DATABASE_NAME}}

export DATABASE_HOST="${default_db_host}"
export DATABASE_PORT="${default_db_port}"
export DATABASE_USER="${default_db_user}"
export DATABASE_PASSWORD="${default_db_pass}"
export DATABASE_NAME="${default_db_name}"

cd "${PROJECT_ROOT}"

echo "📦 Preparing Postgres test database (${TEST_DATABASE_NAME})..."
npx ts-node -r tsconfig-paths/register ./scripts/prepare-e2e.ts

echo "🧪 Running backend e2e suite..."
npx jest --config ./test/jest-e2e.json --runInBand --detectOpenHandles "$@"

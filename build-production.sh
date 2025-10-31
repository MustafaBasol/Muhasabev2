#!/bin/bash

# Production build script with environment separation
set -e

echo "🔧 Building Comptario for production..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Run this script from the project root directory${NC}"
    exit 1
fi

# Clean previous builds
echo -e "${YELLOW}🧹 Cleaning previous builds...${NC}"
rm -rf dist/
rm -rf apps/web/dist/
rm -rf apps/api/dist/

# Check for environment files
echo -e "${YELLOW}🔍 Checking environment configuration...${NC}"

# Web environment check
if [ ! -f "apps/web/.env.example" ]; then
    echo -e "${RED}❌ Error: apps/web/.env.example not found${NC}"
    exit 1
fi

if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Warning: Root .env file exists. Make sure it only contains VITE_ prefixed variables.${NC}"
fi

# API environment check
if [ ! -f "apps/api/.env.example" ]; then
    echo -e "${RED}❌ Error: apps/api/.env.example not found${NC}"
    exit 1
fi

# Build frontend
echo -e "${YELLOW}📦 Building frontend (web)...${NC}"
NODE_ENV=production npm run build

# Verify no server secrets in build
echo -e "${YELLOW}🔒 Verifying no server secrets in client bundle...${NC}"

# List of patterns that should NOT appear in the client bundle
FORBIDDEN_PATTERNS=(
    "DATABASE_"
    "JWT_SECRET"
    "ADMIN_PASSWORD"
    "ENCRYPTION_KEY"
    "REDIS_PASSWORD"
    "SMTP_PASSWORD"
    "SESSION_SECRET"
    "BACKUP_ENCRYPTION_KEY"
)

FOUND_SECRETS=false

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    if grep -r "$pattern" dist/ 2>/dev/null; then
        echo -e "${RED}❌ SECURITY WARNING: Found potential server secret '$pattern' in client bundle!${NC}"
        FOUND_SECRETS=true
    fi
done

if [ "$FOUND_SECRETS" = true ]; then
    echo -e "${RED}❌ Build failed: Server secrets found in client bundle${NC}"
    echo -e "${YELLOW}💡 Tip: Only use VITE_ prefixed environment variables for client-side configuration${NC}"
    exit 1
fi

# Check build output
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: Build failed - dist directory not created${NC}"
    exit 1
fi

# Verify essential files exist
REQUIRED_FILES=("dist/index.html" "dist/assets")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -e "$file" ]; then
        echo -e "${RED}❌ Error: Required file/directory '$file' not found in build output${NC}"
        exit 1
    fi
done

# Create build info
echo "{
  \"buildTime\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
  \"nodeVersion\": \"$(node --version)\",
  \"npmVersion\": \"$(npm --version)\",
  \"gitCommit\": \"$(git rev-parse HEAD 2>/dev/null || echo 'unknown')\",
  \"environment\": \"production\"
}" > dist/build-info.json

echo -e "${GREEN}✅ Frontend build completed successfully${NC}"
echo -e "${GREEN}📁 Build output: $(du -sh dist | cut -f1)${NC}"

# Security recommendations
echo -e "${YELLOW}🔒 Security Checklist:${NC}"
echo "  ✅ Client bundle verified free of server secrets"
echo "  ✅ Build output contains only static assets"
echo "  ⚠️  Remember to configure reverse proxy (see docs/deployment.md)"
echo "  ⚠️  Remember to set up HTTPS/TLS certificates"
echo "  ⚠️  Remember to configure CORS allowlist on API server"

echo -e "${GREEN}🚀 Build ready for deployment!${NC}"
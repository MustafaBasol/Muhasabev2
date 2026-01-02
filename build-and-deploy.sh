#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🏗️  Building frontend..."
cd "$ROOT_DIR"
export VITE_API_URL="${VITE_API_URL:-/api}"
npm run build

echo "📦 Copying build to backend static directory..."
# Backend serves static files from backend/public/dist (see backend/src/app.module.ts)
BACKEND_PUBLIC_DIST="$ROOT_DIR/backend/public/dist"

rm -rf "$BACKEND_PUBLIC_DIST/assets"
mkdir -p "$BACKEND_PUBLIC_DIST/assets"

cp -r "$ROOT_DIR/dist/assets/"* "$BACKEND_PUBLIC_DIST/assets/"
cp "$ROOT_DIR/dist/index.html" "$BACKEND_PUBLIC_DIST/index.html"

# Optional: copy data/ if present (e.g., static JSON used by landing)
if [ -d "$ROOT_DIR/dist/data" ]; then
	rm -rf "$BACKEND_PUBLIC_DIST/data"
	mkdir -p "$BACKEND_PUBLIC_DIST/data"
	cp -r "$ROOT_DIR/dist/data/"* "$BACKEND_PUBLIC_DIST/data/"
fi

# Legacy compatibility: some deployments may still reference backend/public/index.html + backend/public/assets
rm -rf "$ROOT_DIR/backend/public/assets"
mkdir -p "$ROOT_DIR/backend/public/assets"
cp -r "$ROOT_DIR/dist/assets/"* "$ROOT_DIR/backend/public/assets/"
cp "$ROOT_DIR/dist/index.html" "$ROOT_DIR/backend/public/index.html"

echo "✅ Build complete! Frontend assets copied into backend/public."

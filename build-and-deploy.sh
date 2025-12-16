#!/bin/bash

echo "🏗️  Building frontend..."
cd /workspaces/Muhasabev2
npm run build

echo "📦 Copying build to backend static directory..."
# Backend serves static files from backend/public/dist (see backend/src/app.module.ts)
BACKEND_PUBLIC_DIST=/workspaces/Muhasabev2/backend/public/dist

rm -rf "$BACKEND_PUBLIC_DIST/assets"
mkdir -p "$BACKEND_PUBLIC_DIST/assets"

cp -r /workspaces/Muhasabev2/dist/assets/* "$BACKEND_PUBLIC_DIST/assets/"
cp /workspaces/Muhasabev2/dist/index.html "$BACKEND_PUBLIC_DIST/index.html"

# Optional: copy data/ if present (e.g., static JSON used by landing)
if [ -d /workspaces/Muhasabev2/dist/data ]; then
	rm -rf "$BACKEND_PUBLIC_DIST/data"
	mkdir -p "$BACKEND_PUBLIC_DIST/data"
	cp -r /workspaces/Muhasabev2/dist/data/* "$BACKEND_PUBLIC_DIST/data/"
fi

# Legacy compatibility: some deployments may still reference backend/public/index.html + backend/public/assets
rm -rf /workspaces/Muhasabev2/backend/public/assets
mkdir -p /workspaces/Muhasabev2/backend/public/assets
cp -r /workspaces/Muhasabev2/dist/assets/* /workspaces/Muhasabev2/backend/public/assets/
cp /workspaces/Muhasabev2/dist/index.html /workspaces/Muhasabev2/backend/public/index.html

echo "✅ Build complete! Frontend is now served by backend at http://localhost:3001"
echo "📚 API documentation available at: http://localhost:3002/api"

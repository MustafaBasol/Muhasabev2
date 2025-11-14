#!/bin/bash

echo "🏗️  Building frontend..."
cd /workspaces/Muhasabev2
npm run build

echo "📦 Copying build to backend..."
# Copy hashed assets to backend/public/assets and update index.html
rm -rf /workspaces/Muhasabev2/backend/public/assets
mkdir -p /workspaces/Muhasabev2/backend/public/assets
cp -r /workspaces/Muhasabev2/dist/assets/* /workspaces/Muhasabev2/backend/public/assets/
cp /workspaces/Muhasabev2/dist/index.html /workspaces/Muhasabev2/backend/public/index.html

echo "✅ Build complete! Frontend is now served by backend at http://localhost:3001"
echo "📚 API documentation available at: http://localhost:3002/api"

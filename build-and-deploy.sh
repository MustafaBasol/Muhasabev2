#!/bin/bash

echo "🏗️  Building frontend..."
cd /workspaces/Muhasabev2
npm run build

echo "📦 Copying build to backend..."
rm -rf /workspaces/Muhasabev2/backend/public/dist
cp -r /workspaces/Muhasabev2/dist /workspaces/Muhasabev2/backend/public/

echo "✅ Build complete! Frontend is now served by backend at http://localhost:3002"
echo "📚 API documentation available at: http://localhost:3002/api"

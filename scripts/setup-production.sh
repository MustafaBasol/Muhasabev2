#!/bin/bash

# Production environment setup script
set -e

echo "🚀 Setting up Comptario production environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}❌ Do not run this script as root for security reasons${NC}"
    exit 1
fi

# Create necessary directories
echo -e "${BLUE}📁 Creating directory structure...${NC}"
mkdir -p logs
mkdir -p backend/logs
mkdir -p scripts

# Set up environment files with secure permissions
echo -e "${BLUE}🔧 Setting up environment files...${NC}"

# Frontend environment
if [ ! -f "apps/web/.env" ]; then
    cp apps/web/.env.example apps/web/.env
    echo -e "${YELLOW}⚠️  Please edit apps/web/.env with your production values${NC}"
fi

# Backend environment
if [ ! -f "apps/api/.env" ]; then
    cp apps/api/.env.example apps/api/.env
    chmod 600 apps/api/.env
    echo -e "${YELLOW}⚠️  Please edit apps/api/.env with your production values${NC}"
fi

# Legacy backend environment (for current structure)
if [ ! -f "backend/.env" ] && [ -f "backend/.env.example" ]; then
    cp backend/.env.example backend/.env
    chmod 600 backend/.env
    echo -e "${YELLOW}⚠️  Please edit backend/.env with your production values${NC}"
fi

# Secure file permissions
echo -e "${BLUE}🔒 Setting secure file permissions...${NC}"
find . -name "*.env" -type f -exec chmod 600 {} \;
find . -name "*.key" -type f -exec chmod 600 {} \; 2>/dev/null || true
find . -name "*.pem" -type f -exec chmod 600 {} \; 2>/dev/null || true

# Create log directories with proper permissions
mkdir -p logs backend/logs
chmod 755 logs backend/logs

# Generate strong secrets if needed
echo -e "${BLUE}🔑 Generating secure secrets...${NC}"

generate_secret() {
    openssl rand -base64 32 | tr -d '\n'
}

generate_jwt_secret() {
    openssl rand -base64 64 | tr -d '\n'
}

# Check if we need to generate secrets
if [ -f "backend/.env" ]; then
    if grep -q "your_super_secret_jwt_key" backend/.env; then
        echo -e "${YELLOW}⚠️  Generating new JWT secret...${NC}"
        new_jwt_secret=$(generate_jwt_secret)
        sed -i.bak "s/your_super_secret_jwt_key.*/$new_jwt_secret/" backend/.env
    fi
    
    if grep -q "your_refresh_token_secret" backend/.env; then
        echo -e "${YELLOW}⚠️  Generating new JWT refresh secret...${NC}"
        new_refresh_secret=$(generate_jwt_secret)
        sed -i.bak "s/your_refresh_token_secret.*/$new_refresh_secret/" backend/.env
    fi
fi

# Install production dependencies
echo -e "${BLUE}📦 Installing production dependencies...${NC}"

# Frontend
npm ci --only=production

# Backend
if [ -d "backend" ]; then
    cd backend
    npm ci --only=production
    cd ..
fi

# Build application
echo -e "${BLUE}🔨 Building application...${NC}"
if [ -f "./build-production.sh" ]; then
    ./build-production.sh
else
    npm run build
fi

# Security verification
echo -e "${BLUE}🔒 Running security verification...${NC}"
if [ -f "./scripts/security-verify.sh" ]; then
    ./scripts/security-verify.sh
else
    echo -e "${YELLOW}⚠️  Security verification script not found${NC}"
fi

# Setup systemd service (optional)
setup_systemd() {
    echo -e "${BLUE}⚙️  Setting up systemd service...${NC}"
    
    cat > comptario-api.service << EOF
[Unit]
Description=Comptario API Server
After=network.target postgresql.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$(pwd)
ExecStart=$(which node) backend/dist/main.js
EnvironmentFile=$(pwd)/backend/.env
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$(pwd)/logs
ProtectHome=true

# Resource limits
LimitNOFILE=65536
MemoryMax=512M

[Install]
WantedBy=multi-user.target
EOF

    echo -e "${GREEN}✅ Systemd service file created: comptario-api.service${NC}"
    echo -e "${YELLOW}   To install: sudo cp comptario-api.service /etc/systemd/system/${NC}"
    echo -e "${YELLOW}   To enable: sudo systemctl enable comptario-api${NC}"
    echo -e "${YELLOW}   To start: sudo systemctl start comptario-api${NC}"
}

# Create PM2 ecosystem file
echo -e "${BLUE}⚙️  Creating PM2 ecosystem configuration...${NC}"
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'comptario-api',
      script: './backend/dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_file: './backend/.env',
      
      // Resource limits
      max_memory_restart: '512M',
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto-restart
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
    }
  ]
};
EOF

echo -e "${GREEN}✅ PM2 ecosystem configuration created${NC}"

# Create health check script
echo -e "${BLUE}🏥 Creating health check script...${NC}"
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

# Health check script for monitoring
HEALTH_URL="http://localhost:3000/health"
MAX_RESPONSE_TIME=5

response=$(curl -s -w "%{http_code}:%{time_total}" "$HEALTH_URL" --max-time 5 2>/dev/null)

if [ $? -eq 0 ]; then
    http_code=$(echo "$response" | cut -d':' -f1)
    response_time=$(echo "$response" | cut -d':' -f2)
    
    if [ "$http_code" -eq 200 ]; then
        echo "OK - API healthy (${response_time}s)"
        exit 0
    else
        echo "CRITICAL - API returned HTTP $http_code"
        exit 2
    fi
else
    echo "CRITICAL - API unreachable"
    exit 2
fi
EOF

chmod +x scripts/health-check.sh

# Final summary
echo -e "\n${GREEN}🎉 Production environment setup completed!${NC}"
echo -e "\n${YELLOW}📋 Next Steps:${NC}"
echo "1. Edit environment files with your production values:"
echo "   - apps/web/.env (frontend configuration)"
echo "   - apps/api/.env or backend/.env (server secrets)"
echo ""
echo "2. Set up reverse proxy (Nginx/Caddy):"
echo "   - See docs/deployment.md for configuration examples"
echo ""
echo "3. Obtain SSL certificates:"
echo "   - Use Let's Encrypt: sudo certbot --nginx -d yourdomain.com"
echo ""
echo "4. Start the application:"
echo "   - PM2: pm2 start ecosystem.config.js"
echo "   - Systemd: sudo systemctl start comptario-api"
echo ""
echo "5. Verify deployment:"
echo "   - ./scripts/health-check.sh"
echo "   - curl https://yourdomain.com/api/health"

echo -e "\n${BLUE}📚 Documentation: docs/deployment.md${NC}"
echo -e "${BLUE}🔒 Security: Run ./scripts/security-verify.sh regularly${NC}"
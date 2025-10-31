# Deployment Guide

This guide covers secure production deployment of Comptario with proper environment separation, reverse proxy configuration, and security hardening.

## Table of Contents

- [Environment Separation](#environment-separation)
- [Build Process](#build-process)
- [Reverse Proxy Configuration](#reverse-proxy-configuration)
- [CORS Configuration](#cors-configuration)
- [TLS/HTTPS Setup](#tlshttps-setup)
- [Process Management](#process-management)
- [Health Checks](#health-checks)
- [Security Checklist](#security-checklist)
- [Monitoring](#monitoring)

## Environment Separation

### Frontend Environment Variables (`apps/web/.env`)

The frontend only receives variables prefixed with `VITE_`. These are publicly visible in the client bundle.

```bash
# Copy from apps/web/.env.example
cp apps/web/.env.example apps/web/.env

# Edit with your production values
VITE_API_URL=https://api.yourdomain.com
VITE_APP_NAME=Comptario
VITE_APP_VERSION=2.0.0
```

### Backend Environment Variables (`apps/api/.env`)

Server secrets that are never exposed to the client:

```bash
# Copy from apps/api/.env.example  
cp apps/api/.env.example apps/api/.env

# Edit with your production values - USE STRONG, UNIQUE VALUES
DATABASE_PASSWORD=your_secure_database_password
JWT_SECRET=your_256_bit_jwt_secret_key
ENCRYPTION_KEY=your_32_char_encryption_key
```

⚠️ **Critical**: Never use `VITE_` prefix for server secrets!

## Build Process

### Automated Production Build

Use the provided build script that includes security verification:

```bash
./build-production.sh
```

This script:
- ✅ Cleans previous builds
- ✅ Verifies environment configuration
- ✅ Builds frontend with production optimization
- ✅ **Scans for server secrets in client bundle**
- ✅ Creates build manifest

### Manual Build

```bash
# Frontend
NODE_ENV=production npm run build

# Backend (if building API)
cd backend
npm run build
```

## Reverse Proxy Configuration

### Nginx Configuration

Create `/etc/nginx/sites-available/comptario`:

```nginx
# Main server block - HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.yourdomain.com";

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

    # Frontend - Serve static files
    location / {
        root /var/www/comptario/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # Security: Never serve source files
        location ~ \.(env|config|key|pem|log)$ {
            deny all;
            return 404;
        }
    }

    # API Proxy
    location /api/ {
        # Rate limiting for API
        limit_req zone=api burst=20 nodelay;
        
        # Proxy to backend
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Login endpoint - Extra rate limiting
    location /api/auth/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://127.0.0.1:3000/auth/login;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Block access to sensitive paths
    location ~ /\.(git|env|DS_Store) {
        deny all;
        return 404;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/comptario /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Caddy Configuration (Alternative)

Create `Caddyfile`:

```caddy
yourdomain.com {
    # Automatic HTTPS
    tls your-email@yourdomain.com
    
    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.yourdomain.com"
    }
    
    # Rate limiting
    rate_limit {
        zone dynamic {
            key    {remote_addr}
            events 100
            window 1m
        }
    }
    
    # API proxy
    handle_path /api/* {
        reverse_proxy 127.0.0.1:3000
    }
    
    # Frontend static files
    handle {
        root * /var/www/comptario/dist
        try_files {path} /index.html
        file_server
    }
}
```

## CORS Configuration

### Backend CORS Settings

In your NestJS application, configure CORS properly:

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS Configuration
  app.enableCors({
    origin: [
      'https://yourdomain.com',
      'https://www.yourdomain.com',
      // Add your frontend domains here
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With', 
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Real-IP',
      'X-Forwarded-For'
    ],
  });

  await app.listen(3000, '127.0.0.1'); // Only bind to localhost
}
bootstrap();
```

### Production CORS Allowlist

```bash
# In apps/api/.env
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
CORS_CREDENTIALS=true
```

## TLS/HTTPS Setup

### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (check crontab)
sudo crontab -l | grep certbot
```

### SSL Configuration Checklist

- ✅ TLS 1.2+ only
- ✅ Strong cipher suites
- ✅ HSTS header
- ✅ Certificate auto-renewal
- ✅ Redirect HTTP to HTTPS

## Process Management

### PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'comptario-api',
      script: './backend/dist/main.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_file: './apps/api/.env',
      
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
      
      // Health monitoring
      health_check_url: 'http://localhost:3000/health',
      health_check_grace_period: 3000,
    }
  ]
};
```

Commands:
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor
pm2 status
pm2 logs comptario-api

# Setup startup script
pm2 startup
pm2 save
```

### Systemd Service (Alternative)

Create `/etc/systemd/system/comptario-api.service`:

```ini
[Unit]
Description=Comptario API Server
After=network.target
Requires=postgresql.service

[Service]
Type=simple
User=comptario
WorkingDirectory=/var/www/comptario
ExecStart=/usr/bin/node backend/dist/main.js
EnvironmentFile=/var/www/comptario/apps/api/.env
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/www/comptario/logs
ProtectHome=true

# Resource limits
LimitNOFILE=65536
MemoryMax=512M

[Install]
WantedBy=multi-user.target
```

Commands:
```bash
sudo systemctl enable comptario-api
sudo systemctl start comptario-api
sudo systemctl status comptario-api
```

## Health Checks

### Application Health Endpoint

```typescript
// health.controller.ts
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || 'unknown'
    };
  }
}
```

### Load Balancer Health Check

```bash
# Test health endpoint
curl -f http://localhost:3000/health || exit 1
```

### Monitoring Script

Create `scripts/health-check.sh`:

```bash
#!/bin/bash

# Health check script for monitoring systems
HEALTH_URL="http://localhost:3000/health"
MAX_RESPONSE_TIME=5000  # 5 seconds

response=$(curl -s -w "%{http_code}:%{time_total}" "$HEALTH_URL" --max-time 5)
http_code=$(echo "$response" | cut -d':' -f1)
response_time=$(echo "$response" | cut -d':' -f2)

if [ "$http_code" -eq 200 ]; then
    echo "OK - API healthy (${response_time}s)"
    exit 0
else
    echo "CRITICAL - API unhealthy (HTTP $http_code)"
    exit 2
fi
```

## Security Checklist

### Pre-deployment Security Audit

- [ ] **Environment Variables**
  - [ ] No server secrets in VITE_ variables
  - [ ] Strong, unique JWT secrets (256+ bits)
  - [ ] Database credentials secured
  - [ ] Admin passwords hashed with bcrypt

- [ ] **Network Security**
  - [ ] API only binds to localhost (127.0.0.1)
  - [ ] Reverse proxy configured
  - [ ] CORS allowlist configured
  - [ ] Rate limiting enabled

- [ ] **TLS/HTTPS**
  - [ ] Valid SSL certificates
  - [ ] TLS 1.2+ only
  - [ ] HSTS header enabled
  - [ ] HTTP to HTTPS redirect

- [ ] **File System**
  - [ ] Frontend serves only dist/ directory
  - [ ] Source code not accessible via web
  - [ ] Log files protected
  - [ ] Environment files not in document root

- [ ] **Application Security**
  - [ ] Security headers configured
  - [ ] CSP policy defined
  - [ ] Input validation enabled
  - [ ] SQL injection protection (TypeORM parameterized queries)

### Runtime Security Monitoring

```bash
# Check for exposed environment files
find /var/www -name "*.env" -type f 2>/dev/null

# Verify file permissions
ls -la /var/www/comptario/apps/api/.env  # Should be 600
ls -la /var/www/comptario/dist/          # Should not contain .env files

# Monitor failed login attempts
grep "authentication failed" /var/log/nginx/access.log | tail -20
```

## Monitoring

### Log Aggregation

```bash
# Nginx logs
tail -f /var/log/nginx/access.log | grep "yourdomain.com"

# Application logs
tail -f /var/www/comptario/logs/error.log

# System logs
journalctl -u comptario-api -f
```

### Monitoring Endpoints

- **Application**: `https://yourdomain.com/api/health`
- **Nginx Status**: Configure `stub_status` module
- **System Metrics**: Use tools like Prometheus + Grafana

### Alerting

Set up alerts for:
- API response time > 5 seconds
- Error rate > 5%
- Memory usage > 80%
- Disk space < 10%
- Certificate expiration < 30 days

## Deployment Checklist

### Before Deployment

- [ ] Security audit completed
- [ ] Environment variables configured
- [ ] SSL certificates obtained
- [ ] Database backup created
- [ ] DNS records configured

### Deployment Steps

1. **Build Application**
   ```bash
   ./build-production.sh
   ```

2. **Deploy Static Files**
   ```bash
   rsync -av dist/ user@server:/var/www/comptario/dist/
   ```

3. **Update API Server**
   ```bash
   pm2 restart comptario-api
   ```

4. **Verify Deployment**
   ```bash
   curl -f https://yourdomain.com/api/health
   ```

### Post-deployment

- [ ] Health checks passing
- [ ] SSL certificate valid
- [ ] Performance tests completed
- [ ] Security scan performed
- [ ] Monitoring alerts configured

## Troubleshooting

### Common Issues

**Server secrets in client bundle:**
```bash
# Check client bundle for secrets
grep -r "DATABASE_" dist/
# Should return no results
```

**CORS errors:**
```bash
# Check browser console and verify CORS_ORIGIN in backend
echo $CORS_ORIGIN
```

**SSL certificate issues:**
```bash
# Test SSL configuration
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

**API not accessible:**
```bash
# Check if API is running locally
curl http://localhost:3000/health

# Check nginx proxy configuration
sudo nginx -t
```

This deployment guide ensures secure, production-ready hosting with proper environment separation and security hardening.
# Quick Deployment Reference

## 🚀 Production Deployment Checklist

### 1. Pre-deployment Setup
```bash
# Clone repository
git clone <repository-url>
cd Muhasabev2

# Run production setup (creates env files, PM2 config, etc.)
./scripts/setup-production.sh

# Edit environment files with your production values
nano apps/web/.env      # Frontend config (VITE_ variables only)
nano apps/api/.env      # Backend secrets (or backend/.env)
```

### 2. Security Verification
```bash
# Run security checks
./scripts/security-verify.sh

# Should show: "✅ All security checks passed!"
```

### 3. Build Application
```bash
# Build with automated security scanning
./build-production.sh

# This will:
# - Clean previous builds
# - Verify environment separation
# - Build optimized frontend
# - Scan for exposed secrets
# - Create build manifest
```

### 4. Deploy Static Files
```bash
# Copy build output to web server
sudo cp -r dist/* /var/www/comptario/

# Or use rsync for remote deployment
rsync -av dist/ user@server:/var/www/comptario/
```

### 5. Configure Reverse Proxy

#### Option A: Nginx
```bash
# Copy configuration
sudo cp docs/nginx-example.conf /etc/nginx/sites-available/comptario
sudo ln -s /etc/nginx/sites-available/comptario /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

#### Option B: Caddy
```bash
# Copy Caddyfile (see docs/deployment.md)
sudo cp Caddyfile.example /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 6. Start Backend API

#### Option A: PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start API server
pm2 start ecosystem.config.js

# Setup auto-start
pm2 startup
pm2 save
```

#### Option B: Systemd
```bash
# Copy service file
sudo cp comptario-api.service /etc/systemd/system/

# Enable and start
sudo systemctl enable comptario-api
sudo systemctl start comptario-api
```

### 7. Setup SSL/TLS
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

### 8. Verify Deployment
```bash
# Test health endpoint
curl https://yourdomain.com/api/health

# Should return: {"status":"ok","timestamp":"..."}

# Test web frontend
curl -I https://yourdomain.com

# Should return: HTTP/2 200
```

## 🔧 Configuration Files

### Environment Variables

**Frontend (`apps/web/.env`):**
```bash
VITE_API_URL=https://api.yourdomain.com
VITE_APP_NAME=Comptario
VITE_APP_VERSION=2.0.0
```

**Backend (`apps/api/.env` or `backend/.env`):**
```bash
DATABASE_HOST=localhost
DATABASE_PASSWORD=your_secure_password
JWT_SECRET=your_256_bit_jwt_secret
CORS_ORIGIN=https://yourdomain.com
NODE_ENV=production
```

### Nginx Minimal Config
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Frontend
    location / {
        root /var/www/comptario;
        try_files $uri $uri/ /index.html;
    }
    
    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🛡️ Security Checklist

- [ ] Environment files have 600 permissions
- [ ] No server secrets in VITE_ variables
- [ ] Build output scanned for secrets
- [ ] API server binds only to localhost
- [ ] Reverse proxy configured
- [ ] HTTPS/TLS enabled
- [ ] CORS allowlist configured
- [ ] Security headers enabled
- [ ] Rate limiting implemented
- [ ] Health checks working

## 🔍 Monitoring

### Check Application Status
```bash
# PM2
pm2 status
pm2 logs comptario-api

# Systemd
sudo systemctl status comptario-api
sudo journalctl -u comptario-api -f

# Health check
./scripts/health-check.sh
```

### Check Web Server
```bash
# Nginx
sudo nginx -t
sudo systemctl status nginx
tail -f /var/log/nginx/access.log

# Caddy
sudo systemctl status caddy
sudo journalctl -u caddy -f
```

## 🚨 Troubleshooting

### Common Issues

**API not accessible:**
```bash
# Check if running locally
curl http://localhost:3000/health

# Check reverse proxy
sudo nginx -t
```

**CORS errors:**
```bash
# Verify CORS_ORIGIN in backend env
grep CORS_ORIGIN backend/.env
```

**SSL certificate issues:**
```bash
# Test SSL
openssl s_client -connect yourdomain.com:443
```

**Secrets in client bundle:**
```bash
# Re-run security verification
./scripts/security-verify.sh

# Check specific patterns
grep -r "DATABASE_" dist/
```

For detailed information, see `docs/deployment.md`
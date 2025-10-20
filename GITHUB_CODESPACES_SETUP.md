# GitHub Codespaces Kurulum Rehberi

Bu dokümantasyon, MoneyFlow uygulamasını GitHub Codespaces ortamında çalıştırmak için yapılan tüm ayarlamaları içerir.

## 🎯 Ana Sorun ve Çözüm

### Sorun
GitHub Codespaces'te çalışırken:
- Frontend ve Backend farklı portlarda çalışıyor
- GitHub Codespaces port forwarding CORS headerlarını düzgün iletmiyor
- Simple Browser (VS Code içindeki tarayıcı) localhost backend portlarına erişemiyor

### Çözüm
**Vite Proxy kullanarak tüm istekleri aynı origin'den servis etmek**

---

## 📋 Yapılan Değişiklikler

### 1. Backend Ayarları

#### Backend `.env` Dosyası Oluşturuldu
Konum: `/backend/.env`

```env
NODE_ENV=development
PORT=3002

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=moneyflow
DATABASE_PASSWORD=moneyflow123
DATABASE_NAME=moneyflow_dev

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=24h

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Önemli:** `NODE_ENV=development` ayarı TypeORM'in `synchronize: true` özelliğini aktif eder (veritabanı tablolarını otomatik oluşturur).

#### CORS Ayarları Güncellendi
Konum: `/backend/src/main.ts`

```typescript
// Gelişmiş CORS yapılandırması - GitHub Codespaces için
app.enableCors({
  origin: (origin, callback) => {
    // Development: tüm originlere izin ver
    console.log('🌐 CORS Request from origin:', origin);
    callback(null, true);
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'Access-Control-Allow-Origin'],
  exposedHeaders: ['Authorization', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
});
```

---

### 2. Frontend Ayarları

#### Vite Config - Proxy Eklendi
Konum: `/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Tüm network interface'lerden erişilebilir
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
```

**Açıklama:**
- `host: '0.0.0.0'`: IPv4 ve IPv6 üzerinden erişim sağlar
- `proxy`: `/api/*` isteklerini `http://localhost:3002/*` adresine yönlendirir
- `changeOrigin: true`: Origin header'ını hedef URL ile değiştirir
- `rewrite`: `/api` prefix'ini kaldırır (ör: `/api/auth/login` → `/auth/login`)

#### Frontend `.env` Dosyası
Konum: `/.env`

```env
VITE_API_URL=/api
```

**Önemli:** Artık tam URL yerine relative path kullanıyoruz. Bu sayede CORS sorunu yaşanmıyor.

---

## 🚀 Başlatma Komutları

### Tam Kurulum (İlk Kez)

```bash
# 1. Backend bağımlılıklarını yükle
cd /workspaces/Muhasabev2/backend
npm install

# 2. Frontend bağımlılıklarını yükle
cd /workspaces/Muhasabev2
npm install

# 3. Docker container'ları başlat (PostgreSQL, Redis, pgAdmin)
cd /workspaces/Muhasabev2/backend
docker-compose up -d

# 4. Backend'i başlat
cd /workspaces/Muhasabev2/backend
nohup npm run start:dev > /tmp/backend.log 2>&1 &

# 5. Veritabanının hazır olmasını bekle
sleep 5

# 6. Frontend'i başlat
cd /workspaces/Muhasabev2
nohup npm run dev > /tmp/frontend.log 2>&1 &

# 7. Admin kullanıcısı oluştur (sadece ilk kez)
curl -X POST http://localhost:3002/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin@test.com",
    "password":"123456",
    "firstName":"Admin",
    "lastName":"User"
  }'
```

### Hızlı Başlatma (Her Seferinde)

```bash
# Start script kullan (önerilen)
cd /workspaces/Muhasabev2
./start-dev.sh
```

veya

```bash
# Manuel başlatma
cd /workspaces/Muhasabev2/backend && docker-compose up -d
cd /workspaces/Muhasabev2/backend && nohup npm run start:dev > /tmp/backend.log 2>&1 &
sleep 5
cd /workspaces/Muhasabev2 && nohup npm run dev > /tmp/frontend.log 2>&1 &
```

---

## 🌐 Erişim URL'leri

### GitHub Codespaces Ortamında

**Frontend:**
```
https://obscure-enigma-v4v5rgp9vq73wv5x-5173.app.github.dev
```

**Backend API (Direkt - Test için):**
```
https://obscure-enigma-v4v5rgp9vq73wv5x-3002.app.github.dev
```

**NOT:** Codespace adı her ortamda farklı olur. VS Code'da "Ports" sekmesinden gerçek URL'leri görebilirsiniz.

### Yerel Ortamda (localhost)

**Frontend:**
```
http://localhost:5173
```

**Backend API:**
```
http://localhost:3002
```

**Swagger Documentation:**
```
http://localhost:3002/api
```

**pgAdmin:**
```
http://localhost:5050
```

---

## 🔐 Giriş Bilgileri

### Uygulama
- **E-posta:** admin@test.com
- **Şifre:** 123456

### pgAdmin
- **E-posta:** admin@moneyflow.com
- **Şifre:** admin123

### PostgreSQL
- **Host:** localhost (Codespaces içinde)
- **Port:** 5432
- **Database:** moneyflow_dev
- **Username:** moneyflow
- **Password:** moneyflow123

---

## 🐛 Sorun Giderme

### Backend Çalışmıyor

```bash
# Logları kontrol et
tail -50 /tmp/backend.log

# Port kullanımda mı?
lsof -i :3002

# İşlemi durdur ve yeniden başlat
lsof -ti:3002 | xargs kill -9
cd /workspaces/Muhasabev2/backend && npm run start:dev
```

### Frontend Çalışmıyor

```bash
# Logları kontrol et
tail -50 /tmp/frontend.log

# Port kullanımda mı?
lsof -i :5173

# İşlemi durdur ve yeniden başlat
pkill -9 -f "vite"
cd /workspaces/Muhasabev2 && npm run dev
```

### CORS Hatası Alıyorum

**Çözüm 1:** `.env` dosyasını kontrol edin
```bash
cat /workspaces/Muhasabev2/.env
# Çıktı: VITE_API_URL=/api
```

**Çözüm 2:** Tarayıcı cache'ini temizleyin (Hard Refresh: Ctrl+Shift+R)

**Çözüm 3:** Vite proxy ayarlarını kontrol edin
```bash
cat /workspaces/Muhasabev2/vite.config.ts | grep -A 10 "proxy"
```

### Veritabanı Tabloları Yok

```bash
# .env dosyasında NODE_ENV=development olduğundan emin olun
cat /workspaces/Muhasabev2/backend/.env | grep NODE_ENV

# Backend'i yeniden başlatın (synchronize otomatik çalışacak)
pkill -9 -f "nest start"
cd /workspaces/Muhasabev2/backend && npm run start:dev
```

### Docker Container'lar Başlamıyor

```bash
# Container'ları kontrol et
docker ps -a

# Logları kontrol et
cd /workspaces/Muhasabev2/backend
docker-compose logs

# Yeniden başlat
docker-compose down
docker-compose up -d
```

---

## 📊 Servis Durumunu Kontrol Etme

```bash
# Tüm çalışan servisleri göster
ps aux | grep -E "vite|nest|postgres|redis" | grep -v grep

# Port kullanımını kontrol et
netstat -tuln | grep -E "3002|5173|5432|6379|5050"

# Backend sağlık kontrolü
curl http://localhost:3002/health

# Frontend proxy kontrolü
curl http://localhost:5173/api/health
```

---

## 🔄 Servisleri Durdurma

```bash
# Hızlı durdurma (stop script)
cd /workspaces/Muhasabev2
./stop-dev.sh
```

veya

```bash
# Manuel durdurma
pkill -9 -f "vite"
pkill -9 -f "nest start"
cd /workspaces/Muhasabev2/backend && docker-compose down
```

---

## 📝 Önemli Notlar

### 1. Port Forwarding Visibility
GitHub Codespaces'te portlar default olarak "Private" olabilir. Public erişim için:
- VS Code'da "Ports" sekmesini açın
- İlgili porta sağ tıklayın
- "Port Visibility" → "Public" seçin

### 2. Environment Variables
`.env` dosyaları `.gitignore`'da olmalı. Production'da farklı değerler kullanılmalı.

### 3. TypeORM Synchronize
`synchronize: true` sadece development ortamında kullanılmalı. Production'da migration kullanın.

### 4. CORS Ayarları
Production ortamında `origin: true` yerine spesifik domain'ler belirtilmeli:

```typescript
origin: [
  'https://yourdomain.com',
  'https://app.yourdomain.com'
],
```

### 5. Vite Proxy
Vite proxy sadece development ortamında çalışır. Production build'de backend URL'si absolute path olmalı.

---

## 🔧 Production Deployment İçin

Production'a deploy ederken:

1. **Backend `.env`:**
   ```env
   NODE_ENV=production
   DATABASE_HOST=production-db-host
   JWT_SECRET=strong-random-secret-key
   ```

2. **Frontend `.env.production`:**
   ```env
   VITE_API_URL=https://api.yourdomain.com
   ```

3. **CORS:** Spesifik origin'ler belirtin

4. **TypeORM:** Synchronize kapatın, migration kullanın

5. **Build:**
   ```bash
   # Backend
   cd backend && npm run build
   
   # Frontend
   cd .. && npm run build
   ```

---

## 📚 Referanslar

- [Vite Proxy Docs](https://vitejs.dev/config/server-options.html#server-proxy)
- [NestJS CORS](https://docs.nestjs.com/security/cors)
- [TypeORM Synchronize](https://typeorm.io/data-source-options#common-data-source-options)
- [GitHub Codespaces Ports](https://docs.github.com/en/codespaces/developing-in-codespaces/forwarding-ports-in-your-codespace)

---

## ✅ Checklist - Yeni Workspace'te Kurulum

- [ ] Repository'yi clone et / Codespace başlat
- [ ] Backend `.env` dosyasını oluştur
- [ ] Frontend `.env` dosyasını oluştur (`VITE_API_URL=/api`)
- [ ] `vite.config.ts` dosyasında proxy ayarlarını kontrol et
- [ ] Backend bağımlılıklarını yükle (`cd backend && npm install`)
- [ ] Frontend bağımlılıklarını yükle (`npm install`)
- [ ] Docker container'ları başlat (`cd backend && docker-compose up -d`)
- [ ] Backend'i başlat (arka planda)
- [ ] Frontend'i başlat (arka planda)
- [ ] Admin kullanıcısını oluştur (register endpoint)
- [ ] Tarayıcıda frontend URL'sini aç
- [ ] Giriş yap ve test et

---

**Son Güncelleme:** 20 Ekim 2025  
**Oluşturan:** GitHub Copilot

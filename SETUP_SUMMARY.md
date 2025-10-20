# GitHub Codespaces Kurulum Özeti

## Yapılan Değişiklikler (20 Ekim 2025)

### Problem
GitHub Codespaces ortamında CORS hataları ve port forwarding sorunları nedeniyle frontend backend'e bağlanamıyordu.

### Çözüm
Vite proxy kullanarak tüm API isteklerini same-origin üzerinden yönlendirme.

---

## Değiştirilen Dosyalar

### 1. `/vite.config.ts`
**Eklenen:**
```typescript
server: {
  host: '0.0.0.0',
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:3002',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

### 2. `/.env` (root)
**İçerik:**
```env
VITE_API_URL=/api
```

### 3. `/backend/.env`
**Oluşturuldu:**
```env
NODE_ENV=development
PORT=3002
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=moneyflow
DATABASE_PASSWORD=moneyflow123
DATABASE_NAME=moneyflow_dev
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=24h
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 4. `/backend/src/main.ts`
**CORS ayarları güncellendi:**
- `origin: callback` ile tüm originlere izin
- Ek headerlar eklendi
- `maxAge: 86400` (24 saat)
- CORS request'leri log'lanıyor

---

## Kullanım

### Geliştirme Ortamı (GitHub Codespaces)

**Başlatma:**
```bash
./start-dev.sh
```

**Erişim:**
- VS Code → Ports sekmesi → Port 5173 → "Open in Browser"
- Veya: `https://<codespace-name>-5173.app.github.dev`

**Giriş:**
- E-posta: `admin@test.com`
- Şifre: `123456`

### Yerel Ortam (localhost)

**Başlatma:**
```bash
# Backend
cd backend && docker-compose up -d
npm run start:dev

# Frontend
cd .. && npm run dev
```

**Erişim:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3002
- Swagger: http://localhost:3002/api

---

## Proxy Nasıl Çalışıyor?

```
Browser Request: https://<codespace>-5173.app.github.dev/api/auth/login
      ↓
Vite Proxy: http://localhost:3002/auth/login
      ↓
NestJS Backend: Handles request
      ↓
Response: Sent back through same origin (no CORS)
```

**Avantajları:**
- ✅ CORS sorunu yok (same-origin)
- ✅ GitHub Codespaces port forwarding sorunları yok
- ✅ Tek URL'den erişim
- ✅ Geliştirme ortamında kolay debug

---

## Dokümantasyon

**Detaylı kurulum:** [GITHUB_CODESPACES_SETUP.md](./GITHUB_CODESPACES_SETUP.md)

**İçindekiler:**
- Adım adım kurulum
- Tüm yapılandırma dosyaları
- Sorun giderme
- Production deployment notları
- Komutlar ve scriptler

---

## Önemli Notlar

1. **Production Build:** Vite proxy sadece dev ortamında çalışır. Production'da `VITE_API_URL` absolute URL olmalı.

2. **TypeORM Sync:** `NODE_ENV=development` olduğunda tablolar otomatik oluşur. Production'da migration kullanın.

3. **Port Visibility:** GitHub Codespaces'te portlar "Public" olarak ayarlanmalı (VS Code Ports sekmesi).

4. **Admin Kullanıcı:** İlk çalıştırmada manuel oluşturulmalı:
   ```bash
   curl -X POST http://localhost:3002/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@test.com","password":"123456","firstName":"Admin","lastName":"User"}'
   ```

---

**Hazırlayan:** GitHub Copilot  
**Tarih:** 20 Ekim 2025

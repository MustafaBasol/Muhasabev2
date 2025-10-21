# 🚀 GitHub Codespaces Hızlı Başlangıç Kılavuzu

Bu doküman, Muhasabev2 projesini GitHub Codespaces'te ilk kez açtığınızda yapmanız gereken adımları içerir.

## 📋 Ön Koşullar

- GitHub hesabınızın Codespaces erişimi olmalı
- Codespace başlatıldığında otomatik olarak gerekli bağımlılıklar yüklenecektir

---

## 🎯 İlk Başlatma Adımları

### 1️⃣ Docker Container'ları Başlatın

```bash
cd /workspaces/Muhasabev2/backend
docker-compose up -d
```

**Kontrol:**
```bash
docker ps
```
Çıktıda şunları görmelisiniz:
- `moneyflow-db` (PostgreSQL)
- `moneyflow-redis` (Redis)
- `moneyflow-pgadmin` (pgAdmin)

---

### 2️⃣ Backend'i Başlatın

**Yeni terminal açın ve:**

```bash
cd /workspaces/Muhasabev2/backend
npm install  # İlk kez için gerekli
npm run start:dev
```

**Başarılı başlatma çıktısı:**
```
🚀 Application is running on: https://glorious-couscous-xxxxx-3002.app.github.dev
📚 Swagger documentation: https://glorious-couscous-xxxxx-3002.app.github.dev/api
🔗 Local access: http://localhost:3002
```

**Not:** Backend `localhost:3002` portunda çalışmalıdır.

---

### 3️⃣ Frontend'i Başlatın

**Başka bir terminal açın ve:**

```bash
cd /workspaces/Muhasabev2
npm install  # İlk kez için gerekli
npm run dev
```

**Başarılı başlatma çıktısı:**
```
VITE v7.1.10  ready in XXX ms

➜  Local:   http://localhost:5174/
➜  Network: http://10.0.15.159:5174/
```

---

## ✅ Doğrulama

### Backend Kontrolü

```bash
curl http://localhost:3002/health
```

**Beklenen yanıt:** `{"status":"ok"}`

### Frontend Kontrolü

Tarayıcınızda: `http://localhost:5174/` adresini açın.

### API İletişim Kontrolü

Frontend açıldığında tarayıcı konsolunda şunları görmeli:
```
📤 API Request: GET /customers
Received Response from the Target: 200 /customers
```

**UYARI:** Eğer CORS hataları görüyorsanız, aşağıdaki "Yaygın Sorunlar" bölümüne bakın.

---

## ⚙️ Yapılandırma Dosyaları (Doğrulama)

### vite.config.ts

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3002',  // ✅ localhost olmalı
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}
```

**ÖNEMLI:** `target` mutlaka `http://localhost:3002` olmalı, **Codespace URL'i OLMAMALI**.

### backend/src/main.ts

```typescript
const port = 3002;
const host = '0.0.0.0';  // ✅ Tüm interface'lerde dinle
await app.listen(port, host);
```

---

## 🔧 Yaygın Sorunlar ve Çözümleri

### ❌ Problem 1: CORS / Authentication Redirect Hataları

**Belirti:**
```
Access to XMLHttpRequest at 'https://github.dev/pf-signin?...' has been blocked by CORS policy
```

**Çözüm:**
`vite.config.ts` dosyasında proxy target'ı kontrol edin:

```bash
cd /workspaces/Muhasabev2
cat vite.config.ts | grep target
```

**Yanlış yapılandırma:**
```typescript
target: 'https://glorious-couscous-xxxxx-3002.app.github.dev',  // ❌ YANLIŞ
```

**Doğru yapılandırma:**
```typescript
target: 'http://localhost:3002',  // ✅ DOĞRU
```

**Düzeltme:**
1. `vite.config.ts` dosyasını açın
2. `target` değerini `'http://localhost:3002'` olarak değiştirin
3. Frontend'i yeniden başlatın (`Ctrl+C` ile durdurup `npm run dev`)

---

### ❌ Problem 2: Backend Port'ta Dinlemiyor

**Belirti:**
```bash
curl: (7) Failed to connect to localhost port 3002
```

**Çözüm:**

1. Backend process'ini kontrol edin:
```bash
ps aux | grep "nest"
```

2. Process yoksa yeniden başlatın:
```bash
cd /workspaces/Muhasabev2/backend
npm run start:dev
```

3. Port'u dinlediğini doğrulayın:
```bash
lsof -i :3002
```

---

### ❌ Problem 3: Docker Container'lar Çalışmıyor

**Belirti:**
```
TypeORM connection error
```

**Çözüm:**

1. Container durumunu kontrol edin:
```bash
cd /workspaces/Muhasabev2/backend
docker ps -a
```

2. Durdurulmuş container'ları başlatın:
```bash
docker-compose down
docker-compose up -d
```

3. Logları kontrol edin:
```bash
docker logs moneyflow-db
```

---

### ❌ Problem 4: Port Çakışması

**Belirti:**
```
Error: listen EADDRINUSE: address already in use :::3002
```

**Çözüm:**

1. Port'u kullanan process'i bulun:
```bash
lsof -ti:3002
```

2. Process'i sonlandırın:
```bash
kill -9 $(lsof -ti:3002)
```

3. Backend'i yeniden başlatın.

---

## 🔄 Yeniden Başlatma (Restart) Prosedürü

Codespace'i kapatıp tekrar açtıktan sonra:

1. **Docker container'ları kontrol edin:**
   ```bash
   cd /workspaces/Muhasabev2/backend
   docker ps
   ```
   Çalışmıyorlarsa: `docker-compose up -d`

2. **Backend'i başlatın:**
   ```bash
   cd /workspaces/Muhasabev2/backend
   npm run start:dev
   ```

3. **Frontend'i başlatın:**
   ```bash
   cd /workspaces/Muhasabev2
   npm run dev
   ```

---

## 🛠️ Yardımcı Komutlar

### Tüm Process'leri Durdurmak

```bash
# Frontend'i durdur
pkill -f "vite"

# Backend'i durdur
pkill -f "nest"

# Docker'ı durdur
cd /workspaces/Muhasabev2/backend
docker-compose down
```

### Temiz Başlangıç (Clean Start)

```bash
# 1. Her şeyi durdur
pkill -f "vite"
pkill -f "nest"
cd /workspaces/Muhasabev2/backend
docker-compose down

# 2. Docker'ı başlat
docker-compose up -d

# 3. Backend'i başlat (yeni terminal)
cd /workspaces/Muhasabev2/backend
npm run start:dev

# 4. Frontend'i başlat (yeni terminal)
cd /workspaces/Muhasabev2
npm run dev
```

### Logları İzlemek

**Backend:**
Backend terminalinde zaten görünür, ek komut gerekmez.

**Docker PostgreSQL:**
```bash
docker logs -f moneyflow-db
```

**Frontend Proxy:**
Frontend terminalinde otomatik olarak görünür:
```
Sending Request to the Target: GET /products
Received Response from the Target: 200 /products
```

---

## 📊 Sağlıklı Sistem Çıktısı

### Backend Terminal:
```
[Nest] 42511  - 10/21/2025, 9:50:21 AM     LOG [NestApplication] Nest application successfully started +4ms
🚀 Application is running on: https://glorious-couscous-447rvgqpxx63xjr-3002.app.github.dev
📚 Swagger documentation: https://glorious-couscous-447rvgqpxx63xjr-3002.app.github.dev/api
🔗 Local access: http://localhost:3002
```

### Frontend Terminal:
```
VITE v7.1.10  ready in 256 ms

➜  Local:   http://localhost:5174/
Sending Request to the Target: GET /customers
Received Response from the Target: 200 /customers
```

### Tarayıcı Konsolu:
```
🚀 MoneyFlow uygulaması başlatılıyor...
✅ Root element bulundu, uygulama render ediliyor...
✅ MoneyFlow uygulaması başarıyla yüklendi!
📤 API Request: GET /customers
✅ Müşteriler yüklendi: 3
```

**UYARI:** Tarayıcı konsolunda **CORS hataları OLMAMALI**.

---

## 🎯 Başarı Kriterleri

- ✅ Docker container'lar çalışıyor (`docker ps`)
- ✅ Backend `localhost:3002`'de dinliyor (`lsof -i :3002`)
- ✅ Frontend `localhost:5174`'te çalışıyor
- ✅ API istekleri 200/304 durum kodları ile başarılı
- ✅ CORS hatası YOK
- ✅ Authentication redirect YOK

---

## 📞 Destek

Sorun yaşarsanız:

1. Bu dokümandaki "Yaygın Sorunlar" bölümünü kontrol edin
2. Backend ve Frontend terminallerindeki hata mesajlarını okuyun
3. `vite.config.ts` dosyasındaki proxy yapılandırmasını doğrulayın

---

## 🔐 Güvenlik Notları

- Backend `.env` dosyası `.gitignore`'da olmalı
- Hassas bilgiler (şifreler, API keys) repository'e commit edilmemeli
- Production ortamında `NODE_ENV=production` kullanılmalı

---

## 📝 Son Güncelleme

Bu doküman: **21 Ekim 2025** tarihinde oluşturulmuştur.

**Mimari:**
- Frontend: Vite + React + TypeScript (Port 5174)
- Backend: NestJS + TypeORM (Port 3002)
- Database: PostgreSQL (Port 5432)
- Cache: Redis (Port 6379)
- Admin: pgAdmin (Port 5050)

**Kritik Yapılandırma:**
Vite proxy **localhost-to-localhost** internal network kullanır, external Codespace URL'leri KULLANMAZ.

---

## 🎉 Mutlu Kodlamalar!

Bu adımları takip ederek Codespace'inizde sorunsuz çalışabilirsiniz.

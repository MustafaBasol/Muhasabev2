# Comptario Muhasebe v2

NOT: Bu dosyanın temiz ve güncel sürümü için README_CLEAN.md dosyasına bakın. Bu dosya yakında sadeleştirilecektir.

Modern, güvenli ve ölçeklenebilir multi-tenant muhasebe ve finans yönetim sistemi.

---

## ⚡ HIZLI BAŞLATMA (Tek Komut!)

```bash
./start-safe.sh
```

**Hepsi bu kadar!** Codespace açıldığında otomatik başlayacak şekilde ayarlandı.

**🌐 URL'ler:**
- Frontend: https://damp-wraith-7q9x5r7j6qrcgg6-5173.app.github.dev
- Backend: https://damp-wraith-7q9x5r7j6qrcgg6-3000.app.github.dev

**👤 Giriş:**
- Email: admin@test.com
- Şifre: Test123456

**💾 Yedekleme:**
```bash
./quick-backup.sh
```

**📖 Basit Kılavuz:** [BASLATMA.md](./BASLATMA.md)

---



## 🎯 Tek Port ÇözümüModern, güvenli ve ölçeklenebilir multi-tenant muhasebe ve finans yönetim sistemi.Modern, güvenli ve kullanıcı dostu muhasebe yönetim sistemi.



Bu proje **tek port** üzerinden çalışır. Backend (NestJS) hem API hem de frontend static dosyalarını serve eder.



**Sadece `http://localhost:3002` kullanılır!**## 🏗️ Proje Yapısı## 🚀 Özellikler



## 🏗️ Proje Yapısı



``````- 📊 Dashboard ve raporlama

Muhasabev2/

├── backend/              # NestJS Backend APIMuhasabev2/- 👥 Müşteri/Tedarikçi yönetimi

│   ├── src/

│   │   ├── auth/        # Authentication & JWT├── backend/              # NestJS Backend API- 🧾 Fatura ve gider yönetimi

│   │   ├── users/       # Kullanıcı yönetimi

│   │   ├── tenants/     # Multi-tenant altyapısı│   ├── src/- 💰 Satış takibi

│   │   ├── customers/   # Müşteri yönetimi

│   │   ├── suppliers/   # Tedarikçi yönetimi│   │   ├── auth/        # Authentication & Authorization- 🏦 Banka hesapları

│   │   ├── products/    # Ürün yönetimi

│   │   ├── invoices/    # Fatura yönetimi│   │   ├── users/       # Kullanıcı yönetimi- 📈 Grafik ve analizler

│   │   └── expenses/    # Gider yönetimi

│   ├── public/dist/     # Frontend build dosyaları (otomatik)│   │   ├── tenants/     # Multi-tenant altyapısı- 🔐 Güvenli veri saklama

│   ├── docker-compose.yml

│   └── .env│   │   ├── customers/   # Müşteri yönetimi- 📱 Responsive tasarım

├── src/                  # React Frontend (Development)

│   ├── components/      # React bileşenleri│   │   ├── suppliers/   # Tedarikçi yönetimi

│   ├── api/            # API client (relative paths)

│   ├── contexts/       # React contexts│   │   ├── products/    # Ürün yönetimi## 🛡️ Güvenlik

│   └── types/          # TypeScript types

├── dist/                # Frontend build çıktısı│   │   ├── invoices/    # Fatura yönetimi

├── build-and-deploy.sh  # Otomatik build scripti

├── start-dev.sh         # Development başlatma│   │   └── expenses/    # Gider yönetimi- ✅ XSS koruması (DOMPurify)

└── stop-dev.sh          # Servisleri durdurma

```│   ├── docker-compose.yml- ✅ LocalStorage encryption



## 🚀 Hızlı Başlangıç│   └── .env- ✅ Environment variables



### 1. Servisleri Başlat├── src/                  # React Frontend- ✅ Sıfır güvenlik açığı



```bash│   ├── components/      # React bileşenleri- ✅ TypeScript strict mode

./start-dev.sh

```│   ├── api/            # API client



Bu komut:│   ├── contexts/       # React contextsDetaylı bilgi için: [SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md)

- ✅ Docker container'ları başlatır (PostgreSQL, Redis, pgAdmin)

- ✅ Backend'i başlatır (port 3002)│   └── types/          # TypeScript types

- ✅ Frontend'i build edip backend'e deploy eder

├── start-dev.sh         # Geliştirme ortamını başlat## 🔧 Kurulum

### 2. Uygulamayı Aç

└── stop-dev.sh          # Geliştirme ortamını durdur

Tarayıcınızda: **http://localhost:3002**

``````bash

- 🌐 Frontend: `http://localhost:3002`

- 📚 API Docs: `http://localhost:3002/api`# Bağımlılıkları yükle

- ❤️ Health Check: `http://localhost:3002/health`

- 🗄️ pgAdmin: `http://localhost:5050`## 🚀 Hızlı Başlangıçnpm install



### 3. Servisleri Durdur



```bash### Gereksinimler# Environment variables

./stop-dev.sh

```- Node.js 18+cp .env.example .env



## 🔧 Development Modu- Docker & Docker Compose



Eğer frontend'te değişiklik yapıyorsanız ve hot-reload istiyorsanız:- npm veya yarn# Geliştirme sunucusu



### Seçenek 1: Tek Port (Production-like)npm run dev



```bash### Kurulum

# Frontend'i build et ve deploy et

./build-and-deploy.sh# Production build



# Backend otomatik olarak güncel build'i serve eder1. **Bağımlılıkları Yükle**npm run build

# http://localhost:3002

``````bash```



### Seçenek 2: İki Port (Hot Reload)# Backend bağımlılıkları



```bashcd backend## 📝 Environment Variables

# Terminal 1 - Backend

cd backendnpm install

npm run start:dev

```bash

# Terminal 2 - Frontend (Development)

npm run dev# Frontend bağımlılıklarıVITE_DEMO_EMAIL=demo@comptario.com

# Frontend: http://localhost:5173

# Backend: http://localhost:3002cd ..VITE_DEMO_PASSWORD=demo123

```

npm installVITE_ENABLE_ENCRYPTION=true

## 📦 Frontend Build ve Deploy

```VITE_ENCRYPTION_KEY=your-key-here

Frontend değişiklikleri yaptığınızda:

```

```bash

./build-and-deploy.sh2. **Environment Variables**

```

```bash## 🧪 Test ve Linting

Bu script:

1. Frontend'i production mode'da build eder# Backend .env dosyası zaten yapılandırılmış

2. Build dosyalarını `backend/public/dist/` klasörüne kopyalar

3. Backend otomatik olarak güncel dosyaları serve eder# Gerekirse backend/.env dosyasını düzenleyin```bash



## 🌟 Özellikler```# ESLint



### Backend (NestJS)npm run lint

- ✅ **Multi-Tenant Architecture** - Tenant isolation with row-level security

- ✅ **JWT Authentication** - Secure token-based auth3. **Tüm Servisleri Başlat**

- ✅ **Role-Based Access Control** - Admin/User roles

- ✅ **PostgreSQL + TypeORM** - Robust database layer```bash# TypeScript check

- ✅ **Redis Caching** - Performance optimization

- ✅ **Swagger Documentation** - Auto-generated API docs./start-dev.shnpx tsc --noEmit

- ✅ **Docker Support** - Easy deployment

```

### Frontend (React + TypeScript)

- ✅ **Modern React** - Hooks, Context API# Security audit

- ✅ **TypeScript** - Type safety

- ✅ **Tailwind CSS** - Utility-first stylingBu komut:npm audit

- ✅ **Responsive Design** - Mobile-friendly

- ✅ **API Integration** - Axios with retry logic- ✅ PostgreSQL, Redis ve pgAdmin Docker container'larını başlatır```

- ✅ **LocalStorage Encryption** - Secure data storage

- ✅ Backend API'yi başlatır (port 3002)

### Business Features

- 📊 Dashboard ve raporlama
- 👥 Müşteri/Tedarikçi yönetimi
- 🧾 Fatura ve gider yönetimi
- 💰 Satış takibi
- 🏦 Banka hesapları
- 📈 Grafik ve analizler
- 💱 **Multi-Currency Support** (TRY, USD, EUR)
  - Global para birimi değiştirme
  - Anlık format güncelleme
  - LocalStorage persistence
  - Locale-aware formatting

## 🔐 Güvenlik

Eğer script kullanmak istemezseniz:- Vite

- ✅ XSS koruması (DOMPurify)

- ✅ LocalStorage encryption- Tailwind CSS

- ✅ Environment variables

- ✅ JWT token security```bash- jsPDF / html2canvas

- ✅ CORS yapılandırması

- ✅ TypeScript strict mode# 1. Docker container'ları başlat- ExcelJS



Detaylı bilgi: [SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md)cd backend- DOMPurify



## 🗄️ Veritabanıdocker-compose up -d- Lucide Icons



### PostgreSQL Bağlantısı (pgAdmin)



1. Tarayıcıda `http://localhost:5050` aç# 2. Backend'i başlat## � Dokümantasyon

2. Login: `admin@comptario.com` / `admin123`

3. Yeni server ekle:npm run start:dev

   - Host: `moneyflow-db`

   - Port: `5432`- **[SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md)** - Güvenlik ve kalite iyileştirmeleri

   - Username: `moneyflow`

   - Password: `moneyflow123`# 3. Yeni terminal'de Frontend'i başlat- **[MULTI_USER_ROADMAP.md](./MULTI_USER_ROADMAP.md)** - Çok kullanıcılı sistem yol haritası (16 hafta)

   - Database: `moneyflow_dev`

cd ..- **[MULTI_USER_QUICKSTART.md](./MULTI_USER_QUICKSTART.md)** - Hızlı başlangıç kılavuzu

## 📡 API Endpoints

npm run dev

### Authentication

- `POST /auth/register` - Yeni kullanıcı kaydı```## 🚀 Gelecek Planları

- `POST /auth/login` - Giriş yap

- `GET /auth/me` - Mevcut kullanıcı bilgisi



### Customers### Servisleri Durdurma### Faz 1: Backend & Multi-Tenancy (4 ay)

- `GET /customers` - Müşteri listesi

- `POST /customers` - Yeni müşteriUygulamayı çok kullanıcılı (multi-tenant) SaaS platformuna dönüştürme:

- `GET /customers/:id` - Müşteri detayı

- `PATCH /customers/:id` - Müşteri güncelle```bash- ✅ NestJS backend API

- `DELETE /customers/:id` - Müşteri sil

./stop-dev.sh- ✅ PostgreSQL veritabanı

### Products

- `GET /products` - Ürün listesi```- ✅ JWT authentication

- `POST /products` - Yeni ürün

- `GET /products/low-stock` - Düşük stoklu ürünler- ✅ Multi-tenant mimari

- `GET /products/:id` - Ürün detayı

- `PATCH /products/:id` - Ürün güncelle## 📊 Erişim Noktaları- ✅ Real-time updates (WebSocket)

- `DELETE /products/:id` - Ürün sil

- ✅ Subscription & billing (Stripe)

### Suppliers

- `GET /suppliers` - Tedarikçi listesi| Servis | URL | Açıklama |

- `POST /suppliers` - Yeni tedarikçi

- `GET /suppliers/:id` - Tedarikçi detayı|--------|-----|----------|Detaylar için: [MULTI_USER_ROADMAP.md](./MULTI_USER_ROADMAP.md)

- `PATCH /suppliers/:id` - Tedarikçi güncelle

- `DELETE /suppliers/:id` - Tedarikçi sil| Frontend | http://localhost:5173 | React uygulaması |



Tam API dökümantasyonu: `http://localhost:3002/api`| Backend API | http://localhost:3002 | NestJS REST API |### Faz 2: İleri Özellikler



## 🧪 Test| Swagger Docs | http://localhost:3002/api | API dokümantasyonu |- Mobil uygulama (React Native)



### Test Kullanıcısı Oluştur| pgAdmin | http://localhost:5050 | PostgreSQL yönetim arayüzü |- Gelişmiş raporlama



```bash- AI destekli finans analizi

curl -X POST http://localhost:3002/auth/register \

  -H "Content-Type: application/json" \### pgAdmin Giriş Bilgileri- Entegrasyonlar (banka, e-fatura, e-arşiv)

  -d '{

    "email": "test@example.com",- Email: `admin@admin.com`

    "password": "123456",

    "firstName": "Test",- Password: `admin`## �📄 Lisans

    "lastName": "User",

    "companyName": "Test Company"

  }'

```### Test KullanıcısıMIT



### Login Testİlk kullanıcınızı frontend'den kayıt olarak oluşturabilirsiniz:



```bash```json## 👨‍💻 Geliştirici

curl -X POST http://localhost:3002/auth/login \

  -H "Content-Type: application/json" \{

  -d '{

    "email": "test@example.com",  "email": "test@example.com",MustafaBasol

    "password": "123456"  "password": "123456",

  }'  "firstName": "Test",

```  "lastName": "User",

  "companyName": "Test Company"

## 📝 Environment Variables}

```

### Backend (.env)

```env## 🏢 Multi-Tenant Özellikler

# Database

DATABASE_HOST=localhost### Tenant İzolasyonu

DATABASE_PORT=5432- ✅ Row-level security (Satır seviyesi güvenlik)

DATABASE_USER=moneyflow- ✅ Her tenant için ayrı veri alanı

DATABASE_PASSWORD=moneyflow123- ✅ Otomatik tenant context yönetimi

DATABASE_NAME=moneyflow_dev- ✅ Tenant middleware ile istek filtreleme



# Redis### Güvenlik

REDIS_HOST=localhost- ✅ JWT-based authentication

REDIS_PORT=6379- ✅ Role-based access control (RBAC)

- ✅ Password hashing (bcrypt)

# JWT- ✅ CORS koruması

JWT_SECRET=your_super_secret_jwt_key- ✅ Request validation

JWT_EXPIRES_IN=7d- ✅ XSS koruması (DOMPurify)

- ✅ LocalStorage encryption

# App

PORT=3002## 🔧 Teknoloji Stack

NODE_ENV=development

```### Backend

- **Framework:** NestJS 11.x

### Frontend (.env)- **Database:** PostgreSQL 15

```env- **ORM:** TypeORM

# Development için localhost, production için relative path- **Authentication:** JWT + Passport

VITE_API_URL=http://localhost:3002- **Cache:** Redis

```- **Validation:** class-validator

- **Documentation:** Swagger/OpenAPI

## 🚢 Production Deployment

### Frontend

1. Environment variables'ı ayarla- **Framework:** React 18 + TypeScript

2. Frontend build et: `npm run build`- **Build Tool:** Vite

3. Backend'i başlat: `cd backend && npm run start:prod`- **UI Library:** Tailwind CSS

4. Nginx/Apache ile reverse proxy kur (opsiyonel)- **Icons:** Lucide React

- **HTTP Client:** Axios

## 📚 Dökümantasyon- **State Management:** React Context



- [Multi-User Quickstart](./MULTI_USER_QUICKSTART.md)### DevOps

- [Multi-User Roadmap](./MULTI_USER_ROADMAP.md)- **Containerization:** Docker & Docker Compose

- [Backend Status](./BACKEND_STATUS.md)- **Database UI:** pgAdmin 4

- [Security Improvements](./SECURITY_IMPROVEMENTS.md)

- [Transformation Summary](./TRANSFORMATION_SUMMARY.md)## 📝 API Endpoints



## 🤝 Katkıda Bulunma### Authentication

```

1. Fork yapınPOST /auth/register    - Yeni kullanıcı kaydı

2. Feature branch oluşturun (`git checkout -b feature/amazing`)POST /auth/login       - Kullanıcı girişi

3. Commit yapın (`git commit -m 'Add amazing feature'`)GET  /auth/me          - Mevcut kullanıcı bilgisi

4. Push edin (`git push origin feature/amazing`)```

5. Pull Request açın

### Customers

## 📄 Lisans```

GET    /customers      - Müşteri listesi

MIT License - Detaylar için LICENSE dosyasına bakın.POST   /customers      - Yeni müşteri

GET    /customers/:id  - Müşteri detayı

## 🆘 Sorun GidermePATCH  /customers/:id  - Müşteri güncelle

DELETE /customers/:id  - Müşteri sil

### Backend Başlamıyor```

```bash

# Docker container'ları kontrol et### Suppliers

docker ps```

GET    /suppliers      - Tedarikçi listesi

# Container'ları yeniden başlatPOST   /suppliers      - Yeni tedarikçi

cd backend && docker-compose down && docker-compose up -dGET    /suppliers/:id  - Tedarikçi detayı

```PATCH  /suppliers/:id  - Tedarikçi güncelle

DELETE /suppliers/:id  - Tedarikçi sil

### Frontend Build Hatası```

```bash

# node_modules'u temizle### Products

rm -rf node_modules package-lock.json```

npm installGET    /products           - Ürün listesi

npm run buildPOST   /products           - Yeni ürün

```GET    /products/low-stock - Stok azalan ürünler

GET    /products/:id       - Ürün detayı

### Port KullanımdaPATCH  /products/:id       - Ürün güncelle

```bashDELETE /products/:id       - Ürün sil

# 3002 portunu kullanan process'i bul```

lsof -i :3002

## 🧪 Testing

# Process'i durdur

kill -9 <PID>```bash

```# Backend unit tests

cd backend

## 📞 İletişimnpm run test



Sorularınız için issue açabilirsiniz.# Backend e2e tests

npm run test:e2e

---

# Test coverage

**Made with ❤️ using NestJS, React, and TypeScript**npm run test:cov

```

## 📚 Geliştirme Notları

### Log Dosyaları
```bash
# Backend logları
tail -f /tmp/backend.log

# Frontend logları
tail -f /tmp/frontend.log
```

### Database Migrations
```bash
cd backend
npm run migration:generate -- src/migrations/MigrationName
npm run migration:run
```

### Code Formatting
```bash
# Backend
cd backend
npm run format

# Frontend
cd ..
npm run format
```

## 🐛 Sorun Giderme

### Port çakışması
Eğer portlar kullanımdaysa:
```bash
# Port kullanımını kontrol et
lsof -i :3002
lsof -i :5173
lsof -i :5432

# Process'i durdur
kill -9 <PID>
```

### Docker sorunları
```bash
# Container'ları yeniden başlat
cd backend
docker-compose down -v
docker-compose up -d

# Logları kontrol et
docker-compose logs -f
```

### Frontend bağlantı hatası
`.env` dosyasında API URL'ini kontrol edin:
```
VITE_API_URL=http://localhost:3002
```

## 📖 Dökümanlar
 [Multi-User Roadmap](./MULTI_USER_ROADMAP.md) - Çoklu kullanıcı özellik haritası

### Planlar (Starter / Pro / Business)

| Plan | Kullanıcı | Müşteri | Tedarikçi | Banka Hesabı | Aylık Fatura | Aylık Gider |
|------|-----------|---------|----------|--------------|--------------|-------------|
| Starter (Free) | 1 | 1 | 1 | 1 | 5 | 5 |
| Pro (Professional) | 3 dahildir (+ Stripe add-on ile artırılabilir) | Sınırsız | Sınırsız | Sınırsız | Sınırsız | Sınırsız |
| Business (Enterprise) | Sınırsız | Sınırsız | Sınırsız | Sınırsız | Sınırsız | Sınırsız |

Notlar:
- Stripe aboneliği aktif ise kullanıcı limiti Stripe koltuk toplamından alınır.
- Pro planında ek kullanıcılar (addon) Stripe üzerinden quantity artırılarak faturalandırılır.
- Business planında koltuk kavramı sınırsız olduğundan ayrı seat satın alma işlemi yoktur.
- Legacy `basic` referansları artık Pro ile aynı anlamdadır (geçiş uyumluluğu için tutulur).
- [Güvenlik İyileştirmeleri](./SECURITY_IMPROVEMENTS.md) - Güvenlik önlemleri
- [Email Doğrulama & Şifre Sıfırlama Akışları](./backend/EMAIL_FLOW.md) - SES sandbox ile test ve yapılandırma
- [SES Bounce/Complaint Entegrasyonu](./backend/SES_SNS_BOUNCE_COMPLAINT.md) - SNS topic + suppression listesi

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📞 İletişim

Proje bakımcısı: [GitHub](https://github.com/MustafaBasol)

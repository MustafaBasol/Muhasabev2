# Comptario - Multi-Tenant Muhasebe Sistemi# Comptario Muhasebe v2



Modern, güvenli ve ölçeklenebilir multi-tenant muhasebe ve finans yönetim sistemi.Modern, güvenli ve kullanıcı dostu muhasebe yönetim sistemi.



## 🏗️ Proje Yapısı## 🚀 Özellikler



```- 📊 Dashboard ve raporlama

Muhasabev2/- 👥 Müşteri/Tedarikçi yönetimi

├── backend/              # NestJS Backend API- 🧾 Fatura ve gider yönetimi

│   ├── src/- 💰 Satış takibi

│   │   ├── auth/        # Authentication & Authorization- 🏦 Banka hesapları

│   │   ├── users/       # Kullanıcı yönetimi- 📈 Grafik ve analizler

│   │   ├── tenants/     # Multi-tenant altyapısı- 🔐 Güvenli veri saklama

│   │   ├── customers/   # Müşteri yönetimi- 📱 Responsive tasarım

│   │   ├── suppliers/   # Tedarikçi yönetimi

│   │   ├── products/    # Ürün yönetimi## 🛡️ Güvenlik

│   │   ├── invoices/    # Fatura yönetimi

│   │   └── expenses/    # Gider yönetimi- ✅ XSS koruması (DOMPurify)

│   ├── docker-compose.yml- ✅ LocalStorage encryption

│   └── .env- ✅ Environment variables

├── src/                  # React Frontend- ✅ Sıfır güvenlik açığı

│   ├── components/      # React bileşenleri- ✅ TypeScript strict mode

│   ├── api/            # API client

│   ├── contexts/       # React contextsDetaylı bilgi için: [SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md)

│   └── types/          # TypeScript types

├── start-dev.sh         # Geliştirme ortamını başlat## 🔧 Kurulum

└── stop-dev.sh          # Geliştirme ortamını durdur

``````bash

# Bağımlılıkları yükle

## 🚀 Hızlı Başlangıçnpm install



### Gereksinimler# Environment variables

- Node.js 18+cp .env.example .env

- Docker & Docker Compose

- npm veya yarn# Geliştirme sunucusu

npm run dev

### Kurulum

# Production build

1. **Bağımlılıkları Yükle**npm run build

```bash```

# Backend bağımlılıkları

cd backend## 📝 Environment Variables

npm install

```bash

# Frontend bağımlılıklarıVITE_DEMO_EMAIL=demo@comptario.com

cd ..VITE_DEMO_PASSWORD=demo123

npm installVITE_ENABLE_ENCRYPTION=true

```VITE_ENCRYPTION_KEY=your-key-here

```

2. **Environment Variables**

```bash## 🧪 Test ve Linting

# Backend .env dosyası zaten yapılandırılmış

# Gerekirse backend/.env dosyasını düzenleyin```bash

```# ESLint

npm run lint

3. **Tüm Servisleri Başlat**

```bash# TypeScript check

./start-dev.shnpx tsc --noEmit

```

# Security audit

Bu komut:npm audit

- ✅ PostgreSQL, Redis ve pgAdmin Docker container'larını başlatır```

- ✅ Backend API'yi başlatır (port 3002)

- ✅ Frontend uygulamasını başlatır (port 5173)## 📦 Teknolojiler



### Manuel Başlatma- React 18

- TypeScript

Eğer script kullanmak istemezseniz:- Vite

- Tailwind CSS

```bash- jsPDF / html2canvas

# 1. Docker container'ları başlat- ExcelJS

cd backend- DOMPurify

docker-compose up -d- Lucide Icons



# 2. Backend'i başlat## � Dokümantasyon

npm run start:dev

- **[SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md)** - Güvenlik ve kalite iyileştirmeleri

# 3. Yeni terminal'de Frontend'i başlat- **[MULTI_USER_ROADMAP.md](./MULTI_USER_ROADMAP.md)** - Çok kullanıcılı sistem yol haritası (16 hafta)

cd ..- **[MULTI_USER_QUICKSTART.md](./MULTI_USER_QUICKSTART.md)** - Hızlı başlangıç kılavuzu

npm run dev

```## 🚀 Gelecek Planları



### Servisleri Durdurma### Faz 1: Backend & Multi-Tenancy (4 ay)

Uygulamayı çok kullanıcılı (multi-tenant) SaaS platformuna dönüştürme:

```bash- ✅ NestJS backend API

./stop-dev.sh- ✅ PostgreSQL veritabanı

```- ✅ JWT authentication

- ✅ Multi-tenant mimari

## 📊 Erişim Noktaları- ✅ Real-time updates (WebSocket)

- ✅ Subscription & billing (Stripe)

| Servis | URL | Açıklama |

|--------|-----|----------|Detaylar için: [MULTI_USER_ROADMAP.md](./MULTI_USER_ROADMAP.md)

| Frontend | http://localhost:5173 | React uygulaması |

| Backend API | http://localhost:3002 | NestJS REST API |### Faz 2: İleri Özellikler

| Swagger Docs | http://localhost:3002/api | API dokümantasyonu |- Mobil uygulama (React Native)

| pgAdmin | http://localhost:5050 | PostgreSQL yönetim arayüzü |- Gelişmiş raporlama

- AI destekli finans analizi

### pgAdmin Giriş Bilgileri- Entegrasyonlar (banka, e-fatura, e-arşiv)

- Email: `admin@admin.com`

- Password: `admin`## �📄 Lisans



### Test KullanıcısıMIT

İlk kullanıcınızı frontend'den kayıt olarak oluşturabilirsiniz:

```json## 👨‍💻 Geliştirici

{

  "email": "test@example.com",MustafaBasol
  "password": "123456",
  "firstName": "Test",
  "lastName": "User",
  "companyName": "Test Company"
}
```

## 🏢 Multi-Tenant Özellikler

### Tenant İzolasyonu
- ✅ Row-level security (Satır seviyesi güvenlik)
- ✅ Her tenant için ayrı veri alanı
- ✅ Otomatik tenant context yönetimi
- ✅ Tenant middleware ile istek filtreleme

### Güvenlik
- ✅ JWT-based authentication
- ✅ Role-based access control (RBAC)
- ✅ Password hashing (bcrypt)
- ✅ CORS koruması
- ✅ Request validation
- ✅ XSS koruması (DOMPurify)
- ✅ LocalStorage encryption

## 🔧 Teknoloji Stack

### Backend
- **Framework:** NestJS 11.x
- **Database:** PostgreSQL 15
- **ORM:** TypeORM
- **Authentication:** JWT + Passport
- **Cache:** Redis
- **Validation:** class-validator
- **Documentation:** Swagger/OpenAPI

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **UI Library:** Tailwind CSS
- **Icons:** Lucide React
- **HTTP Client:** Axios
- **State Management:** React Context

### DevOps
- **Containerization:** Docker & Docker Compose
- **Database UI:** pgAdmin 4

## 📝 API Endpoints

### Authentication
```
POST /auth/register    - Yeni kullanıcı kaydı
POST /auth/login       - Kullanıcı girişi
GET  /auth/me          - Mevcut kullanıcı bilgisi
```

### Customers
```
GET    /customers      - Müşteri listesi
POST   /customers      - Yeni müşteri
GET    /customers/:id  - Müşteri detayı
PATCH  /customers/:id  - Müşteri güncelle
DELETE /customers/:id  - Müşteri sil
```

### Suppliers
```
GET    /suppliers      - Tedarikçi listesi
POST   /suppliers      - Yeni tedarikçi
GET    /suppliers/:id  - Tedarikçi detayı
PATCH  /suppliers/:id  - Tedarikçi güncelle
DELETE /suppliers/:id  - Tedarikçi sil
```

### Products
```
GET    /products           - Ürün listesi
POST   /products           - Yeni ürün
GET    /products/low-stock - Stok azalan ürünler
GET    /products/:id       - Ürün detayı
PATCH  /products/:id       - Ürün güncelle
DELETE /products/:id       - Ürün sil
```

## 🧪 Testing

```bash
# Backend unit tests
cd backend
npm run test

# Backend e2e tests
npm run test:e2e

# Test coverage
npm run test:cov
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

- [Backend Durum](./BACKEND_STATUS.md) - Backend geliştirme durumu
- [Frontend Entegrasyon](./FRONTEND_INTEGRATION.md) - Frontend-backend entegrasyon rehberi
- [Multi-User Roadmap](./MULTI_USER_ROADMAP.md) - Çoklu kullanıcı özellik haritası
- [Güvenlik İyileştirmeleri](./SECURITY_IMPROVEMENTS.md) - Güvenlik önlemleri

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

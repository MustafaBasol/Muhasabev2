# Çok Kullanıcılı Sistem - Hızlı Başlangıç

Bu doküman, MoneyFlow Muhasebe'yi çok kullanıcılı bir SaaS platformuna dönüştürmek için hızlı başlangıç kılavuzudur.

## 📚 Detaylı Dokümantasyon

- **[MULTI_USER_ROADMAP.md](./MULTI_USER_ROADMAP.md)** - Tam yol haritası ve teknik detaylar

## 🎯 Hedef

Mevcut single-user React uygulamasını, çok kullanıcılı (multi-tenant) bir SaaS platformuna dönüştürmek.

## 🏗️ Mimari Genel Bakış

```
Frontend (React) → API Gateway → Backend (NestJS) → PostgreSQL
                                      ↓
                                    Redis
```

## 🚀 Hızlı Başlangıç

### 1. Backend Projesi Oluştur (5 dk)

```bash
# NestJS CLI kur
npm i -g @nestjs/cli

# Yeni proje oluştur
mkdir ../backend
cd ../backend
nest new moneyflow-api

# İlk modülleri oluştur
cd moneyflow-api
nest g module auth
nest g module users
nest g module tenants
nest g module customers
```

### 2. Bağımlılıkları Kur (3 dk)

```bash
# Core
npm install @nestjs/typeorm typeorm pg
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @nestjs/config
npm install bcrypt class-validator class-transformer

# Dev dependencies
npm install -D @types/passport-jwt @types/bcrypt
```

### 3. Docker Compose ile Database (2 dk)

```bash
# docker-compose.yml oluştur (MULTI_USER_ROADMAP.md'den kopyala)
docker-compose up -d
```

### 4. Environment Variables

```bash
# .env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=moneyflow
DATABASE_PASSWORD=your_password
DATABASE_NAME=moneyflow_dev

JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=1h

FRONTEND_URL=http://localhost:5173
```

## 📋 Geliştirme Fazları

| Faz | Süre | Durum |
|-----|------|-------|
| 1. Backend Altyapısı | 2 hafta | ⏳ Planlandı |
| 2. Auth & Users | 2 hafta | ⏳ Planlandı |
| 3. Multi-Tenancy | 2 hafta | ⏳ Planlandı |
| 4. Business Logic | 2 hafta | ⏳ Planlandı |
| 5. Frontend Integration | 2 hafta | ⏳ Planlandı |
| 6. Advanced Features | 2 hafta | ⏳ Planlandı |
| 7. Subscription & Billing | 2 hafta | ⏳ Planlandı |
| 8. Testing & Deploy | 2 hafta | ⏳ Planlandı |

**Toplam: 16 hafta (4 ay)**

## 🔧 Teknoloji Yığını

### Backend
- NestJS (TypeScript)
- PostgreSQL
- TypeORM
- Redis
- JWT Authentication

### Frontend (Mevcut)
- React 18
- TypeScript
- Vite
- Tailwind CSS

### Yeni Frontend Dependencies
```bash
npm install @tanstack/react-query axios zustand
npm install react-router-dom
npm install socket.io-client
```

## 📊 İlk Sprint Hedefleri (2 hafta)

### Hafta 1
- [x] Backend projesi kurulumu
- [ ] PostgreSQL connection
- [ ] TypeORM entities (User, Tenant)
- [ ] Authentication endpoints (register, login)
- [ ] JWT implementation

### Hafta 2
- [ ] Tenant middleware
- [ ] Row-level security
- [ ] User CRUD operations
- [ ] API testing
- [ ] Swagger documentation

## 🎓 Öğrenme Kaynakları

### NestJS
- [Official Docs](https://docs.nestjs.com)
- [NestJS Fundamentals Course](https://learn.nestjs.com)

### TypeORM
- [TypeORM Docs](https://typeorm.io)
- [TypeORM with NestJS](https://docs.nestjs.com/techniques/database)

### Multi-Tenancy
- [Multi-Tenancy Best Practices](https://docs.microsoft.com/azure/architecture/patterns/multi-tenancy)

## 💡 Önemli Kararlar

### ✅ Kararlaştırılanlar
1. **Backend Framework**: NestJS (TypeScript consistency)
2. **Database**: PostgreSQL (ACID, relations)
3. **Multi-Tenancy**: Schema-per-tenant (güvenlik & maliyet dengesi)
4. **Auth**: JWT + Refresh tokens
5. **State Management**: Zustand + React Query

### ⏳ Karar Bekleyenler
1. File storage (AWS S3 vs Cloudinary)
2. Email service (SendGrid vs AWS SES)
3. Hosting (AWS vs DigitalOcean vs Render)
4. Payment (Stripe vs Iyzico)

## 📝 Checklist - İlk Gün

- [ ] NestJS projesini oluştur
- [ ] Docker Compose'u çalıştır
- [ ] PostgreSQL'e bağlan
- [ ] İlk entity'i oluştur (User)
- [ ] İlk endpoint'i test et
- [ ] Swagger'ı aç (http://localhost:3000/api)

## 🔗 Faydalı Komutlar

```bash
# Backend çalıştır
npm run start:dev

# Migration oluştur
npm run typeorm migration:generate -- -n InitialSchema

# Migration çalıştır
npm run typeorm migration:run

# Test
npm run test

# Build
npm run build
```

## 🆘 Yardım

Herhangi bir aşamada takılırsanız:

1. [MULTI_USER_ROADMAP.md](./MULTI_USER_ROADMAP.md) - Detaylı rehber
2. Backend klasöründe README.md (oluşturulacak)
3. NestJS Discord community
4. Stack Overflow

## 📈 İlerleme Takibi

Projenin ilerlemesini takip etmek için:

- GitHub Projects kullanın
- Her sprint sonunda retrospektif yapın
- Haftalık standup toplantıları

---

**Hazır mısınız? Hadi başlayalım! 🚀**

```bash
# İlk adım
nest new moneyflow-api
```

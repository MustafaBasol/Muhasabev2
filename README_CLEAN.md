# MoneyFlow Muhasebe v2

Modern, güvenli ve ölçeklenebilir (multi-tenant) muhasebe ve finans yönetim sistemi.

## 🚀 Hızlı Başlangıç

```bash
./start-safe.sh
```

- Frontend ve backend otomatik başlatılır.
- Varsayılan giriş: `admin@test.com` / `Test123456`

Alternatif (geliştirme):
- Backend: `cd backend && npm install && npm run start:dev`
- Frontend (dev): `npm install && npm run dev` (API URL: `VITE_API_URL=http://localhost:3002`)

## 🧭 Mimarinin Özeti

- Backend: NestJS 11 + TypeORM (PostgreSQL, testte SQLite in-memory)
- Frontend: React 18 + TypeScript + Vite + Tailwind
- Kimlik Doğrulama: JWT
- Çoklu Kiracı (Multi-tenant): Tenant izolasyonu ve plan limitleri

## ✨ Öne Çıkan Özellikler

- 👥 Müşteri/Tedarikçi yönetimi
- 🧾 Fatura ve gider yönetimi (KDV hesaplamaları)
- 📦 Ürün yönetimi (kategori/vergiler)
- 🏦 Banka hesapları (Free: 1 hesap limiti)
- 💱 Çoklu para birimi (TRY, USD, EUR)
- 🔐 Güvenlik: RBAC, doğrulama, XSS koruması, CORS

## 📡 API Uç Noktaları (Özet)

- Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- Customers: `GET/POST/PATCH/DELETE /customers`
- Suppliers: `GET/POST/PATCH/DELETE /suppliers`
- Products: `GET/POST/PATCH/DELETE /products`
- Invoices: `GET/POST /invoices`
- Expenses: `GET/POST /expenses`
- Bank Accounts: `GET/POST/PATCH/DELETE /bank-accounts`

Tam dokümantasyon: Swagger — `http://localhost:3002/api`

## 🧪 Testler

- E2E: `cd backend && NODE_ENV=test npm run test:e2e` (in-memory SQLite)
- Birim test: `cd backend && npm test`
- Not: E2E testleri plan limitlerini (müşteri/tedarikçi/fatura/gider ve banka hesabı) doğrular.

## 🧩 Plan Limitleri (Free/Pro/Business)

- Free: sınırlı (örn. banka hesabı: 1, aylık fatura/gider limitleri)
- Pro/Business: genişletilmiş/sınırsız
- Limit aşımlarında API 400 döner ve frontend’de toast ile kullanıcı bilgilendirilir.

Ayrıntılar: `backend/src/common/tenant-plan-limits.service.ts`

## 🛠️ Geliştirme Komutları

```bash
# Backend
cd backend
npm install
npm run start:dev     # watch
npm run test          # unit
npm run test:e2e      # e2e

# Frontend (development)
cd ..
npm install
npm run dev

# Production benzeri tek port
./build-and-deploy.sh  # Frontend build -> backend/public/dist
cd backend && npm run start:prod
```

## 📚 İlgili Dokümanlar

- Banka Hesapları API: `BANK_ACCOUNTS_API.md`
- Kurulum ve Çalıştırma: `BASLATMA.md`
- Güvenlik İyileştirmeleri: `SECURITY_IMPROVEMENTS.md`
- Multi-User Quickstart: `MULTI_USER_QUICKSTART.md`
- Docs indeksi: `DOCS_INDEX.md`

## 📝 Notlar

- Test ortamında (NODE_ENV=test) loglar azaltılmıştır.
- E2E testleri `--runInBand --detectOpenHandles` ile stabil koşturulur.

---

Made with ❤️ using NestJS, React, TypeScript.

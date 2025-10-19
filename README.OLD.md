# MoneyFlow Muhasebe v2

Modern, güvenli ve kullanıcı dostu muhasebe yönetim sistemi.

## 🚀 Özellikler

- 📊 Dashboard ve raporlama
- 👥 Müşteri/Tedarikçi yönetimi
- 🧾 Fatura ve gider yönetimi
- 💰 Satış takibi
- 🏦 Banka hesapları
- 📈 Grafik ve analizler
- 🔐 Güvenli veri saklama
- 📱 Responsive tasarım

## 🛡️ Güvenlik

- ✅ XSS koruması (DOMPurify)
- ✅ LocalStorage encryption
- ✅ Environment variables
- ✅ Sıfır güvenlik açığı
- ✅ TypeScript strict mode

Detaylı bilgi için: [SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md)

## 🔧 Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Environment variables
cp .env.example .env

# Geliştirme sunucusu
npm run dev

# Production build
npm run build
```

## 📝 Environment Variables

```bash
VITE_DEMO_EMAIL=demo@moneyflow.com
VITE_DEMO_PASSWORD=demo123
VITE_ENABLE_ENCRYPTION=true
VITE_ENCRYPTION_KEY=your-key-here
```

## 🧪 Test ve Linting

```bash
# ESLint
npm run lint

# TypeScript check
npx tsc --noEmit

# Security audit
npm audit
```

## 📦 Teknolojiler

- React 18
- TypeScript
- Vite
- Tailwind CSS
- jsPDF / html2canvas
- ExcelJS
- DOMPurify
- Lucide Icons

## � Dokümantasyon

- **[SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md)** - Güvenlik ve kalite iyileştirmeleri
- **[MULTI_USER_ROADMAP.md](./MULTI_USER_ROADMAP.md)** - Çok kullanıcılı sistem yol haritası (16 hafta)
- **[MULTI_USER_QUICKSTART.md](./MULTI_USER_QUICKSTART.md)** - Hızlı başlangıç kılavuzu

## 🚀 Gelecek Planları

### Faz 1: Backend & Multi-Tenancy (4 ay)
Uygulamayı çok kullanıcılı (multi-tenant) SaaS platformuna dönüştürme:
- ✅ NestJS backend API
- ✅ PostgreSQL veritabanı
- ✅ JWT authentication
- ✅ Multi-tenant mimari
- ✅ Real-time updates (WebSocket)
- ✅ Subscription & billing (Stripe)

Detaylar için: [MULTI_USER_ROADMAP.md](./MULTI_USER_ROADMAP.md)

### Faz 2: İleri Özellikler
- Mobil uygulama (React Native)
- Gelişmiş raporlama
- AI destekli finans analizi
- Entegrasyonlar (banka, e-fatura, e-arşiv)

## �📄 Lisans

MIT

## 👨‍💻 Geliştirici

MustafaBasol
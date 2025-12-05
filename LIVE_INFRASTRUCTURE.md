# Live Infrastructure Blueprint

Bu doküman, Comptario (Muhasabev2) uygulamasının şu anda canlıda çalışan kurulumunun ayrıntılı yapısını özetler. İçerik hem kök repo hem de `backend/` klasörü içindeki üretim dosyalarına dayanır.

## 1. Üst Düzey Topoloji

```
Kullanıcı -> CDN/Cloudflare -> Nginx/Caddy (HTTPS) -> Node/NestJS Backend (pm2 veya systemd)
                                     |                                  |
                                     |                                  ├─ Serve Static React Build (backend/public)
                                     |                                  ├─ PostgreSQL 15 (docker, /var/lib/postgresql/data)
                                     |                                  └─ Redis 7 (docker, /var/lib/redis)
                                     └─ Webhook & API entegrasyonları (Stripe, MailerSend, Cloudflare Turnstile)
```

- **Frontend**: Vite + React 18 build’i `build-and-deploy.sh` ile `backend/public/` dizinine kopyalanır; NestJS `@nestjs/serve-static` ile tek porttan sunar.
- **Backend**: NestJS 11 REST API (`backend/package.json`). PM2 (`ecosystem.config.js`) veya `systemd` üzerinden Node 20 LTS ile yönetilir.
- **Veri Katmanı**: PostgreSQL ve Redis konteynerleri `backend/docker-compose.production.yml` ile aynı host üzerinde çalışır; veri klasörleri host’a bind edilir.
- **Arka Plan İşleri**: `kartoza/pg-backup` servisi günlük dump alır; NestJS scriptleri (örn. `npm run cron:retention`) gerektiğinde çalıştırılır.

## 2. Bileşen Detayları

### 2.1 Frontend (React/Vite)
- Kaynak: repo kökü (`App.tsx`, `src/`).
- Build: `npm run build` veya güvenlik denetimli `./build-production.sh`.
- Çıktı: `dist/` klasörü, `build-and-deploy.sh` ile `backend/public/` içine kopyalanır.
- Ortam değişkenleri: `VITE_` prefix’li değerler (`.env.example`).
- Güvenlik: Turnstile komponenti (`src/components/TurnstileCaptcha.tsx`) fail-open fallback ve dev bypass logları içerir.

### 2.2 Backend (NestJS API)
- Giriş noktası: `backend/src/main.ts` (prod’da `main.production.ts`).
- Paketler: Stripe, MailerSend, Redis, TypeORM (PostgreSQL). Bkz. `backend/package.json`.
- Build/deploy: `npm run build` ardından `npm run start:prod`. PM2 konfigürasyonu `ecosystem.config.js`.
- Health: `GET /api/health` (Nginx proxy’si üzerinden `https://<domain>/api/health`).

### 2.3 Veritabanı ve Cache
- **PostgreSQL 15**: `moneyflow_production` DB, kullanıcı `moneyflow_prod`. Volume: `/var/lib/postgresql/data` (bkz. docker compose).
- **Redis 7**: Session/cache, volume `/var/lib/redis`.
- Backup konteyneri `kartoza/pg-backup` her gün 03:00’te dump alıp `backend/backups/` klasörüne yazar, 30 gün saklar.

### 2.4 Reverse Proxy + TLS
- Önerilen: Nginx (`docs/nginx-example.conf`) veya Caddy (`docs/deployment.md`).
- HTTPS Let’s Encrypt/Certbot ile (`DEPLOYMENT_QUICK_REFERENCE.md`).
- Proxy yalnızca 80/443’ü açar; API Node prosesi localhost’ta dinler.

## 3. Dağıtım Akışı

1. Production sunucusunda repo’yu güncelleyin:
   ```bash
   cd /opt/Muhasabev2 && git pull origin main
   ```
2. Ortam dosyalarını güncelleyin (`.env.production`, `backend/.env.production`, `frontend/.env.production`).
3. Frontend’i build edin ve backend’e kopyalayın:
   ```bash
   npm install
   npm run build
   ./build-and-deploy.sh   # dist -> backend/public
   ```
4. Backend bağımlılıkları ve build:
   ```bash
   cd backend
   npm install --production
   npm run build
   pm2 restart ecosystem.config.js --only moneyflow-backend
   ```
   veya `systemctl restart comptario-api`.
5. Docker servislerini güncelleyin:
   ```bash
   cd backend
   DATABASE_PASSWORD=... docker compose -f docker-compose.production.yml up -d postgres redis postgres-backup
   ```
6. DB migration:
   ```bash
   npm run migration:run
   ```
7. Sağlık kontrolleri (`curl https://<domain>/api/health`).

## 4. Ortam Değişkenleri

### 4.1 Frontend (`.env.production` veya hosting paneli)
| Değişken | Amaç |
| --- | --- |
| `VITE_API_URL` | Backend API’nın HTTPS adresi (örn. `https://api.domain.com`). |
| `VITE_APP_NAME`, `VITE_APP_VERSION` | UI metadata.| 
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile public key (zorunlu). |
| `VITE_CAPTCHA_DEV_BYPASS` | Sadece test ortamında `false` bırakılmalı. |
| `VITE_SENTRY_DSN` (opsiyonel) | İstemci izleme. |

### 4.2 Backend (`backend/.env.production`)
Gruplandırılmış önemli değişkenler:
- **Turnstile**: `TURNSTILE_SECRET_KEY`, `TURNSTILE_DEV_BYPASS=false`, `LOGIN_FAILED_CAPTCHA_THRESHOLD`, `TURNSTILE_LOG_VERBOSE`.
- **Veritabanı**: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`.
- **Redis**: `REDIS_HOST`, `REDIS_PORT`.
- **JWT & CSRF**: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`.
- **Mail/SMS**: `MAIL_PROVIDER`, `MAIL_FROM`, `MAILERSEND_API_KEY`, `MAILERSEND_WEBHOOK_SECRET` (bkz. `backend/.env.example`).
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, plan price ID’leri (`STRIPE_PRICE_*`).
- **URLs**: `FRONTEND_URL`, `CORS_ORIGINS` (virgülle). 
- **Rate Limits**: `SIGNUP_RATE_LIMIT`, `FORGOT_RATE_LIMIT` vb.
- **Security Toggles**: `SECURITY_ENABLE_CSP_NONCE`, `ADMIN_ALLOWED_IPS`.

### 4.3 Sunucu Seviyesi
- `/etc/nginx/sites-available/comptario` içindeki domain + TLS sertifikaları.
- `crontab` girdisi: `0 3 * * * /path/to/backend/backup.sh` (manual backup scripti) veya compose backup konteyneri.
- Fail2ban/UFW kuralları: port 22, 80, 443 açık; PostgreSQL/Redis yalnızca localhost.

## 5. Güvenlik & Uyumluluk

- **WAF/CDN**: Cloudflare üzerinden Turnstile ve Bot Fight Mode opsiyonel.
- **Doğrulama**: Turnstile register’da zorunlu, login’de `LOGIN_FAILED_CAPTCHA_THRESHOLD` sonrası devreye girer.
- **Şifre Politikası**: `PASSWORD_MIN_LENGTH=12`, `PASSWORD_MIN_SCORE=3` (`backend/.env.example`).
- **Veri Saklama**: `scripts/data-retention.ts` periyodik çalıştırma için cron tanımlanabilir.
- **CSP & Güvenlik Başlıkları**: `main.production.ts` Helmet + opsiyonel nonce.
- **Loglar**: PM2 logları `/var/log/comptario/*.log` (konfigüre edilebilir); Nginx access/error logları inceleme için `tail -f`.

## 6. İzleme & Operasyon

| Kontrol | Komut |
| --- | --- |
| API sağlık | `curl https://<domain>/api/health` |
| PM2 durumu | `pm2 status` / `pm2 logs moneyflow-backend` |
| Docker servisleri | `docker ps`, `docker compose -f backend/docker-compose.production.yml logs -f postgres` |
| Postgres bağlantısı | `psql -h localhost -U moneyflow_prod -d moneyflow_production -c "select now();"` |
| Redis ping | `redis-cli -h 127.0.0.1 ping` |
| Disk kullanımı | `df -h /var/lib/postgresql/data` |

Opsiyonel entegrasyonlar: UptimeRobot/Healthchecks.io (health endpoint poll), Sentry/Elastic (log shipping).

## 7. Backup & Felaket Kurtarma

- Otomatik: `postgres-backup` konteyneri `backend/backups/` altında `.sql.gz` üretir (30 gün).
- Manuel: `backend/backup-db.sh` ve `restore-db.sh` scriptleri.
- Geri yükleme:
  ```bash
  gunzip backups/db_backup_YYYYMMDD_HHMMSS.sql.gz
  psql -h localhost -U moneyflow_prod -d moneyflow_production < db_backup_YYYYMMDD_HHMMSS.sql
  ```
- Redis snapshotları `/var/lib/redis` altında; gerekli ise kapalıyken kopyalayın.

## 8. Doğrulama Kontrol Listesi

1. `git status` temiz, `git rev-parse HEAD` ile release commit’i not edilir.
2. `npm run lint && npm run test` (backend için `npm run test:e2e`) deployment öncesi.
3. `./scripts/security-verify.sh` dist içinde gizli bilgi olmadığını doğrular.
4. Nginx test: `sudo nginx -t && sudo systemctl reload nginx`.
5. Sertifika yenileme provası: `sudo certbot renew --dry-run`.
6. Turnstile testi: Register sayfası token üretip backend’de `TurnstileService` log’larında `success` görülür.
7. Stripe webhook: `stripe trigger payment_intent.succeeded` (test modunda) -> backend `WEBHOOK_STRIPE_RATE_LIMIT` loglamalı.
8. Backup dosyası var mı?: `ls backend/backups | tail`.

## 9. Referans Dosyalar

- `PRODUCTION_DEPLOYMENT.md`, `DEPLOYMENT_QUICK_REFERENCE.md`
- `ENVIRONMENT_SECURITY_SUMMARY.md`
- `backend/docker-compose.production.yml`
- `scripts/security-verify.sh`, `build-production.sh`, `build-and-deploy.sh`
- `docs/nginx-example.conf`, `docs/deployment.md`

Bu şablon canlı ortama ait kritik detayları tek dosyada toplar. Makinede inceleme yapmak için ihtiyaç duyduğunuz komutları (örn. `df -h`, `docker ps`, `pm2 status`) çalıştırabilir ve çıktıları bu dokümana ekleyebilirsiniz.

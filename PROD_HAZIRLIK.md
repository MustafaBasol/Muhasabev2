# Üretime Geçiş Hazırlık Dokümanı (PROD)

Bu doküman, Comptario uygulamasını üretim ortamına taşırken değiştirmeniz gereken ayarları ve izlenmesi önerilen adımları özetler. Aşağıdaki kontrol listesi ve detaylı açıklamalar, mevcut kod tabanı ve yapılandırmalar dikkate alınarak hazırlanmıştır.

---

## Hızlı Kontrol Listesi

- [ ] Güçlü ve benzersiz JWT anahtarları (erişim + yenileme) tanımlandı
- [ ] Veritabanı (PostgreSQL) ve Redis prod sunucularında hazır ve erişilebilir
- [ ] `backend/.env.production` dosyası oluşturuldu ve kritik değişkenler dolduruldu
- [ ] CORS izinli alan adları prod domain(ler)i ile güncellendi
- [ ] `FRONTEND_URL` prod alan adıyla (e-postalarda kullanılan) güncellendi
- [ ] Admin için düz şifre devre dışı, `ADMIN_PASSWORD_HASH` (bcrypt) kullanılıyor
- [ ] E-posta doğrulaması zorunlu (önerilir): `EMAIL_VERIFICATION_REQUIRED=true`
- [ ] Veritabanı migration’ları çalıştırıldı (idempotent)
- [ ] Uygulama prod modda başlatıldı (Node/PM2) ve reverse proxy (Nginx) üzerinden HTTPS sağlandı
- [ ] Gecelik veritabanı yedekleri aktif (docker-compose.production ile)
- [ ] Loglama, izleme ve uyarılar (disk, CPU, bellek) ayarlandı

---

## Ortam Değişkenleri (backend/.env.production)
Aşağıdaki değişkenler mevcut `backend/.env` temel alınarak PROD için önerilen değerlerle güncellenmelidir.

### Veritabanı (PostgreSQL)
- `DATABASE_HOST` = prod DB host (ör. `10.0.0.12` veya `db.internal`)
- `DATABASE_PORT` = 5432 (veya kullandığınız özel port)
- `DATABASE_USER` = `moneyflow_prod`
- `DATABASE_PASSWORD` = ÜRETİM İÇİN GÜÇLÜ ŞİFRE
- `DATABASE_NAME` = `moneyflow_production`

Not: `backend/docker-compose.production.yml` dosyası PostgreSQL için hazırdır. Host’a kalıcı volume bağları içerir.

### Redis
- `REDIS_HOST` = prod Redis host (ör. `10.0.0.13`)
- `REDIS_PORT` = 6379 (veya özel port)

### JWT (Kritik)
- `JWT_SECRET` = Güçlü, uzun, benzersiz bir gizli anahtar
- `JWT_EXPIRES_IN` = `15m` (ihtiyaca göre)
- `JWT_REFRESH_SECRET` = Erişim anahtarından farklı, güçlü bir gizli anahtar
- `JWT_REFRESH_EXPIRES_IN` = `7d` (ihtiyaca göre)

### Admin Kimlik Bilgileri
- `ADMIN_USERNAME` = prod kullanıcı adı
- `ADMIN_PASSWORD` = (PROD’DA KULLANMAYIN) — geliştirime özel
- `ADMIN_PASSWORD_HASH` = bcrypt hash (PROD’da bunu kullanın)
  - Not: Hash üretimi için yerel bir ortamda bcrypt aracı veya küçük bir betik kullanabilirsiniz.

### Uygulama
- `PORT` = 3000 (reverse proxy arkasında)
- `NODE_ENV` = `production`

### CORS
- `CORS_ORIGIN` = `https://app.sizin-domaininiz.com` (gerekirse çoklu domain virgülle)
- `CORS_CREDENTIALS` = `true` (tarayıcı oturum çerezleri kullanılıyorsa)

### E-posta ve Linkler
- `FRONTEND_URL` = `https://app.sizin-domaininiz.com` (E-posta doğrulama/şifre sıfırlama/davet linklerinde kullanılır; SPA hash route’larıyla uyumlu)
- `EMAIL_VERIFICATION_REQUIRED` = `true` (önerilir)

### Güvenlik Webhook (opsiyonel)
- `SECURITY_WEBHOOK_URL` = Güvenlik uyarıları/olayları için webhook (Slack/Teams vb.)

> Not: Şu an `EmailService` gerçek gönderim yerine log’a yazan simülasyon kullanıyor. PROD için bir sağlayıcı (SendGrid, AWS SES, SMTP/Nodemailer vb.) entegre edilmesi önerilir.

---

## Veritabanı, Redis ve Yedekleme

- PostgreSQL ve Redis’i prod sunucularınızda çalıştırın. İsterseniz mevcut `backend/docker-compose.production.yml` ile sadece veritabanı/redis + otomatik backup servislerini ayağa kaldırabilirsiniz.
- Otomatik yedekleme (`postgres-backup` servisi) her gün saat 03:00’te çalışacak şekilde yapılandırılmıştır ve 30 günlük saklama hedefler.
- Kalıcı klasörler host’ta bağlanmıştır (örn. `/var/lib/postgresql/data`, `/var/lib/redis`, `./backups`). Bu dizinlerin izinlerini ve disk alanını kontrol edin.

---

## Migrasyonlar (Idempotent)

- Uygulama ilk kez başlatılmadan önce üretim veritabanında migration’ları çalıştırın:
  - `cd backend`
  - `npm ci && npm run build`
  - `npm run migration:run`
- Migration’lar mevcut şemayla çakışmaları önlemek için idempotent tasarlandı; tekrar çalıştırmak güvenlidir.

---

## Uygulamayı Başlatma (Prod)

- Node ile doğrudan:
  - `cd backend && npm ci && npm run build && npm run start:prod`
- PM2 ile servis olarak (önerilir):
  - `pm2 start npm --name moneyflow-backend -- start:prod`
  - `pm2 save && pm2 startup` (sunucu reboot sonrası otomatik başlatma)
- Loglar: `logs/backend*.log` (PM2 konfigürasyonlarınıza göre değişebilir)

> Not: Reverse proxy (Nginx/Traefik) arkasında çalıştırmanız ve HTTPS zorunlu kılmanız tavsiye edilir.

---

## Reverse Proxy ve HTTPS (Özet)

- Nginx üzerinde 443/HTTPS dinlenirken backend’e `http://127.0.0.1:3000` yönlendirme yapın.
- `Cache-Control` başlıkları statik dosyalar için backend tarafından zaten ayarlanıyor; proxy katmanında ek gzip/brotli etkinleştirilebilir.
- `CORS_ORIGIN` ve `FRONTEND_URL` değerlerinin public domain ile uyumlu olduğundan emin olun.

---

## E-posta Akışları (Doğrulama, Sıfırlama, Davet)

- Linkler SPA hash route kullanır: `FRONTEND_URL/#verify-email?token=...` vb.
- Test ortamında e-posta doğrulama zorunluluğu bypass edilir; PROD’da `EMAIL_VERIFICATION_REQUIRED=true` ile giriş öncesi doğrulama önerilir.
- Şu an e-postalar simüle edilip log’lanıyor. PROD’ta gerçek gönderim için bir sağlayıcı ekleyin ve ilgili kimlik bilgilerini güvenli şekilde yönetin.

---

## Güvenlik ve Performans

- Helmet ve rate limiting (Throttler) aktif; proxy arkasında gerçek IP bilgisini ilettiğinizden emin olun (X-Forwarded-For).
- HTTP sıkıştırma (compression) backend’de etkin; reverse proxy katmanında gzip/brotli açılabilir.
- Statik varlıklar için cache başlıkları (max-age) ayarlı. Hash’li dosyalar için immutable önerisi uygulanır.
- JWT ve admin şifreleri için güçlü gizli anahtarlar şarttır. Sırlar asla repoya/imagelara gömülmemelidir.

---

## İzleme, Loglama ve Uyarılar

- PM2, sistemd veya konteyner seviyesinde yeniden başlatma ve log toplama stratejileri belirleyin.
- Disk doluluk, CPU, bellek ve dosya tanımlayıcı limitlerini izleyin.
- `SECURITY_WEBHOOK_URL` kullanarak kritik olaylar için uyarı entegrasyonu düşünebilirsiniz.

---

## Yedekleme ve Felaket Kurtarma

- Gecelik yedeklerin alındığını ve yazılabilir disk alanının yeterli olduğunu doğrulayın.
- Periyodik olarak geri yükleme (restore) denemesi yaparak çalıştığını teyit edin.

---

## Son Kontroller (Opsiyonel ama önerilir)

- CI/CD veya hazırlık sunucusunda aşağıdakileri koşturun:
  - Backend build: `cd backend && npm ci && npm run -s build`
  - Lint: `npm run -s lint`
  - E2E: `npm run -s test:e2e` (env koşullarına göre ayarlayın)

---

## Ek: Bcrypt Hash Üretimi (Opsiyonel)

- Yerel makinenizde bir kez üretip `ADMIN_PASSWORD_HASH` olarak kullanabilirsiniz. Örnek Node.js tek satır (opsiyonel):
  
  ```bash
  node -e "(async()=>{const bcrypt=require('bcrypt');const p=process.argv[1]||'StrongP@ss!123';const h=await bcrypt.hash(p,12);console.log(h)})('SIFRENIZ')"
  ```

> Önemli: Hash’ı güvenli şekilde saklayın; düz şifreyi `.env` içinde kullanmayın.

---

Bu checklist’i tamamladığınızda uygulama üretim ortamında güvenli ve performanslı şekilde çalışmaya hazır olacaktır. Gerektiğinde bu dosyayı genişletebilir veya kurum içi runbook’unuza entegre edebilirsiniz.

# Email Doğrulama ve Şifre Sıfırlama (MailerSend)

Bu dosya, e-posta akışlarının nasıl çalıştığını, hangi ortam değişkenlerinin gerekli olduğunu ve sandbox ortamında nasıl test edileceğini özetler.

## Gerekli Ortam Değişkenleri

- MAIL_PROVIDER=mailersend | smtp | log (varsayılan: log)
- MAIL_FROM=Compario <noreply@comptario.com> (MailerSend domain'inizde doğrulanmalı)
- MAILERSEND_API_KEY=xxx (MAIL_PROVIDER=mailersend için)
- MAILERSEND_WEBHOOK_SECRET=opsiyonel paylaşılan gizli anahtar (bounce/complaint webhooku)
- FRONTEND_URL=https://app.comptario.com (veya dev için http://localhost:5174)
- FRONTEND_VERIFY_PATH=/#verify-email (opsiyonel; hash yerine tam yol gerekiyorsa /auth/verify olarak değiştir)
- EMAIL_VERIFICATION_REQUIRED=true
- VERIFICATION_TOKEN_TTL_HOURS=24
- RESET_TOKEN_TTL_MINUTES=60
- RESEND_COOLDOWN_SECONDS=60
- PASSWORD_MIN_LENGTH=12
- PASSWORD_MIN_SCORE=3 (şimdilik sadece min length enforced)
- SIGNUP_RATE_LIMIT=5
- FORGOT_RATE_LIMIT=5

> Not: ACCESS KEY/SECRET anahtarlarını .env içinde tutmayın; GitHub Secrets, IAM Role veya host ortamına koyun.

## Akışlar

### Kayıt / Signup
- Endpoint: `POST /auth/signup` (veya `/auth/register`)
- İşlem: Kullanıcı + tenant oluşturulur, doğrulama token'ı tabloya yazılır, e-posta ile link gönderilir.
- Link: `${FRONTEND_URL}/#verify-email?token=RAW&u=USER_ID` (veya FRONTEND_VERIFY_PATH override değeri)
- TTL: `VERIFICATION_TOKEN_TTL_HOURS`

### E-posta Doğrulama
- Endpoint: `GET /auth/verify?token=RAW&u=USER_ID`
- Frontend yönlendirmesi varsayılan olarak `/#verify-email` hash rotasına yapılır; hash tabanlı olmayan dağıtımlarda `FRONTEND_VERIFY_PATH` ortam değişkenini gerçek yol ile değiştirin.
- İşlem: Token SHA-256 eşleşmesi timing-safe ile yapılır, başarılıysa kullanıcı doğrulanır, diğer bekleyen tokenlar invalid edilir, audit log yazılır.

### Şifremi Unuttum / Reset
- Endpoint: `POST /auth/forgot` (legacy: `/auth/forgot-password`)
- İşlem: Reset token'ı tabloya yazılır ve e-posta gönderilir.
- Link: `${FRONTEND_URL}/auth/reset?token=RAW&u=USER_ID`
- TTL: `RESET_TOKEN_TTL_MINUTES`

### Şifre Sıfırla
- Endpoint: `POST /auth/reset` (legacy: `/auth/reset-password`)
- İşlem: Token doğrulanır; başarılıysa şifre güncellenir ve diğer tokenlar invalid edilir.

## Rate Limit
- Global: 1 dakika penceresinde varsayılan 5 istek/IP.
- Route bazlı override:
  - `SIGNUP_RATE_LIMIT` (`/auth/signup`)
  - `FORGOT_RATE_LIMIT` (`/auth/forgot`)
  - `RESET_RATE_LIMIT` (`/auth/reset`)
  - `VERIFY_RATE_LIMIT` (`/auth/verify`)
  - `RESEND_RATE_LIMIT` (`/auth/resend-verification`)

## Resend Cooldown
- `RESEND_COOLDOWN_SECONDS`: Aynı e-posta için bu süre içinde tekrar `POST /auth/resend-verification` yapılırsa yeni mail üretilmez; response `{ success: true }` döner.

## Sağlık (Health) Kontrolü
- Endpoint: `GET /health/email`
- Dönen alanlar: `provider`, `from`, `frontendUrl`, `verificationRequired`, `note` (MailerSend setup notu)

## Bounce/Complaint İzleme
MailerSend bounce/complaint webhook entegrasyonu için `backend/MAILERSEND_WEBHOOKS.md` dokümanını takip edin. Webhook, `MAILERSEND_WEBHOOK_SECRET` ile korunabilir.

## Sağlayıcıya Özgü Notlar

### MailerSend
1. `MAIL_PROVIDER=mailersend` seçin ve `MAILERSEND_API_KEY` değerini (Domains → API tokens) sunucu ortamına ekleyin.
2. `MAIL_FROM` içindeki domain MailerSend’de doğrulanmış (`sender identities`).
3. `MAILERSEND_WEBHOOK_SECRET` belirleyip MailerSend dashboard'unda webhook oluşturun ve `POST /webhooks/mailersend/events` adresine yönlendirin.
4. `POST /auth/signup` isteği sonrası loglarda `[MAILERSEND EMAIL SENT]` çıktısını görmelisiniz.

## Notlar
- SPF/DKIM/DMARC kayıtlarını MailerSend yönergelerine göre tamamlayın ve gönderim oranlarına alarm kurun.

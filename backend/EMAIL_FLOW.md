# Email Doğrulama ve Şifre Sıfırlama (SES + Sandbox)

Bu dosya, e-posta akışlarının nasıl çalıştığını, hangi ortam değişkenlerinin gerekli olduğunu ve sandbox ortamında nasıl test edileceğini özetler.

## Gerekli Ortam Değişkenleri

- MAIL_PROVIDER=ses | smtp | log (varsayılan: log)
- MAIL_FROM=Compario <noreply@comptario.com> (SES'te doğrulanmış olmalı)
- AWS_REGION=eu-central-1
- FRONTEND_URL=https://app.comptario.com (veya dev için http://localhost:5174)
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
- Link: `${FRONTEND_URL}/auth/verify?token=RAW&u=USER_ID`
- TTL: `VERIFICATION_TOKEN_TTL_HOURS`

### E-posta Doğrulama
- Endpoint: `GET /auth/verify?token=RAW&u=USER_ID`
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
- Dönen alanlar: `provider`, `from`, `region`, `frontendUrl`, `verificationRequired`, `note` (sandbox notu)

## Bounce/Complaint İzleme
SES gönderimleri için bounce/complaint olaylarını izlemek ve suppression listesi yönetimi için SNS entegrasyonu önerilir. Kurulum ve örnek kod için bkz: `backend/SES_SNS_BOUNCE_COMPLAINT.md`.

## Sandbox Test Adımları
1. `MAIL_PROVIDER=ses` ve gerekli AWS anahtarları host ortamında ayarlı olmalı; SES domain/adres verify bekleyebilir.
2. `POST /auth/signup` ile bir kullanıcı oluşturun — backend loglarında `[SES EMAIL SENT]` veya sandbox nedeniyle hata/log görürsünüz.
3. Tarayıcıdan gönderilen linki açın: `/auth/verify?token=...&u=...` — başarılıysa `{ success: true }`.
4. `POST /auth/forgot` ile şifre sıfırlama e-postasını tetikleyin; linki `/auth/reset` üzerinde test edin.

## Notlar
- Üretimde SES sandbox'tan çıkmak şarttır; aksi halde yalnızca doğrulanmış alıcılara iletir.
- SPF/DKIM/DMARC kayıtlarını tamamlayın ve gönderim oranlarına alarm kurun.

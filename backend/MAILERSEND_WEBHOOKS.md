# MailerSend Webhook Entegrasyonu

Bu doküman, MailerSend üzerinden alınan bounce/complaint/unsubscribe olaylarını nasıl Comptario backend'ine ileteceğinizi özetler. Amaç, `EmailSuppression` tablosunu otomatik güncelleyerek problemli adreslere e-posta göndermeyi durdurmaktır.

## 1) MailerSend Dashboard Ayarları

1. MailerSend → **Domains** bölümünde gönderen domain'inizin doğrulandığından emin olun (SPF + DKIM + DMARC kayıtları tamamlanmalı).
2. **Webhooks** sekmesine gidip yeni bir webhook oluşturun.
3. Event seçiminde en azından aşağıdakileri işaretleyin:
   - `activity.hard_bounced`
   - `activity.soft_bounced`
   - `activity.complained`
   - `activity.spam_complaint`
   - `activity.unsubscribed`
4. Webhook URL'si olarak `https://api.yourdomain.com/webhooks/mailersend/events` (veya ilgili ortam URL'si) değerini girin.
5. "Signing secret" ya da "shared secret" alanına güçlü bir değer yazın. Aynı değeri sunucu tarafında `MAILERSEND_WEBHOOK_SECRET` ortam değişkenine set edin.

## 2) Backend Ortam Değişkenleri

```dotenv
MAIL_PROVIDER=mailersend
MAILERSEND_API_KEY=your_api_token
MAILERSEND_WEBHOOK_SECRET=the_same_value_defined_in_mailersend
```

`MAILERSEND_WEBHOOK_SECRET` opsiyoneldir ancak üretim ortamında zorunlu tutulmalıdır. Header uyumsuzluğu durumunda webhook çağrısı 200 yerine `{ ok: false, error: 'unauthorized' }` döner.

## 3) Endpoint Detayları

- URL: `POST /webhooks/mailersend/events`
- Content-Type: `application/json`
- Gövde: MailerSend'in gönderdiği event nesneleri (tek bir nesne veya dizi).
- Header Koruması: Controller aşağıdaki header'lardan ilkini kullanır: `x-mailersend-signature`, `x-mailersend-secret`, `x-mailersend-token`, `x-shared-secret`.

### Örnek Payload

```json
[
  {
    "type": "activity.hard_bounced",
    "data": {
      "email": "blocked@example.com",
      "reason": "mailbox_full"
    }
  }
]
```

### Yanıt

Başarılı istekte:

```json
{ "ok": true, "suppressed": 1 }
```

Hatalı shared secret:

```json
{ "ok": false, "error": "unauthorized" }
```

## 4) Suppression Mantığı

- Desteklenen türler `activity.hard_bounced`, `activity.soft_bounced`, `activity.complained`, `activity.spam_complaint`, `activity.unsubscribed`.
- Tür `activity.*` ile başlayıp içinde `bounced` veya `complaint` geçen diğer event'ler de otomatik olarak suppression'a eklenir.
- E-posta adresi `data.email`, `data.recipient.email` veya `data.to[0].email` alanlarından okunur ve küçük harfe çevrilir.
- Veritabanında aynı adres varsa `INSERT ... ON CONFLICT DO NOTHING` uygulanır.

## 5) Test Önerileri

1. MailerSend webhook sayfasında **Send test** butonunu kullanın ve `activity.hard_bounced` türünü seçin.
2. Backend loglarında `webhooks/mailersend` isteğini ve suppression kaydını doğrulayın.
3. `email_suppression` tablosunda ilgili e-posta adresinin `reason=mailersend:activity.hard_bounced` olarak oluştuğunu kontrol edin.
4. Aynı adrese tekrar e-posta göndermeyi deneyin; `EmailService` suppression kontrolü sayesinde gönderim atlanacaktır.

## 6) Güvenlik Tavsiyeleri

- Webhook URL'sini yalnızca HTTPS üzerinden yayınlayın.
- Shared secret'ı sık aralıklarla yenileyin ve sadece secret store üzerinden dağıtın.
- MailerSend IP allowlist'i gerekiyorsa firewall seviyesinde kısıtlama ekleyin.
- Loglarda PII tutulmaması için suppression nedenleri kısa tutulur (`mailersend:activity.*`).

Bu kurulum ile Amazon SES / SNS bağımlılığı olmadan bounce yönetimi sürdürülebilir ve yasal gereksinimler (örn. KVKK/GDPR) için "opt-out" kayıtları merkezi olarak tutulur.

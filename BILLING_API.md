## Billing & Abonelik API Özeti

Bu doküman Stripe tabanlı abonelik ve faturalama entegrasyonunun hızlı referansını sunar.

### Ortam Değişkenleri

Gerekli fiyat kimlikleri ve anahtarlar:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
STRIPE_PRICE_ADDON_USER_MONTHLY=price_...
STRIPE_PRICE_ADDON_USER_YEARLY=price_...
```

### Backend Endpoint’leri

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/api/billing/checkout` | Plan yükseltme/düşürme + koltuk (addon) adedi ile Stripe Checkout oluşturur |
| GET | `/api/billing/:tenantId/portal` | Stripe Müşteri Portalı oturumu oluşturur |
| POST | `/api/billing/:tenantId/seats` | Mevcut abonelikte addon kullanıcı sayısını günceller |
| POST | `/api/billing/:tenantId/cancel` | Dönem sonunda iptal işaretler |
| GET | `/api/billing/:tenantId/invoices` | Stripe faturalarını listeler (sadelestirilmiş) |
| GET | `/api/billing/:tenantId/history` | Plan + fatura bazlı sadeleştirilmiş olay geçmişi |
| POST | `/api/webhooks/stripe` | Stripe webhook (imza doğrulama için raw body) |

Tüm billing endpointleri JWT ile korunur ve kullanıcı tenantId eşleşmesi yapılır.

### Frontend API Kullanımı (`src/api/billing.ts`)

```ts
createCheckoutSession({ tenantId, plan: 'professional', interval: 'month', seats: 2, successUrl, cancelUrl })
createPortalSession(tenantId, returnUrl)
updateSeats(tenantId, seats)
cancelSubscriptionAtPeriodEnd(tenantId)
listInvoices(tenantId)
listHistory(tenantId)
```

`seats` yalnızca addon kullanıcı sayısıdır; toplam kullanıcı limiti = baz dahil koltuk + addon koltukları.
Baz dahil koltuklar: FREE/BASIC=1, PRO=3, BUSINESS=10.

### Plan & Interval Eşlemeleri

- `professional` ↔ PRO fiyatları
- `enterprise` (business) ↔ BUSINESS fiyatları
- Add-on kullanıcı: `ADDON_USER` fiyatları
- Interval: `month` veya `year`

### Plan Değişiminde Koltuk Migrasyonu (Otomatik)

Pro → Business veya Business → Pro geçişlerinde sistem mevcut toplam koltuk sayısını (eski baz + eski addon) korumak için addon miktarını yeniden hesaplar:

Formül:
```
prevTotalSeats = oldBaseIncluded + oldAddonQty
newAddonQty = max(0, prevTotalSeats - newBaseIncluded)
```

Örnekler:
- Pro (3 baz) + 2 addon = 5 toplam → Business (10 baz) ⇒ addon=0 (ödenen fazladan 2 düşer)
- Pro (3 baz) + 12 addon = 15 toplam → Business (10 baz) ⇒ addon=5 (yalnızca 5 için ödeme)
- Business (10 baz) + 4 addon = 14 toplam → Pro (3 baz) ⇒ addon=11 (toplam koltuk kaybı yaşanmaz)

Manual override: `updatePlanAndInterval` çağrısında `seats` paramı gönderilirse migrasyon mantığı yerine explicit addon qty kabul edilir.

### Webhook Olayları

Aşağıdaki Stripe event’leri işlenir:

- `checkout.session.completed`
- `customer.subscription.created|updated|resumed|paused|deleted`

Her olayda `BillingService.applySubscriptionUpdateFromStripe` çağrılır ve Tenant kaydı güncellenir:

```ts
tenant.subscriptionPlan
tenant.stripeSubscriptionId
tenant.billingInterval
tenant.subscriptionExpiresAt
tenant.maxUsers (baseIncludedUsers(plan) + addon seats)
tenant.cancelAtPeriodEnd
```

### İptal Senaryosu

`/billing/:tenantId/cancel` çağrısı aboneliği `cancel_at_period_end = true` yapar; kullanıcı dönem sonuna kadar aktif kalır.

### Fatura Listesi Veri Şeması

```ts
type BillingInvoiceDTO = {
  id: string;
  number?: string | null;
  status?: string | null;
  currency?: string | null;
  total?: number | null; // minor units
  hostedInvoiceUrl?: string | null;
  pdf?: string | null;
  created?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  attemptCount?: number | null;
  paid?: boolean | null;
}
```

### UI Entegrasyonu (Plan Sekmesi)

`SettingsPage` içinde Plan sekmesi:
1. Kaydet → değişim durumuna göre Checkout, seat update veya iptal at period end.
2. Ödemeleri Yönet → Stripe Portal.
3. Faturalarım tablosu → `listInvoices()` sonuçları (View/PDF).

### Hızlı Test

1. PRO planına geçiş: `createCheckoutSession` ile redirect.
2. Seat artırımı: `/billing/:tenantId/seats` → maxUsers güncellenir.
3. İptal: `/billing/:tenantId/cancel` → cancelAtPeriodEnd true.
4. Webhook sahte çağrı: Stripe CLI ile `stripe trigger invoice.created` vb.

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

### Güvenlik Notları

- Webhook route raw body kullanır; JSON parser öncesi tanımlandı.
- Rate limit SkipThrottle ile devre dışı (Stripe retry engellemek için).
- CSRF koruması webhook ve billing için uygulanmıyor (JWT + signature).

### Geliştirme Önerileri

- Fatura detayını genişletmek için `expand` alanlarına subscription veya charge eklenebilir.
- History bölümü gerçek Stripe event loguna geçebilir (invoices + subscription geçmişi).
- Downgrade için daha gelişmiş plan limit enforcement senaryoları eklenebilir.

---
Son güncelleme: 2025-11-10

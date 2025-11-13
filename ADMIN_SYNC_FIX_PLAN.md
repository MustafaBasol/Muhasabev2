# Admin Panel Kullanıcı Sayısı & Fatura Senkronu Kalıcı Çözüm Planı

Bu dosya, yeni konuşmada doğrudan uygulanacak adımları içerir. Amaç: Pro plan (ve addon seat) güncellemeleri ile Stripe abonelik değişikliklerinin *anında* admin panelde yansıması ve fatura geçmişinin tutarlı görünmesi.

## Seçilen Kalıcı Çözüm
**Otomatik Stripe Senkron + Tutarsızlık Düzeltici (Reconciler)**: Admin tarafında limitler veya faturalar istenirken, veri tutarsız ise backend otomatik olarak `syncFromStripe` çağırıp `tenant.maxUsers`, `stripeSubscriptionId`, `billingInterval` ve fatura bilgisini günceller; UI ek bir manuel senkrona ihtiyaç duymaz.

## Neden Bu Çözüm?
- Webhook gelmemesi (local/dev) durumunda kullanıcı ekleme veya plan değişikliği admin panelde görünmüyor.
- Kullanıcı tarafı local state ile güncel seat sayısını gösterebilir; admin ise DB eski kaldığı için farklı gösterir.
- Manuel `/billing/:id/sync` çağrısı unutuluyor.

## Hedef Davranış
1. `GET /api/admin/tenant/:tenantId/limits` veya `.../overview` çağrıldığında:
   - Eğer `tenant.stripeCustomerId` var VE (`tenant.stripeSubscriptionId` yok **veya** `effective.maxUsers < tenant.maxUsers` **veya** `usage.users > tenant.maxUsers`) ise otomatik `billingService.syncFromStripe(tenantId)` tetiklenir, sonuç tekrar okunur.
2. `GET /api/admin/tenant/:tenantId/invoices` çağrısında:
   - `stripeCustomerId` var ama dönen invoice sayısı 0 ve kullanıcı endpointi (aynı tenant & aynı JWT) >0 ise önce `syncFromStripe`, sonra tekrar `listInvoices`.
3. Her otomatik senkron tetiklenmesinde structured log:
   - `ADMIN_SYNC trigger tenant=<id> reason=<mismatch|missing-sub|invoice-empty>`
   - Başarılı ise `ADMIN_SYNC success maxUsers=<n> sub=<subId>`

## Uygulanacak Adımlar (Sıralı)
1. Tanılama (konuşma başlangıcında):
   - `GET /api/admin/tenant/<TENANT_ID>/debug` (mevcut dosyada ekli endpoint) çıktısını kaydet.
   - `POST /api/billing/<TENANT_ID>/sync` (Authorization: Bearer user JWT) sonucu kaydet.
   - Farkları not et (özellikle maxUsers ve invoiceCount).
2. Ortam Değişkenlerini Doğrula:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`
   - `STRIPE_PRICE_ADDON_USER_MONTHLY`, `STRIPE_PRICE_ADDON_USER_YEARLY`
   - `STRIPE_WEBHOOK_SECRET` (webhook devde gerekmeyebilir; yoksa reconciler kritik)
3. Reconciler Kodlarını Ekle:
   - `admin.service.ts#getTenantLimits` içinde mismatch kontrolü ve otomatik sync.
   - `admin.controller.ts#listTenantInvoices` içinde boş + müşteri var senaryosu için sync tetikleme.
   - Gerekirse yeni yardımcı: `AdminSyncHelper` sınıfı (ör. `backend/src/admin/admin-sync.helper.ts`).
4. Opsiyonel Yeni Endpoint:
   - `GET /api/admin/tenant/:tenantId/subscription-raw` → Stripe subscription items (id, price, quantity) ve hesaplanan seats.
5. Kullanıcı Faturaları Fallback Birleştirme:
   - Admin invoices boş + user token mevcut + aynı tenant ise user faturalarını admin cevabına ek `source: 'user-fallback'` field ile.
6. Log Yapısı:
   - Kullan `Logger` ile: `logger.verbose(JSON.stringify({ tag:'ADMIN_SYNC', tenantId, reason, before:{maxUsers, usageUsers}, after:{maxUsers:newVal} }))`
7. Test Senaryoları:
   - Upgrade plan + addon 2 seat → webhook gelmiyorsa bile admin overview anında 5 görmeli.
   - Addon artır 1 → admin limits çağrısı sonrası maxUsers artmalı.
   - Invoice oluştuğunda admin invoices tekrar çağrısında dolu gelmeli.
8. Dokümantasyon Güncellemesi:
   - `PROD_HAZIRLIK.md` veya yeni `ADMIN_SYNC_FIX_PLAN.md` (bu dosya) içine "Reconciler Mantığı" bölümü ekleyip kalıcı prosedürü yaz.

## Kod Değişikliği Özet Taslağı (Uygulama Anında Referans)
- admin.service.ts
```ts
async getTenantLimits(tenantId: string) {
  const tenant = await repo.findOne(...);
  const usage = ... // aktif kullanıcı sayısı
  const effectiveBefore = ...
  const needSync = tenant.stripeCustomerId && (
     !tenant.stripeSubscriptionId || usage.users > tenant.maxUsers || (effectiveBefore.maxUsers ?? 0) < tenant.maxUsers
  );
  if (needSync) {
     try { await billingService.syncFromStripe(tenantId); tenant = await repo.findOne(...); } catch {}
  }
  // effective tekrar hesapla
}
``` 
- admin.controller.ts (invoices)
```ts
if (tenant.stripeCustomerId && fetched.invoices.length===0) { await billingService.syncFromStripe(tenant.id); fetched = await billingService.listInvoices(tenant.id); }
```
- Fallback user faturaları ekleme
```ts
if (fetched.invoices.length===0 && sameTenant && hasUserJWT) { const userInv = await billingService.listInvoices(...); fetched.invoices = userInv.invoices; fetched.fallbackSource='user'; }
```

## Riskler & Önlemler
- Sık sync çağrısı Stripe rate limit: koşul sadece tutarsızlıkta tetiklenecek.
- Webhook ile yarış: syncFromStripe idempotent (subscription tekrar okunur, güvenli).
- Performans: Admin panel açılışında tek ek sync yeterli; gerekirse 15 sn içinde aynı tenant için tekrar tetiklemeyi engellemek için küçük bir in-memory cache uygulanabilir.

## Hızlı Başlatma Komutları (Yeni Oturum İçin Referans)
(Not: Sadece rehber; otomatik çalıştırma için terminale girilebilir.)
```
# 1. Debug çıktısı al
curl -H "admin-token: <ADMIN_TOKEN>" http://localhost:3001/api/admin/tenant/<TENANT_ID>/debug

# 2. Manuel sync (kullanıcı JWT gerekir)
curl -H "Authorization: Bearer <USER_JWT>" -X POST http://localhost:3001/api/billing/<TENANT_ID>/sync
```

## Uygulama Tamamlandıktan Sonra Beklenen Sonuçlar
- Admin panelde kullanıcı kartı: `Aktif Kullanıcılar X / Y` (Y = güncel maxUsers) anında doğru.
- Fatura geçmişi: Upgrade sonrası ilk fatura kesildiğinde admin tarafı boş kalmaz; gerekirse fallback gösterir.
- Manuel sync ihtiyacı ortadan kalkar.

## Reconciler Mantığı (Uygulandı)
Backend `AdminService#getTenantLimits` içinde şu koşulları kontrol ediyor:

```
needSync = tenant.stripeCustomerId && (
   !tenant.stripeSubscriptionId ||
   usage.users > tenant.maxUsers ||
   effectiveBefore.maxUsers < tenant.maxUsers
)
```

Koşul sağlanırsa ve aynı tenant için son 15 saniyede sync tetiklenmemişse:
1. Structured log: `{ tag:'ADMIN_SYNC', tenantId, reason, before:{...} }`
2. `billingService.syncFromStripe(tenantId)` çağrılır.
3. Başarılı ise ikinci structured log: `{ tag:'ADMIN_SYNC', tenantId, status:'success', after:{ maxUsers, stripeSubscriptionId } }`
4. Hata durumunda `{ tag:'ADMIN_SYNC', status:'error', message }` loglanır.

`AdminController#listTenantInvoices` endpointinde:
* `stripeCustomerId` mevcut ve dönen invoice sayısı `0` ise aynı mantıkla `reason:'invoice-empty'` ile sync tetiklenir ve tekrar faturalar okunur.

Ek Endpoint:
* `GET /api/admin/tenant/:tenantId/subscription-raw` → Stripe abonelik item'ları (id, priceId, quantity, interval) ve hesaplanan `computedSeats` bilgisi döner.

Throttle:
* Aynı tenant için otomatik sync tetikleme 15 saniyede bir kez yapılır (in-memory `Map` ile).

Log Örnekleri:
```json
{"tag":"ADMIN_SYNC","tenantId":"t_123","reason":"mismatch-usage","before":{"maxUsers":3,"usageUsers":5,"effectiveMax":3,"stripeCustomerId":"cus_...","stripeSubscriptionId":null}}
{"tag":"ADMIN_SYNC","tenantId":"t_123","status":"success","after":{"maxUsers":5,"stripeSubscriptionId":"sub_..."}}
```

Bu mantık sayesinde admin paneli, webhook gecikse bile ilk limite/invoice isteğinde Stripe ile senkron hale gelir.

---
Bu planı yeni konuşmada doğrudan uygulayabilirsiniz. Kod yazımı için gerekli dosya yol referansları burada mevcut. Gereken ilk aksiyon: Debug endpoint ve manual sync çıktılarının toplanması.

# Fransa 2026 E-Fatura Uyumluluk Yol Haritası

> **Yasa:** Fransa 2026 e-fatura zorunluluğu (Loi de finances 2024 — Décret n°2022-1299).
> Büyük şirketler: Eylül 2026 · Orta: Eylül 2027 · Küçük: Eylül 2028

---

## Tamamlanan Fazlar

### ✅ Faz 1 — Şema & Entity'ler (Schema)

**Amaç:** Fransa e-fatura uyumu için gerekli veri modelini hazırla.

| Alan | Nerede | Durum |
|------|--------|-------|
| `EInvoiceStatus` enum (10 değer: NOT_APPLICABLE → PARTIALLY_COLLECTED) | `invoice.entity.ts` | ✅ |
| `InvoiceDocumentType` enum (INVOICE, CREDIT_NOTE, DEBIT_NOTE, PROFORMA) | `invoice.entity.ts` | ✅ |
| `eInvoiceStatus`, `eInvoiceStatusReason` | Invoice entity | ✅ |
| `providerInvoiceId`, `providerInvoiceNumber` | Invoice entity | ✅ |
| `invoiceCurrency`, `invoiceLanguage` | Invoice entity | ✅ |
| `servicePeriodStart`, `servicePeriodEnd` | Invoice entity | ✅ |
| `lastProviderSyncAt`, `providerError` | Invoice entity | ✅ |
| `sellerSnapshot` / `buyerSnapshot` (JSONB) | Invoice entity | ✅ |
| `InvoiceLine` entity (ayrı tablo) | `invoice-line.entity.ts` | ✅ |
| Tenant: `siretNumber`, `sirenNumber`, `tvaNumber`, `companyType`, `tradeRegistryNumber` | Tenant entity | ✅ |
| Customer: `siretNumber`, `sirenNumber`, `providerCustomerId` | Customer entity | ✅ |
| **Migration:** `1770000000000-AddEInvoicePhase1FieldsToInvoices` | migrations/ | ✅ |
| **Migration:** `1770100000000-AddEInvoicePhase1FieldsToCustomers` | migrations/ | ✅ |
| **Migration:** `1770200000000-NormalizeInvoiceLines` | migrations/ | ✅ |
| **Migration:** `1770600000000-AddProviderInvoiceNumberAndExtendEInvoiceStatus` | migrations/ | ✅ |

**Bilinen Faz 1 Eksikleri (Faz 4'te tamamlanacak):**
- `buyerReference` (EN 16931 BT-10) — Invoice entity'de yok
- `orderReference` (EN 16931 BT-13) — Invoice entity'de yok
- `contractReference` (EN 16931 BT-12) — Invoice entity'de yok
- `paymentMeans` / banka IBAN+BIC alanları — Invoice entity'de yok
- Snapshot alanları tanımlı ama servis tarafından **hiç doldurulmuyor** (Faz 5)

---

### ✅ Faz 2 — Entegrasyon Altyapısı (Integration Foundation)

**Amaç:** Provider-agnostic entegrasyon katmanı (herhangi bir PDP'ye genişleyebilir).

| Dosya | Durum |
|-------|-------|
| `ProviderAccount` entity (`provider_accounts` tablosu) | ✅ |
| `IntegrationLog` entity (`integration_logs` tablosu) | ✅ |
| `OutboundJob` entity (`outbound_jobs` tablosu) | ✅ |
| `ProviderAccountService` (CRUD + markConnected/markError/disconnect) | ✅ |
| `IntegrationLogService` (info/warn/error log sarmalayıcı) | ✅ |
| `IEInvoicingProvider` interface | ✅ |
| `PROVIDER_KEYS` sabitleri | ✅ |
| `IntegrationsCommonModule` | ✅ |
| **Migration:** `1770300000000-CreateProviderAccountsTable` | ✅ |
| **Migration:** `1770400000000-CreateIntegrationLogsTable` | ✅ |
| **Migration:** `1770500000000-CreateOutboundJobsTable` | ✅ |

**Kritik Faz 2 Eksikliği:**
- `ProviderAccountService.findWithTokens()` **yok** — `accessToken` ve `refreshToken` alanları `select: false` olduğu için normal `findOne` onları getirmiyor. OAuth servisi bu nedenle tokenlara hiç ulaşamıyor. Bu **Faz 3.5'te** giderilecek.

---

### ✅ Faz 3 — Pennylane MVP (Provider Implementasyonu)

**Amaç:** Pennylane PDP entegrasyonunun çalışan ilk sürümü.

| Dosya | Durum |
|-------|-------|
| `constants/vat-rate-map.ts` | ✅ |
| `types/pennylane.types.ts` | ✅ |
| `services/pennylane-api.client.ts` | ✅ |
| `services/pennylane-oauth.service.ts` | ✅ (bug: Faz 3.5'te düzeltilecek) |
| `services/pennylane-submit.service.ts` | ✅ |
| `services/pennylane-status-sync.service.ts` | ✅ |
| `mappers/customer.mapper.ts` | ✅ |
| `mappers/invoice.mapper.ts` | ✅ |
| `pennylane.controller.ts` | ✅ |
| `pennylane.module.ts` | ✅ |
| `AppModule`'a kayıt | ✅ |

**Gerekli ortam değişkenleri:**
```env
PENNYLANE_CLIENT_ID=...
PENNYLANE_CLIENT_SECRET=...
PENNYLANE_REDIRECT_URI=https://app.comptario.com/integrations/pennylane/oauth/callback
```

---

## Planlanan Fazlar

### 🔴 Faz 3.5 — Kritik Token Bug Düzeltmesi

**Öncelik:** BLOCKER — Faz 3.5 tamamlanmadan Pennylane entegrasyonu çalışmaz.

**Sorun:** `accessToken` ve `refreshToken` kolonları `select: false` olarak işaretli.
`findOne()` bu alanları otomatik getirmiyor → OAuth her zaman token bulamadığını sanıyor.

**Yapılacaklar:**

```
backend/src/integrations/common/services/provider-account.service.ts
  + findWithTokens(tenantId, providerKey): Promise<ProviderAccount | null>
    → createQueryBuilder().addSelect(["providerAccount.accessToken", "providerAccount.refreshToken"])
```

```
backend/src/integrations/pennylane/services/pennylane-oauth.service.ts
  → getValidAccessToken(): findByTenantAndProvider → findWithTokens ile değiştir
  → refreshToken():        findByTenantAndProvider → findWithTokens ile değiştir
```

**Dosyalar:** 2 dosya, ~20 satır değişiklik.

---

### 🟠 Faz 4 — EN 16931 Eksik Uyum Alanları

**Öncelik:** Yüksek — Fransa e-fatura standardı (EN 16931) zorunlu kılar.

**Neden gerekli:** Sendikalar ve kamu kurumları faturalarda BT-10, BT-12, BT-13 ve ödeme bilgilerini istiyor.
Pennylane bu alanları `payment_method` ve `payable_iban` olarak kabul ediyor.

**Yapılacaklar:**

```
backend/src/invoices/entities/invoice.entity.ts
  + buyerReference: string | null        (BT-10 — alıcı fatura referansı)
  + orderReference: string | null        (BT-13 — sipariş numarası)
  + contractReference: string | null     (BT-12 — sözleşme numarası)
  + paymentMethodCode: string | null     (BT-81 — 'bank_transfer' | 'direct_debit' | 'card' vb.)
  + paymentIban: string | null           (BT-84 — tahsilat IBAN)
  + paymentBic: string | null            (BT-86 — banka BIC/SWIFT)

backend/src/invoices/dto/invoice.dto.ts
  → BaseInvoiceDto'ya yukarıdaki alanlar eklenir

backend/src/migrations/
  + 1770700000000-AddEN16931ComplianceFieldsToInvoices.ts (idempotent DO $$ bloğu)

backend/src/integrations/pennylane/mappers/invoice.mapper.ts
  → mapInvoiceToPayload(): payment_method, payable_iban alanları eklenir
```

**Etkilenen dosya sayısı:** 4 dosya + 1 migration.

---

### 🟠 Faz 5 — Snapshot Otomatik Doldurma

**Öncelik:** Yüksek — Denetim kaydı (audit trail) ve Factur-X XML üretimi için gerekli.

**Sorun:** `sellerSnapshot` ve `buyerSnapshot` alanları entity'de tanımlı ama
`InvoicesService.create()` bunları **hiç doldurmıyor**. Fatura kesildiğinde satıcı/alıcı
bilgileri kaydedilmiyor → geçmişe dönük sorgularda bilgi kaybı.

**Yapılacaklar:**

```
backend/src/invoices/invoices.service.ts
  → create(): Fatura oluşturulurken tenant ve customer verileri snapshot olarak kaydedilir
    - sellerSnapshot: { companyName, address, tvaNumber, siretNumber, sirenNumber, rcsNumber, companyType }
    - buyerSnapshot: { name, company, address, tvaNumber, siretNumber, sirenNumber, billingAddress }
  → InvoicesService'e TenantService bağımlılığı eklenir (tenant bilgisi için)
```

**Etkilenen dosya sayısı:** 2 dosya (invoices.service.ts, invoices.module.ts).

---

### 🟡 Faz 6 — Factur-X XML/PDF Üretimi

**Öncelik:** Orta — Pennylane olmadan doğrudan B2B e-fatura göndermek için gerekli.
(Pennylane zaten XML'i kendi üretiyor; bu faz Pennylane dışı için.)

**Kapsam:**
- CII (Cross Industry Invoice) formatında EN 16931 uyumlu XML üretimi
- PDF'e gömülü Factur-X profili (MINIMUM, BASIC WL, EN 16931, EXTENDED)
- `pdf-lib` veya `pdfkit` + `xml-builder` kullanımı

**Yapılacaklar:**

```
backend/src/invoices/
  + facturx/
    + cii-xml.builder.ts         — Invoice entity → CII XML string
    + facturx.service.ts         — XML + PDF birleştirme (XMP metadata)
    + facturx.module.ts
  + dto/facturx-profile.enum.ts  — MINIMUM | BASIC_WL | EN_16931 | EXTENDED

backend/src/invoices/invoices.controller.ts
  + GET /invoices/:id/facturx    — Factur-X PDF indir endpoint'i
```

**Dış bağımlılıklar:**
```bash
npm install xml2js pdf-lib @pdf-lib/fontkit
```

**Etkilenen dosya sayısı:** 5 yeni dosya + controller değişikliği.

---

### 🟡 Faz 7 — İş Kuyruğu & Cron Otomasyonu

**Öncelik:** Orta — Üretim için gerekli (manuel tetiklemeden kurtulmak için).

**Kapsam:**
- Fatura oluşturulunca otomatik `submitInvoice` kuyruğuna ekle
- Her 15 dakikada bir durum senkronizasyonu (changelog polling)
- Başarısız görevler için üstel geri çekilme (exponential backoff) ile yeniden deneme
- `OutboundJob` entity'si zaten var, kullanılmaya başlanacak

**Seçenekler:**

| Seçenek | Artı | Eksi |
|---------|------|------|
| `@nestjs/schedule` (cron) | Sıfır bağımlılık | Dağıtık ortamda çakışma riski |
| BullMQ + Redis | Güvenilir, yeniden deneme, öncelik | Redis gerektirir |

**Öneri:** BullMQ (Redis zaten mevcut ise) ya da `@nestjs/schedule` ile başla.

**Yapılacaklar:**

```
backend/src/integrations/common/
  + queues/
    + einvoice.queue.ts             — EINVOICE_SUBMIT, EINVOICE_SYNC kuyruk tanımları
    + einvoice-submit.processor.ts  — BullMQ worker (submitInvoice çağırır)
    + einvoice-sync.processor.ts    — BullMQ worker (syncForTenant çağırır)

backend/src/integrations/common/entities/outbound-job.entity.ts
  + retryCount, nextRetryAt, scheduledAt alanları (migration gerekli)

backend/src/invoices/invoices.service.ts
  → create(): Fatura sonrası kuyruğa ekle (tenant Fransa ayarlı ise)
```

---

### 🟡 Faz 8 — Chorus Pro (B2G İkinci Provider)

**Öncelik:** Orta — Kamu sektörü müşterileri (hastane, belediye, devlet kurumu) için zorunlu.

**Kapsam:**
- PISTE (Plateforme Interministérielle de Sécurisation des Échanges) API entegrasyonu
- Chorus Pro: Fransa'nın devlet B2G fatura platformu
- OAuth PKCE ile kimlik doğrulama
- `IEInvoicingProvider` interface'ini implemente eder (Pennylane ile aynı sözleşme)

**Yapılacaklar:**

```
backend/src/integrations/chorus-pro/
  + constants/chorus-pro.constants.ts
  + types/chorus-pro.types.ts
  + services/chorus-pro-api.client.ts
  + services/chorus-pro-oauth.service.ts
  + services/chorus-pro-submit.service.ts  (IEInvoicingProvider)
  + mappers/invoice.mapper.ts              (UBL 2.1 format)
  + chorus-pro.controller.ts
  + chorus-pro.module.ts

backend/src/app.module.ts
  → ChorusProModule import edilir
```

**Ek gereksinim:**
```
CHORUS_PRO_CLIENT_ID=...
CHORUS_PRO_CLIENT_SECRET=...
CHORUS_PRO_REDIRECT_URI=https://app.comptario.com/integrations/chorus-pro/oauth/callback
```

---

### 🟡 Faz 9 — Token Şifreleme (Güvenlik)

**Öncelik:** Yüksek (güvenlik) — Üretim ortamına geçmeden önce tamamlanmalı.

**Sorun:** `accessToken` ve `refreshToken` veritabanında **açık metin** (plaintext) olarak saklanıyor.
DB sızıntısı durumunda tüm müşteri tokenları ifşa olur.

**Yapılacaklar:**

```
backend/src/common/crypto/
  + encryption.service.ts
    + encrypt(plaintext: string): string  → AES-256-GCM, base64url çıktı
    + decrypt(ciphertext: string): string → IV + auth tag doğrulaması

backend/src/integrations/common/services/provider-account.service.ts
  → upsert(): accessToken/refreshToken kaydedilmeden önce encrypt()
  → findWithTokens(): okuma sonrası decrypt()
```

**Ortam değişkeni:**
```env
APP_ENCRYPTION_KEY=<64 hex karakter, 256-bit>  # process.env ile
```

**Not:** Mevcut token kayıtlarını yeniden şifrelemek için tek seferlik migration script gerekir.

---

### 🟢 Faz 10 — Frontend Entegrasyonu

**Öncelik:** Düşük-Orta — Kullanıcılar bağlantıyı ve durumu göremez.

**Yapılacaklar:**

```
frontend/src/
  + pages/settings/integrations/
    + PennylaneConnectPage.tsx      — "Pennylane'e bağlan" OAuth düğmesi
    + PennylaneSettingsPage.tsx     — Bağlantı durumu, bağlantıyı kes
  + components/invoices/
    + EInvoiceStatusBadge.tsx       — submitted | sent | accepted | rejected renk kodlu badge
    + SubmitToProviderButton.tsx    — Manuel "E-Fatura Gönder" düğmesi
  + api/integration.api.ts
    + connectPennylane()
    + disconnectPennylane()
    + submitInvoice(invoiceId)
    + syncInvoiceStatus(invoiceId)
```

**API endpoint'leri:** `/integrations/pennylane/*` zaten mevcut (Faz 3 controller).

---

### 🟢 Faz 11 — Test & Sertifikasyon

**Öncelik:** Son (ama önemli) — Pennylane partner onayı için zorunlu.

**Yapılacaklar:**

```
backend/src/__tests__/
  + pennylane-customer.mapper.spec.ts   — company/individual mapping
  + pennylane-invoice.mapper.spec.ts    — tarih, para birimi, satır eşleme
  + pennylane-vat-rate.spec.ts          — TVA oranı → Pennylane kodu

backend/src/__tests__/integration/
  + pennylane-submit.integration.spec.ts — Nock ile HTTP mock
  + pennylane-oauth.integration.spec.ts  — token exchange & refresh

backend/src/__tests__/e2e/
  + einvoice-flow.e2e.spec.ts           — create invoice → submit → sync döngüsü
```

**Sertifikasyon:**
- Pennylane partner portal'a başvuru
- Test ortamında 10 onaylı fatura gönderimi zorunluluğu
- Sandbox credentials: `PENNYLANE_CLIENT_ID_SANDBOX`, `PENNYLANE_CLIENT_SECRET_SANDBOX`

---

## Özet Tablo

| Faz | Açıklama | Öncelik | Durum | Tahmini Efor |
|-----|----------|---------|-------|--------------|
| 1 | Şema & Entity'ler | — | ✅ Tamamlandı | — |
| 2 | Entegrasyon Altyapısı | — | ✅ Tamamlandı | — |
| 3 | Pennylane MVP | — | ✅ Tamamlandı | — |
| **3.5** | **Token Bug Düzeltmesi** | 🔴 BLOCKER | 🔜 Sonraki | ~1 saat |
| 4 | EN 16931 Eksik Alanlar | 🟠 Yüksek | 🔜 Planlandı | ~3 saat |
| 5 | Snapshot Otomatik Doldurma | 🟠 Yüksek | 🔜 Planlandı | ~2 saat |
| 6 | Factur-X XML/PDF | 🟡 Orta | 🔜 Planlandı | ~1 gün |
| 7 | İş Kuyruğu & Cron | 🟡 Orta | 🔜 Planlandı | ~1 gün |
| 8 | Chorus Pro B2G | 🟡 Orta | 🔜 Planlandı | ~2 gün |
| 9 | Token Şifreleme | 🟠 Yüksek | 🔜 Planlandı | ~3 saat |
| 10 | Frontend Entegrasyonu | 🟢 Düşük | 🔜 Planlandı | ~1 gün |
| 11 | Test & Sertifikasyon | 🟢 Düşük | 🔜 Planlandı | ~2 gün |

---

## Uygulama Sırası (Önerilen)

```
Faz 3.5  →  Faz 9  →  Faz 4  →  Faz 5  →  Faz 7  →  Faz 6  →  Faz 8  →  Faz 10  →  Faz 11
(blocker)  (güvenlik) (uyum)  (audit)  (otomasyon) (pdf) (kamu) (ui)       (test)
```

> **Not:** Faz 9 (Token Şifreleme), güvenlik açısından kritik olduğu için üretim dağıtımından önce
> Faz 3.5'in hemen ardından uygulanmalıdır.

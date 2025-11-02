# Banka Hesapları API

Bu doküman Banka Hesapları (Bank Accounts) uç noktalarını ve plan limitlerini özetler.

## Plan Limiti

- Free: En fazla 1 banka hesabı
- Pro: Sınırsız
- Business: Sınırsız

Limit aşıldığında API 400 yanıt döner ve mesajda plan limitini yükseltme önerisi yer alır.

Örnek hata:
```json
{
  "statusCode": 400,
  "message": "Plan limitine ulaşıldı: Free planı en fazla 1 banka hesabına izin verir. Daha fazla hesap için planınızı yükseltin.",
  "error": "Bad Request"
}
```

## Endpointler

Tüm endpointler JWT ile korunur (Authorization: Bearer <token>).

- POST `/bank-accounts` — Yeni banka hesabı oluştur
  - Body örnek:
    ```json
    {
      "name": "Ana Hesap",
      "iban": "TR000000000000000000000000",
      "currency": "TRY"
    }
    ```
  - 201 ile oluşturulan hesap döner.

- GET `/bank-accounts` — Hesapları listele
- GET `/bank-accounts/:id` — Hesap detayı
- PATCH `/bank-accounts/:id` — Güncelle
- DELETE `/bank-accounts/:id` — Sil

Not: Şu an e2e testleri, Free planında ikinci hesap oluşturma girişiminin 400 ile reddedildiğini doğrular.

## İlgili Kodlar

- `backend/src/bank-accounts/` — Entity, DTO, Service, Controller, Module
- `backend/src/common/tenant-plan-limits.service.ts` — Plan limitleri ve banka hesabı kontrolü
- `backend/test/bank-accounts.e2e-spec.ts` — E2E testleri

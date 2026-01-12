# n8n Blog Entegrasyonu (Admin Token ile)

Bu doküman, blog yazılarını n8n üzerinden otomatik oluşturmak/güncellemek için gerekli **en pratik** akışı tarif eder.

## Temel Bilgiler

- **API base path:** Frontend dev/prod istekleri varsayılan olarak `/api` altından gider.
  - Yani gerçek endpoint: `https://DOMAIN/api/...`
- **Admin auth:** `admin-token` header’ı zorunludur.
- **CSRF:** Blog admin endpointleri otomasyon istemcileri için CSRF’den muaf tutulmuştur (admin-token ile zaten korunur).

## Admin Token Nereden Alınır?

Admin token, login sonrası backend’in döndürdüğü `adminToken` alanıdır.

- **Endpoint:** `POST https://DOMAIN/api/admin/login`
- **Body:** `{"username":"...","password":"...","totp":"123456"}`
- **Response:** `{"adminToken":"...","expiresIn":"1h" ... }`

Not: Bu projede admin token **in-memory** tutulur ve **yaklaşık 1 saat** sonra geçersizleşir. Bu yüzden n8n’de ya token’ı periyodik yenilemeniz ya da her çalıştırmada login olup yeni token almanız gerekir.

## 2FA Varsa: n8n İçin 2 Mod

### Mod 1 — Manuel Token (En Kolay / En Az Risk)

Bu modda token’ı bir kez (veya gerektiğinde) siz üretirsiniz, n8n sadece onu kullanır.

1) Admin login çağrısı yapın (tarayıcıdan admin panele girerek veya cURL ile):

```bash
curl -X POST "https://DOMAIN/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD","totp":"123456"}'
```

2) Response içindeki `adminToken` değerini n8n’de bir yerde saklayın:
- n8n Credentials içinde “Header Auth” benzeri bir kayıt (varsa)
- veya workflow değişkeni / environment variable

3) Blog upsert node’unda header olarak gönderin:
- `admin-token: YOUR_ADMIN_TOKEN`

Artıları:
- TOTP secret’ı n8n’de tutmazsınız.
- Uygulaması en kolay.

Eksileri:
- Token 1 saatlik olduğu için süre dolunca manuel yenileme gerekir.

### Mod 2 — Tam Otomatik (Her Çalıştırmada Login + TOTP Üret)

Bu modda workflow her tetiklendiğinde:
1) TOTP kodunu üretir
2) `/api/admin/login` ile token alır
3) Aynı çalıştırma içinde bu token ile blog upsert yapar

Önerilen node sırası:

1. **Code** (TOTP üret)
2. **HTTP Request** (Admin Login)
3. **HTTP Request** (Blog Upsert)

#### 1) Code Node (TOTP üretimi)

Bu örnek 6 haneli, 30 saniye adımlı TOTP üretir. Secret’ı base32 formatında girin (Google Authenticator / Authy genelde base32 verir).

```javascript
// n8n Code node (JavaScript)
// Input: environment variable veya hardcoded (önerilmez)
// Örn: process.env.ADMIN_TOTP_SECRET (n8n’de tanımlayın)

const crypto = require('crypto');

function base32ToBuffer(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(base32 || '').replace(/=+$/,'').replace(/\s+/g,'').toUpperCase();
  let bits = '';
  for (const c of clean) {
    const v = alphabet.indexOf(c);
    if (v === -1) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(key, counter, digits = 6) {
  const buf = Buffer.alloc(8);
  // big-endian counter
  let tmp = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(tmp & 0xffn);
    tmp >>= 8n;
  }
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) |
               ((hmac[offset + 1] & 0xff) << 16) |
               ((hmac[offset + 2] & 0xff) << 8) |
               (hmac[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(code % mod).padStart(digits, '0');
}

function totp(base32Secret, stepSeconds = 30, digits = 6) {
  const key = base32ToBuffer(base32Secret);
  const counter = Math.floor(Date.now() / 1000 / stepSeconds);
  return hotp(key, counter, digits);
}

const secret = process.env.ADMIN_TOTP_SECRET; // n8n’de env var olarak tanımlayın
if (!secret) {
  throw new Error('ADMIN_TOTP_SECRET is not set');
}

const code = totp(secret);
return [{ json: { totp: code } }];
```

Güvenlik notu: Bu modda 2FA secret’ı n8n’de saklandığı için erişimleri çok sıkı kısıtlayın.

#### 2) HTTP Request (Admin Login)

- **Method:** `POST`
- **URL:** `https://DOMAIN/api/admin/login`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**

```json
{
  "username": "admin",
  "password": "YOUR_PASSWORD",
  "totp": "{{$json.totp}}"
}
```

Bu node’un output’unda `adminToken` döner.

#### 3) HTTP Request (Blog Upsert)

Önceki dokümandaki upsert node’unu kullanın, sadece header’ı dinamik yapın:

- `admin-token: {{$node["Admin Login"].json["adminToken"]}}`

Not: Node adı sizde farklıysa, expression’ı node adınıza göre uyarlayın.

## Önerilen Tek Endpoint (Upsert by Slug)

- **Method:** `PUT`
- **URL:** `https://DOMAIN/api/admin/blog-posts/by-slug/:slug`
  - `:slug` örn: `kobi-icin-fatura-ipuclari`
- **Headers:**
  - `Content-Type: application/json`
  - `admin-token: <YOUR_ADMIN_TOKEN>`
- **Body (minimum):**
  - `title` (zorunlu)
  - `contentMarkdown` **veya** `contentHtml` (zorunlu)
  - `status` (`draft` | `published`)

### Örnek Body (Markdown ile)

```json
{
  "slug": "kobi-icin-fatura-ipuclari",
  "title": "KOBİ’ler İçin Fatura Kesme İpuçları",
  "excerpt": "Kısa bir özet...",
  "contentMarkdown": "# Başlık\n\nİçerik...",
  "status": "published",

  "metaTitle": "KOBİ’ler İçin Fatura İpuçları | Blog",
  "metaDescription": "Fatura keserken dikkat edilmesi gereken temel noktalar.",
  "canonicalUrl": "https://DOMAIN/blog/kobi-icin-fatura-ipuclari",
  "ogImageUrl": "https://DOMAIN/assets/og/kobi-ipuclari.png",
  "keywords": "kobi, fatura, e-fatura, muhasebe",
  "noIndex": false,
  "jsonLd": "{\"@context\":\"https://schema.org\",\"@type\":\"Article\",\"headline\":\"KOBİ’ler İçin Fatura Kesme İpuçları\"}"
}
```

### Örnek Body (HTML ile)

```json
{
  "slug": "ornek-html",
  "title": "HTML ile Yazı",
  "contentHtml": "<h1>Merhaba</h1><p>İçerik...</p>",
  "status": "draft"
}
```

## n8n Node Ayarı (HTTP Request)

n8n’de bir **HTTP Request** node’u ekleyin:

- **Method:** `PUT`
- **URL:** `https://DOMAIN/api/admin/blog-posts/by-slug/{{$json.slug}}`
- **Authentication:** None (header ile)
- **Headers:**
  - `admin-token`: `YOUR_ADMIN_TOKEN`
  - `Content-Type`: `application/json`
- **Body Content Type:** JSON
- **Body:** (örnek)

```json
{
  "slug": "{{$json.slug}}",
  "title": "{{$json.title}}",
  "excerpt": "{{$json.excerpt}}",
  "contentMarkdown": "{{$json.contentMarkdown}}",
  "status": "{{$json.status}}",

  "metaTitle": "{{$json.metaTitle}}",
  "metaDescription": "{{$json.metaDescription}}",
  "canonicalUrl": "{{$json.canonicalUrl}}",
  "ogImageUrl": "{{$json.ogImageUrl}}",
  "keywords": "{{$json.keywords}}",
  "noIndex": {{$json.noIndex}},
  "jsonLd": "{{$json.jsonLd}}"
}
```

Notlar:
- `noIndex` boolean olmalı (`true/false`). String göndermeyin.
- `canonicalUrl` boş ise göndermeyebilirsiniz; backend `null` saklar.
- `jsonLd` geçerli JSON string olmalı (düz metin değil).

## Önerilen Minimum SEO Alanları

En az şu 3 alanı dolu tutmak genelde yeterlidir:
- `metaTitle`
- `metaDescription`
- `canonicalUrl` (domain + `/blog/<slug>`)

Opsiyonel ama faydalı:
- `ogImageUrl`
- `jsonLd`

## Yayın Kontrolü

- Public SEO sayfaları:
  - `https://DOMAIN/blog`
  - `https://DOMAIN/blog/<slug>`
- SPA hash erişimi (isteğe bağlı):
  - `https://DOMAIN/#blog`
  - `https://DOMAIN/#blog/<slug>`

## Hızlı cURL Testi

```bash
curl -X PUT "https://DOMAIN/api/admin/blog-posts/by-slug/test-yazi" \
  -H "Content-Type: application/json" \
  -H "admin-token: YOUR_ADMIN_TOKEN" \
  -d '{"slug":"test-yazi","title":"Test","contentMarkdown":"# Test","status":"published"}'
```

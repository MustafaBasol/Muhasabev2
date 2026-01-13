# n8n Blog Entegrasyonu (Admin Token ile)

Bu doküman, blog yazılarını n8n üzerinden otomatik oluşturmak/güncellemek için gerekli **en pratik** akışı tarif eder.

## Temel Bilgiler

- **API path prefix:** Backend global prefix `\`/api\`` kullanır.
  - Yani endpoint formatı: `https://<BACKEND_DOMAIN>/api/...`
- **Prod domain ayrımı (Comptario):**
  - Frontend: `https://comptario.com`
  - Backend API: `https://api.comptario.com`
  - n8n / cURL gibi otomasyon isteklerinde **API domain’ini** kullanın: `https://api.comptario.com/api/...`
- **Admin auth:** `admin-token` header’ı zorunludur.
- **CSRF:** Blog admin endpointleri otomasyon istemcileri için CSRF’den muaf tutulmuştur (admin-token ile zaten korunur).

## Admin Token Nereden Alınır?

Admin token, login sonrası backend’in döndürdüğü `adminToken` alanıdır.

- **Endpoint:** `POST https://DOMAIN/api/admin/login`
- **Body:** `{"username":"...","password":"...","totp":"123456"}`
- **Response:** `{"adminToken":"...","expiresIn":"1h" ... }`

Not: Eğer `https://comptario.com/api/...` çağrıları Cloudflare/nginx katmanında takılıyorsa, doğrudan API domain’ine geçin:
- `https://api.comptario.com/api/admin/login`

Not: Bu projede admin token **in-memory** tutulur ve **yaklaşık 1 saat** sonra geçersizleşir. Bu yüzden n8n’de ya token’ı periyodik yenilemeniz ya da her çalıştırmada login olup yeni token almanız gerekir.

## 2FA Varsa: n8n İçin 2 Mod

### Mod 1 — Manuel Token (En Kolay / En Az Risk)

Bu modda token’ı bir kez (veya gerektiğinde) siz üretirsiniz, n8n sadece onu kullanır.

1) Admin login çağrısı yapın (tarayıcıdan admin panele girerek veya cURL ile):

```bash
curl -X POST "https://api.comptario.com/api/admin/login" \
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

Önemli: n8n’in **Code** node’u güvenlik nedeniyle Node.js built-in modüllerini kısıtlayabilir. Eğer `Cannot find module 'crypto'` hatası alırsanız n8n instance’ınızda aşağıdaki env var’ı tanımlayıp n8n’i yeniden başlatın:

- `NODE_FUNCTION_ALLOW_BUILTIN=crypto`

Notlar:
- n8n Cloud’da (veya yönetilen ortamlarda) bu ayarı yapamayabilirsiniz; bu durumda **Mod 1 (Manuel Token)** ile ilerlemek en kolay yoldur.
- Self-hosted Docker kullanıyorsanız n8n servisinin `environment:` kısmına ekleyip `docker compose up -d` ile yeniden yaratın.

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

Sorun giderme: Container’da değişken var ama Code node `process.env` göremiyor

Bazı n8n kurulumlarında (özellikle sandbox/vm2) Code node içinde `process.env` kısıtlı olabilir. Bu durumda env’i doğrudan Code node’dan okumak yerine, **expression** ile bir önceki node’da item’a ekleyip Code node’a taşıyın:

1) Code node’dan önce bir **Set / Edit Fields** node’u ekleyin (ör. adı: `Load Env`).
2) Bu node’da bir alan ekleyin:
   - `secret`: `{{$env.ADMIN_TOTP_SECRET}}`
3) Code node’da secret okuma satırını şöyle değiştirin:

```javascript
const secret = $input.first().json.secret;
if (!secret) {
  throw new Error('ADMIN_TOTP_SECRET is not set');
}
```

Eğer debug yaptığınızda `$input.first().json.secret` boş geliyorsa (bazı durumlarda node input’u farklı bir item olabilir), Code node içinde `Load Env` node’unun çıktısını **node adıyla** okuyarak ilerleyebilirsiniz:

```javascript
const secret = $('Load Env').first().json.secret;
if (!secret) {
  throw new Error('ADMIN_TOTP_SECRET is not set');
}
```

Not: Node adınız farklıysa `Load Env` kısmını birebir node adınızla değiştirin. Sağlıklı test için “Execute workflow” ile akışı baştan çalıştırın ve pinned data kullanmayın.

Bu yöntemle env, n8n’in expression katmanından (ana process) alınır ve Code node sandbox’ına veri olarak taşınır.

Güvenlik notu: Bu modda 2FA secret’ı n8n’de saklandığı için erişimleri çok sıkı kısıtlayın.

#### 2) HTTP Request (Admin Login)

- **Method:** `POST`
- **URL:** `https://api.comptario.com/api/admin/login`
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

### Neden hep 1 blog yazısı oluyor?

Bu projede önerilen endpoint **upsert** mantığıyla çalışır:

- Aynı `slug` ile tekrar istek atarsanız, **yeni kayıt açmak yerine mevcut yazının üstüne yazar** (update eder).
- Bu yüzden n8n her çalıştırmada aynı `slug` üretiyor/gönderiyorsa sitede hep “tek yazı varmış” gibi görünür.

Çözüm: Her yazı için `slug` değerinin **benzersiz** olduğundan emin olun.

Pratik öneriler:
- Kaynağınızda zaten bir benzersiz id varsa slug’a ekleyin (örn. `my-title-{{sourceId}}`).
- Aynı başlık tekrar gelebiliyorsa tarih ekleyin (örn. `my-title-2026-01-13`).
- En güvenlisi: `slug` alanını n8n’de tek bir node’da üretip her yerde onu kullanmak.

Örnek (n8n Set/Edit Fields node’unda):

- `slug`:

```text
{{
  ($json.slug
    ? $json.slug
    : ($json.title || 'yazi')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
  )
}}
```

Not: Türkçe karakterleri (ç,ğ,ı,ö,ş,ü) ASCII’ye çevirmek isterseniz ayrı bir transliteration adımı eklemek gerekir.

- **Method:** `PUT`
- **URL:** `https://api.comptario.com/api/admin/blog-posts/by-slug/:slug`
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
- **URL:** `https://api.comptario.com/api/admin/blog-posts/by-slug/{{$json.slug}}`
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

## Hostinger VPS (Docker Manager) Notu

Hostinger’ın “Manage project with .yaml editor” ekranında sağdaki **Environment** paneline eklediğiniz değişkenler, bazı kurulumlarda YAML içinde **adıyla referanslanmadıkça** servise geçmeyebilir.

Bu durumda YAML içindeki `environment:` listesinde şu formatı kullanın:

- `- ADMIN_TOTP_SECRET=${ADMIN_TOTP_SECRET}`

Yanlış örnek (değişken adı yerine değeri yazmak gibi):

- `- ADMIN_TOTP_SECRET=${ERND...}`

Değişiklikten sonra mutlaka **Deploy/Recreate** yapın. Doğrulamak için n8n’de geçici bir Code node ile `!!process.env.ADMIN_TOTP_SECRET` kontrol edebilirsiniz.

## Önerilen Minimum SEO Alanları

En az şu 3 alanı dolu tutmak genelde yeterlidir:
- `metaTitle`
- `metaDescription`
- `canonicalUrl` (domain + `/blog/<slug>`)

Opsiyonel ama faydalı:
- `ogImageUrl`
- `jsonLd`

## Görseli Comptario İçinde Barındırma (Önerilen)

Bu projede blog görsellerini “Comptario içinde” barındırmanın en pratik yolu, frontend’in statik dosya alanını kullanmaktır.

- Görselleri repoda şu klasöre koyun:
  - `public/assets/blog/...`
- Vite build sırasında `public/` altı otomatik olarak build çıktısına kopyalanır.
- Prod’da URL formatı şöyle olur:
  - `https://comptario.com/assets/blog/...`

Örnek klasör yapısı:

- `public/assets/blog/og/kobi-icin-fatura-ipuclari.png` (kapak/og)
- `public/assets/blog/images/fatura-ekrani-1.png` (yazı içi)

n8n request body örnekleri:

- Kapak görseli için `ogImageUrl`:

```json
{
  "ogImageUrl": "https://comptario.com/assets/blog/og/kobi-icin-fatura-ipuclari.png"
}
```

- Markdown içerikte yazı içi görsel:

```md
![Fatura ekranı](https://comptario.com/assets/blog/images/fatura-ekrani-1.png)
```

Not: Bu yöntemde “upload API” yoktur; görsel eklemek için dosyayı repoya ekleyip deploy etmek (veya prod sunucuda statik klasöre koymak) gerekir.

## n8n ile Görseli de Göndermek (Upload + URL)

Eğer n8n’den blog yazısıyla birlikte görseli de **dosya olarak** göndermek istiyorsanız, backend tarafında bir upload endpoint’i eklendi.

- **Endpoint:** `POST https://api.comptario.com/api/admin/blog-assets/upload`
- **Auth:** `admin-token: <YOUR_ADMIN_TOKEN>`
- **Body:** `multipart/form-data`
  - `file` (zorunlu) → görsel dosyası
- **Query (opsiyonel):**
  - `folder=og` (kapak) veya `folder=images` (yazı içi)
  - `name=<slug veya dosya adı>` (dosya adını daha anlamlı yapmak için)

Response örneği:

```json
{
  "ok": true,
  "path": "/assets/blog/og/my-post-1736780000000.png",
  "url": "https://api.comptario.com/assets/blog/og/my-post-1736780000000.png"
}
```

Not: `url` değeri varsayılan olarak isteğin geldiği domain üzerinden **tam URL** döner.
`url`'in `https://comptario.com/...` olarak dönmesini isterseniz backend’e şu env’i verin:

- `PUBLIC_ASSETS_BASE_URL=https://comptario.com`

Eğer frontend (comptario.com) ve backend (api.comptario.com) ayrı nginx/proxy arkasındaysa, `/assets/blog/...` path’ini comptario.com’da serve etmek için reverse proxy ayarı gerekebilir. Alternatif olarak `PUBLIC_ASSETS_BASE_URL=https://api.comptario.com` kullanıp görselleri api subdomain üzerinden servis edebilirsiniz.

### n8n akışı (önerilen)

1) (Opsiyonel) Görseli bir URL’den indir (HTTP Request → “Download” + “Binary Data”)
2) Upload node’u (HTTP Request → `multipart/form-data`)
3) Blog upsert’te `ogImageUrl` veya markdown içindeki image URL’lerini upload response’tan doldur

Upload node ayarı (HTTP Request):

- **Method:** `POST`
- **URL:** `https://api.comptario.com/api/admin/blog-assets/upload?folder=og&name={{$json.slug}}`
- **Headers:**
  - `admin-token: {{$node["Admin Login"].json["adminToken"]}}`
- **Send Body:** `multipart/form-data`
- **Form-Data:**
  - `file` → Binary property (ör. önceki download node’undan gelen `data`)

Sonraki Blog Upsert’te:

- `ogImageUrl`: `{{$node["Upload Image"].json["url"]}}`

Yazı içi görsel için (Markdown):

```md
![Kapak]({{$node["Upload Image"].json["url"]}})
```

### Sorun giderme (Prod)

- `308 Permanent Redirect` görürseniz:
  - Genelde Traefik/Cloudflare `http` isteklerini `https`’e yönlendiriyordur.
  - Çözüm: URL’leri doğrudan `https://api.comptario.com/...` kullanın.
  - n8n’in **HTTP Request** node’u bazı kurulumlarda redirect’i otomatik takip etmez; bu yüzden n8n’de URL’i en baştan **https** yazmak en güvenlisidir.
  - cURL ile test ediyorsanız yönlendirmeyi takip etmek için `-L` ekleyebilirsiniz.
- `curl` ile multipart upload’da `Content-Type` header’ını elle set etmeyin.
  - `-F "file=@..."` kullandığınızda `curl` boundary ile doğru `Content-Type` üretir.
- Sağlık kontrolü:
  - Bu backend’de health endpoint’i `GET /api/health`’dir.
  - `GET /health` bazı ortamlarda SPA/static fallback’e düşüp 404 dönebilir.

## Yayın Kontrolü

- Public SEO sayfaları:
  - `https://DOMAIN/blog`
  - `https://DOMAIN/blog/<slug>`
- SPA hash erişimi (isteğe bağlı):
  - `https://DOMAIN/#blog`
  - `https://DOMAIN/#blog/<slug>`

## Hızlı cURL Testi

```bash
curl -X PUT "https://api.comptario.com/api/admin/blog-posts/by-slug/test-yazi" \
  -H "Content-Type: application/json" \
  -H "admin-token: YOUR_ADMIN_TOKEN" \
  -d '{"slug":"test-yazi","title":"Test","contentMarkdown":"# Test","status":"published"}'
```

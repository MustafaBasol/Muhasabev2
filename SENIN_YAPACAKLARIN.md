# Yapılacaklar — Manuel Adımlar

Bu dosya yalnızca **senin yapman gereken** adımları içerir (kod değil; ortam, altyapı, hesap, ayar).

---

## 🔴 Kritik / Üretim Öncesi Zorunlu

### Faz 9 — Token Şifreleme Anahtarı

```bash
# Aşağıdaki komutu çalıştır ve çıktıyı .env'e yaz:
openssl rand -hex 32
```

`.env` (ve üretim ortam değişkenleri) dosyasına ekle:
```env
APP_ENCRYPTION_KEY=<openssl çıktısı — 64 hex karakter>
```

> ⚠️ Bu anahtar olmadan uygulama geliştirme modunda çalışır (sabit test anahtarı).
> Üretimde mutlaka gerçek anahtar olmalı. Anahtarı kaybet → tüm şifreli tokenlar okunamaz.

---

## 🟠 Pennylane Hesabı & OAuth Ayarları

### Faz 3 — Pennylane Uygulama Kaydı

1. [Pennylane Partner Portal](https://app.pennylane.com/partners)'a giriş yap
2. Yeni bir OAuth uygulaması oluştur
3. Redirect URI olarak şunu ekle:
   ```
   https://app.comptario.com/integrations/pennylane/oauth/callback
   ```
4. Üretilen `client_id` ve `client_secret` değerlerini al
5. `.env` dosyasına ekle:
   ```env
   PENNYLANE_CLIENT_ID=...
   PENNYLANE_CLIENT_SECRET=...
   PENNYLANE_REDIRECT_URI=https://app.comptario.com/integrations/pennylane/oauth/callback
   ```

> 💡 Test için sandbox credentials ayrı alınabilir:
> ```env
> PENNYLANE_CLIENT_ID_SANDBOX=...
> PENNYLANE_CLIENT_SECRET_SANDBOX=...
> ```

---

## 🟡 İleride Gerekecek (Henüz Acil Değil)

### Faz 7 — İş Kuyruğu (BullMQ seçilirse)
- Redis kurulumu gerekebilir (veya mevcut Redis bağlantısını doğrula)
- `.env` `REDIS_URL` veya `REDIS_HOST/PORT` eklenecek

### Faz 8 — Chorus Pro (B2G)
- [PISTE portale](https://piste.gouv.fr) başvuru yapılacak
- Devlet sandbox erişimi için kurum kimliği (SIRET) gerekli
- `CHORUS_PRO_CLIENT_ID`, `CHORUS_PRO_CLIENT_SECRET` alınacak

### Faz 11 — Pennylane Sertifikasyonu
- Pennylane partner onayı için 10 başarılı test faturası gönderimi gerekiyor
- Partner portal'a sertifikasyon başvurusu yapılacak

---

## ✅ Kodda Zaten Yapılmış (Senin Aksiyonun Yok)

| | |
|-|-|
| Faz 1 | Entity'ler, migration'lar |
| Faz 2 | Entegrasyon altyapısı |
| Faz 3 | Pennylane OAuth + Submit + Sync |
| Faz 3.5 | Token bug düzeltmesi |
| Faz 9 | AES-256-GCM şifreleme (anahtarı sen oluşturacaksın) |

**Amaç**
- Davet ile katılım akışını (/#join?token=...) baştan sona doğrulamak, sorun yaşanırsa hızlıca teşhis etmek ve düzeltmek için gereken özet referans.

**Ortam**
- Çalışma: GitHub Codespaces / Ubuntu 24.04, dev mod.
- Backend: NestJS (port 3001), global prefix `api`.
- Frontend: Vite (hash routing), davet linki `/#join?token=...`.
- E-posta: Amazon SES (sandbox); alıcı doğrulaması gerekebilir.

**Durum Özeti (Bugün itibarıyla)**
- Public davet uçları eklendi ve aktif:
  - `GET /api/public/invites/:token`
  - `POST /api/public/invites/:token/register`
- Frontend’de davet sayfası “Şifre Belirleyin” ekranını düzgün gösteriyor.
- Axios, `Authorization` header’ını `/public/...` çağrılarında göndermiyor (401 kaçınıldı).
- Curl ile `POST /api/public/invites/:token/register` 201 Created dönüyor (sunucu tarafı OK).
- Yapılacak: Tarayıcıdan şifre belirleme → auto-login → org üyeliği e2e doğrulaması ve üyeler listesinde görünüm.

**Kritik Dosyalar**
- Backend
  - `backend/src/organizations/public-invites.controller.ts` (public validate/register)
  - `backend/src/auth/auth.service.ts` (registerViaInvite)
  - `backend/src/organizations/organizations.service.ts` (invite/resend/accept + link builder)
  - `backend/src/admin/admin-organizations.controller.ts` (admin: invite/resend/list)
  - `backend/src/main.ts` (CORS, CSP, static public, prefix)
- Frontend
  - `frontend/src/api/organizations.ts` (validateInviteToken, completeInviteWithPassword → public uçlar)
  - `frontend/src/api/client.ts` (axios interceptor: `/public` için Authorization yok)
  - `frontend/src/components/JoinOrganizationPage.tsx` (InvitePasswordForm; hooks sırası düzeltildi)

**Hızlı Doğrulama (Tarayıcı)**
- Aynı origin debug sayfası (CORS’suz):
  - URL: `<codespace-3001-url>/debug-api.html`
  - Örnek: `https://<CODESPACE_NAME>-3001.app.github.dev/debug-api.html`
  - Adımlar:
    1) “Admin Giriş Testi” ile login (username `owner`, password `Z3rdeS-9hQm2!7pK`).
    2) “3.2 Admin: Organizasyon ve Üyeler” → `GET /admin/organizations` (orgId dolar).
    3) `GET /admin/organizations/:orgId/invites` ve `.../members` ile durum kontrolü.
- Alternatif debug sayfası (farklı origin olabilir → CORS gerekebilir): `api-debug.html` (kök dizinde mevcut). Tercihen `debug-api.html` kullanın.

**Davet Akışı Hızlı Test**
1) Admin ile daveti tekrar yolla (gerekirse):
   - `POST /api/admin/organizations/:orgId/invite` veya `.../invites/:inviteId/resend`
2) Davet linkini aç: `/#join?token=...` (FRONTEND_URL ile oluşturulur).
3) Şifre belirle ve gönder → backend `registerViaInvite` çalışır, email verified, org’a üye eder, currentOrgId set.
4) Auto-login ardından org üyeleri ekranında görünmelisin.
5) Admin debug sayfası ile `members` içinde email’i doğrula.

**Komut Satırı Hızlı Kontrolleri**
- Admin Login → Org → Üyeler/Davetler (localhost):
```bash
ADM=$(curl -sS http://127.0.0.1:3001/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"owner","password":"Z3rdeS-9hQm2!7pK"}' | jq -r .adminToken)

ORG=$(curl -sS http://127.0.0.1:3001/api/admin/organizations -H "admin-token: $ADM" | jq -r '.[0].id')

curl -sS http://127.0.0.1:3001/api/admin/organizations/$ORG/members -H "admin-token: $ADM" | jq 'map({email: .user.email, role: .role})'
curl -sS http://127.0.0.1:3001/api/admin/organizations/$ORG/invites -H "admin-token: $ADM" | jq 'map({email, acceptedAt, expiresAt})'
```

- Public davet register (örnek):
```bash
curl -i -X POST "http://127.0.0.1:3001/api/public/invites/<TOKEN>/register" \
  -H 'Content-Type: application/json' \
  -d '{"password":"Test123456!"}'
```

**Ortam Değişkenleri (Önemli)**
- `FRONTEND_URL`: Davet linki üretimi. Örn: `https://<CODESPACE_NAME>-3000.app.github.dev` veya deploy URL’i.
- `MAIL_PROVIDER=ses`, `AWS_REGION=eu-central-1` vb. SES yapılandırması.
- `CORS_ORIGINS` (prod’da allowlist; dev’de `main.ts` tüm originleri kabul ediyor).

**Bilinen Tıkanma Noktaları ve Çözümleri**
- 401 (public uç): Çoğunlukla axios `Authorization` header’ı gönderildiğinde oluşur → `client.ts` zaten `/public` rota istisnasını içeriyor.
- Blank screen/hook hatası: `JoinOrganizationPage.tsx` içindeki `InvitePasswordForm` refaktörü ile giderildi.
- CORS “Failed to fetch”: Aynı origin debug sayfasını (`debug-api.html`) kullanın ya da backend CORS’u kontrol edin.
- E-posta gelmiyor (SES sandbox): Alıcı email’i doğrulanmalı; admin üzerinden “resend” ile tekrar deneyin.

**Notlar**
- Swagger: `<codespace-3001-url>/api` (docs: `/api/docs`) — route haritalarını ve istekleri doğrulamak için.
- Plan limitleri: `config/plan-limits.json` üzerinden override log’ları başlatırken görünür.
- Statik dosyalar: `backend/public/` altında servis ediliyor; `debug-api.html` buradan çalışır.

**Hızlı Başlangıç (Yeni Sohbet İçin)**
- Backend URL: `https://<CODESPACE_NAME>-3001.app.github.dev`
- Debug sayfası: `https://<CODESPACE_NAME>-3001.app.github.dev/debug-api.html`
- Admin giriş: `owner` / `Z3rdeS-9hQm2!7pK`
- Hedef: `/#join?token=...` ile şifre belirleme → auto-login → üyelik listesinde görünüm.

**Ayarlar Sayfası (Owner Yetkisi)**
- Şirket, Organizasyon, Plan, Mali Dönemler, Bildirimler, Güvenlik ve Gizlilik sekmeleri yalnızca organizasyon sahibi (ROLE=`OWNER` veya `TENANT_ADMIN`) tarafından görünür.
- Diğer roller (örn. `MEMBER`, `ADMIN`) Ayarlar ekranında sadece Profil sekmesini görür; tenant düzeyindeki ayarlar değiştiremez.
- Owner tarafından yapılan Şirket, Plan, Mali Dönemler vb. ayarlar tüm tenant kullanıcıları için geçerli olur (tenant/organization seviyesinde saklanır).

## E-Posta Doğrulama & Outbox Akışı

Bu doküman kullanıcı kayıt (signup) sonrası e-posta doğrulama geri bildirimi, tekrar gönderme (resend) ve gözlemlenebilirlik (EmailOutbox + log) detaylarını özetler.

### 1. Kayıt (Signup)
`EMAIL_VERIFICATION_REQUIRED=true` ise `POST /auth/signup` çağrısı kullanıcı + tenant oluşturur ve doğrulama token'ını (`email_verification_tokens`) kaydeder. Ardından doğrulama e-postası gönderilir.

Frontend `RegisterPage` başarı mesajını kalıcı gösterir ve `pending_verification_email` anahtarını `sessionStorage`'a yazar. Sayfa yenilense bile banner geri gelir.

### 2. Doğrulama Bannerı
Kullanıcı doğrulanana kadar kaybolmaz. Kullanıcı doğrulama linkini tıkladığında `VerifyEmailPage` başarılı sonuçta `pending_verification_email` temizler; reload sonrası banner görünmez.

### 3. Yeniden Gönder (Resend)
`POST /auth/resend-verification` endpoint'i cooldown (varsayılan 60s) kontrolü yapar. Frontend’de hem `RegisterPage` hem `VerifyNoticePage` üzerinde "Tekrar Gönder" düğmeleri bulunur. Cooldown geri sayımı kullanıcıya canlı gösterilir.

### 4. EmailOutbox Tablosu
Her gönderim (SES veya log fallback) `email_outbox` tablosuna kaydedilir: `to, subject, provider, success, messageId, correlationId, userId, tenantId, tokenId, type, createdAt`. Bu tablo audit / operasyonel gözlem için kullanılabilir.

### 5. Log Formatı
Başarılı SES gönderimi:
`📧 [SES EMAIL SENT] to=user@example.com subject="E-posta Doğrulama" meta={...} messageId=ABC123`

Log provider (geliştirme):
`📧 [LOG EMAIL] to=user@example.com subject="E-posta Doğrulama" provider=log meta={...}`

### 6. Korelasyon Alanları
`meta` nesnesi: `userId, tenantId, tokenId, correlationId, type`. Hem logda görünür hem de Outbox kaydına yazılır. Böylece tek bir signup isteğinin tüm e-posta izleri takip edilebilir.

### 7. Temizlik
Doğrulama başarılı olunca frontend `sessionStorage.removeItem('pending_verification_email')` çağırır. Kullanıcı logout olduğunda AuthContext localStorage/sessionStorage temizliği yapar.

### 8. Sorun Giderme
- Banner görünmüyorsa: DevTools > Application > Session Storage içinde `pending_verification_email` var mı kontrol edin.
- Outbox boşsa: Migration çalışmış mı (`email_outbox` tablosu)? Loglarda "email_outbox tablosu yok" uyarısı var mı?
- SES MessageId yoksa: `MAIL_PROVIDER=ses` mi? Sandbox hesabında alıcı doğrulanmış mı?

### 9. Güvenlik Notları
Banner yalnızca kullanıcının girdiği e-posta adresini gösterir; sistem "bu e-posta kayıtlı" bilgisini koşulsuz ifşa etmez. Cooldown brute force denemelerini azaltır.

---
Kısa Akış: Signup → Token kaydı + e-posta → Banner + Resend → Kullanıcı linki tıklar → Token doğrulanır → Banner kaybolur.

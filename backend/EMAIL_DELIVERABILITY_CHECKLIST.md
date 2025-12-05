# Email Deliverability Checklist

Bu dosya üretim ortamına çıkmadan önce MailerSend ve genel email teslim edilebilirliği (deliverability) için kontrol listesidir.

## 1. Kimlik Doğrulama (Authentication)
- [ ] SPF kaydı: `v=spf1 include:spf.mailersend.net -all`
  - Çoklu gönderen (ör. helpdesk, marketing) varsa ilgili sağlayıcıların include mekanizması birleştirildi.
- [ ] DKIM: MailerSend dashboard'unda gösterilen CNAME kayıtları doğrulandı (tümüne `verified` statüsü geldi).
- [ ] DMARC: `v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com; ruf=mailto:dmarc-forensic@yourdomain.com; fo=1`
  - Aşama 1: `p=none`
  - Aşama 2: `p=quarantine`
  - Aşama 3: `p=reject`
- [ ] BIMI (opsiyonel): SVG logonuz + VMC sertifikası hazır (marka görünürlüğü istenirse).

## 2. MailerSend Yapılandırması
- [ ] Domain doğrulanması tamamlandı (SPF + DKIM + DMARC).
- [ ] API Token oluşturuldu ve güvenli şekilde `MAILERSEND_API_KEY` olarak tanımlandı.
- [ ] Webhook oluşturuldu (`/webhooks/mailersend/events`) ve `MAILERSEND_WEBHOOK_SECRET` ile korundu.
- [ ] `activity.hard_bounced`, `activity.soft_bounced`, `activity.complained`, `activity.spam_complaint`, `activity.unsubscribed` event'leri webhook'a seçildi.
- [ ] MailerSend dashboard'unda gönderim kotaları (send rate / günlük limit) ihtiyaçları karşılıyor.
- [ ] Suppression list raporları düzenli kontrol ediliyor; uygulama içi `email_suppression` tablosu güncelleniyor.

## 3. DNS / Network Sağlığı
- [ ] Tüm DNS kayıtları (SPF, DKIM, DMARC) için TTL <= 1 saat (ilk geçişte hız için) sonra 24 saate çıkarıldı.
- [ ] Reverse DNS (PTR) gerekmez (MailerSend shared IP) fakat özel ip pool kullanılıyorsa RDNS yapılandırıldı.
- [ ] MX kayıtları çakışmıyor (aynı domain transactional email + inbound farklıysa alt domain stratejisi). 

## 4. Gönderim Politikası
- [ ] Transactional ve marketing e-postalar farklı alt domain: `tx.yourdomain.com` vs `mkt.yourdomain.com` (önerilir).
- [ ] Rate limit / retry stratejisi belirli (5xx geçici hatalarda exponential backoff).
- [ ] Hard bounce sonrası kullanıcıya yeniden gönderim yapılmıyor (bizde tablo: `email_suppression`).
- [ ] Complaint sonrası ilgili kullanıcıya email tamamen durduruluyor.
- [ ] Unsubscribe (gerekiyorsa) linkleri sadece marketing e-postalarda var. Transactional e-postalarda yok.

## 5. İçerik Kalitesi
- [ ] HTML + Plain text (multipart) sağlanıyor (şu an bazı transactional maillerde sadece HTML -> Plain text eklenmesi planlanmalı).
- [ ] Spam trigger kelimeleri (FREE!!!, $$$ vb.) yok.
- [ ] Link sayısı düşük ve domain tutarlı (phishing şüphesi yok).
- [ ] UTF-8 charset + doğru subject encoding.

## 6. Güvenlik
- [ ] SPF Hard Fail (`-all`) – eğer çok erken spam filtrelenmesi yaşanırsa `~all` ile başlatılıp sonra `-all`a geçilir.
- [ ] DMARC raporları düzenli analiz ediliyor (aggregate XML -> günlük işleniyor).
- [ ] TLS (STARTTLS) zorunlu değil ama büyük sağlayıcılar tarafından destekleniyor; kritik veriler plaintext gönderilmiyor.
- [ ] Link’lerde açık yönlendirme (open redirect) yok.

## 7. İzleme & Metri̇kler
- [ ] MailerSend "Analytics" sekmesinde bounce rate > 5% için alarm veya e-posta bildirimi.
- [ ] Complaint rate > 0.2% olduğunda Slack/ops bildirimi.
- [ ] Kumulatif gönderim hacmi günlük raporu.
- [ ] Suppression tablosu boyutu ve artış hızı (aşırı yükseliş deliverability sorunu göstergesi).

## 8. Test & Doğrulama
- [ ] Mail-Tester.com skoru >= 9/10.
- [ ] Gmail, Outlook, Yahoo test inbox deliverability (Primary/Updates/Social/Spam konum kontrolü) yapıldı.
- [ ] Seed list (farklı sağlayıcılar) ile A/B izleme – ilk hafta.

## 9. Operasyonel Prosedürler
- [ ] Bounce/Complaint günlük özet Slack bildirimi (opsiyonel entegrasyon henüz yok; planlanabilir).
- [ ] Major içerik şablon değişikliklerinde tekrar SPF/DKIM/DMARC test akışı.
- [ ] Domain reputation düşerse (Google Postmaster Tools, SNDS) hacim azaltma planı.

## 10. Uygulama Entegrasyonu Gap Analizi
| Alan | Durum | Not |
|------|-------|-----|
| Suppression tablo entegrasyonu | Tamam | bounce/complaint + manual delete |
| Plain text fallback | Kısmi | Bazı mailler yalnız HTML (iyileştir) |
| MailerSend webhook health | Var | `/webhooks/mailersend/events` + shared secret |
| MailerSend signature/paylaşılan secret | Var | Header kontrolü ile doğrulama |
| Rate limit (resend/forgot) | Var | Env üzerinden |
| Audit log | Kısmi | Webhook event’leri audit’e eklenebilir |
| Scheduled deliverability report | Eksik | Gelecekte eklenebilir |

## 11. İleri Adımlar (Roadmap)
- [ ] Plain text fallback tüm transactional maillerde.
- [ ] Slack/Webhook alarm modülü.
- [ ] Open/click tracking (isteğe bağlı) + gizlilik değerlendirmesi.
- [ ] Domain warm-up otomasyon (yüksek hacimde gerekirse).

---
Bu checklist prod dağıtım öncesi gözden geçirilip işaretlenmelidir.

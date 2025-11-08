# SES Bounce/Complaint Entegrasyonu (SNS ile)

Bu doküman, Amazon SES üzerinden gönderilen e-postalar için bounce (geri dönme) ve complaint (şikayet) olaylarını izlemek üzere Amazon SNS entegrasyonunun nasıl yapılacağını ve uygulamada nasıl işleneceğini anlatır. Amaç: deliverability ve itibar yönetimi, problemli adreslerin otomatik bastırılması (suppression), audit ve metrikler.

## 1) Genel Akış
- SES ile email gönderilir (mevcut EmailService).
- SES bir Configuration Set üzerinden olayları “Event destination” olarak SNS Topic’e yollar.
- SNS Topic, HTTPS (veya SQS, email) subscription’a mesaj gönderir.
- Uygulama, `/webhooks/ses/sns` (örnek) endpoint’inde SNS Notification’ı alır.
- Mesaj doğrulanır (Signature check + `x-amz-sns-message-type`), event `bounce`/`complaint` ayrıştırılır.
- İlgili kullanıcı/email suppression listesine alınır, gerekiyorsa audit kaydı yazılır ve oranlar izlenir.

## 2) AWS Tarafı Kurulum Adımları

1. SNS Topic oluşturun (tercihen iki ayrı topic):
   - `ses-bounce-topic`
   - `ses-complaint-topic`

2. Topic’lere HTTPS Subscription ekleyin:
   - Protocol: HTTPS
   - Endpoint: `https://<backend-host>/webhooks/ses/sns`
   - Not: İlk mesaj `SubscriptionConfirmation` olur; uygulama bunu otomatik onaylamalı (bkz. örnek kod).

3. SES Configuration Set oluşturun (örnek: `moneyflow-prod`):
   - Events: Bounce, Complaint, Delivery (opsiyonel) seçin.
   - Event destination olarak “SNS” ekleyin, ilgili Topic ARN’lerini bağlayın.

4. (Opsiyonel) SES’te default configuration set atayın veya uygulamada mail gönderirken Header ile config set kullanın:
   - Header: `X-SES-CONFIGURATION-SET: moneyflow-prod`

5. (Opsiyonel) IAM izinleri ve SNS Topic policy:
   - SNS Topic policy’sinde `Principal` olarak `ses.amazonaws.com` ekli olduğundan emin olun (SES’in yayın yapabilmesi için).

## 3) Ortam Değişkenleri
`.env` (ve `backend/.env.example`) içine aşağıdakileri ekleyin:

```
# SES / SNS
SES_CONFIGURATION_SET=moneyflow-prod
SNS_TOPIC_ARN_BOUNCE=arn:aws:sns:eu-central-1:123456789012:ses-bounce-topic
SNS_TOPIC_ARN_COMPLAINT=arn:aws:sns:eu-central-1:123456789012:ses-complaint-topic
# HTTPS Subscription endpoint için doğrulama anahtarı (opsiyonel ekstra güvenlik)
SNS_WEBHOOK_SHARED_SECRET=
```

> Not: HTTPS endpoint’iniz public erişilebilir olmalı. Geliştirme ortamında GitHub Codespaces veya ngrok benzeri tünelleme kullanılabilir.

## 4) Webhook Endpoint Taslağı (NestJS)
Aşağıdaki örnek, SNS HTTP(S) mesajlarını işlemek için bir controller taslağıdır. İmza doğrulaması için `sns-validator` paketini kullanabilirsiniz.

```ts
// src/webhooks/ses-sns.controller.ts
import { Body, Controller, Headers, Post, Req, Res } from '@nestjs/common';
import { Response, Request } from 'express';
import SNSValidator from 'sns-validator';

@Controller('webhooks/ses')
export class SesSnsController {
  private validator = new SNSValidator();

  @Post('sns')
  async handle(@Body() body: any, @Headers() headers: Record<string, string>, @Req() req: Request, @Res() res: Response) {
    // 1) Header kontrolü
    const msgType = headers['x-amz-sns-message-type'];
    if (!msgType) return res.status(400).json({ ok: false, error: 'Missing SNS message type' });

    // 2) SNS signature doğrulaması
    await new Promise<void>((resolve, reject) => {
      this.validator.validate(body, (err: any) => (err ? reject(err) : resolve()));
    });

    // 3) SubscriptionConfirmation ise ConfirmSubscription çağrısı
    if (msgType === 'SubscriptionConfirmation') {
      // body.SubscribeURL'ye GET yaparak onaylayın (axios/fetch). Tek seferlik.
      // Güvenlik için domain allowlist kullanın ve loglayın.
      return res.json({ ok: true, subscribed: true });
    }

    if (msgType === 'Notification') {
      const message = JSON.parse(body.Message);
      // SES Notification formatı:
      // message.notificationType in ['Bounce','Complaint','Delivery']
      switch (message.notificationType) {
        case 'Bounce': {
          const bouncedRecipients = message.bounce?.bouncedRecipients ?? [];
          // TODO: adresleri suppression listesine ekle, audit logla
          break;
        }
        case 'Complaint': {
          const complainedRecipients = message.complaint?.complainedRecipients ?? [];
          // TODO: adresleri suppression listesine ekle, audit logla
          break;
        }
        case 'Delivery': {
          // Opsiyonel: metrik/istatistik
          break;
        }
      }
      return res.json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'Unsupported message type' });
  }
}
```

> İmza doğrulaması kritik önemdedir. Alternatif olarak AWS’nin resmi yönergeleriyle X.509 sertifikasını indirip manuel doğrulama yapabilirsiniz. Üzerine ek bir `SNS_WEBHOOK_SHARED_SECRET` kontrolü ile endpoint’e gelen istekleri sınırlandırmanız önerilir.

## 5) Uygulama-İçi İş Kuralları (Öneriler)
- Suppression List: `email_suppression` tablosu (email, reason, createdAt). Bounce/Complaint durumunda buraya yazın ve outbound mail göndermeden önce kontrol edin.
- Audit: `audit` modülüne “email_bounce”, “email_complaint” event’leri işlenebilir.
- Rate-Limit: `/webhooks/ses/sns` endpoint’ine IP bazlı rate-limit uygulayın (düşük ama var).
- Monitoring: Bounce ve Complaint oranları için günlük/haftalık rapor.

## 6) Test
- SNS Topic’te Subscription status “Confirmed” olmalı.
- SES Configuration Set içinde test gönderimi yapın. CloudWatch Logs veya SNS Delivery Status ile doğrulayın.
- Uygulama loglarında Notification içeriği görülsün; suppression listesi güncellensin.

## 7) Üretim Notları
- Domaininiz için SPF/DKIM/DMARC kayıtları tamamlanmış olmalı.
- Bounce/Complaint oranları alarm eşikleri belirleyin (ör. bounce > %2 uyarı).
- Suppression listesi süresi (ör. 30 gün) ve istisnalar (kurumsal catch-all vb.) politikasını tanımlayın.

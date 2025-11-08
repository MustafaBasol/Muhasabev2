import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailSuppression } from '../email/entities/email-suppression.entity';
// sns-validator paketinin default export'u tip bildirimleri olmadığından any olarak ele alınıyor

const SNSValidator = require('sns-validator');

@Controller('webhooks/ses')
export class SesSnsController {
  private readonly validator = new SNSValidator();
  constructor(
    @InjectRepository(EmailSuppression)
    private readonly suppressionRepo: Repository<EmailSuppression>,
  ) {}

  @Post('sns')
  @HttpCode(200)
  async handle(@Body() body: any, @Headers() headers: Record<string, string>) {
    // Basit paylaşılan gizli anahtar doğrulaması (opsiyonel)
    const shared = process.env.SNS_WEBHOOK_SHARED_SECRET || '';
    const headerSecret =
      headers['x-sns-shared-secret'] || headers['x-sns-secret'];
    if (shared && headerSecret !== shared) {
      return { ok: false };
    }

    const type = headers['x-amz-sns-message-type'];
    if (!type) {
      return { ok: false, error: 'missing-type' };
    }

    // SNS Signature doğrulaması (SubscriptionConfirmation ve Notification için)
    try {
      await new Promise<void>((resolve, reject) => {
        // validator body olarak SNS zarfını bekler
        this.validator.validate(body, (err: any) =>
          err ? reject(err) : resolve(),
        );
      });
    } catch (e) {
      return { ok: false, error: 'invalid-signature' };
    }

    // SubscriptionConfirmation case: sadece OK dön (operasyonel onayı manuel yapabilirsiniz)
    if (type === 'SubscriptionConfirmation') {
      return { ok: true, subscribed: true };
    }

    if (type === 'Notification') {
      try {
        const message =
          typeof body.Message === 'string'
            ? JSON.parse(body.Message)
            : body.Message;
        const notificationType = message?.notificationType;

        if (notificationType === 'Bounce') {
          const recipients: Array<{ emailAddress: string }> =
            message?.bounce?.bouncedRecipients || [];
          for (const r of recipients) {
            const email = (r.emailAddress || '').trim().toLowerCase();
            if (!email) continue;
            await this.suppressionRepo
              .createQueryBuilder()
              .insert()
              .into(EmailSuppression)
              .values({ email, reason: 'bounce' })
              .orIgnore()
              .execute();
          }
        } else if (notificationType === 'Complaint') {
          const recipients: Array<{ emailAddress: string }> =
            message?.complaint?.complainedRecipients || [];
          for (const r of recipients) {
            const email = (r.emailAddress || '').trim().toLowerCase();
            if (!email) continue;
            await this.suppressionRepo
              .createQueryBuilder()
              .insert()
              .into(EmailSuppression)
              .values({ email, reason: 'complaint' })
              .orIgnore()
              .execute();
          }
        }
      } catch (e) {
        return { ok: false, error: 'parse-failed' };
      }
      return { ok: true };
    }

    return { ok: false, error: 'unsupported-type' };
  }
}

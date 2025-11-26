import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import SNSValidator from 'sns-validator';
import { EmailSuppression } from '../email/entities/email-suppression.entity';
// sns-validator paketinin default export'u tip bildirimleri olmadığından any olarak ele alınıyor

interface SnsNotificationBase {
  notificationType?: 'Bounce' | 'Complaint';
}

interface BounceNotification extends SnsNotificationBase {
  notificationType: 'Bounce';
  bounce?: {
    bouncedRecipients?: Array<{ emailAddress?: string }>;
  };
}

interface ComplaintNotification extends SnsNotificationBase {
  notificationType: 'Complaint';
  complaint?: {
    complainedRecipients?: Array<{ emailAddress?: string }>;
  };
}

type SnsEnvelope = {
  Message: string;
};

type ValidatorCallback = (err: Error | null) => void;

type SnsValidatorLike = {
  validate: (message: unknown, cb: ValidatorCallback) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const createValidator = (): SnsValidatorLike => {
  const ValidatorCtor = SNSValidator as { new (): unknown };
  const instance: unknown = new ValidatorCtor();
  if (
    isRecord(instance) &&
    'validate' in instance &&
    typeof instance.validate === 'function'
  ) {
    return instance as SnsValidatorLike;
  }
  throw new Error('SNS validator instance missing validate method');
};

const isBounceNotification = (
  message: unknown,
): message is BounceNotification => {
  if (!isRecord(message)) {
    return false;
  }
  const typeValue = message.notificationType;
  return typeof typeValue === 'string' && typeValue === 'Bounce';
};

const isComplaintNotification = (
  message: unknown,
): message is ComplaintNotification => {
  if (!isRecord(message)) {
    return false;
  }
  const typeValue = message.notificationType;
  return typeof typeValue === 'string' && typeValue === 'Complaint';
};

@Controller('webhooks/ses')
export class SesSnsController {
  private readonly validator: SnsValidatorLike = createValidator();
  constructor(
    @InjectRepository(EmailSuppression)
    private readonly suppressionRepo: Repository<EmailSuppression>,
  ) {}

  @Post('sns')
  @HttpCode(200)
  async handle(
    @Body() body: SnsEnvelope,
    @Headers() headers: Record<string, string>,
  ) {
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
        this.validator.validate(body, (err: Error | null) =>
          err ? reject(err) : resolve(),
        );
      });
    } catch {
      return { ok: false, error: 'invalid-signature' };
    }

    // SubscriptionConfirmation case: sadece OK dön (operasyonel onayı manuel yapabilirsiniz)
    if (type === 'SubscriptionConfirmation') {
      return { ok: true, subscribed: true };
    }

    if (type === 'Notification') {
      try {
        const message: unknown = JSON.parse(body.Message);

        if (isBounceNotification(message)) {
          const recipients: Array<{ emailAddress?: string }> =
            message.bounce?.bouncedRecipients || [];
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
        } else if (isComplaintNotification(message)) {
          const recipients: Array<{ emailAddress?: string }> =
            message.complaint?.complainedRecipients || [];
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
      } catch {
        return { ok: false, error: 'parse-failed' };
      }
      return { ok: true };
    }

    return { ok: false, error: 'unsupported-type' };
  }
}

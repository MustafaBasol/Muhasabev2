import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailSuppression } from '../email/entities/email-suppression.entity';

interface MailerSendRecipient {
  email?: string;
}

interface MailerSendEvent {
  type?: string;
  data?: {
    email?: string;
    recipient?: MailerSendRecipient;
    to?: MailerSendRecipient[];
    reason?: string;
    status?: string;
  };
}

const SUPPRESSION_EVENT_PREFIX = 'activity.';
type MailerSendSuppressionEvent =
  | 'activity.hard_bounced'
  | 'activity.soft_bounced'
  | 'activity.complained'
  | 'activity.spam_complaint'
  | 'activity.unsubscribed';

const SUPPRESSION_EVENT_TYPES = new Set<MailerSendSuppressionEvent>([
  'activity.hard_bounced',
  'activity.soft_bounced',
  'activity.complained',
  'activity.spam_complaint',
  'activity.unsubscribed',
]);

@Controller('webhooks/mailersend')
export class MailerSendWebhookController {
  constructor(
    @InjectRepository(EmailSuppression)
    private readonly suppressionRepo: Repository<EmailSuppression>,
  ) {}

  private normalizeEvents(
    payload: MailerSendEvent | MailerSendEvent[] | undefined,
  ): MailerSendEvent[] {
    if (!payload) {
      return [];
    }
    return Array.isArray(payload) ? payload : [payload];
  }

  private shouldSuppress(eventType?: string): boolean {
    if (!eventType) {
      return false;
    }
    if (SUPPRESSION_EVENT_TYPES.has(eventType as MailerSendSuppressionEvent)) {
      return true;
    }
    return (
      eventType.startsWith(SUPPRESSION_EVENT_PREFIX) &&
      (eventType.includes('bounced') || eventType.includes('complaint'))
    );
  }

  private extractEmail(event: MailerSendEvent): string | null {
    const direct = event.data?.email || event.data?.recipient?.email;
    if (direct) {
      const trimmed = direct.trim().toLowerCase();
      if (trimmed) {
        return trimmed;
      }
    }
    const first = event.data?.to?.[0]?.email?.trim().toLowerCase();
    return first || null;
  }

  private async suppressEmail(email: string, reason: string): Promise<void> {
    await this.suppressionRepo
      .createQueryBuilder()
      .insert()
      .into(EmailSuppression)
      .values({ email, reason })
      .orIgnore()
      .execute();
  }

  @Post('events')
  @HttpCode(200)
  async handle(
    @Body() body: MailerSendEvent | MailerSendEvent[],
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const sharedSecret = process.env.MAILERSEND_WEBHOOK_SECRET || '';
    const providedSecret =
      (headers['x-mailersend-signature'] as string) ||
      (headers['x-mailersend-secret'] as string) ||
      (headers['x-mailersend-token'] as string) ||
      (headers['x-shared-secret'] as string) ||
      '';

    if (sharedSecret && providedSecret !== sharedSecret) {
      return { ok: false, error: 'unauthorized' };
    }

    const events = this.normalizeEvents(body);
    if (!events.length) {
      return { ok: true, suppressed: 0 };
    }

    let suppressed = 0;
    for (const event of events) {
      if (!this.shouldSuppress(event.type)) {
        continue;
      }
      const email = this.extractEmail(event);
      if (!email) {
        continue;
      }
      const reason = `mailersend:${event.type || 'unknown'}`;
      await this.suppressEmail(email, reason.slice(0, 64));
      suppressed += 1;
    }

    return { ok: true, suppressed };
  }
}

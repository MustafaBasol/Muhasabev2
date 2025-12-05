import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailSuppression } from '../email/entities/email-suppression.entity';
import { EmailOutbox } from '../email/entities/email-outbox.entity';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  // İsteğe bağlı gözlemlenebilirlik metası (loglarda görünür)
  meta?: {
    userId?: string;
    tenantId?: string;
    tokenId?: string; // verification/reset token kaydı
    correlationId?: string; // istek/işlem korelasyon kimliği
    type?: 'verify' | 'verify-resend' | 'reset' | 'welcome';
  };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private parseAddress(input: string): { email: string; name?: string } | null {
    if (!input) return null;
    const trimmed = input.trim();
    const match = trimmed.match(/^(.*)<([^>]+)>$/);
    if (match) {
      const name = match[1].trim().replace(/^"|"$/g, '');
      const email = match[2].trim();
      if (email) {
        return { email, name: name || undefined };
      }
    }
    if (trimmed.includes(' ')) {
      return { email: trimmed.split(' ').pop() || trimmed };
    }
    return { email: trimmed };
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  private getErrorCode(error: unknown): string {
    if (typeof error === 'object' && error !== null) {
      const candidate =
        (error as { Code?: unknown }).Code ??
        (error as { code?: unknown }).code;
      if (typeof candidate === 'string') {
        return candidate;
      }
    }
    return 'UnknownError';
  }

  private toError(error: unknown): Error {
    return error instanceof Error
      ? error
      : new Error(this.getErrorMessage(error));
  }

  constructor(
    @InjectRepository(EmailSuppression)
    private readonly suppressionRepo: Repository<EmailSuppression>,
    @InjectRepository(EmailOutbox)
    private readonly outboxRepo: Repository<EmailOutbox>,
  ) {}

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const provider = (process.env.MAIL_PROVIDER || 'log').toLowerCase();
    const from = process.env.MAIL_FROM || 'no-reply@example.com';
    const replyTo = process.env.MAIL_REPLY_TO || '';
    this.logger.debug(
      `[EMAIL INIT] provider=${provider} from=${from} replyTo=${replyTo || 'n/a'}`,
    );

    // Suppression kontrolü (lowercase)
    const normalizedTo = options.to.trim().toLowerCase();
    let suppressed: EmailSuppression | null = null;
    try {
      suppressed = await this.suppressionRepo.findOne({
        where: { email: normalizedTo },
      });
    } catch (err: unknown) {
      // Tablo henüz migration çalıştırılmadığı için yoksa (relation does not exist) gracefully degrade
      const msg = this.getErrorMessage(err).toLowerCase();
      if (
        msg.includes('does not exist') ||
        (msg.includes('relation') && msg.includes('email_suppression'))
      ) {
        this.logger.warn(
          '⚠️ email_suppression tablosu bulunamadı (migration çalıştırılmamış olabilir). Suppression kontrolü devre dışı, gönderim devam ediyor.',
        );
      } else {
        this.logger.error(
          'Suppression sorgusu beklenmeyen hata verdi:',
          this.toError(err),
        );
      }
    }
    if (suppressed) {
      this.logger.warn(
        `✋ Email suppressed; skipping send. to=${normalizedTo} reason=${suppressed.reason}`,
      );
      return false; // gönderilmedi
    }

    let success = false;
    let messageId: string | undefined;

    if (provider === 'mailersend') {
      const apiKey = process.env.MAILERSEND_API_KEY || process.env.MAILERSEND_TOKEN || '';
      if (!apiKey) {
        this.logger.warn(
          '⚠️ MAIL_PROVIDER=mailersend ancak MAILERSEND_API_KEY tanımlı değil; log fallback kullanılacak.',
        );
      } else {
        try {
          const sender = this.parseAddress(from);
          if (!sender?.email) {
            throw new Error('MAIL_FROM geçerli bir e-posta içermiyor');
          }
          const replyToAddress = replyTo ? this.parseAddress(replyTo) : null;
          const payload = {
            from: {
              email: sender.email,
              name: sender.name,
            },
            to: [{ email: options.to }],
            subject: options.subject,
            text: options.text || undefined,
            html: options.html || undefined,
            reply_to: replyToAddress?.email
              ? {
                  email: replyToAddress.email,
                  name: replyToAddress.name,
                }
              : undefined,
          };
          const res = await fetch('https://api.mailersend.com/v1/email', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          const body = await res.json().catch(() => null);
          if (!res.ok) {
            const code = body?.error?.code || res.status;
            const detail = body?.error?.message || res.statusText;
            throw new Error(`MailerSend API error code=${code} detail=${detail}`);
          }
          const msgId =
            typeof body?.message_id === 'string'
              ? body.message_id
              : typeof body?.data?.id === 'string'
                ? body.data.id
                : undefined;
          const metaStr = options.meta
            ? ` meta=${JSON.stringify(options.meta)}`
            : '';
          this.logger.log(
            `📧 [MAILERSEND EMAIL SENT] to=${options.to} subject="${options.subject}"${metaStr} messageId=${msgId || 'n/a'}`,
          );
          success = true;
          messageId = msgId;
        } catch (err: unknown) {
          const code = this.getErrorCode(err);
          const msg = this.getErrorMessage(err);
          this.logger.error(
            `❌ [MAILERSEND SEND FAILED] code=${code} message=${msg} → log fallback`,
            this.toError(err),
          );
        }
      }
    }

    if (provider === 'smtp') {
      // Placeholder: implement Nodemailer SMTP integration here if needed.
      // For now, fallback to log to avoid dependency bloat.
      this.logger.warn(
        'SMTP provider selected but not implemented. Falling back to log.',
      );
    }

    // Default / fallback: log simulated email
    const metaStr = options.meta ? ` meta=${JSON.stringify(options.meta)}` : '';
    this.logger.log(
      `📧 [LOG EMAIL] to=${options.to} subject="${options.subject}" provider=${provider}${metaStr}${success && messageId ? ` (originalId=${messageId})` : ''}`,
    );
    if (options.html) {
      this.logger.debug(options.html.substring(0, 500));
    } else if (options.text) {
      this.logger.debug(options.text.substring(0, 500));
    }
    if (!success) success = true; // log provider treated as success

    // Outbox kaydı (best-effort, hata olsa göndermeyi etkilemesin)
    try {
      await this.outboxRepo.save(
        this.outboxRepo.create({
          to: options.to,
          subject: options.subject,
          provider,
          success,
          messageId: messageId || null,
          correlationId: options.meta?.correlationId || null,
          userId: options.meta?.userId || null,
          tenantId: options.meta?.tenantId || null,
          tokenId: options.meta?.tokenId || null,
          type: options.meta?.type || null,
        }),
      );
    } catch (err: unknown) {
      const msg = this.getErrorMessage(err).toLowerCase();
      if (msg.includes('does not exist') && msg.includes('email_outbox')) {
        this.logger.warn(
          '⚠️ email_outbox tablosu yok (migration henüz çalışmamış). Outbox kayıt atlandı.',
        );
      } else {
        this.logger.error('EmailOutbox kayıt hatası:', this.toError(err));
      }
    }

    return success;
  }

  async sendAccountDeletionConfirmation(
    userEmail: string,
    userName: string,
  ): Promise<boolean> {
    const subject = 'Account Deletion Request Confirmation';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Account Deletion Request</h2>
        
        <p>Dear ${userName},</p>
        
        <p>We have received your request to delete your account. This email confirms that your deletion request has been submitted successfully.</p>
        
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #92400e; margin: 0 0 10px 0;">⚠️ Important Information</h3>
          <ul style="color: #92400e; margin: 0;">
            <li>Your account will be permanently deleted within 7 business days</li>
            <li>All personal data will be removed from our systems</li>
            <li>Accounting records will be retained for 10 years due to legal requirements</li>
            <li>This action cannot be undone once processing begins</li>
          </ul>
        </div>
        
        <p>If you did not request this deletion or have changed your mind, please contact our support team immediately at:</p>
        
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Support Email:</strong> support@comptario.com</p>
          <p style="margin: 5px 0 0 0;"><strong>Support Phone:</strong> +90 (212) 123-4567</p>
        </div>
        
        <p>Thank you for using our service.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        
        <p style="font-size: 12px; color: #6b7280;">
          This is an automated message. Please do not reply to this email.<br>
          Comptario Accounting System | Istanbul, Turkey
        </p>
      </div>
    `;

    const text = `
Account Deletion Request Confirmation

Dear ${userName},

We have received your request to delete your account. This email confirms that your deletion request has been submitted successfully.

IMPORTANT INFORMATION:
- Your account will be permanently deleted within 7 business days
- All personal data will be removed from our systems
- Accounting records will be retained for 10 years due to legal requirements
- This action cannot be undone once processing begins

If you did not request this deletion or have changed your mind, please contact our support team immediately:

Support Email: support@comptario.com
Support Phone: +90 (212) 123-4567

Thank you for using our service.

---
This is an automated message. Please do not reply to this email.
Comptario Accounting System | Istanbul, Turkey
    `;

    return this.sendEmail({
      to: userEmail,
      subject,
      text,
      html,
    });
  }

  async sendDataExportNotification(
    userEmail: string,
    userName: string,
  ): Promise<boolean> {
    const subject = 'Your Data Export is Ready';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Data Export Completed</h2>
        
        <p>Dear ${userName},</p>
        
        <p>Your personal data export has been successfully generated and downloaded.</p>
        
        <div style="background-color: #ecfdf5; border: 1px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #047857; margin: 0 0 10px 0;">📦 Export Details</h3>
          <ul style="color: #047857; margin: 0;">
            <li>Export Date: ${new Date().toLocaleDateString()}</li>
            <li>Format: ZIP archive containing JSON and CSV files</li>
            <li>Includes: All your personal data and transaction history</li>
            <li>GDPR Compliant: Full data portability rights exercised</li>
          </ul>
        </div>
        
        <p>The exported data includes:</p>
        <ul>
          <li>Profile information</li>
          <li>Company details</li>
          <li>Invoices and expenses</li>
          <li>Customer and supplier data</li>
          <li>Product information</li>
          <li>Financial transactions</li>
        </ul>
        
        <p>If you have any questions about your data export, please contact our support team:</p>
        
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Support Email:</strong> support@comptario.com</p>
          <p style="margin: 5px 0 0 0;"><strong>Support Phone:</strong> +90 (212) 123-4567</p>
        </div>
        
        <p>Thank you for using our service.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        
        <p style="font-size: 12px; color: #6b7280;">
          This is an automated message. Please do not reply to this email.<br>
          Comptario Accounting System | Istanbul, Turkey
        </p>
      </div>
    `;

    return this.sendEmail({
      to: userEmail,
      subject,
      html,
    });
  }
}

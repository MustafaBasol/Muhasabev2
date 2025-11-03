import { Injectable, Logger } from '@nestjs/common';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Simulated email sending for demo purposes
      // In production, integrate with SendGrid, AWS SES, Nodemailer, etc.

      this.logger.log(`📧 [SIMULATED EMAIL SENT]`);
      this.logger.log(`To: ${options.to}`);
      this.logger.log(`Subject: ${options.subject}`);
      this.logger.log(`Content: ${options.text || options.html}`);
      this.logger.log(`─────────────────────────────────────`);

      // Simulate email sending delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return true;
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      return false;
    }
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
          <p style="margin: 0;"><strong>Support Email:</strong> support@moneyflow.com</p>
          <p style="margin: 5px 0 0 0;"><strong>Support Phone:</strong> +90 (212) 123-4567</p>
        </div>
        
        <p>Thank you for using our service.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        
        <p style="font-size: 12px; color: #6b7280;">
          This is an automated message. Please do not reply to this email.<br>
          MoneyFlow Accounting System | Istanbul, Turkey
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

Support Email: support@moneyflow.com
Support Phone: +90 (212) 123-4567

Thank you for using our service.

---
This is an automated message. Please do not reply to this email.
MoneyFlow Accounting System | Istanbul, Turkey
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
          <p style="margin: 0;"><strong>Support Email:</strong> support@moneyflow.com</p>
          <p style="margin: 5px 0 0 0;"><strong>Support Phone:</strong> +90 (212) 123-4567</p>
        </div>
        
        <p>Thank you for using our service.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        
        <p style="font-size: 12px; color: #6b7280;">
          This is an automated message. Please do not reply to this email.<br>
          MoneyFlow Accounting System | Istanbul, Turkey
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

import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get('email')
  getEmailHealth() {
    const provider = (process.env.MAIL_PROVIDER || 'log').toLowerCase();
    const from = process.env.MAIL_FROM || '';
    const region = process.env.AWS_REGION || process.env.SES_REGION || '';
    const frontendUrl =
      process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || '';
    const sandboxNote =
      provider === 'ses'
        ? 'If SES is in sandbox, only verified recipients will receive emails'
        : '';
    return {
      provider,
      fromConfigured: !!from,
      from,
      region,
      frontendUrl,
      mode: provider,
      note: sandboxNote,
      verificationRequired:
        String(process.env.EMAIL_VERIFICATION_REQUIRED || '').toLowerCase() ===
        'true',
    };
  }
}

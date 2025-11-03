import { Controller, Get } from '@nestjs/common';

@Controller('api/subprocessors')
export class SubprocessorsController {
  // Hardcoded data for now - will be replaced with proper JSON loading later
  private readonly subprocessorsData = {
    lastUpdated: '2024-10-30T00:00:00.000Z',
    version: '1.0',
    subprocessors: [
      {
        id: 'aws',
        provider: 'Amazon Web Services (AWS)',
        purpose: 'Cloud infrastructure and data storage',
        region: 'US, EU',
        dataCategories: 'User data, application logs, backups',
        dpaLink: 'https://aws.amazon.com/compliance/data-privacy-faq/',
        securityCertifications: ['SOC 2', 'ISO 27001', 'GDPR compliant'],
      },
      {
        id: 'stripe',
        provider: 'Stripe Inc.',
        purpose: 'Payment processing and billing',
        region: 'US, EU',
        dataCategories: 'Payment information, transaction data',
        dpaLink: 'https://stripe.com/privacy',
        securityCertifications: ['PCI DSS', 'SOC 2', 'ISO 27001'],
      },
      {
        id: 'sendgrid',
        provider: 'SendGrid (Twilio)',
        purpose: 'Email delivery and notifications',
        region: 'US',
        dataCategories: 'Email addresses, email content',
        dpaLink: 'https://www.twilio.com/legal/privacy',
        securityCertifications: ['SOC 2', 'ISO 27001'],
      },
      {
        id: 'google-analytics',
        provider: 'Google LLC',
        purpose: 'Website analytics and performance monitoring',
        region: 'Global',
        dataCategories: 'Usage data, IP addresses (anonymized)',
        dpaLink: 'https://privacy.google.com/businesses/compliance/',
        securityCertifications: [
          'ISO 27001',
          'SOC 2',
          'Privacy Shield (legacy)',
        ],
      },
      {
        id: 'cloudflare',
        provider: 'Cloudflare Inc.',
        purpose: 'CDN, DDoS protection, and web security',
        region: 'Global',
        dataCategories: 'Web traffic data, security logs',
        dpaLink:
          'https://www.cloudflare.com/trust-hub/privacy-and-data-protection/',
        securityCertifications: ['SOC 2', 'ISO 27001', 'PCI DSS'],
      },
    ],
    changelog: [
      {
        date: '2024-10-30',
        version: '1.0',
        changes: [
          'Initial subprocessors list created',
          'Added AWS, Stripe, SendGrid, Google Analytics, and Cloudflare',
        ],
      },
    ],
  };

  @Get()
  async getSubprocessors() {
    console.log('📍 SubprocessorsController: Returning hardcoded data');
    console.log(
      '📍 Subprocessors count:',
      this.subprocessorsData.subprocessors.length,
    );
    return this.subprocessorsData;
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'subprocessors-api',
    };
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SesSnsController } from './ses-sns.controller';
import { EmailSuppression } from '../email/entities/email-suppression.entity';
import { StripeWebhookController } from './stripe.controller';
import { Tenant } from '../tenants/entities/tenant.entity';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailSuppression, Tenant]),
    BillingModule,
  ],
  controllers: [SesSnsController, StripeWebhookController],
})
export class WebhooksModule {}

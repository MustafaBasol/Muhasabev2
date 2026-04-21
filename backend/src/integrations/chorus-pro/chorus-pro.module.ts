import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { InvoiceLine } from '../../invoices/entities/invoice-line.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { IntegrationsCommonModule } from '../common/integrations-common.module';
import { ChorusProApiClient } from './services/chorus-pro-api.client';
import { ChorusProOAuthService } from './services/chorus-pro-oauth.service';
import { ChorusProSubmitService } from './services/chorus-pro-submit.service';
import { ChorusProController } from './chorus-pro.controller';

/**
 * ChorusProModule
 *
 * Chorus Pro (B2G) e-invoicing entegrasyon modülü.
 *
 * Servisler:
 *  - ChorusProApiClient      — PISTE OAuth + Chorus Pro REST HTTP istemcisi
 *  - ChorusProOAuthService   — Tenant credentials bağlama / çözme
 *  - ChorusProSubmitService  — IEInvoicingProvider implementasyonu
 *
 * Controller: /integrations/chorus-pro/** yollarını karşılar.
 *
 * Önemli: ChorusProApiClient, uygulama genelinde PISTE token'ını önbellekte
 * tutar. Bu nedenle singleton scope uygundur (NestJS varsayılanı).
 */
@Module({
  imports: [
    IntegrationsCommonModule,
    TypeOrmModule.forFeature([Invoice, InvoiceLine, Customer]),
  ],
  controllers: [ChorusProController],
  providers: [
    ChorusProApiClient,
    ChorusProOAuthService,
    ChorusProSubmitService,
  ],
  exports: [
    ChorusProSubmitService,
    ChorusProOAuthService,
  ],
})
export class ChorusProModule {}

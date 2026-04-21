import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { InvoiceLine } from '../../invoices/entities/invoice-line.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { IntegrationsCommonModule } from '../common/integrations-common.module';
import { PennylaneApiClient } from './services/pennylane-api.client';
import { PennylaneOAuthService } from './services/pennylane-oauth.service';
import { PennylaneSubmitService } from './services/pennylane-submit.service';
import { PennylaneStatusSyncService } from './services/pennylane-status-sync.service';
import { PennylaneController } from './pennylane.controller';

/**
 * PennylaneModule
 *
 * Pennylane e-invoicing entegrasyon modülü.
 *
 * Servisler:
 *  - PennylaneApiClient       — HTTP istemci (Pennylane REST API v2)
 *  - PennylaneOAuthService    — OAuth 2.0 authorization code flow
 *  - PennylaneSubmitService   — IEInvoicingProvider implementasyonu
 *  - PennylaneStatusSyncService — Changelog polling ile durum senkronizasyonu
 *
 * Controller: /integrations/pennylane/** yollarını karşılar.
 *
 * Bağımlılıklar:
 *  - IntegrationsCommonModule → ProviderAccountService, IntegrationLogService
 *  - TypeOrmModule (Invoice, InvoiceLine, Customer)
 */
@Module({
  imports: [
    IntegrationsCommonModule,
    TypeOrmModule.forFeature([Invoice, InvoiceLine, Customer]),
  ],
  controllers: [PennylaneController],
  providers: [
    PennylaneApiClient,
    PennylaneOAuthService,
    PennylaneSubmitService,
    PennylaneStatusSyncService,
  ],
  exports: [
    PennylaneSubmitService,
    PennylaneStatusSyncService,
    PennylaneOAuthService,
  ],
})
export class PennylaneModule {}

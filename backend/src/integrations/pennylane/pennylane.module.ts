import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { InvoiceLine } from '../../invoices/entities/invoice-line.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Expense } from '../../expenses/entities/expense.entity';
import { IntegrationsCommonModule } from '../common/integrations-common.module';
import { PennylaneApiClient } from './services/pennylane-api.client';
import { PennylaneOAuthService } from './services/pennylane-oauth.service';
import { PennylaneSubmitService } from './services/pennylane-submit.service';
import { PennylaneStatusSyncService } from './services/pennylane-status-sync.service';
import { PennylaneIncomingInvoiceService } from './services/pennylane-incoming-invoice.service';
import { PennylaneController } from './pennylane.controller';

@Module({
  imports: [
    IntegrationsCommonModule,
    TypeOrmModule.forFeature([Invoice, InvoiceLine, Customer, Expense]),
  ],
  controllers: [PennylaneController],
  providers: [
    PennylaneApiClient,
    PennylaneOAuthService,
    PennylaneSubmitService,
    PennylaneStatusSyncService,
    PennylaneIncomingInvoiceService,
  ],
  exports: [
    PennylaneSubmitService,
    PennylaneStatusSyncService,
    PennylaneOAuthService,
    PennylaneIncomingInvoiceService,
  ],
})
export class PennylaneModule {}

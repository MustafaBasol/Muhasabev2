import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { IntegrationsCommonModule } from '../common/integrations-common.module';
import { EInvoiceEvent } from '../common/entities/einvoice-event.entity';
import { EInvoiceExternalInvoice } from '../common/entities/einvoice-external-invoice.entity';
import { IopoleController } from './iopole.controller';
import { IopoleApiClient } from './services/iopole-api.client';
import { IopoleAuthService } from './services/iopole-auth.service';
import { IopoleSyncService } from './services/iopole-sync.service';

@Module({
  imports: [
    IntegrationsCommonModule,
    TypeOrmModule.forFeature([Invoice, EInvoiceEvent, EInvoiceExternalInvoice]),
  ],
  controllers: [IopoleController],
  providers: [IopoleAuthService, IopoleApiClient, IopoleSyncService],
  exports: [IopoleAuthService, IopoleApiClient, IopoleSyncService],
})
export class IopoleModule {}
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EINVOICE_QUEUE } from './einvoice-queue.constants';
import { EInvoiceSubmitProcessor } from './processors/einvoice-submit.processor';
import { EInvoiceSyncProcessor } from './processors/einvoice-sync.processor';
import { EInvoiceSyncScheduler } from './einvoice-sync.scheduler';
import { PennylaneModule } from '../../pennylane/pennylane.module';
import { IntegrationsCommonModule } from '../integrations-common.module';
import { Tenant } from '../../../tenants/entities/tenant.entity';

/**
 * EInvoiceQueueModule
 *
 * BullMQ worker ve cron scheduler'ları barındırır.
 * AppModule'e import edilir.
 *
 * Redis bağlantısı AppModule'deki BullModule.forRoot() üzerinden gelir.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue({ name: EINVOICE_QUEUE }),
    TypeOrmModule.forFeature([Tenant]),
    IntegrationsCommonModule,
    PennylaneModule,
  ],
  providers: [
    EInvoiceSubmitProcessor,
    EInvoiceSyncProcessor,
    EInvoiceSyncScheduler,
  ],
  exports: [
    BullModule, // diğer modüller kuyruğu inject edebilsin
  ],
})
export class EInvoiceQueueModule {}

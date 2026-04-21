import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  EINVOICE_QUEUE,
  EINVOICE_JOB,
  SyncOneJobPayload,
  SyncTenantJobPayload,
} from '../einvoice-queue.constants';
import { PennylaneSubmitService } from '../../../pennylane/services/pennylane-submit.service';
import { PennylaneStatusSyncService } from '../../../pennylane/services/pennylane-status-sync.service';

/**
 * E-fatura durum senkronizasyon worker'ı.
 *
 * İki iş türünü işler:
 *  - einvoice.sync_one    → tek fatura provider sync
 *  - einvoice.sync_tenant → tenant'ın tüm açık faturalarını changelog ile sync
 */
@Processor(EINVOICE_QUEUE)
export class EInvoiceSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(EInvoiceSyncProcessor.name);

  constructor(
    private readonly submitService: PennylaneSubmitService,
    private readonly statusSyncService: PennylaneStatusSyncService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === EINVOICE_JOB.SYNC_ONE) {
      await this.handleSyncOne(job as Job<SyncOneJobPayload>);
    } else if (job.name === EINVOICE_JOB.SYNC_TENANT) {
      await this.handleSyncTenant(job as Job<SyncTenantJobPayload>);
    }
  }

  private async handleSyncOne(job: Job<SyncOneJobPayload>): Promise<void> {
    const { tenantId, invoiceId } = job.data;
    this.logger.log(`[sync_one] invoice=${invoiceId} tenant=${tenantId}`);
    await this.submitService.syncInvoiceStatus(tenantId, invoiceId);
  }

  private async handleSyncTenant(job: Job<SyncTenantJobPayload>): Promise<void> {
    const { tenantId } = job.data;
    this.logger.log(`[sync_tenant] tenant=${tenantId} başlıyor`);
    const result = await this.statusSyncService.syncForTenant(tenantId);
    this.logger.log(`[sync_tenant] tenant=${tenantId} güncellenen=${result.updated}`);
  }
}

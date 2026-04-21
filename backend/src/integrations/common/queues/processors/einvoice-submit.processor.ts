import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  EINVOICE_QUEUE,
  EINVOICE_JOB,
  SubmitJobPayload,
} from '../einvoice-queue.constants';
import { PennylaneSubmitService } from '../../../pennylane/services/pennylane-submit.service';

/**
 * E-fatura gönderim worker'ı.
 *
 * BullMQ `einvoice.submit` işini işler:
 *   1. PennylaneSubmitService.submitInvoice() çağrılır
 *   2. Başarı → BullMQ işi tamamlandı olarak işaretlenir
 *   3. Hata → BullMQ üstel geri çekilme ile yeniden dener (max 5 kez)
 */
@Processor(EINVOICE_QUEUE)
export class EInvoiceSubmitProcessor extends WorkerHost {
  private readonly logger = new Logger(EInvoiceSubmitProcessor.name);

  constructor(
    private readonly submitService: PennylaneSubmitService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === EINVOICE_JOB.SUBMIT) {
      await this.handleSubmit(job as Job<SubmitJobPayload>);
    }
  }

  private async handleSubmit(job: Job<SubmitJobPayload>): Promise<void> {
    const { tenantId, invoiceId } = job.data;
    this.logger.log(`[submit] başlıyor invoice=${invoiceId} tenant=${tenantId} attempt=${job.attemptsMade + 1}`);

    await this.submitService.submitInvoice(tenantId, invoiceId);

    this.logger.log(`[submit] tamamlandı invoice=${invoiceId}`);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus } from '../../../tenants/entities/tenant.entity';
import {
  EINVOICE_QUEUE,
  EINVOICE_JOB,
  SyncTenantJobPayload,
} from './einvoice-queue.constants';
import { ProviderAccountService } from '../services/provider-account.service';
import { PROVIDER_KEYS, ProviderConnectionStatus } from '../types/integration.types';

/**
 * EInvoiceSyncScheduler
 *
 * Her 30 dakikada bir Pennylane'e bağlı aktif tenantlar için
 * changelog tabanlı durum güncellemesini kuyruğa ekler.
 *
 * Cron: 0,30 dakikada bir
 */
@Injectable()
export class EInvoiceSyncScheduler {
  private readonly logger = new Logger(EInvoiceSyncScheduler.name);

  constructor(
    @InjectQueue(EINVOICE_QUEUE)
    private readonly einvoiceQueue: Queue,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly providerAccountService: ProviderAccountService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduleSyncForAllTenants(): Promise<void> {
    this.logger.log('Periyodik e-fatura sync başlıyor...');

    const activeTenants = await this.tenantRepository.find({
      where: { status: TenantStatus.ACTIVE },
      select: ['id'],
    });

    let queued = 0;
    for (const tenant of activeTenants) {
      // Sadece Pennylane'e bağlı tenant'ları kuyruğa ekle
      const account = await this.providerAccountService.findByTenantAndProvider(
        tenant.id,
        PROVIDER_KEYS.PENNYLANE,
      );

      if (account?.connectionStatus !== ProviderConnectionStatus.CONNECTED) {
        continue;
      }

      const payload: SyncTenantJobPayload = { tenantId: tenant.id };
      await this.einvoiceQueue.add(EINVOICE_JOB.SYNC_TENANT, payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      });
      queued++;
    }

    this.logger.log(`Periyodik sync: ${queued}/${activeTenants.length} tenant kuyruğa eklendi.`);
  }
}

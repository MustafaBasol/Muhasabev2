import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, EInvoiceStatus } from '../../../invoices/entities/invoice.entity';
import { PROVIDER_KEYS } from '../../common/types/integration.types';
import { ProviderAccountService } from '../../common/services/provider-account.service';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { PennylaneApiClient } from './pennylane-api.client';
import { PennylaneOAuthService } from './pennylane-oauth.service';

/**
 * PennylaneStatusSyncService
 *
 * Pennylane'deki fatura durum değişikliklerini periyodik olarak çeker ve
 * yerel Invoice entity'lerini günceller.
 *
 * Polling: GET /changelogs/customer_invoices?start_date=...
 *   - Son 4 haftalık değişiklikleri cursor tabanlı döndürür.
 *   - provider_accounts.metadata.lastChangelogCursor alanında cursor tutulur.
 *
 * Kullanım:
 *   - NestJS @Cron veya OutboundJob queue'dan çağrılır.
 *   - Şimdilik Manuel tetikleme: POST /integrations/pennylane/sync
 */
@Injectable()
export class PennylaneStatusSyncService {
  private readonly logger = new Logger(PennylaneStatusSyncService.name);

  constructor(
    private readonly apiClient: PennylaneApiClient,
    private readonly oauthService: PennylaneOAuthService,
    private readonly providerAccountService: ProviderAccountService,
    private readonly logService: IntegrationLogService,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  /**
   * Verilen tenant için Pennylane changelog'u çeker.
   * Her değişiklik için ilgili faturayı bulup eInvoiceStatus'u günceller.
   *
   * @returns Güncellenen fatura sayısı
   */
  async syncForTenant(tenantId: string): Promise<{ updated: number }> {
    const clientId = process.env.PENNYLANE_CLIENT_ID ?? '';
    const clientSecret = process.env.PENNYLANE_CLIENT_SECRET ?? '';
    const token = await this.oauthService.getValidAccessToken(tenantId, clientId, clientSecret);

    const account = await this.providerAccountService.findByTenantAndProvider(
      tenantId,
      PROVIDER_KEYS.PENNYLANE,
    );

    const cursor = account?.metadata?.['lastChangelogCursor'] as string | undefined;
    // Son senkronizasyon zamanı yoksa son 1 haftayı al
    const startDate = cursor
      ? undefined
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let updatedCount = 0;
    let currentCursor = cursor;
    let hasMore = true;

    while (hasMore) {
      const response = await this.apiClient.getInvoiceChangelogs(token, {
        cursor: currentCursor,
        startDate: currentCursor ? undefined : startDate,
        limit: 50,
      });

      for (const change of response.changelogs) {
        const updated = await this.processChangelogItem(tenantId, token, change.id);
        if (updated) updatedCount++;
      }

      hasMore = response.has_more;
      currentCursor = response.next_cursor ?? undefined;

      if (!hasMore) break;
    }

    // Cursor'u kaydet
    if (currentCursor && account) {
      const metadata = { ...(account.metadata ?? {}), lastChangelogCursor: currentCursor };
      await this.providerAccountService.upsert(tenantId, PROVIDER_KEYS.PENNYLANE, { metadata });
    }

    this.logger.log(`Pennylane sync tamamlandı tenant=${tenantId} güncellenen=${updatedCount}`);
    return { updated: updatedCount };
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private async processChangelogItem(
    tenantId: string,
    token: string,
    pennylaneInvoiceId: number,
  ): Promise<boolean> {
    // Yerelde bu Pennylane ID'ye sahip faturayı bul
    const invoice = await this.invoiceRepo.findOne({
      where: { tenantId, providerInvoiceId: String(pennylaneInvoiceId) },
    });

    if (!invoice) return false; // Bu kiracıya ait değil

    // Güncel durumu al
    let plInvoice: Awaited<ReturnType<PennylaneApiClient['getInvoice']>>;
    try {
      plInvoice = await this.apiClient.getInvoice(token, pennylaneInvoiceId);
    } catch {
      return false;
    }

    const newStatus = this.mapPdpStatus(plInvoice.e_invoicing?.status);

    if (newStatus === invoice.eInvoiceStatus) {
      await this.invoiceRepo.update(invoice.id, { lastProviderSyncAt: new Date() });
      return false;
    }

    await this.invoiceRepo.update(invoice.id, {
      eInvoiceStatus: newStatus,
      eInvoiceStatusReason: plInvoice.e_invoicing?.reason ?? null,
      lastProviderSyncAt: new Date(),
    });

    this.logger.debug(
      `Fatura durumu güncellendi id=${invoice.id} ${invoice.eInvoiceStatus} → ${newStatus}`,
    );
    return true;
  }

  private mapPdpStatus(pdpStatus: string | null | undefined): EInvoiceStatus {
    switch (pdpStatus) {
      case 'submitted':           return EInvoiceStatus.SUBMITTED;
      case 'sent':                return EInvoiceStatus.SENT;
      case 'approved':            return EInvoiceStatus.APPROVED;
      case 'accepted':            return EInvoiceStatus.ACCEPTED;
      case 'rejected':            return EInvoiceStatus.REJECTED;
      case 'refused':             return EInvoiceStatus.REFUSED;
      case 'in_dispute':          return EInvoiceStatus.IN_DISPUTE;
      case 'collected':           return EInvoiceStatus.COLLECTED;
      case 'partially_collected': return EInvoiceStatus.PARTIALLY_COLLECTED;
      default:                    return EInvoiceStatus.PENDING;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense, ExpenseCategory, ExpenseStatus } from '../../../expenses/entities/expense.entity';
import { PennylaneApiClient } from './pennylane-api.client';
import { PennylaneOAuthService } from './pennylane-oauth.service';
import { PennylaneSupplierInvoiceResponse } from '../types/pennylane.types';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { PROVIDER_KEYS, IntegrationLogLevel } from '../../common/types/integration.types';

export interface SyncIncomingResult {
  /** Yeni oluşturulan gider kaydı sayısı */
  created: number;
  /** Zaten var olduğu için atlanan fatura sayısı */
  skipped: number;
  /** Hata oluşan fatura sayısı */
  errors: number;
}

/**
 * PennylaneIncomingInvoiceService
 *
 * Pennylane'den gelen tedarikçi faturalarını (supplier_invoices) çekip
 * Comptario'da Gider (Expense) olarak kaydeder.
 *
 * Akış:
 *  1. GET /supplier_invoices (tümünü sayfalayarak)
 *  2. providerExpenseId üzerinden tekrar kontrolü yap
 *  3. Yeni olanları Expense olarak oluştur
 */
@Injectable()
export class PennylaneIncomingInvoiceService {
  private readonly logger = new Logger(PennylaneIncomingInvoiceService.name);

  constructor(
    private readonly apiClient: PennylaneApiClient,
    private readonly oauthService: PennylaneOAuthService,
    private readonly logService: IntegrationLogService,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
  ) {}

  async syncIncomingInvoices(tenantId: string): Promise<SyncIncomingResult> {
    const result: SyncIncomingResult = { created: 0, skipped: 0, errors: 0 };

    const clientId = process.env.PENNYLANE_CLIENT_ID ?? '';
    const clientSecret = process.env.PENNYLANE_CLIENT_SECRET ?? '';
    const token = await this.oauthService.getValidAccessToken(tenantId, clientId, clientSecret);

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await this.apiClient.listSupplierInvoices(token, { page });
      const invoices = data.supplier_invoices ?? [];

      for (const inv of invoices) {
        try {
          await this.processOne(tenantId, inv, result);
        } catch (err) {
          result.errors += 1;
          this.logger.error(
            `Supplier invoice ${inv.id} işlenirken hata: ${(err as Error).message}`,
          );
        }
      }

      hasMore = page < (data.total_pages ?? 1);
      page += 1;
    }

    await this.logService.log({
      tenantId,
      providerKey: PROVIDER_KEYS.PENNYLANE,
      action: 'sync_incoming',
      level: result.errors === 0 ? IntegrationLogLevel.INFO : IntegrationLogLevel.WARN,
      errorMessage: result.errors > 0 ? `${result.errors} fatura import edilemedi` : null,
    });

    return result;
  }

  private async processOne(
    tenantId: string,
    inv: PennylaneSupplierInvoiceResponse,
    result: SyncIncomingResult,
  ): Promise<void> {
    const providerExpenseId = String(inv.id);

    // Zaten import edilmişse atla
    const existing = await this.expenseRepo.findOne({
      where: { tenantId, providerExpenseId },
    });
    if (existing) {
      result.skipped += 1;
      return;
    }

    // Sadece posted (finalize edilmiş) faturaları import et
    if (inv.status !== 'posted') {
      result.skipped += 1;
      return;
    }

    const amount = parseFloat(inv.amount ?? '0');
    const expenseDate = inv.date ? new Date(inv.date) : new Date();

    // Basit otomatik numara üret
    const count = await this.expenseRepo.count({ where: { tenantId } });
    const expenseNumber = `PL-E-${String(count + 1).padStart(4, '0')}`;

    const senderName = inv.supplier?.name ?? 'Bilinmiyor';
    const description = `[Pennylane] ${senderName} — ${inv.invoice_number ?? providerExpenseId}`;

    const expense = this.expenseRepo.create({
      tenantId,
      expenseNumber,
      description,
      expenseDate,
      amount,
      category: ExpenseCategory.OTHER,
      status: ExpenseStatus.PENDING,
      notes: `Pennylane'den otomatik import edildi. Tedarikçi fatura no: ${inv.invoice_number ?? '-'}`,
      // Gelen e-fatura alanları
      providerExpenseId,
      eInvoiceSource: 'pennylane',
      providerInvoiceNumber: inv.invoice_number,
      senderName,
      senderVatNumber: inv.supplier?.vat_number ?? null,
    });

    await this.expenseRepo.save(expense);
    result.created += 1;

    this.logger.log(
      `Gelen e-fatura import edildi: ${senderName} / ${inv.invoice_number ?? providerExpenseId} → ${expenseNumber}`,
    );
  }
}

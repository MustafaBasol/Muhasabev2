import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../../../invoices/entities/invoice.entity';
import { InvoiceLine } from '../../../invoices/entities/invoice-line.entity';
import { Customer } from '../../../customers/entities/customer.entity';
import { EInvoiceStatus } from '../../../invoices/entities/invoice.entity';
import {
  IEInvoicingProvider,
  UpsertCustomerResult,
  SubmitInvoiceResult,
  SyncStatusResult,
} from '../../common/interfaces/provider.interface';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { PROVIDER_KEYS } from '../../common/types/integration.types';
import { PennylaneApiClient } from './pennylane-api.client';
import { PennylaneOAuthService } from './pennylane-oauth.service';
import { PennylaneInvoiceResponse } from '../types/pennylane.types';
import {
  mapCustomerToCompanyPayload,
  mapCustomerToIndividualPayload,
  isCompanyCustomer,
} from '../mappers/customer.mapper';
import { mapInvoiceToPayload } from '../mappers/invoice.mapper';

/**
 * PennylaneSubmitService
 *
 * IEInvoicingProvider implementasyonu — Pennylane MVP.
 *
 * Akış:
 *  upsertCustomer → müşteri Pennylane'de yoksa oluştur, varsa ID'yi al
 *  submitInvoice  → upsertCustomer → invoice oluştur → finalize
 *  syncStatus     → GET /customer_invoices/{id} → eInvoiceStatus güncelle
 */
@Injectable()
export class PennylaneSubmitService implements IEInvoicingProvider {
  private readonly logger = new Logger(PennylaneSubmitService.name);

  constructor(
    private readonly apiClient: PennylaneApiClient,
    private readonly oauthService: PennylaneOAuthService,
    private readonly logService: IntegrationLogService,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceLine)
    private readonly lineRepo: Repository<InvoiceLine>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  // ─── upsertCustomer ────────────────────────────────────────────────────────

  async upsertCustomer(
    tenantId: string,
    customerId: string,
  ): Promise<UpsertCustomerResult> {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } });
    if (!customer) throw new Error(`Müşteri bulunamadı: ${customerId}`);

    // Zaten Pennylane'de kayıtlıysa ID'yi döndür
    if (customer.providerCustomerId) {
      return { providerCustomerId: customer.providerCustomerId, created: false };
    }

    const token = await this.getToken(tenantId);

    // external_reference ile mevcut müşteri arama
    const existing = await this.apiClient.findCustomerByExternalRef(token, customerId);
    if (existing) {
      await this.customerRepo.update(customerId, {
        providerCustomerId: String(existing.id),
      });
      return { providerCustomerId: String(existing.id), created: false };
    }

    // Yeni müşteri oluştur
    let pennylaneCustomer: { id: number };
    if (isCompanyCustomer(customer)) {
      const payload = mapCustomerToCompanyPayload(customer);
      pennylaneCustomer = await this.apiClient.createCompanyCustomer(token, payload);
    } else {
      const payload = mapCustomerToIndividualPayload(customer);
      pennylaneCustomer = await this.apiClient.createIndividualCustomer(token, payload);
    }

    await this.customerRepo.update(customerId, {
      providerCustomerId: String(pennylaneCustomer.id),
    });

    await this.logService.info({
      tenantId,
      providerKey: PROVIDER_KEYS.PENNYLANE,
      action: 'upsertCustomer',
      httpStatus: 201,
    });

    return { providerCustomerId: String(pennylaneCustomer.id), created: true };
  }

  // ─── submitInvoice ─────────────────────────────────────────────────────────

  async submitInvoice(
    tenantId: string,
    invoiceId: string,
  ): Promise<SubmitInvoiceResult> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new Error(`Fatura bulunamadı: ${invoiceId}`);

    if (!invoice.customerId) {
      throw new Error(`E-fatura gönderilemedi: Fatura için müşteri seçilmemiş.`);
    }

    // Zaten gönderilmiş/finalize edilmiş faturayı tekrar gönderme
    if (invoice.providerInvoiceId && invoice.eInvoiceStatus !== EInvoiceStatus.REJECTED && invoice.eInvoiceStatus !== EInvoiceStatus.PENDING) {
      throw new Error(
        `Fatura ${invoice.invoiceNumber} zaten Pennylane'e gönderilmiş (ID: ${invoice.providerInvoiceId}). Tekrar göndermek için önce mevcut kaydı iptal edin.`,
      );
    }

    const lines = await this.lineRepo.find({
      where: { invoiceId },
      order: { position: 'ASC' },
    });

    // E-fatura zorunlu alan doğrulaması
    this.validateInvoiceForEInvoicing(invoice, lines);

    // 1. Müşteri upsert — önceden kaydedilmiş providerCustomerId yoksa Pennylane'de ara/oluştur
    const { providerCustomerId } = await this.upsertCustomer(tenantId, invoice.customerId);
    const token = await this.getToken(tenantId);

    // 2. Taslak fatura oluştur — eğer önceki denemede taslak oluşturulmuşsa (providerInvoiceId var) yeni taslak açma
    let created: PennylaneInvoiceResponse;

    if (invoice.providerInvoiceId) {
      // Önceki denemede taslak oluşturulmuş ama finalize başarısız olmuş → mevcut taslağı kullan
      this.logger.log(`Mevcut Pennylane taslağı kullanılıyor: ${invoice.providerInvoiceId}`);
      created = await this.apiClient.getInvoice(token, invoice.providerInvoiceId);
    } else {
      const payload = mapInvoiceToPayload(invoice, lines, Number(providerCustomerId), true);
      try {
        created = await this.apiClient.createInvoice(token, payload);
      } catch (err: any) {
        // 422 "already taken" → Pennylane'de taslak zaten oluşturulmuş.
        if (err?.isPennylaneAlreadyExists) {
          await this.invoiceRepo.update(invoiceId, {
            eInvoiceStatus: EInvoiceStatus.REJECTED,
            providerError: 'Pennylane\'da bu fatura için taslak zaten mevcut. Pennylane\'dan taslağı silin ve tekrar gönderin.',
          });
          throw new Error(
            'Bu fatura daha önce Pennylane\'e kısmen gönderilmiş. Lütfen Pennylane\'deki taslak faturayı silin ve tekrar deneyin.',
          );
        }
        await this.invoiceRepo.update(invoiceId, {
          eInvoiceStatus: EInvoiceStatus.REJECTED,
          providerError: (err as Error).message,
        });
        throw err;
      }

      // Taslak oluşturuldu — ID'yi hemen kaydet (finalize başarısız olursa orphan kalmaz)
      await this.invoiceRepo.update(invoiceId, {
        providerInvoiceId: String(created.id),
        eInvoiceStatus: EInvoiceStatus.PENDING,
      });
    }

    // 3. Finalize et
    let finalized: PennylaneInvoiceResponse;
    try {
      finalized = await this.apiClient.finalizeInvoice(token, created.id);
    } catch (err: any) {
      const errMsg = (err as Error).message ?? String(err);
      await this.invoiceRepo.update(invoiceId, {
        eInvoiceStatus: EInvoiceStatus.REJECTED,
        providerError: errMsg,
      });
      throw err;
    }

    // 4. Yerel entity güncelle
    const newStatus = this.mapPdpStatus(finalized.e_invoicing?.status);
    await this.invoiceRepo.update(invoiceId, {
      providerInvoiceId: String(finalized.id),
      providerInvoiceNumber: finalized.invoice_number,
      eInvoiceStatus: newStatus,
      lastProviderSyncAt: new Date(),
      providerError: null,
    });

    await this.logService.info({
      tenantId,
      providerKey: PROVIDER_KEYS.PENNYLANE,
      action: 'submitInvoice',
      invoiceId,
      httpStatus: 200,
    });

    this.logger.log(
      `Fatura gönderildi invoice=${invoiceId} pennylane_id=${finalized.id} pennylane_no=${finalized.invoice_number}`,
    );

    return {
      providerInvoiceId: String(finalized.id),
      providerInvoiceNumber: finalized.invoice_number,
      eInvoiceStatus: newStatus,
    };
  }

  /**
   * E-fatura göndermeden önce zorunlu alan kontrolü.
   * Pennylane'e gitmeden hızlı validate ederek anlamlı hata mesajı verir.
   */
  private validateInvoiceForEInvoicing(
    invoice: Invoice,
    lines: InvoiceLine[],
  ): void {
    const errors: string[] = [];

    if (!lines || lines.length === 0) {
      errors.push('Faturada ürün/hizmet satırı yok. En az 1 satır gereklidir.');
    }

    if (!invoice.issueDate) {
      errors.push('Düzenleme tarihi eksik.');
    }

    if (errors.length > 0) {
      throw new Error(`E-fatura doğrulama hatası:\n• ${errors.join('\n• ')}`);
    }
  }

  // ─── syncInvoiceStatus ─────────────────────────────────────────────────────

  async syncInvoiceStatus(
    tenantId: string,
    invoiceId: string,
  ): Promise<SyncStatusResult> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice?.providerInvoiceId) {
      return { updated: false };
    }

    const token = await this.getToken(tenantId);
    const plInvoice = await this.apiClient.getInvoice(token, invoice.providerInvoiceId);

    const newStatus = this.mapPdpStatus(plInvoice.e_invoicing?.status);

    if (newStatus === invoice.eInvoiceStatus) {
      await this.invoiceRepo.update(invoiceId, { lastProviderSyncAt: new Date() });
      return { updated: false, eInvoiceStatus: newStatus };
    }

    await this.invoiceRepo.update(invoiceId, {
      eInvoiceStatus: newStatus,
      eInvoiceStatusReason: plInvoice.e_invoicing?.reason ?? null,
      lastProviderSyncAt: new Date(),
      providerError: null,
    });

    return { updated: true, eInvoiceStatus: newStatus };
  }

  /**
   * Pennylane'deki faturayı iptal eder (void akışında çağrılır).
   *
   * - Draft faturalar DELETE ile silinir.
   * - Finalize edilmiş faturalar Pennylane tarafından reddedilir;
   *   bu durumda hata loglanır ama yerel void işlemi engellenmez.
   */
  async cancelInvoice(tenantId: string, providerInvoiceId: string): Promise<void> {
    try {
      const token = await this.getToken(tenantId);
      await this.apiClient.cancelInvoice(token, providerInvoiceId);
      this.logger.log(`Pennylane faturası iptal edildi: ${providerInvoiceId}`);
    } catch (err) {
      // Finalize edilmiş fatura silinemez → kullanıcı Pennylane'de manuel avoir oluşturmalı
      this.logger.warn(
        `Pennylane faturası ${providerInvoiceId} iptal edilemedi (finalize sonrası credit note gerekebilir): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Comptario'da fatura "Ödendi" işaretlenince Pennylane'de de ödendi kaydı oluşturur.
   *
   * Pennylane API: POST /customer_invoices/{id}/matched_transactions
   * Banka hesabı bağlantısı olmadan manuel ödeme girişi yapar.
   *
   * Best-effort: Pennylane API hatası durumunda exception fırlatır (caller yakalar ve loglar).
   */
  async syncPayment(tenantId: string, invoiceId: string): Promise<void> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice?.providerInvoiceId) return; // Pennylane'e hiç gönderilmemiş

    const token = await this.getToken(tenantId);
    const date = new Date().toISOString().split('T')[0];
    const amount = Number(invoice.total);
    const currency = invoice.invoiceCurrency || 'EUR';
    const label = `Paiement ${invoice.invoiceNumber}`;

    await this.apiClient.markInvoiceAsPaid(token, invoice.providerInvoiceId, amount, date, currency, label);

    // Ödeme başarılı → eInvoiceStatus COLLECTED olarak güncelle
    await this.invoiceRepo.update(invoiceId, {
      eInvoiceStatus: EInvoiceStatus.COLLECTED,
      lastProviderSyncAt: new Date(),
    });

    this.logger.log(
      `Pennylane ödeme senkronize edildi: invoice=${invoiceId} pennylane_id=${invoice.providerInvoiceId} tutar=${amount} ${currency}`,
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getToken(tenantId: string): Promise<string> {
    const clientId = process.env.PENNYLANE_CLIENT_ID ?? '';
    const clientSecret = process.env.PENNYLANE_CLIENT_SECRET ?? '';
    return this.oauthService.getValidAccessToken(tenantId, clientId, clientSecret);
  }

  /**
   * Pennylane PDP status string → EInvoiceStatus enum
   */
  private mapPdpStatus(pdpStatus: string | null | undefined): EInvoiceStatus {
    switch (pdpStatus) {
      case 'submitted':         return EInvoiceStatus.SUBMITTED;
      case 'sent':              return EInvoiceStatus.SENT;
      case 'approved':          return EInvoiceStatus.APPROVED;
      case 'accepted':          return EInvoiceStatus.ACCEPTED;
      case 'rejected':          return EInvoiceStatus.REJECTED;
      case 'refused':           return EInvoiceStatus.REFUSED;
      case 'in_dispute':        return EInvoiceStatus.IN_DISPUTE;
      case 'collected':         return EInvoiceStatus.COLLECTED;
      case 'partially_collected': return EInvoiceStatus.PARTIALLY_COLLECTED;
      default:                  return EInvoiceStatus.PENDING;
    }
  }
}

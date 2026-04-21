import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, EInvoiceStatus } from '../../../invoices/entities/invoice.entity';
import { InvoiceLine } from '../../../invoices/entities/invoice-line.entity';
import { Customer } from '../../../customers/entities/customer.entity';
import {
  IEInvoicingProvider,
  UpsertCustomerResult,
  SubmitInvoiceResult,
  SyncStatusResult,
} from '../../common/interfaces/provider.interface';
import { IntegrationLogService } from '../../common/services/integration-log.service';
import { PROVIDER_KEYS } from '../../common/types/integration.types';
import { ChorusProApiClient } from './chorus-pro-api.client';
import { ChorusProOAuthService } from './chorus-pro-oauth.service';
import { buildCiiXml } from '../../../invoices/facturx/cii-xml.builder';
import { FacturXProfile } from '../../../invoices/facturx/facturx-profile.enum';
import { CHORUS_PRO_SYNTAX, CHORUS_PRO_STATUS } from '../constants/chorus-pro.constants';

/**
 * ChorusProSubmitService
 *
 * IEInvoicingProvider implementasyonu — Chorus Pro (B2G).
 *
 * Akış:
 *  upsertCustomer → Chorus Pro, müşteri kavramını provider bazında tutmaz;
 *                   alıcı bilgisi fatura XML içinde yer alır. Bu metod
 *                   alıcının SIRET'ini doğrular ve Chorus Pro ID'sini sorgular.
 *
 *  submitInvoice  → CII XML üret (Faz 6 builder'ı yeniden kullan)
 *                 → Base64 encode
 *                 → deposerFluxFacture API çağrısı
 *                 → numeroFluxDepot → Invoice.providerInvoiceId olarak kaydet
 *
 *  syncStatus     → consulterHistoriqueEtatFacture
 *                 → Chorus Pro durum → EInvoiceStatus eşleştir
 */
@Injectable()
export class ChorusProSubmitService implements IEInvoicingProvider {
  private readonly logger = new Logger(ChorusProSubmitService.name);

  constructor(
    private readonly apiClient: ChorusProApiClient,
    private readonly oauthService: ChorusProOAuthService,
    private readonly logService: IntegrationLogService,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceLine)
    private readonly lineRepo: Repository<InvoiceLine>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  // ─── upsertCustomer ────────────────────────────────────────────────────────

  /**
   * Chorus Pro'da ayrı müşteri kaydı yoktur; alıcı doğrudan fatura XML'inde
   * taşınır. Burada alıcının SIRET'ini Chorus Pro'ya sorgulayarak doğrularız
   * ve idDestinataire'i customer.providerCustomerId olarak saklarız.
   */
  async upsertCustomer(
    tenantId: string,
    customerId: string,
  ): Promise<UpsertCustomerResult> {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } });
    if (!customer) throw new Error(`Müşteri bulunamadı: ${customerId}`);

    // SIRET metadata'dan (veya company fields'dan) alınır
    const siret = (customer as any).siretNumber as string | null;
    if (!siret) {
      // B2G zorunlu değilse (B2B müşteriler) geçelim
      return { providerCustomerId: customerId, created: false };
    }

    const creds = await this.oauthService.getCredentials(tenantId);

    try {
      const result = await this.apiClient.recupererIdentifiant(
        creds.pisteClientId,
        creds.pisteClientSecret,
        { siret },
      );

      if (result.idDestinataire && customer.providerCustomerId !== result.idDestinataire) {
        await this.customerRepo.update(
          { id: customerId },
          { providerCustomerId: result.idDestinataire } as any,
        );
        await this.logService.info({
          tenantId,
          providerKey: PROVIDER_KEYS.CHORUS_PRO,
          action: 'customer.upserted',
          errorMessage: `idDestinataire=${result.idDestinataire} siret=${siret}`,
        });
        return { providerCustomerId: result.idDestinataire, created: true };
      }

      return {
        providerCustomerId: result.idDestinataire ?? customerId,
        created: false,
      };
    } catch (err: any) {
      // SIRET bulunamazsa veya kamu kurumu değilse uyarı ver, devam et
      this.logger.warn(`recupererIdentifiant başarısız, devam ediliyor: ${err.message}`);
      await this.logService.warn({
        tenantId,
        providerKey: PROVIDER_KEYS.CHORUS_PRO,
        action: 'customer.siret_lookup_failed',
        errorMessage: err.message,
      });
      return { providerCustomerId: customerId, created: false };
    }
  }

  // ─── submitInvoice ─────────────────────────────────────────────────────────

  async submitInvoice(
    tenantId: string,
    invoiceId: string,
  ): Promise<SubmitInvoiceResult> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, tenantId },
    });
    if (!invoice) throw new Error(`Fatura bulunamadı: ${invoiceId}`);

    const lines = await this.lineRepo.find({ where: { invoiceId } });
    const creds = await this.oauthService.getCredentials(tenantId);

    // 1. CII XML üret (Faz 6 builder'ı yeniden kullan — EN 16931)
    const xmlString = buildCiiXml(invoice, lines, FacturXProfile.EN_16931);
    const xmlBase64 = Buffer.from(xmlString, 'utf-8').toString('base64');

    // 2. Chorus Pro'ya gönder
    let fluxResponse;
    try {
      fluxResponse = await this.apiClient.deposerFlux(
        creds.pisteClientId,
        creds.pisteClientSecret,
        {
          syntaxeFlux: CHORUS_PRO_SYNTAX.CII,
          fluxFacture: xmlBase64,
        },
      );
    } catch (err: any) {
      await this.logService.error({
        tenantId,
        providerKey: PROVIDER_KEYS.CHORUS_PRO,
        action: 'invoice.submit_failed',
        errorMessage: err.message,
        invoiceId,
      });
      // Fatura durumunu hata olarak işaretle
      await this.invoiceRepo.update(
        { id: invoiceId },
        {
          eInvoiceStatus: EInvoiceStatus.REJECTED,
          providerError: err.message,
        },
      );
      throw err;
    }

    const numeroFlux = fluxResponse.numeroFluxDepot;

    // 3. Fatura kaydını güncelle
    await this.invoiceRepo.update(
      { id: invoiceId },
      {
        providerInvoiceId: numeroFlux,
        eInvoiceStatus: EInvoiceStatus.SUBMITTED,
        providerError: null,
        lastProviderSyncAt: new Date(),
      },
    );

    await this.logService.info({
      tenantId,
      providerKey: PROVIDER_KEYS.CHORUS_PRO,
      action: 'invoice.submitted',
      invoiceId,
      errorMessage: `numeroFluxDepot=${numeroFlux}`,
    });

    this.logger.log(
      `Chorus Pro fatura gönderildi: invoiceId=${invoiceId} flux=${numeroFlux}`,
    );

    return {
      providerInvoiceId: numeroFlux,
      eInvoiceStatus: EInvoiceStatus.SUBMITTED,
    };
  }

  // ─── syncInvoiceStatus ─────────────────────────────────────────────────────

  async syncInvoiceStatus(
    tenantId: string,
    invoiceId: string,
  ): Promise<SyncStatusResult> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId, tenantId },
    });

    if (!invoice?.providerInvoiceId) {
      return { updated: false };
    }

    const creds = await this.oauthService.getCredentials(tenantId);

    let historique;
    try {
      historique = await this.apiClient.consulterHistorique(
        creds.pisteClientId,
        creds.pisteClientSecret,
        { numeroFluxDepot: invoice.providerInvoiceId },
      );
    } catch (err: any) {
      await this.logService.warn({
        tenantId,
        providerKey: PROVIDER_KEYS.CHORUS_PRO,
        action: 'invoice.sync_failed',
        errorMessage: err.message,
        invoiceId,
      });
      return { updated: false };
    }

    const chorusStatus = historique.statutCourant;
    if (!chorusStatus) return { updated: false };

    const eInvoiceStatus = this.mapChorusStatus(chorusStatus);

    const updates: Record<string, unknown> = {
      eInvoiceStatus,
      lastProviderSyncAt: new Date(),
    };
    if (historique.numeroFactureCPP) {
      updates['providerInvoiceNumber'] = historique.numeroFactureCPP;
    }

    await this.invoiceRepo.update({ id: invoiceId }, updates);

    await this.logService.info({
      tenantId,
      providerKey: PROVIDER_KEYS.CHORUS_PRO,
      action: 'invoice.synced',
      invoiceId,
      errorMessage: `chorusStatus=${chorusStatus} → eInvoiceStatus=${eInvoiceStatus}`,
    });

    return { updated: true, eInvoiceStatus };
  }

  // ─── Durum dönüşüm tablosu ─────────────────────────────────────────────────

  private mapChorusStatus(chorusStatus: string): EInvoiceStatus {
    switch (chorusStatus) {
      case CHORUS_PRO_STATUS.DEPOSEE:
        return EInvoiceStatus.SUBMITTED;
      case CHORUS_PRO_STATUS.A_VALIDER:
      case CHORUS_PRO_STATUS.A_VALIDER_INTERMEDIAIRE:
        return EInvoiceStatus.SENT;
      case CHORUS_PRO_STATUS.VALIDEE:
        return EInvoiceStatus.ACCEPTED;
      case CHORUS_PRO_STATUS.MISE_EN_PAIEMENT:
        return EInvoiceStatus.COLLECTED;
      case CHORUS_PRO_STATUS.COMPTABILISEE:
        return EInvoiceStatus.COLLECTED;
      case CHORUS_PRO_STATUS.REJETEE:
      case CHORUS_PRO_STATUS.REJETEE_MANDATAIRE:
        return EInvoiceStatus.REFUSED;
      case CHORUS_PRO_STATUS.ANNULEE:
        return EInvoiceStatus.REJECTED;
      default:
        return EInvoiceStatus.PENDING;
    }
  }
}

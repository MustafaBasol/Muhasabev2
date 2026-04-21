/**
 * Provider-agnostic e-invoicing provider arayüzü.
 *
 * Her yeni provider (Pennylane, Chorus Pro vb.) bu arayüzü implemente eder.
 * Çekirdek iş mantığı hiçbir zaman provider'a özgü tiplere bağımlı olmaz.
 */

export interface UpsertCustomerResult {
  providerCustomerId: string;
  created: boolean;
}

export interface SubmitInvoiceResult {
  providerInvoiceId: string;
  providerInvoiceNumber?: string;
  eInvoiceStatus: string;
}

export interface SyncStatusResult {
  updated: boolean;
  eInvoiceStatus?: string;
}

export interface IEInvoicingProvider {
  /**
   * Müşteriyi provider'da oluştur veya güncelle.
   */
  upsertCustomer(tenantId: string, customerId: string): Promise<UpsertCustomerResult>;

  /**
   * Faturayı provider'a gönder ve finalize et.
   */
  submitInvoice(tenantId: string, invoiceId: string): Promise<SubmitInvoiceResult>;

  /**
   * Provider'dan fatura durumunu sorgula ve yerel kaydı güncelle.
   */
  syncInvoiceStatus(tenantId: string, invoiceId: string): Promise<SyncStatusResult>;
}

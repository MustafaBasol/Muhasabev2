import { InvoiceStatus, EInvoiceStatus, InvoiceDocumentType } from '../entities/invoice.entity';

export type NumericString = `${number}`;

export interface InvoiceLineItemInput extends Record<string, unknown> {
  productId?: string;
  productName?: string;
  description?: string;
  quantity?: number | NumericString;
  unitPrice?: number | NumericString;
  taxRate?: number | NumericString;
  discountAmount?: number | NumericString;
}

// ─── Phase 1: Snapshot Arayüzleri ─────────────────────────────────────────

/**
 * Fatura kesildiğinde satıcı (tenant) yasal bilgilerinin anlık görüntüsü.
 * Immutable — sonradan tenant verisi değişse bile fatura geçmişi korunur.
 */
export interface InvoiceSellerSnapshot {
  companyName?: string | null;
  address?: string | null;
  tvaNumber?: string | null;    // TVA/KDV numarası
  siretNumber?: string | null;  // SIRET (14 hane)
  sirenNumber?: string | null;  // SIREN (9 hane)
  rcsNumber?: string | null;    // Ticaret sicil
  companyType?: string | null;  // SAS, SARL, EI vb.
  capitalSocial?: string | null;
}

/**
 * Fatura kesildiğinde alıcı (customer) yasal bilgilerinin anlık görüntüsü.
 * Immutable — sonradan müşteri verisi değişse bile fatura geçmişi korunur.
 */
export interface InvoiceBuyerSnapshot {
  name?: string | null;
  company?: string | null;
  address?: string | null;      // Metin formatı (geriye dönük uyumluluk)
  tvaNumber?: string | null;
  siretNumber?: string | null;
  sirenNumber?: string | null;
  customerType?: string | null; // b2b | b2c | individual
  billingAddress?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    state?: string;
  } | null;
}

export interface InvoiceAuditMetadata {
  createdById?: string | null;
  createdByName?: string | null;
  updatedById?: string | null;
  updatedByName?: string | null;
}

export interface BaseInvoiceDto extends InvoiceAuditMetadata {
  invoiceNumber?: string;
  customerId?: string | null;
  issueDate?: string | Date;
  dueDate?: string | Date;
  subtotal?: number | NumericString;
  taxAmount?: number | NumericString;
  discountAmount?: number | NumericString;
  total?: number | NumericString;
  status?: InvoiceStatus;
  notes?: string | null;
  saleId?: string | null;
  type?: string;
  refundedInvoiceId?: string | null;
  // Girdi satırları — sadece create/update request'lerinde kullanılır
  lineItems?: InvoiceLineItemInput[];
  items?: InvoiceLineItemInput[]; // lineItems ile aynı anlam, geriye dönük uyumluluk
  // Phase 1 — e-fatura compliance alanları
  eInvoiceStatus?: EInvoiceStatus | null;
  eInvoiceStatusReason?: string | null;
  documentType?: InvoiceDocumentType | null;
  invoiceCurrency?: string | null;
  invoiceLanguage?: string | null;
  servicePeriodStart?: string | Date | null;
  servicePeriodEnd?: string | Date | null;
  providerInvoiceId?: string | null;
  lastProviderSyncAt?: string | Date | null;
  providerError?: string | null;
  sellerSnapshot?: InvoiceSellerSnapshot | null;
  buyerSnapshot?: InvoiceBuyerSnapshot | null;
}

export interface CreateInvoiceDto extends BaseInvoiceDto {
  issueDate: string | Date;
  dueDate: string | Date;
  lineItems?: InvoiceLineItemInput[];
}

export type UpdateInvoiceDto = BaseInvoiceDto & {
  isVoided?: boolean;
  voidReason?: string | null;
  voidedAt?: string | Date | null;
  voidedBy?: string | null;
};

export interface InvoiceStatistics {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  count: number;
}

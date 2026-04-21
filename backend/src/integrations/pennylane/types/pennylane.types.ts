/**
 * Pennylane API v2 — Tip Tanımları
 *
 * Kaynak: https://app.pennylane.com/api/external/v2/
 * OAS spec: accounting.json (uuid: t5fea4pmo8hguyg)
 */

// ─── OAuth ───────────────────────────────────────────────────────────────────

export const PENNYLANE_AUTH_URL = 'https://app.pennylane.com/oauth/authorize';
export const PENNYLANE_TOKEN_URL = 'https://app.pennylane.com/oauth/oauth/token';
export const PENNYLANE_API_BASE = 'https://app.pennylane.com/api/external/v2';

export const PENNYLANE_SCOPES = [
  'customer_invoices:all',
  'customers:all',
  'e_invoices:all',
] as const;

// ─── Customer ────────────────────────────────────────────────────────────────

export interface PennylaneAddress {
  address: string;
  postal_code: string;
  city: string;
  country_alpha2: string;
}

export interface PennylaneCreateCompanyCustomerPayload {
  name: string;
  vat_number?: string | null;
  reg_no?: string | null;          // SIREN
  phone?: string | null;
  billing_address?: PennylaneAddress;
  delivery_address?: PennylaneAddress;
  payment_conditions?: string | null;
  billing_iban?: string | null;
  recipient?: string | null;
  reference?: string | null;
  notes?: string | null;
  emails?: string[];
  external_reference?: string;     // bizim UUID'imiz
  billing_language?: string;       // default 'fr_FR'
}

export interface PennylaneCreateIndividualCustomerPayload {
  first_name: string;
  last_name: string;
  phone?: string | null;
  billing_address: PennylaneAddress; // required
  delivery_address?: PennylaneAddress;
  payment_conditions?: string | null;
  billing_iban?: string | null;
  recipient?: string | null;
  reference?: string | null;
  notes?: string | null;
  emails?: string[];
  external_reference?: string;
  billing_language?: string;
}

/** Pennylane'den dönen müşteri objesi (kısmi) */
export interface PennylaneCustomerResponse {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  external_reference?: string;
  vat_number?: string;
  reg_no?: string;
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export interface PennylaneInvoiceLine {
  /** Ürün tabanlı satır: product_id + quantity */
  product_id?: number;
  /** Serbest satır: label + raw_currency_unit_price + unit + vat_rate + quantity */
  label?: string;
  raw_currency_unit_price?: string;  // string, örn. "100.00"
  unit?: string;
  vat_rate?: string;                 // örn. "FR_200"
  quantity: number;
  description?: string | null;
  ledger_account_id?: number;
  section_rank?: number | null;
  discount?: { type: 'absolute' | 'relative'; value: string } | null;
}

export interface PennylaneCreateInvoicePayload {
  date: string;                // ISO 8601 date
  deadline: string;            // ISO 8601 date (payment due)
  customer_id: number;         // Pennylane customer integer ID
  currency?: string;           // default EUR
  language?: string;           // fr_FR, en_US, vb.
  draft?: boolean;             // true = taslak, false = hemen finalize
  external_reference?: string; // bizim invoiceNumber'ımız
  label?: string | null;
  pdf_invoice_subject?: string | null;
  pdf_description?: string | null;
  pdf_invoice_free_text?: string | null;
  special_mention?: string | null;
  invoice_lines: PennylaneInvoiceLine[];
}

/** Pennylane'den dönen fatura objesi (kısmi — Phase 3 MVP için yeterli alanlar) */
export interface PennylaneInvoiceResponse {
  id: number;
  invoice_number: string;      // "FA-2024-0001" gibi atanmış numara
  status: string;              // InvoiceStatuses enum değeri
  paid: boolean;
  draft: boolean;
  external_reference?: string;
  e_invoicing?: {
    status: string | null;     // CustomerInvoicePDPStatus
    reason: string | null;
  };
  amount: string;
  currency: string;
  date: string;
  deadline: string;
  created_at: string;
  updated_at: string;
}

// ─── Changelog ───────────────────────────────────────────────────────────────

export interface PennylaneChangelogItem {
  id: number;
  event_type: string;          // "created" | "updated" | "finalized" vb.
  processed_at: string;        // ISO 8601 datetime
}

export interface PennylaneChangelogResponse {
  changelogs: PennylaneChangelogItem[];
  next_cursor?: string | null;
  has_more: boolean;
}

// ─── OAuth Token ─────────────────────────────────────────────────────────────

export interface PennylaneTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;          // saniye cinsinden
  scope: string;
  created_at: number;          // Unix timestamp
}

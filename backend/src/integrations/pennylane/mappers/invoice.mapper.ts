import { Invoice } from '../../../invoices/entities/invoice.entity';
import { InvoiceLine } from '../../../invoices/entities/invoice-line.entity';
import {
  PennylaneCreateInvoicePayload,
  PennylaneInvoiceLine,
} from '../types/pennylane.types';
import { toVatRateCode } from '../constants/vat-rate-map';

/**
 * Comptario Invoice + Lines → Pennylane POST /customer_invoices payload
 *
 * @param invoice        Fatura entity (tarih, para birimi, not vb.)
 * @param lines          Normalize fatura satırları (invoice_lines tablosu)
 * @param pennylaneCustomerId Pennylane'deki müşterinin integer ID'si
 * @param draft          true → taslak bırak, false → anında finalize et (default: false)
 */
export function mapInvoiceToPayload(
  invoice: Invoice,
  lines: InvoiceLine[],
  pennylaneCustomerId: number,
  draft = false,
): PennylaneCreateInvoicePayload {
  return {
    date: formatDate(invoice.issueDate),
    deadline: formatDate(invoice.dueDate),
    customer_id: pennylaneCustomerId,
    currency: invoice.invoiceCurrency ?? 'EUR',
    language: invoice.invoiceLanguage ?? 'fr_FR',
    draft,
    external_reference: invoice.invoiceNumber, // bizim fatura numaramız
    pdf_invoice_subject: `Facture ${invoice.invoiceNumber}`,
    invoice_lines: lines.map(mapLine),
  };
}

// ─── Line mapper ─────────────────────────────────────────────────────────────

function mapLine(line: InvoiceLine): PennylaneInvoiceLine {
  const vatCode = toVatRateCode(Number(line.taxRate));

  return {
    label: line.productName ?? line.description ?? 'Article',
    raw_currency_unit_price: formatDecimal(line.unitPrice),
    unit: line.unit ?? 'piece',
    vat_rate: vatCode,
    quantity: Number(line.quantity),
    description: line.description ?? undefined,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  // "2024-05-01T..." gibi ISO string gelirse sadece tarih kısmını al
  return String(d).slice(0, 10);
}

function formatDecimal(n: number | string | null | undefined): string {
  if (n == null) return '0.00';
  return Number(n).toFixed(2);
}

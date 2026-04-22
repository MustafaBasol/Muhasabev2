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
  if (!lines || lines.length === 0) {
    throw new Error(
      `Fatura ${invoice.invoiceNumber} için satır bulunamadı. E-fatura göndermek için en az 1 ürün/hizmet satırı gereklidir.`,
    );
  }

  return {
    date: formatDate(invoice.issueDate),
    deadline: formatDate(invoice.dueDate ?? invoice.issueDate),
    customer_id: pennylaneCustomerId,
    currency: invoice.invoiceCurrency ?? 'EUR',
    language: invoice.invoiceLanguage ?? 'fr_FR',
    draft,
    external_reference: invoice.invoiceNumber,
    pdf_invoice_subject: `Facture ${invoice.invoiceNumber}`,
    invoice_lines: lines.map(mapLine),
    // EN 16931 ödeme bilgileri (varsa)
    ...(invoice.paymentMethodCode ? { payment_method: invoice.paymentMethodCode } : {}),
    ...(invoice.paymentIban ? { payable_iban: invoice.paymentIban } : {}),
    ...(invoice.buyerReference ? { buyer_reference: invoice.buyerReference } : {}),
    ...(invoice.orderReference ? { order_reference: invoice.orderReference } : {}),
  };
}

// ─── Line mapper ─────────────────────────────────────────────────────────────

function mapLine(line: InvoiceLine): PennylaneInvoiceLine {
  const vatCode = toVatRateCode(Number(line.taxRate));
  const unitPrice = Number(line.unitPrice ?? 0);

  const mapped: PennylaneInvoiceLine = {
    label: line.productName ?? line.description ?? 'Article',
    raw_currency_unit_price: formatDecimal(unitPrice),
    unit: normalizeUnit(line.unit),
    vat_rate: vatCode,
    quantity: Math.max(Number(line.quantity ?? 1), 0.0001),
    description: line.description ?? undefined,
  };

  // Satır indirimi — Pennylane absolute discount
  const discount = Number(line.discountAmount ?? 0);
  if (discount > 0) {
    mapped.discount = {
      type: 'absolute',
      value: formatDecimal(discount),
    };
  }

  return mapped;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function formatDecimal(n: number | string | null | undefined): string {
  if (n == null) return '0.00';
  return Number(n).toFixed(2);
}

/**
 * Birim kodunu Pennylane'in beklediği formata normalize eder.
 * Pennylane: "piece", "hour", "day", "month", "km", "kg", "liter" vb.
 */
function normalizeUnit(unit: string | null | undefined): string {
  if (!unit) return 'piece';
  const u = unit.toLowerCase().trim();
  const UNIT_MAP: Record<string, string> = {
    'adet': 'piece',
    'pcs': 'piece',
    'pc': 'piece',
    'unit': 'piece',
    'units': 'piece',
    'saat': 'hour',
    'hr': 'hour',
    'hrs': 'hour',
    'h': 'hour',
    'gün': 'day',
    'd': 'day',
    'day': 'day',
    'ay': 'month',
    'month': 'month',
    'kg': 'kg',
    'kg.': 'kg',
    'lt': 'liter',
    'litre': 'liter',
    'l': 'liter',
    'km': 'km',
  };
  return UNIT_MAP[u] ?? 'piece';
}

import { mapInvoiceToPayload } from '../integrations/pennylane/mappers/invoice.mapper';
import { Invoice, InvoiceStatus, EInvoiceStatus } from '../invoices/entities/invoice.entity';
import { InvoiceLine } from '../invoices/entities/invoice-line.entity';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeLine(overrides: Partial<InvoiceLine> = {}): InvoiceLine {
  return {
    id: 'line-1',
    invoiceId: 'inv-1',
    invoice: null as unknown as Invoice,
    position: 1,
    productId: null,
    productName: 'Consulting',
    description: 'Dev services',
    quantity: 2,
    unitPrice: 500,
    taxRate: 20,
    discountAmount: 0,
    lineNet: 1000,
    lineTax: 200,
    lineGross: 1200,
    unit: 'hour',
    ...overrides,
  } as InvoiceLine;
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-uuid-1',
    invoiceNumber: 'FA-2024-001',
    issueDate: new Date('2024-05-01'),
    dueDate: new Date('2024-05-31'),
    invoiceCurrency: 'EUR',
    invoiceLanguage: 'fr_FR',
    status: InvoiceStatus.DRAFT,
    eInvoiceStatus: EInvoiceStatus.PENDING,
    paymentMethodCode: 'VIRE',
    paymentIban: 'FR7630006000011234567890189',
    buyerReference: 'PO-2024-001',
    orderReference: 'REF-999',
    ...overrides,
  } as Invoice;
}

// ─── mapInvoiceToPayload ──────────────────────────────────────────────────────

describe('mapInvoiceToPayload', () => {
  const PENNYLANE_CUSTOMER_ID = 42;

  it('zorunlu alanları doğru maplar', () => {
    const payload = mapInvoiceToPayload(makeInvoice(), [makeLine()], PENNYLANE_CUSTOMER_ID);

    expect(payload.customer_id).toBe(42);
    expect(payload.date).toBe('2024-05-01');
    expect(payload.deadline).toBe('2024-05-31');
    expect(payload.currency).toBe('EUR');
    expect(payload.language).toBe('fr_FR');
    expect(payload.external_reference).toBe('FA-2024-001');
    expect(payload.draft).toBe(false);
  });

  it('draft parametresi aktarılır', () => {
    const payload = mapInvoiceToPayload(makeInvoice(), [], PENNYLANE_CUSTOMER_ID, true);
    expect(payload.draft).toBe(true);
  });

  it('fatura satırlarını doğru maplar', () => {
    const payload = mapInvoiceToPayload(makeInvoice(), [makeLine()], PENNYLANE_CUSTOMER_ID);

    expect(payload.invoice_lines).toHaveLength(1);
    const line = payload.invoice_lines[0];
    expect(line.label).toBe('Consulting');
    expect(line.quantity).toBe(2);
    expect(line.raw_currency_unit_price).toBe('500.00');
    expect(line.unit).toBe('hour');
    expect(line.vat_rate).toBe('FR_200'); // taxRate 20 → FR_200
  });

  it('taxRate 5.5 → FR_55', () => {
    const line = makeLine({ taxRate: 5.5 });
    const payload = mapInvoiceToPayload(makeInvoice(), [line], PENNYLANE_CUSTOMER_ID);

    expect(payload.invoice_lines[0].vat_rate).toBe('FR_55');
  });

  it('taxRate 0 → exempt', () => {
    const line = makeLine({ taxRate: 0 });
    const payload = mapInvoiceToPayload(makeInvoice(), [line], PENNYLANE_CUSTOMER_ID);

    expect(payload.invoice_lines[0].vat_rate).toBe('exempt');
  });

  it('ödeme alanları varsa eklenir', () => {
    const payload = mapInvoiceToPayload(makeInvoice(), [], PENNYLANE_CUSTOMER_ID);

    expect(payload.payment_method).toBe('VIRE');
    expect(payload.payable_iban).toBe('FR7630006000011234567890189');
    expect(payload.buyer_reference).toBe('PO-2024-001');
    expect(payload.order_reference).toBe('REF-999');
  });

  it('ödeme alanları yoksa payload\'a eklenmez', () => {
    const invoice = makeInvoice({
      paymentMethodCode: undefined,
      paymentIban: undefined,
      buyerReference: undefined,
      orderReference: undefined,
    });
    const payload = mapInvoiceToPayload(invoice, [], PENNYLANE_CUSTOMER_ID);

    expect(payload).not.toHaveProperty('payment_method');
    expect(payload).not.toHaveProperty('payable_iban');
    expect(payload).not.toHaveProperty('buyer_reference');
    expect(payload).not.toHaveProperty('order_reference');
  });

  // ─── Tarih formatı ──────────────────────────────────────────────────────────

  it('issueDate ISO string ise YYYY-MM-DD olarak alır', () => {
    const invoice = makeInvoice({ issueDate: '2024-06-15T12:00:00.000Z' as unknown as Date });
    const payload = mapInvoiceToPayload(invoice, [], PENNYLANE_CUSTOMER_ID);

    expect(payload.date).toBe('2024-06-15');
  });

  it('issueDate null ise bugünün tarihi kullanılır', () => {
    const invoice = makeInvoice({ issueDate: null as unknown as Date });
    const payload = mapInvoiceToPayload(invoice, [], PENNYLANE_CUSTOMER_ID);

    expect(payload.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // ─── Para birimi ────────────────────────────────────────────────────────────

  it('currency null ise EUR varsayılır', () => {
    const invoice = makeInvoice({ invoiceCurrency: null as unknown as string });
    const payload = mapInvoiceToPayload(invoice, [], PENNYLANE_CUSTOMER_ID);

    expect(payload.currency).toBe('EUR');
  });

  // ─── Çoklu satır ────────────────────────────────────────────────────────────

  it('çoklu satır doğru maplar', () => {
    const lines = [
      makeLine({ id: 'line-1', productName: 'Service A', quantity: 1, unitPrice: 100, taxRate: 20 }),
      makeLine({ id: 'line-2', productName: 'Service B', quantity: 3, unitPrice: 50, taxRate: 5.5 }),
      makeLine({ id: 'line-3', productName: 'Service C', quantity: 5, unitPrice: 25, taxRate: 0 }),
    ];
    const payload = mapInvoiceToPayload(makeInvoice(), lines, PENNYLANE_CUSTOMER_ID);

    expect(payload.invoice_lines).toHaveLength(3);
    expect(payload.invoice_lines[1].vat_rate).toBe('FR_55');
    expect(payload.invoice_lines[2].vat_rate).toBe('exempt');
  });

  // ─── Fiyat formatı ──────────────────────────────────────────────────────────

  it('unitPrice decimal olarak formatlanır', () => {
    const line = makeLine({ unitPrice: 1234.5 });
    const payload = mapInvoiceToPayload(makeInvoice(), [line], PENNYLANE_CUSTOMER_ID);

    expect(payload.invoice_lines[0].raw_currency_unit_price).toBe('1234.50');
  });

  it('unitPrice null ise 0.00 döner', () => {
    const line = makeLine({ unitPrice: null as unknown as number });
    const payload = mapInvoiceToPayload(makeInvoice(), [line], PENNYLANE_CUSTOMER_ID);

    expect(payload.invoice_lines[0].raw_currency_unit_price).toBe('0.00');
  });
});

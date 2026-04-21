/**
 * Pennylane Submit E2E-Akış Testi (unit düzeyi, HTTP mock'lu)
 *
 * Test akışı:
 *   1. Invoice + Customer + Lines oluştur
 *   2. PennylaneSubmitService.submitInvoice çağrısı
 *   3. Pennylane API yanıtları mock olarak verilir
 *   4. Invoice.eInvoiceStatus → SUBMITTED olarak güncellenir
 *   5. syncInvoiceStatus → ACCEPTED olarak güncellenir
 */

import {
  Invoice,
  InvoiceStatus,
  EInvoiceStatus,
} from '../invoices/entities/invoice.entity';
import { InvoiceLine } from '../invoices/entities/invoice-line.entity';
import { Customer, CustomerType } from '../customers/entities/customer.entity';
import { PennylaneSubmitService } from '../integrations/pennylane/services/pennylane-submit.service';
import { PennylaneApiClient } from '../integrations/pennylane/services/pennylane-api.client';
import { PennylaneOAuthService } from '../integrations/pennylane/services/pennylane-oauth.service';
import { IntegrationLogService } from '../integrations/common/services/integration-log.service';

// ─── Mock bağımlılıklar ────────────────────────────────────────────────────

const TENANT_ID = 'tenant-e2e';
const INVOICE_ID = 'inv-e2e-001';
const CUSTOMER_ID = 'cust-e2e-001';

const mockInvoice: Partial<Invoice> = {
  id: INVOICE_ID,
  invoiceNumber: 'FA-2024-E2E',
  issueDate: new Date('2024-06-01'),
  dueDate: new Date('2024-06-30'),
  invoiceCurrency: 'EUR',
  invoiceLanguage: 'fr_FR',
  status: InvoiceStatus.DRAFT,
  eInvoiceStatus: EInvoiceStatus.PENDING,
  customerId: CUSTOMER_ID,
  providerInvoiceId: null,
  providerInvoiceNumber: null,
  tenantId: TENANT_ID,
};

const mockCustomer: Partial<Customer> = {
  id: CUSTOMER_ID,
  name: 'E2E Test SARL',
  email: 'e2e@test.fr',
  customerType: CustomerType.B2B,
  tvaNumber: 'FR99999999999',
  sirenNumber: '999999999',
  billingAddress: {
    street: '1 Rue du Test',
    city: 'Paris',
    postalCode: '75001',
    country: 'FR',
  },
  providerCustomerId: null,
  tenantId: TENANT_ID,
} as Partial<Customer>;

const mockLines: Partial<InvoiceLine>[] = [
  {
    id: 'line-e2e-1',
    invoiceId: INVOICE_ID,
    productName: 'Consulting',
    description: 'Dev services',
    quantity: 5,
    unitPrice: 200,
    taxRate: 20,
    unit: 'hour',
    position: 1,
  },
];

// ─── Repository mock'ları ─────────────────────────────────────────────────

const invoiceDb: Record<string, Partial<Invoice>> = { [INVOICE_ID]: { ...mockInvoice } };
const customerDb: Record<string, Partial<Customer>> = { [CUSTOMER_ID]: { ...mockCustomer } };

function makeRepoMock<T extends { id: string }>(db: Record<string, Partial<T>>) {
  return {
    findOne: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(db[where.id] ?? null),
    ),
    update: jest.fn((id: string, data: Partial<T>) => {
      db[id] = { ...db[id], ...data };
      return Promise.resolve({ affected: 1 });
    }),
    find: jest.fn(() => Promise.resolve(mockLines as T[])),
  };
}

const mockInvoiceRepo = makeRepoMock<Invoice>(invoiceDb);
const mockCustomerRepo = makeRepoMock<Customer>(customerDb);
const mockLineRepo = { find: jest.fn(() => Promise.resolve(mockLines as InvoiceLine[])) };

// ─── PennylaneApiClient mock ─────────────────────────────────────────────

const mockApiClient = {
  findCustomerByExternalRef: jest.fn(),
  createCompanyCustomer: jest.fn(),
  createIndividualCustomer: jest.fn(),
  createInvoice: jest.fn(),
  finalizeInvoice: jest.fn(),
  getInvoice: jest.fn(),
};

// ─── PennylaneOAuthService mock ──────────────────────────────────────────

const mockOauthService = {
  getValidAccessToken: jest.fn().mockResolvedValue('test-access-token'),
};

// ─── IntegrationLogService mock ──────────────────────────────────────────

const mockLogService = {
  info: jest.fn().mockResolvedValue(undefined),
  error: jest.fn().mockResolvedValue(undefined),
};

// ─── Test Suite ─────────────────────────────────────────────────────────

describe('PennylaneSubmitService — E2E akış', () => {
  let service: PennylaneSubmitService;

  beforeEach(() => {
    jest.clearAllMocks();
    // DB'yi sıfırla
    invoiceDb[INVOICE_ID] = { ...mockInvoice };
    customerDb[CUSTOMER_ID] = { ...mockCustomer };

    service = new PennylaneSubmitService(
      mockApiClient as unknown as PennylaneApiClient,
      mockOauthService as unknown as PennylaneOAuthService,
      mockLogService as unknown as IntegrationLogService,
      mockInvoiceRepo as unknown as any,
      mockLineRepo as unknown as any,
      mockCustomerRepo as unknown as any,
    );
  });

  // ─── upsertCustomer ──────────────────────────────────────────────────────

  describe('upsertCustomer', () => {
    it('mevcut olmayan müşteri Pennylane\'de oluşturulur', async () => {
      mockApiClient.findCustomerByExternalRef.mockResolvedValueOnce(null);
      mockApiClient.createCompanyCustomer.mockResolvedValueOnce({ id: 9001 });

      const result = await service.upsertCustomer(TENANT_ID, CUSTOMER_ID);

      expect(result.providerCustomerId).toBe('9001');
      expect(result.created).toBe(true);
      expect(mockApiClient.createCompanyCustomer).toHaveBeenCalledTimes(1);
      expect(mockCustomerRepo.update).toHaveBeenCalledWith(CUSTOMER_ID, {
        providerCustomerId: '9001',
      });
    });

    it('zaten varsa mevcut ID döner, API create çağrılmaz', async () => {
      mockApiClient.findCustomerByExternalRef.mockResolvedValueOnce({ id: 9001 });

      const result = await service.upsertCustomer(TENANT_ID, CUSTOMER_ID);

      expect(result.providerCustomerId).toBe('9001');
      expect(result.created).toBe(false);
      expect(mockApiClient.createCompanyCustomer).not.toHaveBeenCalled();
    });

    it('customer.providerCustomerId zaten doluysa API çağrılmaz', async () => {
      customerDb[CUSTOMER_ID] = { ...mockCustomer, providerCustomerId: '8000' };

      const result = await service.upsertCustomer(TENANT_ID, CUSTOMER_ID);

      expect(result.providerCustomerId).toBe('8000');
      expect(result.created).toBe(false);
      expect(mockApiClient.findCustomerByExternalRef).not.toHaveBeenCalled();
    });

    it('müşteri yoksa hata fırlatır', async () => {
      await expect(
        service.upsertCustomer(TENANT_ID, 'non-existent'),
      ).rejects.toThrow('Müşteri bulunamadı');
    });
  });

  // ─── submitInvoice ────────────────────────────────────────────────────────

  describe('submitInvoice', () => {
    beforeEach(() => {
      // Customer API chain — ilk call upsertCustomer için
      mockApiClient.findCustomerByExternalRef.mockResolvedValue(null);
      mockApiClient.createCompanyCustomer.mockResolvedValue({ id: 9001 });

      // Invoice API chain
      mockApiClient.createInvoice.mockResolvedValue({ id: 55000 });
      mockApiClient.finalizeInvoice.mockResolvedValue({
        id: 55000,
        invoice_number: 'PL-2024-55000',
        e_invoicing: { status: 'submitted' },
      });
    });

    it('tam akış: müşteri upsert → invoice oluştur → finalize → SUBMITTED', async () => {
      const result = await service.submitInvoice(TENANT_ID, INVOICE_ID);

      expect(result.providerInvoiceId).toBe('55000');
      expect(result.providerInvoiceNumber).toBe('PL-2024-55000');
      expect(result.eInvoiceStatus).toBe(EInvoiceStatus.SUBMITTED);

      // Invoice DB güncellendi mi?
      expect(invoiceDb[INVOICE_ID].providerInvoiceId).toBe('55000');
      expect(invoiceDb[INVOICE_ID].eInvoiceStatus).toBe(EInvoiceStatus.SUBMITTED);
    });

    it('fatura draft olarak oluşturulur (payload.draft = true)', async () => {
      await service.submitInvoice(TENANT_ID, INVOICE_ID);

      const createInvoiceCall = mockApiClient.createInvoice.mock.calls[0][1];
      expect(createInvoiceCall.draft).toBe(true);
    });

    it('finalize çağrısında doğru invoice ID kullanılır', async () => {
      await service.submitInvoice(TENANT_ID, INVOICE_ID);

      expect(mockApiClient.finalizeInvoice).toHaveBeenCalledWith(
        'test-access-token',
        55000,
      );
    });

    it('fatura yoksa hata fırlatır', async () => {
      await expect(
        service.submitInvoice(TENANT_ID, 'non-existent'),
      ).rejects.toThrow('Fatura bulunamadı');
    });

    it('faturada müşteri yoksa hata fırlatır', async () => {
      invoiceDb[INVOICE_ID] = { ...mockInvoice, customerId: undefined };

      await expect(
        service.submitInvoice(TENANT_ID, INVOICE_ID),
      ).rejects.toThrow('müşteri tanımlanmamış');
    });

    it('integration log kaydedilir', async () => {
      await service.submitInvoice(TENANT_ID, INVOICE_ID);

      expect(mockLogService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          action: 'submitInvoice',
          invoiceId: INVOICE_ID,
        }),
      );
    });
  });

  // ─── syncInvoiceStatus ────────────────────────────────────────────────────

  describe('syncInvoiceStatus', () => {
    beforeEach(() => {
      invoiceDb[INVOICE_ID] = {
        ...mockInvoice,
        providerInvoiceId: '55000',
        eInvoiceStatus: EInvoiceStatus.SUBMITTED,
      };
    });

    it('SUBMITTED → ACCEPTED geçişi güncellenir', async () => {
      mockApiClient.getInvoice.mockResolvedValueOnce({
        id: 55000,
        e_invoicing: { status: 'accepted' },
      });

      const result = await service.syncInvoiceStatus(TENANT_ID, INVOICE_ID);

      expect(result.updated).toBe(true);
      expect(result.eInvoiceStatus).toBe(EInvoiceStatus.ACCEPTED);
      expect(invoiceDb[INVOICE_ID].eInvoiceStatus).toBe(EInvoiceStatus.ACCEPTED);
    });

    it('durum değişmemişse updated=false döner', async () => {
      mockApiClient.getInvoice.mockResolvedValueOnce({
        id: 55000,
        e_invoicing: { status: 'submitted' },
      });

      const result = await service.syncInvoiceStatus(TENANT_ID, INVOICE_ID);

      expect(result.updated).toBe(false);
    });

    it('providerInvoiceId yoksa { updated: false } döner', async () => {
      invoiceDb[INVOICE_ID] = { ...mockInvoice, providerInvoiceId: null };

      const result = await service.syncInvoiceStatus(TENANT_ID, INVOICE_ID);

      expect(result.updated).toBe(false);
      expect(mockApiClient.getInvoice).not.toHaveBeenCalled();
    });

    it.each([
      ['submitted', EInvoiceStatus.SUBMITTED],
      ['sent', EInvoiceStatus.SENT],
      ['accepted', EInvoiceStatus.ACCEPTED],
      ['rejected', EInvoiceStatus.REJECTED],
      ['refused', EInvoiceStatus.REFUSED],
      ['in_dispute', EInvoiceStatus.IN_DISPUTE],
      ['collected', EInvoiceStatus.COLLECTED],
    ])('PDP status "%s" → EInvoiceStatus.%s', async (pdpStatus, expected) => {
      invoiceDb[INVOICE_ID].eInvoiceStatus = EInvoiceStatus.PENDING; // farklı olsun
      mockApiClient.getInvoice.mockResolvedValueOnce({
        id: 55000,
        e_invoicing: { status: pdpStatus },
      });

      const result = await service.syncInvoiceStatus(TENANT_ID, INVOICE_ID);

      expect(result.eInvoiceStatus).toBe(expected);
    });
  });
});

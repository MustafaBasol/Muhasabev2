import { InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { IopoleSyncService } from '../integrations/iopole/services/iopole-sync.service';
import { EInvoiceStatus, Invoice } from '../invoices/entities/invoice.entity';
import { IopoleAuthService } from '../integrations/iopole/services/iopole-auth.service';
import { IopoleApiClient } from '../integrations/iopole/services/iopole-api.client';

jest.mock('axios');

type MockRepo<T> = {
  findOne: jest.Mock<Promise<T | null>, [unknown?]>;
  save: jest.Mock<Promise<T>, [T]>;
  create: jest.Mock<T, [Partial<T>]>;
};

const createRepo = <T extends Record<string, unknown>>(): MockRepo<T> => ({
  findOne: jest.fn().mockResolvedValue(null),
  save: jest.fn(async (value: T) => value),
  create: jest.fn((value: Partial<T>) => value as T),
});

describe('IopoleSyncService', () => {
  let apiClient: {
    getInvoice: jest.Mock;
    getInvoiceStatusHistory: jest.Mock;
    searchInvoices: jest.Mock;
  };
  let invoiceRepository: MockRepo<Invoice>;
  let eventRepository: MockRepo<Record<string, unknown>>;
  let externalInvoiceRepository: MockRepo<Record<string, unknown>>;
  let service: IopoleSyncService;

  beforeEach(() => {
    apiClient = {
      getInvoice: jest.fn(),
      getInvoiceStatusHistory: jest.fn(),
      searchInvoices: jest.fn(),
    };
    invoiceRepository = createRepo<Invoice>();
    eventRepository = createRepo<Record<string, unknown>>();
    externalInvoiceRepository = createRepo<Record<string, unknown>>();

    service = new IopoleSyncService(
      apiClient as never,
      invoiceRepository as never,
      eventRepository as never,
      externalInvoiceRepository as never,
    );
  });

  it('invoice detail array response handled correctly and RECEIVED maps to INBOUND', async () => {
    apiClient.getInvoice.mockResolvedValue([
      {
        invoiceId: 'ext-1',
        way: 'RECEIVED',
        businessData: {
          seller: { name: 'Seller' },
        },
      },
    ]);

    const result = await service.syncInvoiceByExternalId('ext-1', 'tenant-1');

    expect(result.direction).toBe('INBOUND');
    expect(result.hasBusinessData).toBe(true);
    expect(externalInvoiceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        providerInvoiceId: 'ext-1',
        direction: 'INBOUND',
        way: 'RECEIVED',
      }),
    );
  });

  it('status-history REFUSED maps to REFUSED and rejection detail is extracted', async () => {
    const invoice = {
      id: 'inv-1',
      tenantId: 'tenant-1',
      eInvoiceStatus: EInvoiceStatus.PENDING,
    } as Invoice;
    invoiceRepository.findOne.mockResolvedValue(invoice);
    apiClient.getInvoiceStatusHistory.mockResolvedValue([
      {
        invoiceId: 'ext-1',
        statusId: 'status-1',
        date: '2026-05-04T09:55:59.334Z',
        status: { code: 'REFUSED' },
        json: {
          responses: [
            {
              documentStatus: { code: 'REFUSED' },
              rejectionDetail: {
                message: 'Incorrect recipient',
                reason: 'INCORRECT_RECIPIENT',
                networkReason: 'DEST_ERR',
              },
            },
          ],
        },
      },
    ]);

    const result = await service.syncInvoiceStatusHistory('ext-1', 'tenant-1');

    expect(result.lastStatusCode).toBe('refused');
    expect(invoiceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eInvoiceStatus: EInvoiceStatus.REFUSED,
        eInvoiceRejectionReasonCode: 'INCORRECT_RECIPIENT',
        eInvoiceRejectionReasonLabel: 'Incorrect recipient',
        eInvoiceErrorCode: 'DEST_ERR',
        eInvoiceErrorMessage: 'Incorrect recipient',
      }),
    );
  });

  it('duplicate statusId does not create duplicate EInvoiceEvent', async () => {
    apiClient.getInvoiceStatusHistory.mockResolvedValue([
      {
        invoiceId: 'ext-1',
        statusId: 'status-1',
        date: '2026-05-04T09:55:59.334Z',
        status: { code: 'REFUSED' },
      },
      {
        invoiceId: 'ext-1',
        statusId: 'status-1',
        date: '2026-05-04T09:55:59.334Z',
        status: { code: 'REFUSED' },
      },
    ]);
    eventRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-event' });

    const result = await service.syncInvoiceStatusHistory('ext-1', 'tenant-1');

    expect(eventRepository.save).toHaveBeenCalledTimes(1);
    expect(result.createdEvents).toBe(1);
    expect(result.duplicateEvents).toBe(1);
  });
});

describe('Iopole log redaction', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.IOPOLE_ENABLED = 'true';
    process.env.IOPOLE_CLIENT_ID = 'client-id';
    process.env.IOPOLE_CLIENT_SECRET = 'client-secret';
    process.env.IOPOLE_DEFAULT_CUSTOMER_ID = 'customer-id';
  });

  it('redacts tokens and secrets in auth logs', async () => {
    const service = new IopoleAuthService();
    const loggerSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);

    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          access_token: 'raw-token',
          client_secret: 'raw-secret',
          detail: 'Bearer abc.def.ghi',
        },
      },
    });

    await expect(service.getAccessToken()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    expect(loggerSpy).toHaveBeenCalled();
    const message = String(loggerSpy.mock.calls[0][0]);
    expect(message).not.toContain('raw-token');
    expect(message).not.toContain('raw-secret');
    expect(message).not.toContain('Bearer abc.def.ghi');
  });

  it('redacts tokens and secrets in API client logs', async () => {
    const authService = {
      getAccessToken: jest.fn().mockResolvedValue('token-value'),
    } as unknown as IopoleAuthService;
    const client = new IopoleApiClient(authService);
    const loggerSpy = jest
      .spyOn((client as any).logger, 'error')
      .mockImplementation(() => undefined);

    expect(() =>
      (client as any).handleRequestError('invoice detail', {
        isAxiosError: true,
        response: {
          data: {
            access_token: 'raw-token',
            client_secret: 'raw-secret',
            detail: 'Bearer abc.def.ghi',
          },
        },
      }),
    ).toThrow(InternalServerErrorException);

    const message = String(loggerSpy.mock.calls[0][0]);
    expect(message).not.toContain('raw-token');
    expect(message).not.toContain('raw-secret');
    expect(message).not.toContain('Bearer abc.def.ghi');
  });
});
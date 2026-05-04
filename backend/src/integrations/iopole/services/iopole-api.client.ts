import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  IOPOLE_DEFAULT_API_BASE_URL,
  IopoleFrenchDirectoryLookupParams,
  IopoleFrenchDirectoryResponse,
  IopoleInvoiceResponse,
  IopoleInvoiceSearchParams,
  IopoleInvoiceSearchResponse,
  IopoleInvoiceStatusHistoryResponse,
  IopoleNotSeenInvoicesResponse,
  IopoleNotSeenStatusesResponse,
} from '../types/iopole.types';
import { IopoleAuthService } from './iopole-auth.service';

@Injectable()
export class IopoleApiClient {
  private readonly logger = new Logger(IopoleApiClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly authService: IopoleAuthService) {
    this.http = axios.create({
      baseURL: process.env.IOPOLE_API_BASE_URL ?? IOPOLE_DEFAULT_API_BASE_URL,
      timeout: 15_000,
      headers: {
        Accept: 'application/json',
      },
    });
  }

  private sanitizeSensitiveText(input: string): string {
    return input
      .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]')
      .replace(/(access_token["']?\s*[:=]\s*["']?)([^"'\s,&}]+)/gi, '$1[REDACTED]')
      .replace(/(client_secret["']?\s*[:=]\s*["']?)([^"'\s,&}]+)/gi, '$1[REDACTED]');
  }

  private async buildHeaders(customerId?: string): Promise<Record<string, string>> {
    const token = await this.authService.getAccessToken();
    const resolvedCustomerId =
      customerId ?? process.env.IOPOLE_DEFAULT_CUSTOMER_ID ?? '';

    if (!resolvedCustomerId) {
      throw new InternalServerErrorException(
        'IOPOLE_DEFAULT_CUSTOMER_ID tanımlı değil.',
      );
    }

    return {
      Authorization: `Bearer ${token}`,
      'customer-id': resolvedCustomerId,
    };
  }

  private handleRequestError(context: string, error: unknown): never {
    const detail = this.sanitizeSensitiveText(
      axios.isAxiosError(error)
        ? JSON.stringify(error.response?.data ?? error.message)
        : String(error),
    );
    this.logger.error(`Iopole ${context} hatası: ${detail}`);

    if (axios.isAxiosError(error) && error.response?.status === 400) {
      throw new BadRequestException(`Iopole ${context} sorgusu reddedildi.`);
    }

    throw new InternalServerErrorException(`Iopole ${context} başarısız.`);
  }

  async lookupFrenchDirectory(
    params: IopoleFrenchDirectoryLookupParams,
  ): Promise<IopoleFrenchDirectoryResponse> {
    try {
      const response = await this.http.get<IopoleFrenchDirectoryResponse>(
        '/v1/directory/french',
        {
          headers: await this.buildHeaders(params.customerId),
          params: {
            q: params.q,
            offset: params.offset ?? 0,
            limit: params.limit ?? 10,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.handleRequestError('directory lookup', error);
    }
  }

  async searchInvoices(
    params: IopoleInvoiceSearchParams,
  ): Promise<IopoleInvoiceSearchResponse> {
    try {
      const response = await this.http.get<IopoleInvoiceSearchResponse>(
        '/v1.1/invoice/search',
        {
          headers: await this.buildHeaders(params.customerId),
          params: {
            q: params.q,
            expand: params.expand,
            offset: params.offset ?? 0,
            limit: params.limit ?? 50,
          },
          paramsSerializer: {
            indexes: null,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.handleRequestError('invoice search', error);
    }
  }

  async getInvoice(
    invoiceId: string,
    customerId?: string,
  ): Promise<IopoleInvoiceResponse> {
    try {
      const response = await this.http.get<IopoleInvoiceResponse>(
        `/v1/invoice/${encodeURIComponent(invoiceId)}`,
        {
          headers: await this.buildHeaders(customerId),
        },
      );

      return response.data;
    } catch (error) {
      this.handleRequestError('invoice detail', error);
    }
  }

  async getInvoiceStatusHistory(
    invoiceId: string,
    customerId?: string,
  ): Promise<IopoleInvoiceStatusHistoryResponse> {
    try {
      const response = await this.http.get<IopoleInvoiceStatusHistoryResponse>(
        `/v1/invoice/${encodeURIComponent(invoiceId)}/status-history`,
        {
          headers: await this.buildHeaders(customerId),
        },
      );

      return response.data;
    } catch (error) {
      this.handleRequestError('invoice status history', error);
    }
  }

  async getNotSeenInvoices(
    customerId?: string,
  ): Promise<IopoleNotSeenInvoicesResponse> {
    try {
      const response = await this.http.get<IopoleNotSeenInvoicesResponse>(
        '/v1/invoice/notSeen',
        {
          headers: await this.buildHeaders(customerId),
        },
      );

      return response.data;
    } catch (error) {
      this.handleRequestError('not seen invoices', error);
    }
  }

  async getNotSeenStatuses(
    customerId?: string,
  ): Promise<IopoleNotSeenStatusesResponse> {
    try {
      const response = await this.http.get<IopoleNotSeenStatusesResponse>(
        '/v1/invoice/status/notSeen',
        {
          headers: await this.buildHeaders(customerId),
        },
      );

      return response.data;
    } catch (error) {
      this.handleRequestError('not seen statuses', error);
    }
  }
}
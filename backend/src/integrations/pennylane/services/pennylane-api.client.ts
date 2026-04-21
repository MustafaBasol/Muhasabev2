import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  PENNYLANE_API_BASE,
  PennylaneCreateCompanyCustomerPayload,
  PennylaneCreateIndividualCustomerPayload,
  PennylaneCreateInvoicePayload,
  PennylaneCustomerResponse,
  PennylaneInvoiceResponse,
  PennylaneChangelogResponse,
} from '../types/pennylane.types';

/**
 * PennylaneApiClient
 *
 * Pennylane REST API v2 ile doğrudan konuşan düşük seviyeli HTTP istemci.
 * Her method, caller tarafından sağlanan geçerli bir accessToken alır.
 *
 * Retry / token-refresh mantığı üst katmandaki servis(ler)e aittir.
 */
@Injectable()
export class PennylaneApiClient {
  private readonly logger = new Logger(PennylaneApiClient.name);
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: PENNYLANE_API_BASE,
      timeout: 15_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  private handleError(context: string, err: unknown): never {
    if (axios.isAxiosError(err)) {
      const ae = err as AxiosError<{ message?: string; errors?: unknown }>;
      const status = ae.response?.status;
      const body = ae.response?.data;
      this.logger.error(`${context} HTTP ${status}: ${JSON.stringify(body)}`);
      throw new UnprocessableEntityException(
        `Pennylane API hatası [${context}]: HTTP ${status} — ${JSON.stringify(body)}`,
      );
    }
    throw err;
  }

  // ─── Customer ──────────────────────────────────────────────────────────────

  async createCompanyCustomer(
    token: string,
    payload: PennylaneCreateCompanyCustomerPayload,
  ): Promise<PennylaneCustomerResponse> {
    try {
      const res = await this.http.post<{ company_customer: PennylaneCustomerResponse }>(
        '/company_customers',
        payload,
        { headers: this.authHeaders(token) },
      );
      return res.data.company_customer;
    } catch (err) {
      this.handleError('createCompanyCustomer', err);
    }
  }

  async createIndividualCustomer(
    token: string,
    payload: PennylaneCreateIndividualCustomerPayload,
  ): Promise<PennylaneCustomerResponse> {
    try {
      const res = await this.http.post<{ individual_customer: PennylaneCustomerResponse }>(
        '/individual_customers',
        payload,
        { headers: this.authHeaders(token) },
      );
      return res.data.individual_customer;
    } catch (err) {
      this.handleError('createIndividualCustomer', err);
    }
  }

  /**
   * external_reference'e göre mevcut müşteri arar (GET /customers).
   * Yoksa null döner.
   */
  async findCustomerByExternalRef(
    token: string,
    externalRef: string,
  ): Promise<PennylaneCustomerResponse | null> {
    try {
      const res = await this.http.get<{ customers: PennylaneCustomerResponse[] }>(
        '/customers',
        {
          headers: this.authHeaders(token),
          params: { filter: `{"field":"external_reference","operator":"eq","value":"${externalRef}"}` },
        },
      );
      return res.data.customers?.[0] ?? null;
    } catch (err) {
      this.handleError('findCustomerByExternalRef', err);
    }
  }

  // ─── Invoice ───────────────────────────────────────────────────────────────

  async createInvoice(
    token: string,
    payload: PennylaneCreateInvoicePayload,
  ): Promise<PennylaneInvoiceResponse> {
    try {
      const res = await this.http.post<{ invoice: PennylaneInvoiceResponse }>(
        '/customer_invoices',
        payload,
        { headers: this.authHeaders(token) },
      );
      return res.data.invoice;
    } catch (err) {
      this.handleError('createInvoice', err);
    }
  }

  async getInvoice(
    token: string,
    pennylaneInvoiceId: string | number,
  ): Promise<PennylaneInvoiceResponse> {
    try {
      const res = await this.http.get<{ invoice: PennylaneInvoiceResponse }>(
        `/customer_invoices/${pennylaneInvoiceId}`,
        { headers: this.authHeaders(token) },
      );
      return res.data.invoice;
    } catch (err) {
      this.handleError('getInvoice', err);
    }
  }

  async finalizeInvoice(
    token: string,
    pennylaneInvoiceId: string | number,
  ): Promise<PennylaneInvoiceResponse> {
    try {
      const res = await this.http.put<{ invoice: PennylaneInvoiceResponse }>(
        `/customer_invoices/${pennylaneInvoiceId}/finalize`,
        {},
        { headers: this.authHeaders(token) },
      );
      return res.data.invoice;
    } catch (err) {
      this.handleError('finalizeInvoice', err);
    }
  }

  // ─── Changelog (Status Sync) ───────────────────────────────────────────────

  async getInvoiceChangelogs(
    token: string,
    opts: { cursor?: string; startDate?: string; limit?: number },
  ): Promise<PennylaneChangelogResponse> {
    try {
      const params: Record<string, string | number> = {};
      if (opts.cursor) params['cursor'] = opts.cursor;
      if (opts.startDate) params['start_date'] = opts.startDate;
      if (opts.limit) params['limit'] = opts.limit;

      const res = await this.http.get<PennylaneChangelogResponse>(
        '/changelogs/customer_invoices',
        { headers: this.authHeaders(token), params },
      );
      return res.data;
    } catch (err) {
      this.handleError('getInvoiceChangelogs', err);
    }
  }
}

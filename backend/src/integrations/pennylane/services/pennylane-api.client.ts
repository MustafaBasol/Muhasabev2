import { Injectable, Logger, UnprocessableEntityException, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  PENNYLANE_API_BASE,
  PennylaneCreateCompanyCustomerPayload,
  PennylaneCreateIndividualCustomerPayload,
  PennylaneCreateInvoicePayload,
  PennylaneCustomerResponse,
  PennylaneInvoiceResponse,
  PennylaneChangelogResponse,
  PennylaneSupplierInvoiceListResponse,
  PennylaneSupplierInvoiceResponse,
} from '../types/pennylane.types';

/** Pennylane /me endpoint yanıtı */
export interface PennylaneMeResponse {
  id: string;
  email: string;
  role: string;
}

/**
 * PennylaneApiClient
 *
 * Pennylane REST API v2 ile doğrudan konuşan düşük seviyeli HTTP istemci.
 * Her method, caller tarafından sağlanan geçerli bir accessToken alır.
 *
 * Rate limiting: 429 yanıtında Retry-After başlığına göre bekleyip yeniden dener (max 3 kez).
 */
@Injectable()
export class PennylaneApiClient {
  private readonly logger = new Logger(PennylaneApiClient.name);
  private readonly http: AxiosInstance;

  private static readonly MAX_RETRIES = 3;

  constructor() {
    this.http = axios.create({
      baseURL: PENNYLANE_API_BASE,
      timeout: 15_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // ─── 429 Rate-Limit Retry Interceptor ──────────────────────────────────
    this.http.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config as (typeof error.config) & { _retryCount?: number };
        if (!config) return Promise.reject(error);

        config._retryCount = config._retryCount ?? 0;

        if (
          error.response?.status === 429 &&
          config._retryCount < PennylaneApiClient.MAX_RETRIES
        ) {
          config._retryCount += 1;

          // Retry-After başlığı (saniye cinsinden) veya exponential backoff
          const retryAfterHeader = error.response.headers['retry-after'];
          const waitMs = retryAfterHeader
            ? Number(retryAfterHeader) * 1000
            : Math.pow(2, config._retryCount) * 1000; // 2s, 4s, 8s

          this.logger.warn(
            `Pennylane 429 rate limit — ${waitMs}ms sonra tekrar denenecek (deneme ${config._retryCount}/${PennylaneApiClient.MAX_RETRIES})`,
          );

          await new Promise((resolve) => setTimeout(resolve, waitMs));
          return this.http.request(config);
        }

        return Promise.reject(error);
      },
    );
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

      if (status === 429) {
        throw new ServiceUnavailableException(
          `Pennylane API rate limit aşıldı [${context}]. Daha sonra tekrar deneyin.`,
        );
      }

      throw new UnprocessableEntityException(
        `Pennylane API hatası [${context}]: HTTP ${status} — ${JSON.stringify(body)}`,
      );
    }
    throw err;
  }

  // ─── /me — Bağlantı Doğrulama ──────────────────────────────────────────────

  /**
   * Verilen token'ın geçerli olup olmadığını Pennylane /me endpoint'i ile doğrular.
   * Docs: "call the /me endpoint to verify your setup is correct"
   */
  async verifyConnection(token: string): Promise<PennylaneMeResponse> {
    try {
      const res = await this.http.get<PennylaneMeResponse>(
        '/me',
        { headers: this.authHeaders(token) },
      );
      return res.data;
    } catch (err) {
      this.handleError('verifyConnection', err);
    }
  }

  // ─── Customer ──────────────────────────────────────────────────────────────

  async createCompanyCustomer(
    token: string,
    payload: PennylaneCreateCompanyCustomerPayload,
  ): Promise<PennylaneCustomerResponse> {
    try {
      // Pennylane API v2: /company_customers payload'ı doğrudan alır, wrapper yok
      const res = await this.http.post<PennylaneCustomerResponse | { company_customer: PennylaneCustomerResponse }>(
        '/company_customers',
        payload,
        { headers: this.authHeaders(token) },
      );
      // Response wrapped veya direkt olabilir
      return (res.data as any).company_customer ?? res.data as PennylaneCustomerResponse;
    } catch (err) {
      this.handleError('createCompanyCustomer', err);
    }
  }

  async createIndividualCustomer(
    token: string,
    payload: PennylaneCreateIndividualCustomerPayload,
  ): Promise<PennylaneCustomerResponse> {
    try {
      // Pennylane API v2: /individual_customers payload'ı doğrudan alır, wrapper yok
      const res = await this.http.post<PennylaneCustomerResponse | { individual_customer: PennylaneCustomerResponse }>(
        '/individual_customers',
        payload,
        { headers: this.authHeaders(token) },
      );
      return (res.data as any).individual_customer ?? res.data as PennylaneCustomerResponse;
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
      // Pennylane API v2 filtreleri JSON array formatında istiyor
      const filterParam = JSON.stringify([
        { field: 'external_reference', operator: 'eq', value: externalRef },
      ]);
      const res = await this.http.get<{ customers: PennylaneCustomerResponse[] }>(
        '/customers',
        {
          headers: this.authHeaders(token),
          params: { filter: filterParam },
        },
      );
      return res.data.customers?.[0] ?? null;
    } catch (err) {
      // Filtre desteklenmiyorsa (400) ya da başka hata varsa null dön —
      // çağıran kod yeni müşteri oluşturmaya devam eder.
      if (axios.isAxiosError(err)) {
        const status = (err as AxiosError).response?.status;
        this.logger.warn(
          `findCustomerByExternalRef failed (HTTP ${status}), will create new customer`,
        );
        return null;
      }
      this.handleError('findCustomerByExternalRef', err);
    }
  }

  // ─── Invoice ───────────────────────────────────────────────────────────────

  async createInvoice(
    token: string,
    payload: PennylaneCreateInvoicePayload,
  ): Promise<PennylaneInvoiceResponse> {
    try {
      // Pennylane API v2: payload { customer_invoice: { ...fields, invoice_lines_attributes } }
      const { invoice_lines, ...rest } = payload as any;
      const wrappedPayload = {
        customer_invoice: {
          ...rest,
          invoice_lines_attributes: invoice_lines,
        },
      };
      const res = await this.http.post<any>(
        '/customer_invoices',
        wrappedPayload,
        { headers: this.authHeaders(token) },
      );
      // Pennylane v2 response: { customer_invoice: {...} } veya { invoice: {...} }
      return res.data.customer_invoice ?? res.data.invoice ?? res.data;
    } catch (err) {
      this.handleError('createInvoice', err);
    }
  }

  async getInvoice(
    token: string,
    pennylaneInvoiceId: string | number,
  ): Promise<PennylaneInvoiceResponse> {
    try {
      const res = await this.http.get<any>(
        `/customer_invoices/${pennylaneInvoiceId}`,
        { headers: this.authHeaders(token) },
      );
      return res.data.customer_invoice ?? res.data.invoice ?? res.data;
    } catch (err) {
      this.handleError('getInvoice', err);
    }
  }

  async finalizeInvoice(
    token: string,
    pennylaneInvoiceId: string | number,
  ): Promise<PennylaneInvoiceResponse> {
    try {
      const res = await this.http.put<any>(
        `/customer_invoices/${pennylaneInvoiceId}/finalize`,
        {},
        { headers: this.authHeaders(token) },
      );
      return res.data.customer_invoice ?? res.data.invoice ?? res.data;
    } catch (err) {
      this.handleError('finalizeInvoice', err);
    }
  }

  /**
   * Taslak (draft) faturayı Pennylane'den siler.
   * Finalize edilmiş faturalar DELETE ile silinemez — credit note gerekir.
   * Hata durumunda exception fırlatır (caller log'lar ve devam eder).
   */
  async cancelInvoice(
    token: string,
    pennylaneInvoiceId: string | number,
  ): Promise<void> {
    try {
      await this.http.delete(
        `/customer_invoices/${pennylaneInvoiceId}`,
        { headers: this.authHeaders(token) },
      );
    } catch (err) {
      this.handleError('cancelInvoice', err);
    }
  }

  // ─── Supplier Invoices (Gelen E-Fatura) ───────────────────────────────────

  /**
   * Tedarikçi faturalarını listeler (gelen e-faturalar).
   * Pennylane API: GET /supplier_invoices
   *
   * @param page 1-tabanlı sayfa numarası
   * @param updatedSince ISO datetime — bu tarihten sonra güncellenenler
   */
  async listSupplierInvoices(
    token: string,
    opts: { page?: number; updatedSince?: string } = {},
  ): Promise<PennylaneSupplierInvoiceListResponse> {
    try {
      const params: Record<string, string | number> = { per_page: 50 };
      if (opts.page) params['page'] = opts.page;
      if (opts.updatedSince) params['updated_since'] = opts.updatedSince;

      const res = await this.http.get<PennylaneSupplierInvoiceListResponse>(
        '/supplier_invoices',
        { headers: this.authHeaders(token), params },
      );
      return res.data;
    } catch (err) {
      this.handleError('listSupplierInvoices', err);
    }
  }

  /**
   * Tek bir tedarikçi faturasını getirir.
   * Pennylane API: GET /supplier_invoices/{id}
   */
  async getSupplierInvoice(
    token: string,
    supplierInvoiceId: string | number,
  ): Promise<PennylaneSupplierInvoiceResponse> {
    try {
      const res = await this.http.get<{ supplier_invoice: PennylaneSupplierInvoiceResponse }>(
        `/supplier_invoices/${supplierInvoiceId}`,
        { headers: this.authHeaders(token) },
      );
      return res.data.supplier_invoice;
    } catch (err) {
      this.handleError('getSupplierInvoice', err);
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

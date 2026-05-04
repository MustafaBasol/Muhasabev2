import { EInvoiceStatus } from '../../../invoices/entities/invoice.entity';

export const IOPOLE_DEFAULT_ENV = 'ppd';
export const IOPOLE_DEFAULT_API_BASE_URL = 'https://api.ppd.iopole.fr';
export const IOPOLE_DEFAULT_AUTH_URL =
  'https://auth.ppd.iopole.fr/realms/iopole/protocol/openid-connect/token';

export const IOPOLE_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  SENT: 'sent',
  DELIVERED: 'delivered',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  REFUSED: 'refused',
  IN_DISPUTE: 'in_dispute',
  COLLECTED: 'collected',
  PARTIALLY_COLLECTED: 'partially_collected',
  CANCELLED: 'cancelled',
} as const;

export const IOPOLE_EINVOICE_STATUS_MAP: Record<string, EInvoiceStatus> = {
  [IOPOLE_STATUS.PENDING]: EInvoiceStatus.PENDING,
  [IOPOLE_STATUS.SUBMITTED]: EInvoiceStatus.SUBMITTED,
  [IOPOLE_STATUS.SENT]: EInvoiceStatus.SENT,
  [IOPOLE_STATUS.DELIVERED]: EInvoiceStatus.SENT,
  [IOPOLE_STATUS.ACCEPTED]: EInvoiceStatus.ACCEPTED,
  [IOPOLE_STATUS.REJECTED]: EInvoiceStatus.REJECTED,
  [IOPOLE_STATUS.REFUSED]: EInvoiceStatus.REFUSED,
  [IOPOLE_STATUS.IN_DISPUTE]: EInvoiceStatus.IN_DISPUTE,
  [IOPOLE_STATUS.COLLECTED]: EInvoiceStatus.COLLECTED,
  [IOPOLE_STATUS.PARTIALLY_COLLECTED]: EInvoiceStatus.PARTIALLY_COLLECTED,
  [IOPOLE_STATUS.CANCELLED]: EInvoiceStatus.REJECTED,
};

export interface IopoleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface IopoleFrenchDirectoryLookupParams {
  q: string;
  offset?: number;
  limit?: number;
  customerId?: string;
}

export interface IopoleInvoiceSearchParams {
  q?: string;
  expand?: string[];
  offset?: number;
  limit?: number;
  customerId?: string;
}

export type IopoleFrenchDirectoryResponse = Record<string, unknown>;
export type IopoleInvoiceSearchResponse = Record<string, unknown>;
export type IopoleInvoiceResponse = Record<string, unknown>;
export type IopoleInvoiceStatusHistoryResponse = Record<string, unknown>;
export type IopoleNotSeenInvoicesResponse = string[];
export type IopoleNotSeenStatusesResponse = Record<string, unknown>[];
/** Provider'ın yazılabileceği tüm tanımlayıcılar */
export const PROVIDER_KEYS = {
  PENNYLANE: 'pennylane',
  CHORUS_PRO: 'chorus_pro',
} as const;

export type ProviderKey = (typeof PROVIDER_KEYS)[keyof typeof PROVIDER_KEYS];

/** Provider bağlantı durumu */
export enum ProviderConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  PENDING = 'pending',
}

/** OutboundJob durumları */
export enum OutboundJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/** OutboundJob türleri */
export enum OutboundJobType {
  SUBMIT_INVOICE = 'submit_invoice',
  SYNC_INVOICE_STATUS = 'sync_invoice_status',
  UPSERT_CUSTOMER = 'upsert_customer',
}

/** IntegrationLog seviyesi */
export enum IntegrationLogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

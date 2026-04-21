/**
 * E-fatura iş kuyruğu sabitleri.
 *
 * Kuyruk isimleri Redis key olarak kullanılır — değiştirmeden önce
 * mevcut işlerin tamamlanmasını bekleyin.
 */

/** BullMQ kuyruk adı */
export const EINVOICE_QUEUE = 'einvoice';

/** İş türleri */
export const EINVOICE_JOB = {
  /** Faturayı provider'a gönder (Pennylane finalize) */
  SUBMIT: 'einvoice.submit',
  /** Tek faturanın durumunu provider'dan güncelle */
  SYNC_ONE: 'einvoice.sync_one',
  /** Tenant bazlı tüm açık faturaları taramak için cron tarafından tetiklenir */
  SYNC_TENANT: 'einvoice.sync_tenant',
} as const;

/** Submit işi payload'u */
export interface SubmitJobPayload {
  tenantId: string;
  invoiceId: string;
}

/** Tek fatura sync işi payload'u */
export interface SyncOneJobPayload {
  tenantId: string;
  invoiceId: string;
}

/** Tenant sync işi payload'u */
export interface SyncTenantJobPayload {
  tenantId: string;
}

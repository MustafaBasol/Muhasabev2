import apiClient from './client';

// ── E-Fatura durum enum'u (backend ile senkron) ────────────────────────────
export enum EInvoiceStatus {
  NOT_APPLICABLE = 'not_applicable',
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  SENT = 'sent',
  APPROVED = 'approved',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  REFUSED = 'refused',
  IN_DISPUTE = 'in_dispute',
  COLLECTED = 'collected',
  PARTIALLY_COLLECTED = 'partially_collected',
}

// ── Pennylane ──────────────────────────────────────────────────────────────

/**
 * Pennylane OAuth authorize URL'ini backend'den authenticated çağrıyla alır.
 * (window.location.href ile direkt backend'e gitmek JWT header göndermediğinden 401 verir.)
 */
export async function getPennylaneAuthorizeUrl(): Promise<string> {
  const res = await apiClient.get<{ url: string }>('/integrations/pennylane/oauth/authorize-url');
  return res.data.url;
}

export async function getPennylaneStatus(): Promise<{
  connected: boolean;
  connectedAt?: string | null;
}> {
  const res = await apiClient.get('/integrations/pennylane/status');
  return res.data;
}

export async function disconnectPennylane(): Promise<void> {
  await apiClient.delete('/integrations/pennylane/disconnect');
}

/** Pennylane /me endpoint'ini çağırarak token geçerliliğini doğrular */
export async function verifyPennylaneConnection(): Promise<{
  ok: boolean;
  email?: string;
  role?: string;
}> {
  const res = await apiClient.get('/integrations/pennylane/verify');
  return res.data;
}

export async function submitInvoiceToPennylane(
  invoiceId: string,
): Promise<{ ok: boolean; providerInvoiceId?: string; eInvoiceStatus?: string }> {
  const res = await apiClient.post('/integrations/pennylane/invoices/submit', {
    invoiceId,
  });
  return res.data;
}

export async function syncPennylaneInvoices(): Promise<{
  ok: boolean;
  updated?: number;
}> {
  const res = await apiClient.post('/integrations/pennylane/sync', {});
  return res.data;
}

/** Pennylane'deki gelen tedarikçi faturalarını Gider olarak import eder */
export async function syncIncomingInvoices(): Promise<{
  ok: boolean;
  created: number;
  skipped: number;
  errors: number;
}> {
  const res = await apiClient.post('/integrations/pennylane/incoming/sync', {});
  return res.data;
}

// ── Chorus Pro ─────────────────────────────────────────────────────────────

export async function getChorusProStatus(): Promise<{
  connected: boolean;
  siret?: string;
}> {
  const res = await apiClient.get('/integrations/chorus-pro/status');
  return res.data;
}

export async function connectChorusPro(credentials: {
  pisteClientId: string;
  pisteClientSecret: string;
  siret: string;
}): Promise<void> {
  await apiClient.post('/integrations/chorus-pro/connect', credentials);
}

export async function disconnectChorusPro(): Promise<void> {
  await apiClient.delete('/integrations/chorus-pro/connect');
}

export async function submitInvoiceToChorusPro(
  invoiceId: string,
): Promise<{ ok: boolean; providerInvoiceId?: string; eInvoiceStatus?: string }> {
  const res = await apiClient.post('/integrations/chorus-pro/invoices/submit', {
    invoiceId,
  });
  return res.data;
}

export async function syncChorusProInvoice(
  invoiceId: string,
): Promise<{ updated: boolean; eInvoiceStatus?: string }> {
  const res = await apiClient.post('/integrations/chorus-pro/invoices/sync', {
    invoiceId,
  });
  return res.data;
}

// ── Factur-X ───────────────────────────────────────────────────────────────

/**
 * Fatura için Factur-X PDF indir.
 * Blob olarak döner — <a download> ile kaydetmek için kullan.
 */
export async function downloadFacturX(
  invoiceId: string,
  profile: 'MINIMUM' | 'BASIC WL' | 'EN 16931' | 'EXTENDED' = 'EN 16931',
): Promise<Blob> {
  const res = await apiClient.get(`/invoices/${invoiceId}/facturx`, {
    params: { profile },
    responseType: 'blob',
  });
  return res.data as Blob;
}

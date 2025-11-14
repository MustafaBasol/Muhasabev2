import apiClient from './client';
import { logger } from '../utils/logger';

export type BillingInterval = 'month' | 'year';
export type BillingPlan = 'professional' | 'enterprise' | 'pro' | 'business';

export interface CheckoutSessionResponse {
  url: string;
  id: string;
}

export interface PortalSessionResponse {
  url: string;
}

export interface UpdateSeatsResponse {
  success: boolean;
  maxUsers: number;
}

export interface AddonProrationResponse {
  success: boolean;
  newAddonQty: number;
  maxUsers: number;
  upcomingProrationTotal?: number | null; // sadece ek koltukların anlık ek ücreti (proration)
  upcomingNextInvoiceTotal?: number | null; // Stripe'in bir sonraki toplam faturası
  upcomingCurrency?: string | null;
  upcomingPeriodEnd?: string | null;
}

export interface AddonImmediateChargeResponse {
  success: boolean;
  newAddonQty: number;
  maxUsers: number;
  invoiceId?: string;
  invoiceStatus?: string;
  amountDue?: number | null;
  amountPaid?: number | null;
  currency?: string | null;
  hostedInvoiceUrl?: string | null;
  pdf?: string | null;
}

export interface CancelResponse {
  success: boolean;
  currentPeriodEnd?: string;
}

export async function updatePlan(
  tenantId: string,
  params: { plan: BillingPlan; interval: BillingInterval; seats?: number; chargeNow?: boolean; interactive?: boolean; idempotencyKey?: string }
): Promise<{
  success: boolean;
  plan?: string;
  billingInterval?: string | null;
  maxUsers?: number;
  upcomingTotal?: number | null;
  invoiceSkipped?: boolean;
  invoiceError?: string | null;
  invoiceId?: string | null;
  invoiceStatus?: string | null;
  amountDue?: number | null;
  amountPaid?: number | null;
  currency?: string | null;
  hostedInvoiceUrl?: string | null;
  pdf?: string | null;
}> {
  const res = await apiClient.post(`/billing/${tenantId}/plan-update`, params);
  return res.data;
}

export interface BillingInvoiceDTO {
  id: string;
  number?: string | null;
  status?: string | null;
  currency?: string | null;
  total?: number | null; // amount in minor units
  hostedInvoiceUrl?: string | null;
  pdf?: string | null;
  created?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  attemptCount?: number | null;
  paid?: boolean | null;
}

/**
 * Abonelik plan değiştirme (upgrade/downgrade) + koltuk adedi belirleme
 */
export async function createCheckoutSession(params: {
  tenantId: string;
  plan: BillingPlan;
  interval: BillingInterval;
  seats?: number; // addon kullanıcı sayısı (base + seats = toplam maxUsers)
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSessionResponse> {
  const res = await apiClient.post('/billing/checkout', params);
  return res.data;
}

/**
 * Stripe Müşteri Portalı oturumu oluşturur
 */
export async function createPortalSession(tenantId: string, returnUrl: string): Promise<PortalSessionResponse> {
  try {
    const res = await apiClient.get(`/billing/${tenantId}/portal`, { params: { returnUrl } });
    return res.data;
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || 'Portal hatası';
    // Bu test-mode yapılandırma hatasını kullanıcıya net gösterelim
    if (String(msg).includes('test mode default configuration has not been created')) {
      throw new Error('Portal oturumu oluşturulamadı: No configuration provided and your test mode default configuration has not been created. Stripe Dashboard > Billing > Portal > Settings sayfasından test mode için varsayılan yapılandırmayı kaydetmeniz gerekir.');
    }
    throw e;
  }
}

/**
 * Koltuk (addon user) sayısını günceller. seats değeri sadece ekstra kullanıcıları ifade eder.
 */
export async function updateSeats(tenantId: string, seats: number): Promise<UpdateSeatsResponse> {
  const res = await apiClient.post(`/billing/${tenantId}/seats`, { seats });
  return res.data;
}

/** İlave kullanıcılar için ödeme oturumu oluşturur (Checkout Payment) */
export async function createAddonCheckout(tenantId: string, additional: number, _successUrl: string, _cancelUrl: string): Promise<AddonProrationResponse> {
  const res = await apiClient.post(`/billing/${tenantId}/addon/checkout`, { additional });
  return res.data as AddonProrationResponse;
}

/** İlave kullanıcıları hemen faturalandır (proration için anında invoice & tahsilat) */
export async function chargeAddonNow(tenantId: string, additional: number): Promise<AddonImmediateChargeResponse> {
  try {
    const res = await apiClient.post(`/billing/${tenantId}/addon/charge`, { additional });
    return res.data as AddonImmediateChargeResponse;
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 404) {
      // Path param route bulunamadıysa alternatif body tabanlı rotayı dene
      const alt = await apiClient.post('/billing/addon/charge', { tenantId, additional });
      return alt.data as AddonImmediateChargeResponse;
    }
    throw e;
  }
}

/** İptal: Dönem sonunda aboneliği sonlandır */
export async function cancelSubscriptionAtPeriodEnd(tenantId: string): Promise<CancelResponse> {
  const res = await apiClient.post(`/billing/${tenantId}/cancel`);
  return res.data;
}

/** Dönem sonu iptalini kaldır (aboneliği yeniden başlat) */
export async function resumeSubscription(tenantId: string): Promise<{ success: boolean; cancelAtPeriodEnd: false; currentPeriodEnd?: string | null }>{
  const res = await apiClient.post(`/billing/${tenantId}/resume`);
  return res.data;
}

/** Stripe faturalarını listele */
export async function listInvoices(tenantId: string): Promise<{ invoices: BillingInvoiceDTO[] }>{
  const res = await apiClient.get(`/billing/${tenantId}/invoices`);
  return res.data;
}

/** Stripe abonelik/geçmiş olaylarını listele (fatura + plan) */
export async function listHistory(tenantId: string): Promise<{ success: boolean; events: Array<{ type: string; at?: string; plan?: string; users?: number; amount?: number; currency?: string }> }> {
  const res = await apiClient.get(`/billing/${tenantId}/history`);
  return res.data;
}

/** Stripe senkronu (webhook gelmezse manuel) */
export async function syncSubscription(tenantId: string): Promise<{ success: boolean; updated?: boolean; plan?: string; billingInterval?: string | null; maxUsers?: number | null; cancelAtPeriodEnd?: boolean | null; subscriptionExpiresAt?: string | null }> {
  const res = await apiClient.post(`/billing/${tenantId}/sync`);
  return res.data;
}

// Yardımcı: Plan etiketini UI için normalize et
export function humanizePlan(plan?: string): string {
  if (!plan) return 'Free';
  const p = plan.toLowerCase();
  if (p.includes('enterprise') || p.includes('business')) return 'Enterprise';
  if (p.includes('professional') || p === 'pro') return 'Pro';
  if (p.includes('basic') || p.includes('starter')) return 'Basic';
  return 'Free';
}

// Yardımcı: Interval etiketini UI için
export function humanizeInterval(interval?: string | null): string {
  if (!interval) return '';
  if (interval === 'month') return 'Aylık';
  if (interval === 'year') return 'Yıllık';
  return interval;
}

// Örnek kullanım (debug):
export async function debugUpgrade(tenantId: string) {
  try {
    const session = await createCheckoutSession({
      tenantId,
      plan: 'professional',
      interval: 'month',
      seats: 2,
      successUrl: window.location.origin + '/settings?upgrade=success',
      cancelUrl: window.location.origin + '/settings?upgrade=cancel',
    });
    logger.info('Checkout session oluşturuldu:', session.id);
    window.location.href = session.url; // redirect
  } catch (e: any) {
    logger.error('Upgrade hata:', e?.message || e);
    window.dispatchEvent(
      new CustomEvent('showToast', { detail: { message: 'Upgrade başarısız: ' + (e?.message || 'Bilinmeyen hata'), tone: 'error' } })
    );
  }
}

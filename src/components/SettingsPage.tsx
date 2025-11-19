import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  User,
  Users,
  Building2,
  Bell,
  Shield,
  Lock,
  Download,
  Save,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Calendar,
} from 'lucide-react';
import type { CompanyProfile } from '../utils/pdfGenerator';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useNotificationPreferences } from '../contexts/NotificationPreferencesContext';
import { tenantsApi } from '../api/tenants';
import { usersApi } from '../api/users';
import { organizationsApi } from '../api/organizations';
import {
  cancelSubscriptionAtPeriodEnd as billingCancel,
  createAddonCheckout,
  createPortalSession,
  updateSeats as billingUpdateSeats,
  createCheckoutSession,
  updatePlan,
} from '../api/billing';
import { AuditLogComponent } from './AuditLogComponent';
import OrganizationMembersPage from './OrganizationMembersPage';
import FiscalPeriodsPage from './FiscalPeriodsPage';
import InfoModal from './InfoModal';

type BankAccount = {
  id: string;
  bankName: string;
  accountName: string;
  iban: string;
};

interface SettingsPageProps {
  user?: { name: string; email: string };
  company?: CompanyProfile;
  bankAccounts?: BankAccount[];
  onUserUpdate?: (user: any) => void;
  onCompanyUpdate?: (company: CompanyProfile) => void;
  onExportData?: () => void;
  onImportData?: (payload: any) => void;
  language?: 'tr' | 'en' | 'fr' | 'de';
  initialTab?: string;
}

// === Plan Tab (hooks ayrı bir bileşene taşındı; SettingsPage içinde koşullu çağrı artık hook sırasını bozmaz) ===
interface PlanTabProps {
  tenant: any;
  currentLanguage: SettingsLanguage;
  text: SettingsTranslations;
}

const PlanTab: React.FC<PlanTabProps> = ({ tenant, currentLanguage, text }) => {
  const { t } = useTranslation('common');
  const { refreshUser } = useAuth();
  const planRaw = String(tenant?.subscriptionPlan || '').toLowerCase();
  const isFree = planRaw === 'free';
  const baseIncludedFor = (planStr: string): number => {
    const p = String(planStr || '').toLowerCase();
    if (p === 'professional' || p === 'pro') return 3; // Pro: 3 kullanıcı dahil
    if (p === 'enterprise' || p === 'business') return 10; // Business: 10 kullanıcı dahil
    return 1; // Basic/Free
  };
  const planLabelMap: Record<string, string> = {
    free: 'Starter',
    basic: 'Basic', // legacy
    professional: 'Pro',
    enterprise: 'Business',
  };
  const planText = planLabelMap[planRaw] || (planRaw ? planRaw.toUpperCase() : '—');
  const periodMap: Record<SettingsLanguage, { month: string; year: string }> = {
    tr: { month: t('common:planTab.monthly'), year: t('common:planTab.yearly') },
    en: { month: t('common:planTab.monthly'), year: t('common:planTab.yearly') },
    fr: { month: t('common:planTab.monthly'), year: t('common:planTab.yearly') },
    de: { month: t('common:planTab.monthly'), year: t('common:planTab.yearly') },
  } as const;
  // Backend tenant nesnesinde varsa billingInterval'ı kullan; yoksa yenileme tarihinden çıkarım yap
  const intervalRaw = (tenant as any)?.billingInterval as ('month' | 'year' | undefined);
  const inferredInterval = (() => {
    if (intervalRaw) return intervalRaw;
    try {
      const exp = tenant?.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt).getTime() : 0;
      const now = Date.now();
      if (exp > now) {
        const days = Math.round((exp - now) / (1000 * 60 * 60 * 24));
        if (days >= 330) return 'year';
        if (days >= 25) return 'month';
      }
    } catch {}
    return undefined;
  })();
  const effectiveInterval = inferredInterval; // 'month' | 'year' | undefined
  const periodText = isFree
    ? ''
    : (effectiveInterval
        ? (periodMap[currentLanguage]?.[effectiveInterval] || (effectiveInterval === 'year' ? 'Yearly' : 'Monthly'))
        : (periodMap[currentLanguage]?.month || 'Monthly'));

  // --- Local state ---
  // Yalnız landing'deki 3 plan: Starter(Free), Pro, Business(Enterprise)
  const allowedPlans = ['free', 'professional', 'enterprise'] as const;
  const [desiredPlan, setDesiredPlan] = useState<string>(
    allowedPlans.includes(planRaw as any) ? planRaw : 'free'
  );
  const [desiredBilling, setDesiredBilling] = useState<'monthly' | 'yearly'>('monthly');
  const currentMaxUsers = (tenant?.maxUsers as number) || 1;
  // Plan değişiminde hedef kullanıcı alanı kaldırıldı; koltuk artışı yalnız add-on akışından yapılır
  // İlave kullanıcı ekleme için bağımsız state (sadece ek sayısı)
  const [additionalUsersToAdd, setAdditionalUsersToAdd] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [planMessage, setPlanMessage] = useState<string>('');
  // Plan kaydetmeden önce onay modali
  const [planConfirm, setPlanConfirm] = useState<{ open: boolean; title: string; message: string }>({ open: false, title: '', message: '' });
  // Add-on onay modali durumu
  const [addonConfirm, setAddonConfirm] = useState<{ open: boolean; mode: 'now' | 'later'; count: number }>({ open: false, mode: 'now', count: 1 });
  // Ödeme sonucu modali
  const [paymentResult, setPaymentResult] = useState<{ open: boolean; title: string; message: string; tone: 'success' | 'error' | 'info' }>({ open: false, title: '', message: '', tone: 'info' });
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');
  const [invoiceSearch, setInvoiceSearch] = useState<string>('');
  const [invoiceDateFrom, setInvoiceDateFrom] = useState<string>('');
  const [invoiceDateTo, setInvoiceDateTo] = useState<string>('');
  // Organizasyondaki aktif üye sayısını göstermek için (sadece görsel amaçlı)
  const [seatsInUse, setSeatsInUse] = useState<number | null>(null);

  const getFilteredInvoices = () => {
    return invoices.filter((inv: any) => {
      const status = String(inv.status || '').toLowerCase();
      if (invoiceStatusFilter === 'paid' && status !== 'paid') return false;
      if (invoiceStatusFilter === 'open' && !['open', 'draft'].includes(status)) return false;
      if (invoiceStatusFilter === 'unpaid' && !['unpaid', 'void', 'uncollectible'].includes(status)) return false;
      if (invoiceStatusFilter === 'all') {
        // pass
      }
      if (invoiceSearch) {
        const needle = invoiceSearch.toLowerCase();
        const hay = (inv.number || inv.id || '').toLowerCase() + ' ' + (inv.currency || '').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (invoiceDateFrom) {
        const fromTs = new Date(invoiceDateFrom + 'T00:00:00Z').getTime();
        const invTs = inv.created ? new Date(inv.created).getTime() : 0;
        if (invTs < fromTs) return false;
      }
      if (invoiceDateTo) {
        const toTs = new Date(invoiceDateTo + 'T23:59:59Z').getTime();
        const invTs = inv.created ? new Date(inv.created).getTime() : 0;
        if (invTs > toTs) return false;
      }
      return true;
    });
  };
  // Ücretli planlarda tüm iptaller dönem sonunda gerçekleşir; kullanıcıya seçenek sunmuyoruz
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean>(!!tenant?.cancelAtPeriodEnd);

  // Sync desired plan if tenant changes
  useEffect(() => {
    // Eğer mevcut plan dropdown'da yoksa varsayılan 'free' seçilsin
    setDesiredPlan(allowedPlans.includes(planRaw as any) ? planRaw : 'free');
  // Kullanıcı hedef alanı kaldırıldığı için burada ayrı bir senkron gerekmiyor
    setCancelAtPeriodEnd(!!tenant?.cancelAtPeriodEnd);
  }, [planRaw, tenant?.maxUsers, tenant?.cancelAtPeriodEnd]);

  // Mount'ta tenant bilgisini tazele (AuthContext üzerinden)
  useEffect(() => {
    refreshUser().catch(() => {});
  }, []);

  // Eğer ücretli planda maxUsers, planın baz dahil kullanıcı sayısından az görünüyorsa otomatik Stripe senkronu tetikle
  useEffect(() => {
    (async () => {
      try {
        if (!['professional', 'enterprise'].includes(planRaw)) return;
        const base = baseIncludedFor(planRaw);
        const current = (tenant?.maxUsers as number) || 0;
        if (current > 0 && current < base) {
          const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
          if (!tenantId) return;
          const { syncSubscription } = await import('../api/billing');
          await syncSubscription(tenantId);
          await refreshUser();
        }
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planRaw, tenant?.maxUsers]);

  // Checkout başarı dönüşünde manuel Stripe senkronu tetikle
  useEffect(() => {
    const url = new URL(window.location.href);
    const success = url.searchParams.get('plan') === 'success' || url.searchParams.get('upgrade') === 'success';
    if (!success) return;
    (async () => {
      try {
        const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
        if (!tenantId) return;
        const { syncSubscription } = await import('../api/billing');
        await syncSubscription(tenantId);
        await refreshUser();
        const okMsg = t('billing.subscriptionUpdated');
        setPlanMessage(okMsg);
        setPaymentResult({ open: true, title: t('billing.payment.successTitle'), message: okMsg, tone: 'success' });
        // URL'yi temizle
        url.searchParams.delete('plan');
        url.searchParams.delete('upgrade');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Organizasyon üyelik istatistiklerini isteğe bağlı çek (yalnızca gösterim için)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const orgApi = await import('../api/organizations');
        const orgs = await orgApi.organizationsApi.getAll().catch(() => []);
        const org = Array.isArray(orgs) && orgs.length > 0 ? orgs[0] : null;
        if (!org) return;
        const stats = await orgApi.organizationsApi.getMembershipStats(org.id).catch(() => null);
        if (!cancelled && stats) {
          setSeatsInUse(stats.currentMembers ?? null);
        }
      } catch {}
    };
    run();
    return () => { cancelled = true; };
  }, [tenant?.id]);

  // Hızlı 1 koltuk azaltma (varsa)
  const removeOneSeat = async () => {
    try {
      setBusy(true); setPlanMessage('');
      const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
      if (!tenantId) throw new Error('Tenant bulunamadı');
      const base = baseIncludedFor(planRaw);
      const currentMax = (tenant?.maxUsers as number) || base;
      const currentAddon = Math.max(0, currentMax - base);
      if (currentAddon <= 0) {
        setPlanMessage(currentLanguage === 'tr' ? 'Azaltılabilecek ilave koltuk yok.' : 'No extra seats to remove.');
        return;
      }
      const nextAddon = currentAddon - 1;
      await billingUpdateSeats(tenantId, nextAddon);
      setPlanMessage(currentLanguage === 'tr' ? 'Koltuk azaltıldı.' : 'Seat removed.');
      await refreshUser();
    } catch (e:any) {
      setPlanMessage(e?.response?.data?.message || e?.message || 'Hata');
    } finally { setBusy(false); }
  };

  // Checkout iptal/basarisiz dönüşü
  useEffect(() => {
    const url = new URL(window.location.href);
    const cancelled = url.searchParams.get('plan') === 'cancel' || url.searchParams.get('upgrade') === 'cancel';
    if (!cancelled) return;
    const errMsg = t('billing.payment.cancelledMessage');
    setPaymentResult({ open: true, title: t('billing.payment.cancelledTitle'), message: errMsg, tone: 'error' });
    url.searchParams.delete('plan');
    url.searchParams.delete('upgrade');
    window.history.replaceState({}, document.title, url.pathname + url.search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add-on ödeme dönüşü: seats'i finalize et ve senkronize et
  useEffect(() => {
    const url = new URL(window.location.href);
    const addonSuccess = url.searchParams.get('addon') === 'success';
    if (!addonSuccess) return;
    (async () => {
      try {
        const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
        if (!tenantId) return;
        const stored = localStorage.getItem('pending_addon_new_total');
        if (stored) {
          const qty = parseInt(stored, 10);
          if (!isNaN(qty) && qty >= 0) {
            await billingUpdateSeats(tenantId, qty);
          }
        } else {
          const { syncSubscription } = await import('../api/billing');
          await syncSubscription(tenantId);
        }
        await refreshUser();
        const okMsg = t('billing.addonAdded');
        setPlanMessage(okMsg);
        setPaymentResult({ open: true, title: t('billing.payment.successTitle'), message: okMsg, tone: 'success' });
      } catch {}
      finally {
        localStorage.removeItem('pending_addon_new_total');
        url.searchParams.delete('addon');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Portal dönüşünde (manage billing sonrası) manuel sync tetikle
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromPortal = url.searchParams.get('portal') === 'return';
    if (!fromPortal) return;
    (async () => {
      try {
        const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
        if (!tenantId) return;
        const { syncSubscription } = await import('../api/billing');
        const res = await syncSubscription(tenantId);
        await refreshUser();
        if (typeof (res as any)?.cancelAtPeriodEnd === 'boolean') {
          const cancelDateStr = (() => {
            const s = (res as any)?.subscriptionExpiresAt;
            if (s) {
              try { return new Date(s).toLocaleDateString(); } catch { return renewalStr; }
            }
            return renewalStr;
          })();
          if ((res as any).cancelAtPeriodEnd) {
            setPlanMessage(t('billing.portal.cancelAtPeriodEnd', { date: cancelDateStr }));
          } else {
            setPlanMessage(t('billing.portal.activeApplied'));
          }
        } else {
          setPlanMessage(t('billing.portal.synced'));
        }
      } catch {}
      finally {
        localStorage.removeItem('pending_portal_sync');
        url.searchParams.delete('portal');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Portal dönüş anahtarı localStorage'da kalmışsa (parametre gelmese de) fokus/ilk yüklemede senkronize et
  useEffect(() => {
    const handler = async () => {
      try {
        const pending = localStorage.getItem('pending_portal_sync');
        if (!pending) return;
        const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
        if (!tenantId) return;
        const { syncSubscription } = await import('../api/billing');
        await syncSubscription(tenantId);
        await refreshUser();
        localStorage.removeItem('pending_portal_sync');
      } catch {}
    };
    handler();
    const onFocus = () => handler();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch mock history
  useEffect(() => {
    let mounted = true;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
        if (!tenantId) return;
        const { listHistory } = await import('../api/billing');
        const data = await listHistory(tenantId);
        const events = data?.events || [
          { type: 'plan.current', plan: tenant?.subscriptionPlan, at: tenant?.updatedAt, users: tenant?.maxUsers },
        ];
        if (mounted) setHistory(events);
      } catch {
        if (mounted) setHistory([]);
      } finally {
        if (mounted) setLoadingHistory(false);
      }
    };
    fetchHistory();
    return () => { mounted = false; };
  }, [tenant?.subscriptionPlan, tenant?.updatedAt]);

  // Faturaları çek
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoadingInvoices(true);
        const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
        if (!tenantId) return;
        const res = await import('../api/billing').then(m => m.listInvoices(tenantId));
        if (!cancelled) setInvoices(res?.invoices || []);
      } catch (e) {
        if (!cancelled) setInvoices([]);
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [tenant?.id, tenant?.subscriptionPlan]);

  const saveSubscription = async () => {
    setBusy(true); setPlanMessage('');
    try {
      const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
      if (!tenantId) throw new Error('Tenant bulunamadı');

      const desired = String(desiredPlan || '').toLowerCase();
      const currentlyPaid = ['professional', 'enterprise', 'pro', 'business'].includes(planRaw);
      const desiredPaid = ['professional', 'enterprise', 'pro', 'business'].includes(desired);
      const interval: 'month' | 'year' = desiredBilling === 'yearly' ? 'year' : 'month';
  // Seat güncellemesi UI'dan kaldırıldığı için (Hedef Kullanıcı Sayısı) burada kullanılmıyor

      // 1) Free/Basic hedefi: aktif abonelik varsa dönem sonunda iptal et
      if (!desiredPaid) {
        if (currentlyPaid) {
          await billingCancel(tenantId);
          setCancelAtPeriodEnd(true);
          setPlanMessage(currentLanguage === 'tr' ? 'İptal talebi alındı (dönem sonunda geçerli).' : 'Cancellation requested for period end.');
          await refreshUser();
        } else {
          setPlanMessage(currentLanguage === 'tr' ? 'Plan zaten ücretsiz.' : 'Already on free plan.');
        }
        return;
      }

      // 2) Plan/interval karşılaştırması: aynı plan mı? aynı interval mi?
      const normalizedCurrentPlan = ((): string => {
        if (planRaw === 'pro') return 'professional';
        if (planRaw === 'business') return 'enterprise';
        return planRaw;
      })();
      const samePlan = normalizedCurrentPlan === desired;
      const sameInterval = ((effectiveInterval || 'month') === interval);
      // Hedef kullanıcı alanı kaldırıldığı için plan değişiminde ek koltuk belirlenmez
      const seatAddon = 0;

      // 3) Eğer plan aynı ama interval değişiyorsa: yeni checkout yerine yerinde güncelle (proration uygula)
      if (samePlan && !sameInterval) {
        const idem = 'planupd:' + tenantId + ':' + desired + ':' + interval + ':' + seatAddon + ':' + new Date().toISOString().slice(0,10);
        const resp = await updatePlan(tenantId, { plan: desired as any, interval, seats: seatAddon, chargeNow: true, interactive: true, idempotencyKey: idem });
        if (resp?.success) {
          if (resp.invoiceError) {
            const dictIE = {
              tr: 'Plan güncellendi ancak fatura oluşturulamadı: ',
              en: 'Plan updated but invoice failed: ',
              fr: 'Le plan a été mis à jour mais la facture a échoué : ',
              de: 'Plan aktualisiert, aber Rechnung fehlgeschlagen: ',
            } as const;
            setPlanMessage((dictIE[currentLanguage] || dictIE.tr) + resp.invoiceError);
            await refreshUser();
            return;
          }
          if (resp.invoiceSkipped) {
            const dictIS = {
              tr: 'Plan dönemi güncellendi (ek ücret yok).',
              en: 'Billing interval updated (no additional charge).',
              fr: 'Période de facturation mise à jour (aucun frais supplémentaire).',
              de: 'Abrechnungszeitraum aktualisiert (keine Zusatzkosten).',
            } as const;
            setPlanMessage(dictIS[currentLanguage] || dictIS.tr);
            await refreshUser();
            return;
          }
          if (resp.hostedInvoiceUrl) {
            try {
              localStorage.setItem(
                'pending_billing_payment',
                JSON.stringify({
                  type: 'plan-interval',
                  plan: desired,
                  interval,
                  seats: seatAddon,
                  ts: Date.now(),
                })
              );
            } catch {}
            setPlanMessage(t('billing.redirecting'));
            window.location.href = resp.hostedInvoiceUrl;
            return;
          }
          setPlanMessage(t('billing.interval.updated'));
          await refreshUser();
          return;
        }
      }

      // 4) Plan değişimi: Checkout oluştur ve yönlendir
      const session = await createCheckoutSession({
        tenantId,
        plan: (desired as any),
        interval,
        seats: seatAddon,
        successUrl: window.location.origin + '/settings?plan=success',
        cancelUrl: window.location.origin + '/settings?plan=cancel',
      });
      if (session?.url) {
        window.location.href = session.url;
      } else {
        setPlanMessage(t('billing.checkout.failed'));
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Hata';
      setPlanMessage(msg);
    } finally { setBusy(false); }
  };

  const requestCancelAtPeriodEnd = async () => {
    if (!window.confirm(t('billing.cancelAtPeriodEnd.confirm'))) return;
    setBusy(true); setPlanMessage('');
    try {
      const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
      if (!tenantId) throw new Error('Tenant bulunamadı');
      const res = await billingCancel(tenantId);
      if (res?.success) {
        setCancelAtPeriodEnd(true);
        setPlanMessage(t('billing.cancel.requestedShort'));
        setTimeout(() => setPlanMessage(''), 3000);
        await refreshUser();
      }
    } catch (e:any) {
      setPlanMessage(e?.response?.data?.message || 'İptal hata');
    } finally { setBusy(false); }
  };

  const resumeCancellation = async () => {
    if (!window.confirm(t('billing.resumeCancellation.confirm'))) return;
    setBusy(true); setPlanMessage('');
    try {
      const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
      if (!tenantId) throw new Error('Tenant bulunamadı');
      const { resumeSubscription } = await import('../api/billing');
      const res = await resumeSubscription(tenantId);
      if (res?.success) {
        setCancelAtPeriodEnd(false);
        setPlanMessage(t('billing.resumeCancellation.done'));
        setTimeout(() => setPlanMessage(''), 3000);
        await refreshUser();
      }
    } catch (e:any) {
      setPlanMessage(e?.response?.data?.message || 'Yeniden başlatma hatası');
    } finally { setBusy(false); }
  };

  const renewalDate = tenant?.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt) : null;
  const renewalStr = renewalDate ? renewalDate.toLocaleDateString() : (currentLanguage === 'tr' ? '—' : '—');
  const renewalLabel = cancelAtPeriodEnd
    ? t('common:planTab.currentPlan.cancellationDate')
    : t('common:planTab.currentPlan.renewalDate');

  const canModifySeats = ['professional', 'pro', 'enterprise', 'business'].includes(planRaw);

  const openPlanConfirm = () => {
    try {
      const desired = String(desiredPlan || '').toLowerCase();
      const interval: 'month' | 'year' = desiredBilling === 'yearly' ? 'year' : 'month';
      const normalizedCurrentPlan = ((): string => {
        if (planRaw === 'pro') return 'professional';
        if (planRaw === 'business') return 'enterprise';
        return planRaw;
      })();
      const samePlan = normalizedCurrentPlan === desired;
      const sameInterval = ((effectiveInterval || 'month') === interval);

      const planName = (p: string) => {
        if (p === 'free') return t('common:planTab.plans.labels.free');
        if (p === 'professional') return t('common:planTab.plans.labels.professional');
        return t('common:planTab.plans.labels.enterprise');
      };
      const intervalName = (iv: 'month' | 'year') => (iv === 'year' ? t('common:planTab.yearly') : t('common:planTab.monthly'));

      let title = currentLanguage === 'tr' ? 'İşlemi Onaylayın' : currentLanguage === 'fr' ? 'Confirmez l’opération' : currentLanguage === 'de' ? 'Vorgang bestätigen' : 'Confirm Operation';
      let message = '';

      const currentlyPaid = ['professional', 'enterprise', 'pro', 'business'].includes(planRaw);
      const desiredPaid = ['professional', 'enterprise', 'pro', 'business'].includes(desired);

      if (!desiredPaid) {
        if (currentlyPaid) {
          message = currentLanguage === 'tr'
            ? 'Ücretli aboneliğiniz dönem sonunda iptal edilecek. Onaylıyor musunuz?'
            : currentLanguage === 'fr'
              ? "Votre abonnement payant sera annulé à la fin de la période. Confirmez-vous ?"
              : currentLanguage === 'de'
                ? 'Ihr kostenpflichtiges Abo wird zum Periodenende gekündigt. Bestätigen Sie?'
                : 'Your paid subscription will be cancelled at period end. Do you confirm?';
        } else {
          message = currentLanguage === 'tr' ? 'Plan zaten ücretsiz. Devam edilsin mi?' : 'Already on free plan. Continue?';
        }
      } else if (samePlan && sameInterval) {
        message = currentLanguage === 'tr'
          ? 'Plan ve dönem aynı görünüyor. Yine de devam edilsin mi?'
          : currentLanguage === 'fr'
            ? 'Le plan et la période semblent identiques. Continuer quand même ?'
            : currentLanguage === 'de'
              ? 'Plan und Zeitraum scheinen identisch. Trotzdem fortfahren?'
              : 'Plan and interval look the same. Proceed anyway?';
      } else if (samePlan && !sameInterval) {
        message = currentLanguage === 'tr'
          ? `Faturalama dönemi ${intervalName(effectiveInterval || 'month')} → ${intervalName(interval)} olarak değiştirilecek. Onaylıyor musunuz?`
          : currentLanguage === 'fr'
            ? `La période de facturation passera de ${intervalName(effectiveInterval || 'month')} à ${intervalName(interval)}. Confirmez-vous ?`
            : currentLanguage === 'de'
              ? `Der Abrechnungszeitraum wird von ${intervalName(effectiveInterval || 'month')} auf ${intervalName(interval)} geändert. Bestätigen?`
              : `Billing interval will change from ${intervalName(effectiveInterval || 'month')} to ${intervalName(interval)}. Do you confirm?`;
      } else {
        message = currentLanguage === 'tr'
          ? `Plan ${planName(normalizedCurrentPlan)} → ${planName(desired)}, dönem ${intervalName(interval)} olacak. Onaylıyor musunuz?`
          : currentLanguage === 'fr'
            ? `L’offre passera de ${planName(normalizedCurrentPlan)} à ${planName(desired)}, période ${intervalName(interval)}. Confirmez-vous ?`
            : currentLanguage === 'de'
              ? `Der Plan wechselt von ${planName(normalizedCurrentPlan)} zu ${planName(desired)}, Zeitraum ${intervalName(interval)}. Bestätigen?`
              : `Plan will change from ${planName(normalizedCurrentPlan)} to ${planName(desired)}, interval ${intervalName(interval)}. Do you confirm?`;
      }

      setPlanConfirm({ open: true, title, message });
    } catch {
      // fallback: no-op
      setPlanConfirm({ open: true, title: 'Confirm', message: 'Proceed with the change?' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{t('common:planTab.header.title')}</h3>
          <p className="text-sm text-gray-500 mt-1">{t('common:planTab.header.subtitle')}</p>
        </div>
        <div>
          <button
            onClick={async () => {
              try {
                setBusy(true);
                const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
                if (!tenantId) throw new Error('Tenant bulunamadı');
                const curr = new URL(window.location.href);
                curr.searchParams.set('portal', 'return');
                const { url } = await createPortalSession(tenantId, curr.toString());
                if (url) {
                  localStorage.setItem('pending_portal_sync', '1');
                  window.location.href = url;
                }
              } catch (e: any) {
                setPlanMessage(e?.response?.data?.message || e?.message || 'Portal hatası');
              } finally { setBusy(false); }
            }}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >{t('common:planTab.managePayments')}</button>
        </div>
      </div>

      {/* Üst Grid: Mevcut plan ve plan seçenekleri */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mevcut Plan */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600">{t('common:planTab.currentPlan.label')}</div>
          <div className="mt-1 text-lg font-semibold text-gray-900">{planText} {!isFree && periodText ? `• ${periodText}` : ''}</div>
          <div className="mt-2 text-sm text-gray-600">
            {(() => {
              const map: Record<SettingsLanguage, string> = {
                tr: 'Kullanımda kullanıcı',
                en: 'Users in use',
                fr: 'Utilisateurs en cours',
                de: 'Benutzte Nutzer',
              } as const;
              return (map[currentLanguage] || t('common:planTab.currentPlan.seatsInUse')) + ' ';
            })()}
            <span className="text-gray-900 font-medium">{typeof seatsInUse === 'number' ? seatsInUse : '—'}</span>
            {currentMaxUsers > 0 && (
              <span className="text-gray-500">{` / ${currentMaxUsers}`}</span>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-600">{renewalLabel}: <span className="text-gray-900">{renewalStr}</span></div>
          {cancelAtPeriodEnd && !isFree && (
            <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
              {t('common:planTab.currentPlan.cancelAtPeriodEndNotice')}
            </div>
          )}
        </div>

        {/* Plan Seçenekleri */}
        <div className="md:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">{t('common:planTab.changePlan')}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[{key:'professional', label:t('common:planTab.plans.labels.professional'), price:t('common:planTab.prices.monthly.pro'), bullets:[t('common:planTab.plans.bullets.proIncluded'), t('common:planTab.plans.bullets.basicAutomations')]},
              {key:'enterprise', label:t('common:planTab.plans.labels.enterprise'), price:t('common:planTab.prices.monthly.enterprise'), bullets:[t('common:planTab.plans.bullets.businessIncluded'), t('common:planTab.plans.bullets.advancedAutomations')]},
              {key:'free', label:t('common:planTab.plans.labels.free'), price:t('common:planTab.prices.monthly.free'), bullets:[t('common:planTab.plans.bullets.freeLimited')]}].map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setDesiredPlan(opt.key)}
                className={`text-left rounded-lg border p-3 hover:border-indigo-400 transition ${String(desiredPlan)===opt.key? 'border-indigo-500 ring-1 ring-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-900">{opt.label}</div>
                  <div className="text-sm text-indigo-600 font-medium">{opt.price}</div>
                </div>
                <ul className="mt-2 text-xs text-gray-600 space-y-1 list-disc list-inside">
                  {opt.bullets.map((b,i)=>(<li key={i}>{b}</li>))}
                </ul>
              </button>
            ))}
          </div>
          {/* Dönem seçimi ve Planı Güncelle butonu — üst alana taşındı */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-xs text-gray-600 mb-1">{t('common:planTab.billingCycle')}</div>
              <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDesiredBilling('monthly')}
                  className={`px-3 py-1.5 text-sm ${desiredBilling==='monthly' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}
                >{t('common:planTab.monthly')}</button>
                <button
                  type="button"
                  onClick={() => setDesiredBilling('yearly')}
                  className={`px-3 py-1.5 text-sm ${desiredBilling==='yearly' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}
                >{t('common:planTab.yearly')} <span className="ml-1 text-[10px] opacity-80">{t('common:planTab.yearlyNote')}</span></button>
              </div>
            </div>
            <div>
              <button
                onClick={openPlanConfirm}
                disabled={busy}
                className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
              >{t('common:planTab.updatePlan')}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Kullanıcı ekleme ve hızlı işlemler (tek kartta birleşik) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-semibold text-gray-900 mb-3">{currentLanguage === 'tr' ? 'Ek Kullanıcı' : currentLanguage === 'fr' ? 'Utilisateur supplémentaire' : currentLanguage === 'de' ? 'Zusätzlicher Benutzer' : 'Additional User'}</div>
        {/* 2 sütunlu düzen: Sol = ekleme + aksiyonlar, Sağ = azaltma + açıklama */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-md p-4 flex flex-col gap-3">
            {/* Başlık */}
            <div className="text-sm font-semibold text-gray-900 mb-2">
              {currentLanguage === 'tr' ? 'Ek Kullanıcı' : currentLanguage === 'fr' ? 'Utilisateur supplémentaire' : currentLanguage === 'de' ? 'Zusätzlicher Benutzer' : 'Additional User'}
            </div>
            {/* Ek Kullanıcı adedi */}
            <div>
              <div className="text-xs text-gray-600 mb-1">{currentLanguage === 'tr' ? 'Ek kullanıcı adedi' : currentLanguage === 'fr' ? 'Nombre d’utilisateurs' : currentLanguage === 'de' ? 'Anzahl zusätzlicher Benutzer' : 'Additional user count'}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setAdditionalUsersToAdd(v=>Math.max(1, (v||1)-1))} className="w-8 h-8 rounded-md border text-lg leading-none">−</button>
                <div className="w-16 text-center font-semibold">{additionalUsersToAdd}</div>
                <button onClick={() => setAdditionalUsersToAdd(v=> (v||1)+1)} className="w-8 h-8 rounded-md border text-lg leading-none">+</button>
                <div className="ml-3 text-xs text-gray-500">{currentLanguage === 'tr' ? 'Kullanıcı başına 5€/ay. Faturalandırma plan dönemine göre yapılır.' : currentLanguage === 'fr' ? '5€/mo par utilisateur. Facturation selon la période du plan.' : currentLanguage === 'de' ? '5€/Monat pro Benutzer. Abrechnung nach Planzeitraum.' : '€5/month per user. Billed per plan period.'}</div>
              </div>
            </div>
            {/* Hızlı aksiyonlar */}
            {canModifySeats && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setAddonConfirm({ open: true, mode: 'now', count: additionalUsersToAdd })}
                  disabled={busy || (additionalUsersToAdd||0) < 1}
                  className="w-full md:w-56 px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >{currentLanguage === 'tr' ? 'Hemen Tahsil Et' : currentLanguage === 'fr' ? 'Encaisser maintenant' : currentLanguage === 'de' ? 'Sofort belasten' : 'Charge now'}</button>
                <button
                  onClick={() => setAddonConfirm({ open: true, mode: 'later', count: additionalUsersToAdd })}
                  disabled={busy || (additionalUsersToAdd||0) < 1}
                  className="w-full md:w-56 px-3 py-2 text-sm rounded-md bg-indigo-100 text-indigo-800 hover:bg-indigo-200 disabled:opacity-50"
                >{currentLanguage === 'tr' ? 'Dönem Sonunda Faturalandır' : currentLanguage === 'fr' ? 'Facturer en fin de période' : currentLanguage === 'de' ? 'Am Periodenende abrechnen' : 'Invoice at period end'}</button>
              </div>
            )}
          </div>

          {/* Sağ sütun: Azaltma kutusu */}
          {canModifySeats && (
            <div className="bg-white border border-gray-200 rounded-md p-4 flex flex-col gap-2">
              {/* Başlık */}
              <div className="text-sm font-semibold text-gray-900 mb-2">
                {currentLanguage === 'tr'
                  ? 'Kullanıcı Azaltma'
                  : currentLanguage === 'fr'
                  ? 'Réduction des utilisateurs'
                  : currentLanguage === 'de'
                  ? 'Benutzerreduzierung'
                  : 'User reduction'}
              </div>
              {/* Açıklama */}
              <div className="text-xs text-gray-500 max-w-md">
                {currentLanguage === 'tr'
                  ? 'Plana dahil kullanıcılar azaltılamaz; yalnızca ekstra alınan kullanıcılar azaltılabilir.'
                  : currentLanguage === 'fr'
                  ? "Les utilisateurs inclus dans le plan ne peuvent pas être réduits; seuls les utilisateurs supplémentaires peuvent être réduits."
                  : currentLanguage === 'de'
                  ? 'Im Plan enthaltene Benutzer können nicht reduziert werden; nur zusätzlich erworbene Benutzer können reduziert werden.'
                  : 'Users included in the plan cannot be reduced; only additional purchased users can be reduced.'}
              </div>
              {/* Buton en altta */}
              <div className="flex items-start md:justify-start">
                <button
                  onClick={removeOneSeat}
                  disabled={busy}
                  className="w-full md:w-56 px-3 py-2 text-sm rounded-md bg-rose-100 text-rose-800 hover:bg-rose-200 disabled:opacity-50"
                >{currentLanguage === 'tr' ? '1 kullanıcı azalt' : currentLanguage === 'fr' ? 'Réduire de 1 utilisateur' : currentLanguage === 'de' ? '1 Benutzer reduzieren' : 'Reduce 1 user'}</button>
              </div>
            </div>
          )}
        </div>
        {planMessage && <div className="mt-3 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-2 rounded">{planMessage}</div>}
        <div className="mt-2 text-[11px] text-gray-500">{t('common:planTab.amountsNote')}</div>
      </div>
      {/* Plan değişimi onay modali */}
      <InfoModal
        isOpen={planConfirm.open}
        onClose={() => setPlanConfirm(p => ({ ...p, open: false }))}
        title={planConfirm.title || (currentLanguage === 'tr' ? 'Onay' : 'Confirm')}
        message={planConfirm.message || ''}
        confirmLabel={currentLanguage === 'tr' ? 'Onayla' : currentLanguage === 'fr' ? 'Confirmer' : currentLanguage === 'de' ? 'Bestätigen' : 'Confirm'}
        cancelLabel={currentLanguage === 'tr' ? 'Vazgeç' : currentLanguage === 'fr' ? 'Annuler' : currentLanguage === 'de' ? 'Abbrechen' : 'Cancel'}
        onConfirm={() => {
          setPlanConfirm(p => ({ ...p, open: false }));
          saveSubscription();
        }}
        onCancel={() => setPlanConfirm(p => ({ ...p, open: false }))}
        tone="info"
      />
      {/* Add-on onay modali */}
      <InfoModal
        isOpen={addonConfirm.open}
        onClose={() => setAddonConfirm(p => ({ ...p, open: false }))}
        title={addonConfirm.mode === 'now'
          ? (currentLanguage === 'tr' ? 'Hemen Tahsil Onayı' : currentLanguage === 'fr' ? "Confirmation d'encaissement" : currentLanguage === 'de' ? 'Sofortige Abbuchung Bestätigen' : 'Immediate Charge Confirmation')
          : (currentLanguage === 'tr' ? 'Faturalandırma Onayı' : currentLanguage === 'fr' ? 'Confirmation de facturation' : currentLanguage === 'de' ? 'Rechnungsstellung Bestätigen' : 'Invoice Confirmation')}
        message={((): string => {
          const count = addonConfirm.count;
          const unitPrice = 5; // €5 per additional user per month
          const total = (count * unitPrice).toFixed(2);
          if (addonConfirm.mode === 'now') {
            return currentLanguage === 'tr'
              ? `${count} ilave kullanıcı için hemen ${total} € tahsil edilecek. Onaylıyor musunuz?`
              : currentLanguage === 'fr'
              ? `Encaisser maintenant ${total} € pour ${count} utilisateur(s) supplémentaire(s). Confirmez-vous ?`
              : currentLanguage === 'de'
              ? `${count} zusätzliche(r) Benutzer wird/werden jetzt mit ${total} € belastet. Bestätigen?`
              : `Charge ${total} € now for ${count} additional user(s). Do you confirm?`;
          }
          return currentLanguage === 'tr'
            ? `${count} ilave kullanıcı eklenecek ve dönem sonunda faturalandırılacak. Onaylıyor musunuz?`
            : currentLanguage === 'fr'
            ? `${count} utilisateur(s) supplémentaire(s) sera/seront ajouté(s) et facturé(s) à la fin de la période. Confirmez-vous ?`
            : currentLanguage === 'de'
            ? `${count} zusätzliche(r) Benutzer wird/werden hinzugefügt und am Periodenende abgerechnet. Bestätigen?`
            : `${count} additional user(s) will be added and invoiced at period end. Do you confirm?`;
        })()}
        confirmLabel={currentLanguage === 'tr' ? 'Onayla' : currentLanguage === 'fr' ? 'Confirmer' : currentLanguage === 'de' ? 'Bestätigen' : 'Confirm'}
        cancelLabel={currentLanguage === 'tr' ? 'Vazgeç' : currentLanguage === 'fr' ? 'Annuler' : currentLanguage === 'de' ? 'Abbrechen' : 'Cancel'}
        onConfirm={() => {
          const mode = addonConfirm.mode;
          setAddonConfirm(p => ({ ...p, open: false }));
          if (mode === 'now') {
            (async () => {
              try {
                setBusy(true);
                const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
                if (!tenantId) throw new Error('Tenant bulunamadı');
                if (additionalUsersToAdd <= 0) throw new Error('Ek kullanıcı >= 1 olmalı');
                const { chargeAddonNow, listInvoices } = await import('../api/billing');
                const toAdd = additionalUsersToAdd;
                const resp = await chargeAddonNow(tenantId, toAdd);
                if (resp?.success) {
                  const cur = String(resp?.currency || '').toUpperCase();
                  const minor = (typeof resp.amountPaid === 'number' && resp.amountPaid > 0)
                    ? resp.amountPaid
                    : (typeof (resp as any).amountDue === 'number' && (resp as any).amountDue > 0)
                      ? (resp as any).amountDue
                      : (typeof (resp as any).total === 'number' ? (resp as any).total : 0);
                  const amt = minor > 0 ? (minor/100).toFixed(2) + ' ' + cur : '';
                  setPlanMessage((currentLanguage === 'tr' ? 'İlave kullanıcılar tahsil edildi.' : 'Additional users charged.') + (amt ? ` (${amt})` : ''));
                  setAdditionalUsersToAdd(1);
                  await refreshUser();
                  try { const res = await listInvoices(tenantId); setInvoices(res?.invoices || []); } catch {}
                  try { window.dispatchEvent(new CustomEvent('billingSuccess', { detail: { type: 'addon', seats: toAdd, ts: Date.now() } })); } catch {}
                } else {
                  setPlanMessage(currentLanguage === 'tr' ? 'İşlem başarısız.' : 'Operation failed.');
                }
              } catch (e:any) {
                setPlanMessage(e?.response?.data?.message || e?.message || 'Hata');
              } finally { setBusy(false); }
            })();
          } else {
            (async () => {
              try {
                setBusy(true);
                const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
                if (!tenantId) throw new Error('Tenant bulunamadı');
                if (additionalUsersToAdd <= 0) throw new Error('Ek kullanıcı >= 1 olmalı');
                const toAdd = additionalUsersToAdd;
                const resp = await createAddonCheckout(tenantId, toAdd, '', '');
                if (resp?.success) {
                  const prorationMsg = ((): string => {
                    const cur = String(resp?.upcomingCurrency || '').toUpperCase();
                    if (typeof resp?.upcomingProrationTotal === 'number') {
                      return currentLanguage === 'tr'
                        ? ` (Bu dönem için ek proration: ${(resp.upcomingProrationTotal/100).toFixed(2)} ${cur} — bir sonraki faturaya eklenecek)`
                        : ` (Proration for this period: ${(resp.upcomingProrationTotal/100).toFixed(2)} ${cur} — will be added to the next invoice)`;
                    }
                    return '';
                  })();
                  setPlanMessage((currentLanguage === 'tr' ? 'İlave kullanıcılar eklendi.' : 'Additional users added.') + prorationMsg);
                  setAdditionalUsersToAdd(1);
                  await refreshUser();
                  try { window.dispatchEvent(new CustomEvent('billingSuccess', { detail: { type: 'addon', seats: toAdd, ts: Date.now() } })); } catch {}
                } else {
                  setPlanMessage(currentLanguage === 'tr' ? 'İşlem başarısız.' : 'Operation failed.');
                }
              } catch (e:any) {
                setPlanMessage(e?.response?.data?.message || e?.message || 'Hata');
              } finally { setBusy(false); }
            })();
          }
        }}
        onCancel={() => setAddonConfirm(p => ({ ...p, open: false }))}
        tone="info"
      />

      {/* İptal Seçenekleri */}
      {!isFree && (
        <div className="border border-red-300 rounded-lg p-4 bg-red-50 space-y-3">
          <h4 className="text-md font-semibold mb-2">{t('common:planTab.subscriptionStatus')}</h4>
          <p className="text-xs text-red-700">{t('common:planTab.subscriptionCancelNote')}</p>
          {!cancelAtPeriodEnd ? (
            <button
              onClick={requestCancelAtPeriodEnd}
              disabled={busy}
              className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >{t('common:planTab.cancelAtPeriodEndBtn')}</button>
          ) : (
            <button
              onClick={resumeCancellation}
              disabled={busy}
              className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >{t('common:planTab.resumeSubscriptionBtn')}</button>
          )}
        </div>
      )}

      {/* Ödeme sonucu modali */}
      <InfoModal
        isOpen={paymentResult.open}
        onClose={() => setPaymentResult(p => ({ ...p, open: false }))}
        title={paymentResult.title}
        message={paymentResult.message}
        confirmLabel={currentLanguage === 'tr' ? 'Tamam' : currentLanguage === 'fr' ? 'OK' : currentLanguage === 'de' ? 'OK' : 'OK'}
        tone={paymentResult.tone}
      />

      {/* Geçmiş / History */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h4 className="text-md font-semibold mb-3">{t('common:planTab.history.title')}</h4>
        {loadingHistory && <p className="text-xs text-gray-500">{t('common:planTab.history.loading')}</p>}
        {!loadingHistory && history.length === 0 && (
          <p className="text-xs text-gray-500">{t('common:planTab.history.empty')}</p>
        )}
        {!loadingHistory && history.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-1 pr-4">{t('common:planTab.history.type')}</th>
                  <th className="py-1 pr-4">{t('common:planTab.history.plan')}</th>
                  <th className="py-1 pr-4">{t('common:planTab.history.users')}</th>
                  <th className="py-1 pr-4">{t('common:planTab.history.date')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((ev, idx) => {
                  const at = ev.at ? new Date(ev.at).toLocaleDateString() : '—';
                  const typeLabel = (() => {
                    const map: Record<string, Record<string, string>> = {
                      tr: {
                        'plan.current': 'Mevcut Plan',
                        'plan.renewal_due': 'Yenileme Tarihi',
                        'cancel.at_period_end': 'Dönem Sonunda İptal',
                        'invoice.paid': 'Ödeme Alındı',
                        'invoice.open': 'Açık Fatura',
                        'invoice.uncollectible': 'Tahsil Edilemeyen',
                        'invoice.payment_failed': 'Ödeme Başarısız',
                      },
                      en: {
                        'plan.current': 'Current Plan',
                        'plan.renewal_due': 'Renewal Due',
                        'cancel.at_period_end': 'Cancel at Period End',
                        'invoice.paid': 'Payment Received',
                        'invoice.open': 'Open Invoice',
                        'invoice.uncollectible': 'Uncollectible',
                        'invoice.payment_failed': 'Payment Failed',
                      },
                      fr: {
                        'plan.current': 'Offre actuelle',
                        'plan.renewal_due': 'Renouvellement',
                        'cancel.at_period_end': 'Annulation fin de période',
                        'invoice.paid': 'Paiement reçu',
                        'invoice.open': 'Facture ouverte',
                        'invoice.uncollectible': 'Irrécouvrable',
                        'invoice.payment_failed': 'Paiement échoué',
                      },
                      de: {
                        'plan.current': 'Aktueller Plan',
                        'plan.renewal_due': 'Verlängerung',
                        'cancel.at_period_end': 'Kündigung zum Periodenende',
                        'invoice.paid': 'Zahlung erhalten',
                        'invoice.open': 'Offene Rechnung',
                        'invoice.uncollectible': 'Uneinbringlich',
                        'invoice.payment_failed': 'Zahlung fehlgeschlagen',
                      },
                    };
                    return (map[currentLanguage] && map[currentLanguage][ev.type]) || ev.type;
                  })();
                  return (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="py-1 pr-4">{typeLabel}</td>
                      <td className="py-1 pr-4">{ev.plan || '—'}</td>
                      <td className="py-1 pr-4">{ev.users || '—'}</td>
                      <td className="py-1 pr-4">{at}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[10px] text-gray-400">{t('common:planTab.history.footerNote')}</p>
      </div>

      {/* Stripe Faturaları */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h4 className="text-md font-semibold mb-3">{t('common:planTab.invoices.title')}</h4>
        {loadingInvoices && <p className="text-xs text-gray-500">{t('common:planTab.invoices.loading')}</p>}
        {!loadingInvoices && invoices.length === 0 && (
          <p className="text-xs text-gray-500">{t('common:planTab.invoices.empty')}</p>
        )}
        {!loadingInvoices && invoices.length > 0 && (
          <div className="overflow-x-auto">
            {/* Filtreler */}
            <div className="mb-3 flex flex-wrap gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-[10px] font-medium text-gray-600">{t('common:planTab.invoices.filters.status')}</label>
                <select
                  value={invoiceStatusFilter}
                  onChange={e => setInvoiceStatusFilter(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded-md text-xs"
                >
                  <option value="all">{t('common:planTab.invoices.filters.all')}</option>
                  <option value="paid">Paid</option>
                  <option value="open">Open/Draft</option>
                  <option value="unpaid">Unpaid/Void/Uncollectible</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-medium text-gray-600">{t('common:planTab.invoices.filters.search')}</label>
                <input
                  type="text"
                  value={invoiceSearch}
                  onChange={e => setInvoiceSearch(e.target.value)}
                  placeholder={t('common:planTab.invoices.filters.searchPlaceholder')}
                  className="px-2 py-1 border border-gray-300 rounded-md text-xs"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-medium text-gray-600">{t('common:planTab.invoices.filters.from')}</label>
                <input
                  type="date"
                  value={invoiceDateFrom}
                  onChange={e => setInvoiceDateFrom(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded-md text-xs"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-medium text-gray-600">{t('common:planTab.invoices.filters.to')}</label>
                <input
                  type="date"
                  value={invoiceDateTo}
                  onChange={e => setInvoiceDateTo(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded-md text-xs"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-medium text-gray-600">&nbsp;</label>
                <button
                  onClick={() => {
                    // CSV export
                    const rows = getFilteredInvoices().map((inv: any) => ({
                      id: inv.id,
                      number: inv.number,
                      status: inv.status,
                      currency: inv.currency,
                      total: typeof inv.total === 'number' ? (inv.total / 100).toFixed(2) : '',
                      created: inv.created,
                      hostedInvoiceUrl: inv.hostedInvoiceUrl,
                      pdf: inv.pdf,
                    }));
                    const header = Object.keys(rows[0] || {
                      id: '', number: '', status: '', currency: '', total: '', created: '', hostedInvoiceUrl: '', pdf: ''
                    });
                    const csv = [header.join(','), ...rows.map((r: any) => header.map(h => String((r as any)[h] ?? '')).join(','))].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `invoices_${new Date().toISOString().slice(0,10)}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  disabled={invoices.length === 0}
                  className="px-3 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >{t('common:planTab.invoices.filters.exportCsv')}</button>
              </div>
            </div>
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-1 pr-4">{t('common:planTab.invoices.table.number')}</th>
                  <th className="py-1 pr-4">{t('common:planTab.invoices.table.date')}</th>
                  <th className="py-1 pr-4">{t('common:planTab.invoices.table.amount')}</th>
                  <th className="py-1 pr-4">{t('common:planTab.invoices.table.status')}</th>
                  <th className="py-1 pr-4">{t('common:planTab.invoices.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredInvoices().map((inv: any) => {
                  const dateStr = inv.created ? new Date(inv.created).toLocaleDateString() : '—';
                  const amount = typeof inv.total === 'number' ? (inv.total / 100).toFixed(2) + ' ' + String(inv.currency || '').toUpperCase() : '—';
                  return (
                    <tr key={inv.id} className="border-t border-gray-100">
                      <td className="py-1 pr-4">{inv.number || inv.id}</td>
                      <td className="py-1 pr-4">{dateStr}</td>
                      <td className="py-1 pr-4">{amount}</td>
                      <td className="py-1 pr-4">
                        <span className={(() => {
                          const s = String(inv.status || '').toLowerCase();
                          if (s === 'paid') return 'inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200';
                          if (s === 'open' || s === 'draft') return 'inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200';
                          if (s === 'uncollectible' || s === 'void' || s === 'unpaid') return 'inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200';
                          return 'inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200';
                        })()}>
                          {String(inv.status || '—').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-1 pr-4 space-x-2">
                        {inv.hostedInvoiceUrl && (
                          <a className="text-indigo-600 hover:underline" href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer">{t('common:view')}</a>
                        )}
                        {inv.pdf && (
                          <a className="text-indigo-600 hover:underline" href={inv.pdf} target="_blank" rel="noreferrer">PDF</a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[10px] text-gray-400">{t('common:planTab.invoices.footerNote')}</p>
      </div>
    </div>
  );
};

// Yalnızca ekranda önizleme için (CompanyProfile + logoFile)
// Ülke seçimi öncesi boş değer için country alanını genişletiyoruz
type LocalCompanyState = Omit<CompanyProfile, 'country'> & {
  country?: CompanyProfile['country'] | '';
  logoFile?: File | null;
};

const SUPPORTED_LANGUAGES = ['tr', 'en', 'fr', 'de'] as const;
type SettingsLanguage = typeof SUPPORTED_LANGUAGES[number];

// Bildirim tipi anahtarları sadece istenen kategorilerle sınırlandı
type NotificationKey =
  | 'invoiceReminders'      // Fatura vade yaklaşan / gecikmiş
  | 'expenseAlerts'         // Gider vade yaklaşan / gecikmiş
  | 'salesNotifications'    // Yeni satış, kritik satış uyarıları
  | 'lowStockAlerts'        // Düşük / tükenmiş stok
  | 'quoteReminders';       // Teklif süresi dolmak üzere / doldu

type SettingsTranslations = {
  header: {
    title: string;
    subtitle: string;
    unsavedChanges: string;
    save: string;
  };
  modals: {
    saveSuccess: { title: string; message: string; confirm: string };
    saveError: { title: string; message: string; confirm: string };
    fileTypeError: { title: string; message: string; confirm: string };
    fileSizeError: { title: string; message: string; confirm: string };
    authRequired: { title: string; message: string; confirm: string };
    sessionExpired: { title: string; message: string; confirm: string };
    deleteRequested: { title: string; message: string; confirm: string };
    deleteFailed: { title: string; message: string; confirm: string };
  };
  tabs: {
    profile: string;
    company: string;
    plan?: string;
    notifications: string;
    organization?: string;
    fiscalPeriods?: string;
    system: string;
    security: string;
    privacy: string;
  };
  profile: {
    title: string;
    fields: {
      name: string;
      email: string;
      phone: string;
    };
    passwordTitle: string;
    passwordFields: {
      current: string;
      new: string;
      confirm: string;
    };
  };
  company: {
    title: string;
    logo: {
      label: string;
      upload: string;
      remove: string;
      helper: string;
      uploaded: (params: { name: string; sizeKB: string }) => string;
    };
    fields: {
      name: string;
      address: string;
      taxNumber: string;
      taxOffice: string;
      phone: string;
      email: string;
      website: string;
    };
    legalFields: {
      title: string;
      subtitle: string;
      countryHelp?: string;
      countrySelectLabel?: string;
      countryOptions?: { TR: string; US: string; DE: string; FR: string; OTHER: string };
      turkey: {
        title: string;
        mersisNumber: string;
        kepAddress: string;
      };
      france: {
        title: string;
        siretNumber: string;
        sirenNumber: string;
        apeCode: string;
        tvaNumber: string;
        rcsNumber: string;
      };
      germany: {
        title: string;
        steuernummer: string;
        umsatzsteuerID: string;
        handelsregisternummer: string;
        geschaeftsfuehrer: string;
      };
      usa: {
        title: string;
        einNumber: string;
        taxId: string;
        businessLicenseNumber: string;
        stateOfIncorporation: string;
      };
      other: {
        title: string;
        registrationNumber: string;
        vatNumber: string;
        taxId: string;
        stateOrRegion: string;
      };
    };
    iban: {
      sectionTitle: string;
      bankOption: string;
      noBanks: string;
      bankSelectPlaceholder: string;
      manualOption: string;
      ibanPlaceholder: string;
      bankNamePlaceholder: string;
      preview: (value: string) => string;
      previewExample: string;
    };
  };
  notifications: {
    title: string;
    labels: Record<NotificationKey, string>;
  };
  system: {
    title: string;
    currencyLabel: string;
    dateFormatLabel: string;
    timezoneLabel: string;
    currencies: Record<'TRY' | 'USD' | 'EUR', string>;
    timezones: Record<'Europe/Istanbul' | 'UTC' | 'America/New_York', string>;
    backup: {
      title: string;
      toggleLabel: string;
      toggleDescription: string;
      frequencyLabel: string;
      options: Record<'daily' | 'weekly' | 'monthly', string>;
    };
  };
  security: {
    tipsTitle: string;
    tips: string[];
    title: string;
    cards: {
      twoFactor: { title: string; description: string; action: string };
      sessionHistory: { title: string; description: string; action: string };
      activeSessions: { title: string; description: string; action: string };
    };
  };
  privacy: {
    title: string;
    gdpr: {
      title: string;
      description: string;
      export: {
        title: string;
        description: string;
        button: string;
        disclaimer: string;
      };
      delete: {
        title: string;
        description: string;
        button: string;
        warning: string;
        confirmDialog: {
          title: string;
          message: string;
          retention: string;
          confirm: string;
          cancel: string;
        };
      };
    };
  };

};

// Basit daraltılabilir bölüm (Accordion benzeri)
const Section: React.FC<{
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, defaultOpen = true, children }) => {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {open ? (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

const settingsTranslations: Record<SettingsLanguage, SettingsTranslations> = {
  tr: {
    header: {
      title: 'Ayarlar',
      subtitle: 'Sistem ve hesap ayarlarınızı yönetin',
      unsavedChanges: 'Kaydedilmemiş değişiklikler var',
      save: 'Kaydet',
    },
    modals: {
      saveSuccess: {
        title: 'Kaydedildi',
        message: 'Değişiklikleriniz başarıyla kaydedildi.',
        confirm: 'Tamam',
      },
      saveError: {
        title: 'Hata',
        message: 'Ayarlar kaydedilirken bir hata oluştu.',
        confirm: 'Kapat',
      },
      fileTypeError: { title: 'Dosya tipi hatalı', message: 'Lütfen sadece resim dosyası seçin.', confirm: 'Tamam' },
      fileSizeError: { title: 'Dosya boyutu çok büyük', message: 'Dosya boyutu 5MB\'dan küçük olmalıdır.', confirm: 'Tamam' },
      authRequired: { title: 'Oturum gerekli', message: 'Lütfen önce giriş yapın.', confirm: 'Tamam' },
      sessionExpired: { title: 'Oturum süresi doldu', message: 'Lütfen tekrar giriş yapın.', confirm: 'Tamam' },
      deleteRequested: { title: 'Talep alındı', message: 'Hesap silme talebiniz başarıyla iletildi.', confirm: 'Tamam' },
      deleteFailed: { title: 'İşlem başarısız', message: 'Hesap silme isteği gönderilemedi. Lütfen tekrar deneyin.', confirm: 'Kapat' },
    },
    tabs: {
      profile: 'Profil',
      company: 'Şirket',
      plan: 'Hesap Planı',
      notifications: 'Bildirimler',
      organization: 'Organizasyon',
      fiscalPeriods: 'Mali Dönemler',
      system: 'Sistem',
      security: 'Güvenlik',
      privacy: 'Gizlilik',
    },
    profile: {
      title: 'Profil Bilgileri',
      fields: {
        name: 'Ad Soyad',
        email: 'E-posta',
        phone: 'Telefon',
      },
      passwordTitle: 'Şifre Değiştir',
      passwordFields: {
        current: 'Mevcut Şifre',
        new: 'Yeni Şifre',
        confirm: 'Şifre Tekrar',
      },
    },
    company: {
      title: 'Şirket Bilgileri',
      logo: {
        label: 'Şirket Logosu',
        upload: 'Logo Yükle',
        remove: 'Kaldır',
        helper: 'PNG, JPG veya GIF formatında, maksimum 5MB boyutunda dosya yükleyebilirsiniz.',
        uploaded: ({ name, sizeKB }) => `Logo ${name} (${sizeKB} KB)`,
      },
      fields: {
        name: 'Şirket Adı',
        address: 'Adres',
        taxNumber: 'Vergi Numarası',
        taxOffice: 'Vergi Dairesi',
        phone: 'Telefon',
        email: 'E-posta',
        website: 'Website',
      },
      legalFields: {
        title: 'Yasal Gereklilik Alanları',
        subtitle: 'Uluslararası faturalama standartları için gerekli bilgiler',
        countryHelp: 'Şirket bilgilerini girebilmek için lütfen şirket ülkesini seçin.',
        countrySelectLabel: 'Ülke',
        countryOptions: { TR: 'Türkiye', US: 'Amerika', DE: 'Almanya', FR: 'Fransa', OTHER: 'Diğer' },
        turkey: {
          title: 'Türkiye',
          mersisNumber: 'Mersis Numarası',
          kepAddress: 'KEP Adresi',
        },
        france: {
          title: 'Fransa',
          siretNumber: 'SIRET Numarası',
          sirenNumber: 'SIREN Numarası',
          apeCode: 'APE/NAF Kodu',
          tvaNumber: 'TVA Numarası',
          rcsNumber: 'RCS Numarası',
        },
        germany: {
          title: 'Almanya',
          steuernummer: 'Steuernummer',
          umsatzsteuerID: 'Umsatzsteuer-ID',
          handelsregisternummer: 'Handelsregisternummer',
          geschaeftsfuehrer: 'Geschäftsführer',
        },
        usa: {
          title: 'Amerika',
          einNumber: 'EIN Numarası',
          taxId: 'Tax ID',
          businessLicenseNumber: 'Business License No',
          stateOfIncorporation: 'Kuruluş Eyaleti',
        },
        other: {
          title: 'Diğer Ülkeler',
          registrationNumber: 'Kayıt No',
          vatNumber: 'KDV/VAT No',
          taxId: 'Vergi Kimliği',
          stateOrRegion: 'Eyalet/Bölge',
        },
      },
      iban: {
        sectionTitle: 'Faturalarda Kullanılacak IBAN',
        bankOption: 'Kaydedilmiş bankalardan seç',
        noBanks: '(Kaydedilmiş banka yok)',
        bankSelectPlaceholder: 'Banka seçin',
        manualOption: 'Elle IBAN gir',
        ibanPlaceholder: 'TR00 0000 0000 0000 0000 0000 00',
        bankNamePlaceholder: 'Banka adı (ör. Ziraat Bankası)',
        preview: value => `Önizleme: ${value}`,
        previewExample: 'Örn: TRxx xxxx xxxx xxxx xxxx xxxx xx',
      },
    },
    notifications: {
      title: 'Bildirim Tercihleri',
      labels: {
        invoiceReminders: 'Fatura Hatırlatmaları',
        expenseAlerts: 'Gider Uyarıları',
        salesNotifications: 'Satış Bildirimleri',
        lowStockAlerts: 'Düşük Stok Uyarıları',
        quoteReminders: 'Teklif Hatırlatmaları',
      },
    },
    system: {
      title: 'Sistem Ayarları',
      currencyLabel: 'Para Birimi',
      dateFormatLabel: 'Tarih Formatı',
      timezoneLabel: 'Saat Dilimi',
      currencies: {
        TRY: '₺ Türk Lirası',
        USD: '$ ABD Doları',
        EUR: '€ Euro',
      },
      timezones: {
        'Europe/Istanbul': 'İstanbul',
        UTC: 'UTC',
        'America/New_York': 'New York',
      },
      backup: {
        title: 'Yedekleme',
        toggleLabel: 'Otomatik Yedekleme',
        toggleDescription: 'Verilerinizi otomatik olarak yedekleyin',
        frequencyLabel: 'Yedekleme Sıklığı',
        options: {
          daily: 'Günlük',
          weekly: 'Haftalık',
          monthly: 'Aylık',
        },
      },
    },
    security: {
      tipsTitle: 'Güvenlik Önerileri',
      tips: [
        '• Güçlü bir şifre kullanın (en az 8 karakter, büyük/küçük harf, sayı)',
        '• Şifrenizi düzenli olarak değiştirin',
        '• İki faktörlü kimlik doğrulamayı etkinleştirin',
        '• Şüpheli aktiviteleri takip edin',
      ],
      title: 'Güvenlik Ayarları',
      cards: {
        twoFactor: {
          title: 'İki Faktörlü Kimlik Doğrulama',
          description: 'Hesabınız için ek güvenlik katmanı',
          action: 'Etkinleştir',
        },
        sessionHistory: {
          title: 'Oturum Geçmişi',
          description: 'Son giriş aktivitelerinizi görüntüleyin',
          action: 'Görüntüle',
        },
        activeSessions: {
          title: 'Aktif Oturumlar',
          description: 'Diğer cihazlardaki oturumları yönetin',
          action: 'Tümünü Sonlandır',
        },
      },
    },

    privacy: {
      title: 'GDPR ve Veri Hakları',
      gdpr: {
        title: 'Kişisel Veri Yönetimi',
        description: 'GDPR uyumluluk kapsamında kişisel verilerinizi yönetin',
        export: {
          title: 'Verilerimi İndir',
          description: 'Tüm kişisel verilerinizi ZIP formatında indirin',
          button: 'Verilerimi İndir',
          disclaimer: 'İndirilen dosya JSON ve CSV formatlarında verilerinizi içerir.',
        },
        delete: {
          title: 'Hesabımı Sil',
          description: 'Hesabınızı ve tüm kişisel verilerinizi kalıcı olarak silin',
          button: 'Hesap Silme Talebi',
          warning: 'Bu işlem geri alınamaz ve tüm verileriniz silinir.',
          confirmDialog: {
            title: 'Hesap Silme Onayı',
            message: 'Hesabınızı silmek istediğinizden emin misiniz?',
            retention: 'Not: Muhasebe kayıtları yasal gereklilikler nedeniyle 10 yıl süreyle saklanacaktır.',
            confirm: 'Evet, Hesabımı Sil',
            cancel: 'İptal',
          },
        },
      },
    },

  },
  en: {
    header: {
      title: 'Settings',
      subtitle: 'Manage your system and account settings',
      unsavedChanges: 'There are unsaved changes',
      save: 'Save',
    },
    modals: {
      saveSuccess: {
        title: 'Saved',
        message: 'Your changes have been saved successfully.',
        confirm: 'OK',
      },
      saveError: {
        title: 'Error',
        message: 'An error occurred while saving your settings.',
        confirm: 'Close',
      },
      fileTypeError: { title: 'Invalid file type', message: 'Please select an image file only.', confirm: 'OK' },
      fileSizeError: { title: 'File too large', message: 'The file size must be less than 5MB.', confirm: 'OK' },
      authRequired: { title: 'Authentication required', message: 'Please sign in first.', confirm: 'OK' },
      sessionExpired: { title: 'Session expired', message: 'Please sign in again.', confirm: 'OK' },
      deleteRequested: { title: 'Request received', message: 'Your account deletion request has been submitted.', confirm: 'OK' },
      deleteFailed: { title: 'Request failed', message: 'Could not submit account deletion. Please try again.', confirm: 'Close' },
    },
    tabs: {
      profile: 'Profile',
      company: 'Company',
      plan: 'Plan',
      notifications: 'Notifications',
      organization: 'Organization',
      fiscalPeriods: 'Fiscal Periods',
      system: 'System',
      security: 'Security',
      privacy: 'Privacy',
    },
    profile: {
      title: 'Profile Information',
      fields: {
        name: 'Full Name',
        email: 'Email Address',
        phone: 'Phone',
      },
      passwordTitle: 'Change Password',
      passwordFields: {
        current: 'Current Password',
        new: 'New Password',
        confirm: 'Confirm Password',
      },
    },
    company: {
      title: 'Company Information',
      logo: {
        label: 'Company Logo',
        upload: 'Upload Logo',
        remove: 'Remove',
        helper: 'You can upload PNG, JPG or GIF files up to 5MB.',
        uploaded: ({ name, sizeKB }) => `Logo ${name} (${sizeKB} KB)`,
      },
      fields: {
        name: 'Company Name',
        address: 'Address',
        taxNumber: 'Tax Number',
        taxOffice: 'Tax Office',
        phone: 'Phone',
        email: 'Email',
        website: 'Website',
      },
      legalFields: {
        title: 'Legal Compliance Fields',
        subtitle: 'Required information for international invoicing standards',
        countryHelp: "To enter company details, please select the company's country.",
        countrySelectLabel: 'Country',
        countryOptions: { TR: 'Turkey', US: 'United States', DE: 'Germany', FR: 'France', OTHER: 'Other' },
        turkey: {
          title: 'Turkey',
          mersisNumber: 'Mersis Number',
          kepAddress: 'KEP Address',
        },
        france: {
          title: 'France',
          siretNumber: 'SIRET Number',
          sirenNumber: 'SIREN Number',
          apeCode: 'APE/NAF Code',
          tvaNumber: 'TVA Number',
          rcsNumber: 'RCS Number',
        },
        germany: {
          title: 'Germany',
          steuernummer: 'Steuernummer',
          umsatzsteuerID: 'Umsatzsteuer-ID',
          handelsregisternummer: 'Handelsregisternummer',
          geschaeftsfuehrer: 'Geschäftsführer',
        },
        usa: {
          title: 'USA',
          einNumber: 'EIN Number',
          taxId: 'Tax ID',
          businessLicenseNumber: 'Business License No',
          stateOfIncorporation: 'State of Incorporation',
        },
        other: {
          title: 'Other Countries',
          registrationNumber: 'Registration No',
          vatNumber: 'VAT Number',
          taxId: 'Tax ID',
          stateOrRegion: 'State/Region',
        },
      },
      iban: {
        sectionTitle: 'IBAN to use on invoices',
        bankOption: 'Select from saved bank accounts',
        noBanks: '(No saved bank account)',
        bankSelectPlaceholder: 'Choose a bank',
        manualOption: 'Enter IBAN manually',
        ibanPlaceholder: 'TR00 0000 0000 0000 0000 0000 00',
        bankNamePlaceholder: 'Bank name (e.g. Ziraat Bankası)',
        preview: value => `Preview: ${value}`,
        previewExample: 'Ex: TRxx xxxx xxxx xxxx xxxx xxxx xx',
      },
    },
    notifications: {
      title: 'Notification Preferences',
      labels: {
        invoiceReminders: 'Invoice Reminders',
        expenseAlerts: 'Expense Alerts',
        salesNotifications: 'Sales Notifications',
        lowStockAlerts: 'Low Stock Alerts',
        quoteReminders: 'Quote Reminders',
      },
    },
    system: {
      title: 'System Settings',
      currencyLabel: 'Currency',
      dateFormatLabel: 'Date Format',
      timezoneLabel: 'Time Zone',
      currencies: {
        TRY: '₺ Turkish Lira',
        USD: '$ US Dollar',
        EUR: '€ Euro',
      },
      timezones: {
        'Europe/Istanbul': 'Istanbul',
        UTC: 'UTC',
        'America/New_York': 'New York',
      },
      backup: {
        title: 'Backups',
        toggleLabel: 'Automatic Backup',
        toggleDescription: 'Back up your data automatically',
        frequencyLabel: 'Backup Frequency',
        options: {
          daily: 'Daily',
          weekly: 'Weekly',
          monthly: 'Monthly',
        },
      },
    },
    security: {
      tipsTitle: 'Security Tips',
      tips: [
        '• Use a strong password (at least 8 characters, upper/lowercase, numbers)',
        '• Change your password regularly',
        '• Enable two-factor authentication',
        '• Monitor suspicious activity',
      ],
      title: 'Security Settings',
      cards: {
        twoFactor: {
          title: 'Two-Factor Authentication',
          description: 'Additional security layer for your account',
          action: 'Enable',
        },
        sessionHistory: {
          title: 'Session History',
          description: 'Review recent login activity',
          action: 'View',
        },
        activeSessions: {
          title: 'Active Sessions',
          description: 'Manage sessions on other devices',
          action: 'Sign out all',
        },
      },
    },

    privacy: {
      title: 'GDPR & Data Rights',
      gdpr: {
        title: 'Personal Data Management',
        description: 'Manage your personal data under GDPR compliance',
        export: {
          title: 'Export My Data',
          description: 'Download all your personal data in ZIP format',
          button: 'Export My Data',
          disclaimer: 'The downloaded file contains your data in JSON and CSV formats.',
        },
        delete: {
          title: 'Delete My Account',
          description: 'Permanently delete your account and all personal data',
          button: 'Request Account Deletion',
          warning: 'This action cannot be undone and will delete all your data.',
          confirmDialog: {
            title: 'Account Deletion Confirmation',
            message: 'Are you sure you want to delete your account?',
            retention: 'Note: Accounting records will be retained for 10 years due to legal requirements.',
            confirm: 'Yes, Delete My Account',
            cancel: 'Cancel',
          },
        },
      },
    },

  },
  fr: {
    header: {
      title: 'Paramètres',
      subtitle: 'Gérez les paramètres du système et du compte',
      unsavedChanges: 'Des modifications non enregistrées',
      save: 'Enregistrer',
    },
    modals: {
      saveSuccess: {
        title: 'Enregistré',
        message: 'Vos modifications ont été enregistrées avec succès.',
        confirm: 'OK',
      },
      saveError: {
        title: 'Erreur',
        message: "Une erreur s'est produite lors de l'enregistrement des paramètres.",
        confirm: 'Fermer',
      },
      fileTypeError: { title: 'Type de fichier invalide', message: 'Veuillez sélectionner uniquement une image.', confirm: 'OK' },
      fileSizeError: { title: 'Fichier trop volumineux', message: 'La taille du fichier doit être inférieure à 5 Mo.', confirm: 'OK' },
      authRequired: { title: 'Authentification requise', message: 'Veuillez vous connecter d\'abord.', confirm: 'OK' },
      sessionExpired: { title: 'Session expirée', message: 'Veuillez vous reconnecter.', confirm: 'OK' },
      deleteRequested: { title: 'Demande reçue', message: 'Votre demande de suppression de compte a été envoyée.', confirm: 'OK' },
      deleteFailed: { title: 'Échec de la demande', message: 'La suppression du compte n\'a pas pu être soumise. Veuillez réessayer.', confirm: 'Fermer' },
    },
    tabs: {
      profile: 'Profil',
      company: 'Entreprise',
      plan: 'Abonnement',
      notifications: 'Notifications',
      organization: 'Organisation',
      fiscalPeriods: 'Périodes fiscales',
      system: 'Système',
      security: 'Sécurité',
      privacy: 'Confidentialité',
    },
    profile: {
      title: 'Informations du profil',
      fields: {
        name: 'Nom complet',
        email: 'Adresse e-mail',
        phone: 'Téléphone',
      },
      passwordTitle: 'Changer le mot de passe',
      passwordFields: {
        current: 'Mot de passe actuel',
        new: 'Nouveau mot de passe',
        confirm: 'Confirmer le mot de passe',
      },
    },
    company: {
      title: "Informations sur l’entreprise",
      logo: {
        label: "Logo de l’entreprise",
        upload: 'Télécharger le logo',
        remove: 'Supprimer',
        helper: 'Vous pouvez téléverser des fichiers PNG, JPG ou GIF jusqu’à 5 Mo.',
        uploaded: ({ name, sizeKB }) => `Logo ${name} (${sizeKB} Ko)`,
      },
      fields: {
        name: "Nom de l’entreprise",
        address: 'Adresse',
        taxNumber: 'Numéro fiscal',
        taxOffice: 'Centre des impôts',
        phone: 'Téléphone',
        email: 'E-mail',
        website: 'Site Web',
      },
      legalFields: {
        title: 'Champs de conformité légale',
        subtitle: 'Informations requises pour les normes de facturation internationales',
        countryHelp: "Pour saisir les informations de l’entreprise, veuillez sélectionner le pays de l’entreprise.",
        countrySelectLabel: 'Pays',
        countryOptions: { TR: 'Turquie', US: 'États-Unis', DE: 'Allemagne', FR: 'France', OTHER: 'Autre' },
        turkey: {
          title: 'Turquie',
          mersisNumber: 'Numéro Mersis',
          kepAddress: 'Adresse KEP',
        },
        france: {
          title: 'France',
          siretNumber: 'Numéro SIRET',
          sirenNumber: 'Numéro SIREN',
          apeCode: 'Code APE/NAF',
          tvaNumber: 'Numéro TVA',
          rcsNumber: 'Numéro RCS',
        },
        germany: {
          title: 'Allemagne',
          steuernummer: 'Steuernummer',
          umsatzsteuerID: 'Umsatzsteuer-ID',
          handelsregisternummer: 'Handelsregisternummer',
          geschaeftsfuehrer: 'Geschäftsführer',
        },
        usa: {
          title: 'États-Unis',
          einNumber: 'Numéro EIN',
          taxId: 'Tax ID',
          businessLicenseNumber: 'N° de licence commerciale',
          stateOfIncorporation: 'État de constitution',
        },
        other: {
          title: 'Autres pays',
          registrationNumber: 'N° d\'enregistrement',
          vatNumber: 'N° TVA',
          taxId: 'Tax ID',
          stateOrRegion: 'État/Région',
        },
      },
      iban: {
        sectionTitle: 'IBAN utilisé sur les factures',
        bankOption: 'Choisir parmi les comptes bancaires enregistrés',
        noBanks: '(Aucun compte bancaire enregistré)',
        bankSelectPlaceholder: 'Choisissez une banque',
        manualOption: 'Saisir l’IBAN manuellement',
        ibanPlaceholder: 'TR00 0000 0000 0000 0000 0000 00',
        bankNamePlaceholder: 'Nom de la banque (ex. Ziraat Bankası)',
        preview: value => `Aperçu : ${value}`,
        previewExample: 'Ex : TRxx xxxx xxxx xxxx xxxx xxxx xx',
      },
    },
    notifications: {
      title: 'Préférences de notification',
      labels: {
        invoiceReminders: 'Rappels de facture',
        expenseAlerts: 'Alertes de dépenses',
        salesNotifications: 'Notifications de ventes',
        lowStockAlerts: 'Alertes de stock bas',
        quoteReminders: 'Rappels de devis',
      },
    },
    system: {
      title: 'Paramètres du système',
      currencyLabel: 'Devise',
      dateFormatLabel: 'Format de date',
      timezoneLabel: 'Fuseau horaire',
      currencies: {
        TRY: '₺ Livre turque',
        USD: '$ Dollar américain',
        EUR: '€ Euro',
      },
      timezones: {
        'Europe/Istanbul': 'Istanbul',
        UTC: 'UTC',
        'America/New_York': 'New York',
      },
      backup: {
        title: 'Sauvegardes',
        toggleLabel: 'Sauvegarde automatique',
        toggleDescription: 'Sauvegardez vos données automatiquement',
        frequencyLabel: 'Fréquence de sauvegarde',
        options: {
          daily: 'Quotidienne',
          weekly: 'Hebdomadaire',
          monthly: 'Mensuelle',
        },
      },
    },
    security: {
      tipsTitle: 'Conseils de sécurité',
      tips: [
        '• Utilisez un mot de passe solide (au moins 8 caractères, majuscules/minuscules, chiffres)',
        '• Changez votre mot de passe régulièrement',
        '• Activez l’authentification à deux facteurs',
        '• Surveillez les activités suspectes',
      ],
      title: 'Paramètres de sécurité',
      cards: {
        twoFactor: {
          title: 'Authentification à deux facteurs',
          description: 'Une couche de sécurité supplémentaire pour votre compte',
          action: 'Activer',
        },
        sessionHistory: {
          title: 'Historique des sessions',
          description: 'Consultez vos connexions récentes',
          action: 'Afficher',
        },
        activeSessions: {
          title: 'Sessions actives',
          description: 'Gérez les sessions sur les autres appareils',
          action: 'Tout déconnecter',
        },
      },
    },

    privacy: {
      title: 'RGPD et Droits des Données',
      gdpr: {
        title: 'Gestion des Données Personnelles',
        description: 'Gérez vos données personnelles conformément au RGPD',
        export: {
          title: 'Exporter mes Données',
          description: 'Téléchargez toutes vos données personnelles au format ZIP',
          button: 'Exporter mes Données',
          disclaimer: 'Le fichier téléchargé contient vos données aux formats JSON et CSV.',
        },
        delete: {
          title: 'Supprimer mon Compte',
          description: 'Supprimez définitivement votre compte et toutes vos données personnelles',
          button: 'Demander la Suppression du Compte',
          warning: 'Cette action est irréversible et supprimera toutes vos données.',
          confirmDialog: {
            title: 'Confirmation de Suppression du Compte',
            message: 'Êtes-vous sûr de vouloir supprimer votre compte ?',
            retention: 'Note : Les registres comptables seront conservés 10 ans pour des raisons légales.',
            confirm: 'Oui, Supprimer mon Compte',
            cancel: 'Annuler',
          },
        },
      },
    },

  },
  de: {
    header: {
      title: 'Einstellungen',
      subtitle: 'System- und Kontoeinstellungen verwalten',
      unsavedChanges: 'Ungespeicherte Änderungen',
      save: 'Speichern',
    },
    modals: {
      saveSuccess: {
        title: 'Gespeichert',
        message: 'Ihre Änderungen wurden erfolgreich gespeichert.',
        confirm: 'OK',
      },
      saveError: {
        title: 'Fehler',
        message: 'Beim Speichern der Einstellungen ist ein Fehler aufgetreten.',
        confirm: 'Schließen',
      },
      fileTypeError: { title: 'Ungültiger Dateityp', message: 'Bitte wählen Sie nur eine Bilddatei aus.', confirm: 'OK' },
      fileSizeError: { title: 'Datei zu groß', message: 'Die Datei darf nicht größer als 5 MB sein.', confirm: 'OK' },
      authRequired: { title: 'Anmeldung erforderlich', message: 'Bitte melden Sie sich zuerst an.', confirm: 'OK' },
      sessionExpired: { title: 'Sitzung abgelaufen', message: 'Bitte melden Sie sich erneut an.', confirm: 'OK' },
      deleteRequested: { title: 'Anfrage erhalten', message: 'Ihre Kontolöschungsanfrage wurde übermittelt.', confirm: 'OK' },
      deleteFailed: { title: 'Anfrage fehlgeschlagen', message: 'Kontolöschung konnte nicht gesendet werden. Bitte erneut versuchen.', confirm: 'Schließen' },
    },
    tabs: {
      profile: 'Profil',
      company: 'Unternehmen',
      plan: 'Abo/Plan',
      notifications: 'Benachrichtigungen',
      organization: 'Organisation',
      fiscalPeriods: 'Finanzperioden',
      system: 'System',
      security: 'Sicherheit',
      privacy: 'Datenschutz',
    },
    profile: {
      title: 'Profilinformationen',
      fields: {
        name: 'Vollständiger Name',
        email: 'E-Mail-Adresse',
        phone: 'Telefon',
      },
      passwordTitle: 'Passwort ändern',
      passwordFields: {
        current: 'Aktuelles Passwort',
        new: 'Neues Passwort',
        confirm: 'Passwort bestätigen',
      },
    },
    company: {
      title: 'Unternehmensinformationen',
      logo: {
        label: 'Unternehmenslogo',
        upload: 'Logo hochladen',
        remove: 'Entfernen',
        helper: 'Sie können PNG-, JPG- oder GIF-Dateien bis 5 MB hochladen.',
        uploaded: ({ name, sizeKB }) => `Logo ${name} (${sizeKB} KB)`,
      },
      fields: {
        name: 'Unternehmensname',
        address: 'Adresse',
        taxNumber: 'Steuernummer',
        taxOffice: 'Finanzamt',
        phone: 'Telefon',
        email: 'E-Mail',
        website: 'Webseite',
      },
      legalFields: {
        title: 'Rechtliche Compliance-Felder',
        subtitle: 'Erforderliche Informationen für internationale Rechnungsstandards',
        countryHelp: 'Um Unternehmensdaten einzugeben, wählen Sie bitte das Unternehmensland.',
        countrySelectLabel: 'Land',
        countryOptions: { TR: 'Türkei', US: 'USA', DE: 'Deutschland', FR: 'Frankreich', OTHER: 'Andere' },
        turkey: {
          title: 'Türkei',
          mersisNumber: 'Mersis-Nummer',
          kepAddress: 'KEP-Adresse',
        },
        france: {
          title: 'Frankreich',
          siretNumber: 'SIRET-Nummer',
          sirenNumber: 'SIREN-Nummer',
          apeCode: 'APE/NAF-Code',
          tvaNumber: 'TVA-Nummer',
          rcsNumber: 'RCS-Nummer',
        },
        germany: {
          title: 'Deutschland',
          steuernummer: 'Steuernummer',
          umsatzsteuerID: 'Umsatzsteuer-ID',
          handelsregisternummer: 'Handelsregisternummer',
          geschaeftsfuehrer: 'Geschäftsführer',
        },
        usa: {
          title: 'USA',
          einNumber: 'EIN-Nummer',
          taxId: 'Tax ID',
          businessLicenseNumber: 'Gewerbelizenznummer',
          stateOfIncorporation: 'Gründungsstaat',
        },
        other: {
          title: 'Andere Länder',
          registrationNumber: 'Registernummer',
          vatNumber: 'USt/VAT-Nr.',
          taxId: 'Steuer-ID',
          stateOrRegion: 'Staat/Region',
        },
      },
      iban: {
        sectionTitle: 'IBAN für Rechnungen',
        bankOption: 'Aus registrierten Bankkonten auswählen',
        noBanks: '(Keine Bankkonten registriert)',
        bankSelectPlaceholder: 'Bank auswählen',
        manualOption: 'IBAN manuell eingeben',
        ibanPlaceholder: 'DE00 0000 0000 0000 0000 00',
        bankNamePlaceholder: 'Bankname (z.B. Deutsche Bank)',
        preview: value => `Vorschau: ${value}`,
        previewExample: 'z.B.: DExx xxxx xxxx xxxx xxxx xx',
      },
    },
    notifications: {
      title: 'Benachrichtigungseinstellungen',
      labels: {
        invoiceReminders: 'Rechnungserinnerungen',
        expenseAlerts: 'Ausgabenwarnungen',
        salesNotifications: 'Verkaufsbenachrichtigungen',
        lowStockAlerts: 'Niedriger Lagerbestand',
        quoteReminders: 'Angebotserinnerungen',
      },
    },
    system: {
      title: 'Systemeinstellungen',
      currencyLabel: 'Währung',
      dateFormatLabel: 'Datumsformat',
      timezoneLabel: 'Zeitzone',
      currencies: {
        TRY: '₺ Türkische Lira',
        USD: '$ US-Dollar',
        EUR: '€ Euro',
      },
      timezones: {
        'Europe/Istanbul': 'Istanbul',
        UTC: 'UTC',
        'America/New_York': 'New York',
      },
      backup: {
        title: 'Sicherungen',
        toggleLabel: 'Automatische Sicherung',
        toggleDescription: 'Sichern Sie Ihre Daten automatisch',
        frequencyLabel: 'Sicherungshäufigkeit',
        options: {
          daily: 'Täglich',
          weekly: 'Wöchentlich',
          monthly: 'Monatlich',
        },
      },
    },
    security: {
      tipsTitle: 'Sicherheitstipps',
      tips: [
        '• Verwenden Sie ein starkes Passwort (mindestens 8 Zeichen, Groß-/Kleinbuchstaben, Zahlen)',
        '• Ändern Sie Ihr Passwort regelmäßig',
        '• Aktivieren Sie die Zwei-Faktor-Authentifizierung',
        '• Überwachen Sie verdächtige Aktivitäten',
      ],
      title: 'Sicherheitseinstellungen',
      cards: {
        twoFactor: {
          title: 'Zwei-Faktor-Authentifizierung',
          description: 'Eine zusätzliche Sicherheitsebene für Ihr Konto',
          action: 'Aktivieren',
        },
        sessionHistory: {
          title: 'Sitzungsverlauf',
          description: 'Sehen Sie Ihre letzten Anmeldungen',
          action: 'Anzeigen',
        },
        activeSessions: {
          title: 'Aktive Sitzungen',
          description: 'Verwalten Sie Sitzungen auf anderen Geräten',
          action: 'Alle abmelden',
        },
      },
    },

    privacy: {
      title: 'DSGVO & Datenrechte',
      gdpr: {
        title: 'Persönliche Datenverwaltung',
        description: 'Verwalten Sie Ihre persönlichen Daten gemäß DSGVO',
        export: {
          title: 'Meine Daten Exportieren',
          description: 'Laden Sie alle Ihre persönlichen Daten im ZIP-Format herunter',
          button: 'Meine Daten Exportieren',
          disclaimer: 'Die heruntergeladene Datei enthält Ihre Daten in JSON- und CSV-Formaten.',
        },
        delete: {
          title: 'Mein Konto Löschen',
          description: 'Löschen Sie Ihr Konto und alle persönlichen Daten dauerhaft',
          button: 'Kontolöschung Beantragen',
          warning: 'Diese Aktion kann nicht rückgängig gemacht werden und löscht alle Ihre Daten.',
          confirmDialog: {
            title: 'Bestätigung der Kontolöschung',
            message: 'Sind Sie sicher, dass Sie Ihr Konto löschen möchten?',
            retention: 'Hinweis: Buchhaltungsunterlagen werden aus rechtlichen Gründen 10 Jahre aufbewahrt.',
            confirm: 'Ja, Mein Konto Löschen',
            cancel: 'Abbrechen',
          },
        },
      },
    },

  },
};

export default function SettingsPage({
  user = { name: 'Demo User', email: 'demo@moneyflow.com' },
  company,
  bankAccounts = [],
  onUserUpdate,
  onCompanyUpdate,
  initialTab,
}: Omit<SettingsPageProps, 'language'>): JSX.Element {
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showSaveError, setShowSaveError] = useState(false);
  const [infoModal, setInfoModal] = useState<{ open: boolean; title: string; message: string; tone: 'success' | 'error' | 'info'; confirmLabel?: string; onConfirm?: () => void; cancelLabel?: string; onCancel?: () => void }>({ open: false, title: '', message: '', tone: 'info' });
  const openInfo = (title: string, message: string, tone: 'success' | 'error' | 'info' = 'info') => setInfoModal({ open: true, title, message, tone });
  
  // Privacy tab states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Security: 2FA modal states
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [twoFAMode, setTwoFAMode] = useState<null | 'enable' | 'disable'>(null);
  const [twoFAStatus, setTwoFAStatus] = useState<{ enabled: boolean; backupCodesCount: number } | null>(null);
  const [twoFASetup, setTwoFASetup] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [twoFAToken, setTwoFAToken] = useState('');
  const [twoFABusy, setTwoFABusy] = useState(false);
  const [twoFABackups, setTwoFABackups] = useState<string[] | null>(null);

  // i18next entegrasyonu
  const { i18n, t } = useTranslation('common');
  
  // i18next dilini kullan (tr/en/fr/de formatında)
  const i18nLanguage = i18n.language.toLowerCase().substring(0, 2);
  
  // SettingsPage için dil mapping
  const currentLanguage: SettingsLanguage = 
    (SUPPORTED_LANGUAGES.includes(i18nLanguage as any)) 
      ? i18nLanguage as SettingsLanguage 
      : 'tr'; // default Turkish
  
  const text = settingsTranslations[currentLanguage];
  const notificationLabels = text.notifications.labels;
  
  // Auth context - profil güncellemesi için
  const { refreshUser, user: authUser, tenant, logout } = useAuth();
  // Tenant sahibi/ADMİN kontrolü: farklı sistemlerde rol isimleri değişebiliyor
  const roleNorm = (authUser?.role || '').toUpperCase();
  // Plan sekmesi sadece 'OWNER' benzeri sahiplik rolleri için görünür olmalı.
  // Bazı kurulumlarda sahip hesap backend'de TENANT_ADMIN olarak dönebildiği için ikisini de kabul ediyoruz.
  // İstek: Tenant kullanıcıları (owner olmayan roller) tüm uygulama verilerini görüp işlem yapabilsin,
  // Ayarlar sayfasında ise sadece Profil sekmesini görecekler. Mevcut mantık zaten bunu sağlıyor;
  // ancak bazı kurulumlarda ek roller (ACCOUNTANT, USER) "isOwnerLike" içine yanlışlıkla dahil edilirse
  // genişleme olmasın diye koşulu dar tutuyoruz.
  // Yönetici kapsamı: OWNER benzeri sahiplik rolleri + tenant_admin + super_admin tüm sekmeleri görsün
  const isOwnerLike = roleNorm === 'OWNER' || roleNorm === 'TENANT_ADMIN' || roleNorm === 'SUPER_ADMIN';

  // Organizasyon üyelik rolü (OWNER | ADMIN | MEMBER) — Settings erişimini genişletmek için kullanılır
  const [orgRole, setOrgRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER' | null>(null);
  const isOrgAdminLike = orgRole === 'OWNER' || orgRole === 'ADMIN';
  const canManageSettings = isOwnerLike || isOrgAdminLike; // Sekme ve alan yetkisi bu değişkene bağlı

  // Mevcut organizasyondaki (ilk/org) rolü yükle
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Kullanıcı yoksa veya token yoksa atla
        const token = localStorage.getItem('auth_token');
        if (!token || !authUser?.id) return;
        const orgs = await organizationsApi.getAll();
        if (!orgs || orgs.length === 0) return;
        const orgId = orgs[0].id;
        if (!orgId) return;
        const members = await organizationsApi.getMembers(orgId);
        const me = members.find(m => m.user.id === authUser.id);
        if (!cancelled) setOrgRole((me?.role as any) || null);
      } catch {
        if (!cancelled) setOrgRole(null);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser?.id]);

  // Resmi şirket adı (backend tenant.name) için yerel state
  const [officialCompanyName, setOfficialCompanyName] = useState<string>('');
  const [officialLoaded, setOfficialLoaded] = useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await tenantsApi.getMyTenant();
        if (!cancelled) {
          // Resmi şirket adı: kullanıcı ismine otomatik düşmeyelim; companyName yoksa boş kalsın
          setOfficialCompanyName(me?.companyName ?? '');
          setOfficialLoaded(true);
          try {
            // Tenant başlangıç bilgisi yoksa plan bilgisini local state'te de saklamaya devam edelim (UI için)
            if (!tenant?.subscriptionPlan && me?.subscriptionPlan) {
              // no-op: tenant context zaten planı taşıyorsa ayrıca gerek yok; sadece okunacak
            }
          } catch {}
        }
      } catch (e) {
        if (!cancelled) setOfficialLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Plan tab'ı açıldığında tenant bilgisini yenile
  useEffect(() => {
    if (activeTab === 'plan') {
      refreshUser().catch(() => {});
    }
  }, [activeTab, refreshUser]);

  // Security: 2FA handlers
  // İlk yüklemede 2FA durumunu al (buton etiketini dinamik göstermek için)
  useEffect(() => {
    (async () => {
      try {
        const status = await usersApi.getTwoFactorStatus();
        setTwoFAStatus(status);
      } catch {}
    })();
  }, []);

  const handleTwoFactorClick = async () => {
    try {
      setTwoFABusy(true);
      setTwoFABackups(null);
      setTwoFAToken('');
      const status = await usersApi.getTwoFactorStatus();
      setTwoFAStatus(status);
      if (status.enabled) {
        setTwoFAMode('disable');
        setTwoFAOpen(true);
      } else {
        const setup = await usersApi.setupTwoFactor();
        setTwoFASetup({ secret: setup.secret, qrCodeUrl: setup.qrCodeUrl });
        setTwoFAMode('enable');
        setTwoFAOpen(true);
      }
    } catch (e: any) {
      openInfo('2FA', e?.response?.data?.message || e?.message || 'İşlem başarısız', 'error');
    } finally {
      setTwoFABusy(false);
    }
  };

  const confirmTwoFactor = async () => {
    try {
      setTwoFABusy(true);
      if (twoFAMode === 'enable') {
        const res = await usersApi.enableTwoFactor((twoFAToken || '').trim());
        setTwoFABackups(res?.backupCodes || []);
        setTwoFAStatus({ enabled: true, backupCodesCount: res?.backupCodes?.length || 0 });
        await refreshUser();
      } else if (twoFAMode === 'disable') {
        await usersApi.disableTwoFactor((twoFAToken || '').trim());
        setTwoFAStatus({ enabled: false, backupCodesCount: 0 });
        await refreshUser();
        setTwoFAOpen(false);
        setTwoFAMode(null);
        openInfo(
          currentLanguage === 'tr' ? '2FA devre dışı' : currentLanguage === 'fr' ? '2FA désactivé' : currentLanguage === 'de' ? '2FA deaktiviert' : '2FA disabled',
          currentLanguage === 'tr' ? 'İki faktörlü doğrulama kapatıldı.' : currentLanguage === 'fr' ? "L’authentification à deux facteurs a été désactivée." : currentLanguage === 'de' ? 'Zwei-Faktor-Authentifizierung wurde deaktiviert.' : 'Two-factor authentication has been disabled.',
          'success'
        );
      }
    } catch (e: any) {
      openInfo('2FA', e?.response?.data?.message || e?.message || 'İşlem başarısız', 'error');
    } finally {
      setTwoFABusy(false);
    }
  };

  const closeTwoFAModal = () => {
    setTwoFAOpen(false);
    setTwoFAMode(null);
    setTwoFASetup(null);
    setTwoFAToken('');
    setTwoFABackups(null);
  };

  // Hosted invoice dönüşü (fokus veya sayfa açılışı) başarı modalı
  useEffect(() => {
    let disposed = false;
    const handler = async () => {
      const raw = localStorage.getItem('pending_billing_payment');
      if (!raw) return;
      try {
        const meta = JSON.parse(raw || '{}');
        const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
        if (!tenantId) return;
        const { syncSubscription, listInvoices } = await import('../api/billing');
        await syncSubscription(tenantId);
        const res = await listInvoices(tenantId);
        const since = typeof meta.ts === 'number' ? (meta.ts - 2 * 60 * 1000) : (Date.now() - 10 * 60 * 1000);
        const paid = (res?.invoices || []).some((inv: any) => Boolean(inv?.paid) && inv?.created && new Date(inv.created).getTime() >= since);
  if (paid && !disposed) {
          const planName = ((): string => {
            const d = String(meta?.plan || '').toLowerCase();
            if (d.includes('enterprise') || d.includes('business')) return 'Enterprise';
            if (d.includes('professional') || d === 'pro') return 'Pro';
            return 'Plan';
          })();
          const lang = currentLanguage || 'tr';
          const messages = {
            tr: {
              title: 'Ödeme Başarılı',
              basePlan: `İşleminiz başarıyla tamamlandı. Artık ${planName} planın keyfini çıkarabilirsiniz.`,
              baseGeneric: 'Ödemeniz başarıyla alındı.',
              extra: (n: number) => ` Ayrıca sisteminize ${n} kullanıcı daha davet edebilirsiniz.`,
            },
            en: {
              title: 'Payment Successful',
              basePlan: `Your update completed successfully. Enjoy the ${planName} plan!`,
              baseGeneric: 'Your payment was received successfully.',
              extra: (n: number) => ` You can now invite ${n} more user${n>1?'s':''} to your system.`,
            },
            fr: {
              title: 'Paiement réussi',
              basePlan: `Mise à jour terminée avec succès. Profitez du plan ${planName} !`,
              baseGeneric: 'Votre paiement a été reçu avec succès.',
              extra: (n: number) => ` Vous pouvez maintenant inviter ${n} utilisateur${n>1?'s':''} supplémentaires.`,
            },
            de: {
              title: 'Zahlung erfolgreich',
              basePlan: `Aktualisierung erfolgreich. Viel Spaß mit dem ${planName}-Tarif!`,
              baseGeneric: 'Ihre Zahlung wurde erfolgreich erhalten.',
              extra: (n: number) => ` Sie können nun ${n} weitere Benutzer einladen.`,
            },
          } as const;
          const dict = messages[lang as 'tr'|'en'|'fr'|'de'] || messages.tr;
          const baseMsg = meta?.type === 'plan-interval' ? dict.basePlan : dict.baseGeneric;
          const extraMsg = meta?.seats && meta.seats > 0 ? dict.extra(meta.seats) : '';
          // Owner ise "Kullanıcı Davet Et" kısa yolu ekle, değilse basit başarı mesajı
          if (canManageSettings) {
            const labels = {
              tr: { invite: 'Kullanıcı Davet Et', close: 'Kapat' },
              en: { invite: 'Invite Users', close: 'Close' },
              fr: { invite: 'Inviter des utilisateurs', close: 'Fermer' },
              de: { invite: 'Benutzer einladen', close: 'Schließen' },
            } as const;
            const L = labels[lang as 'tr'|'en'|'fr'|'de'] || labels.tr;
            setInfoModal({
              open: true,
              title: dict.title,
              message: baseMsg + extraMsg,
              tone: 'success',
              confirmLabel: L.invite,
              onConfirm: () => { 
                setInfoModal(m => ({ ...m, open: false })); 
                (async () => { 
                  try { 
                    const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
                    if (tenantId) { const { syncSubscription } = await import('../api/billing'); await syncSubscription(tenantId); }
                    await refreshUser(); 
                  } catch {}
                  setActiveTab('organization'); 
                })();
              },
              cancelLabel: L.close,
              onCancel: () => setInfoModal(m => ({ ...m, open: false })),
            });
          } else {
            openInfo(dict.title, baseMsg + extraMsg, 'success');
          }
          try { localStorage.removeItem('pending_billing_payment'); } catch {}
          await refreshUser();
        }
      } catch {}
    };
    handler();
    const onFocus = () => { handler(); };
    // Add-on başarıları için anlık event dinleyicisi
    const onBillingSuccess = (ev: Event) => {
      try {
        const anyEv = ev as CustomEvent<any>;
        const meta = anyEv?.detail || {};
        if (!meta || disposed) return;
        const lang = currentLanguage || 'tr';
        const messages = {
          tr: { title: 'İşlem Başarılı', base: 'İşleminiz başarıyla tamamlandı.', extra: (n:number) => ` Ayrıca sisteminize ${n} kullanıcı daha davet edebilirsiniz.` },
          en: { title: 'Success', base: 'Your operation completed successfully.', extra: (n:number) => ` You can now invite ${n} more user${n>1?'s':''}.` },
          fr: { title: 'Succès', base: 'Votre opération s’est terminée avec succès.', extra: (n:number) => ` Vous pouvez maintenant inviter ${n} utilisateur${n>1?'s':''} supplémentaires.` },
          de: { title: 'Erfolg', base: 'Ihr Vorgang wurde erfolgreich abgeschlossen.', extra: (n:number) => ` Sie können nun ${n} weitere Benutzer einladen.` },
        } as const;
        const dict = messages[lang as 'tr'|'en'|'fr'|'de'] || messages.tr;
        const extra = meta?.seats && meta.seats > 0 ? dict.extra(meta.seats) : '';
        if (canManageSettings) {
          const labels = {
            tr: { invite: 'Kullanıcı Davet Et', close: 'Kapat' },
            en: { invite: 'Invite Users', close: 'Close' },
            fr: { invite: 'Inviter des utilisateurs', close: 'Fermer' },
            de: { invite: 'Benutzer einladen', close: 'Schließen' },
          } as const;
          const L = labels[lang as 'tr'|'en'|'fr'|'de'] || labels.tr;
          setInfoModal({
            open: true,
            title: dict.title,
            message: dict.base + extra,
            tone: 'success',
            confirmLabel: L.invite,
            onConfirm: () => { 
              setInfoModal(m => ({ ...m, open: false })); 
              (async () => { 
                try { 
                  const tenantId = String((tenant as any)?.id || localStorage.getItem('tenantId') || '');
                  if (tenantId) { const { syncSubscription } = await import('../api/billing'); await syncSubscription(tenantId); }
                  await refreshUser();
                } catch {}
                setActiveTab('organization'); 
              })();
            },
            cancelLabel: L.close,
            onCancel: () => setInfoModal(m => ({ ...m, open: false })),
          });
        } else {
          openInfo(dict.title, dict.base + extra, 'success');
        }
      } catch {}
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('billingSuccess', onBillingSuccess as EventListener);
    return () => { disposed = true; window.removeEventListener('focus', onFocus); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Currency context
  const { currency, setCurrency } = useCurrency();
  
  console.log('[SettingsPage] Current currency from context:', currency);
  
  // Debug: currency değişimini izle
  useEffect(() => {
    console.log('[SettingsPage] Current currency:', currency);
  }, [currency]);

  // Profile
  const [profileData, setProfileData] = useState({
    name: user.name,
    email: user.email,
    phone: '+90 555 123 45 67',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Company (App’ten gelen company ile senkron)
  const [companyData, setCompanyData] = useState<LocalCompanyState>(() => ({
    name: company?.name ?? '',
    address: company?.address ?? '',
    taxNumber: company?.taxNumber ?? '',
    taxOffice: company?.taxOffice ?? '',
    phone: company?.phone ?? '',
    email: company?.email ?? '',
    website: company?.website ?? '',
    logoDataUrl: company?.logoDataUrl ?? '',
    bankAccountId: company?.bankAccountId ?? undefined,
    // Ülke seçimi yapılmadıysa TR (Türkiye) ile başlayalım; alanlar varsayılan olarak görünsün
    country: company?.country ?? 'TR',
    logoFile: null,
    
    // Türkiye yasal alanları
    mersisNumber: company?.mersisNumber ?? '',
    kepAddress: company?.kepAddress ?? '',
    
    // Fransa yasal alanları
    siretNumber: company?.siretNumber ?? '',
    sirenNumber: company?.sirenNumber ?? '',
    apeCode: company?.apeCode ?? '',
    tvaNumber: company?.tvaNumber ?? '',
    rcsNumber: company?.rcsNumber ?? '',
    
    // Almanya yasal alanları
    steuernummer: company?.steuernummer ?? '',
    umsatzsteuerID: company?.umsatzsteuerID ?? '',
    handelsregisternummer: company?.handelsregisternummer ?? '',
    geschaeftsfuehrer: company?.geschaeftsfuehrer ?? '',
    
    // Amerika yasal alanları
    einNumber: company?.einNumber ?? '',
    taxId: company?.taxId ?? '',
    businessLicenseNumber: company?.businessLicenseNumber ?? '',
    stateOfIncorporation: company?.stateOfIncorporation ?? '',

    // Diğer ülkeler (genel)
    registrationNumber: company?.registrationNumber ?? '',
    vatNumberGeneric: company?.vatNumberGeneric ?? '',
    taxIdGeneric: company?.taxIdGeneric ?? '',
    stateOrRegion: company?.stateOrRegion ?? '',
  }));

  // Props.company değişirse formu güncelle
  useEffect(() => {
    setCompanyData(prev => ({
      ...prev,
      name: company?.name ?? prev.name,
      address: company?.address ?? prev.address,
      taxNumber: company?.taxNumber ?? prev.taxNumber,
      taxOffice: company?.taxOffice ?? prev.taxOffice,
      phone: company?.phone ?? prev.phone,
      email: company?.email ?? prev.email,
      website: company?.website ?? prev.website,
      logoDataUrl: company?.logoDataUrl ?? prev.logoDataUrl,
      bankAccountId: company?.bankAccountId ?? prev.bankAccountId,
  country: company?.country ?? prev.country,
      
      // Yasal alanları da güncelle
      mersisNumber: company?.mersisNumber ?? prev.mersisNumber,
      kepAddress: company?.kepAddress ?? prev.kepAddress,
      siretNumber: company?.siretNumber ?? prev.siretNumber,
      sirenNumber: company?.sirenNumber ?? prev.sirenNumber,
      apeCode: company?.apeCode ?? prev.apeCode,
      tvaNumber: company?.tvaNumber ?? prev.tvaNumber,
      rcsNumber: company?.rcsNumber ?? prev.rcsNumber,
      steuernummer: company?.steuernummer ?? prev.steuernummer,
      umsatzsteuerID: company?.umsatzsteuerID ?? prev.umsatzsteuerID,
      handelsregisternummer: company?.handelsregisternummer ?? prev.handelsregisternummer,
      geschaeftsfuehrer: company?.geschaeftsfuehrer ?? prev.geschaeftsfuehrer,
      einNumber: company?.einNumber ?? prev.einNumber,
      taxId: company?.taxId ?? prev.taxId,
      businessLicenseNumber: company?.businessLicenseNumber ?? prev.businessLicenseNumber,
      stateOfIncorporation: company?.stateOfIncorporation ?? prev.stateOfIncorporation,

      registrationNumber: company?.registrationNumber ?? prev.registrationNumber,
      vatNumberGeneric: company?.vatNumberGeneric ?? prev.vatNumberGeneric,
      taxIdGeneric: company?.taxIdGeneric ?? prev.taxIdGeneric,
      stateOrRegion: company?.stateOrRegion ?? prev.stateOrRegion,
    }));
    setUnsavedChanges(false);
  }, [company]);

  // Notifications
  // Varsayılanlar (kullanıcı hiç ayarlamadıysa hepsi açık)
  type NotificationSettings = {
    invoiceReminders: boolean;
    expenseAlerts: boolean;
    salesNotifications: boolean;
    lowStockAlerts: boolean;
    quoteReminders: boolean;
  };

  const defaultNotificationSettings: NotificationSettings = {
    invoiceReminders: true,
    expenseAlerts: true,
    salesNotifications: true,
    lowStockAlerts: true,
    quoteReminders: true,
  } as const;

  // İlk render'da authUser henüz gelmemiş olabilir; localStorage'daki user objesinden ID'yi okumaya çalış.
  const loadInitialNotificationSettings = (): NotificationSettings => {
    try {
      const tid = (localStorage.getItem('tenantId') || 'default') as string;
      // localStorage'taki user objesinden id/_id al; yoksa authUser'dan; en sonda 'anon'
      let localUid = 'anon';
      try {
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const u = JSON.parse(userRaw);
          localUid = u?.id || u?._id || localUid;
        }
      } catch {}
      const runtimeUid = (authUser as any)?.id || (authUser as any)?._id || localUid;
      const tryKeys: string[] = [];
      // Önce mevcut tenant id + runtimeUid
      tryKeys.push(`notif_prefs:${tid}:${runtimeUid}`);
      // Sonra mevcut tenant id + localUid (auth henüz hazır değilse)
      if (runtimeUid !== localUid) tryKeys.push(`notif_prefs:${tid}:${localUid}`);
      // Ardından default tenant altında aynı kimlikler
      if (tid !== 'default') {
        tryKeys.push(`notif_prefs:default:${runtimeUid}`);
        if (runtimeUid !== localUid) tryKeys.push(`notif_prefs:default:${localUid}`);
      }
      for (const k of tryKeys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              return { ...defaultNotificationSettings, ...parsed };
            }
          } catch {}
        }
      }
    } catch {}
    return { ...defaultNotificationSettings };
  };

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(loadInitialNotificationSettings);
  const { updatePref } = useNotificationPreferences();

  // İlk mount'ta backend'den prefs çek ve state'i güncelle (local cache fallback)
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return; // public modda deneme
        const prefs = await usersApi.getNotificationPreferences();
        if (prefs && typeof prefs === 'object') {
          const next: NotificationSettings = {
            invoiceReminders: prefs.invoiceReminders ?? notificationSettings.invoiceReminders,
            expenseAlerts: prefs.expenseAlerts ?? notificationSettings.expenseAlerts,
            salesNotifications: prefs.salesNotifications ?? notificationSettings.salesNotifications,
            lowStockAlerts: prefs.lowStockAlerts ?? notificationSettings.lowStockAlerts,
            quoteReminders: prefs.quoteReminders ?? notificationSettings.quoteReminders,
          };
          setNotificationSettings(next);
          // local cache'i de senkron tut
          persistNotificationSettings(next);
        }
      } catch (e) {
        // sessiz geç; offline/local cache kullanılacak
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auth kullanıcı kimliği kesinleşince tercihi tek seferde yeniden oku (merge yok; tam overwrite)
  useEffect(() => {
    const readPrefsExact = (): NotificationSettings | null => {
      try {
        const tid = (localStorage.getItem('tenantId') || 'default') as string;
        const ids: string[] = [];
        const authId = (authUser as any)?.id || (authUser as any)?._id;
        if (authId) ids.push(String(authId));
        try {
          const userRaw = localStorage.getItem('user');
          if (userRaw) {
            const u = JSON.parse(userRaw);
            const lid = u?.id || u?._id;
            if (lid && !ids.includes(String(lid))) ids.push(String(lid));
          }
        } catch {}
        if (ids.length === 0) ids.push('anon');
        const tidCandidates = tid !== 'default' ? [tid, 'default'] : [tid];
        for (const tCandidate of tidCandidates) {
          for (const idCandidate of ids) {
            const key = `notif_prefs:${tCandidate}:${idCandidate}`;
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object') {
                // Eksik anahtarları default ile doldur ama mevcut state'i zorla değiştirme, sadece storage değerlerini uygula
                return {
                  invoiceReminders: parsed.invoiceReminders ?? notificationSettings.invoiceReminders,
                  expenseAlerts: parsed.expenseAlerts ?? notificationSettings.expenseAlerts,
                  salesNotifications: parsed.salesNotifications ?? notificationSettings.salesNotifications,
                  lowStockAlerts: parsed.lowStockAlerts ?? notificationSettings.lowStockAlerts,
                  quoteReminders: parsed.quoteReminders ?? notificationSettings.quoteReminders,
                };
              }
            } catch {}
          }
        }
      } catch {}
      return null;
    };
    const loaded = readPrefsExact();
    if (loaded) {
      // Eğer zaten aynı ise state'i değiştirme
      const same = (Object.keys(loaded) as (keyof NotificationSettings)[]).every(k => loaded[k] === notificationSettings[k]);
      if (!same) setNotificationSettings(loaded);
    }
  }, [authUser]);

  // System (currency context'ten geliyor, burada tutmuyoruz)
  const [systemSettings, setSystemSettings] = useState({
    language: 'tr',
    dateFormat: 'DD/MM/YYYY',
    theme: 'light',
    // TODO: Otomatik yedekleme - Backend servisi eklendiğinde aktif edilecek
    // autoBackup: true,
    // backupFrequency: 'daily',
  });

  // Sekmeler: Üyeler sadece Güvenlik sekmesini görsün; yöneticiler tüm sekmeleri görür
  const tabs = (() => {
    if (!canManageSettings) {
      return [
        { id: 'profile', label: text.tabs.profile, icon: User },
        { id: 'security', label: text.tabs.security, icon: Shield },
      ];
    }
    return [
      { id: 'profile', label: text.tabs.profile, icon: User },
      { id: 'company', label: text.tabs.company, icon: Building2 },
      { id: 'plan', label: text.tabs.plan || 'Plan', icon: CreditCard },
      { id: 'organization', label: text.tabs.organization || 'Organization', icon: Users },
      { id: 'fiscal-periods', label: text.tabs.fiscalPeriods || 'Fiscal Periods', icon: Calendar },
      { id: 'notifications', label: text.tabs.notifications, icon: Bell },
      { id: 'security', label: text.tabs.security, icon: Shield },
      { id: 'privacy', label: text.tabs.privacy, icon: Lock },
    ];
  })();

  // initialTab verilirse ilk açılışta ona geç
  useEffect(() => {
    if (!initialTab) return;
    const validTabIds = tabs.map(t => t.id);
    if (validTabIds.includes(initialTab)) {
      setActiveTab(initialTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  // Aktif sekme mevcut değilse ilk geçerli sekmeye taşı
  useEffect(() => {
    const validTabIds = tabs.map(t => t.id);
    if (!validTabIds.includes(activeTab)) {
      const next = validTabIds[0] || 'security';
      setActiveTab(next);
    }
  }, [tabs, activeTab]);

  const handleProfileChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    setUnsavedChanges(true);
  };

  const handleCompanyChange = (field: keyof LocalCompanyState, value: string) => {
    setCompanyData(prev => ({ ...prev, [field]: value }));
    setUnsavedChanges(true);
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      openInfo(text.modals.fileTypeError.title, text.modals.fileTypeError.message, 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      openInfo(text.modals.fileSizeError.title, text.modals.fileSizeError.message, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      setCompanyData(prev => ({
        ...prev,
        logoDataUrl: e.target?.result as string,
        logoFile: file,
      }));
      setUnsavedChanges(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setCompanyData(prev => ({ ...prev, logoDataUrl: '', logoFile: null }));
    setUnsavedChanges(true);
  };

  const persistNotificationSettings = (settingsObj: typeof notificationSettings) => {
    try {
      const tid = (localStorage.getItem('tenantId') || 'default') as string;
      // Mümkün olan tüm ID varyasyonlarına yaz (id / _id); böylece sonraki oturumda hangisi gelirse gelsin okunacak
      const ids: string[] = [];
      const authId = (authUser as any)?.id || (authUser as any)?._id;
      if (authId) ids.push(String(authId));
      try {
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const u = JSON.parse(userRaw);
          const lid = u?.id || u?._id;
          if (lid) ids.push(String(lid));
        }
      } catch {}
      if (ids.length === 0) ids.push('anon');
      // Yinelenenleri kaldır
      const uniqueIds = Array.from(new Set(ids));
      const tidTargets = new Set<string>([tid]);
      if (tid !== 'default') tidTargets.add('default'); // tenant henüz yazılmadan önce de erişilebilir olsun
      tidTargets.forEach(tCandidate => {
        uniqueIds.forEach(idCandidate => {
          const key = `notif_prefs:${tCandidate}:${idCandidate}`;
          try { localStorage.setItem(key, JSON.stringify(settingsObj)); } catch {}
        });
      });
    } catch {}
  };

  const handleNotificationChange = async (field: string, value: boolean) => {
    setNotificationSettings(prev => ({ ...prev, [field]: value }));
    try {
      await updatePref(field as any, value);
      const updatedPrefs = { ...notificationSettings, [field]: value };
      persistNotificationSettings(updatedPrefs);
    } catch (e) {
      console.error('Notification preference update failed:', e);
    }
  };

  const handleSystemChange = (field: string, value: string | boolean) => {
    // Currency değişikliği context'e git
    if (field === 'currency') {
      console.log('[SettingsPage] handleSystemChange - Setting currency to:', value);
      setCurrency(value as 'TRY' | 'USD' | 'EUR');
    } else {
      setSystemSettings(prev => ({ ...prev, [field]: value }));
    }
    setUnsavedChanges(true);
  };

  const handleSave = async () => {
    console.log('🚀 KAYDET BUTONU BASILDI! profileData:', profileData);
    console.log('📤 Backend\'e gönderilecek veri:', {
      name: profileData.name,
      phone: profileData.phone,
    });
    
    try {
      // ✅ KULLANICI PROFİLİNİ BACKEND'E KAYDET
      console.log('🔄 usersApi.updateProfile ÇAĞRILIYOR...');
      const updatedUser = await usersApi.updateProfile({
        name: profileData.name,
        phone: profileData.phone,
      });
      console.log('✅ usersApi.updateProfile TAMAMLANDI, response:', updatedUser);
      
      // ⚠️ KRİTİK: Backend'den dönen updatedUser'ı DOĞRUDAN localStorage'a yaz
      localStorage.setItem('user', JSON.stringify(updatedUser));
      console.log('✅ localStorage user güncellendi:', updatedUser);
      
      // AuthContext'i de güncelle
      try {
        await refreshUser();
        console.log('✅ refreshUser() başarıyla tamamlandı!');
      } catch (refreshError) {
        console.error('⚠️ refreshUser() hatası (normal, localStorage güncel):', refreshError);
      }
      // 🔐 Şifre değişimi alanları doluysa burada işleme al
      const pwCurrent = profileData.currentPassword.trim();
      const pwNew = profileData.newPassword.trim();
      const pwConfirm = profileData.confirmPassword.trim();
      if (pwCurrent || pwNew || pwConfirm) {
        if (!pwCurrent || !pwNew || !pwConfirm) {
          openInfo(
            currentLanguage === 'tr' ? 'Şifre Alanları Eksik' : 'Missing Password Fields',
            currentLanguage === 'tr' ? 'Mevcut, yeni ve tekrar şifre alanlarının tümü doldurulmalı.' : 'All password fields (current, new, confirm) must be filled.',
            'error'
          );
          return;
        }
        if (pwNew !== pwConfirm) {
          openInfo(
            currentLanguage === 'tr' ? 'Şifre Eşleşmiyor' : 'Password Mismatch',
            currentLanguage === 'tr' ? 'Yeni şifre ile tekrar şifre aynı değil.' : 'New password and confirmation do not match.',
            'error'
          );
          return;
        }
        if (pwNew.length < 8) {
          openInfo(
            currentLanguage === 'tr' ? 'Şifre Çok Kısa' : 'Password Too Short',
            currentLanguage === 'tr' ? 'Yeni şifre en az 8 karakter olmalı.' : 'New password must be at least 8 characters.',
            'error'
          );
          return;
        }
        try {
          console.log('🔄 usersApi.changePassword çağrılıyor...');
          const resp = await usersApi.changePassword(pwCurrent, pwNew);
          if (resp?.success) {
            openInfo(
              currentLanguage === 'tr' ? 'Şifre Güncellendi' : 'Password Updated',
              currentLanguage === 'tr' ? 'Şifreniz başarıyla değiştirildi.' : 'Your password has been changed successfully.',
              'success'
            );
            setProfileData(prev => ({
              ...prev,
              currentPassword: '',
              newPassword: '',
              confirmPassword: '',
            }));
          } else {
            openInfo(
              currentLanguage === 'tr' ? 'Şifre Değiştirilemedi' : 'Password Change Failed',
              currentLanguage === 'tr' ? 'İşlem sırasında hata oluştu.' : 'An error occurred during password change.',
              'error'
            );
            return; // diğer kayıtları sürdürme
          }
        } catch (e:any) {
          const msg = e?.response?.data?.message || e?.message || 'Hata';
          openInfo(
            currentLanguage === 'tr' ? 'Şifre Değiştirilemedi' : 'Password Change Failed',
            msg,
            'error'
          );
          return; // hata durumunda kalan işlemleri atla
        }
      }

      // UI update için App.tsx'e bildir (opsiyonel - zaten refreshUser yapıyor)
      if (onUserUpdate) {
        const userToUpdate = {
          name: `${updatedUser.firstName} ${updatedUser.lastName}`,
          email: updatedUser.email,
          phone: profileData.phone,
        };
        onUserUpdate(userToUpdate);
        console.log('✅ onUserUpdate prop çağrıldı');
      }
      
      console.log('✅✅✅ PROFİL DEĞİŞİKLİĞİ KALICI OLARAK KAYDEDİLDİ! ✅✅✅');
      console.log('💾 Database\'de kayıtlı:', updatedUser);

      // Resmi şirket adı değiştiyse ve kullanıcı tenant sahibi ise, backend'e yaz
      try {
  if (canManageSettings && officialLoaded) {
          // Değişiklik kontrolü basitçe yapılır; gerçek senaryoda trim/normalize edilebilir
          // Backend tarafı sadece TENANT_ADMIN'e izin veriyor
          // companyData.name markalama alanı, officialCompanyName ise resmi alan
          const myTenant = await tenantsApi.getMyTenant();
          const currentOfficial = (myTenant?.companyName || myTenant?.name || '');
          if ((officialCompanyName || '') !== (currentOfficial || '')) {
            await tenantsApi.updateMyTenant({ companyName: officialCompanyName });
            // Backend kaydı değişti; App genelinde tenant adını yeniden çekmek istersen burada olay yayınlanabilir
          }
        }
      } catch (e) {
        console.error('Resmi şirket adı güncellenemedi:', e);
        // Kullanıcıya sessiz geçebiliriz; önemli olan engellenmemesi. Dilersen uyarı göster.
      }

      // Şirket bilgilerini BACKEND'E kaydet (tenant bazlı)
      let tenantUpdateOk = true;
      try {
        const brandSettings = {
          brand: {
            logoDataUrl: companyData.logoDataUrl || '',
            bankAccountId: companyData.bankAccountId || undefined,
            country: companyData.country || '',
          }
        };
        const payload: any = {
          // Temel alanlar
          companyName: officialCompanyName || companyData.name || undefined,
          address: companyData.address || undefined,
          taxNumber: companyData.taxNumber || undefined,
          taxOffice: companyData.taxOffice || undefined,
          phone: companyData.phone || undefined,
          email: companyData.email || undefined,
          website: companyData.website || undefined,
          // Yasal alanlar
          mersisNumber: companyData.mersisNumber || undefined,
          kepAddress: companyData.kepAddress || undefined,
          siretNumber: companyData.siretNumber || undefined,
          sirenNumber: companyData.sirenNumber || undefined,
          apeCode: companyData.apeCode || undefined,
          tvaNumber: companyData.tvaNumber || undefined,
          rcsNumber: companyData.rcsNumber || undefined,
          steuernummer: companyData.steuernummer || undefined,
          umsatzsteuerID: companyData.umsatzsteuerID || undefined,
          handelsregisternummer: companyData.handelsregisternummer || undefined,
          geschaeftsfuehrer: companyData.geschaeftsfuehrer || undefined,
          einNumber: companyData.einNumber || undefined,
          taxId: companyData.taxId || undefined,
          businessLicenseNumber: companyData.businessLicenseNumber || undefined,
          stateOfIncorporation: companyData.stateOfIncorporation || undefined,
          // Settings blob: logo, default bank, country
          settings: brandSettings,
        } as any;

        // Şirket sahibi değilse kimlik alanını hiç göndermeyelim
  if (!canManageSettings) {
          delete payload.companyName;
        }

        await tenantsApi.updateMyTenant(payload);
      } catch (e) {
        console.error('Tenant settings update failed', e);
        tenantUpdateOk = false;
      }

      // UI hızlı güncelleme ve cache için App'e bildir
      if (onCompanyUpdate) {
        const cleaned: CompanyProfile = {
          name: companyData.name,
          address: companyData.address,
          taxNumber: companyData.taxNumber,
          taxOffice: companyData.taxOffice,
          phone: companyData.phone,
          email: companyData.email,
          website: companyData.website,
          logoDataUrl: companyData.logoDataUrl,
          bankAccountId: companyData.bankAccountId,
          country: (companyData.country ? (companyData.country as any) : undefined),
          // Yasal alanlar
          mersisNumber: companyData.mersisNumber,
          kepAddress: companyData.kepAddress,
          siretNumber: companyData.siretNumber,
          sirenNumber: companyData.sirenNumber,
          apeCode: companyData.apeCode,
          tvaNumber: companyData.tvaNumber,
          rcsNumber: companyData.rcsNumber,
          steuernummer: companyData.steuernummer,
          umsatzsteuerID: companyData.umsatzsteuerID,
          handelsregisternummer: companyData.handelsregisternummer,
          geschaeftsfuehrer: companyData.geschaeftsfuehrer,
          einNumber: companyData.einNumber,
          taxId: companyData.taxId,
          businessLicenseNumber: companyData.businessLicenseNumber,
          stateOfIncorporation: companyData.stateOfIncorporation,
          // Diğer (genel)
          registrationNumber: companyData.registrationNumber,
          vatNumberGeneric: companyData.vatNumberGeneric,
          taxIdGeneric: companyData.taxIdGeneric,
          stateOrRegion: companyData.stateOrRegion,
        };
        onCompanyUpdate(cleaned);
      }

      // Bildirim tercihlerini backend'e yaz (kaydet butonu ile de tetikleyelim - idempotent)
      try {
        await usersApi.updateNotificationPreferences(notificationSettings);
        persistNotificationSettings(notificationSettings); // lokal cache
      } catch (e) {
        console.error('Notification prefs save failed:', e);
      }

      setUnsavedChanges(false);
      if (tenantUpdateOk) {
        setShowSaveSuccess(true);
      } else {
        setShowSaveError(true);
      }
    } catch (error) {
      console.error('Ayarlar kaydedilirken hata:', error);
      setShowSaveError(true);
    }
  };

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.profile.title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.profile.fields.name}</label>
          <input
            type="text"
            value={profileData.name}
            onChange={e => handleProfileChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.profile.fields.email}</label>
          <input
            type="email"
            value={profileData.email}
            onChange={e => handleProfileChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.profile.fields.phone}</label>
          <input
            type="tel"
            value={profileData.phone}
            onChange={e => handleProfileChange('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {/* Son giriş zamanı (salt-okunur) */}
        <div className="flex flex-col">
          <span className="block text-sm font-medium text-gray-700 mb-2">{currentLanguage === 'tr' ? 'Son Giriş' : currentLanguage === 'fr' ? 'Dernière connexion' : currentLanguage === 'de' ? 'Letzte Anmeldung' : 'Last Login'}</span>
          <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
            {(() => {
              try {
                const at = (authUser as any)?.lastLoginAt as string | undefined;
                if (!at) return '—';
                const d = new Date(at);
                if (Number.isNaN(d.getTime())) return '—';
                const locale = (typeof i18n?.language === 'string' && i18n.language) ? i18n.language : (currentLanguage || 'tr');
                return d.toLocaleString(locale);
              } catch { return '—'; }
            })()}
          </div>
        </div>
      </div>
    </div>

    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.profile.passwordTitle}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.profile.passwordFields.current}</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={profileData.currentPassword}
              onChange={e => handleProfileChange('currentPassword', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.profile.passwordFields.new}</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={profileData.newPassword}
            onChange={e => handleProfileChange('newPassword', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{text.profile.passwordFields.confirm}</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={profileData.confirmPassword}
            onChange={e => handleProfileChange('confirmPassword', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>


    </div>
  </div>
  );

  // Plan sekmesi eski render fonksiyonu kaldırıldı; yerine ayrı <PlanTab /> bileşeni kullanılıyor.

  const renderCompanyTab = () => {
    const hasBanks = bankAccounts.length > 0;
    const selectedBank = bankAccounts.find(b => b.id === companyData.bankAccountId);
    const hasCountry = Boolean(companyData.country && String(companyData.country).trim() !== '');
    // Ülke seçimi dilden bağımsız: şirket ayarındaki country alanına göre
    const legalCountry: 'turkey' | 'france' | 'germany' | 'usa' | 'other' =
      companyData.country === 'TR' ? 'turkey'
      : companyData.country === 'FR' ? 'france'
      : companyData.country === 'DE' ? 'germany'
      : companyData.country === 'US' ? 'usa'
      : 'other';
    
    return (
      <div className="space-y-6">
        {/* Genel Bilgiler (Ülke + temel alanlar) */}
        <Section title={text.company.title}>
          {/* Bilgilendirme metni */}
          <div className="mb-4 flex items-start gap-2 rounded-md bg-blue-50 p-3 text-blue-800">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{text.company.legalFields.countryHelp || 'Şirket bilgilerini girebilmek için lütfen şirket ülkesini seçin.'}</span>
          </div>
          {/* Ülke seçimi en üstte */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.countrySelectLabel || 'Ülke'}</label>
              <select
                value={companyData.country}
                onChange={e => handleCompanyChange('country', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="TR">{text.company.legalFields.countryOptions?.TR || 'Türkiye'}</option>
                <option value="US">{text.company.legalFields.countryOptions?.US || 'Amerika'}</option>
                <option value="DE">{text.company.legalFields.countryOptions?.DE || 'Almanya'}</option>
                <option value="FR">{text.company.legalFields.countryOptions?.FR || 'Fransa'}</option>
                <option value="OTHER">{text.company.legalFields.countryOptions?.OTHER || 'Diğer'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Official Company Name (i18n) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.companyFields.officialName')}</label>
              <input
                type="text"
                value={officialCompanyName}
                onChange={e => {
                  setOfficialCompanyName(e.target.value);
                  setUnsavedChanges(true);
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${!canManageSettings ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}
                disabled={!canManageSettings}
                title={!canManageSettings ? t('settings.companyFields.officialNameTooltip') : undefined}
              />
              {!isOwnerLike && (
                <p className="mt-1 text-xs text-gray-500">{t('settings.companyFields.officialNameOwnerOnly')}</p>
              )}
            </div>

            {/* Invoice/Brand Name (i18n) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.companyFields.brandName')}</label>
              <input
                type="text"
                value={companyData.name}
                onChange={e => handleCompanyChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">{t('settings.companyFields.brandNameHelper')}</p>
            </div>
            {hasCountry && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.phone}</label>
                  <input
                    type="tel"
                    value={companyData.phone}
                    onChange={e => handleCompanyChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.email}</label>
                  <input
                    type="email"
                    value={companyData.email}
                    onChange={e => handleCompanyChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.website}</label>
                  <input
                    type="url"
                    value={companyData.website}
                    onChange={e => handleCompanyChange('website', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.fields.address}</label>
                  <textarea
                    value={companyData.address}
                    onChange={e => handleCompanyChange('address', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Logo */}
        {hasCountry && (
          <Section title={text.company.logo.label} defaultOpen={false}>
            <div className="flex items-center space-x-4">
              {companyData.logoDataUrl ? (
                <div className="relative">
                  <img
                    src={companyData.logoDataUrl}
                    alt="Company Logo"
                    className="w-24 h-24 object-contain border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div>
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <label
                  htmlFor="logo-upload"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer inline-block"
                >
                  {text.company.logo.upload}
                </label>
                <p className="text-sm text-gray-500 mt-2">{text.company.logo.helper}</p>
              </div>
            </div>
          </Section>
        )}

        {/* Yasal Gereklilik Alanları */}
        {hasCountry && (
          <Section title={text.company.legalFields.title} subtitle={text.company.legalFields.subtitle} defaultOpen={false}>
            {/* Türkiye */}
            {legalCountry === 'turkey' && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">🇹🇷 {text.company.legalFields.turkey.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.turkey.mersisNumber}</label>
                    <input
                      type="text"
                      value={companyData.mersisNumber}
                      onChange={e => handleCompanyChange('mersisNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0123456789012345"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.turkey.kepAddress}</label>
                    <input
                      type="email"
                      value={companyData.kepAddress}
                      onChange={e => handleCompanyChange('kepAddress', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="sirket@hs01.kep.tr"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Fransa */}
            {legalCountry === 'france' && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">🇫🇷 {text.company.legalFields.france.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.france.siretNumber}</label>
                    <input
                      type="text"
                      value={companyData.siretNumber}
                      onChange={e => handleCompanyChange('siretNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12345678901234"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.france.sirenNumber}</label>
                    <input
                      type="text"
                      value={companyData.sirenNumber}
                      onChange={e => handleCompanyChange('sirenNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.france.apeCode}</label>
                    <input
                      type="text"
                      value={companyData.apeCode}
                      onChange={e => handleCompanyChange('apeCode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="6202A"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.france.tvaNumber}</label>
                    <input
                      type="text"
                      value={companyData.tvaNumber}
                      onChange={e => handleCompanyChange('tvaNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="FR12345678901"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.france.rcsNumber}</label>
                    <input
                      type="text"
                      value={companyData.rcsNumber}
                      onChange={e => handleCompanyChange('rcsNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123 456 789 RCS Paris"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Almanya */}
            {legalCountry === 'germany' && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">🇩🇪 {text.company.legalFields.germany.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.germany.steuernummer}</label>
                    <input
                      type="text"
                      value={companyData.steuernummer}
                      onChange={e => handleCompanyChange('steuernummer', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12/345/67890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.germany.umsatzsteuerID}</label>
                    <input
                      type="text"
                      value={companyData.umsatzsteuerID}
                      onChange={e => handleCompanyChange('umsatzsteuerID', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="DE123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.germany.handelsregisternummer}</label>
                    <input
                      type="text"
                      value={companyData.handelsregisternummer}
                      onChange={e => handleCompanyChange('handelsregisternummer', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="HRB 12345"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.germany.geschaeftsfuehrer}</label>
                    <input
                      type="text"
                      value={companyData.geschaeftsfuehrer}
                      onChange={e => handleCompanyChange('geschaeftsfuehrer', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Max Mustermann"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Amerika */}
            {legalCountry === 'usa' && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">🇺🇸 {text.company.legalFields.usa.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.usa.einNumber}</label>
                    <input
                      type="text"
                      value={companyData.einNumber}
                      onChange={e => handleCompanyChange('einNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12-3456789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.usa.taxId}</label>
                    <input
                      type="text"
                      value={companyData.taxId}
                      onChange={e => handleCompanyChange('taxId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123-45-6789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.usa.businessLicenseNumber}</label>
                    <input
                      type="text"
                      value={companyData.businessLicenseNumber}
                      onChange={e => handleCompanyChange('businessLicenseNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="BL123456"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.usa.stateOfIncorporation}</label>
                    <input
                      type="text"
                      value={companyData.stateOfIncorporation}
                      onChange={e => handleCompanyChange('stateOfIncorporation', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Delaware"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Diğer Ülkeler */}
            {legalCountry === 'other' && (
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">🌐 {text.company.legalFields.other.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.other.registrationNumber}</label>
                    <input
                      type="text"
                      value={companyData.registrationNumber}
                      onChange={e => handleCompanyChange('registrationNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.other.vatNumber}</label>
                    <input
                      type="text"
                      value={companyData.vatNumberGeneric}
                      onChange={e => handleCompanyChange('vatNumberGeneric', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.other.taxId}</label>
                    <input
                      type="text"
                      value={companyData.taxIdGeneric}
                      onChange={e => handleCompanyChange('taxIdGeneric', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.legalFields.other.stateOrRegion}</label>
                    <input
                      type="text"
                      value={companyData.stateOrRegion}
                      onChange={e => handleCompanyChange('stateOrRegion', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* IBAN bölümü ayrı bir section */}
        {hasCountry && (
          <Section title={text.company.iban.sectionTitle} defaultOpen={false}>
            {hasBanks ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{text.company.iban.bankOption}</label>
                <select
                  value={companyData.bankAccountId || ''}
                  onChange={e => handleCompanyChange('bankAccountId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{text.company.iban.bankSelectPlaceholder}</option>
                  {bankAccounts.map(bank => (
                    <option key={bank.id} value={bank.id}>
                      {bank.bankName} - {bank.accountName}
                    </option>
                  ))}
                </select>
                {selectedBank && (
                  <p className="text-sm text-gray-500 mt-1">IBAN: {selectedBank.iban}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-600">{text.company.iban.noBanks}</p>
            )}
          </Section>
        )}

        {/* Sistem Ayarları ayrı bir section */}
        {hasCountry && (
          <Section title={text.system.title} defaultOpen={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{text.system.currencyLabel}</label>
                <select
                  value={currency}
                  onChange={e => {
                    console.log('[SettingsPage] Currency dropdown changed to:', e.target.value);
                    handleSystemChange('currency', e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TRY">{text.system.currencies.TRY}</option>
                  <option value="USD">{text.system.currencies.USD}</option>
                  <option value="EUR">{text.system.currencies.EUR}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{text.system.dateFormatLabel}</label>
                <select
                  value={systemSettings.dateFormat}
                  onChange={e => handleSystemChange('dateFormat', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          </Section>
        )}
      </div>
    );
  };

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.notifications.title}</h3>
        <div className="space-y-4">
          {Object.entries(notificationSettings).map(([key, value]) => {
            const label =
              notificationLabels[key as NotificationKey] ?? key;

            return (
              <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{label}</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={e => handleNotificationChange(key, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className='w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600'></div>
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // System sekmesi kaldırıldı; ayarlar şirket sekmesine taşındı

  const renderSecurityTab = () => (
  <div className="space-y-6">
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
        <div>
          <h4 className="font-medium text-yellow-800">{text.security.tipsTitle}</h4>
          <ul className="text-sm text-yellow-700 mt-2 space-y-1">
            {text.security.tips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>

    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.security.title}</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-gray-900">{text.security.cards.twoFactor.title}</div>
            <div className="text-sm text-gray-500">{text.security.cards.twoFactor.description}</div>
          </div>
          <button onClick={handleTwoFactorClick} disabled={twoFABusy} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
            {(() => {
              const enabled = !!twoFAStatus?.enabled;
              if (enabled) {
                return currentLanguage === 'tr' ? 'Devre Dışı Bırak' : currentLanguage === 'fr' ? 'Désactiver' : currentLanguage === 'de' ? 'Deaktivieren' : 'Disable';
              }
              return text.security.cards.twoFactor.action;
            })()}
          </button>
        </div>

        {isOwnerLike && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">{text.security.cards.sessionHistory.title}</div>
              <div className="text-sm text-gray-500">{text.security.cards.sessionHistory.description}</div>
            </div>
            <button
              onClick={() => {
                try {
                  const el = document.getElementById('audit-logs-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } catch {}
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              {text.security.cards.sessionHistory.action}
            </button>
          </div>
        )}

        {isOwnerLike && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">{text.security.cards.activeSessions.title}</div>
              <div className="text-sm text-gray-500">{text.security.cards.activeSessions.description}</div>
            </div>
            <button
              onClick={() => {
                setInfoModal({
                  open: true,
                  title: currentLanguage === 'tr' ? 'Oturumları Sonlandır' : currentLanguage === 'fr' ? 'Terminer les sessions' : currentLanguage === 'de' ? 'Sitzungen beenden' : 'Terminate Sessions',
                  message: currentLanguage === 'tr'
                    ? 'Tüm cihazlardaki oturumlar sonlandırılsın mı? Bu cihazda oturuma devam edebilmeniz için yeni bir token oluşturulacak.'
                    : currentLanguage === 'fr'
                    ? 'Mettre fin à toutes les sessions sur tous les appareils ? Un nouveau jeton sera émis pour continuer ici.'
                    : currentLanguage === 'de'
                    ? 'Alle Sitzungen auf allen Geräten beenden? Für dieses Gerät wird ein neues Token ausgestellt.'
                    : 'Terminate sessions on all devices? A new token will be issued to continue here.'
                  ,
                  tone: 'info',
                  confirmLabel: currentLanguage === 'tr' ? 'Evet, Sonlandır' : currentLanguage === 'fr' ? 'Oui, terminer' : currentLanguage === 'de' ? 'Ja, beenden' : 'Yes, terminate',
                  cancelLabel: currentLanguage === 'tr' ? 'Vazgeç' : currentLanguage === 'fr' ? 'Annuler' : currentLanguage === 'de' ? 'Abbrechen' : 'Cancel',
                  onConfirm: async () => {
                    try {
                      const res = await usersApi.terminateAllSessions();
                      if (res?.token) {
                        localStorage.setItem('auth_token', res.token);
                        try { await refreshUser(); } catch {}
                        setInfoModal({
                          open: true,
                          title: currentLanguage === 'tr' ? 'Oturumlar Sonlandırıldı' : currentLanguage === 'fr' ? 'Sessions terminées' : currentLanguage === 'de' ? 'Sitzungen beendet' : 'Sessions terminated',
                          message: currentLanguage === 'tr' ? 'Diğer cihazlardaki oturumlar sonlandırıldı. Bu cihazda oturuma devam ediyorsunuz.' : currentLanguage === 'fr' ? 'Les autres appareils ont été déconnectés. Vous continuez sur cet appareil.' : currentLanguage === 'de' ? 'Andere Geräte wurden abgemeldet. Sie bleiben auf diesem Gerät angemeldet.' : 'Other devices were signed out. You remain signed in here.',
                          tone: 'success',
                          cancelLabel: currentLanguage === 'tr' ? 'Bu cihazdan da çık' : currentLanguage === 'fr' ? 'Se déconnecter ici aussi' : currentLanguage === 'de' ? 'Auch hier abmelden' : 'Sign out here too',
                          onCancel: async () => {
                            try { await logout(); } catch {}
                            setInfoModal(m => ({ ...m, open: false }));
                          },
                          confirmLabel: currentLanguage === 'tr' ? 'Tamam' : currentLanguage === 'fr' ? 'OK' : currentLanguage === 'de' ? 'OK' : 'OK',
                          onConfirm: () => setInfoModal(m => ({ ...m, open: false })),
                        });
                      }
                    } catch (e: any) {
                      openInfo('Sessions', e?.response?.data?.message || e?.message || 'İşlem başarısız', 'error');
                    }
                  },
                  onCancel: () => setInfoModal(m => ({ ...m, open: false })),
                });
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              {text.security.cards.activeSessions.action}
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Audit Logs Section - sadece owner/admin */}
    {isOwnerLike && (
      <div id="audit-logs-section" className="border-t pt-6">
        <AuditLogComponent />
      </div>
    )}
  </div>
);

  const renderPrivacyTab = () => {

    const handleExportData = async () => {
      try {
        setIsExporting(true);
        
        const token = localStorage.getItem('auth_token');
        console.log('Token found:', token ? 'YES' : 'NO');
        if (!token) {
          openInfo(text.modals.authRequired.title, text.modals.authRequired.message, 'error');
          return;
        }

        console.log('Making export request...');
        const response = await fetch('/api/users/me/export', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        console.log('Response status:', response.status);
        if (!response.ok) {
          if (response.status === 401) {
            openInfo(text.modals.sessionExpired.title, text.modals.sessionExpired.message, 'error');
            return;
          }
          const errorText = await response.text();
          console.error('Export error:', response.status, errorText);
          throw new Error(`Export failed: ${response.status} - ${errorText}`);
        }

        // Download the ZIP file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `my-data-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Lokalize edilmemiş; isterseniz modala çevrilebilir
        alert('Data exported successfully!');
      } catch (error) {
        console.error('Export error:', error);
        alert(`Failed to export data: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsExporting(false);
      }
    };

    const handleDeleteAccount = async () => {
      try {
        setIsDeletingAccount(true);
        
        const token = localStorage.getItem('auth_token');
        if (!token) {
          openInfo(text.modals.authRequired.title, text.modals.authRequired.message, 'error');
          setIsDeletingAccount(false);
          return;
        }

        const response = await fetch('/api/users/me/delete', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            openInfo(text.modals.sessionExpired.title, text.modals.sessionExpired.message, 'error');
            setIsDeletingAccount(false);
            return;
          }
          throw new Error('Account deletion request failed');
        }

        const result = await response.json();
        openInfo(text.modals.deleteRequested.title, result?.message || text.modals.deleteRequested.message, 'success');
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error('Account deletion error:', error);
        openInfo(text.modals.deleteFailed.title, text.modals.deleteFailed.message, 'error');
      } finally {
        setIsDeletingAccount(false);
      }
    };

    return (
      <div className="space-y-6">
        {/* Local Data Recovery panel kaldırıldı - backend persist zorunlu */}

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{text.privacy.title}</h3>
          <p className="text-gray-600 mb-6">{text.privacy.gdpr.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Data */}
            <div className="p-6 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3 mb-4">
                <Download className="w-6 h-6 text-blue-600" />
                <div>
                  <h4 className="font-medium text-gray-900">{text.privacy.gdpr.export.title}</h4>
                  <p className="text-sm text-gray-500">{text.privacy.gdpr.export.description}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-4">{text.privacy.gdpr.export.disclaimer}</p>
              <button
                onClick={handleExportData}
                disabled={isExporting}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : text.privacy.gdpr.export.button}
              </button>
            </div>

            {/* Delete Account */}
            <div className="p-6 border border-red-200 rounded-lg bg-red-50">
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
                <div>
                  <h4 className="font-medium text-red-800">{text.privacy.gdpr.delete.title}</h4>
                  <p className="text-sm text-red-600">{text.privacy.gdpr.delete.description}</p>
                </div>
              </div>
              <p className="text-xs text-red-600 mb-4">{text.privacy.gdpr.delete.warning}</p>
              <button
                onClick={() => setIsDeleteDialogOpen(true)}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                {text.privacy.gdpr.delete.button}
              </button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {isDeleteDialogOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {text.privacy.gdpr.delete.confirmDialog.title}
              </h3>
              <p className="text-gray-600 mb-4">
                {text.privacy.gdpr.delete.confirmDialog.message}
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  {text.privacy.gdpr.delete.confirmDialog.retention}
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={isDeletingAccount}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  {text.privacy.gdpr.delete.confirmDialog.cancel}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isDeletingAccount ? 'Processing...' : text.privacy.gdpr.delete.confirmDialog.confirm}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
  {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Settings className="w-8 h-8 text-blue-600 mr-3" />
              {text.header.title}
            </h1>
            <p className="text-gray-600">{text.header.subtitle}</p>
          </div>
          {unsavedChanges && (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-orange-600">
                <Info className="w-4 h-4" />
                <span className="text-sm">{text.header.unsavedChanges}</span>
              </div>
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{text.header.save}</span>
              </button>
            </div>
          )}
        </div>

        {/* Tabs: Owner dışındaki roller sadece Profil sekmesini otomatik alıyor (tabs fonksiyonu).
            Ek güvenlik için burada koşulu kaldırıp her zaman render ediyoruz; non-owner için zaten
            tabs dizisi yalnızca profile içeriyor. Böylece boş alan kalmıyor ve tutarlılık artıyor. */}
        {(
          <div className="flex space-x-2 border-b border-gray-200 mt-6 sticky top-16 z-20 bg-white">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium text-sm">{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6">
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'company' && renderCompanyTab()}
          {activeTab === 'plan' && canManageSettings && (
            <PlanTab tenant={tenant} currentLanguage={currentLanguage} text={text} />
          )}
          {activeTab === 'organization' && <OrganizationMembersPage />}
          {activeTab === 'fiscal-periods' && <FiscalPeriodsPage />}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {/* System sekmesi kaldırıldı */}
          {activeTab === 'security' && renderSecurityTab()}
          {activeTab === 'privacy' && renderPrivacyTab()}
        </div>
      </div>

      {/* 2FA Modal */}
      {twoFAOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {twoFAMode === 'enable'
                ? (currentLanguage === 'tr' ? 'İki Faktörlü Doğrulamayı Etkinleştir' : currentLanguage === 'fr' ? 'Activer l’authentification à deux facteurs' : currentLanguage === 'de' ? 'Zwei-Faktor-Authentifizierung aktivieren' : 'Enable Two-Factor Authentication')
                : (currentLanguage === 'tr' ? 'İki Faktörlü Doğrulamayı Devre Dışı Bırak' : currentLanguage === 'fr' ? 'Désactiver l’authentification à deux facteurs' : currentLanguage === 'de' ? 'Zwei-Faktor-Authentifizierung deaktivieren' : 'Disable Two-Factor Authentication')}
            </h3>

            {/* Enable flow: show QR + secret + token input until backups appear */}
            {twoFAMode === 'enable' && !twoFABackups && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  {currentLanguage === 'tr' ? 'Authenticator uygulamanızla QR kodu tarayın veya gizli anahtarı girin.' : currentLanguage === 'fr' ? "Scannez le QR avec votre application d’authentification ou saisissez la clé secrète." : currentLanguage === 'de' ? 'Scannen Sie den QR-Code mit Ihrer Authenticator-App oder geben Sie den geheimen Schlüssel ein.' : 'Scan the QR with your authenticator app or enter the secret key.'}
                </p>
                {twoFASetup?.qrCodeUrl && (
                  <div className="flex flex-col items-center">
                    <img
                      alt="2FA QR"
                      className="w-44 h-44"
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(twoFASetup.qrCodeUrl)}`}
                    />
                  </div>
                )}
                {twoFASetup?.secret && (
                  <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 break-all">
                    {currentLanguage === 'tr' ? 'Gizli Anahtar:' : currentLanguage === 'fr' ? 'Clé secrète :' : currentLanguage === 'de' ? 'Geheimer Schlüssel:' : 'Secret key:'} {twoFASetup.secret}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{currentLanguage === 'tr' ? '6 Haneli Kod' : currentLanguage === 'fr' ? 'Code à 6 chiffres' : currentLanguage === 'de' ? '6-stelliger Code' : '6-digit code'}</label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={twoFAToken}
                    onChange={e => setTwoFAToken(e.target.value.replace(/\D/g, '').slice(0,6))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="123456"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={confirmTwoFactor}
                    disabled={twoFABusy || (twoFAToken || '').length !== 6}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {twoFABusy ? (currentLanguage === 'tr' ? 'İşleniyor…' : 'Processing…') : (currentLanguage === 'tr' ? 'Etkinleştir' : currentLanguage === 'fr' ? 'Activer' : currentLanguage === 'de' ? 'Aktivieren' : 'Enable')}
                  </button>
                  <button onClick={closeTwoFAModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">
                    {currentLanguage === 'tr' ? 'Vazgeç' : currentLanguage === 'fr' ? 'Annuler' : currentLanguage === 'de' ? 'Abbrechen' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}

            {/* After enabling: show backup codes */}
            {twoFAMode === 'enable' && twoFABackups && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  {currentLanguage === 'tr' ? 'Yedek kodlarınızı güvenli bir yerde saklayın. Bu kodlar yalnızca bir kez gösterilir.' : currentLanguage === 'fr' ? 'Conservez vos codes de secours en lieu sûr. Ils ne sont affichés qu’une seule fois.' : currentLanguage === 'de' ? 'Bewahren Sie Ihre Backup-Codes sicher auf. Diese werden nur einmal angezeigt.' : 'Store your backup codes safely. These are shown only once.'}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {twoFABackups.map((c, i) => (
                    <div key={i} className="px-2 py-1 bg-gray-50 border border-gray-200 rounded font-mono">{c}</div>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={closeTwoFAModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    {currentLanguage === 'tr' ? 'Tamam' : 'OK'}
                  </button>
                </div>
              </div>
            )}

            {/* Disable flow */}
            {twoFAMode === 'disable' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  {currentLanguage === 'tr' ? '2FA’yı devre dışı bırakmak için geçerli 6 haneli kodu veya bir yedek kodu girin.' : currentLanguage === 'fr' ? 'Saisissez un code à 6 chiffres ou un code de secours pour désactiver 2FA.' : currentLanguage === 'de' ? 'Geben Sie einen gültigen 6-stelligen Code oder einen Backup-Code ein, um 2FA zu deaktivieren.' : 'Enter a valid 6-digit code or a backup code to disable 2FA.'}
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{currentLanguage === 'tr' ? 'Kod' : 'Code'}</label>
                  <input
                    value={twoFAToken}
                    onChange={e => setTwoFAToken(e.target.value.toUpperCase().slice(0, 8))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="123456 veya ABCD1234"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={confirmTwoFactor}
                    disabled={twoFABusy || !(twoFAToken || '').length}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {twoFABusy ? (currentLanguage === 'tr' ? 'İşleniyor…' : 'Processing…') : (currentLanguage === 'tr' ? 'Devre Dışı Bırak' : currentLanguage === 'fr' ? 'Désactiver' : currentLanguage === 'de' ? 'Deaktivieren' : 'Disable')}
                  </button>
                  <button onClick={closeTwoFAModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">
                    {currentLanguage === 'tr' ? 'Vazgeç' : currentLanguage === 'fr' ? 'Annuler' : currentLanguage === 'de' ? 'Abbrechen' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save result modals */}
      <InfoModal
        isOpen={showSaveSuccess}
        onClose={() => setShowSaveSuccess(false)}
        title={text.modals.saveSuccess.title}
        message={text.modals.saveSuccess.message}
        confirmLabel={t('common.ok')}
        tone="success"
        autoCloseMs={1800}
      />
      <InfoModal
        isOpen={showSaveError}
        onClose={() => setShowSaveError(false)}
        title={text.modals.saveError.title}
        message={text.modals.saveError.message}
        confirmLabel={t('common.ok')}
        tone="error"
      />
      <InfoModal
        isOpen={infoModal.open}
        onClose={() => setInfoModal(m => ({ ...m, open: false }))}
        title={infoModal.title}
        message={infoModal.message}
        confirmLabel={infoModal.confirmLabel || t('common.ok')}
        cancelLabel={infoModal.cancelLabel}
        onConfirm={infoModal.onConfirm}
        onCancel={infoModal.onCancel}
        tone={infoModal.tone}
      />
    </div>
  );
}

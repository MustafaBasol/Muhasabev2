import React, { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '../../api/admin';
import type { BillingInvoiceDTO } from '../../api/billing';
import { listInvoices as userListInvoices } from '../../api/billing';
import { readLegacyAuthToken, readLegacyTenantProfile } from '../../utils/localStorageSafe';
import type {
  AdminTenantSummary,
  TenantOverview,
  TenantPlanLimitOverrides,
  TenantSubscriptionRaw,
  TenantUser,
  TenantInvite,
} from '../../types/admin';

// A unified admin console per-tenant
const TenantConsolePage: React.FC = () => {
  const [tenants, setTenants] = useState<AdminTenantSummary[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [overview, setOverview] = useState<TenantOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [exporting, setExporting] = useState<boolean>(false);

  // Limits override state
  type Overrides = TenantPlanLimitOverrides;
  const [overrideLimits, setOverrideLimits] = useState<Overrides>({});
  const [clearKeys, setClearKeys] = useState<string[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoiceDTO[]>([]);
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [subRaw, setSubRaw] = useState<TenantSubscriptionRaw | null>(null);
  const [showInvitesAll, setShowInvitesAll] = useState(false);
  const [enforcing, setEnforcing] = useState(false);
  // Seçili tenant'ı son durum olarak takip etmek ve yarış durumlarını engellemek için ref
  const selectedIdRef = useRef<string>('');

  // Plan label normalize: 3'lü model (STARTER / PRO / BUSINESS)
  const normalizePlanLabel = (plan?: string): 'STARTER' | 'PRO' | 'BUSINESS' => {
    if (!plan) return 'STARTER';
    const p = String(plan).toLowerCase();
    if (p.includes('enterprise') || p === 'business') return 'BUSINESS';
    if (p.includes('professional') || p === 'pro') return 'PRO';
    return 'STARTER';
  };
  const planDisplayToApi = (display: string): 'basic' | 'professional' | 'enterprise' => {
    const d = String(display).toUpperCase();
    if (d === 'BUSINESS') return 'enterprise';
    if (d === 'PRO') return 'professional';
    return 'basic';
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await adminApi.getTenants();
        setTenants(Array.isArray(data) ? data : []);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 401) {
          setError('Admin girişi gerekli. Lütfen admin panelde oturum açın.');
        } else {
          setError('Şirket listesi alınamadı');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) =>
      ((t.companyName || t.name || '').toLowerCase().includes(q)) ||
      normalizePlanLabel(t.subscriptionPlan).toLowerCase().includes(q)
    );
  }, [tenants, search]);

  const loadOverview = async (tenantId: string) => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const o = await adminApi.getTenantOverview(tenantId);
      if (selectedIdRef.current !== tenantId) return; // tenant değişti, bu sonucu yok say
      setOverview(o);
      // initialize override edit state from payload
      setOverrideLimits(o?.limits?.overrides ?? {});
      setClearKeys([]);
      // Stripe abonelik ham verisi (plan + koltuk)
      try {
        const raw = await adminApi.getTenantSubscriptionRaw(tenantId);
        if (selectedIdRef.current !== tenantId) return; // tenant değişti
        setSubRaw(raw);
      } catch (e) {
        setSubRaw(null);
      }
      // load invoices
      try {
        const inv = await adminApi.getTenantInvoices(tenantId);
        if (selectedIdRef.current !== tenantId) return; // tenant değişti
        if (Array.isArray(inv?.invoices) && inv.invoices.length > 0) {
          setInvoices(inv.invoices);
        } else {
          // Fallback: yalnızca seçilen tenant aktif kullanıcı tenant'ı ise dene
          try {
            const hasUserToken = Boolean(readLegacyAuthToken());
            const meTenant = readLegacyTenantProfile<{ id?: string }>();
            if (hasUserToken && meTenant?.id === tenantId) {
              const alt = await userListInvoices(tenantId);
              if (selectedIdRef.current !== tenantId) return; // tenant değişti
              setInvoices(Array.isArray(alt?.invoices) ? alt.invoices : []);
            } else {
              setInvoices([]);
            }
          } catch {
            setInvoices([]);
          }
        }
      } catch (_) {
        // Son çare: kullanıcı endpointini yalnızca aynı tenant ise dene
        try {
          const hasUserToken = Boolean(readLegacyAuthToken());
          const meTenant = readLegacyTenantProfile<{ id?: string }>();
          if (hasUserToken && meTenant?.id === tenantId) {
            const alt = await userListInvoices(tenantId);
            if (selectedIdRef.current !== tenantId) return; // tenant değişti
            setInvoices(Array.isArray(alt?.invoices) ? alt.invoices : []);
          } else {
            setInvoices([]);
          }
        } catch {
          setInvoices([]);
        }
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const url = e?.config?.url || e?.response?.config?.url;
      if (typeof window !== 'undefined') {
        // Hatanın nedenini hızlı teşhis için konsola yaz
        console.error('Admin tenant overview error:', { status, url, data: e?.response?.data });
      }
      if (status === 401) {
        setError('Admin girişi gerekli. Lütfen admin panelde oturum açın.');
      } else {
        setError(`Özet alınamadı${status ? ` (HTTP ${status})` : ''}`);
      }
    } finally {
      // Yalnızca aktif tenant için loading'i kapat
      if (selectedIdRef.current === tenantId) setLoading(false);
    }
  };

  useEffect(() => {
    // Ref'i güncelle, eski veriyi temizle ve yeni tenant için yüklemeyi başlat
    selectedIdRef.current = selectedTenantId;
    setOverview(null);
    setInvoices([]);
    setSubRaw(null);
    setError('');
    setMessage('');
    if (selectedTenantId) loadOverview(selectedTenantId);
  }, [selectedTenantId]);

  const tenant = overview?.tenant;
  const limits = overview?.limits;
  const usage = overview?.usage;
  const users: TenantUser[] = overview?.users || [];
  const invites: TenantInvite[] = overview?.invites || [];
  const requiredReduction = Math.max(0, Number(tenant?.requiredUserReduction ?? 0));
  const effMaxUsers = Number(limits?.effective?.maxUsers ?? 0);
  const dynamicRemaining = Math.max(0, Number(usage?.users ?? 0) - Math.max(0, effMaxUsers));
  const remainingToReduce = Math.max(requiredReduction, dynamicRemaining);
  const deadlineIso = tenant?.downgradePendingUntil ? String(tenant.downgradePendingUntil) : '';
  const deadlineTs = deadlineIso ? new Date(deadlineIso).getTime() : 0;
  const nowTs = Date.now();
  const countdownSec = deadlineTs > nowTs ? Math.ceil((deadlineTs - nowTs)/1000) : 0;

  // Add user form state
  const [newUser, setNewUser] = useState<{ email: string; firstName: string; lastName: string; role: string; password: string; autoPassword: boolean; activate: boolean }>({
    email: '',
    firstName: '',
    lastName: '',
    role: 'user',
    password: '',
    autoPassword: true,
    activate: true,
  });
  const [createdTempPassword, setCreatedTempPassword] = useState<string>('');
  const submitNewUser = async () => {
    if (!selectedTenantId) return;
    if (!newUser.email) { setError('E-posta gerekli'); return; }
    try {
      setLoading(true);
      setError('');
      setMessage('');
      setCreatedTempPassword('');
      const payload: Parameters<typeof adminApi.addUserToTenant>[1] = {
        email: newUser.email,
        firstName: newUser.firstName || undefined,
        lastName: newUser.lastName || undefined,
        role: newUser.role || undefined,
        activate: newUser.activate,
        autoPassword: newUser.autoPassword,
      };
      if (!newUser.autoPassword && newUser.password) payload.password = newUser.password;
      const res = await adminApi.addUserToTenant(selectedTenantId, payload);
      if (res?.tempPassword) setCreatedTempPassword(res.tempPassword);
      setMessage('Kullanıcı eklendi/güncellendi');
      setTimeout(()=>setMessage(''), 2000);
      await loadOverview(selectedTenantId);
      setNewUser({ email: '', firstName: '', lastName: '', role: 'user', password: '', autoPassword: true, activate: true });
    } catch (e: any) {
      setError(e?.message || 'Kullanıcı ekleme başarısız');
    } finally {
      setLoading(false);
    }
  };

  // Editable tenant header state
  const [editTenantName, setEditTenantName] = useState<string>('');
  const [editTenantPlan, setEditTenantPlan] = useState<string>('');
  const [editTenantStatus, setEditTenantStatus] = useState<string>('');
  useEffect(() => {
    if (tenant) {
      setEditTenantName(tenant.companyName || tenant.name || '');
      setEditTenantPlan(normalizePlanLabel(tenant.subscriptionPlan));
      setEditTenantStatus(tenant.status || 'trial');
    }
  }, [tenant?.id]);

  const saveTenantHeader = async () => {
    if (!selectedTenantId) return;
    try {
      setLoading(true);
      // Update name/companyName
      await adminApi.updateTenantDetails(selectedTenantId, { companyName: editTenantName });
      // Update plan/status
      await adminApi.updateTenantSubscription(selectedTenantId, {
        plan: planDisplayToApi(editTenantPlan),
        status: editTenantStatus,
      });
      setMessage('Şirket bilgileri güncellendi');
      setTimeout(()=>setMessage(''), 2000);
      await loadOverview(selectedTenantId);
    } catch (e) {
      setError('Şirket bilgileri güncellenemedi');
    } finally {
      setLoading(false);
    }
  };

  // Users inline edit state
  type UserEdit = { firstName?: string; lastName?: string; email?: string; role?: string };
  const [userEdits, setUserEdits] = useState<Record<string, UserEdit>>({});
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const startEditUser = (u: TenantUser) => {
    setUserEdits(prev => ({ ...prev, [u.id]: { firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role } }));
  };
  const cancelEditUser = (userId: string) => {
    setUserEdits(prev => { const next = { ...prev }; delete next[userId]; return next; });
  };
  const updateEditUserField = (userId: string, field: keyof UserEdit, value: string) => {
    setUserEdits(prev => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }));
  };
  const saveUserRow = async (userId: string) => {
    const payload = userEdits[userId];
    if (!payload) return;
    try {
      setLoading(true);
      await adminApi.updateUserDetails(userId, payload);
      setMessage('Kullanıcı güncellendi');
      setTimeout(()=>setMessage(''), 2000);
      await loadOverview(selectedTenantId);
      cancelEditUser(userId);
    } catch (e) {
      setError('Kullanıcı güncellenemedi');
    } finally {
      setLoading(false);
    }
  };

  const updateOverride = (patch: Partial<Overrides>) => {
    setOverrideLimits(prev => {
      const next: Overrides = { ...prev, ...patch };
      if (patch.monthly) {
        next.monthly = { ...(prev.monthly || {}), ...patch.monthly };
      }
      return next;
    });
  };

  const markClear = (key: string) => {
    setClearKeys(prev => (prev.includes(key) ? prev : [...prev, key]));
    if (key.startsWith('monthly.')) {
      const [, child] = key.split('.');
      setOverrideLimits(prev => {
        const nextMonthly = { ...(prev.monthly || {}) };
        if (child && child in nextMonthly) {
          delete nextMonthly[child as keyof typeof nextMonthly];
        }
        const next = { ...prev };
        if (Object.keys(nextMonthly).length > 0) {
          next.monthly = nextMonthly;
        } else {
          delete next.monthly;
        }
        return next;
      });
      return;
    }
    setOverrideLimits(prev => {
      const next = { ...prev };
      if (key in next) {
        delete next[key as keyof Overrides];
      }
      return next;
    });
  };

  const saveOverrides = async () => {
    if (!selectedTenantId) return;
    try {
      setLoading(true);
      const payload: (Overrides & { __clear?: string[] }) = { ...overrideLimits };
      if (clearKeys.length) payload.__clear = clearKeys;
      await adminApi.updateTenantLimits(selectedTenantId, payload);
      setMessage('Limitler kaydedildi');
      setTimeout(() => setMessage(''), 2000);
      await loadOverview(selectedTenantId);
    } catch (e) {
      setError('Limitleri kaydetme başarısız');
    } finally {
      setLoading(false);
    }
  };

  const clearAllOverrides = async () => {
    if (!selectedTenantId) return;
    try {
      setLoading(true);
      await adminApi.updateTenantLimits(selectedTenantId, { __clearAll: true });
      setOverrideLimits({});
      setClearKeys([]);
      setMessage('Override’lar temizlendi');
      setTimeout(() => setMessage(''), 2000);
      await loadOverview(selectedTenantId);
    } catch (e) {
      setError('Temizleme başarısız');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserActive = async (userId: string, isActive: boolean) => {
    try {
      setLoading(true);
      await adminApi.updateUserStatus(userId, !isActive);
      setMessage(isActive ? 'Kullanıcı pasifleştirildi' : 'Kullanıcı aktifleştirildi');
      setTimeout(() => setMessage(''), 2000);
      await loadOverview(selectedTenantId);
    } catch (e) {
      setError('Kullanıcı durumu değiştirilemedi');
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async (userId: string) => {
    try {
      setLoading(true);
      await adminApi.sendPasswordReset(userId);
      setMessage('Şifre sıfırlama e-postası gönderildi (simülasyon)');
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      setError('Şifre sıfırlama gönderilemedi');
    } finally {
      setLoading(false);
    }
  };

  const exportUsersCsv = async () => {
    if (!selectedTenantId) return;
    try {
      setExporting(true);
      const blob = await adminApi.exportUsersCsv(selectedTenantId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (tenant?.companyName || tenant?.name || selectedTenantId || 'users')
        .toString()
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .slice(0, 50);
      a.href = url;
      a.download = `kullanicilar_${safeName}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError('CSV dışa aktarma başarısız');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex gap-4">
      {/* Sol: şirket listesi + arama */}
      <div className="w-full md:w-72 bg-white border border-gray-200 rounded-lg p-3 h-fit">
        <div className="mb-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Şirket ara"
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTenantId(t.id)}
              className={`w-full text-left px-2 py-2 hover:bg-gray-50 ${selectedTenantId===t.id?'bg-gray-100':''}`}
            >
              <div className="font-medium text-sm">{t.companyName || t.name}</div>
              <div className="text-xs text-gray-500">{normalizePlanLabel(t.subscriptionPlan)} · {t.status}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Sağ: konsol */}
      <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4">
        {!selectedTenantId ? (
          <div className="text-sm text-gray-600">Soldan bir şirket seçin</div>
        ) : loading && !overview ? (
          <div className="text-sm text-gray-600">Yükleniyor…</div>
        ) : overview ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <input
                    value={editTenantName}
                    onChange={(e)=>setEditTenantName(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded w-64"
                    placeholder="Şirket adı"
                  />
                  <select
                    value={editTenantPlan}
                    onChange={(e)=>setEditTenantPlan(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded"
                  >
                    <option value="STARTER">STARTER</option>
                    <option value="PRO">PRO</option>
                    <option value="BUSINESS">BUSINESS</option>
                  </select>
                  <select
                    value={editTenantStatus}
                    onChange={(e)=>setEditTenantStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded"
                  >
                    <option value="active">active</option>
                    <option value="trial">trial</option>
                    <option value="suspended">suspended</option>
                    <option value="expired">expired</option>
                  </select>
                  <button onClick={saveTenantHeader} className="px-3 py-2 bg-blue-600 text-white rounded">Kaydet</button>
                </div>
                <div className="text-xs text-gray-600">Plan: {normalizePlanLabel(tenant?.subscriptionPlan)} · Durum: {tenant?.status}</div>
              </div>
              {message && (
                <div className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded">{message}</div>
              )}
            </div>

            {/* Kullanım istatistikleri */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Info title="Kullanıcı" value={usage?.users} max={limits?.effective?.maxUsers} />
              <Info title="Müşteri" value={usage?.customers} max={limits?.effective?.maxCustomers} />
              <Info title="Tedarikçi" value={usage?.suppliers} max={limits?.effective?.maxSuppliers} />
              <Info title="Banka" value={usage?.bankAccounts} max={limits?.effective?.maxBankAccounts} />
              <Info title="Fatura (Ay)" value={usage?.monthly?.invoices} max={limits?.effective?.monthly?.maxInvoices} />
              <Info title="Gider (Ay)" value={usage?.monthly?.expenses} max={limits?.effective?.monthly?.maxExpenses} />
            </div>

            {/* Plan düşürme uyarısı */}
            {remainingToReduce > 0 && (
              <div className="border border-amber-300 bg-amber-50 text-amber-800 rounded-lg p-3">
                <div className="text-sm">
                  <span className="font-semibold">Plan düşürme uyarısı:</span>
                  {' '}Bu şirkette aktif kullanıcı sayısı etkili limitin üzerinde.
                </div>
                <div className="text-xs mt-1 text-amber-900">
                  Pasifleştirmeniz gereken kullanıcı sayısı: <span className="font-semibold">{remainingToReduce}</span>
                  {deadlineTs ? (
                    <>
                      {' '}· Son tarih: <span className="font-mono">{new Date(deadlineTs).toLocaleString()}</span>
                      {countdownSec > 0 && (<span> · Kalan: {formatDuration(countdownSec)}</span>)}
                    </>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="px-3 py-1.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                    disabled={enforcing || !selectedTenantId}
                    onClick={async ()=>{
                      if (!selectedTenantId) return;
                      const ok = window.confirm('Fazla kullanıcıları rastgele pasifleştirmek istediğinize emin misiniz? (tenant_admin/super_admin hariç)');
                      if (!ok) return;
                      try {
                        setEnforcing(true);
                        const res = await adminApi.enforceTenantDowngrade(selectedTenantId);
                        setMessage(`Uygulandı: ${res?.enforced ?? 0}`);
                        setTimeout(()=>setMessage(''), 2000);
                        await loadOverview(selectedTenantId);
                      } catch (e) {
                        setError('Uygulama başarısız');
                      } finally {
                        setEnforcing(false);
                      }
                    }}
                  >{enforcing ? 'Uygulanıyor…' : 'Fazlayı Otomatik Pasifleştir'}</button>
                  <span className="text-[11px] text-amber-900">Alternatif: Aşağıdaki listeden kullanıcıları tek tek pasifleştirin.</span>
                </div>
              </div>
            )}

            {/* Stripe abonelik özeti (teşhis için) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card title="Stripe Abonelik Özeti">
                {subRaw ? (
                  <div className="text-xs text-gray-700 space-y-1">
                    <div><span className="text-gray-500">subscriptionId:</span> {subRaw.subscriptionId || '—'}</div>
                    <div><span className="text-gray-500">status:</span> {subRaw.status || '—'}</div>
                    <div><span className="text-gray-500">interval:</span> {subRaw.interval || '—'}</div>
                    <div><span className="text-gray-500">plan (remote):</span> {String(subRaw.plan || '').toUpperCase() || '—'}</div>
                    <div><span className="text-gray-500">baseIncluded:</span> {subRaw.baseIncluded ?? '—'}</div>
                    <div><span className="text-gray-500">addonQty:</span> {subRaw.addonQty ?? 0}</div>
                    <div><span className="text-gray-500">computedSeats (remote):</span> <span className="font-semibold">{subRaw.computedSeats ?? '—'}</span></div>
                    <div className="mt-2 border-t pt-2">
                      <div><span className="text-gray-500">stripeCustomerId:</span> {overview?.tenant?.stripeCustomerId || '—'}</div>
                      <div><span className="text-gray-500">stripeSubscriptionId:</span> {overview?.tenant?.stripeSubscriptionId || '—'}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">Stripe abonelik bilgisi alınamadı.</div>
                )}
              </Card>
            </div>

            {/* Limits: edit overrides */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card title="Plan Varsayılanları"><pre className="text-xs overflow-auto">{JSON.stringify(limits?.default,null,2)}</pre></Card>
              <div className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Override</div>
                  <div className="flex items-center gap-2">
                    <button onClick={clearAllOverrides} className="px-2 py-1 text-xs border rounded">Override’ları Temizle</button>
                    <button onClick={saveOverrides} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Kaydet</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Maks. Kullanıcı" value={overrideLimits.maxUsers} onChange={(v)=>updateOverride({maxUsers:v})} onClear={()=>markClear('maxUsers')} />
                  <Field label="Maks. Müşteri" value={overrideLimits.maxCustomers} onChange={(v)=>updateOverride({maxCustomers:v})} onClear={()=>markClear('maxCustomers')} />
                  <Field label="Maks. Tedarikçi" value={overrideLimits.maxSuppliers} onChange={(v)=>updateOverride({maxSuppliers:v})} onClear={()=>markClear('maxSuppliers')} />
                  <Field label="Maks. Banka Hesabı" value={overrideLimits.maxBankAccounts} onChange={(v)=>updateOverride({maxBankAccounts:v})} onClear={()=>markClear('maxBankAccounts')} />
                  <Field label="Aylık Maks. Fatura" value={overrideLimits.monthly?.maxInvoices} onChange={(v)=>updateOverride({monthly:{maxInvoices:v}})} onClear={()=>markClear('monthly.maxInvoices')} />
                  <Field label="Aylık Maks. Gider" value={overrideLimits.monthly?.maxExpenses} onChange={(v)=>updateOverride({monthly:{maxExpenses:v}})} onClear={()=>markClear('monthly.maxExpenses')} />
                </div>
              </div>
              <Card title="Efektif"><pre className="text-xs overflow-auto">{JSON.stringify(limits?.effective,null,2)}</pre></Card>
            </div>

            {/* Kullanıcılar */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-3 py-2 border-b font-medium flex items-center justify-between">
                <span>Kullanıcılar</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportUsersCsv}
                    disabled={exporting || !selectedTenantId}
                    className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
                  >{exporting ? 'İndiriliyor…' : 'CSV İndir'}</button>
                  {createdTempPassword && (
                    <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded">
                      Geçici şifre: <span className="font-mono font-semibold">{createdTempPassword}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="max-h-[40vh] overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={users.length>0 && selectedUserIds.size>0 && users.every((u)=> selectedUserIds.has(u.id))}
                          onChange={(e)=>{
                            const next = new Set<string>();
                            if (e.target.checked) {
                              users.forEach((u)=> next.add(u.id));
                            }
                            setSelectedUserIds(next);
                          }}
                        />
                      </th>
                      <th className="px-3 py-2 text-left">Ad Soyad</th>
                      <th className="px-3 py-2 text-left">E-posta</th>
                      <th className="px-3 py-2 text-left">Rol</th>
                      <th className="px-3 py-2 text-left">Durum</th>
                      <th className="px-3 py-2 text-left">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Add user row */}
                    <tr className="border-t bg-gray-50/60">
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <input value={newUser.firstName} onChange={(e)=>setNewUser(prev=>({...prev, firstName:e.target.value}))} className="px-2 py-1 border border-gray-300 rounded w-28" placeholder="Ad" />
                          <input value={newUser.lastName} onChange={(e)=>setNewUser(prev=>({...prev, lastName:e.target.value}))} className="px-2 py-1 border border-gray-300 rounded w-28" placeholder="Soyad" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input value={newUser.email} onChange={(e)=>setNewUser(prev=>({...prev, email:e.target.value}))} className="px-2 py-1 border border-gray-300 rounded w-60" placeholder="email@ornek.com" />
                        <div className="mt-1 flex items-center gap-2">
                          <label className="text-[11px] text-gray-600 flex items-center gap-1">
                            <input type="checkbox" checked={newUser.autoPassword} onChange={(e)=>setNewUser(prev=>({...prev, autoPassword:e.target.checked}))} />
                            Otomatik şifre
                          </label>
                          {!newUser.autoPassword && (
                            <input value={newUser.password} onChange={(e)=>setNewUser(prev=>({...prev, password:e.target.value}))} className="px-2 py-1 border border-gray-300 rounded w-40" placeholder="Parola (>=8)" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <select value={newUser.role} onChange={(e)=>setNewUser(prev=>({...prev, role:e.target.value}))} className="px-2 py-1 border border-gray-300 rounded">
                          <option value="user">user</option>
                          <option value="accountant">accountant</option>
                          <option value="tenant_admin">tenant_admin</option>
                          <option value="super_admin">super_admin</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <label className="text-xs flex items-center gap-2">
                          <input type="checkbox" checked={newUser.activate} onChange={(e)=>setNewUser(prev=>({...prev, activate:e.target.checked}))} />
                          Aktif
                        </label>
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={submitNewUser} className="px-2 py-1 text-xs bg-green-600 text-white rounded">Ekle</button>
                      </td>
                    </tr>
                    {users.map((u) => {
                      const edit = userEdits[u.id];
                      return (
                        <tr key={u.id} className="border-t">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.has(u.id)}
                              onChange={(e)=>{
                                setSelectedUserIds(prev=>{
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(u.id); else next.delete(u.id);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {edit ? (
                              <div className="flex gap-2">
                                <input value={edit.firstName || ''} onChange={(e)=>updateEditUserField(u.id,'firstName', e.target.value)} className="px-2 py-1 border border-gray-300 rounded w-28" placeholder="Ad" />
                                <input value={edit.lastName || ''} onChange={(e)=>updateEditUserField(u.id,'lastName', e.target.value)} className="px-2 py-1 border border-gray-300 rounded w-28" placeholder="Soyad" />
                              </div>
                            ) : (
                              <>{u.firstName} {u.lastName}</>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {edit ? (
                              <input value={edit.email || ''} onChange={(e)=>updateEditUserField(u.id,'email', e.target.value)} className="px-2 py-1 border border-gray-300 rounded w-60" />
                            ) : u.email}
                          </td>
                          <td className="px-3 py-2">
                            {edit ? (
                              <select value={edit.role || 'user'} onChange={(e)=>updateEditUserField(u.id,'role', e.target.value)} className="px-2 py-1 border border-gray-300 rounded">
                                <option value="user">user</option>
                                <option value="accountant">accountant</option>
                                <option value="tenant_admin">tenant_admin</option>
                                <option value="super_admin">super_admin</option>
                              </select>
                            ) : (
                              u.role
                            )}
                          </td>
                          <td className="px-3 py-2">{u.isActive ? 'Aktif' : 'Pasif'}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {edit ? (
                                <>
                                  <button onClick={()=>saveUserRow(u.id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Kaydet</button>
                                  <button onClick={()=>cancelEditUser(u.id)} className="px-2 py-1 text-xs border rounded">İptal</button>
                                </>
                              ) : (
                                <button onClick={()=>startEditUser(u)} className="px-2 py-1 text-xs border rounded">Düzenle</button>
                              )}
                              <button onClick={()=>toggleUserActive(u.id, u.isActive)} className={`px-2 py-1 text-xs rounded ${u.isActive?'bg-red-600 text-white':'bg-green-600 text-white'}`}>{u.isActive?'Pasifleştir':'Aktifleştir'}</button>
                              <button onClick={()=>sendReset(u.id)} className="px-2 py-1 text-xs border rounded">Şifre Sıfırla</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {selectedUserIds.size > 0 && (
                <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between">
                  <div className="text-xs text-gray-700">Seçili: <span className="font-semibold">{selectedUserIds.size}</span></div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                      onClick={async ()=>{
                        const list = users.filter((u)=> selectedUserIds.has(u.id) && u.isActive);
                        if (list.length === 0) { setError('Seçilenlerde aktif kullanıcı yok'); return; }
                        const sure = window.confirm(`${list.length} kullanıcı pasifleştirilsin mi?`);
                        if (!sure) return;
                        try {
                          setLoading(true);
                          for (const u of list) {
                            await adminApi.updateUserStatus(u.id, false);
                          }
                          setMessage(`${list.length} kullanıcı pasifleştirildi`);
                          setTimeout(()=>setMessage(''), 2000);
                          setSelectedUserIds(new Set());
                          await loadOverview(selectedTenantId);
                        } catch (e) {
                          setError('Toplu pasifleştirme başarısız');
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >Seçilenleri Pasifleştir</button>
                    <button
                      className="px-3 py-1.5 text-xs rounded border"
                      onClick={()=> setSelectedUserIds(new Set())}
                    >Seçimi Temizle</button>
                  </div>
                </div>
              )}
            </div>

            {/* Davetler */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-3 py-2 border-b font-medium flex items-center justify-between">
                <span>Davetler</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => selectedTenantId && loadOverview(selectedTenantId)}
                    className="px-2 py-1 text-xs border rounded"
                  >Yenile</button>
                  {invites.length > 8 && (
                    <button
                      onClick={() => setShowInvitesAll((p)=>!p)}
                      className="px-2 py-1 text-xs bg-indigo-600 text-white rounded"
                    >{showInvitesAll ? 'Daralt' : 'Tümü'}</button>
                  )}
                </div>
              </div>
              {invites.length === 0 ? (
                <div className="p-3 text-sm text-gray-600">Görüntülenecek davet yok.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">E-posta</th>
                        <th className="px-3 py-2 text-left">Rol</th>
                        <th className="px-3 py-2 text-left">Durum</th>
                        <th className="px-3 py-2 text-left">Oluşturulma</th>
                        <th className="px-3 py-2 text-left">Son Tarih</th>
                        <th className="px-3 py-2 text-left">Organizasyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showInvitesAll ? invites : invites.slice(0,8)).map((iv) => {
                        const createdAt = iv.createdAt ? new Date(iv.createdAt) : null;
                        const expiresAt = iv.expiresAt ? new Date(iv.expiresAt) : null;
                        const acceptedAt = iv.acceptedAt ? new Date(iv.acceptedAt) : null;
                        const now = new Date();
                        const status = acceptedAt
                          ? 'Kabul edildi'
                          : (expiresAt && expiresAt < now)
                            ? 'Süresi doldu'
                            : 'Beklemede';
                        const badgeClass = status === 'Kabul edildi'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : status === 'Beklemede'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-red-700 border border-red-200';
                        return (
                          <tr key={iv.id} className="border-t">
                            <td className="px-3 py-2">{iv.email}</td>
                            <td className="px-3 py-2">{iv.role || 'MEMBER'}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>{status}</span>
                            </td>
                            <td className="px-3 py-2">{createdAt ? createdAt.toLocaleString() : '—'}</td>
                            <td className="px-3 py-2">{expiresAt ? expiresAt.toLocaleString() : '—'}</td>
                            <td className="px-3 py-2">{iv.organizationName || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Fatura Geçmişi */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-3 py-2 border-b font-medium">Fatura Geçmişi</div>
              <div className="overflow-x-auto">
                {invoices.length === 0 ? (
                  <div className="p-3 text-sm text-gray-600 space-y-2">
                    <div className="font-medium text-gray-700">Fatura bulunamadı</div>
                    <div>Olası nedenler:</div>
                    <ul className="list-disc pl-5 space-y-1 text-xs">
                      <li>Henüz Stripe müşteri oluşturulmadı (ilk upgrade / ödeme işlemi yapılmadı).</li>
                      <li>Aktif abonelik yok: subscription planı test veya başlangıç aşamasında olabilir.</li>
                      <li>Test modunda hiç fatura kesilmedi; yalnızca proration oluşmuş olabilir.</li>
                      <li>Stripe API'den boş döndü; dashboarddan manuel kontrol edin.</li>
                    </ul>
                    <div className="text-xs mt-2 border-t pt-2">
                      <div><span className="font-semibold">stripeCustomerId:</span> {overview?.tenant?.stripeCustomerId || '—'}</div>
                      <div><span className="font-semibold">stripeSubscriptionId:</span> {overview?.tenant?.stripeSubscriptionId || '—'}</div>
                    </div>
                  </div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Numara</th>
                        <th className="px-3 py-2 text-left">Tarih</th>
                        <th className="px-3 py-2 text-left">Tutar</th>
                        <th className="px-3 py-2 text-left">Durum</th>
                        <th className="px-3 py-2 text-left">Bağlantılar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllInvoices ? invoices : invoices.slice(0,8)).map((inv) => (
                        <tr key={inv.id} className="border-t">
                          <td className="px-3 py-2">{inv.number || inv.id}</td>
                          <td className="px-3 py-2">{inv.created ? new Date(inv.created).toLocaleDateString() : '-'}</td>
                          <td className="px-3 py-2">{typeof inv.total === 'number' ? `${(inv.total/100).toLocaleString(undefined,{ minimumFractionDigits:2 })} ${String(inv.currency||'').toUpperCase()}` : '-'}</td>
                          <td className="px-3 py-2">
                            <span className={(() => {
                              const s = String(inv.status||'').toLowerCase();
                              if (s === 'paid') return 'inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200';
                              if (s === 'open' || s === 'draft') return 'inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200';
                              if (s === 'uncollectible' || s === 'void' || s === 'unpaid') return 'inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200';
                              return 'inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200';
                            })()}>{(inv.status || (inv.paid ? 'paid' : '-')).toUpperCase()}</span>
                          </td>
                          <td className="px-3 py-2 space-x-2">
                            {inv.hostedInvoiceUrl && <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Görüntüle</a>}
                            {inv.pdf && <a href={inv.pdf} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">PDF</a>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {invoices.length > 8 && (
                <div className="p-3 border-t flex justify-center">
                  <button
                    onClick={()=> setShowAllInvoices(prev=>!prev)}
                    className="px-4 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  >{showAllInvoices? 'Daralt' : 'Tümü'}</button>
                </div>
              )}
            </div>
          </div>
        ) : null}
        {error && <div className="mt-3 p-2 bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
      </div>
    </div>
  );
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border border-gray-200 rounded-lg p-3">
    <div className="font-medium mb-2">{title}</div>
    {children}
  </div>
);

const Info: React.FC<{ title: string; value: number; max?: number }> = ({ title, value, max }) => {
  const displayMax = typeof max === 'number' ? (max < 0 ? '∞' : max) : undefined;
  return (
    <div className="border rounded p-3 text-center">
      <div className="text-xl font-semibold">{value ?? 0}{displayMax !== undefined ? ` / ${displayMax}`: ''}</div>
      <div className="text-xs text-gray-600">{title}</div>
    </div>
  );
};

export default TenantConsolePage;

// Small form field with clear
const Field: React.FC<{ label: string; value?: number; onChange: (v:number)=>void; onClear: ()=>void }> = ({ label, value, onChange, onClear }) => {
  const [text, setText] = useState<string>(value===undefined? '': String(value));
  useEffect(()=>{ setText(value===undefined? '': String(value)); },[value]);
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        value={text}
        onChange={(e)=> setText(e.target.value)}
        onBlur={()=>{
          if (text==='') return; // boş = varsayılan
          const n = parseInt(text,10);
          if (isNaN(n)) { setText(value===undefined? '': String(value)); return; }
          onChange(n);
        }}
        placeholder="Boş = varsayılan"
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
      />
      <div className="mt-1">
        <button onClick={onClear} className="text-xs text-gray-600 underline">Temizle</button>
      </div>
    </div>
  );
};

// Yardımcı: saniyeyi okunur süreye çevir
function formatDuration(totalSec: number) {
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}g`);
  if (h) parts.push(`${h}s`);
  if (m) parts.push(`${m}d`);
  if (s && parts.length === 0) parts.push(`${s}sn`);
  return parts.join(' ');
}

import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/admin';
import type {
  AdminTenantSummary,
  TenantPlanLimits,
  TenantPlanLimitOverrides,
  TenantUsage,
} from '../../types/admin';

const NumberField: React.FC<{
  value: number | undefined;
  onChange: (v: number) => void;
  label: string;
  hint?: string;
}> = ({ value, onChange, label, hint }) => {
  const [text, setText] = useState(String(value ?? ''));
  useEffect(() => setText(value === undefined ? '' : String(value)), [value]);
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text === '') return; // boş bırakılırsa değiştirme
          const num = parseInt(text, 10);
          if (isNaN(num)) return setText(String(value ?? ''));
          onChange(num);
        }}
        placeholder="Plan varsayılana bırakmak için boş bırakın"
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
      />
      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  );
};

const StatBox: React.FC<{ title: string; value: number; max?: number }> = ({ title, value, max }) => {
  const limited = typeof max === 'number' && max !== -1;
  const over = limited && value >= (max as number);
  return (
    <div className={`rounded-lg p-4 text-center border ${over ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className={`text-2xl font-bold ${over ? 'text-red-600' : 'text-gray-700'}`}>{value}{limited ? ` / ${max}` : ''}</div>
      <div className="text-sm text-gray-600">{title}</div>
    </div>
  );
};

const TenantLimitsPage: React.FC = () => {
  const [tenants, setTenants] = useState<AdminTenantSummary[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const [defaultLimits, setDefaultLimits] = useState<TenantPlanLimits | null>(null);
  type Overrides = TenantPlanLimitOverrides;
  const [overrideLimits, setOverrideLimits] = useState<Overrides>({});
  const [effectiveLimits, setEffectiveLimits] = useState<TenantPlanLimits | null>(null);
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [clearKeys, setClearKeys] = useState<string[]>([]);
  const [tenantSearch, setTenantSearch] = useState<string>('');

  const selectedTenant = useMemo(() => tenants.find(t => t.id === selectedTenantId), [tenants, selectedTenantId]);
  const filteredTenants = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(t =>
      ((t.companyName || t.name || '').toLowerCase().includes(q)) ||
      (t.subscriptionPlan || '').toLowerCase().includes(q)
    );
  }, [tenants, tenantSearch]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getTenants();
      setTenants(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError('Şirket listesi alınamadı');
    } finally {
      setLoading(false);
    }
  };

  const loadTenantLimits = async (tenantId: string) => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const resp = await adminApi.getTenantLimits(tenantId);
      const limits = resp?.limits;
      setDefaultLimits(limits?.default ?? null);
      setOverrideLimits(limits?.overrides ?? {});
      setEffectiveLimits(limits?.effective ?? null);
      setUsage(resp?.usage ?? null);
    } catch (e) {
      console.error(e);
      setError('Limit bilgileri alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    if (selectedTenantId) loadTenantLimits(selectedTenantId);
  }, [selectedTenantId]);

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
      const payload: Overrides & { __clear?: string[] } = { ...overrideLimits };
      if (clearKeys.length) payload.__clear = clearKeys;
      await adminApi.updateTenantLimits(selectedTenantId, payload);
      setMessage('Kaydedildi');
      setTimeout(() => setMessage(''), 2000);
      setClearKeys([]);
      loadTenantLimits(selectedTenantId);
    } catch (e) {
      console.error(e);
      setError('Güncelleme başarısız');
    } finally {
      setLoading(false);
    }
  };

  const resetToPlanDefaults = async () => {
    if (!selectedTenantId) return;
    try {
      setLoading(true);
      await adminApi.updateTenantLimits(selectedTenantId, { __clearAll: true });
      setOverrideLimits({});
      setClearKeys([]);
      setMessage('Override’lar temizlendi');
      setTimeout(() => setMessage(''), 2000);
      loadTenantLimits(selectedTenantId);
    } catch (e) {
      console.error(e);
      setError('Temizleme başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">🎛️ Tenant Limitleri</h2>
        {message && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded">{message}</div>
        )}
      </div>
      <p className="text-sm text-gray-600 mb-4">Bir şirket seçin; plan varsayılanları, override ve efektif limitleri görün. Tenant bazında override vererek (ör. +1 kullanıcı, +5 fatura) esneklik tanımlayın. Boş alanlar plan varsayılanını kullanır.</p>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm text-gray-600">Şirket:</span>
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[260px]"
          >
            <option value="">Seçin…</option>
            {filteredTenants.map(t => (
              <option key={t.id} value={t.id}>{t.companyName || t.name} ({t.subscriptionPlan})</option>
            ))}
          </select>
          <input
            type="text"
            value={tenantSearch}
            onChange={(e) => setTenantSearch(e.target.value)}
            placeholder="Ara: şirket adı/plan"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full md:w-72"
          />
          {tenantSearch && (
            <button onClick={() => setTenantSearch('')} className="text-xs text-gray-600 underline">Temizle</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToPlanDefaults}
            disabled={!defaultLimits}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            Override’ları Temizle
          </button>
          <button
            onClick={saveOverrides}
            disabled={!selectedTenantId || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Kaydet
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
      )}

      {selectedTenant && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Plan Varsayılanları</h3>
            {!defaultLimits ? (
              <div className="text-sm text-gray-500">Yükleniyor…</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Maks. Kullanıcı</div>
                  <div className="text-sm">{defaultLimits.maxUsers}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Maks. Müşteri</div>
                  <div className="text-sm">{defaultLimits.maxCustomers}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Maks. Tedarikçi</div>
                  <div className="text-sm">{defaultLimits.maxSuppliers}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Maks. Banka Hesabı</div>
                  <div className="text-sm">{defaultLimits.maxBankAccounts}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Aylık Maks. Fatura</div>
                  <div className="text-sm">{defaultLimits.monthly.maxInvoices}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Aylık Maks. Gider</div>
                  <div className="text-sm">{defaultLimits.monthly.maxExpenses}</div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Override (Tenant Özel)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <NumberField
                  label="Maks. Kullanıcı"
                  value={overrideLimits.maxUsers}
                  onChange={(v) => updateOverride({ maxUsers: v })}
                  hint="-1 = Sınırsız, boş = plan varsayılanı"
                />
                <div className="mt-1">
                  <button onClick={() => markClear('maxUsers')} className="text-xs text-gray-600 underline">Temizle</button>
                </div>
              </div>
              <div>
                <NumberField
                  label="Maks. Müşteri"
                  value={overrideLimits.maxCustomers}
                  onChange={(v) => updateOverride({ maxCustomers: v })}
                  hint="-1 = Sınırsız, boş = plan varsayılanı"
                />
                <div className="mt-1">
                  <button onClick={() => markClear('maxCustomers')} className="text-xs text-gray-600 underline">Temizle</button>
                </div>
              </div>
              <div>
                <NumberField
                  label="Maks. Tedarikçi"
                  value={overrideLimits.maxSuppliers}
                  onChange={(v) => updateOverride({ maxSuppliers: v })}
                  hint="-1 = Sınırsız, boş = plan varsayılanı"
                />
                <div className="mt-1">
                  <button onClick={() => markClear('maxSuppliers')} className="text-xs text-gray-600 underline">Temizle</button>
                </div>
              </div>
              <div>
                <NumberField
                  label="Maks. Banka Hesabı"
                  value={overrideLimits.maxBankAccounts}
                  onChange={(v) => updateOverride({ maxBankAccounts: v })}
                  hint="-1 = Sınırsız, boş = plan varsayılanı"
                />
                <div className="mt-1">
                  <button onClick={() => markClear('maxBankAccounts')} className="text-xs text-gray-600 underline">Temizle</button>
                </div>
              </div>
              <div>
                <NumberField
                  label="Aylık Maks. Fatura"
                  value={overrideLimits.monthly?.maxInvoices}
                  onChange={(v) => updateOverride({ monthly: { maxInvoices: v } })}
                  hint="-1 = Sınırsız, boş = plan varsayılanı"
                />
                <div className="mt-1">
                  <button onClick={() => markClear('monthly.maxInvoices')} className="text-xs text-gray-600 underline">Temizle</button>
                </div>
              </div>
              <div>
                <NumberField
                  label="Aylık Maks. Gider"
                  value={overrideLimits.monthly?.maxExpenses}
                  onChange={(v) => updateOverride({ monthly: { maxExpenses: v } })}
                  hint="-1 = Sınırsız, boş = plan varsayılanı"
                />
                <div className="mt-1">
                  <button onClick={() => markClear('monthly.maxExpenses')} className="text-xs text-gray-600 underline">Temizle</button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Efektif Limitler</h3>
            {!effectiveLimits ? (
              <div className="text-sm text-gray-500">Yükleniyor…</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Maks. Kullanıcı</div>
                  <div className="text-sm">{effectiveLimits.maxUsers}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Maks. Müşteri</div>
                  <div className="text-sm">{effectiveLimits.maxCustomers}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Maks. Tedarikçi</div>
                  <div className="text-sm">{effectiveLimits.maxSuppliers}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Maks. Banka Hesabı</div>
                  <div className="text-sm">{effectiveLimits.maxBankAccounts}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Aylık Maks. Fatura</div>
                  <div className="text-sm">{effectiveLimits.monthly.maxInvoices}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Aylık Maks. Gider</div>
                  <div className="text-sm">{effectiveLimits.monthly.maxExpenses}</div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Kullanım</h3>
            {!usage ? (
              <div className="text-sm text-gray-500">Yükleniyor…</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatBox title="Kullanıcı" value={usage.users} max={effectiveLimits?.maxUsers} />
                <StatBox title="Müşteri" value={usage.customers} max={effectiveLimits?.maxCustomers} />
                <StatBox title="Tedarikçi" value={usage.suppliers} max={effectiveLimits?.maxSuppliers} />
                <StatBox title="Banka Hesabı" value={usage.bankAccounts} max={effectiveLimits?.maxBankAccounts} />
                <StatBox title="Aylık Fatura" value={usage.monthly?.invoices || 0} max={effectiveLimits?.monthly?.maxInvoices} />
                <StatBox title="Aylık Gider" value={usage.monthly?.expenses || 0} max={effectiveLimits?.monthly?.maxExpenses} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantLimitsPage;

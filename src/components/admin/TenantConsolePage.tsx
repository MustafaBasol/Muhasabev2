import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/admin';

// A unified admin console per-tenant
const TenantConsolePage: React.FC = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  // Limits override state
  type Limits = {
    maxUsers: number;
    maxCustomers: number;
    maxSuppliers: number;
    maxBankAccounts: number;
    monthly: { maxInvoices: number; maxExpenses: number };
  };
  type Overrides = Partial<Omit<Limits, 'monthly'>> & { monthly?: Partial<Limits['monthly']> };
  const [overrideLimits, setOverrideLimits] = useState<Overrides>({});
  const [clearKeys, setClearKeys] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await adminApi.getTenants();
        setTenants(data || []);
      } catch (e) {
        setError('Şirket listesi alınamadı');
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
      (t.subscriptionPlan || '').toLowerCase().includes(q)
    );
  }, [tenants, search]);

  const loadOverview = async (tenantId: string) => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const o = await adminApi.getTenantOverview(tenantId);
      setOverview(o);
      // initialize override edit state from payload
      setOverrideLimits(o?.limits?.overrides || {});
      setClearKeys([]);
    } catch (e) {
      setError('Özet alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTenantId) loadOverview(selectedTenantId);
  }, [selectedTenantId]);

  const tenant = overview?.tenant;
  const limits = overview?.limits;
  const usage = overview?.usage;
  const users = overview?.users || [];

  // Editable tenant header state
  const [editTenantName, setEditTenantName] = useState<string>('');
  const [editTenantPlan, setEditTenantPlan] = useState<string>('');
  const [editTenantStatus, setEditTenantStatus] = useState<string>('');
  useEffect(() => {
    if (tenant) {
      setEditTenantName(tenant.companyName || tenant.name || '');
      setEditTenantPlan(tenant.subscriptionPlan || 'free');
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
        plan: editTenantPlan,
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
  const startEditUser = (u: any) => {
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

  const updateOverride = (patch: Overrides) => {
    setOverrideLimits(prev => ({
      ...prev,
      ...patch,
      monthly: { ...(prev.monthly || {}), ...(patch.monthly || {}) },
    }));
  };

  const markClear = (key: string) => {
    setClearKeys(prev => (prev.includes(key) ? prev : [...prev, key]));
    if (key.includes('.')) {
      const [parent, child] = key.split('.');
      if (parent === 'monthly') {
        setOverrideLimits(prev => {
          const m = { ...(prev.monthly || {}) } as any;
          delete (m as any)[child];
          const next = { ...prev, monthly: m } as any;
          if (Object.keys(m).length === 0) delete next.monthly;
          return next;
        });
      }
    } else {
      setOverrideLimits(prev => {
        const next: any = { ...prev };
        delete next[key as keyof Overrides];
        return next;
      });
    }
  };

  const saveOverrides = async () => {
    if (!selectedTenantId) return;
    try {
      setLoading(true);
      const payload: any = { ...overrideLimits };
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
      await adminApi.updateTenantLimits(selectedTenantId, { __clearAll: true } as any);
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
              <div className="text-xs text-gray-500">{t.subscriptionPlan} · {t.status}</div>
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
                    <option value="free">free</option>
                    <option value="basic">basic</option>
                    <option value="professional">professional</option>
                    <option value="enterprise">enterprise</option>
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
                <div className="text-xs text-gray-600">Plan: {tenant?.subscriptionPlan} · Durum: {tenant?.status}</div>
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
                  <Field label="Aylık Maks. Fatura" value={overrideLimits.monthly?.maxInvoices} onChange={(v)=>updateOverride({monthly:{maxInvoices:v} as any})} onClear={()=>markClear('monthly.maxInvoices')} />
                  <Field label="Aylık Maks. Gider" value={overrideLimits.monthly?.maxExpenses} onChange={(v)=>updateOverride({monthly:{maxExpenses:v} as any})} onClear={()=>markClear('monthly.maxExpenses')} />
                </div>
              </div>
              <Card title="Efektif"><pre className="text-xs overflow-auto">{JSON.stringify(limits?.effective,null,2)}</pre></Card>
            </div>

            {/* Kullanıcılar */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-3 py-2 border-b font-medium">Kullanıcılar</div>
              <div className="max-h-[40vh] overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Ad Soyad</th>
                      <th className="px-3 py-2 text-left">E-posta</th>
                      <th className="px-3 py-2 text-left">Rol</th>
                      <th className="px-3 py-2 text-left">Durum</th>
                      <th className="px-3 py-2 text-left">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u: any) => {
                      const edit = userEdits[u.id];
                      return (
                        <tr key={u.id} className="border-t">
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

const Info: React.FC<{ title: string; value: number; max?: number }> = ({ title, value, max }) => (
  <div className="border rounded p-3 text-center">
    <div className="text-xl font-semibold">{value ?? 0}{typeof max==='number' ? ` / ${max}`: ''}</div>
    <div className="text-xs text-gray-600">{title}</div>
  </div>
);

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

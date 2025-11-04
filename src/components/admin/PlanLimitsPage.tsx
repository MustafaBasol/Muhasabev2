import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';

// Basit bir düzenleme UI'si: 4 plan için limitleri gösterir ve güncellemeyi sağlar
// -1 "Sınırsız" anlamına gelir.

type PlanKey = 'free' | 'basic' | 'professional' | 'enterprise';

type Limits = {
  maxUsers: number;
  maxCustomers: number;
  maxSuppliers: number;
  maxBankAccounts: number;
  monthly: { maxInvoices: number; maxExpenses: number };
};

const PLAN_TITLES: Record<PlanKey, string> = {
  free: 'Ücretsiz',
  basic: 'Basic',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

const NumberField: React.FC<{
  value: number;
  onChange: (v: number) => void;
  label: string;
}> = ({ value, onChange, label }) => {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const num = parseInt(text, 10);
          if (isNaN(num)) return setText(String(value));
          onChange(num);
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
      />
      <p className="text-[11px] text-gray-500 mt-1">-1 = Sınırsız</p>
    </div>
  );
};

const PlanLimitsPage: React.FC = () => {
  const [limits, setLimits] = useState<Partial<Record<PlanKey, Limits>>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');

  const fetchLimits = async () => {
    try {
      setLoading(true);
      const resp = await adminApi.getPlanLimits();
      const data = resp?.limits || {};
      setLimits(data);
    } catch (e) {
      console.error('Plan limitleri alınamadı', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLimits();
  }, []);

  const updatePlan = async (plan: PlanKey, patch: Partial<Limits>) => {
    try {
      setLoading(true);
      await adminApi.updatePlanLimits(plan, patch as any);
      setMessage('Kaydedildi');
      setTimeout(() => setMessage(''), 2000);
      fetchLimits();
    } catch (e) {
      console.error('Güncelleme başarısız', e);
    } finally {
      setLoading(false);
    }
  };

  const renderPlanCard = (plan: PlanKey) => {
    const l = limits[plan];
    if (!l) return null;
    return (
      <div key={plan} className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">{PLAN_TITLES[plan]}</h3>
          <button
            disabled={loading}
            onClick={() => fetchLimits()}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Yenile
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NumberField
            label="Maks. Kullanıcı"
            value={l.maxUsers}
            onChange={(v) => updatePlan(plan, { maxUsers: v })}
          />
          <NumberField
            label="Maks. Müşteri"
            value={l.maxCustomers}
            onChange={(v) => updatePlan(plan, { maxCustomers: v })}
          />
          <NumberField
            label="Maks. Tedarikçi"
            value={l.maxSuppliers}
            onChange={(v) => updatePlan(plan, { maxSuppliers: v })}
          />
          <NumberField
            label="Maks. Banka Hesabı"
            value={l.maxBankAccounts}
            onChange={(v) => updatePlan(plan, { maxBankAccounts: v })}
          />
          <NumberField
            label="Aylık Maks. Fatura"
            value={l.monthly?.maxInvoices ?? -1}
            onChange={(v) => updatePlan(plan, { monthly: { maxInvoices: v } as any })}
          />
          <NumberField
            label="Aylık Maks. Gider"
            value={l.monthly?.maxExpenses ?? -1}
            onChange={(v) => updatePlan(plan, { monthly: { maxExpenses: v } as any })}
          />
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">📏 Plan Limitleri</h2>
        {message && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded">{message}</div>
        )}
      </div>
      <p className="text-sm text-gray-600 mb-4">Plan limitlerini burada görüntüleyebilir ve düzenleyebilirsiniz. Değişiklikler anında geçerlidir ve sunucu yeniden başlatıldığında config/plan-limits.json dosyasından yüklenir.</p>
      {loading && <div className="text-sm text-gray-500 mb-3">Yükleniyor…</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['free','basic','professional','enterprise'] as PlanKey[]).map(renderPlanCard)}
      </div>
    </div>
  );
};

export default PlanLimitsPage;

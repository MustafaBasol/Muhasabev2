import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Trash2, Check } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import type { Customer, Product } from '../types';
import ConfirmModal from './ConfirmModal';

type CurrencyCode = 'TRY' | 'USD' | 'EUR' | 'GBP';

export type QuoteCreateLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  productId?: string;
  unit?: string;
};

export interface QuoteCreatePayload {
  customer: Customer;
  issueDate: string;
  validUntil: string;
  currency: CurrencyCode;
  items: QuoteCreateLine[];
  total: number;
}

interface QuoteCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  products: Product[];
  defaultCurrency?: CurrencyCode;
  onCreate: (payload: QuoteCreatePayload) => void;
}

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
const iso = (d: Date) => d.toISOString().slice(0,10);

const QuoteCreateModal: React.FC<QuoteCreateModalProps> = ({ isOpen, onClose, customers, products, defaultCurrency, onCreate }) => {
  const { t } = useTranslation();
  const { formatCurrency, currency: systemCurrency } = useCurrency();

  const [form, setForm] = useState<{ currency: CurrencyCode; issueDate: string; validUntil: string; validityDays: number }>(() => {
    const today = new Date();
    return { currency: (defaultCurrency ?? (systemCurrency as CurrencyCode) ?? 'TRY'), issueDate: iso(today), validUntil: iso(addDays(today, 30)), validityDays: 30 };
  });
  const [items, setItems] = useState<QuoteCreateLine[]>([{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeProductDropdown, setActiveProductDropdown] = useState<string | null>(null);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return customers.filter(c => {
      const name = (c.name || '').toLowerCase();
      const company = (c.company || '').toLowerCase();
      return q ? (name.includes(q) || company.includes(q)) : true;
    });
  }, [customers, customerSearch]);

  const getProductMatches = (term: string) => {
    const q = term.trim().toLowerCase();
    return products
      .filter(p => !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
      .slice(0, 12);
  };

  const addItem = () => {
    const newItem: QuoteCreateLine = { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 };
    setItems(prev => [...prev, newItem]);
  };
  const removeItem = (id: string) => {
    setItems(prev => (prev.length === 1 ? prev : prev.filter(it => it.id !== id)));
    setActiveProductDropdown(prev => (prev === id ? null : prev));
  };
  const updateItem = (id: string, field: keyof QuoteCreateLine, value: string | number) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated: QuoteCreateLine = { ...(it as QuoteCreateLine), [field]: value } as QuoteCreateLine;
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = Number(field === 'quantity' ? value : updated.quantity) || 0;
        const price = Number(field === 'unitPrice' ? value : updated.unitPrice) || 0;
        updated.total = qty * price;
      }
      return updated;
    }));
  };
  const itemsTotal = useMemo(() => items.reduce((sum, it) => sum + (Number(it.total) || 0), 0), [items]);

  // Hooks must not be called conditionally; guard after hooks
  if (!isOpen) return null;

  const handleCustomerSelect = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setShowCustomerDropdown(false);
  };

  const handleSelectProduct = (itemId: string, product: Product) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      const quantity = it.quantity > 0 ? it.quantity : 1;
      const unitPrice = Number((product as any).unitPrice ?? (product as any).price ?? it.unitPrice ?? 0);
      return {
        ...it,
        productId: String(product.id),
        description: product.name,
        unit: (product as any).unit,
        unitPrice,
        quantity,
        total: quantity * unitPrice,
      };
    }));
    setActiveProductDropdown(null);
  };

  const handleCreate = () => {
    if (!selectedCustomer) return;
    if (items.length === 0 || items.every(it => !it.description || (Number(it.total) || 0) <= 0)) return;
    // Kayıt öncesi onay al
    setConfirmData({
      title: t('common.confirm', { defaultValue: 'Onay' }),
      message: t('quotes.createConfirm', { defaultValue: 'Teklifi kaydetmek istediğinize emin misiniz?' }),
      onConfirm: () => {
        onCreate({
          customer: selectedCustomer,
          issueDate: form.issueDate,
          validUntil: form.validUntil,
          currency: form.currency,
          items,
          total: itemsTotal,
        });
        setConfirmData(null);
      }
    });
  };

  const [confirmData, setConfirmData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  return (
    <>
    <div className="fixed inset-0 bg-black/40 h-full w-full flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">{t('quotes.createModal.title')}</h3>
        </div>
        <div className="px-6 py-4 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoices.customerName')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setShowCustomerDropdown(e.target.value.length > 0); }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('invoices.customerSearchPlaceholder')}
                />
                {selectedCustomer && (
                  <Check className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 w-4 h-4" />
                )}
              </div>
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  <div className="p-2 text-xs text-gray-500 border-b">{filteredCustomers.length} müşteri bulundu</div>
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleCustomerSelect(c)}
                      className="w-full p-3 text-left hover:bg-indigo-50 border-b last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{c.name}</div>
                      {c.company && <div className="text-xs text-gray-600">{c.company}</div>}
                      <div className="text-xs text-gray-500">{c.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.createModal.currency')}</label>
              <select
                value={form.currency}
                onChange={(e) => setForm(s => ({ ...s, currency: e.target.value as CurrencyCode }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="TRY">TRY</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.createModal.date')}</label>
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm(s => ({ ...s, issueDate: e.target.value, validUntil: iso(addDays(new Date(e.target.value), s.validityDays || 30)) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.validUntil')}</label>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm(s => ({ ...s, validUntil: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.validityDays', { defaultValue: 'Geçerlilik (gün)' })}</label>
              <input
                type="number"
                min={1}
                value={form.validityDays}
                onChange={(e) => setForm(s => { const d = Math.max(1, parseInt(e.target.value || '1', 10)); return { ...s, validityDays: d, validUntil: iso(addDays(new Date(s.issueDate), d)) }; })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">{t('invoices.productsAndServices')}</h4>
              <button onClick={addItem} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                <Plus className="w-4 h-4" />
                <span>{t('invoices.addLine')}</span>
              </button>
            </div>

            <div className="overflow-x-auto" style={{ overflow: 'visible' }}>
              <table className="w-full border border-gray-200 rounded-lg table-fixed" style={{ position: 'relative' }}>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700" style={{ width: '44%' }}>{t('invoices.description')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700" style={{ width: '12%' }}>{t('invoices.quantity')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700" style={{ width: '18%' }}>{t('invoices.unitPriceExclVAT')}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700" style={{ width: '18%' }}>{t('invoices.totalExclVAT')}</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-700" style={{ width: '8%' }}>{t('invoices.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200" style={{ position: 'relative' }}>
                  {items.map((it) => {
                    const productMatches = getProductMatches(it.description);
                    return (
                      <tr key={it.id}>
                        <td className="px-4 py-2" style={{ position: 'static' }}>
                          <div className="relative" style={{ position: 'static' }}>
                            <input
                              type="text"
                              value={it.description}
                              onChange={(e) => {
                                updateItem(it.id, 'description', e.target.value);
                                if (e.target.value.length > 0) setActiveProductDropdown(it.id);
                              }}
                              onClick={() => { if (it.description.length > 0) setActiveProductDropdown(it.id); }}
                              onBlur={() => setTimeout(() => setActiveProductDropdown(cur => (cur === it.id ? null : cur)), 200)}
                              className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder={t('invoices.productServiceDescription')}
                            />
                            {activeProductDropdown === it.id && productMatches.length > 0 && (
                              <div className="absolute z-[100] mt-1 w-[450px] left-0 rounded-lg border-2 border-gray-300 bg-white shadow-2xl max-h-[400px] overflow-y-auto">
                                <div className="sticky top-0 bg-indigo-50 p-2 text-xs font-medium text-indigo-700 border-b border-indigo-200">
                                  <span className="flex items-center">
                                    <Search className="w-3 h-3 mr-1" />
                                    {productMatches.length} ürün bulundu
                                  </span>
                                </div>
                                {productMatches.map(p => (
                                  <button
                                    key={`${it.id}-${p.id}`}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleSelectProduct(it.id, p)}
                                    className="w-full p-3 text-left hover:bg-indigo-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                  >
                                    <div className="font-semibold text-gray-900 mb-0.5">{p.name}</div>
                                    <div className="flex items-center justify-between text-xs text-gray-600">
                                      {(p as any).sku && <span className="px-1.5 py-0.5 bg-gray-100 rounded">SKU: {(p as any).sku}</span>}
                                      <span className="font-medium text-green-600">{((p as any).unitPrice ?? (p as any).price ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {it.unit && (
                            <p className="mt-1 text-xs text-gray-500">Birim: {it.unit}</p>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={it.quantity}
                            onChange={(e) => updateItem(it.id, 'quantity', parseInt(e.target.value, 10) || 1)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            min={1}
                            step={1}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={it.unitPrice}
                            onChange={(e) => updateItem(it.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            min={0}
                            step={0.01}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <span className="font-medium text-gray-900">{(it.total || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => removeItem(it.id)}
                            disabled={items.length === 1}
                            className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 flex justify-end">
            <div className="w-64 flex justify-between text-lg font-semibold">
              <span>{t('invoices.grandTotalExclVAT', { defaultValue: 'Genel Toplam (KDV Hariç)' })}:</span>
              <span>{formatCurrency(itemsTotal, form.currency)}</span>
            </div>
          </div>

        </div>
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedCustomer || itemsTotal <= 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('quotes.createModal.create')}
          </button>
        </div>
      </div>
    </div>
    {confirmData && (
      <ConfirmModal
        isOpen={true}
        title={confirmData!.title}
        message={confirmData!.message}
        confirmText={t('common.yes', { defaultValue: 'Evet' })}
        cancelText={t('common.no', { defaultValue: 'Hayır' })}
        onConfirm={confirmData!.onConfirm}
        onCancel={() => setConfirmData(null)}
      />
    )}
    </>
  );
};

export default QuoteCreateModal;

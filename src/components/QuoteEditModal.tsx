import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Quote, QuoteStatus } from './QuoteViewModal';
import type { Product } from '../types';
import ConfirmModal from './ConfirmModal';

interface QuoteEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quote | null;
  onSave: (updated: Quote) => void;
  products?: Product[];
}

const QuoteEditModal: React.FC<QuoteEditModalProps> = ({ isOpen, onClose, quote, onSave, products = [] }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<Quote | null>(null);
  const [lines, setLines] = useState<NonNullable<Quote['items']>>([]);
  const [activeProductDropdown, setActiveProductDropdown] = useState<string | null>(null);
  // IMPORTANT: Hooks must be declared before any conditional return
  const [confirmData, setConfirmData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  useEffect(() => {
    if (quote) {
      setForm({ ...quote });
      const initial = Array.isArray(quote.items) && quote.items.length > 0
        ? quote.items.map(it => ({ ...it }))
        : [{ id: 'l1', description: '', quantity: 1, unitPrice: 0, total: 0 }];
      setLines(initial as any);
    } else {
      setForm(null);
      setLines([]);
    }
  }, [quote]);

  // Hooks must be called unconditionally on every render. Compute totals before any early return.
  const linesTotal = useMemo(() => lines.reduce((s, l) => s + (Number(l.total) || 0), 0), [lines]);

  if (!isOpen || !form) return null;

  const addLine = () => {
    setLines(prev => [...prev, { id: `l${Date.now()}`, description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };
  const removeLine = (id: string) => {
    setLines(prev => (prev.length === 1 ? prev : prev.filter(l => l.id !== id)));
  };
  const updateLine = (id: string, field: 'description' | 'quantity' | 'unitPrice', value: string | number) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const next: any = { ...l, [field]: value };
      const qty = Number(field === 'quantity' ? value : next.quantity) || 0;
      const price = Number(field === 'unitPrice' ? value : next.unitPrice) || 0;
      next.total = qty * price;
      return next;
    }));
  };

  // linesTotal already computed above to satisfy hooks rules

  // Product typeahead helpers (same davranış QuoteCreateModal ile uyumlu)
  const getProductMatches = (term: string) => {
    const q = (term || '').trim().toLowerCase();
    return products
      .filter(p => !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
      .slice(0, 12);
  };

  const handleSelectProduct = (lineId: string, product: Product) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const quantity = (l as any).quantity > 0 ? (l as any).quantity : 1;
      const unitPrice = Number((product as any).unitPrice ?? (product as any).price ?? (l as any).unitPrice ?? 0);
      return {
        ...(l as any),
        productId: String(product.id),
        description: product.name,
        unit: (product as any).unit,
        unitPrice,
        quantity,
        total: quantity * unitPrice,
      } as any;
    }));
    setActiveProductDropdown(null);
  };

  const handleSave = () => {
    if (!form) return;
    // Basit doğrulama
    if (!form.customerName || !form.issueDate) return;
    const updated: Quote = {
      ...form,
      items: lines as any,
      total: linesTotal,
    };
    setConfirmData({
      title: t('common.confirm', { defaultValue: 'Onay' }),
      message: t('quotes.saveConfirm', { defaultValue: 'Değişiklikleri kaydetmek istiyor musunuz?' }),
      onConfirm: () => {
        onSave(updated);
        onClose();
        setConfirmData(null);
      }
    });
  };

  // confirmData state moved above to keep hook order stable

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{t('quotes.editModal.title')}</h2>
            <p className="text-sm text-gray-500">{t('quotes.editModal.subtitle')}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

  <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.editModal.quoteNumber')}</label>
            <input
              type="text"
              value={form.quoteNumber}
              onChange={(e) => setForm({ ...form, quoteNumber: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.createModal.customer')}</label>
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.createModal.date')}</label>
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.createModal.currency')}</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value as Quote['currency'] })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="TRY">TRY</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.validUntil')}</label>
            <input
              type="date"
              value={form.validUntil || ''}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.createModal.amount')}</label>
              <input
                type="number"
                value={Number(linesTotal || 0)}
                readOnly
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-700"
                min={0}
                step={0.01}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.table.status')}</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as QuoteStatus })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="draft">{t('status.draft')}</option>
                <option value="sent">{t('status.sent')}</option>
                <option value="viewed">{t('quotes.statusLabels.viewed')}</option>
                <option value="accepted">{t('quotes.statusLabels.accepted')}</option>
                <option value="declined">{t('quotes.statusLabels.declined')}</option>
                <option value="expired">{t('quotes.statusLabels.expired')}</option>
              </select>
            </div>
          </div>

          {/* Kalemler */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">{t('invoices.productsAndServices')}</h4>
              <button onClick={addLine} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                <Plus className="w-4 h-4" />
                <span>{t('invoices.addLine')}</span>
              </button>
            </div>
            <div className="overflow-x-auto" style={{ overflow: 'visible' }}>
              <table className="w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700" style={{ width: '45%' }}>{t('invoices.description')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700" style={{ width: '15%' }}>{t('invoices.quantity')}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700" style={{ width: '20%' }}>{t('invoices.unitPriceExclVAT')}</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700" style={{ width: '15%' }}>{t('invoices.totalInclVAT')}</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700" style={{ width: '5%' }}>{t('invoices.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lines.map((l) => {
                    const productMatches = getProductMatches(String((l as any).description || ''));
                    return (
                    <tr key={l.id}>
                      <td className="px-3 py-2" style={{ position: 'relative' }}>
                        <div className="relative">
                          <input
                            type="text"
                            value={(l as any).description || ''}
                            onChange={(e) => {
                              updateLine(l.id, 'description', e.target.value);
                              if (e.target.value.length > 0) setActiveProductDropdown(l.id);
                            }}
                            onClick={() => { if ((l as any).description?.length > 0) setActiveProductDropdown(l.id); }}
                            onBlur={() => setTimeout(() => setActiveProductDropdown(cur => (cur === l.id ? null : cur)), 200)}
                            className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder={t('invoices.productServiceDescription')}
                          />
                          {activeProductDropdown === l.id && productMatches.length > 0 && (
                            <div className="absolute z-[100] mt-1 w-[450px] left-0 rounded-lg border-2 border-gray-300 bg-white shadow-2xl max-h-[400px] overflow-y-auto">
                              <div className="sticky top-0 bg-indigo-50 p-2 text-xs font-medium text-indigo-700 border-b border-indigo-200">
                                <span className="flex items-center">
                                  <Search className="w-3 h-3 mr-1" />
                                  {productMatches.length} ürün bulundu
                                </span>
                              </div>
                              {productMatches.map(p => (
                                <button
                                  key={`${l.id}-${(p as any).id}`}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => handleSelectProduct(l.id as string, p as any)}
                                  className="w-full p-3 text-left hover:bg-indigo-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                >
                                  <div className="font-semibold text-gray-900 mb-0.5">{(p as any).name}</div>
                                  <div className="flex items-center justify-between text-xs text-gray-600">
                                    {(p as any).sku && <span className="px-1.5 py-0.5 bg-gray-100 rounded">SKU: {(p as any).sku}</span>}
                                    <span className="font-medium text-green-600">{(((p as any).unitPrice ?? (p as any).price ?? 0) as number).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {(l as any).unit && (
                          <p className="mt-1 text-xs text-gray-500">Birim: {(l as any).unit}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={(l as any).quantity}
                          onChange={(e) => updateLine(l.id, 'quantity', parseInt(e.target.value, 10) || 1)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          min={1}
                          step={1}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={(l as any).unitPrice}
                          onChange={(e) => updateLine(l.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-28 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          min={0}
                          step={0.01}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">{(((l as any).total || 0) as number).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => removeLine(l.id)}
                          disabled={lines.length === 1}
                          className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{t('common.cancel')}</button>
          <button onClick={handleSave} className="px-5 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">{t('common.update')}</button>
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

export default QuoteEditModal;

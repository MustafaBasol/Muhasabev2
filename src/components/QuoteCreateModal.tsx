import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Trash2, Check } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import type { Customer, Product } from '../types';
import type { CreateQuoteDto, QuoteItemDto } from '../api/quotes';
import { logger } from '../utils/logger';
import { readLegacyTenantId, safeLocalStorage } from '../utils/localStorageSafe';
import StockWarningModal from './StockWarningModal';
import ConfirmModal from './ConfirmModal';
import RichTextEditor from './RichTextEditor';

type CurrencyCode = CreateQuoteDto['currency'];

export type QuoteCreateLine = QuoteItemDto & { id: string };

export interface QuoteCreatePayload extends Pick<CreateQuoteDto, 'issueDate' | 'validUntil' | 'currency' | 'total' | 'scopeOfWorkHtml'> {
  customer: Customer;
  items: QuoteCreateLine[];
}

interface QuoteCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  products: Product[];
  defaultCurrency?: CurrencyCode;
  onCreate: (payload: QuoteCreatePayload) => void;
  onOpenTemplatesManager?: () => void;
  enableTemplates?: boolean;
}

type StoredTemplate = { id: string; name: string; html: string };

type OrgProfile = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

type ClientProfile = {
  company?: string;
  name?: string;
  email?: string;
  address?: string;
};

type TemplatePayload = {
  quote: { date: string; validUntil: string; total: number; currency: CurrencyCode };
  org: OrgProfile;
  client: ClientProfile;
};

const pickFirstFinite = (...values: Array<number | undefined | null>): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
};

const parseTemplatesFromStorage = (raw: string | null): StoredTemplate[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const candidate = entry as Record<string, unknown>;
        const id = typeof candidate.id === 'string' ? candidate.id : undefined;
        const name = typeof candidate.name === 'string' ? candidate.name : undefined;
        const html = typeof candidate.html === 'string' ? candidate.html : undefined;
        if (!id || !name || !html) return null;
        return { id, name, html } as StoredTemplate;
      })
      .filter((tpl): tpl is StoredTemplate => Boolean(tpl));
  } catch (error) {
    logger.warn('[QuoteCreateModal] Failed to parse quote templates', error);
    return [];
  }
};

const readOrgProfileFromStorage = (): OrgProfile => {
  try {
    const tenantId = readLegacyTenantId();
    const baseKey = tenantId ? `companyProfile_${tenantId}` : 'companyProfile';
    const raw = safeLocalStorage.getItem(baseKey)
      || safeLocalStorage.getItem(`${baseKey}_plain`)
      || safeLocalStorage.getItem('company');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
      address: typeof parsed.address === 'string' ? parsed.address : undefined,
    };
  } catch (error) {
    logger.warn('[QuoteCreateModal] Failed to load organization profile', error);
    return {};
  }
};

const buildClientProfile = (customer: Customer | null): ClientProfile => {
  if (!customer) return {};
  return {
    company: customer.company,
    name: customer.name,
    email: customer.email,
    address: customer.address,
  };
};

const buildTemplatePayload = (
  customer: Customer | null,
  issueDate: string,
  validUntil: string,
  total: number,
  currency: CurrencyCode,
): TemplatePayload => ({
  quote: { date: issueDate, validUntil, total, currency },
  org: readOrgProfileFromStorage(),
  client: buildClientProfile(customer),
});

const resolveUnitPrice = (product: Product, fallback: number): number => pickFirstFinite(product.unitPrice, product.price, fallback) ?? 0;

const resolveStockValue = (product?: Product): number | undefined => {
  if (!product) return undefined;
  return pickFirstFinite(product.stock, product.stockQuantity);
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
const iso = (d: Date) => d.toISOString().slice(0,10);

const QuoteCreateModal: React.FC<QuoteCreateModalProps> = ({ isOpen, onClose, customers, products, defaultCurrency, onCreate, onOpenTemplatesManager, enableTemplates }) => {
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
  const [scopeHtml, setScopeHtml] = useState<string>('');
  const scopeRef = React.useRef<HTMLDivElement>(null);
  const [scopeDirty, setScopeDirty] = useState(false);
  const [templates, setTemplates] = useState<StoredTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [stockWarning, setStockWarning] = useState<{ itemId: string; product: Product; requested: number; available: number } | null>(null);

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

  // Şablonları yükle (localStorage)
  React.useEffect(() => {
    if (!isOpen) return;
    try {
      const tenantId = readLegacyTenantId();
      const key = tenantId ? `quote_templates_${tenantId}` : 'quote_templates';
      const raw = safeLocalStorage.getItem(key);
      setTemplates(parseTemplatesFromStorage(raw));
    } catch (error) {
      logger.warn('[QuoteCreateModal] Failed to read templates from storage', error);
      setTemplates([]);
    }
  }, [isOpen]);

  // (Opsiyonel) Açılışta farklı bir odak davranışı gerekirse burada ele alınır

  const applyTemplate = async () => {
    if (!selectedTemplateId) return;
    const tpl = templates.find(t => t.id === selectedTemplateId);
    if (!tpl) return;
    try {
      const { fillTemplate } = await import('../utils/quoteTemplates');
      const payload = buildTemplatePayload(selectedCustomer, form.issueDate, form.validUntil, itemsTotal, form.currency);
      const filled = fillTemplate(tpl.html, payload);
      setScopeHtml(filled);
      setScopeDirty(false);
    } catch (error) {
      logger.warn('[QuoteCreateModal] Failed to apply template', error);
    }
  };

  // Şablon seçiliyse ve kullanıcı kapsam içeriğini manüel değiştirmediyse otomatik doldurmayı güncel tut
  React.useEffect(() => {
    (async () => {
      if (!enableTemplates) return;
      if (!selectedTemplateId) return;
      if (!isOpen) return;
      if (scopeDirty) return;
      const tpl = templates.find(t => t.id === selectedTemplateId);
      if (!tpl) return;
      try {
        const { fillTemplate } = await import('../utils/quoteTemplates');
        const payload = buildTemplatePayload(selectedCustomer, form.issueDate, form.validUntil, itemsTotal, form.currency);
        const filled = fillTemplate(tpl.html, payload);
        setScopeHtml(filled);
      } catch (error) {
        logger.warn('[QuoteCreateModal] Failed to refresh template preview', error);
      }
    })();
  }, [selectedTemplateId, selectedCustomer, form.issueDate, form.validUntil, itemsTotal, form.currency, isOpen, enableTemplates]);

  // Onay modalı için state (hook'ları her zaman koşulsuz çağır)
  const [confirmData, setConfirmData] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Hooklardan SONRA değil, ÖNCE guard et
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
      const unitPrice = resolveUnitPrice(product, it.unitPrice);
      return {
        ...it,
        productId: String(product.id),
        description: product.name,
        unit: product.unit,
        unitPrice,
        quantity,
        total: quantity * unitPrice,
      };
    }));
    setActiveProductDropdown(null);
    const requested = items.find(i => i.id === itemId)?.quantity || 1;
    const available = resolveStockValue(product);
    if (typeof available === 'number' && requested > available) {
      setStockWarning({ itemId, product, requested, available });
    }
  };

  const handleCreate = () => {
    if (!selectedCustomer) return;
    if (items.length === 0 || items.every(it => !it.description || (Number(it.total) || 0) <= 0)) return;
    // Stok kontrolü (kaydetmeden önce)
    for (const it of items) {
      const productId = it.productId;
      let prod: Product | undefined;
      if (productId) {
        prod = products.find(p => String(p.id) === String(productId));
      }
      if (!prod && it.description) {
        const nameLc = String(it.description).trim().toLowerCase();
        prod = products.find(p => String(p.name || '').trim().toLowerCase() === nameLc)
          || products.find(p => String(p.name || '').toLowerCase().includes(nameLc));
      }
      if (prod) {
        const available = resolveStockValue(prod);
        const requested = Number(it.quantity) || 0;
        if (typeof available === 'number' && requested > available) {
          setStockWarning({ itemId: String(it.id), product: prod, requested, available });
          return; // Uyarıyı göster ve kaydı durdur
        }
      }
    }
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
          scopeOfWorkHtml: scopeHtml,
        });
        setConfirmData(null);
      }
    });
  };

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
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700" style={{ width: '18%' }}>{t('invoices.unitPriceExclVAT', { defaultValue: 'Birim Fiyat (KDV Hariç)' })}</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700" style={{ width: '18%' }}>{t('common.totalExclVAT', { defaultValue: 'Toplam (KDV Hariç)' })}</th>
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
                                      {p.sku && <span className="px-1.5 py-0.5 bg-gray-100 rounded">SKU: {p.sku}</span>}
                                      <span className="font-medium text-green-600">{resolveUnitPrice(p, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
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
                            onChange={(e) => {
                              const q = parseInt(e.target.value, 10) || 1;
                              updateItem(it.id, 'quantity', q);
                              const current = items.find(x => x.id === it.id);
                              if (current?.productId) {
                                const p = products.find(pr => String(pr.id) === String(current.productId));
                                if (p) {
                                  const available = resolveStockValue(p);
                                  if (typeof available === 'number' && q > available) {
                                    setStockWarning({ itemId: it.id, product: p, requested: q, available });
                                  }
                                }
                              }
                            }}
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

          {/* İşin Kapsamı */}
          <div className="mt-4" ref={scopeRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.scopeOfWork.title', { defaultValue: 'İşin Kapsamı' })}</label>
            {/* Şablon araç çubuğu */}
            {enableTemplates && templates.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <select value={selectedTemplateId} onChange={(e)=>setSelectedTemplateId(e.target.value)} className="px-2 py-1 border rounded text-sm">
                  <option value="">{t('quotes.templates.selectPlaceholder', { defaultValue: 'Şablon seçin…' })}</option>
                  {templates.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
                <button onClick={applyTemplate} disabled={!selectedTemplateId} className="px-2.5 py-1.5 text-xs rounded bg-indigo-600 text-white disabled:opacity-50">{t('quotes.templates.apply', { defaultValue: 'Uygula' })}</button>
                <button onClick={onOpenTemplatesManager} className="px-2.5 py-1.5 text-xs rounded border">{t('quotes.templates.manage', { defaultValue: 'Şablonları Yönet' })}</button>
              </div>
            )}
            {enableTemplates && templates.length === 0 && (
              <div className="mb-2">
                <button onClick={onOpenTemplatesManager} className="px-2.5 py-1.5 text-xs rounded border">{t('quotes.templates.create', { defaultValue: 'Şablon Oluştur' })}</button>
              </div>
            )}
            <RichTextEditor
              value={scopeHtml}
              onChange={(val) => { setScopeHtml(val); setScopeDirty(true); }}
              placeholder={t('quotes.scopeOfWork.placeholder', { defaultValue: 'Proje kapsamı, teslimatlar, varsayımlar ve hariçler...' })}
              height={240}
            />
            <p className="text-xs text-gray-500 mt-1">{t('quotes.scopeOfWork.note', { defaultValue: 'Bu içerik teklif PDF’inde mevcut bölümden sonra yeni bir sayfa olarak eklenecek ve genel linkte görünecek.' })}</p>
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
    {stockWarning && (
      <StockWarningModal
        isOpen={true}
        product={stockWarning.product}
        requested={stockWarning.requested}
        available={stockWarning.available}
        onAdjust={() => {
          setItems(prev => prev.map(it => it.id === stockWarning.itemId ? { ...it, quantity: stockWarning.available, total: stockWarning.available * (Number(it.unitPrice)||0) } : it));
        }}
        onClose={() => setStockWarning(null)}
      />
    )}
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

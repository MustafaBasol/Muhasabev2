import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Eye, Edit, Trash2, FileText, Calendar, Check, X, FileDown, Copy } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import QuoteViewModal, { type Quote as QuoteModel, type QuoteStatus } from './QuoteViewModal';
import QuoteEditModal from './QuoteEditModal';
import QuoteCreateModal, { type QuoteCreatePayload } from './QuoteCreateModal';
import ConfirmModal from './ConfirmModal';
import type { Customer, Product } from '../types';

interface QuotesPageProps {
  onAddQuote?: () => void;
  customers?: Customer[];
  products?: Product[];
}

interface QuoteItem {
  id: string;
  quoteNumber: string;
  customerName: string;
  customerId?: string;
  issueDate: string;
  validUntil?: string;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  total: number;
  status: QuoteStatus;
  version?: number;
  items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    productId?: string;
    unit?: string;
  }>;
  revisions?: Array<{
    version: number;
    issueDate: string;
    validUntil?: string;
    status: QuoteStatus;
    total: number;
    items?: QuoteItem['items'];
    snapshotAt: string; // ISO
  }>;
  convertedToSale?: boolean;
}

const QuotesPage: React.FC<QuotesPageProps> = ({ customers = [], products = [] }) => {
  const { t } = useTranslation();
  const { formatCurrency, currency: defaultCurrency } = useCurrency();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [sortBy, setSortBy] = useState<'quoteNumber' | 'customer' | 'date' | 'currency' | 'total' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteItem | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [reviseTarget, setReviseTarget] = useState<QuoteItem | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<QuoteItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuoteItem | null>(null);

  // Inline edit state (status, dates vs.)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'status' | 'issueDate' | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  // Mock veriler (MVP)
  const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0,10);
  const [quotes, setQuotes] = useState<QuoteItem[]>(() => {
    try {
      const raw = localStorage.getItem('quotes_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as QuoteItem[];
      }
    } catch {}
    // Fallback mock veriler (yalnızca ilk kurulumda / hiç cache yokken)
    // Kullanıcı bu örnekleri silerse tekrar görünmemesi için silinen ID'leri dikkate al.
    let deletedIds: string[] = [];
    try {
      const rawDeleted = localStorage.getItem('quotes_deleted_ids');
      if (rawDeleted) {
        const arr = JSON.parse(rawDeleted);
        if (Array.isArray(arr)) deletedIds = arr.map(String);
      }
    } catch {}

    const demo: QuoteItem[] = [
      { id: 'q1', quoteNumber: 'Q-2025-0001', customerName: 'Acme GmbH', issueDate: iso(new Date()), validUntil: iso(addDays(new Date(), 30)), currency: 'EUR', total: 1250, status: 'draft', version: 1 },
      { id: 'q2', quoteNumber: 'Q-2025-0002', customerName: 'Mavi Deniz A.Ş.', issueDate: iso(addDays(new Date(), -2)), validUntil: iso(addDays(new Date(), 28)), currency: 'TRY', total: 54000, status: 'sent', version: 1 },
      { id: 'q3', quoteNumber: 'Q-2025-0003', customerName: 'Tech Solutions SARL', issueDate: iso(addDays(new Date(), -10)), validUntil: iso(addDays(new Date(), 20)), currency: 'EUR', total: 980, status: 'viewed', version: 1 },
      { id: 'q4', quoteNumber: 'Q-2025-0004', customerName: 'Schmidt KG', issueDate: iso(addDays(new Date(), -15)), validUntil: iso(addDays(new Date(), 15)), currency: 'EUR', total: 2320, status: 'accepted', version: 1 },
      { id: 'q5', quoteNumber: 'Q-2025-0005', customerName: 'ABC Teknoloji', issueDate: iso(addDays(new Date(), -40)), validUntil: iso(addDays(new Date(), -10)), currency: 'TRY', total: 8900, status: 'declined', version: 1 },
      { id: 'q6', quoteNumber: 'Q-2025-0006', customerName: 'GlobalCorp Ltd', issueDate: iso(addDays(new Date(), -60)), validUntil: iso(addDays(new Date(), -30)), currency: 'USD', total: 3200, status: 'expired', version: 1 }
    ];
    return demo.filter(d => !deletedIds.includes(String(d.id)) && !deletedIds.includes(String(d.quoteNumber)));
  });

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return quotes
      .filter(item => {
        const hay = [item.quoteNumber, item.customerName, item.status, item.currency, item.issueDate, String(item.total)]
          .join(' ').toLowerCase();
        const matchesSearch = q.length === 0 || hay.includes(q);
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        switch (sortBy) {
          case 'quoteNumber':
            return a.quoteNumber.localeCompare(b.quoteNumber) * dir;
          case 'customer':
            return a.customerName.localeCompare(b.customerName) * dir;
          case 'currency':
            return a.currency.localeCompare(b.currency) * dir;
          case 'total':
            return (a.total - b.total) * dir;
          case 'status':
            return a.status.localeCompare(b.status) * dir;
          case 'date':
          default:
            return (new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime()) * dir;
        }
      });
  }, [quotes, searchTerm, statusFilter, sortBy, sortDir]);

  const toggleSort = (col: typeof sortBy) => {
    setSortBy(prev => {
      if (prev === col) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      // varsayılan yön
      setSortDir(col === 'total' || col === 'date' ? 'desc' : 'asc');
      return col;
    });
  };

  const SortIndicator = ({ active }: { active: boolean }) => (
    <span className="inline-block ml-1 text-gray-400">{active ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
  );

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('tr-TR');
  // Sistem para birimini kullanır; teklif özelinde override destekler
  const formatAmount = (amount: number, currencyCode: QuoteItem['currency']) => formatCurrency(amount, currencyCode);

  const statusBadge = (status: QuoteStatus) => {
    const map: Record<QuoteStatus, { label: string; className: string }> = {
      draft:    { label: t('status.draft'),    className: 'bg-gray-100 text-gray-800' },
      sent:     { label: t('status.sent'),     className: 'bg-blue-100 text-blue-800' },
      viewed:   { label: t('quotes.statusLabels.viewed'),   className: 'bg-indigo-100 text-indigo-800' },
      accepted: { label: t('quotes.statusLabels.accepted'), className: 'bg-green-100 text-green-800' },
      declined: { label: t('quotes.statusLabels.declined'), className: 'bg-red-100 text-red-800' },
      expired:  { label: t('quotes.statusLabels.expired'),  className: 'bg-yellow-100 text-yellow-800' },
    };
    const cfg = map[status];
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.className}`}>{cfg.label}</span>;
  };

  // Yeni teklif oluşturma modalı artık ayrı bir bileşende (QuoteCreateModal)

  const openCreate = () => setShowCreateModal(true);
  const closeCreate = () => setShowCreateModal(false);

  // Dashboard Hızlı İşlemlerden tetiklemek için global event dinle
  React.useEffect(() => {
    const handler = () => {
      openCreate();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('open-new-quote-modal', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('open-new-quote-modal', handler as EventListener);
      }
    };
  }, []);

  // (Eski create modal alanları bu bileşenden kaldırıldı)

  const handleDelete = (id: string) => {
    const target = quotes.find(q => q.id === id) || null;
    setDeleteTarget(target);
  };

  const openView = (item: QuoteItem) => {
    setSelectedQuote(item);
    setShowViewModal(true);
  };

  const openEdit = (item: QuoteItem) => {
    setSelectedQuote(item);
    setShowEditModal(true);
  };

  const closeView = () => setShowViewModal(false);
  const closeEdit = () => setShowEditModal(false);

  const handleSaveEdit = (updated: QuoteModel) => {
    setQuotes(prev => prev.map(q => q.id === updated.id ? { ...q, ...updated } : q));
    setSelectedQuote(prev => prev && prev.id === updated.id ? ({ ...prev, ...updated }) : prev);
  };

  const handleChangeStatus = (q: QuoteModel, status: QuoteStatus) => {
    setQuotes(prev => prev.map(item => item.id === q.id ? { ...item, status } : item));
    setSelectedQuote(prev => (prev && prev.id === q.id) ? { ...prev, status } : prev);
  };

  const handleRevise = (q: QuoteModel) => {
    // Önce onay iste
    setReviseTarget(q as any);
  };

  React.useEffect(() => {
    const todayISO = new Date().toISOString().slice(0,10);
    const terminal: QuoteStatus[] = ['accepted', 'declined', 'expired'];
    let changed = false;
    const updated = quotes.map(q => {
      if (!terminal.includes(q.status) && q.validUntil && q.validUntil < todayISO) {
        changed = true;
        return { ...q, status: 'expired' as QuoteStatus };
      }
      return q;
    });
    if (changed) setQuotes(updated);
  }, [quotes]);

  // quotes persistence
  React.useEffect(() => {
    try {
      localStorage.setItem('quotes_cache', JSON.stringify(quotes));
      // Aynı sekmede kabul/ret gibi değişiklikleri App'e bildir
      try { window.dispatchEvent(new Event('quotes-cache-updated')); } catch {}
    } catch {}
  }, [quotes]);

  // Senkronizasyon: Başka bir sekmede/public sayfasında durum değişirse listeyi güncelle
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const reloadFromStorage = () => {
      try {
        const raw = localStorage.getItem('quotes_cache');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setQuotes((prev) => {
            // Aynı referansı gereksiz yere set etmemek için basit bir fark kontrolü
            const prevStr = JSON.stringify(prev);
            const nextStr = JSON.stringify(parsed);
            return prevStr === nextStr ? prev : parsed;
          });
        }
      } catch {}
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'quotes_cache') {
        reloadFromStorage();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        reloadFromStorage();
      }
    };

    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    // İlk mount'ta da bir kez çek (özellikle geri gelindiğinde taze veri için)
    reloadFromStorage();

    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Inline edit helpers
  const startInlineEdit = (quoteId: string, field: 'status' | 'issueDate', current: string) => {
    const q = quotes.find(q => q.id === quoteId);
    if (q?.status === 'accepted') return; // kilitli
    setEditingQuoteId(quoteId);
    setEditingField(field);
    setTempValue(current);
  };

  const cancelInlineEdit = () => {
    setEditingQuoteId(null);
    setEditingField(null);
    setTempValue('');
  };

  const saveInlineEdit = (quote: QuoteItem) => {
    if (!editingField) return;
    if (editingField === 'status') {
      const nextStatus = tempValue as QuoteStatus;
      setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: nextStatus } : q));
      setSelectedQuote(prev => (prev && prev.id === quote.id) ? { ...prev, status: nextStatus } as any : prev);
    }
    if (editingField === 'issueDate') {
      const nextDate = tempValue;
      setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, issueDate: nextDate } : q));
      setSelectedQuote(prev => (prev && prev.id === quote.id) ? { ...prev, issueDate: nextDate } as any : prev);
    }
    setEditingQuoteId(null);
    setEditingField(null);
    setTempValue('');
  };

  return (
    <div className="space-y-6">
      {/* Yinele onayı */}
      {duplicateTarget && (
        <ConfirmModal
          isOpen={true}
          title={t('common.confirm', { defaultValue: 'Onay' })}
          message={t('quotes.duplicateConfirm')}
          confirmText={t('common.yes', { defaultValue: 'Evet' })}
          cancelText={t('common.no', { defaultValue: 'Hayır' })}
          onCancel={() => setDuplicateTarget(null)}
          onConfirm={() => {
            const src = duplicateTarget;
            if (!src) return;
            // Yeni ID ve numara üret
            const id = `q${Date.now()}`;
            const year = new Date().getFullYear();
            const current = quotes;
            const nextIndex = current.length + 1;
            const quoteNumber = `Q-${year}-${String(nextIndex).padStart(4, '0')}`;
            const copy: QuoteItem = {
              id,
              quoteNumber,
              customerName: src.customerName,
              customerId: (src as any).customerId,
              issueDate: new Date().toISOString().slice(0,10),
              validUntil: src.validUntil,
              currency: src.currency,
              total: src.total,
              status: 'draft',
              version: 1,
              items: (src.items || []).map(it => ({ ...it })),
            };
            setQuotes(prev => [copy, ...prev]);
            setDuplicateTarget(null);
          }}
        />
      )}
      {/* Revize onayı */}
      {reviseTarget && (
        <ConfirmModal
          isOpen={true}
          title={t('common.confirm', { defaultValue: 'Onay' })}
          message={t('quotes.reviseConfirm')}
          confirmText={t('common.yes', { defaultValue: 'Evet' })}
          cancelText={t('common.no', { defaultValue: 'Hayır' })}
          onCancel={() => setReviseTarget(null)}
          onConfirm={() => {
            const target = reviseTarget;
            if (!target) return;
            const today = new Date();
            const nextIssue = iso(today);
            const nextValid = iso(addDays(today, 30));
            // Geçmişe snapshot al
            setQuotes(prev => prev.map(item => {
              if (item.id !== target.id) return item;
              const snapshot = {
                version: item.version || 1,
                issueDate: item.issueDate,
                validUntil: item.validUntil,
                status: item.status,
                total: item.total,
                items: item.items ? item.items.map(it => ({ ...it })) : undefined,
                snapshotAt: new Date().toISOString(),
              } as NonNullable<QuoteItem['revisions']>[number];
              return {
                ...item,
                status: 'draft' as QuoteStatus,
                issueDate: nextIssue,
                validUntil: nextValid,
                version: (item.version || 1) + 1,
                revisions: [...(item.revisions || []), snapshot],
              };
            }));
            setSelectedQuote(prev => prev && prev.id === target.id ? ({
              ...prev,
              status: 'draft',
              issueDate: nextIssue,
              validUntil: nextValid,
              version: (prev.version || 1) + 1,
            } as any) : prev);
            setReviseTarget(null);
          }}
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('quotes.title')}</h1>
          <p className="text-sm text-gray-500">{t('quotes.comingSoon')}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          {t('quotes.newQuote')}
        </button>
      </div>

      {/* Ara ve Filtreler */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t('quotes.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{t('quotes.filterAll')}</option>
            <option value="draft">{t('status.draft')}</option>
            <option value="sent">{t('status.sent')}</option>
            <option value="viewed">{t('quotes.statusLabels.viewed')}</option>
            <option value="accepted">{t('quotes.statusLabels.accepted')}</option>
            <option value="declined">{t('quotes.statusLabels.declined')}</option>
            <option value="expired">{t('quotes.statusLabels.expired')}</option>
          </select>
        </div>
        {/* Liste */}
        <div className="divide-y divide-gray-200">
          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || statusFilter !== 'all' ? t('quotes.noQuotesFound') : t('quotes.noQuotes')}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || statusFilter !== 'all' ? t('quotes.noQuotesFoundDesc') : t('quotes.noQuotesDesc')}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button
                  onClick={openCreate}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {t('quotes.createFirstQuote')}
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th onClick={() => toggleSort('quoteNumber')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                      {t('quotes.table.quote')}<SortIndicator active={sortBy==='quoteNumber'} />
                    </th>
                    <th onClick={() => toggleSort('customer')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                      {t('quotes.table.customer')}<SortIndicator active={sortBy==='customer'} />
                    </th>
                    <th onClick={() => toggleSort('total')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                      {t('quotes.table.amount')}<SortIndicator active={sortBy==='total'} />
                    </th>
                    <th onClick={() => toggleSort('status')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                      {t('quotes.table.status')}<SortIndicator active={sortBy==='status'} />
                    </th>
                    <th onClick={() => toggleSort('date')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                      {t('quotes.table.date')}<SortIndicator active={sortBy==='date'} />
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('quotes.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              <button
                                onClick={() => openView(item)}
                                className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors cursor-pointer"
                                title={t('quotes.view')}
                              >
                                {item.quoteNumber}
                              </button>
                              {item.version && item.version > 1 && (
                                <span className="ml-2 text-xs text-gray-500">{t('quotes.version', { n: item.version })}</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              {formatDate(item.issueDate)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.customerName}</div>
                          <div className="text-xs text-gray-500">{item.currency}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">{formatAmount(item.total, item.currency)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingQuoteId === item.id && editingField === 'status' ? (
                          <div className="flex items-center space-x-2">
                            <select
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="draft">{t('status.draft')}</option>
                              <option value="sent">{t('status.sent')}</option>
                              <option value="viewed">{t('quotes.statusLabels.viewed')}</option>
                              <option value="accepted">{t('quotes.statusLabels.accepted')}</option>
                              <option value="declined">{t('quotes.statusLabels.declined')}</option>
                              <option value="expired">{t('quotes.statusLabels.expired')}</option>
                            </select>
                            <button onClick={() => saveInlineEdit(item)} className="p-1 text-green-600 hover:bg-green-50 rounded" title={t('common.save')}>
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={cancelInlineEdit} className="p-1 text-red-600 hover:bg-red-50 rounded" title={t('common.cancel')}>
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => startInlineEdit(item.id, 'status', item.status)}
                            className={`${item.status==='accepted' ? 'cursor-default opacity-90' : 'cursor-pointer hover:opacity-80'} inline-block transition-opacity`}
                            title={item.status==='accepted' ? t('quotes.statusLabels.accepted') : t('common.edit')}
                          >
                            {statusBadge(item.status)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {editingQuoteId === item.id && editingField === 'issueDate' ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="date"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button onClick={() => saveInlineEdit(item)} className="p-1 text-green-600 hover:bg-green-50 rounded" title={t('common.save')}>
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={cancelInlineEdit} className="p-1 text-red-600 hover:bg-red-50 rounded" title={t('common.cancel')}>
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => startInlineEdit(item.id, 'issueDate', item.issueDate)}
                            className={`${item.status==='accepted' ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50'} rounded p-1`}
                            title={item.status==='accepted' ? t('quotes.statusLabels.accepted') : t('common.edit')}
                          >
                            {formatDate(item.issueDate)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => openView(item)}
                            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title={t('quotes.view')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              const { generateQuotePDF } = await import('../utils/pdfGenerator');
                              await generateQuotePDF({
                                id: item.id,
                                quoteNumber: item.quoteNumber,
                                customerName: item.customerName,
                                customerId: (item as any).customerId,
                                issueDate: item.issueDate,
                                validUntil: item.validUntil,
                                status: item.status as any,
                                currency: item.currency as any,
                                total: item.total,
                                items: (item.items || []).map(it => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total })),
                              }, { filename: item.quoteNumber });
                            }}
                            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title={t('quotes.actions.downloadPdf')}
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                          {/* Yinele (kopyala) */}
                          <button
                            onClick={() => setDuplicateTarget(item)}
                            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title={t('quotes.actions.duplicate')}
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {item.status !== 'accepted' && (
                          <button 
                            onClick={() => openEdit(item)}
                            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title={t('quotes.edit')}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          )}
                          {item.status !== 'accepted' && (
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={t('quotes.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Gelişmiş Oluşturma Modalı (Extracted Component) */}
      {showCreateModal && (
        <QuoteCreateModal
          isOpen={showCreateModal}
          onClose={closeCreate}
          customers={customers}
          products={products}
          defaultCurrency={defaultCurrency as any}
          onCreate={(payload: QuoteCreatePayload) => {
            const current = Array.isArray(quotes) ? quotes : [];
            // Basit sıra üretici: mevcut local listeden
            const nextIndex = current.length + 1;
            const id = `q${Date.now()}`;
            const quoteNumber = `Q-${new Date().getFullYear()}-${String(nextIndex).padStart(4, '0')}`;
            const next: QuoteItem = {
              id,
              quoteNumber,
              customerName: payload.customer.name,
              customerId: String(payload.customer.id ?? ''),
              issueDate: payload.issueDate,
              validUntil: payload.validUntil,
              currency: payload.currency,
              total: payload.total,
              status: 'draft',
              version: 1,
              items: payload.items,
            };
            setQuotes(prev => [next, ...prev]);
            closeCreate();
          }}
        />
      )}

      {/* Placeholder alt bölüm kaldırıldı */}

      {/* View / Edit Modals */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={true}
          title={t('common.confirm', { defaultValue: 'Onay' })}
          message={t('quotes.deleteConfirm', { defaultValue: `${deleteTarget.quoteNumber} numaralı teklifi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.` })}
          confirmText={t('common.delete', { defaultValue: 'Sil' })}
          cancelText={t('common.cancel', { defaultValue: 'Vazgeç' })}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            const id = deleteTarget?.id;
            if (!id) { setDeleteTarget(null); return; }
            // Listeden kaldır
            setQuotes(prev => prev.filter(q => q.id !== id));
            // Demo öğeler tekrar seed edilmesin diye silinenler listesine ekle
            try {
              const raw = localStorage.getItem('quotes_deleted_ids');
              const arr = raw ? JSON.parse(raw) : [];
              const next = Array.isArray(arr) ? arr : [];
              next.push(String(deleteTarget.id));
              next.push(String(deleteTarget.quoteNumber));
              localStorage.setItem('quotes_deleted_ids', JSON.stringify(Array.from(new Set(next))));
            } catch {}
            setDeleteTarget(null);
          }}
        />
      )}

      <QuoteViewModal
        isOpen={showViewModal}
        onClose={closeView}
        quote={selectedQuote as QuoteModel}
        onEdit={(q) => {
          closeView();
          setTimeout(() => openEdit(q as QuoteItem), 100);
        }}
        onChangeStatus={handleChangeStatus}
        onRevise={(q) => handleRevise(q)}
      />
      <QuoteEditModal
        isOpen={showEditModal}
        onClose={closeEdit}
        quote={selectedQuote as QuoteModel}
        onSave={handleSaveEdit}
        products={products}
      />
    </div>
  );
};

export default QuotesPage;

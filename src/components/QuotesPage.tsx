import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Eye, Edit, Trash2, FileText, Calendar, Check, X, FileDown, Copy } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import QuoteViewModal, { type Quote as QuoteModel, type QuoteStatus } from './QuoteViewModal';
import QuoteEditModal from './QuoteEditModal';
import QuoteCreateModal, { type QuoteCreatePayload } from './QuoteCreateModal';
import QuoteTemplatesManager from './QuoteTemplatesManager';
import ConfirmModal from './ConfirmModal';
import type { Customer, Product } from '../types';
import * as quotesApi from '../api/quotes';
import Pagination from './Pagination';
import SavedViewsBar from './SavedViewsBar';
import { useSavedListViews } from '../hooks/useSavedListViews';
import { useAuth } from '../contexts/AuthContext';
// preset etiketleri i18n'den alınır

interface QuotesPageProps {
  onAddQuote?: () => void;
  customers?: Customer[];
  products?: Product[];
}

interface QuoteItem {
  id: string;
  publicId?: string;
  quoteNumber: string;
  customerName: string;
  customerId?: string;
  issueDate: string;
  validUntil?: string;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  total: number;
  status: QuoteStatus;
  version?: number;
  // İşin kapsamı (zengin metin HTML)
  scopeOfWorkHtml?: string;
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
  createdAt?: string; // ISO
  updatedAt?: string; // ISO
}

const QuotesPage: React.FC<QuotesPageProps> = ({ customers = [], products = [] }) => {
  const { t } = useTranslation();
  const { formatCurrency, currency: defaultCurrency } = useCurrency();
  const { tenant } = useAuth();
  const planRaw = String((tenant as any)?.subscriptionPlan || '').toLowerCase();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'quoteNumber' | 'customer' | 'date' | 'currency' | 'total' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteItem | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [reviseTarget, setReviseTarget] = useState<QuoteItem | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<QuoteItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuoteItem | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('quotes_pageSize') : null;
    const n = saved ? Number(saved) : 20;
    return [20, 50, 100].includes(n) ? n : 20;
  });

  // Inline edit state (status, dates vs.)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'status' | 'issueDate' | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  // Default kaydedilmiş görünümü uygula
  const { getDefault } = useSavedListViews<{ searchTerm: string; statusFilter: typeof statusFilter; startDate?: string; endDate?: string; sortBy?: typeof sortBy; sortDir?: typeof sortDir; pageSize?: number }>({ listType: 'quotes' });
  useEffect(() => {
    const def = getDefault();
    if (def && def.state) {
      try {
        setSearchTerm(def.state.searchTerm ?? '');
        setStatusFilter((def.state.statusFilter as any) ?? 'all');
        setStartDate(def.state.startDate ?? '');
        setEndDate(def.state.endDate ?? '');
        if (def.state.sortBy) setSortBy(def.state.sortBy as any);
        if (def.state.sortDir) setSortDir(def.state.sortDir as any);
        if (def.state.pageSize && [20,50,100].includes(def.state.pageSize)) handlePageSizeChange(def.state.pageSize);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backend verileri
  const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0,10);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await quotesApi.getQuotes();
        if (cancelled) return;
        const mapped = (Array.isArray(data) ? data : []).map((q: any) => ({
          id: String(q.id),
          publicId: q.publicId,
          quoteNumber: q.quoteNumber,
          customerName: q.customer?.name || q.customerName || '',
          customerId: q.customerId,
          issueDate: String(q.issueDate).slice(0,10),
          validUntil: q.validUntil ? String(q.validUntil).slice(0,10) : undefined,
          currency: q.currency,
          total: Number(q.total) || 0,
          status: q.status,
          version: q.version || 1,
          scopeOfWorkHtml: q.scopeOfWorkHtml || '',
          items: Array.isArray(q.items) ? q.items.map((it: any) => ({ id: it.id || `${Math.random()}`, description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total, productId: it.productId, unit: it.unit })) : [],
          revisions: Array.isArray(q.revisions) ? q.revisions : [],
          convertedToSale: false,
          createdAt: q.createdAt || q.created_at || undefined,
          updatedAt: q.updatedAt || q.updated_at || undefined,
          createdByName: q.createdByName,
          updatedByName: q.updatedByName,
        } as QuoteItem));
        setQuotes(mapped);
      } catch (e) {
        console.error('Quotes yüklenemedi:', e);
        setQuotes([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return quotes
      .filter(item => {
        const hay = [item.quoteNumber, item.customerName, item.status, item.currency, item.issueDate, String(item.total)]
          .join(' ').toLowerCase();
        const matchesSearch = q.length === 0 || hay.includes(q);
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        // Tarih aralığı (issueDate bazlı)
        const d = new Date(item.issueDate).toISOString().slice(0,10);
        const withinStart = !startDate || d >= startDate;
        const withinEnd = !endDate || d <= endDate;
        return matchesSearch && matchesStatus && withinStart && withinEnd;
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

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, sortBy, sortDir, startDate, endDate]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    if (typeof window !== 'undefined') {
      localStorage.setItem('quotes_pageSize', String(size));
    }
    setPage(1);
  };

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
      draft:    { label: t('common:status.draft'),    className: 'bg-gray-100 text-gray-800' },
      sent:     { label: t('common:status.sent'),     className: 'bg-blue-100 text-blue-800' },
      viewed:   { label: t('quotes.statusLabels.viewed'),   className: 'bg-indigo-100 text-indigo-800' },
      accepted: { label: t('quotes.statusLabels.accepted'), className: 'bg-green-100 text-green-800' },
      declined: { label: t('quotes.statusLabels.declined'), className: 'bg-red-100 text-red-800' },
      expired:  { label: t('quotes.statusLabels.expired'),  className: 'bg-yellow-100 text-yellow-800' },
    };
    const cfg = map[status];
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.className}`}>{cfg.label}</span>;
  };

  // Yeni teklif oluşturma modalı artık ayrı bir bileşende (QuoteCreateModal)

  const openCreate = () => { setShowCreateModal(true); };
  const closeCreate = () => setShowCreateModal(false);
  const openTemplates = () => setShowTemplates(true);
  const closeTemplates = () => setShowTemplates(false);

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

  // No-op: eski local-only handler'lar kaldırıldı; artık API üzerinden güncelleniyor

  const handleRevise = (q: QuoteModel) => {
    // Önce onay iste
    setReviseTarget(q as any);
  };

  React.useEffect(() => {
    const todayISO = new Date().toISOString().slice(0,10);
    const terminal: QuoteStatus[] = ['accepted', 'declined', 'expired'];
    const updated = quotes.map(q => (!terminal.includes(q.status) && q.validUntil && q.validUntil < todayISO)
      ? { ...q, status: 'expired' as QuoteStatus }
      : q);
    // UI tarafında yalnızca görünüm için güncelleme (persist backend'e ayrık yapılır)
    setQuotes(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local persistence kaldırıldı – backend tek kaynak

  // Senkronizasyon: Başka bir sekmede/public sayfasında durum değişirse listeyi güncelle
  // Storage senkronu kaldırıldı – backend tek kaynak

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

  const saveInlineEdit = async (quote: QuoteItem) => {
    if (!editingField) return;
    try {
      if (editingField === 'status') {
        const nextStatus = tempValue as QuoteStatus;
        const updated = await quotesApi.updateQuote(String(quote.id), { status: nextStatus });
        setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: updated.status } : q));
        setSelectedQuote(prev => (prev && prev.id === quote.id) ? { ...(prev as any), status: updated.status } : prev);
      }
      if (editingField === 'issueDate') {
        const nextDate = tempValue;
        const updated = await quotesApi.updateQuote(String(quote.id), { issueDate: nextDate } as any);
        setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, issueDate: String(updated.issueDate).slice(0,10) } : q));
        setSelectedQuote(prev => (prev && prev.id === quote.id) ? { ...(prev as any), issueDate: String(updated.issueDate).slice(0,10) } : prev);
      }
    } finally {
      setEditingQuoteId(null);
      setEditingField(null);
      setTempValue('');
    }
  };

  // Quotes değiştiğinde dashboard'un kullandığı local cache'i güncelle
  React.useEffect(() => {
    try {
      const tid = (localStorage.getItem('tenantId') || '') as string;
      const key = tid ? `quotes_cache_${tid}` : 'quotes_cache';
      const slim = quotes.map(q => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        customerName: q.customerName,
        customerId: q.customerId,
        issueDate: q.issueDate,
        validUntil: q.validUntil,
        currency: q.currency,
        total: q.total,
        status: q.status,
        version: q.version,
        scopeOfWorkHtml: q.scopeOfWorkHtml,
        items: q.items,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      }));
      localStorage.setItem(key, JSON.stringify(slim));
      try { window.dispatchEvent(new Event('quotes-cache-updated')); } catch {}
    } catch {}
  }, [quotes]);

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
          onConfirm={async () => {
            const src = duplicateTarget;
            if (!src) return;
            // Backend yeni bir teklif üretsin
            try {
              const created = await quotesApi.createQuote({
                customerId: (src as any).customerId,
                customerName: src.customerName,
                issueDate: new Date().toISOString().slice(0,10),
                validUntil: src.validUntil,
                currency: src.currency as any,
                total: src.total,
                status: 'draft',
                items: (src.items || []).map(it => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total, productId: it.productId, unit: it.unit })),
                scopeOfWorkHtml: (src as any).scopeOfWorkHtml || '',
              });
              const mapped: QuoteItem = {
                id: created.id,
                publicId: created.publicId,
                quoteNumber: created.quoteNumber,
                customerName: created.customer?.name || created.customerName || src.customerName,
                customerId: created.customerId,
                issueDate: String(created.issueDate).slice(0,10),
                validUntil: created.validUntil ? String(created.validUntil).slice(0,10) : undefined,
                currency: created.currency,
                total: Number(created.total) || 0,
                status: created.status,
                version: created.version || 1,
                scopeOfWorkHtml: created.scopeOfWorkHtml || '',
                items: Array.isArray(created.items) ? created.items : [],
                createdAt: created.createdAt || new Date().toISOString(),
                updatedAt: created.updatedAt || new Date().toISOString(),
              };
              setQuotes(prev => [mapped, ...prev]);
            } catch (e) {
              console.error('Duplicate quote failed:', e);
            }
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
          onConfirm={async () => {
            const target = reviseTarget;
            if (!target) return;
            const today = new Date();
            const nextIssue = iso(today);
            const nextValid = iso(addDays(today, 30));
            // Geçmişe snapshot al
            const snapshot = {
              version: target.version || 1,
              issueDate: target.issueDate,
              validUntil: target.validUntil,
              status: target.status,
              total: target.total,
              items: target.items ? target.items.map(it => ({ ...it })) : undefined,
              snapshotAt: new Date().toISOString(),
            } as NonNullable<QuoteItem['revisions']>[number];
            try {
              const updated = await quotesApi.updateQuote(String(target.id), {
                status: 'draft',
                issueDate: nextIssue,
                validUntil: nextValid,
                version: (target.version || 1) + 1,
                revisions: [...(target.revisions || []), snapshot],
              } as any);
              setQuotes(prev => prev.map(item => item.id === target.id ? {
                ...item,
                status: updated.status,
                issueDate: String(updated.issueDate).slice(0,10),
                validUntil: updated.validUntil ? String(updated.validUntil).slice(0,10) : undefined,
                version: updated.version || item.version,
                revisions: Array.isArray(updated.revisions) ? updated.revisions : item.revisions,
                updatedAt: updated.updatedAt || item.updatedAt,
              } : item));
              setSelectedQuote(prev => prev && prev.id === target.id ? ({
                ...(prev as any),
                status: 'draft',
                issueDate: nextIssue,
                validUntil: nextValid,
                version: (target.version || 1) + 1,
              }) : prev);
            } catch (e) {
              console.error('Revise failed:', e);
            }
            setReviseTarget(null);
          }}
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('quotes.title')}</h1>
          <p className="text-sm text-gray-500">{t('quotes.comingSoon')}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Şablon oluştur/yönet (Free'de gizli, Pro=1 adet, Business=sınırsız) */}
          {(['professional','pro','enterprise','business'].includes(planRaw)) && (
            <button
              type="button"
              onClick={openTemplates}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title={t('quotes.templates.manageTitle', { defaultValue: 'Teklif şablonlarını yönet' })}
            >
              {t('quotes.templates.manage', { defaultValue: 'Şablonları Yönet' })}
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            {t('quotes.newQuote')}
          </button>
        </div>
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
            <option value="draft">{t('common:status.draft')}</option>
            <option value="sent">{t('common:status.sent')}</option>
            <option value="viewed">{t('quotes.statusLabels.viewed')}</option>
            <option value="accepted">{t('quotes.statusLabels.accepted')}</option>
            <option value="declined">{t('quotes.statusLabels.declined')}</option>
            <option value="expired">{t('quotes.statusLabels.expired')}</option>
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder={t('startDate')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder={t('endDate')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="ml-auto flex items-center">
            <SavedViewsBar
              listType="quotes"
              getState={() => ({ searchTerm, statusFilter, startDate, endDate, sortBy, sortDir, pageSize })}
              applyState={(s) => {
                const st = s || {} as any;
                setSearchTerm(st.searchTerm ?? '');
                setStatusFilter((st.statusFilter as any) ?? 'all');
                setStartDate(st.startDate ?? '');
                setEndDate(st.endDate ?? '');
                if (st.sortBy) setSortBy(st.sortBy);
                if (st.sortDir) setSortDir(st.sortDir);
                if (st.pageSize && [20,50,100].includes(st.pageSize)) handlePageSizeChange(st.pageSize);
              }}
              presets={[
                { id: 'this-month', label: t('presets.thisMonth'), apply: () => {
                  const d = new Date();
                  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
                  const end = new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10);
                  setStartDate(start); setEndDate(end);
                }},
                { id: 'accepted', label: t('quotes.statusLabels.accepted'), apply: () => setStatusFilter('accepted') as any },
                { id: 'declined', label: t('quotes.statusLabels.declined'), apply: () => setStatusFilter('declined') as any },
                { id: 'expired', label: t('quotes.statusLabels.expired'), apply: () => setStatusFilter('expired') as any },
              ]}
            />
          </div>
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
            <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('customer.historyColumns.createdBy')}
                    </th>
                    <th onClick={() => toggleSort('date')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                      {t('quotes.table.date')}<SortIndicator active={sortBy==='date'} />
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      {t('quotes.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginated.map(item => (
                    <React.Fragment key={item.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
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
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{item.customerName}</div>
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
                              <option value="draft">{t('common:status.draft')}</option>
                              <option value="sent">{t('common:status.sent')}</option>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {(item as any).createdByName || '—'}
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium hidden sm:table-cell">
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
                                scopeOfWorkHtml: (item as any).scopeOfWorkHtml || ''
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
                    {/* Mobile actions row */}
                    <tr className="sm:hidden">
                      <td className="px-6 pb-4" colSpan={6}>
                        <div className="flex items-center justify-start gap-3">
                          <button 
                            onClick={() => openView(item)}
                            className="px-2 py-1 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 text-xs"
                            title={t('quotes.view')}
                          >
                            <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" /> {t('quotes.view')}</span>
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
                                scopeOfWorkHtml: (item as any).scopeOfWorkHtml || ''
                              }, { filename: item.quoteNumber });
                            }}
                            className="px-2 py-1 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 text-xs"
                            title={t('quotes.actions.downloadPdf')}
                          >
                            <span className="inline-flex items-center gap-1"><FileDown className="w-3 h-3" /> PDF</span>
                          </button>
                          <button
                            onClick={() => setDuplicateTarget(item)}
                            className="px-2 py-1 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 text-xs"
                            title={t('quotes.actions.duplicate')}
                          >
                            <span className="inline-flex items-center gap-1"><Copy className="w-3 h-3" /> {t('quotes.actions.duplicate')}</span>
                          </button>
                          {item.status !== 'accepted' && (
                            <button 
                              onClick={() => openEdit(item)}
                              className="px-2 py-1 text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100 text-xs"
                              title={t('quotes.edit')}
                            >
                              <span className="inline-flex items-center gap-1"><Edit className="w-3 h-3" /> {t('quotes.edit')}</span>
                            </button>
                          )}
                          {item.status !== 'accepted' && (
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="px-2 py-1 text-red-700 bg-red-50 rounded hover:bg-red-100 text-xs"
                              title={t('quotes.delete')}
                            >
                              <span className="inline-flex items-center gap-1"><Trash2 className="w-3 h-3" /> {t('quotes.delete')}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-gray-200 bg-white">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={filtered.length}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
            </>
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
          onOpenTemplatesManager={openTemplates}
          enableTemplates={['professional','pro','enterprise','business'].includes(planRaw)}
          
          onCreate={async (payload: QuoteCreatePayload) => {
            try {
              const cidRaw = String(payload.customer.id ?? '').trim();
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cidRaw);
              const created = await quotesApi.createQuote({
                customerId: isUuid ? cidRaw : undefined,
                customerName: payload.customer.name,
                issueDate: payload.issueDate,
                validUntil: payload.validUntil,
                currency: payload.currency as any,
                total: payload.total,
                items: payload.items.map(it => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total, productId: it.productId, unit: it.unit })),
                scopeOfWorkHtml: payload.scopeOfWorkHtml || '',
              });
              const next: QuoteItem = {
                id: created.id,
                publicId: created.publicId,
                quoteNumber: created.quoteNumber,
                customerName: created.customer?.name || created.customerName || payload.customer.name,
                customerId: created.customerId,
                issueDate: String(created.issueDate).slice(0,10),
                validUntil: created.validUntil ? String(created.validUntil).slice(0,10) : undefined,
                currency: created.currency,
                total: Number(created.total) || 0,
                status: created.status,
                version: created.version || 1,
                scopeOfWorkHtml: created.scopeOfWorkHtml || '',
                items: Array.isArray(created.items) ? created.items : payload.items,
                createdAt: created.createdAt || new Date().toISOString(),
                updatedAt: created.updatedAt || new Date().toISOString(),
              };
              setQuotes(prev => [next, ...prev]);
            } catch (e) {
              console.error('Quote create failed:', e);
            } finally {
              closeCreate();
            }
          }}
        />
      )}

      {/* Şablon Yönetimi Modal */}
      {showTemplates && (
        <QuoteTemplatesManager isOpen={showTemplates} onClose={closeTemplates} planRaw={planRaw} />
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
          onConfirm={async () => {
            const id = deleteTarget?.id;
            if (!id) { setDeleteTarget(null); return; }
            try {
              await quotesApi.deleteQuote(String(id));
              setQuotes(prev => prev.filter(q => q.id !== id));
            } catch (e) {
              console.error('Delete quote failed:', e);
            }
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
        onChangeStatus={async (q, status) => {
          try {
            const updated = await quotesApi.updateQuote(String(q.id), { status });
            setQuotes(prev => prev.map(item => item.id === q.id ? { ...item, status: updated.status } : item));
            setSelectedQuote(prev => (prev && prev.id === q.id) ? { ...(prev as any), status: updated.status } : prev);
            setQuotes(prev => prev.map(item => item.id === q.id ? { ...item, updatedAt: updated.updatedAt || item.updatedAt } : item));
          } catch (e) {
            console.error('Quote status update failed:', e);
          }
        }}
        onRevise={(q) => handleRevise(q)}
      />
      <QuoteEditModal
        isOpen={showEditModal}
        onClose={closeEdit}
        quote={selectedQuote as QuoteModel}
        onSave={async (updated) => {
          try {
            const saved = await quotesApi.updateQuote(String(updated.id), {
              customerId: (updated as any).customerId,
              customerName: updated.customerName,
              issueDate: updated.issueDate,
              validUntil: updated.validUntil,
              currency: updated.currency as any,
              total: updated.total,
              items: (updated.items || []).map(it => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total, productId: it.productId, unit: it.unit })),
              scopeOfWorkHtml: (updated as any).scopeOfWorkHtml || '',
              status: updated.status,
            } as any);
            setQuotes(prev => prev.map(q => q.id === saved.id ? {
              ...q,
              publicId: saved.publicId || q.publicId,
              customerName: saved.customer?.name || saved.customerName || updated.customerName,
              customerId: saved.customerId,
              issueDate: String(saved.issueDate).slice(0,10),
              validUntil: saved.validUntil ? String(saved.validUntil).slice(0,10) : undefined,
              currency: saved.currency,
              total: Number(saved.total) || 0,
              status: saved.status,
              version: saved.version || q.version,
              scopeOfWorkHtml: saved.scopeOfWorkHtml || '',
              items: Array.isArray(saved.items) ? saved.items : q.items,
              updatedAt: saved.updatedAt || q.updatedAt,
            } : q));
            setSelectedQuote(prev => prev && prev.id === saved.id ? ({
              ...(prev as any),
              customerName: saved.customer?.name || saved.customerName || updated.customerName,
              customerId: saved.customerId,
              issueDate: String(saved.issueDate).slice(0,10),
              validUntil: saved.validUntil ? String(saved.validUntil).slice(0,10) : undefined,
              currency: saved.currency,
              total: Number(saved.total) || 0,
              status: saved.status,
              version: saved.version || (prev as any).version,
              scopeOfWorkHtml: saved.scopeOfWorkHtml || '',
              items: Array.isArray(saved.items) ? saved.items : (prev as any).items,
              updatedAt: saved.updatedAt || (prev as any).updatedAt,
            }) : prev);
          } catch (e) {
            console.error('Quote update failed:', e);
          }
        }}
        products={products}
      />
    </div>
  );
};

export default QuotesPage;

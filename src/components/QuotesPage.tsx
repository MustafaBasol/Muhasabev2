import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Eye, Edit, Trash2, FileText, Calendar, Check, X, FileDown, Copy } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import QuoteViewModal, { type Quote as QuoteModel } from './QuoteViewModal';
import QuoteEditModal from './QuoteEditModal';
import QuoteCreateModal, { type QuoteCreatePayload } from './QuoteCreateModal';
import QuoteTemplatesManager from './QuoteTemplatesManager';
import ConfirmModal from './ConfirmModal';
import type { Customer, Product } from '../types';
import * as quotesApi from '../api/quotes';
import type { CreateQuoteDto, QuoteItemDto, QuoteStatus, QuoteRevision, Quote as QuoteApiModel, UpdateQuoteDto } from '../api/quotes';
import Pagination from './Pagination';
import SavedViewsBar from './SavedViewsBar';
import { useSavedListViews } from '../hooks/useSavedListViews';
import { useAuth } from '../contexts/AuthContext';
import { normalizeStatusKey, resolveStatusLabel } from '../utils/status';
import { readLegacyTenantId, safeLocalStorage } from '../utils/localStorageSafe';
// preset etiketleri i18n'den alınır

interface QuotesPageProps {
  onAddQuote?: () => void;
  customers?: Customer[];
  products?: Product[];
}

type QuoteLineItem = QuoteItemDto & { id: string };

type QuoteApiMetadata = {
  customerName?: string;
  convertedToSale?: boolean;
  createdByName?: string;
  updatedByName?: string;
  customer?: { name?: string | null } | null;
  created_at?: string;
  updated_at?: string;
};

type QuoteListItem = QuoteApiModel & {
  customerName: string;
  convertedToSale?: boolean;
  createdByName?: string;
  updatedByName?: string;
  items?: QuoteLineItem[];
  revisions?: QuoteRevision[];
};

type StatusFilterValue = 'all' | QuoteStatus;
type SortField = 'quoteNumber' | 'customer' | 'date' | 'currency' | 'total' | 'status';
type SortDirection = 'asc' | 'desc';

type QuoteApiRecord = QuoteApiModel & QuoteApiMetadata & {
  issueDate: string | Date;
  validUntil?: string | Date | null;
  total: number | string;
};

interface QuotesListViewState {
  searchTerm: string;
  statusFilter: StatusFilterValue;
  startDate?: string;
  endDate?: string;
  sortBy?: SortField;
  sortDir?: SortDirection;
  pageSize?: number;
}

const randomId = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

const mapLineItemFromApi = (item: QuoteItemDto): QuoteLineItem => ({
  id: item.id ?? randomId(),
  description: item.description,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  total: item.total,
  productId: item.productId,
  unit: item.unit,
});

const mapLineItemToDto = (item: QuoteLineItem): QuoteItemDto => ({
  id: item.id,
  description: item.description,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  total: item.total,
  productId: item.productId,
  unit: item.unit,
});

const mapQuoteFromApi = (quote: QuoteApiRecord): QuoteListItem => ({
  id: String(quote.id),
  publicId: quote.publicId,
  quoteNumber: quote.quoteNumber,
  customerName: quote.customer?.name || quote.customerName || '',
  customerId: quote.customerId,
  issueDate: String(quote.issueDate).slice(0, 10),
  validUntil: quote.validUntil ? String(quote.validUntil).slice(0, 10) : undefined,
  currency: quote.currency,
  total: Number(quote.total) || 0,
  status: normalizeStatusKey(String(quote.status)) as QuoteStatus,
  version: quote.version || 1,
  scopeOfWorkHtml: quote.scopeOfWorkHtml || '',
  items: Array.isArray(quote.items) ? quote.items.map(mapLineItemFromApi) : [],
  revisions: Array.isArray(quote.revisions) ? quote.revisions : [],
  convertedToSale: quote.convertedToSale,
  createdAt: quote.createdAt || quote.created_at || undefined,
  updatedAt: quote.updatedAt || quote.updated_at || undefined,
  createdByName: quote.createdByName,
  updatedByName: quote.updatedByName,
});

const QuotesPage: React.FC<QuotesPageProps> = ({ customers = [], products = [] }) => {
  const { t } = useTranslation();
  const { formatCurrency, currency: defaultCurrency } = useCurrency();
  const { tenant, user: authUser } = useAuth();
  const planRaw = String(tenant?.subscriptionPlan || '').toLowerCase();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteListItem | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [reviseTarget, setReviseTarget] = useState<QuoteListItem | QuoteModel | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<QuoteListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuoteListItem | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = safeLocalStorage.getItem('quotes_pageSize');
    const n = saved ? Number(saved) : 20;
    return [20, 50, 100].includes(n) ? n : 20;
  });

  // Inline edit state (status, dates vs.)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'status' | 'issueDate' | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  // Default kaydedilmiş görünümü uygula
  const { getDefault } = useSavedListViews<QuotesListViewState>({ listType: 'quotes' });
  useEffect(() => {
    try {
      const def = getDefault();
      if (!def?.state) return;
      const state = def.state;
      setSearchTerm(state.searchTerm ?? '');
      setStatusFilter(state.statusFilter ?? 'all');
      setStartDate(state.startDate ?? '');
      setEndDate(state.endDate ?? '');
      if (state.sortBy) setSortBy(state.sortBy);
      if (state.sortDir) setSortDir(state.sortDir);
      if (state.pageSize && [20, 50, 100].includes(state.pageSize)) {
        setPageSize(state.pageSize);
        safeLocalStorage.setItem('quotes_pageSize', String(state.pageSize));
      }
    } catch {
      // Saved view state could not be loaded; fall back to defaults
    }
  }, [getDefault]);

  // Backend verileri
  const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0,10);
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    const fetchQuotes = async () => {
      try {
        setIsLoadingQuotes(true);
        const data = await quotesApi.getQuotes();
        if (cancelled) return;
        const mapped = Array.isArray(data)
          ? (data as QuoteApiRecord[]).map(mapQuoteFromApi)
          : [];
        setQuotes(mapped);
      } catch (e) {
        console.error('Quotes yüklenemedi:', e);
        setQuotes([]);
      } finally {
        if (!cancelled) {
          setIsLoadingQuotes(false);
        }
      }
    };

    fetchQuotes();
    return () => {
      cancelled = true;
    };
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
  }, [quotes, searchTerm, statusFilter, sortBy, sortDir, startDate, endDate]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, sortBy, sortDir, startDate, endDate]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    safeLocalStorage.setItem('quotes_pageSize', String(size));
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
  const formatAmount = (amount: number, currencyCode: QuoteListItem['currency']) => formatCurrency(amount, currencyCode);

  const statusBadge = (status: QuoteStatus) => {
    const key = normalizeStatusKey(String(status));
    const label = resolveStatusLabel(t, key);
    const classMap: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      viewed: 'bg-indigo-100 text-indigo-800',
      accepted: 'bg-green-100 text-green-800',
      declined: 'bg-red-100 text-red-800',
      expired: 'bg-yellow-100 text-yellow-800',
    };
    const cls = classMap[key] || 'bg-gray-100 text-gray-800';
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
  };

  // Yeni teklif oluşturma modalı artık ayrı bir bileşende (QuoteCreateModal)

  const openCreate = () => { setShowCreateModal(true); };
  const closeCreate = () => setShowCreateModal(false);
  const openTemplates = () => setShowTemplates(true);
  const closeTemplates = () => setShowTemplates(false);

  const getCurrentUserName = () => {
    if (!authUser) return '';
    const full = [authUser.firstName, authUser.lastName].filter(Boolean).join(' ').trim();
    if (full) return full;
    return (authUser as { name?: string }).name ?? '';
  };

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

  const openView = (item: QuoteListItem) => {
    setSelectedQuote(item);
    setShowViewModal(true);
  };

  const openEdit = (item: QuoteListItem) => {
    setSelectedQuote(item);
    setShowEditModal(true);
  };

  const closeView = () => setShowViewModal(false);
  const closeEdit = () => setShowEditModal(false);

  // No-op: eski local-only handler'lar kaldırıldı; artık API üzerinden güncelleniyor

  const handleRevise = (q: QuoteModel) => {
    // Önce onay iste
    setReviseTarget(q);
  };

  React.useEffect(() => {
    const todayISO = new Date().toISOString().slice(0,10);
    const terminal: QuoteStatus[] = ['accepted', 'declined', 'expired'];
    const updated = quotes.map(q => (!terminal.includes(q.status) && q.validUntil && q.validUntil < todayISO)
      ? { ...q, status: 'expired' as QuoteStatus }
      : q);
    // UI tarafında yalnızca görünüm için güncelleme (persist backend'e ayrık yapılır)
    setQuotes(updated);
  }, []);

  // Local persistence kaldırıldı – backend tek kaynak

  // Senkronizasyon: Başka bir sekmede/public sayfasında durum değişirse listeyi güncelle
  // Storage senkronu kaldırıldı – backend tek kaynak

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

  const saveInlineEdit = async (quote: QuoteListItem) => {
    if (!editingField) return;
    try {
      if (editingField === 'status') {
        const nextStatus = tempValue as QuoteStatus;
        const updated = await quotesApi.updateQuote(String(quote.id), { status: nextStatus } as UpdateQuoteDto);
        const ns = normalizeStatusKey(String(updated.status)) as QuoteStatus;
        setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: ns } : q));
        setSelectedQuote(prev => {
          if (!prev || prev.id !== quote.id) return prev;
          return { ...prev, status: ns };
        });
      }
      if (editingField === 'issueDate') {
        const nextDate = tempValue;
        const payload: UpdateQuoteDto = { issueDate: nextDate };
        const updated = await quotesApi.updateQuote(String(quote.id), payload);
        const normalizedDate = String(updated.issueDate).slice(0,10);
        setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, issueDate: normalizedDate } : q));
        setSelectedQuote(prev => {
          if (!prev || prev.id !== quote.id) return prev;
          return { ...prev, issueDate: normalizedDate };
        });
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
      const tid = (readLegacyTenantId() || '') as string;
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
      safeLocalStorage.setItem(key, JSON.stringify(slim));
      try { window.dispatchEvent(new Event('quotes-cache-updated')); } catch {
        // Some environments (tests/SSR) might not support window events; safe to ignore
      }
    } catch {
      // Local cache persistence failed (likely storage quota) — continue without cache sync
    }
  }, [quotes]);

  return (
    <div className="space-y-6">
      {/* Yinele onayı */}
      {duplicateTarget && (
        <ConfirmModal
          isOpen={true}
          title={t('common.confirm', { defaultValue: 'Onay' })}
          message={t('quotes.duplicateConfirm', { defaultValue: 'Yinele işlemine devam edilsin mi?' })}
          confirmText={t('common.yes', { defaultValue: 'Evet' })}
          cancelText={t('common.no', { defaultValue: 'Hayır' })}
          onCancel={() => setDuplicateTarget(null)}
          onConfirm={async () => {
            const src = duplicateTarget;
            if (!src) return;
            // Backend yeni bir teklif üretsin
            try {
              const payload: CreateQuoteDto = {
                customerId: src.customerId,
                customerName: src.customerName,
                issueDate: iso(new Date()),
                validUntil: src.validUntil,
                currency: src.currency,
                total: src.total,
                status: 'draft',
                items: (src.items || []).map(mapLineItemToDto),
                scopeOfWorkHtml: src.scopeOfWorkHtml || '',
              };
              const created = await quotesApi.createQuote(payload) as QuoteApiRecord;
              const mapped = mapQuoteFromApi(created);
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
            } as NonNullable<QuoteListItem['revisions']>[number];
            try {
              const updatePayload: UpdateQuoteDto = {
                status: 'draft',
                issueDate: nextIssue,
                validUntil: nextValid,
                version: (target.version || 1) + 1,
                revisions: [...(target.revisions || []), snapshot],
              };
              const updated = await quotesApi.updateQuote(String(target.id), updatePayload);
              setQuotes(prev => prev.map(item => item.id === target.id ? {
                ...item,
                status: normalizeStatusKey(String(updated.status)) as QuoteStatus,
                issueDate: String(updated.issueDate).slice(0,10),
                validUntil: updated.validUntil ? String(updated.validUntil).slice(0,10) : undefined,
                version: updated.version || item.version,
                revisions: Array.isArray(updated.revisions) ? updated.revisions : item.revisions,
                updatedAt: updated.updatedAt || item.updatedAt,
              } : item));
              setSelectedQuote(prev => {
                if (!prev || prev.id !== target.id) return prev;
                return {
                  ...prev,
                  status: 'draft',
                  issueDate: nextIssue,
                  validUntil: nextValid,
                  version: (target.version || 1) + 1,
                };
              });
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
            onChange={(e) => setStatusFilter(e.target.value as StatusFilterValue)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{t('quotes.filterAll')}</option>
            <option value="draft">{t('quotes.statusLabels.draft')}</option>
            <option value="sent">{t('quotes.statusLabels.sent')}</option>
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
              applyState={(state) => {
                if (!state) return;
                setSearchTerm(state.searchTerm ?? '');
                setStatusFilter(state.statusFilter ?? 'all');
                setStartDate(state.startDate ?? '');
                setEndDate(state.endDate ?? '');
                if (state.sortBy) setSortBy(state.sortBy);
                if (state.sortDir) setSortDir(state.sortDir);
                if (state.pageSize && [20,50,100].includes(state.pageSize)) handlePageSizeChange(state.pageSize);
              }}
              presets={[
                { id: 'this-month', label: t('presets.thisMonth'), apply: () => {
                  const d = new Date();
                  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
                  const end = new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10);
                  setStartDate(start); setEndDate(end);
                }},
                { id: 'accepted', label: t('quotes.statusLabels.accepted'), apply: () => setStatusFilter('accepted') },
                { id: 'declined', label: t('quotes.statusLabels.declined'), apply: () => setStatusFilter('declined') },
                { id: 'expired', label: t('quotes.statusLabels.expired'), apply: () => setStatusFilter('expired') },
              ]}
            />
          </div>
        </div>
        {/* Liste */}
        <div className="divide-y divide-gray-200">
          {isLoadingQuotes ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded" />
                ))}
              </div>
            </div>
          ) : filtered.length === 0 ? (
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
                              <option value="draft">{t('quotes.statusLabels.draft')}</option>
                              <option value="sent">{t('quotes.statusLabels.sent')}</option>
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
                        {item.createdByName || '—'}
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
                                customerId: item.customerId,
                                issueDate: item.issueDate,
                                validUntil: item.validUntil,
                                status: item.status,
                                currency: item.currency,
                                total: item.total,
                                items: (item.items || []).map(it => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total })),
                                scopeOfWorkHtml: item.scopeOfWorkHtml || ''
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
                                customerId: item.customerId,
                                issueDate: item.issueDate,
                                validUntil: item.validUntil,
                                status: item.status,
                                currency: item.currency,
                                total: item.total,
                                items: (item.items || []).map(it => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total })),
                                scopeOfWorkHtml: item.scopeOfWorkHtml || ''
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
          defaultCurrency={defaultCurrency}
          onOpenTemplatesManager={openTemplates}
          enableTemplates={['professional','pro','enterprise','business'].includes(planRaw)}
          
          onCreate={async (payload: QuoteCreatePayload) => {
            try {
              const cidRaw = String(payload.customer.id ?? '').trim();
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cidRaw);
              const createPayload: CreateQuoteDto = {
                customerId: isUuid ? cidRaw : undefined,
                customerName: payload.customer.name,
                issueDate: payload.issueDate,
                validUntil: payload.validUntil,
                currency: payload.currency,
                total: payload.total,
                items: payload.items.map(it => ({
                  id: it.id,
                  description: it.description,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  total: it.total,
                  productId: it.productId,
                  unit: it.unit,
                })),
                scopeOfWorkHtml: payload.scopeOfWorkHtml || '',
              };
              const created = await quotesApi.createQuote(createPayload) as QuoteApiRecord;
              const mapped = mapQuoteFromApi(created);
              const currentUserName = getCurrentUserName();
              const next: QuoteListItem = {
                ...mapped,
                createdByName: mapped.createdByName || currentUserName,
                updatedByName: mapped.updatedByName || currentUserName,
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
          setTimeout(() => openEdit(q as QuoteListItem), 100);
        }}
        onChangeStatus={async (q, status) => {
          try {
            const payload: UpdateQuoteDto = { status };
            const updated = await quotesApi.updateQuote(String(q.id), payload);
            const ns = normalizeStatusKey(String(updated.status)) as QuoteStatus;
            setQuotes(prev => prev.map(item => item.id === q.id ? {
              ...item,
              status: ns,
              updatedAt: updated.updatedAt || item.updatedAt,
            } : item));
            setSelectedQuote(prev => {
              if (!prev || prev.id !== q.id) return prev;
              return {
                ...prev,
                status: ns,
                updatedAt: updated.updatedAt || prev.updatedAt,
              };
            });
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
            const updatePayload: UpdateQuoteDto = {
              customerId: updated.customerId,
              customerName: updated.customerName,
              issueDate: updated.issueDate,
              validUntil: updated.validUntil,
              currency: updated.currency as QuoteListItem['currency'],
              total: updated.total,
              items: (updated.items || []).map(it => ({
                id: it.id,
                description: it.description,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                total: it.total,
                productId: it.productId,
                unit: it.unit,
              })),
              scopeOfWorkHtml: updated.scopeOfWorkHtml || '',
              status: updated.status,
            };
            const saved = await quotesApi.updateQuote(String(updated.id), updatePayload) as QuoteApiRecord;
            const normalized = mapQuoteFromApi(saved);
            setQuotes(prev => prev.map(q => q.id === normalized.id ? normalized : q));
            setSelectedQuote(prev => (prev && prev.id === normalized.id) ? normalized : prev);
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

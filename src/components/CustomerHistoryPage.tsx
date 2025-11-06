import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Eye, Download, Link as LinkIcon } from 'lucide-react';
import * as customersApi from '../api/customers';
import * as invoicesApi from '../api/invoices';
import * as quotesApi from '../api/quotes';
import * as salesApi from '../api/sales';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../contexts/AuthContext';
import InvoiceViewModal from './InvoiceViewModal';
import QuoteViewModal, { type Quote as QuoteModel } from './QuoteViewModal';
import SaleViewModal from './SaleViewModal';

// Basit satır tipi birleşik görünüm için
type RowType = 'invoice' | 'sale' | 'quote';
interface HistoryRow {
  id: string;
  type: RowType;
  name: string; // numara veya başlık
  date: string; // ISO YYYY-MM-DD
  status?: string;
  amount?: number;
  createdBy?: string;
  description?: string;
  relatedInvoiceId?: string; // satış için ilişkili fatura
}

const parseHashCustomerId = (): string | null => {
  try {
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('customer-history:')) {
      return hash.split(':')[1] || null;
    }
  } catch {}
  return null;
};

export default function CustomerHistoryPage() {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  // Auth'taki kullanıcı adı fallback olarak kullanılabilir
  // import'u minimum tutmak için dinamik erişim: window.__authUser gibi bir global yok.
  // Bu yüzden createdBy bulunamazsa '—' yerine boş bırakıyoruz; ileride useAuth ekleyebiliriz.
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [customer, setCustomer] = React.useState<any>(null);
  const [rows, setRows] = React.useState<HistoryRow[]>([]);
  const [fromDate, setFromDate] = React.useState<string>('');
  const [toDate, setToDate] = React.useState<string>('');
  const [typeFilter, setTypeFilter] = React.useState<'all' | RowType>('all');
  const [sortBy, setSortBy] = React.useState<'name' | 'date' | 'status' | 'type' | 'createdBy'>('date');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all');

  // View modal state
  const [viewInvoice, setViewInvoice] = React.useState<any | null>(null);
  const [viewQuote, setViewQuote] = React.useState<QuoteModel | null>(null);
  const [viewSale, setViewSale] = React.useState<any | null>(null);

  const [loadingRowId, setLoadingRowId] = React.useState<string | null>(null);

  // Çoklu anahtar denemesi + dil bazlı güvenli fallback
  const tt = (keys: string[], fallbackId?: string): string => {
    for (const k of keys) {
      const out = String(t(k) || '');
      if (out && out !== k) return out;
    }
    if (!fallbackId) return '';
    const lang = (i18n?.language || 'en').toLowerCase();
    const fb: Record<string, Record<string, string>> = {
      'dateRanges.thisMonth': { tr: 'Bu ay', en: 'This month', fr: 'Ce mois-ci', de: 'Dieser Monat' },
      'dateRanges.last30Days': { tr: 'Son 30 gün', en: 'Last 30 days', fr: '30 derniers jours', de: 'Letzte 30 Tage' },
      'dateRanges.thisYear': { tr: 'Bu yıl', en: 'This year', fr: 'Cette année', de: 'Dieses Jahr' },
      'exportCSV': { tr: 'CSV’e aktar', en: 'Export CSV', fr: 'Exporter en CSV', de: 'Als CSV exportieren' },
      'filters.filterByStatus': { tr: 'Duruma göre filtrele', en: 'Filter by status', fr: 'Filtrer par statut', de: 'Nach Status filtern' },
      'filters.status': { tr: 'Durum', en: 'Status', fr: 'Statut', de: 'Status' },
      'total': { tr: 'Toplam', en: 'Total', fr: 'Total', de: 'Gesamt' },
      'actions.view': { tr: 'Görüntüle', en: 'View', fr: 'Voir', de: 'Ansehen' },
      'actions.copyLink': { tr: 'Bağlantıyı kopyala', en: 'Copy link', fr: 'Copier le lien', de: 'Link kopieren' },
      'actions.downloadPDF': { tr: 'PDF indir', en: 'Download PDF', fr: 'Télécharger le PDF', de: 'PDF herunterladen' },
      'actions.clear': { tr: 'Temizle', en: 'Clear', fr: 'Effacer', de: 'Löschen' },
    };
    const code = lang.startsWith('tr') ? 'tr' : lang.startsWith('fr') ? 'fr' : lang.startsWith('de') ? 'de' : 'en';
    return fb[fallbackId]?.[code] || '';
  };

  // Yardımcı: ISO yyyy-mm-dd formatlayıcı
  const toIsoDate = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Hızlı aralıklar
  const applyQuickRange = (kind: 'thisMonth' | 'last30' | 'thisYear') => {
    const today = new Date();
    if (kind === 'thisMonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFromDate(toIsoDate(start));
      setToDate(toIsoDate(end));
    } else if (kind === 'last30') {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      setFromDate(toIsoDate(start));
      setToDate(toIsoDate(today));
    } else if (kind === 'thisYear') {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      setFromDate(toIsoDate(start));
      setToDate(toIsoDate(end));
    }
  };

  // Parse hash on mount
  React.useEffect(() => {
    setCustomerId(parseHashCustomerId());
  }, []);

  // Load customer and related data
  React.useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    (async () => {
      try {
        // Müşteri bilgisi
        let cust: any = null;
        try {
          const listRaw = localStorage.getItem('customers_cache');
          if (listRaw) {
            const list = JSON.parse(listRaw);
            if (Array.isArray(list)) {
              cust = list.find((c: any) => String(c.id) === String(customerId)) || null;
            }
          }
        } catch {}
        if (!cust) {
          try { cust = await customersApi.getCustomer(String(customerId)); } catch {}
        }
        if (!cancelled) setCustomer(cust);

        // Faturalar
        let invoices: any[] = [];
        try { invoices = await invoicesApi.getInvoices(); } catch {}
        // Satışlar: localStorage'tan yükle (API zorunlu değil)
        let sales: any[] = [];
        try {
          const tid = localStorage.getItem('tenantId') || '';
          const sKey = tid ? `sales_${tid}` : 'sales';
          const sCacheKey = tid ? `sales_cache_${tid}` : 'sales_cache';
          const rawA = localStorage.getItem(sKey);
          const rawB = localStorage.getItem(sCacheKey);
          const arrA = rawA ? JSON.parse(rawA) : [];
          const arrB = rawB ? JSON.parse(rawB) : [];
          sales = [...(Array.isArray(arrA)?arrA:[]), ...(Array.isArray(arrB)?arrB:[])];
        } catch {}
        // Teklifler
        let quotes: any[] = [];
        try {
          quotes = await quotesApi.getQuotes();
        } catch {
          try {
            const tid = localStorage.getItem('tenantId') || '';
            const qKey = tid ? `quotes_cache_${tid}` : 'quotes_cache';
            const qRaw = localStorage.getItem(qKey);
            const list = qRaw ? JSON.parse(qRaw) : [];
            if (Array.isArray(list)) quotes = list;
          } catch {}
        }

        // Müşteriye göre filtrele
        const rowsCombined: HistoryRow[] = [];
        const cidStr = String(customerId);

        const getCreatedBy = (obj: any): string | undefined => {
          const tryName = (o: any) => (o?.name || [o?.firstName, o?.lastName].filter(Boolean).join(' ')).trim();
          if (!obj || typeof obj !== 'object') return undefined;
          if (typeof obj.createdBy === 'string' && obj.createdBy.trim()) return obj.createdBy.trim();
          if (obj.createdBy && typeof obj.createdBy === 'object') {
            const n = tryName(obj.createdBy);
            if (n) return n;
          }
          if (typeof obj.createdByName === 'string' && obj.createdByName.trim()) return obj.createdByName.trim();
          if (obj.user && typeof obj.user === 'object') {
            const n = tryName(obj.user);
            if (n) return n;
          }
          if (typeof obj.userName === 'string' && obj.userName.trim()) return obj.userName.trim();
          if (typeof obj.author === 'object') {
            const n = tryName(obj.author);
            if (n) return n;
          }
          return undefined;
        };

        const currentUserName = (() => {
          if (!user) return undefined;
          const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
          return full || user.email || undefined;
        })();

        (invoices || []).forEach((inv: any) => {
          const invCid = String(inv?.customerId || inv?.customer?.id || '');
          const invName = String(inv?.invoiceNumber || inv?.id);
          if (invCid === cidStr || (!invCid && cust && (inv?.customer?.name || inv?.customerName) === cust.name)) {
            const lineSummary = (() => {
              const items = Array.isArray(inv?.lineItems || inv?.items) ? (inv.lineItems || inv.items) : [];
              const first = items[0];
              if (inv?.notes && String(inv.notes).trim()) return String(inv.notes).trim();
              if (first) return String(first.productName || first.description || '').trim();
              return undefined;
            })();
            rowsCombined.push({
              id: String(inv.id),
              type: 'invoice',
              name: invName,
              date: String(inv.issueDate || inv.createdAt || new Date()).slice(0,10),
              status: inv.status,
              amount: Number(inv.total || 0),
              createdBy: getCreatedBy(inv) || currentUserName || '—',
              description: lineSummary,
            });
          }
        });

        (sales || []).forEach((s: any) => {
          const sName = s?.saleNumber || `SAL-${s?.id}`;
          const sCid = String(s?.customerId || '');
          if (sCid === cidStr || (!sCid && cust && (s?.customerName === cust.name || s?.customer?.name === cust.name))) {
            rowsCombined.push({
              id: String(s.id || sName),
              type: 'sale',
              name: sName,
              date: String(s?.saleDate || s?.date || new Date()).slice(0,10),
              status: s?.status,
              amount: Number(s?.amount || s?.total || 0),
              createdBy: getCreatedBy(s) || currentUserName || '—',
              description: s?.productName || (Array.isArray(s?.items) && s.items[0]?.productName) || undefined,
              relatedInvoiceId: s?.invoiceId ? String(s.invoiceId) : undefined,
            });
          }
        });

        (quotes || []).forEach((q: any) => {
          const qCid = String(q?.customerId || '');
          if (qCid === cidStr || (!qCid && cust && (q?.customerName === cust.name || q?.customer?.name === cust.name))) {
            rowsCombined.push({
              id: String(q.id),
              type: 'quote',
              name: q?.quoteNumber || `Q-${q?.id}`,
              date: String(q?.issueDate || new Date()).slice(0,10),
              status: q?.status,
              amount: Number(q?.total || 0),
              createdBy: getCreatedBy(q) || currentUserName || '—',
              description: undefined,
            });
          }
        });

        // Aynı öğelerin yinelenmesini engelle (özellikle satışlar localStorage birden çok yerde olabilir)
        const unique = new Map<string, HistoryRow>();
        for (const r of rowsCombined) {
          const key = `${r.type}:${r.id}`;
          if (!unique.has(key)) unique.set(key, r);
        }
        const deduped = Array.from(unique.values());

        // Sırala (varsayılan: tarihe göre desc)
        deduped.sort((a, b) => (new Date(a.date).getTime() - new Date(b.date).getTime()));
        deduped.reverse();
        if (!cancelled) setRows(deduped);
      } catch (e) {
        // no-op
      }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  const filtered = React.useMemo(() => {
    let list = [...rows];
    if (fromDate) list = list.filter(r => r.date >= fromDate);
    if (toDate) list = list.filter(r => r.date <= toDate);
    if (typeFilter !== 'all') list = list.filter(r => r.type === typeFilter);
    if (statusFilter !== 'all') list = list.filter(r => String(r.status || '').toLowerCase() === String(statusFilter).toLowerCase());
    const dir = sortDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name) * dir;
        case 'status': return (a.status || '').localeCompare(b.status || '') * dir;
        case 'type': return a.type.localeCompare(b.type) * dir;
        case 'createdBy': return (a.createdBy || '').localeCompare(b.createdBy || '') * dir;
        case 'date':
        default:
          return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
      }
    });
  }, [rows, fromDate, toDate, sortBy, sortDir, typeFilter, statusFilter]);

  const totalAmount = React.useMemo(() => {
    const invoiceIds = new Set(
      filtered.filter(r => r.type === 'invoice').map(r => String(r.id))
    );
    return filtered.reduce((acc, r) => {
      if (r.type === 'sale' && r.relatedInvoiceId && invoiceIds.has(String(r.relatedInvoiceId))) {
        // Satışın faturası varsa sadece faturayı say
        return acc;
      }
      return acc + (typeof r.amount === 'number' ? r.amount : 0);
    }, 0);
  }, [filtered]);

  // SortHeader kaldırıldı; başlık hücreleri satır içinde ele alınıyor.

  const getStatusBadge = (statusRaw?: string, type?: RowType) => {
    const status = String(statusRaw || '').toLowerCase();
    const colors: Record<string, string> = {
      paid: 'bg-green-100 text-green-800',
      completed: 'bg-green-100 text-green-800',
      accepted: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      declined: 'bg-red-100 text-red-800',
      cancelled: 'bg-red-100 text-red-800',
      pending: 'bg-amber-100 text-amber-800',
      sent: 'bg-blue-100 text-blue-800',
      viewed: 'bg-blue-100 text-blue-800',
      draft: 'bg-gray-100 text-gray-800',
      invoiced: 'bg-blue-100 text-blue-800',
      created: 'bg-blue-100 text-blue-800',
      refunded: 'bg-purple-100 text-purple-800',
      expired: 'bg-orange-100 text-orange-800',
    };
    const cls = colors[status] || 'bg-gray-100 text-gray-800';
    // Çeviri anahtarının bulunup bulunmadığını t(key) === key ile tespit et
    const tr = (key: string) => {
      const out = t(key) as string;
      return out === key ? '' : out;
    };
    let label = '';
    if (type === 'quote') {
      label = tr(`quotes.statusLabels.${status}`) || tr(`status.${status}`);
    } else {
      label = tr(`status.${status}`) || tr(`quotes.statusLabels.${status}`);
    }
    if (!label) label = status;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{label}</span>
    );
  };

  const typeColor = (type: RowType) =>
    type === 'invoice' ? 'text-blue-600 hover:text-blue-700' : type === 'sale' ? 'text-green-600 hover:text-green-700' : 'text-purple-600 hover:text-purple-700';

  const openRow = async (row: HistoryRow) => {
    try {
      setLoadingRowId(`${row.type}-${row.id}`);
      if (row.type === 'invoice') {
        const inv = await invoicesApi.getInvoice(String(row.id));
        // Map API invoice to InvoiceViewModal expected shape
        const mapped = {
          id: String(inv.id),
          invoiceNumber: inv.invoiceNumber,
          customer: inv.customer || undefined,
          customerName: inv.customer?.name,
          customerEmail: inv.customer?.email,
          total: Number(inv.total) || 0,
          subtotal: Number(inv.subtotal) || 0,
          taxAmount: Number(inv.taxAmount) || 0,
          status: inv.status,
          issueDate: String(inv.issueDate || '').slice(0,10),
          dueDate: String(inv.dueDate || '').slice(0,10),
          items: Array.isArray(inv.lineItems) ? inv.lineItems.map((li: any) => ({
            description: li.productName || li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            total: li.total,
          })) : [],
          notes: inv.notes,
          type: inv.type,
        } as any;
        setViewInvoice(mapped);
      } else if (row.type === 'quote') {
        const q = await quotesApi.getQuote(String(row.id));
        // q zaten QuoteViewModal ile uyumlu sayılabilir
        const mapped: QuoteModel = {
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
        } as any;
        setViewQuote(mapped);
      } else if (row.type === 'sale') {
        const s = await salesApi.getSale(String(row.id));
        const mapped = {
          id: String(s.id),
          saleNumber: s.saleNumber || `SAL-${s.id}`,
          customerName: s.customer?.name || s.customerName || '',
          customerEmail: s.customer?.email || s.customerEmail,
          productName: s.productName || (Array.isArray(s.items) && s.items[0]?.productName) || '',
          quantity: s.quantity,
          unitPrice: s.unitPrice,
          amount: Number(s.amount || s.total || 0),
          total: Number(s.total || s.amount || 0),
          status: (s.status || 'pending') as any,
          date: String(s.saleDate || s.date || new Date()).slice(0,10),
          paymentMethod: s.paymentMethod,
          notes: s.notes,
          productId: s.productId,
          productUnit: s.productUnit,
          invoiceId: s.invoiceId,
          items: Array.isArray(s.items) ? s.items.map((it: any) => ({ productId: it.productId, productName: it.productName, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total })) : [],
        } as any;
        setViewSale(mapped);
      }
    } catch (e) {
      console.error('Open row failed:', e);
    } finally {
      setLoadingRowId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Full-width container like other pages */}
      <div className="w-full px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{t('customer.historyPageTitle') || 'Müşteri Geçmişi'}</h1>
          <p className="text-sm text-slate-500">{customer?.name ? (t('customer.historySubtitle', { name: customer.name }) as string) : (t('customer.historyPageTitle') as string)}</p>
        </div>

        {/* Filtreler (Sticky) */}
        <div className="sticky top-0 z-30">
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col gap-3 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-slate-500">→</span>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={() => applyQuickRange('thisMonth')} className="px-2 py-1 text-xs rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50">
                    {tt(['common.dateRanges.thisMonth','dateRanges.thisMonth'], 'dateRanges.thisMonth')}
                  </button>
                  <button onClick={() => applyQuickRange('last30')} className="px-2 py-1 text-xs rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50">
                    {tt(['common.dateRanges.last30Days','dateRanges.last30Days'], 'dateRanges.last30Days')}
                  </button>
                  <button onClick={() => applyQuickRange('thisYear')} className="px-2 py-1 text-xs rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50">
                    {tt(['common.dateRanges.thisYear','dateRanges.thisYear'], 'dateRanges.thisYear')}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Tür chip butonları */}
                {(['all','invoice','sale','quote'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setTypeFilter(k)}
                    className={`px-3 py-1.5 text-sm rounded-full border ${typeFilter===k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                  >
                    {k === 'all' ? ((t('common.allCategories') as string) || 'Tümü') : k === 'invoice' ? ((t('transactions.invoice') as string) || 'Fatura') : k === 'sale' ? ((t('transactions.sale') as string) || 'Satış') : ((t('quotes.table.quote') as string) || 'Teklif')}
                  </button>
                ))}
                {/* CSV Export */}
                <button
                  onClick={() => {
                    try {
                      const header = ['name','date','status','createdBy','type','description','amount'];
                      const rowsCsv = filtered.map(r => [
                        r.name,
                        new Date(r.date).toLocaleDateString(),
                        r.status || '',
                        r.createdBy || '',
                        r.type,
                        r.type === 'quote' ? '' : (r.description || ''),
                        typeof r.amount === 'number' ? String(r.amount) : ''
                      ]);
                      const csv = [header, ...rowsCsv]
                        .map(cols => cols.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
                        .join('\n');
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      const fileName = `customer-history-${customer?.name ? customer.name.replace(/\s+/g,'-').toLowerCase() : 'export'}.csv`;
                      a.href = url;
                      a.download = fileName;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      console.error('CSV export failed', e);
                    }
                  }}
                  className="ml-2 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  {tt(['common.exportCSV','exportCSV'], 'exportCSV')}
                </button>
              </div>
            </div>
            {statusFilter !== 'all' && (
              <div className="mt-2">
                <span className="text-xs text-slate-500 mr-2">{tt(['filters.status','common.filters.status'], 'filters.status')}:</span>
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {String(statusFilter)}
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                    aria-label={tt(['actions.clear','common.actions.clear'], 'actions.clear')}
                  >
                    ×
                  </button>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Liste */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => setSortBy(prev => { if (prev === 'name') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; } setSortDir('asc'); return 'name'; })}>
                  {t('customer.historyColumns.name') || 'İşlem Adı/No'}
                  <span className="inline-block ml-1 text-gray-400">{sortBy === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => setSortBy(prev => { if (prev === 'date') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; } setSortDir('desc'); return 'date'; })}>
                  {t('customer.historyColumns.date') || 'Tarih'}
                  <span className="inline-block ml-1 text-gray-400">{sortBy === 'date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => setSortBy(prev => { if (prev === 'status') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; } setSortDir('asc'); return 'status'; })}>
                  {t('customer.historyColumns.status') || 'Durum'}
                  <span className="inline-block ml-1 text-gray-400">{sortBy === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => setSortBy(prev => { if (prev === 'createdBy') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; } setSortDir('asc'); return 'createdBy'; })}>
                  {t('customer.historyColumns.createdBy') || 'Oluşturan'}
                  <span className="inline-block ml-1 text-gray-400">{sortBy === 'createdBy' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => setSortBy(prev => { if (prev === 'type') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return prev; } setSortDir('asc'); return 'type'; })}>
                  {t('customer.historyColumns.type') || 'Tür'}
                  <span className="inline-block ml-1 text-gray-400">{sortBy === 'type' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('customer.historyColumns.description') || (t('common.description') as string) || 'Açıklama'}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">{t('quotes.table.amount') || t('amount') || 'Tutar'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map(row => (
                <tr
                  key={`${row.type}:${row.id}`}
                  className={`group hover:bg-slate-50 cursor-pointer ${loadingRowId === `${row.type}-${row.id}` ? 'opacity-60' : ''}`}
                  onClick={() => openRow(row)}
                  title={t('common.view', { defaultValue: 'Görüntüle' }) as string}
                >
                  <td className="px-4 py-3 text-sm font-medium">
                    <span className={`${typeColor(row.type)}`}>{row.name}</span>
                    <span className="ml-2 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Görüntüle */}
                      <button
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title={tt(['actions.view','common.actions.view'],'actions.view')}
                        onClick={(e) => { e.stopPropagation(); openRow(row); }}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {/* PDF sadece fatura için */}
                      {row.type === 'invoice' && (
                        <button
                          className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"
                          title={tt(['actions.downloadPDF','common.actions.downloadPDF'],'actions.downloadPDF')}
                          onClick={(e) => { e.stopPropagation(); openRow(row); /* indir işlemi modal içinde */ }}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {/* Link kopyala */}
                      <button
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded"
                        title={tt(['actions.copyLink','common.actions.copyLink'],'actions.copyLink')}
                        onClick={(e) => {
                          e.stopPropagation();
                          try {
                            const url = `${window.location.origin}${window.location.pathname}?type=${row.type}&id=${encodeURIComponent(row.id)}`;
                            navigator.clipboard?.writeText(url);
                          } catch {}
                        }}
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <button
                      className="hover:opacity-80"
                      onClick={(e) => { e.stopPropagation(); const s = String(row.status || '').toLowerCase(); if (s) setStatusFilter(s as any); }}
                      title={tt(['filters.filterByStatus','common.filters.filterByStatus'], 'filters.filterByStatus')}
                    >
                      {getStatusBadge(row.status, row.type)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.createdBy || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 capitalize">{row.type === 'invoice' ? (t('transactions.invoice') as string) : row.type === 'sale' ? (t('transactions.sale') as string) : (t('quotes.table.quote') as string)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 truncate max-w-[480px]" title={row.type === 'quote' ? undefined : (row.description || undefined)}>{row.type === 'quote' ? '—' : (row.description || '—')}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{typeof row.amount === 'number' ? formatCurrency(row.amount) : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">{t('customer.noHistory') || 'Geçmiş işlem bulunamadı.'}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">{tt(['common.total','total'], 'total')}</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-slate-900">{formatCurrency(totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {/* Modals */}
      <InvoiceViewModal
        isOpen={!!viewInvoice}
        onClose={() => setViewInvoice(null)}
        invoice={viewInvoice}
        onEdit={() => {
          // Bu sayfada sadece görüntüleme var; düzenleme akışı App içinde kurgulanmış olabilir
          setViewInvoice(null);
        }}
      />
      <QuoteViewModal
        isOpen={!!viewQuote}
        onClose={() => setViewQuote(null)}
        quote={viewQuote}
        onEdit={() => setViewQuote(null)}
        onChangeStatus={async (q, status) => {
          try {
            const updated = await quotesApi.updateQuote(String(q.id), { status });
            setViewQuote(prev => prev && prev.id === q.id ? { ...(prev as any), status: updated.status } : prev);
            // Listeyi de güncelle (UI eşliği)
            setRows(prev => prev.map(r => (r.type==='quote' && r.id===q.id) ? { ...r, status: updated.status } : r));
          } catch (e) {
            console.error('Quote status update failed:', e);
          }
        }}
      />
      <SaleViewModal
        isOpen={!!viewSale}
        onClose={() => setViewSale(null)}
        sale={viewSale}
        onEdit={() => setViewSale(null)}
      />
    </div>
  );
}

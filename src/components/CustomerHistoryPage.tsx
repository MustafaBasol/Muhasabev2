import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Eye, Download } from 'lucide-react';
import * as customersApi from '../api/customers';
import * as invoicesApi from '../api/invoices';
import * as quotesApi from '../api/quotes';
import * as salesApi from '../api/sales';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../contexts/AuthContext';
import InvoiceViewModal from './InvoiceViewModal';
import QuoteViewModal, { type Quote as QuoteModel } from './QuoteViewModal';
import SaleViewModal from './SaleViewModal';
import { readLegacyTenantId, safeLocalStorage } from '../utils/localStorageSafe';
import { logger } from '../utils/logger';

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

type InvoiceModalProps = React.ComponentProps<typeof InvoiceViewModal>;
type InvoiceViewModel = NonNullable<InvoiceModalProps['invoice']>;
type SaleModalProps = React.ComponentProps<typeof SaleViewModal>;
type SaleViewModel = NonNullable<SaleModalProps['sale']>;

type CustomerSummary = Partial<Pick<customersApi.Customer, 'id' | 'name' | 'email'>> & {
  firstName?: string;
  lastName?: string;
};

type InvoiceLineSummary = Partial<invoicesApi.InvoiceLineItem> & {
  description?: string;
};

type InvoiceSource = Partial<Pick<
  invoicesApi.Invoice,
  'id' | 'customerId' | 'invoiceNumber' | 'issueDate' | 'createdAt' | 'status' | 'total' | 'subtotal' | 'taxAmount' | 'notes' | 'saleId'
>> & {
  customerName?: string;
  lineItems?: InvoiceLineSummary[];
  items?: InvoiceLineSummary[];
  customer?: CustomerSummary;
  createdBy?: unknown;
  createdByName?: string;
  user?: unknown;
  userName?: string;
  author?: unknown;
};

type SaleItemSummary = Partial<salesApi.SaleItemDto> & {
  total?: number | string;
};

type SaleSource = Partial<Pick<
  salesApi.SaleRecord,
  'id' | 'saleNumber' | 'customerId' | 'customerName' | 'saleDate' | 'date' | 'status' | 'amount' | 'total' | 'paymentMethod' | 'notes' | 'productName' | 'productId' | 'productUnit' | 'quantity' | 'unitPrice' | 'invoiceId' | 'customerEmail'
>> & {
  customer?: CustomerSummary;
  createdBy?: unknown;
  createdByName?: string;
  user?: unknown;
  userName?: string;
  author?: unknown;
  items?: SaleItemSummary[];
};

type QuoteSource = Partial<Pick<
  quotesApi.Quote,
  'id' | 'customerId' | 'customerName' | 'issueDate' | 'status' | 'total' | 'quoteNumber'
>> & {
  customer?: CustomerSummary;
  items?: quotesApi.QuoteItemDto[];
  createdBy?: unknown;
  createdByName?: string;
  user?: unknown;
  userName?: string;
  author?: unknown;
};

type InvoiceWithOptionalItems = invoicesApi.Invoice & { items?: invoicesApi.InvoiceLineItem[] };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const getNameFromObject = (value: unknown): string | undefined => {
  if (!isObject(value)) return undefined;
  const byName = toTrimmedString(value.name);
  const first = toTrimmedString(value.firstName);
  const last = toTrimmedString(value.lastName);
  const combined = [first, last].filter(Boolean).join(' ').trim();
  return byName || (combined ? combined : undefined) || toTrimmedString(value.email);
};

const getCreatedBy = (source: unknown): string | undefined => {
  if (!isObject(source)) return undefined;
  return (
    toTrimmedString(source.createdBy) ||
    getNameFromObject(source.createdBy) ||
    toTrimmedString(source.createdByName) ||
    getNameFromObject(source.user) ||
    toTrimmedString(source.userName) ||
    getNameFromObject(source.author) ||
    getNameFromObject(source)
  );
};

const normalizeCustomer = (value: customersApi.Customer | CustomerSummary | null): CustomerSummary | null => {
  if (!value) return null;
  return {
    id: value.id,
    name: value.name,
    email: value.email,
    firstName: 'firstName' in value ? (value as CustomerSummary).firstName : undefined,
    lastName: 'lastName' in value ? (value as CustomerSummary).lastName : undefined,
  };
};

const getInvoiceItems = (invoice: InvoiceSource): InvoiceLineSummary[] => {
  if (Array.isArray(invoice.items) && invoice.items.length > 0) return invoice.items;
  if (Array.isArray(invoice.lineItems)) return invoice.lineItems;
  return [];
};

const getSaleItems = (sale: SaleSource): SaleItemSummary[] =>
  Array.isArray(sale.items) ? sale.items : [];

const mapSaleStatus = (status?: salesApi.SaleStatus): SaleViewModel['status'] => {
  switch (status) {
    case 'completed':
    case 'invoiced':
    case 'refunded':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
};

const toNumberSafe = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const parseHashCustomerId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('customer-history:')) {
      return hash.split(':')[1] || null;
    }
  } catch (error) {
    logger.debug('CustomerHistoryPage: hash parse failed', error);
  }
  return null;
};

export default function CustomerHistoryPage() {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  // Oturumdaki kullanıcının görünen adı (ad soyad, yoksa e‑posta)
  const currentUserName = React.useMemo(() => {
    if (!user) return undefined;
    const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return full || user.email || undefined;
  }, [user]);

  // Kullanıcı adı sonradan geldiğinde daha önce '—' olarak işaretlenmiş satırları güncelle
  React.useEffect(() => {
    if (!currentUserName) return;
    setRows(prev => {
      let changed = false;
      const next = prev.map(r => {
        if (!r.createdBy || r.createdBy === '—') {
          changed = true;
          return { ...r, createdBy: currentUserName };
        }
        return r;
      });
      return changed ? next : prev;
    });
  }, [currentUserName]);
  // Auth'taki kullanıcı adı fallback olarak kullanılabilir
  // import'u minimum tutmak için dinamik erişim: window.__authUser gibi bir global yok.
  // Bu yüzden createdBy bulunamazsa '—' yerine boş bırakıyoruz; ileride useAuth ekleyebiliriz.
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const [customer, setCustomer] = React.useState<CustomerSummary | null>(null);
  const [rows, setRows] = React.useState<HistoryRow[]>([]);
  const [fromDate, setFromDate] = React.useState<string>('');
  const [toDate, setToDate] = React.useState<string>('');
  const [typeFilter, setTypeFilter] = React.useState<'all' | RowType>('all');
  const [sortBy, setSortBy] = React.useState<'name' | 'date' | 'status' | 'type' | 'createdBy'>('date');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all');

  // View modal state
  const [viewInvoice, setViewInvoice] = React.useState<InvoiceViewModel | null>(null);
  const [viewQuote, setViewQuote] = React.useState<QuoteModel | null>(null);
  const [viewSale, setViewSale] = React.useState<SaleViewModel | null>(null);

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
        let resolvedCustomer: CustomerSummary | null = null;
        try {
          const tid = readLegacyTenantId() || '';
          const cKey = tid ? `customers_cache_${tid}` : 'customers_cache';
          const listRaw = safeLocalStorage.getItem(cKey);
          if (listRaw) {
            const list = JSON.parse(listRaw) as customersApi.Customer[];
            if (Array.isArray(list)) {
              const cached = list.find((c) => String(c.id) === String(customerId));
              if (cached) {
                resolvedCustomer = normalizeCustomer(cached);
              }
            }
          }
        } catch (error) {
          logger.debug('CustomerHistoryPage: customer cache parse failed', error);
        }
        if (!resolvedCustomer) {
          try {
            const fetched = await customersApi.getCustomer(String(customerId));
            resolvedCustomer = normalizeCustomer(fetched);
          } catch (error) {
            logger.warn('CustomerHistoryPage: customer fetch failed', error);
          }
        }
        if (!cancelled) {
          setCustomer(resolvedCustomer);
        }

        let invoices: InvoiceSource[] = [];
        try {
          invoices = await invoicesApi.getInvoices();
        } catch (error) {
          logger.warn('CustomerHistoryPage: invoices fetch failed', error);
        }

        let sales: SaleSource[] = [];
        try {
          sales = await salesApi.getSales();
        } catch (error) {
          logger.warn('CustomerHistoryPage: sales fetch failed, attempting cache', error);
          try {
            const tid = readLegacyTenantId() || '';
            if (tid) {
              const sKey = `sales_${tid}`;
              const sCacheKey = `sales_cache_${tid}`;
              const rawA = safeLocalStorage.getItem(sKey);
              const rawB = safeLocalStorage.getItem(sCacheKey);
              const arrA = rawA ? (JSON.parse(rawA) as SaleSource[]) : [];
              const arrB = rawB ? (JSON.parse(rawB) as SaleSource[]) : [];
              sales = [...(Array.isArray(arrA) ? arrA : []), ...(Array.isArray(arrB) ? arrB : [])];
            }
          } catch (cacheError) {
            logger.debug('CustomerHistoryPage: sales cache fallback failed', cacheError);
            sales = [];
          }
        }

        let quotes: QuoteSource[] = [];
        try {
          quotes = await quotesApi.getQuotes();
        } catch (error) {
          logger.warn('CustomerHistoryPage: quotes fetch failed, attempting cache', error);
          try {
            const tid = readLegacyTenantId() || '';
            const qKey = tid ? `quotes_cache_${tid}` : 'quotes_cache';
            const qRaw = safeLocalStorage.getItem(qKey);
            const list = qRaw ? (JSON.parse(qRaw) as QuoteSource[]) : [];
            if (Array.isArray(list)) quotes = list;
          } catch (cacheError) {
            logger.debug('CustomerHistoryPage: quotes cache fallback failed', cacheError);
          }
        }

        const rowsCombined: HistoryRow[] = [];
        const cidStr = String(customerId);
        const customerName = resolvedCustomer?.name;

        invoices.forEach((inv) => {
          if (!inv) return;
          const invCid = String(inv.customerId ?? inv.customer?.id ?? '');
          const invName = String(inv.invoiceNumber ?? inv.id ?? '');
          logger.debug('[CustomerHistory] invoice mapping', { id: inv.id, currentUserName });
          if (invCid === cidStr || (!invCid && customerName && (inv.customer?.name === customerName || inv.customerName === customerName))) {
            const items = getInvoiceItems(inv);
            const lineSummary = (() => {
              if (inv.notes && String(inv.notes).trim()) return String(inv.notes).trim();
              const first = items[0];
              return toTrimmedString(first?.productName) || toTrimmedString(first?.description);
            })();
            rowsCombined.push({
              id: String(inv.id ?? invName),
              type: 'invoice',
              name: invName,
              date: String(inv.issueDate ?? inv.createdAt ?? new Date()).slice(0, 10),
              status: inv.status,
              amount: Number(inv.total ?? 0),
              createdBy: getCreatedBy(inv) || currentUserName || '—',
              description: lineSummary,
            });
          }
        });

        sales.forEach((sale) => {
          if (!sale) return;
          const sName = sale.saleNumber || (sale.id ? `SAL-${sale.id}` : 'Sale');
          const sCid = String(sale.customerId ?? '');
          logger.debug('[CustomerHistory] sale mapping', { id: sale.id, currentUserName });
          const saleMatchesCustomer =
            sCid === cidStr ||
            (!sCid && customerName && (sale.customerName === customerName || sale.customer?.name === customerName));
          if (saleMatchesCustomer) {
            rowsCombined.push({
              id: String(sale.id ?? sName),
              type: 'sale',
              name: sName,
              date: String(sale.saleDate ?? sale.date ?? new Date()).slice(0, 10),
              status: sale.status,
              amount: Number(sale.amount ?? sale.total ?? 0),
              createdBy: getCreatedBy(sale) || currentUserName || '—',
              description: sale.productName || (getSaleItems(sale)[0]?.productName ?? undefined),
              relatedInvoiceId: sale.invoiceId ? String(sale.invoiceId) : undefined,
            });
          }
        });

        quotes.forEach((quote) => {
          if (!quote) return;
          const qCid = String(quote.customerId ?? '');
          logger.debug('[CustomerHistory] quote mapping', { id: quote.id, currentUserName });
          const quoteMatchesCustomer =
            qCid === cidStr ||
            (!qCid && customerName && (quote.customerName === customerName || quote.customer?.name === customerName));
          if (quoteMatchesCustomer) {
            rowsCombined.push({
              id: String(quote.id ?? `quote-${Date.now()}`),
              type: 'quote',
              name: quote.quoteNumber || `Q-${quote.id ?? rowsCombined.length + 1}`,
              date: String(quote.issueDate ?? new Date()).slice(0, 10),
              status: quote.status,
              amount: Number(quote.total ?? 0),
              createdBy: getCreatedBy(quote) || currentUserName || '—',
              description: undefined,
            });
          }
        });

        const unique = new Map<string, HistoryRow>();
        rowsCombined.forEach((row) => {
          const key = `${row.type}:${row.id}`;
          if (!unique.has(key)) {
            unique.set(key, row);
          }
        });

        const deduped = Array.from(unique.values());
        deduped.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        deduped.reverse();
        if (!cancelled) {
          setRows(deduped);
        }
      } catch (error) {
        logger.error('CustomerHistoryPage: failed to load customer history', error);
      }
    })();
    return () => { cancelled = true; };
  }, [customerId, currentUserName]);

  const normalizeStatusKey = (value?: string) => {
    if (!value) return '';
    return String(value).trim().toLowerCase().replace(/^status\./, '');
  };

  const filtered = React.useMemo(() => {
    let list = [...rows];
    if (fromDate) list = list.filter(r => r.date >= fromDate);
    if (toDate) list = list.filter(r => r.date <= toDate);
    if (typeFilter !== 'all') list = list.filter(r => r.type === typeFilter);
    if (statusFilter !== 'all') list = list.filter(r => normalizeStatusKey(r.status) === normalizeStatusKey(statusFilter));
    const dir = sortDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name) * dir;
        case 'status': return normalizeStatusKey(a.status).localeCompare(normalizeStatusKey(b.status)) * dir;
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
    const status = normalizeStatusKey(statusRaw);
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
    const translateStatus = () => {
      if (!status) return t('status.unknown', { defaultValue: 'Bilinmiyor' }) as string;
      if (type === 'quote') {
        const quoteKey = `quotes.statusLabels.${status}`;
        const quoteLabel = t(quoteKey) as string;
        if (quoteLabel && quoteLabel !== quoteKey) return quoteLabel;
      }
      const commonKey = `common:status.${status}`;
      const commonLabel = t(commonKey) as string;
      if (commonLabel && commonLabel !== commonKey) return commonLabel;
      const genericKey = `status.${status}`;
      const genericLabel = t(genericKey) as string;
      if (genericLabel && genericLabel !== genericKey) return genericLabel;
      return status;
    };
    const label = translateStatus();
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
        const invoiceWithItems = inv as InvoiceWithOptionalItems;
        let items: invoicesApi.InvoiceLineItem[] = Array.isArray(invoiceWithItems.items) && invoiceWithItems.items.length > 0
          ? invoiceWithItems.items
          : Array.isArray(inv.lineItems)
            ? inv.lineItems
            : [];
        if (items.length === 0 && inv.saleId) {
          try {
            const sale = await salesApi.getSale(String(inv.saleId));
            if (Array.isArray(sale.items)) {
              items = sale.items.map((it) => ({
                description: it.productName || it.description || 'Ürün/Hizmet',
                quantity: toNumberSafe(it.quantity ?? 1),
                unitPrice: toNumberSafe(it.unitPrice ?? 0),
                total: toNumberSafe(it.total ?? toNumberSafe(it.unitPrice ?? 0) * toNumberSafe(it.quantity ?? 1)),
                productId: it.productId,
              }));
            }
          } catch (error) {
            logger.warn('CustomerHistoryPage: unable to derive invoice items from sale', error);
          }
        }

        const mappedCustomer = inv.customer
          ? {
              id: inv.customer.id,
              name: inv.customer.name,
              email: inv.customer.email,
            }
          : undefined;

        const mapped: InvoiceViewModel = {
          id: String(inv.id),
          invoiceNumber: inv.invoiceNumber,
          customer: mappedCustomer,
          customerName: inv.customer?.name,
          customerEmail: inv.customer?.email,
          total: toNumberSafe(inv.total),
          subtotal: toNumberSafe(inv.subtotal),
          taxAmount: toNumberSafe(inv.taxAmount),
          status: inv.status,
          issueDate: String(inv.issueDate || '').slice(0, 10),
          dueDate: String(inv.dueDate || '').slice(0, 10),
          items: items.map((li) => ({
            description: li.description ?? (li as InvoiceLineSummary).productName ?? '',
            quantity: toNumberSafe(li.quantity ?? 1),
            unitPrice: toNumberSafe(li.unitPrice ?? 0),
            total: toNumberSafe(li.total ?? toNumberSafe(li.unitPrice ?? 0) * toNumberSafe(li.quantity ?? 1)),
          })),
          notes: inv.notes,
          type: inv.type,
        };
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
          items: Array.isArray(q.items)
            ? q.items.map((it, index) => ({
                id: String(it.id ?? `quote-item-${index}`),
                description: it.description,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                total: it.total,
                productId: it.productId,
                unit: it.unit,
              }))
            : [],
          revisions: Array.isArray(q.revisions) ? q.revisions : [],
        };
        setViewQuote(mapped);
      } else if (row.type === 'sale') {
        const s = await salesApi.getSale(String(row.id));
        const firstItem = Array.isArray(s.items) && s.items.length > 0 ? s.items[0] : undefined;
        const quantity = toNumberSafe(s.quantity ?? firstItem?.quantity ?? 1);
        let unitPrice = toNumberSafe(s.unitPrice ?? firstItem?.unitPrice ?? 0);
        const totalFromSale = toNumberSafe(s.total ?? s.amount ?? quantity * unitPrice);
        if ((unitPrice === 0 || !Number.isFinite(unitPrice)) && totalFromSale > 0 && quantity > 0) {
          unitPrice = totalFromSale / quantity;
        }
        const mapped: SaleViewModel = {
          id: String(s.id),
          saleNumber: s.saleNumber || `SAL-${s.id}`,
          customerName: s.customer?.name || s.customerName || (customer?.name || ''),
          customerEmail: s.customer?.email || s.customerEmail || customer?.email,
          productName: s.productName || firstItem?.productName || '',
          quantity,
          unitPrice: unitPrice || 0,
          amount: totalFromSale || quantity * unitPrice,
          total: totalFromSale || quantity * unitPrice,
          status: mapSaleStatus(s.status),
          date: String(s.saleDate || s.date || new Date()).slice(0,10),
          paymentMethod: s.paymentMethod,
          notes: s.notes,
          productId: s.productId || firstItem?.productId,
          productUnit: s.productUnit || firstItem?.unit,
          invoiceId: s.invoiceId,
          items: Array.isArray(s.items)
            ? s.items.map((it) => ({
                productId: it.productId,
                productName: it.productName || '',
                quantity: toNumberSafe(it.quantity),
                unitPrice: toNumberSafe(it.unitPrice),
                total: toNumberSafe(it.total ?? toNumberSafe(it.unitPrice) * toNumberSafe(it.quantity)),
              }))
            : [],
        };
        setViewSale(mapped);
      }
    } catch (error) {
      logger.error('CustomerHistoryPage: openRow failed', error);
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
                        r.createdBy || currentUserName || '',
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
                    } catch (error) {
                      logger.error('CustomerHistoryPage: CSV export failed', error);
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
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              setLoadingRowId(`invoice-${row.id}-pdf`);
                              const inv = await invoicesApi.getInvoice(String(row.id));
                              try {
                                window.dispatchEvent(new CustomEvent('download-invoice', { detail: { invoice: inv } }));
                              } catch (error) {
                                logger.debug('CustomerHistoryPage: inline invoice download dispatch failed', error);
                              }
                            } catch (error) {
                              logger.error('CustomerHistoryPage: invoice PDF download failed', error);
                            } finally {
                              setLoadingRowId(null);
                            }
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {getStatusBadge(row.status, row.type)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.createdBy || currentUserName || '—'}</td>
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
        onEdit={(inv: InvoiceViewModel) => {
          // App tarafından yakalanacak global event ile düzenleme modalını aç
          try {
            window.dispatchEvent(new CustomEvent('open-invoice-edit', { detail: { invoice: inv } }));
          } catch (error) {
            logger.debug('CustomerHistoryPage: invoice edit event dispatch failed', error);
          }
          setViewInvoice(null);
        }}
        onDownload={(inv: InvoiceViewModel) => {
          try {
            window.dispatchEvent(new CustomEvent('download-invoice', { detail: { invoice: inv } }));
          } catch (error) {
            logger.debug('CustomerHistoryPage: invoice download event dispatch failed', error);
          }
        }}
      />
      <QuoteViewModal
        isOpen={!!viewQuote}
        onClose={() => setViewQuote(null)}
        quote={viewQuote}
        onEdit={(q) => {
          // Global event ile ana uygulamada düzenleme modalını aç
          try {
            window.dispatchEvent(new CustomEvent('open-quote-edit', { detail: { quote: q } }));
          } catch (error) {
            logger.debug('CustomerHistoryPage: quote edit event dispatch failed', error);
          }
          setViewQuote(null);
        }}
        onChangeStatus={async (q, status) => {
          try {
            const updated = await quotesApi.updateQuote(String(q.id), { status });
            setViewQuote(prev => (prev && prev.id === q.id) ? { ...prev, status: updated.status } : prev);
            // Listeyi de güncelle (UI eşliği)
            setRows(prev => prev.map(r => (r.type==='quote' && r.id===q.id) ? { ...r, status: updated.status } : r));
          } catch (error) {
            logger.error('CustomerHistoryPage: quote status update failed', error);
          }
        }}
      />
      <SaleViewModal
        isOpen={!!viewSale}
        onClose={() => setViewSale(null)}
        sale={viewSale}
        onEdit={(s) => {
          try {
            window.dispatchEvent(new CustomEvent('open-sale-edit', { detail: { sale: s } }));
          } catch (error) {
            logger.debug('CustomerHistoryPage: sale edit event dispatch failed', error);
          }
          setViewSale(null);
        }}
      />
    </div>
  );
}

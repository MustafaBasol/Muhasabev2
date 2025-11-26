import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Plus, Calendar, DollarSign, User, Package, Search, Eye, Edit, Trash2, Download, Check, X, FileText, CheckCircle, Loader2 } from 'lucide-react';
import SaleModal from './SaleModal';
import SaleViewModal from './SaleViewModal';
import InvoiceViewModal from './InvoiceViewModal';
import type { Customer, Invoice, Product, Sale } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { compareBy, defaultStatusOrderSales, normalizeText, parseDateSafe, toNumberSafe, SortDir } from '../utils/sortAndSearch';
import Pagination from './Pagination';
import SavedViewsBar from './SavedViewsBar';
import { useSavedListViews } from '../hooks/useSavedListViews';
import { normalizeStatusKey, resolveStatusLabel } from '../utils/status';
// preset etiketleri i18n'den alınır
import { safeLocalStorage } from '../utils/localStorageSafe';
import { logger } from '../utils/logger';



const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;

  if (s.includes('.') && s.includes(',')) {
    const withoutThousands = s.replace(/\./g, '');
    const withDotDecimal = withoutThousands.replace(/,/g, '.');
    const n = parseFloat(withDotDecimal);
    return Number.isFinite(n) ? n : 0;
  }
  if (s.includes(',') && !s.includes('.')) {
    const n = parseFloat(s.replace(/,/g, '.'));
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseFloat(s.replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const escapeCsvValue = (value: unknown): string => {
  if (value == null) return '';
  const normalized = String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

const resolveSaleTotal = (sale: Sale): number => {
  if (Array.isArray(sale.items) && sale.items.length > 0) {
    return sale.items.reduce((sum, item) => sum + toNumber(item.unitPrice) * toNumber(item.quantity), 0);
  }
  const quantity = toNumber(sale.quantity ?? 0);
  const unitPrice = toNumber(sale.unitPrice ?? 0);
  if (quantity > 0 && unitPrice > 0) {
    return quantity * unitPrice;
  }
  return toNumber(sale.amount ?? sale.total ?? 0);
};

type SaleMetadata = Partial<{
  createdByName: string;
  createdAt: string;
  updatedByName: string;
  updatedAt: string;
}>;

type SaleWithMetadata = Sale & SaleMetadata;

type SaleInput = Partial<Sale> & {
  createInvoice?: boolean;
  saleDate?: string;
  taxRate?: number;
};

type InvoiceLineItemInput = {
  id?: string | number;
  productId?: string | number;
  productName?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRate?: number;
};

interface InvoiceCreationPayload {
  saleId?: string | number;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
  type?: 'product' | 'service';
  issueDate?: string;
  dueDate?: string;
  status?: string;
  items?: InvoiceLineItemInput[];
  lineItems?: InvoiceLineItemInput[];
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  notes?: string;
  invoiceNumber?: string;
  id?: string | number;
}

type InvoiceWithRelations = Invoice & {
  customer?: Customer;
  saleId?: string | number;
};

interface SimpleSalesPageProps {
  customers?: Customer[];
  sales?: SaleWithMetadata[];
  invoices?: InvoiceWithRelations[];
  onSalesUpdate?: (sales: SaleWithMetadata[]) => void;
  onUpsertSale?: (sale: SaleInput) => void; // Tek satış için
  onCreateInvoice?: (invoiceData: InvoiceCreationPayload) => Promise<InvoiceWithRelations | void>;
  onEditInvoice?: (invoice: InvoiceWithRelations) => void;
  onDownloadSale?: (sale: SaleWithMetadata) => void;
  products?: Product[];
  onDeleteSale?: (id: string | number) => Promise<void> | void; // Opsiyonel: üst komponent kalıcı silsin
}

type SalesSortField = 'saleNumber' | 'customer' | 'product' | 'amount' | 'status' | 'date';

type SimpleSalesViewState = {
  searchTerm: string;
  statusFilter: string;
  startDate?: string;
  endDate?: string;
  sortBy?: SalesSortField;
  sortDir?: SortDir;
  pageSize?: number;
};

const SALES_PAGE_SIZES = [20, 50, 100] as const;
const isValidSalesPageSize = (value: number): value is (typeof SALES_PAGE_SIZES)[number] =>
  SALES_PAGE_SIZES.includes(value as (typeof SALES_PAGE_SIZES)[number]);

const getSavedSalesPageSize = (): number => {
  const saved = safeLocalStorage.getItem('sales_pageSize');
  const parsed = saved ? Number(saved) : SALES_PAGE_SIZES[0];
  return isValidSalesPageSize(parsed) ? parsed : SALES_PAGE_SIZES[0];
};

export default function SimpleSalesPage({ customers = [], sales = [], invoices = [], products = [], onSalesUpdate, onUpsertSale, onCreateInvoice, onEditInvoice, onDownloadSale, onDeleteSale }: SimpleSalesPageProps) {
  const { t, i18n } = useTranslation('common');
  const { formatCurrency } = useCurrency();
  
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showSaleViewModal, setShowSaleViewModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showInvoiceConfirmModal, setShowInvoiceConfirmModal] = useState(false);
  const [showInvoiceViewModal, setShowInvoiceViewModal] = useState(false);
  const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState<SaleWithMetadata | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceWithRelations | null>(null);
  const [pendingSale, setPendingSale] = useState<SaleInput | null>(null);
  const [viewingSale, setViewingSale] = useState<SaleWithMetadata | null>(null);
  const [editingSale, setEditingSale] = useState<SaleWithMetadata | null>(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [editingField, setEditingField] = useState<{ saleId: string; field: 'amount' | 'status' } | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [sortBy, setSortBy] = useState<SalesSortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => getSavedSalesPageSize());

  // Default kaydedilmiş görünüm uygula
  const { getDefault } = useSavedListViews<SimpleSalesViewState>({ listType: 'sales' });
  useEffect(() => {
    const def = getDefault();
    if (def && def.state) {
      try {
        setSearchTerm(def.state.searchTerm ?? '');
        setStatusFilter(def.state.statusFilter ?? 'all');
        setStartDate(def.state.startDate ?? '');
        setEndDate(def.state.endDate ?? '');
        if (def.state.sortBy) setSortBy(def.state.sortBy);
        if (def.state.sortDir) setSortDir(def.state.sortDir);
        if (def.state.pageSize && isValidSalesPageSize(def.state.pageSize)) {
          handlePageSizeChange(def.state.pageSize);
        }
      } catch (error) {
        logger.warn('Failed to hydrate simple sales saved view', error);
      }
    }
  }, []);

  const handleAddSale = (newSale: SaleInput) => {
    logger.info('simpleSales.addSale.request', {
      viaUpsert: Boolean(onUpsertSale),
      createInvoice: Boolean(newSale.createInvoice),
    });
    // Eğer onUpsertSale varsa kullan (numara oluşturma için)
    if (onUpsertSale) {
      onUpsertSale(newSale);
      setShowSaleModal(false);
      setEditingSale(null);
    } else {
      // Fallback: eski yöntem
      setPendingSale(newSale);
      setShowConfirmationModal(true);
    }
  };

  const handleConfirmSale = (createInvoice: boolean) => {
    if (!pendingSale) return;

    logger.info('simpleSales.confirmation.accepted', {
      pendingSaleId: pendingSale.id,
      createInvoice,
    });

    const fallbackId = pendingSale.id ? String(pendingSale.id) : `temp-${Date.now()}`;
    const saleDate = pendingSale.date ?? pendingSale.saleDate ?? new Date().toISOString().split('T')[0];
    const quantity = toNumber(pendingSale.quantity ?? 1) || 1;
    const rawUnitPrice = toNumber(pendingSale.unitPrice ?? 0);
    const rawAmount = toNumber(pendingSale.total ?? pendingSale.amount ?? rawUnitPrice * quantity);
    const normalizedUnitPrice = quantity > 0 ? rawAmount / quantity : rawAmount;

    const saleToAdd: SaleWithMetadata = {
      id: fallbackId,
      saleNumber: pendingSale.saleNumber,
      customerName: pendingSale.customerName ?? '—',
      customerEmail: pendingSale.customerEmail,
      productName: pendingSale.productName ?? '—',
      quantity,
      unitPrice: normalizedUnitPrice,
      amount: rawAmount,
      total: rawAmount,
      date: saleDate,
      status: pendingSale.status ?? 'completed',
      paymentMethod: pendingSale.paymentMethod,
      items: pendingSale.items,
      notes: pendingSale.notes,
    };
    
    const updatedSales = [saleToAdd, ...sales];
    
    if (onSalesUpdate) {
      onSalesUpdate(updatedSales);
    }
    
    // Create invoice if requested
    if (createInvoice && onCreateInvoice) {
      // Varsayılan vergi oranı (ürün üzerinde yoksa)
      const defaultTaxRate = 18;
      const saleTaxRate = (pendingSale as Sale & { taxRate?: number })?.taxRate ?? defaultTaxRate;
      const qty = quantity;
      const grossTotal = rawAmount; // KDV dahil tutar
      const grossUnit = normalizedUnitPrice || (grossTotal / qty);
      // Net (KDV hariç) birim fiyat
      const netUnit = grossUnit / (1 + saleTaxRate / 100);
      const netLineTotal = netUnit * qty;
      const invoiceData = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
        customerName: pendingSale.customerName,
        customerEmail: pendingSale.customerEmail || '',
        customerAddress: '',
        issueDate: saleDate,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'sent',
        type: 'product',
        items: [{
          id: '1',
          description: pendingSale.productName,
          quantity: qty,
          unitPrice: netUnit,      // KDV hariç birim fiyat
          total: netLineTotal       // KDV hariç toplam
        }],
        subtotal: netLineTotal,
        taxAmount: grossTotal - netLineTotal,
        total: grossTotal,
        notes: `Bu fatura ${pendingSale.saleNumber || `SAL-${pendingSale.id}`} numaralı satıştan otomatik oluşturulmuştur.`
      };
      
      onCreateInvoice(invoiceData);
      
      // Auto-download PDF after a short delay
      setTimeout(() => {
        if (onDownloadSale) {
          onDownloadSale(saleToAdd);
        }
      }, 500);
    }
    
    // Close modal and reset
    setShowConfirmationModal(false);
    setPendingSale(null);
  };

  const handleEditSale = (sale: SaleWithMetadata) => {
    logger.info('simpleSales.edit.opened', {
      saleId: sale.id,
      saleNumber: sale.saleNumber,
    });
    setEditingSale(sale);
    setShowSaleModal(true);
  };

  const handleUpdateSale = (updatedSale: SaleInput) => {
    logger.info('simpleSales.edit.submitted', {
      viaUpsert: Boolean(onUpsertSale),
      saleId: updatedSale.id,
    });
    // Eğer onUpsertSale varsa kullan
    if (onUpsertSale) {
      onUpsertSale(updatedSale);
      setEditingSale(null);
      setShowSaleModal(false);
    } else {
      // Fallback: eski yöntem
      const updatedSales = sales.map((saleRecord) => 
        updatedSale.id && String(saleRecord.id) === String(updatedSale.id)
          ? ({ ...saleRecord, ...updatedSale } as SaleWithMetadata)
          : saleRecord
      );
      if (onSalesUpdate) {
        onSalesUpdate(updatedSales);
      }
      setEditingSale(null);
    }
  };

  const handleDeleteSale = async (saleId: string | number) => {
    if (onDeleteSale) {
      // Üst komponent (App) kendi ConfirmModal'ını gösterecek
      await onDeleteSale(saleId);
      return;
    }
    // Geriye uyumluluk: yerel listeden kaldırmadan önce basit onay
    if (!confirm(t('sales.deleteConfirm'))) return;
    const updatedSales = sales.filter(sale => String(sale.id) !== String(saleId));
    onSalesUpdate?.(updatedSales);
    if (showSaleViewModal) {
      setShowSaleViewModal(false);
      setViewingSale(null);
    }
  };

  const handleViewSale = (sale: SaleWithMetadata) => {
    setViewingSale(sale);
    setShowSaleViewModal(true);
  };

  const formatAmount = useCallback((amount: unknown) => {
    const numeric = toNumber(amount);
    return formatCurrency(numeric);
  }, [formatCurrency]);

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return '—';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return '—';
    const language = i18n.language || 'en';
    const locale = language.startsWith('tr') ? 'tr-TR' : language;
    try {
      return parsed.toLocaleDateString(locale);
    } catch (error) {
      logger.warn('Failed to format sale date', { dateString, error });
      return parsed.toLocaleDateString('en-US');
    }
  }, [i18n.language]);

  const getPaymentMethodLabel = useCallback((method?: Sale['paymentMethod']) => {
    if (!method) return '';
    switch (method) {
      case 'cash':
        return t('common.cash');
      case 'card':
        return t('common.card');
      case 'transfer':
        return t('common.transfer');
      case 'check':
        return t('common.check');
      default:
        return method;
    }
  }, [t]);

  // Net toplam (KDV Hariç): her satış için kalemler varsa unitPrice*quantity toplamı; yoksa tek ürün çarpımı
  const totalSales = sales.reduce((sum, sale) => sum + resolveSaleTotal(sale), 0);
  const completedSales = sales.filter(sale => sale.status === 'completed').length;

  // Dil bazlı net satış etiketi suffix'i
  const lang = (i18n.language || '').toLowerCase();
  const netSuffix = lang.startsWith('tr') ? ' (KDV Hariç)' :
    lang.startsWith('en') ? ' (Net of VAT)' :
    lang.startsWith('fr') ? ' (HT)' :
    lang.startsWith('de') ? ' (netto)' : '';

  const filteredSales = sales
    .filter(sale => {
      const q = normalizeText(debouncedSearch);
      const firstItemName = (sale.items && sale.items.length > 0) ? (sale.items[0].productName || '') : '';
      const statusKey = (sale.status || '').toString().toLowerCase();
      const statusVariant = ['completed','paid','invoiced','approved'].includes(statusKey)
        ? 'completed'
        : (['cancelled','canceled','void','refunded','deleted'].includes(statusKey) ? 'cancelled'
          : (['pending','created','new','draft','open','processing'].includes(statusKey) ? 'pending' : 'pending'));
      const haystack = [
        sale.saleNumber,
        sale.customerName,
        sale.customerEmail,
        sale.productName,
        firstItemName,
        statusVariant,
        sale.date,
        String(resolveSaleTotal(sale))
      ].map(normalizeText).join(' ');

      const matchesSearch = q.length === 0 || haystack.includes(q);
      const matchesStatus = statusFilter === 'all' || statusVariant === statusFilter;
      // Tarih aralığı (sale.date bazlı)
      const d = (sale.date || '').slice(0,10);
      const withinStart = !startDate || d >= startDate;
      const withinEnd = !endDate || d <= endDate;
      return matchesSearch && matchesStatus && withinStart && withinEnd;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'saleNumber':
          return compareBy(a, b, x => x.saleNumber || `SAL-${x.id}`, sortDir, 'string');
        case 'customer':
          return compareBy(a, b, x => x.customerName || '', sortDir, 'string');
        case 'product': {
          const sel = (x: SaleWithMetadata) => (x.items && x.items.length > 0) ? (x.items[0].productName || '') : (x.productName || '');
          return compareBy(a, b, sel, sortDir, 'string');
        }
        case 'amount': {
          const sel = (x: SaleWithMetadata) => toNumberSafe(x.amount ?? x.total ?? toNumberSafe(x.quantity) * toNumberSafe(x.unitPrice));
          return compareBy(a, b, sel, sortDir, 'number');
        }
        case 'status':
          return compareBy(a, b, x => x.status, sortDir, 'string', defaultStatusOrderSales);
        case 'date':
        default:
          return compareBy(a, b, x => parseDateSafe(x.date), sortDir, 'date');
      }
    });

  const paginatedSales = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, page, pageSize]);

  const handleExportSales = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!filteredSales.length) {
      logger.info('simpleSales.export.skipped', { reason: 'empty' });
      return;
    }

    try {
      const headers = [
        t('sales.sale', { defaultValue: 'Sale' }),
        t('sales.customer', { defaultValue: 'Customer' }),
        t('sales.productService', { defaultValue: 'Product/Service' }),
        t('sales.amount', { defaultValue: 'Amount' }),
        t('sales.status', { defaultValue: 'Status' }),
        t('sales.date', { defaultValue: 'Date' }),
        t('sales.paymentMethod', { defaultValue: 'Payment Method' }),
      ];

      const rows = filteredSales.map((sale) => {
        const status = resolveStatusLabel(t, normalizeStatusKey(sale.status));
        const itemsLabel = Array.isArray(sale.items) && sale.items.length > 0
          ? `${sale.items[0].productName}${sale.items.length > 1 ? ` (+${sale.items.length - 1})` : ''}`
          : sale.productName;
        return [
          sale.saleNumber || `SAL-${sale.id}`,
          sale.customerName,
          itemsLabel,
          formatAmount(resolveSaleTotal(sale)),
          status,
          formatDate(sale.date),
          getPaymentMethodLabel(sale.paymentMethod) || '—',
        ];
      });

      const csvContent = [headers, ...rows]
        .map((row) => row.map(escapeCsvValue).join(','))
        .join('\r\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sales_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      logger.info('simpleSales.export.completed', { rowCount: rows.length });
    } catch (error) {
      logger.error('simpleSales.export.failed', { error });
    }
  }, [filteredSales, formatAmount, formatDate, getPaymentMethodLabel, t]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, sortBy, sortDir, startDate, endDate]);

  const handlePageSizeChange = (size: number) => {
    if (!isValidSalesPageSize(size)) {
      logger.warn('Attempted to set invalid sales page size', size);
      return;
    }
    setPageSize(size);
    safeLocalStorage.setItem('sales_pageSize', String(size));
    setPage(1);
  };

  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'amount' || column === 'date' ? 'desc' : 'asc');
    }
  };

  const SortIndicator = ({ active }: { active: boolean }) => (
    <span className="inline-block ml-1 text-gray-400">{active ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
  );

  const getStatusBadge = (status: string) => {
    const key = normalizeStatusKey(status);
    const isCompleted = ['completed', 'paid', 'invoiced', 'approved'].includes(key);
    const isCancelled = ['cancelled'].includes(key);
    const variant: 'completed' | 'pending' | 'cancelled' = isCompleted ? 'completed' : isCancelled ? 'cancelled' : 'pending';
    const statusConfig = {
      completed: { label: resolveStatusLabel(t, 'completed'), class: 'bg-green-100 text-green-800' },
      pending: { label: resolveStatusLabel(t, 'pending'), class: 'bg-yellow-100 text-yellow-800' },
      cancelled: { label: resolveStatusLabel(t, 'cancelled'), class: 'bg-red-100 text-red-800' }
    } as const;
    const cfg = statusConfig[variant] || { label: resolveStatusLabel(t, key), class: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.class}`}>
        {cfg.label}
      </span>
    );
  };

  const handleInlineEdit = (saleId: string, field: 'amount' | 'status', currentValue: string | number) => {
    setEditingField({ saleId, field });
    setTempValue(String(currentValue));
  };

  const handleSaveInlineEdit = (sale: SaleWithMetadata) => {
    if (!editingField) return;
    
    const updatedSale = { ...sale };
    
    if (editingField.field === 'amount') {
      const newAmount = parseFloat(tempValue) || 0;
      updatedSale.amount = newAmount;
    } else if (editingField.field === 'status') {
      updatedSale.status = tempValue as Sale['status'];
    }
    
    const updatedSales = sales.map(s => 
      s.id === sale.id ? updatedSale : s
    );
    
    if (onSalesUpdate) {
      onSalesUpdate(updatedSales);
    }
    
    setEditingField(null);
    setTempValue('');
  };

  const handleCancelInlineEdit = () => {
    setEditingField(null);
    setTempValue('');
  };

  const handleCreateInvoiceFromSale = (sale: SaleWithMetadata) => {
    logger.info('simpleSales.invoice.requested', {
      saleId: sale.id,
      saleNumber: sale.saleNumber,
    });
    
    // Check if invoice already exists for this sale (iki türlü kontrol)
    const existingInvoice = invoices.find(invoice => 
      (invoice.saleId && String(invoice.saleId) === String(sale.id)) ||
      (sale.invoiceId && String(sale.invoiceId) === String(invoice.id))
    );

    if (existingInvoice) {
      logger.info('simpleSales.invoice.existingFound', {
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        invoiceId: existingInvoice.id,
        invoiceNumber: existingInvoice.invoiceNumber,
        hasCustomer: Boolean((existingInvoice as InvoiceWithRelations).customer),
      });
      // Open existing invoice in modal
      setViewingInvoice(existingInvoice);
      setShowInvoiceViewModal(true);
    } else {
      logger.info('simpleSales.invoice.createFlow.start', {
        saleId: sale.id,
        saleNumber: sale.saleNumber,
      });
      // Show confirmation modal
      setSelectedSaleForInvoice(sale);
      setShowInvoiceConfirmModal(true);
    }
  };

  const handleConfirmCreateInvoice = async () => {
    if (!selectedSaleForInvoice || isCreatingInvoice) return;

    setIsCreatingInvoice(true);
    try {
      const sale = selectedSaleForInvoice;
      
      if (sale.invoiceId) {
        logger.info('simpleSales.invoice.linkedSaleDetected', {
          saleId: sale.id,
          invoiceId: sale.invoiceId,
        });
        
        const existingInvoice = invoices.find(inv => inv.id === sale.invoiceId);
        if (existingInvoice) {
          setShowInvoiceConfirmModal(false);
          setSelectedSaleForInvoice(null);
          setViewingInvoice(existingInvoice);
          setShowInvoiceViewModal(true);
          return;
        }
      }
      
      logger.debug('simpleSales.invoice.buildInput.start', {
        saleCustomerName: sale.customerName,
        saleCustomerEmail: sale.customerEmail,
        totalCustomers: customers.length,
      });
      
      const quantity = sale.quantity && sale.quantity > 0 ? sale.quantity : 1;
      const matchedProduct = sale.productId
        ? products.find(product => String(product.id) === String(sale.productId))
        : products.find(product => product.name.toLowerCase() === (sale.productName || '').toLowerCase());

      const fallbackUnitPrice = sale.unitPrice && sale.unitPrice > 0
        ? sale.unitPrice
        : matchedProduct?.unitPrice ?? 0;

      const calculatedTotal = sale.amount && sale.amount > 0 ? sale.amount : fallbackUnitPrice * quantity;
      const totalAmount = Number.isFinite(calculatedTotal) ? calculatedTotal : 0;
      const unitPriceWithTax = quantity > 0 ? totalAmount / quantity : fallbackUnitPrice;

      const productCategory = (matchedProduct?.category || '').toLowerCase().trim();
      const productNameLower = (matchedProduct?.name || sale.productName || '').toLowerCase().trim();
      
      logger.debug('simpleSales.invoice.typeDetection', {
        productName: matchedProduct?.name || sale.productName,
        categoryRaw: matchedProduct?.category,
        categoryLower: productCategory,
        productNameLower,
      });
      
      let invoiceType: 'product' | 'service' = 'product';
      const serviceCategories = ['hizmet', 'danışmanlık', 'danismanlik', 'eğitim', 'egitim', 'reklam', 'pazarlama'];
      
      if (serviceCategories.some(cat => productCategory.includes(cat))) {
        invoiceType = 'service';
        logger.debug('simpleSales.invoice.typeDetection.categoryMatch', {
          invoiceType,
        });
      } else if (productCategory.length === 0) {
        if (serviceCategories.some(cat => productNameLower.includes(cat))) {
          invoiceType = 'service';
          logger.debug('simpleSales.invoice.typeDetection.nameMatch');
        } else {
          logger.debug('simpleSales.invoice.typeDetection.defaultProduct');
        }
      } else {
        logger.debug('simpleSales.invoice.typeDetection.categoryDefault');
      }

      logger.info('simpleSales.invoice.typeDetection.result', {
        invoiceType,
      });

      if (customers.length === 0) {
        logger.error('simpleSales.invoice.noCustomers');
        alert('Fatura oluşturmak için önce en az bir müşteri eklemelisiniz.\n\n"Müşteriler" sayfasından yeni müşteri ekleyebilirsiniz.');
        setShowInvoiceConfirmModal(false);
        setSelectedSaleForInvoice(null);
        return;
      }

      const customerNameLower = sale.customerName?.toLowerCase().trim() || '';
      const customerEmailLower = sale.customerEmail?.toLowerCase().trim() || '';
      
      const matchedCustomer = customers.find(c => {
        const nameLower = c.name?.toLowerCase().trim() || '';
        const emailLower = c.email?.toLowerCase().trim() || '';
        return nameLower === customerNameLower ||
               emailLower === customerEmailLower ||
               nameLower.includes(customerNameLower) ||
               customerNameLower.includes(nameLower);
      });

      logger.debug('simpleSales.invoice.customerMatch', {
        found: Boolean(matchedCustomer),
        matchedCustomerId: matchedCustomer?.id,
      });

      const customerToUse = matchedCustomer || customers[0];
      
      if (!matchedCustomer) {
        logger.warn('simpleSales.invoice.customerFallback', {
          fallbackCustomerId: customerToUse.id,
        });
      }

      const taxRate = matchedProduct?.taxRate ?? 18;
      const netUnitPrice = quantity > 0 ? (unitPriceWithTax / (1 + taxRate / 100)) : unitPriceWithTax;
      const netLineTotal = netUnitPrice * quantity;
      const invoiceData = {
        saleId: sale.id,
        customerId: String(customerToUse.id),
        type: invoiceType,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'sent',
        lineItems: [
          {
            productId: matchedProduct?.id,
            productName: matchedProduct?.name || sale.productName,
            description: matchedProduct?.name || sale.productName,
            quantity,
            unitPrice: netUnitPrice,
            total: netLineTotal,
            taxRate,
          },
        ],
        subtotal: netLineTotal,
        taxAmount: totalAmount - netLineTotal,
        total: totalAmount,
        notes: 'Bu fatura ' + (sale.saleNumber || ('SAL-' + sale.id)) + ' numaralı satıştan oluşturulmuştur.',
      };

      logger.debug('simpleSales.invoice.payloadPrepared', {
        customerId: invoiceData.customerId,
        saleId: invoiceData.saleId,
        totalWithTax: totalAmount,
        unitPriceWithTax,
        quantity,
      });

      try {
        if (onCreateInvoice) {
          const createdInvoice = await onCreateInvoice(invoiceData);
          
          if (createdInvoice && createdInvoice.id) {
            logger.info('simpleSales.invoice.created', {
              invoiceId: createdInvoice.id,
              saleId: sale.id,
            });
            
            const updatedSale = { ...sale, invoiceId: createdInvoice.id };
            const updatedSales = sales.map((s) => s.id === sale.id ? updatedSale : s);
            
            if (onSalesUpdate) {
              onSalesUpdate(updatedSales);
            }
            
            logger.debug('simpleSales.invoice.saleLinked', {
              saleId: sale.id,
              invoiceId: createdInvoice.id,
            });
            
            setShowInvoiceConfirmModal(false);
            setSelectedSaleForInvoice(null);
          } else {
            logger.error('simpleSales.invoice.missingId', { saleId: sale.id });
          }
        }
      } catch (error) {
        logger.error('simpleSales.invoice.createFailed', { saleId: sale.id, error });
        return;
      }
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleCancelCreateInvoice = () => {
    setShowInvoiceConfirmModal(false);
    setSelectedSaleForInvoice(null);
    setIsCreatingInvoice(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600 mr-3" />
              {t('sidebar.sales')}
            </h1>
            <p className="text-gray-600">{t('sales.subtitle')}</p>
          </div>
          <button
            onClick={() => {
              logger.debug('simpleSales.modal.openNewSaleFromHeader');
              setEditingSale(null);
              setShowSaleModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('sales.newSale')}</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-green-600">{t('sales.totalSales') + netSuffix}</p>
                <p className="text-xl font-bold text-green-700">{formatAmount(totalSales)}</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-blue-600">{t('sales.totalSalesCount')}</p>
                <p className="text-xl font-bold text-blue-700">{sales.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center">
              <User className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-purple-600">{t('sales.completed')}</p>
                <p className="text-xl font-bold text-purple-700">{completedSales}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('sales.salesList')}</h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="text-sm text-gray-500">
                {sales.length} {t('sales.salesRegistered')}
              </p>
              <button
                type="button"
                onClick={handleExportSales}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>{t('sales.exportCsv', { defaultValue: 'Export CSV' })}</span>
              </button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={t('sales.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">
                {i18n.language === 'tr' ? 'Tüm Durumlar' : 
                 i18n.language === 'en' ? 'All Statuses' :
                 i18n.language === 'de' ? 'Alle Status' :
                 i18n.language === 'fr' ? 'Tous les Statuts' : 'All Statuses'}
              </option>
              <option value="completed">{resolveStatusLabel(t, 'completed')}</option>
              <option value="pending">{resolveStatusLabel(t, 'pending')}</option>
              <option value="cancelled">{resolveStatusLabel(t, 'cancelled')}</option>
            </select>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder={t('startDate')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder={t('endDate')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            {/* Hazır filtreler + Kaydedilmiş görünümler */}
            <div className="ml-auto flex items-center">
              <SavedViewsBar
                listType="sales"
                getState={() => ({ searchTerm, statusFilter, startDate, endDate, sortBy, sortDir, pageSize })}
                applyState={(s) => {
                  const st = (s || {}) as SimpleSalesViewState;
                  setSearchTerm(st.searchTerm ?? '');
                  setStatusFilter(st.statusFilter ?? 'all');
                  setStartDate(st.startDate ?? '');
                  setEndDate(st.endDate ?? '');
                  if (st.sortBy) setSortBy(st.sortBy);
                  if (st.sortDir) setSortDir(st.sortDir);
                  if (st.pageSize && isValidSalesPageSize(st.pageSize)) {
                    handlePageSizeChange(st.pageSize);
                  }
                }}
                presets={[
                  { id: 'this-month', label: t('presets.thisMonth'), apply: () => {
                    const d = new Date();
                    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
                    const end = new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10);
                    setStartDate(start); setEndDate(end);
                  }},
                  { id: 'completed', label: resolveStatusLabel(t, 'completed'), apply: () => setStatusFilter('completed') },
                  { id: 'pending', label: resolveStatusLabel(t, 'pending'), apply: () => setStatusFilter('pending') },
                  { id: 'cancelled', label: resolveStatusLabel(t, 'cancelled'), apply: () => setStatusFilter('cancelled') },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredSales.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || statusFilter !== 'all' ? t('sales.noSalesFound') : t('sales.noSales')}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? t('sales.noSalesFoundDesc')
                  : t('sales.noSalesDesc')
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button
                  onClick={() => {
                    logger.debug('simpleSales.modal.openNewSaleFromEmptyState');
                    setEditingSale(null);
                    setShowSaleModal(true);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {t('sales.createFirstSale')}
                </button>
              )}
            </div>
          ) : (
            <>
            <div className="overflow-x-auto relative">
              {/* Küçük ekranlarda sıkışmayı önlemek için tabloya minimum genişlik ver */}
              <table className="w-full min-w-[1024px] table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th onClick={() => toggleSort('saleNumber')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none w-40">
                      {t('sales.sale')}<SortIndicator active={sortBy==='saleNumber'} />
                    </th>
                    <th onClick={() => toggleSort('customer')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none w-56">
                      {t('sales.customer')}<SortIndicator active={sortBy==='customer'} />
                    </th>
                    <th onClick={() => toggleSort('product')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none w-[320px]">
                      {t('sales.productService')}<SortIndicator active={sortBy==='product'} />
                    </th>
                    <th onClick={() => toggleSort('amount')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none w-32">
                      {t('sales.amount')}<SortIndicator active={sortBy==='amount'} />
                    </th>
                    <th onClick={() => toggleSort('status')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none w-40">
                      {t('sales.status')}<SortIndicator active={sortBy==='status'} />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                      {t('customer.historyColumns.createdBy')}
                    </th>
                    <th onClick={() => toggleSort('date')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none w-32">
                      {t('sales.date')}<SortIndicator active={sortBy==='date'} />
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-44 min-w-[176px] sticky right-0 bg-gray-50 z-10">
                      {t('sales.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedSales.map((sale) => (
                    <tr key={`${sale.id}-${sale.saleNumber || ''}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              <button
                                onClick={() => handleViewSale(sale)}
                                className="text-green-600 hover:text-green-800 font-medium transition-colors cursor-pointer"
                                title={t('sales.viewSale')}
                              >
                                {sale.saleNumber || `SAL-${sale.id}`}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {sale.customerName}
                          </div>
                          {sale.customerEmail && (
                            <div className="text-xs text-gray-500 hidden lg:block">
                              {sale.customerEmail}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {sale.items && sale.items.length > 0 ? (
                          <div>
                            <div className="text-sm text-gray-900 truncate max-w-[260px]" title={sale.items[0].productName}>
                              {sale.items[0].productName}
                              {sale.items.length > 1 && (
                                <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded whitespace-nowrap">
                                  +{sale.items.length - 1} ürün
                                </span>
                              )}
                            </div>
                            {/* Çok ürünlü satışlarda tüm kalemleri satırda listelemeyelim */}
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm text-gray-900 truncate max-w-[260px]" title={sale.productName}>{sale.productName}</div>
                            {sale.quantity && sale.unitPrice && (
                              <div className="text-xs text-gray-500">
                                {sale.quantity} x {formatAmount(sale.unitPrice)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingField?.saleId === sale.id && editingField?.field === 'amount' ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="w-24 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                              min="0"
                              step="0.01"
                            />
                            <button
                              onClick={() => handleSaveInlineEdit(sale)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelInlineEdit}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span 
                            onClick={() => handleInlineEdit(sale.id, 'amount', sale.amount)}
                            className="text-sm font-semibold text-green-600 cursor-pointer hover:bg-green-50 rounded p-1 transition-colors"
                            title="Tutarı düzenlemek için tıklayın"
                          >
                            {formatAmount(resolveSaleTotal(sale))}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingField?.saleId === sale.id && editingField?.field === 'status' ? (
                          <div className="flex items-center space-x-2 flex-nowrap z-10">
                            <select
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500 w-[120px] max-w-[120px]"
                            >
                              <option value="completed">{resolveStatusLabel(t, 'completed')}</option>
                              <option value="pending">{resolveStatusLabel(t, 'pending')}</option>
                              <option value="cancelled">{resolveStatusLabel(t, 'cancelled')}</option>
                            </select>
                            <button
                              onClick={() => handleSaveInlineEdit(sale)}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-green-500"
                              aria-label={t('common.save')}
                            >
                              <Check className="w-4 h-4 shrink-0 text-green-600" />
                            </button>
                            <button
                              onClick={handleCancelInlineEdit}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-500"
                              aria-label={t('common.cancel')}
                            >
                              <X className="w-4 h-4 shrink-0 text-red-600" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => handleInlineEdit(sale.id, 'status', sale.status)}
                            className="cursor-pointer hover:opacity-80 transition-opacity inline-block"
                            title={t('sales.editSale')}
                          >
                            {getStatusBadge(sale.status)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {sale.createdByName || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(sale.date)}
                        </div>
                        {sale.paymentMethod && (
                          <div className="text-xs text-gray-400">
                            {getPaymentMethodLabel(sale.paymentMethod)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-white z-10 min-w-[176px]">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleViewSale(sale)}
                            className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title={t('sales.viewSale')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEditSale(sale)}
                            className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title={t('sales.editSale')}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => onDownloadSale?.(sale)}
                            className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title={t('sales.download')}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleCreateInvoiceFromSale(sale)}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded transition-colors ${
                              invoices.some(inv => 
                                (inv.saleId && String(inv.saleId) === String(sale.id)) ||
                                (sale.invoiceId && String(sale.invoiceId) === String(inv.id))
                              )
                                ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 bg-blue-50'
                                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                            title={
                              invoices.some(inv => 
                                (inv.saleId && String(inv.saleId) === String(sale.id)) ||
                                (sale.invoiceId && String(sale.invoiceId) === String(inv.id))
                              )
                                ? t('sales.viewSale')
                                : t('sales.createInvoice')
                            }
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteSale(sale.id)}
                            className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={t('sales.deleteSale')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-gray-200 bg-white">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={filteredSales.length}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
            </>
          )}
        </div>
      </div>

      {/* Sale Modal */}
      <SaleModal
        isOpen={showSaleModal}
        onClose={() => {
          logger.debug('simpleSales.modal.closeSaleModal');
          setShowSaleModal(false);
          setEditingSale(null);
        }}
        onSave={editingSale ? handleUpdateSale : handleAddSale}
        sale={editingSale}
        customers={customers || []}
        products={products}
      />

      {/* Sale View Modal */}
      <SaleViewModal
        isOpen={showSaleViewModal}
        onClose={() => {
          setShowSaleViewModal(false);
          setViewingSale(null);
        }}
        sale={viewingSale}
        onEdit={(sale) => {
          setShowSaleViewModal(false);
          handleEditSale(sale);
        }}
        onDelete={(id) => handleDeleteSale(id)}
        onDownload={onDownloadSale}
      />

      {/* Sale Confirmation Modal */}
      {showConfirmationModal && pendingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{t('sales.saleCompleted')}</h2>
                  <p className="text-sm text-gray-500">{t('sales.createInvoiceQuestion')}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Sale Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-gray-900 mb-2">{t('sales.saleSummary')}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('sales.customer')}:</span>
                    <span className="font-medium">{pendingSale.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('sales.productService')}:</span>
                    <span className="font-medium">{pendingSale.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('sales.amount')}:</span>
                    <span className="font-bold text-green-600">
                      {formatAmount(pendingSale.total || 0)}
                    </span>
                  </div>
                </div>
              {/* Invoice Question */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 mb-1">
                      {t('sales.createInvoiceQuestion')}
                    </p>
                    <p className="text-xs text-blue-600">
                      {t('sales.invoiceWillBeDownloaded')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
              </div>
            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => handleConfirmSale(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('sales.recordOnlySale', { defaultValue: 'Only Sale' })}
              </button>
              <button
                onClick={() => handleConfirmSale(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
              >
                <FileText className="w-4 h-4" />
                <span>{t('sales.recordSaleWithInvoice', { defaultValue: 'Sale with Invoice' })}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice View Modal */}
      <InvoiceViewModal
        isOpen={showInvoiceViewModal}
        onClose={() => {
          setShowInvoiceViewModal(false);
          setViewingInvoice(null);
        }}
        invoice={viewingInvoice}
        onEdit={(invoice) => {
          setShowInvoiceViewModal(false);
          setViewingInvoice(null);
          setViewingInvoice(null);
          if (onEditInvoice) {
            onEditInvoice(invoice);
          }
        }}
        onDownload={(invoice) => {
          import('../utils/pdfGenerator').then(({ generateInvoicePDF }) => {
            // PDF generator için customer bilgilerini tamamla
            const invoiceWithCustomer = {
              ...invoice,
              customerName: invoice.customer?.name || invoice.customerName || 'Müşteri Yok',
              customerEmail: invoice.customer?.email || invoice.customerEmail || '',
              customerAddress: invoice.customer?.address || invoice.customerAddress || '',
            };
            generateInvoicePDF(invoiceWithCustomer as Invoice);
          });
        }}
      />

      {/* Invoice Confirmation Modal */}
      {showInvoiceConfirmModal && selectedSaleForInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{t('sales.createInvoice')}</h2>
                  <p className="text-sm text-gray-500">{t('sales.createInvoiceQuestion')}</p>
                </div>
              </div>
              <button
                onClick={handleCancelCreateInvoice}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              {/* Sale Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-800 mb-2">
                      {t('sales.saleSummary')}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>{t('sales.customer')}:</strong> {selectedSaleForInvoice.customerName}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>{t('sales.productService')}:</strong> {selectedSaleForInvoice.productName}
                    </p>
                    <p className="text-xs text-gray-600">
                      <strong>{t('sales.amount')}:</strong> {formatAmount(selectedSaleForInvoice.amount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Confirmation Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 mb-1">
                      {t('sales.confirmInvoiceCreation')}
                    </p>
                    <p className="text-xs text-blue-600">
                      {t('sales.invoiceWillOpen')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleCancelCreateInvoice}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isCreatingInvoice}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmCreateInvoice}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isCreatingInvoice}
              >
                {isCreatingInvoice ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('sales.creatingInvoice', { defaultValue: 'Creating...' })}</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>{t('sales.confirmInvoiceAction', { defaultValue: 'Yes, Create' })}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}








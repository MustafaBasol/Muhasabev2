import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Eye, Edit, Download, Trash2, FileText, Calendar, Check, X, Ban, RotateCcw } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { compareBy, defaultStatusOrderInvoices, normalizeText, parseDateSafe, toNumberSafe, SortDir } from '../utils/sortAndSearch';
import { useAuth } from '../contexts/AuthContext';
import Pagination from './Pagination';

// Archive threshold: invoices older than this many days will only appear in archive
const ARCHIVE_THRESHOLD_DAYS = 365; // 1 year

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: {
    id: string;
    name: string;
    email: string;
  };
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issueDate: string;
  dueDate: string;
  items: any[];
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
}

interface InvoiceListProps {
  invoices: Invoice[];
  onAddInvoice: () => void;
  onEditInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onUpdateInvoice: (invoice: Invoice) => void;
  onDownloadInvoice?: (invoice: Invoice) => void;
  onVoidInvoice?: (invoiceId: string, reason: string) => void;
  onRestoreInvoice?: (invoiceId: string) => void;
}

export default function InvoiceList({ 
  invoices, 
  onAddInvoice, 
  onEditInvoice, 
  onDeleteInvoice,
  onViewInvoice,
  onUpdateInvoice,
  onDownloadInvoice,
  onVoidInvoice,
  onRestoreInvoice
}: InvoiceListProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();
  const { tenant } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showVoided, setShowVoided] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidingInvoice, setVoidingInvoice] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [sort, setSort] = useState<{ by: 'invoiceNumber' | 'customer' | 'description' | 'amount' | 'status' | 'dueDate' | 'issueDate'; dir: SortDir }>({ by: 'issueDate', dir: 'desc' });
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('invoices_pageSize') : null;
    const n = saved ? Number(saved) : 20;
    return [20, 50, 100].includes(n) ? n : 20;
  });

  // Plan kullanımı: Free/Starter için bu ayki fatura sayısı (isVoided hariç)
  const planNormalized = String(tenant?.subscriptionPlan || '').toLowerCase();
  const isFreePlan = planNormalized.includes('free') || planNormalized.includes('starter');
  const invoicesThisMonth = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return invoices.filter((inv: any) => {
      if (inv?.isVoided) return false;
      const created = inv?.createdAt ? new Date(inv.createdAt) : (inv?.issueDate ? new Date(inv.issueDate) : null);
      if (!created || Number.isNaN(created.getTime())) return false;
      return created >= start && created <= end;
    }).length;
  }, [invoices]);
  const MONTHLY_MAX = 5;
  const atLimit = isFreePlan && invoicesThisMonth >= MONTHLY_MAX;

  // Filter out archived invoices (older than threshold)
  const currentInvoices = invoices.filter(invoice => {
    const issueDate = new Date(invoice.issueDate);
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - ARCHIVE_THRESHOLD_DAYS);
    return issueDate >= thresholdDate;
  });

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter(invoice => {
      const q = normalizeText(debouncedSearch);
      const descrItems = ((invoice.items as any[]) || (invoice as any).lineItems || []).map((it: any) => it.productName || it.description || '').join(' ');
      const haystack = [
        invoice.invoiceNumber,
        invoice.customer?.name,
        invoice.customer?.email,
        invoice.status,
        invoice.issueDate,
        invoice.dueDate,
        descrItems,
        String(invoice.total)
      ].map(normalizeText).join(' ');

      const matchesSearch = q.length === 0 || haystack.includes(q);
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      const matchesVoidFilter = showVoided || !invoice.isVoided;

      // Only show invoices that are not archived (within threshold)
      const issueDate = new Date(invoice.issueDate);
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - ARCHIVE_THRESHOLD_DAYS);
      const isNotArchived = issueDate >= thresholdDate;

      // Tarih aralığı (issueDate'e göre)
      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && new Date(invoice.issueDate) >= new Date(startDate);
      }
      if (endDate) {
        matchesDate = matchesDate && new Date(invoice.issueDate) <= new Date(endDate);
      }

      return matchesSearch && matchesStatus && matchesVoidFilter && isNotArchived && matchesDate;
    })
    .sort((a, b) => {
      // Tip-bilinçli sıralama + ikincil bağlaçlar (eşitlik durumunda görünür değişim sağla)
      switch (sort.by) {
        case 'invoiceNumber':
          return compareBy(a, b, x => x.invoiceNumber, sort.dir, 'string');
        case 'customer':
          return compareBy(a, b, x => x.customer?.name || '', sort.dir, 'string');
        case 'description': {
          const sel = (x: Invoice) => {
            const itemsList = (x.items as any[]) || (x as any).lineItems || [];
            return (itemsList[0]?.productName || itemsList[0]?.description || '') as string;
          };
          return compareBy(a, b, sel, sort.dir, 'string');
        }
        case 'amount':
          return compareBy(a, b, x => toNumberSafe(x.total), sort.dir, 'number');
        case 'status':
          return compareBy(a, b, x => x.status, sort.dir, 'string', defaultStatusOrderInvoices);
        case 'dueDate': {
          const ta = parseDateSafe(a.dueDate);
          const tb = parseDateSafe(b.dueDate);
          if (ta === tb) {
            // Bağlaç: fatura numarasına göre
            return compareBy(a, b, x => x.invoiceNumber, sort.dir, 'string');
          }
          return ta < tb ? (sort.dir === 'asc' ? -1 : 1) : (sort.dir === 'asc' ? 1 : -1);
        }
        case 'issueDate':
        default: {
          const ta = parseDateSafe(a.issueDate);
          const tb = parseDateSafe(b.issueDate);
          if (ta === tb) {
            // Bağlaç: fatura numarasına göre
            return compareBy(a, b, x => x.invoiceNumber, sort.dir, 'string');
          }
          return ta < tb ? (sort.dir === 'asc' ? -1 : 1) : (sort.dir === 'asc' ? 1 : -1);
        }
      }
    });
  }, [invoices, debouncedSearch, statusFilter, showVoided, startDate, endDate, sort.by, sort.dir]);

  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, showVoided, startDate, endDate, sort.by, sort.dir]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    if (typeof window !== 'undefined') {
      localStorage.setItem('invoices_pageSize', String(size));
    }
    setPage(1);
  };

  const toggleSort = (column: typeof sort.by) => {
    // Tek bir etkileşimde hem sütunu hem yönü tutarlı güncelle (atomik state)
    setSort(prev => {
      if (prev.by === column) {
        return { ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDir: SortDir = (column === 'amount' || column === 'dueDate' || column === 'issueDate') ? 'desc' : 'asc';
      return { by: column, dir: defaultDir };
    });
  };

  const SortIndicator = ({ active }: { active: boolean }) => (
    <span className="inline-block ml-1 text-gray-400">
      {active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
    </span>
  );

  const getStatusBadge = (status: string, isVoided?: boolean) => {
    if (isVoided) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          İptal Edildi
        </span>
      );
    }

    const statusConfig = {
      draft: { label: t('status.draft'), class: 'bg-gray-100 text-gray-800' },
      sent: { label: t('status.sent'), class: 'bg-blue-100 text-blue-800' },
      paid: { label: t('status.paid'), class: 'bg-green-100 text-green-800' },
      overdue: { label: t('status.overdue'), class: 'bg-red-100 text-red-800' },
      cancelled: { label: t('status.cancelled'), class: 'bg-red-100 text-red-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, class: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.class}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const formatAmount = (amount: number) => {
    return formatCurrency(amount);
  };

  const handleInlineEdit = (invoiceId: string, field: string, currentValue: string) => {
    setEditingInvoice(invoiceId);
    setEditingField(field);
    setTempValue(currentValue);
  };

  const handleSaveInlineEdit = (invoice: Invoice) => {
    if (editingField === 'status') {
      onUpdateInvoice({ ...invoice, status: tempValue as any });
    } else if (editingField === 'dueDate') {
      onUpdateInvoice({ ...invoice, dueDate: tempValue });
    } else if (editingField === 'issueDate') {
      onUpdateInvoice({ ...invoice, issueDate: tempValue });
    }
    setEditingInvoice(null);
    setEditingField(null);
    setTempValue('');
  };

  const handleCancelInlineEdit = () => {
    setEditingInvoice(null);
    setEditingField(null);
    setTempValue('');
  };

  const handleVoidInvoice = (invoice: Invoice) => {
    setVoidingInvoice(invoice);
    setShowVoidModal(true);
  };

  const handleConfirmVoid = () => {
    if (voidingInvoice && onVoidInvoice && voidReason.trim()) {
      onVoidInvoice(voidingInvoice.id, voidReason);
      setShowVoidModal(false);
      setVoidingInvoice(null);
      setVoidReason('');
    }
  };

  const handleRestoreInvoice = (invoiceId: string) => {
    if (onRestoreInvoice) {
      onRestoreInvoice(invoiceId);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{t('invoices.title')}</h2>
            <p className="text-sm text-gray-500">
              {currentInvoices.length} {t('invoices.invoicesRegistered')} • {invoices.length - currentInvoices.length} {t('invoices.inArchive')}
            </p>
          </div>
          <button
            onClick={onAddInvoice}
            disabled={atLimit}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${atLimit ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            title={atLimit ? 'Starter/Free planda bu ayki fatura limiti doldu (5/5)' : undefined}
          >
            <Plus className="w-4 h-4" />
            <span>{t('invoices.newInvoice')}</span>
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t('invoices.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t('invoices.filterAll')}</option>
            <option value="draft">{t('status.draft')}</option>
            <option value="sent">{t('status.sent')}</option>
            <option value="paid">{t('status.paid')}</option>
            <option value="overdue">{t('status.overdue')}</option>
            <option value="cancelled">{t('status.cancelled')}</option>
          </select>
          {/* Date range */}
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700 whitespace-nowrap">{t('common.startDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700 whitespace-nowrap">{t('common.endDate')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                title={t('archive.clearFilters')}
              >
                {t('archive.clearFilters')}
              </button>
            )}
          </div>
          <label className="flex items-center px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
            <input
              type="checkbox"
              checked={showVoided}
              onChange={(e) => setShowVoided(e.target.checked)}
              className="mr-2"
            />
            {showVoided ? t('invoices.hideVoided') : t('invoices.showVoided')}
          </label>
          {/* Plan kullanım özeti */}
          {isFreePlan && (
            <div className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 whitespace-nowrap">
              Bu ay: <strong className={`${atLimit ? 'text-red-600' : 'text-gray-900'}`}>{invoicesThisMonth}/{MONTHLY_MAX}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Invoice List */}
      <div className="divide-y divide-gray-200">
        {filteredInvoices.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' ? t('invoices.noInvoicesFound') : t('invoices.noInvoices')}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? t('invoices.noInvoicesFoundDesc')
                : t('invoices.noInvoicesDesc')
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={onAddInvoice}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('invoices.createFirstInvoice')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Küçük ekranlarda sıkışmayı önlemek için tabloya minimum genişlik ver */}
            <table className="w-full min-w-[1024px] table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th onClick={() => toggleSort('invoiceNumber')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none w-40">
                    {t('invoices.invoiceNumber')}<SortIndicator active={sort.by==='invoiceNumber'} />
                  </th>
                  <th onClick={() => toggleSort('customer')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none w-56">
                    {t('invoices.customer')}<SortIndicator active={sort.by==='customer'} />
                  </th>
                  <th onClick={() => toggleSort('description')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none w-[320px]">
                    {t('common.description')}<SortIndicator active={sort.by==='description'} />
                  </th>
                  <th onClick={() => toggleSort('amount')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none w-32">
                    {t('invoices.amount')}<SortIndicator active={sort.by==='amount'} />
                  </th>
                  <th onClick={() => toggleSort('status')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none w-40">
                    {t('invoices.status')}<SortIndicator active={sort.by==='status'} />
                  </th>
                  <th onClick={() => toggleSort('issueDate')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none w-32">
                    {t('invoices.date')}<SortIndicator active={sort.by==='issueDate'} />
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-44 min-w-[176px] sticky right-0 bg-gray-50 z-10">
                    {t('invoices.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            <button
                              onClick={() => onViewInvoice(invoice)}
                              className="text-blue-600 hover:text-blue-800 font-medium transition-colors cursor-pointer"
                              title={t('invoices.viewInvoice')}
                            >
                              {invoice.invoiceNumber}
                            </button>
                          </div>
                          <div className="text-xs text-gray-500 flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(invoice.dueDate)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {invoice.customer?.name || 'Müşteri Yok'}
                        </div>
                        <div className="text-xs text-gray-500 hidden lg:block">
                          {invoice.customer?.email || ''}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700 max-w-[260px]">
                        {(() => {
                          const itemsList = invoice.items || (invoice as any).lineItems || [];
                          
                          if (itemsList.length > 0) {
                            return (
                              <div className="space-y-1">
                                {itemsList.slice(0, 2).map((item: any, idx: number) => (
                                  <div key={idx} className="flex items-start">
                                    <span className="text-gray-400 mr-1">•</span>
                                    <span className="line-clamp-1">
                                      {item.productName || item.description || 'Ürün'} 
                                      {item.quantity && ` (${item.quantity}x)`}
                                    </span>
                                  </div>
                                ))}
                                {itemsList.length > 2 && (
                                  <div className="text-xs text-gray-400">
                                    +{itemsList.length - 2} daha...
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return <span className="text-gray-400 text-xs">Ürün bilgisi yok</span>;
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatAmount(Number(invoice.total) || 0)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingInvoice === invoice.id && editingField === 'status' ? (
                        <div className="flex items-center space-x-2 flex-nowrap z-10">
                          <select
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[120px] max-w-[120px]"
                          >
                            <option value="draft">{t('status.draft')}</option>
                            <option value="sent">{t('status.sent')}</option>
                            <option value="paid">{t('status.paid')}</option>
                            <option value="overdue">{t('status.overdue')}</option>
                          </select>
                          <button
                            onClick={() => handleSaveInlineEdit(invoice)}
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
                          onClick={() => !invoice.isVoided && handleInlineEdit(invoice.id, 'status', invoice.status)}
                          className={`${!invoice.isVoided ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'} transition-opacity inline-block`}
                        >
                          {getStatusBadge(invoice.status, invoice.isVoided)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingInvoice === invoice.id && editingField === 'issueDate' ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="date"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => handleSaveInlineEdit(invoice)}
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
                        <div 
                          onClick={() => handleInlineEdit(invoice.id, 'issueDate', invoice.issueDate)}
                          className="cursor-pointer hover:bg-gray-50 rounded p-1"
                        >
                          {formatDate(invoice.issueDate)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-white z-10 min-w-[176px]">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => onViewInvoice(invoice)}
                          className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title={t('invoices.view')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onEditInvoice(invoice)}
                          disabled={invoice.isVoided}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded transition-colors ${
                            invoice.isVoided 
                              ? 'text-gray-300 cursor-not-allowed' 
                              : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                          title={invoice.isVoided ? 'İptal edilmiş fatura düzenlenemez' : t('invoices.edit')}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if (onDownloadInvoice) {
                              onDownloadInvoice(invoice);
                            }
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title={t('invoices.download')}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {invoice.isVoided ? (
                          <button 
                            onClick={() => handleRestoreInvoice(invoice.id)}
                            className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Faturayı geri yükle"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleVoidInvoice(invoice)}
                            className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="Faturayı iptal et"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => onDeleteInvoice(invoice.id)}
                          className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={t('invoices.delete')}
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
        )}
      </div>

      <div className="p-4 border-t border-gray-200 bg-white">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filteredInvoices.length}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {/* Void Modal */}
      {showVoidModal && voidingInvoice && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Faturayı İptal Et
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              <strong>{voidingInvoice.invoiceNumber}</strong> numaralı faturayı iptal etmek istediğinizden emin misiniz?
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                İptal Nedeni *
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                rows={3}
                placeholder="İptal nedenini açıklayın..."
                required
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowVoidModal(false);
                  setVoidingInvoice(null);
                  setVoidReason('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                İptal
              </button>
              <button
                onClick={handleConfirmVoid}
                disabled={!voidReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Faturayı İptal Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

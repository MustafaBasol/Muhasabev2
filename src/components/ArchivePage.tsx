import { useMemo, useState } from 'react';
import { 
  Archive, 
  Search, 
  Calendar,
  Eye, 
  Download,
  FileText,
  Receipt,
  TrendingUp,
  Users,
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle
} from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import Pagination from './Pagination';
import { normalizeStatusKey, resolveStatusLabel } from '../utils/status';
import { safeLocalStorage } from '../utils/localStorageSafe';
import { logger } from '../utils/logger';

interface ArchivePageProps {
  invoices?: any[];
  expenses?: any[];
  sales?: any[];
  customers?: any[];
  suppliers?: any[];
  onViewInvoice?: (invoice: any) => void;
  onViewExpense?: (expense: any) => void;
  onViewSale?: (sale: any) => void;
  onViewCustomer?: (customer: any) => void;
  onViewSupplier?: (supplier: any) => void;
  onDownloadInvoice?: (invoice: any) => void;
  onDownloadExpense?: (expense: any) => void;
  onDownloadSale?: (sale: any) => void;
}

const ARCHIVE_PAGE_SIZES = [20, 50, 100] as const;
type ArchivePageSize = (typeof ARCHIVE_PAGE_SIZES)[number];
const isValidArchivePageSize = (value: number): value is ArchivePageSize =>
  ARCHIVE_PAGE_SIZES.includes(value as ArchivePageSize);

const ARCHIVE_PAGE_KEYS = {
  invoices: 'archive_invoices_pageSize',
  expenses: 'archive_expenses_pageSize',
  sales: 'archive_sales_pageSize',
  customers: 'archive_customers_pageSize',
  suppliers: 'archive_suppliers_pageSize'
} as const;
type ArchivePageSizeKey = typeof ARCHIVE_PAGE_KEYS[keyof typeof ARCHIVE_PAGE_KEYS];

const getSavedArchivePageSize = (storageKey: ArchivePageSizeKey): ArchivePageSize => {
  const stored = safeLocalStorage.getItem(storageKey);
  const parsed = stored ? Number(stored) : ARCHIVE_PAGE_SIZES[0];
  return isValidArchivePageSize(parsed) ? parsed : ARCHIVE_PAGE_SIZES[0];
};

const persistArchivePageSize = (storageKey: ArchivePageSizeKey, size: ArchivePageSize) => {
  safeLocalStorage.setItem(storageKey, String(size));
};

const updateArchivePageSize = (
  size: number,
  setSize: (value: number) => void,
  setPage: (value: number) => void,
  storageKey: ArchivePageSizeKey,
) => {
  if (!isValidArchivePageSize(size)) {
    logger.warn('Attempted to set invalid archive page size', { storageKey, size });
    return;
  }
  setSize(size);
  persistArchivePageSize(storageKey, size);
  setPage(1);
};

export default function ArchivePage({
  invoices = [],
  expenses = [],
  sales = [],
  customers = [],
  suppliers = [],
  onViewInvoice,
  onViewExpense,
  onViewSale,
  onViewCustomer,
  onViewSupplier,
  onDownloadInvoice,
  onDownloadExpense,
  onDownloadSale
}: ArchivePageProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation('common');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['invoices', 'expenses', 'sales']));
  const [activeTab, setActiveTab] = useState('all');
  // Per-section pagination state
  const [invPage, setInvPage] = useState<number>(1);
  const [invPageSize, setInvPageSize] = useState<number>(() => getSavedArchivePageSize(ARCHIVE_PAGE_KEYS.invoices));
  const [expPage, setExpPage] = useState<number>(1);
  const [expPageSize, setExpPageSize] = useState<number>(() => getSavedArchivePageSize(ARCHIVE_PAGE_KEYS.expenses));
  const [salePage, setSalePage] = useState<number>(1);
  const [salePageSize, setSalePageSize] = useState<number>(() => getSavedArchivePageSize(ARCHIVE_PAGE_KEYS.sales));
  const [custPage, setCustPage] = useState<number>(1);
  const [custPageSize, setCustPageSize] = useState<number>(() => getSavedArchivePageSize(ARCHIVE_PAGE_KEYS.customers));
  const [supPage, setSupPage] = useState<number>(1);
  const [supPageSize, setSupPageSize] = useState<number>(() => getSavedArchivePageSize(ARCHIVE_PAGE_KEYS.suppliers));

  const handleInvPageSizeChange = (size: number) =>
    updateArchivePageSize(size, setInvPageSize, setInvPage, ARCHIVE_PAGE_KEYS.invoices);
  const handleExpPageSizeChange = (size: number) =>
    updateArchivePageSize(size, setExpPageSize, setExpPage, ARCHIVE_PAGE_KEYS.expenses);
  const handleSalePageSizeChange = (size: number) =>
    updateArchivePageSize(size, setSalePageSize, setSalePage, ARCHIVE_PAGE_KEYS.sales);
  const handleCustPageSizeChange = (size: number) =>
    updateArchivePageSize(size, setCustPageSize, setCustPage, ARCHIVE_PAGE_KEYS.customers);
  const handleSupPageSizeChange = (size: number) =>
    updateArchivePageSize(size, setSupPageSize, setSupPage, ARCHIVE_PAGE_KEYS.suppliers);

  // Filter archived items (completed/paid items)
  const archivedInvoices = invoices.filter(invoice => 
    invoice.status === 'paid' || invoice.status === 'overdue'
  );
  
  const archivedExpenses = expenses.filter(expense => 
    expense.status === 'paid'
  );
  
  const archivedSales = sales.filter(sale => 
    sale.status === 'completed' || sale.status === 'cancelled'
  );

  // All customers and suppliers are shown in archive (no specific archive status)
  const archivedCustomers = customers;
  const archivedSuppliers = suppliers;

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const safeNumber = (v: any): number => {
    // Normalize numbers coming as number, numeric string or undefined/null
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    return Number.isFinite(n) ? n : 0;
  };

  const formatAmount = (amount: number) => {
    return formatCurrency(safeNumber(amount));
  };

  const getStatusBadge = (status: string, _type: string) => {
    const key = normalizeStatusKey(status);
    const statusColors = {
      // Invoice statuses
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      // Sale statuses
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    
    const colorClass = statusColors[key as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {resolveStatusLabel(t, key)}
      </span>
    );
  };

  // Filter function for search and date
  const filterItems = (items: any[], searchFields: string[]) => {
    return items.filter(item => {
      const matchesSearch = searchTerm === '' || searchFields.some(field => {
        const value = item[field];
        return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
      });

      const matchesDate = dateFilter === '' || (() => {
        const itemDate = new Date(item.issueDate || item.expenseDate || item.date || item.createdAt);
        const filterDate = new Date(dateFilter);
        return itemDate.toDateString() === filterDate.toDateString();
      })();

      return matchesSearch && matchesDate;
    });
  };

  const filteredInvoices = filterItems(archivedInvoices, ['invoiceNumber', 'customerName']);
  const filteredExpenses = filterItems(archivedExpenses, ['expenseNumber', 'description', 'supplier']);
  const filteredSales = filterItems(archivedSales, ['saleNumber', 'customerName', 'productName']);
  const filteredCustomers = filterItems(archivedCustomers, ['name', 'email', 'company']);
  const filteredSuppliers = filterItems(archivedSuppliers, ['name', 'email', 'company']);

  const paginatedInvoices = useMemo(() => {
    const start = (invPage - 1) * invPageSize;
    return filteredInvoices.slice(start, start + invPageSize);
  }, [filteredInvoices, invPage, invPageSize]);
  const paginatedExpenses = useMemo(() => {
    const start = (expPage - 1) * expPageSize;
    return filteredExpenses.slice(start, start + expPageSize);
  }, [filteredExpenses, expPage, expPageSize]);
  const paginatedSales = useMemo(() => {
    const start = (salePage - 1) * salePageSize;
    return filteredSales.slice(start, start + salePageSize);
  }, [filteredSales, salePage, salePageSize]);
  const paginatedCustomers = useMemo(() => {
    const start = (custPage - 1) * custPageSize;
    return filteredCustomers.slice(start, start + custPageSize);
  }, [filteredCustomers, custPage, custPageSize]);
  const paginatedSuppliers = useMemo(() => {
    const start = (supPage - 1) * supPageSize;
    return filteredSuppliers.slice(start, start + supPageSize);
  }, [filteredSuppliers, supPage, supPageSize]);

  // Calculate totals
  const totalArchivedAmount = archivedInvoices.reduce(
    (sum, inv) => sum + safeNumber(inv.total ?? inv.amount ?? inv.grandTotal),
    0,
  ) + archivedSales.reduce(
    (sum, sale) => sum + safeNumber(sale.amount ?? sale.total),
    0,
  );

  const totalArchivedExpenses = archivedExpenses.reduce(
    (sum, exp) => sum + safeNumber(exp.amount ?? exp.total),
    0,
  );

  const tabs = [
    { id: 'all', label: t('archive.tabs.all'), count: filteredInvoices.length + filteredExpenses.length + filteredSales.length },
    { id: 'invoices', label: t('archive.tabs.invoices'), count: filteredInvoices.length },
    { id: 'expenses', label: t('archive.tabs.expenses'), count: filteredExpenses.length },
    { id: 'sales', label: t('archive.tabs.sales'), count: filteredSales.length },
    { id: 'contacts', label: t('archive.tabs.contacts'), count: filteredCustomers.length + filteredSuppliers.length }
  ];

  const shouldShowSection = (sectionId: string) => {
    return activeTab === 'all' || activeTab === sectionId || 
           (activeTab === 'contacts' && (sectionId === 'customers' || sectionId === 'suppliers'));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Archive className="w-8 h-8 text-gray-600 mr-3" />
              {t('archive.title')}
            </h1>
            <p className="text-gray-600">{t('archive.subtitle')}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">{t('archive.totalArchive')}</p>
            <p className="text-2xl font-bold text-gray-900">
              {archivedInvoices.length + archivedExpenses.length + archivedSales.length + archivedCustomers.length + archivedSuppliers.length}
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <FileText className="w-6 h-6 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-blue-600">{t('archive.archivedInvoices')}</p>
                <p className="text-lg font-bold text-blue-700">{archivedInvoices.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center">
              <Receipt className="w-6 h-6 text-red-600 mr-3" />
              <div>
                <p className="text-sm text-red-600">{t('archive.archivedExpenses')}</p>
                <p className="text-lg font-bold text-red-700">{archivedExpenses.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <TrendingUp className="w-6 h-6 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-green-600">{t('archive.archivedSales')}</p>
                <p className="text-lg font-bold text-green-700">{archivedSales.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center">
              <Users className="w-6 h-6 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-purple-600">{t('archive.totalContacts')}</p>
                <p className="text-lg font-bold text-purple-700">{archivedCustomers.length + archivedSuppliers.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t('archive.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </div>
          <button
            onClick={() => {
              setSearchTerm('');
              setDateFilter('');
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            {t('archive.clearFilters')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex flex-wrap gap-3 px-4 sm:px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-gray-600 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                <span className="ml-2 bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Archived Invoices */}
          {shouldShowSection('invoices') && (
            <div className="mb-8">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleSection('invoices')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FileText className="w-5 h-5 text-blue-600 mr-2" />
                  {t('archive.sections.archivedInvoices')} ({filteredInvoices.length})
                </h3>
                {expandedSections.has('invoices') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {expandedSections.has('invoices') && (
                <div className="bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
                  {filteredInvoices.length === 0 ? (
                    <div className="p-6 text-center">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">{t('archive.empty.invoices')}</p>
                      <p className="text-sm text-gray-400">{t('archive.empty.invoicesHelper')}</p>
                    </div>
                  ) : (
                    <>
                    <div className="overflow-x-auto">
                      <table className="w-full table-auto text-sm">
                        <thead className="bg-blue-100 text-blue-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.invoice')}</th>
                            <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.customer')}</th>
                            <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.amount')}</th>
                            <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.status')}</th>
                            <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.date')}</th>
                            <th className="hidden md:table-cell px-4 py-3 text-right text-xs font-semibold uppercase">{t('archive.table.actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-blue-100">
                          {paginatedInvoices.map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-blue-25 transition-colors">
                              <td className="px-4 py-3 align-top">
                                <button
                                  onClick={() => onViewInvoice?.(invoice)}
                                  className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                >
                                  {invoice.invoiceNumber}
                                </button>
                                <div className="mt-2 space-y-2 text-xs text-gray-600 md:hidden">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-500 font-medium">{t('archive.table.customer')}:</span>
                                    <span className="text-gray-900">{invoice.customerName}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-500 font-medium">{t('archive.table.amount')}:</span>
                                    <span className="text-gray-900 font-semibold">{formatAmount(invoice.total)}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-500 font-medium">{t('archive.table.status')}:</span>
                                    <span className="inline-flex">{getStatusBadge(invoice.status, 'invoice')}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-500 font-medium">{t('archive.table.date')}:</span>
                                    <span className="text-gray-900">{formatDate(invoice.issueDate)}</span>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 md:hidden">
                                  <button 
                                    onClick={() => onViewInvoice?.(invoice)}
                                    className="inline-flex items-center justify-center w-9 h-9 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                    title={t('archive.actions.view')}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => onDownloadInvoice?.(invoice)}
                                    className="inline-flex items-center justify-center w-9 h-9 rounded text-gray-400 hover:text-green-600 hover:bg-green-50"
                                    title={t('archive.actions.download')}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                              <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-900">{invoice.customerName}</td>
                              <td className="hidden md:table-cell px-4 py-3 text-sm font-semibold text-gray-900">
                                {formatAmount(invoice.total)}
                              </td>
                              <td className="hidden lg:table-cell px-4 py-3">
                                {getStatusBadge(invoice.status, 'invoice')}
                              </td>
                              <td className="hidden lg:table-cell px-4 py-3 text-sm text-gray-500">
                                {formatDate(invoice.issueDate)}
                              </td>
                              <td className="hidden md:table-cell px-4 py-3 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <button 
                                    onClick={() => onViewInvoice?.(invoice)}
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title={t('archive.actions.view')}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => onDownloadInvoice?.(invoice)}
                                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title={t('archive.actions.download')}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-3 border-t border-blue-200 bg-blue-50">
                      <Pagination
                        page={invPage}
                        pageSize={invPageSize}
                        total={filteredInvoices.length}
                        onPageChange={setInvPage}
                        onPageSizeChange={handleInvPageSizeChange}
                      />
                    </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Archived Expenses */}
          {shouldShowSection('expenses') && (
            <div className="mb-8">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleSection('expenses')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Receipt className="w-5 h-5 text-red-600 mr-2" />
                  {t('archive.sections.archivedExpenses')} ({filteredExpenses.length})
                </h3>
                {expandedSections.has('expenses') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {expandedSections.has('expenses') && (
                <div className="bg-red-50 rounded-lg border border-red-200 overflow-hidden">
                  {filteredExpenses.length === 0 ? (
                    <div className="p-6 text-center">
                      <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">{t('archive.empty.expenses')}</p>
                      <p className="text-sm text-gray-400">{t('archive.empty.expensesHelper')}</p>
                    </div>
                  ) : (
                    <>
                    <div className="overflow-x-auto">
                      <table className="w-full table-auto text-sm">
                        <thead className="bg-red-100 text-red-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.expense')}</th>
                            <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.supplier')}</th>
                            <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.category')}</th>
                            <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.amount')}</th>
                            <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.date')}</th>
                            <th className="hidden md:table-cell px-4 py-3 text-right text-xs font-semibold uppercase">{t('archive.table.actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-red-100">
                          {paginatedExpenses.map((expense) => (
                            <tr key={expense.id} className="hover:bg-red-25 transition-colors">
                              <td className="px-4 py-3 align-top">
                                <button
                                  onClick={() => onViewExpense?.(expense)}
                                  className="text-red-600 hover:text-red-800 font-medium transition-colors"
                                >
                                  {expense.expenseNumber}
                                </button>
                                {expense.description && (
                                  <div className="text-xs text-gray-500">{expense.description}</div>
                                )}
                                <div className="mt-2 space-y-2 text-xs text-gray-600 md:hidden">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-500 font-medium">{t('archive.table.supplier')}:</span>
                                    <span className="text-gray-900">{expense.supplier || '—'}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-500 font-medium">{t('archive.table.category')}:</span>
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                                      {expense.category}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-500 font-medium">{t('archive.table.amount')}:</span>
                                    <span className="text-red-600 font-semibold">-{formatAmount(expense.amount)}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-500 font-medium">{t('archive.table.date')}:</span>
                                    <span className="text-gray-900">{formatDate(expense.expenseDate)}</span>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 md:hidden">
                                  <button 
                                    onClick={() => onViewExpense?.(expense)}
                                    className="inline-flex items-center justify-center w-9 h-9 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                                    title={t('archive.actions.view')}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => onDownloadExpense?.(expense)}
                                    className="inline-flex items-center justify-center w-9 h-9 rounded text-gray-400 hover:text-green-600 hover:bg-green-50"
                                    title={t('archive.actions.download')}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                              <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-900">{expense.supplier}</td>
                              <td className="hidden lg:table-cell px-4 py-3">
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                                  {expense.category}
                                </span>
                              </td>
                              <td className="hidden md:table-cell px-4 py-3 text-sm font-semibold text-red-600">
                                -{formatAmount(expense.amount)}
                              </td>
                              <td className="hidden lg:table-cell px-4 py-3 text-sm text-gray-500">
                                {formatDate(expense.expenseDate)}
                              </td>
                              <td className="hidden md:table-cell px-4 py-3 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <button 
                                    onClick={() => onViewExpense?.(expense)}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title={t('archive.actions.view')}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => onDownloadExpense?.(expense)}
                                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title={t('archive.actions.download')}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-3 border-t border-red-200 bg-red-50">
                      <Pagination
                        page={expPage}
                        pageSize={expPageSize}
                        total={filteredExpenses.length}
                        onPageChange={setExpPage}
                        onPageSizeChange={handleExpPageSizeChange}
                      />
                    </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Archived Sales */}
          {shouldShowSection('sales') && (
            <div className="mb-8">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleSection('sales')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
                  {t('archive.sections.archivedSales')} ({filteredSales.length})
                </h3>
                {expandedSections.has('sales') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {expandedSections.has('sales') && (
                <div className="bg-green-50 rounded-lg border border-green-200 overflow-hidden">
                  {filteredSales.length === 0 ? (
                    <div className="p-6 text-center">
                      <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">{t('archive.empty.sales')}</p>
                      <p className="text-sm text-gray-400">{t('archive.empty.salesHelper')}</p>
                    </div>
                  ) : (
                    <>
                    <div className="overflow-x-auto">
                      <table className="w-full table-auto text-sm">
                        <thead className="bg-green-100 text-green-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.sale')}</th>
                            <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.customer')}</th>
                            <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.product')}</th>
                            <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.amount')}</th>
                            <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.status')}</th>
                            <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold uppercase">{t('archive.table.date')}</th>
                            <th className="hidden md:table-cell px-4 py-3 text-right text-xs font-semibold uppercase">{t('archive.table.actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-green-100">
                          {paginatedSales.map((sale) => (
                            <tr key={sale.id} className="hover:bg-green-25 transition-colors">
                              <td className="px-4 py-3 align-top">
                                <button
                                  onClick={() => onViewSale?.(sale)}
                                  className="text-green-600 hover:text-green-800 font-medium transition-colors"
                                >
                                  {sale.saleNumber || `SAL-${sale.id}`}
                                </button>
                                <div className="mt-2 space-y-2 text-xs text-gray-600 md:hidden">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-500 font-medium">{t('archive.table.customer')}:</span>
                                    <span className="text-gray-900">{sale.customerName}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-500 font-medium">{t('archive.table.product')}:</span>
                                    <span className="text-gray-900">{sale.productName || '—'}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-500 font-medium">{t('archive.table.amount')}:</span>
                                    <span className="text-green-600 font-semibold">{formatAmount(sale.amount)}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-500 font-medium">{t('archive.table.status')}:</span>
                                    <span className="inline-flex">{getStatusBadge(sale.status, 'sale')}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-gray-500 font-medium">{t('archive.table.date')}:</span>
                                    <span className="text-gray-900">{formatDate(sale.date)}</span>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 md:hidden">
                                  <button 
                                    onClick={() => onViewSale?.(sale)}
                                    className="inline-flex items-center justify-center w-9 h-9 rounded text-gray-400 hover:text-green-600 hover:bg-green-50"
                                    title={t('archive.actions.view')}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => onDownloadSale?.(sale)}
                                    className="inline-flex items-center justify-center w-9 h-9 rounded text-gray-400 hover:text-green-600 hover:bg-green-50"
                                    title={t('archive.actions.download')}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                              <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-900">{sale.customerName}</td>
                              <td className="hidden lg:table-cell px-4 py-3 text-sm text-gray-900">{sale.productName}</td>
                              <td className="hidden md:table-cell px-4 py-3 text-sm font-semibold text-green-600">
                                {formatAmount(sale.amount)}
                              </td>
                              <td className="hidden lg:table-cell px-4 py-3">
                                {getStatusBadge(sale.status, 'sale')}
                              </td>
                              <td className="hidden lg:table-cell px-4 py-3 text-sm text-gray-500">
                                {formatDate(sale.date)}
                              </td>
                              <td className="hidden md:table-cell px-4 py-3 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <button 
                                    onClick={() => onViewSale?.(sale)}
                                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title={t('archive.actions.view')}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => onDownloadSale?.(sale)}
                                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title={t('archive.actions.download')}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-3 border-t border-green-200 bg-green-50">
                      <Pagination
                        page={salePage}
                        pageSize={salePageSize}
                        total={filteredSales.length}
                        onPageChange={setSalePage}
                        onPageSizeChange={handleSalePageSizeChange}
                      />
                    </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Archived Customers */}
          {shouldShowSection('contacts') && (
            <div className="mb-8">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleSection('customers')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Users className="w-5 h-5 text-purple-600 mr-2" />
                  {t('archive.sections.customers')} ({filteredCustomers.length})
                </h3>
                {expandedSections.has('customers') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {expandedSections.has('customers') && (
                <div className="bg-purple-50 rounded-lg border border-purple-200 overflow-hidden">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-6 text-center">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">{t('archive.empty.customers')}</p>
                    </div>
                  ) : (
                    <>
                    <div className="divide-y divide-purple-100">
                      {paginatedCustomers.map((customer) => (
                        <div key={customer.id} className="p-4 hover:bg-purple-25 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <span className="text-purple-600 font-semibold">
                                  {customer.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <button
                                  onClick={() => onViewCustomer?.(customer)}
                                  className="font-medium text-purple-600 hover:text-purple-800 transition-colors"
                                >
                                  {customer.name}
                                </button>
                                {customer.company && (
                                  <p className="text-sm text-gray-600">{customer.company}</p>
                                )}
                                <p className="text-xs text-gray-500">{customer.email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-500">
                                {t('archive.table.registered')}: {formatDate(customer.createdAt)}
                              </div>
                              <button 
                                onClick={() => onViewCustomer?.(customer)}
                                className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors mt-1"
                                title={t('archive.actions.view')}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-purple-200 bg-purple-50">
                      <Pagination
                        page={custPage}
                        pageSize={custPageSize}
                        total={filteredCustomers.length}
                        onPageChange={setCustPage}
                        onPageSizeChange={handleCustPageSizeChange}
                      />
                    </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Archived Suppliers */}
          {shouldShowSection('contacts') && (
            <div className="mb-8">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleSection('suppliers')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Building2 className="w-5 h-5 text-orange-600 mr-2" />
                  {t('archive.sections.suppliers')} ({filteredSuppliers.length})
                </h3>
                {expandedSections.has('suppliers') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {expandedSections.has('suppliers') && (
                <div className="bg-orange-50 rounded-lg border border-orange-200 overflow-hidden">
                  {filteredSuppliers.length === 0 ? (
                    <div className="p-6 text-center">
                      <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">{t('archive.empty.suppliers')}</p>
                    </div>
                  ) : (
                    <>
                    <div className="divide-y divide-orange-100">
                      {paginatedSuppliers.map((supplier) => (
                        <div key={supplier.id} className="p-4 hover:bg-orange-25 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                <span className="text-orange-600 font-semibold">
                                  {supplier.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <button
                                  onClick={() => onViewSupplier?.(supplier)}
                                  className="font-medium text-orange-600 hover:text-orange-800 transition-colors"
                                >
                                  {supplier.name}
                                </button>
                                {supplier.company && (
                                  <p className="text-sm text-gray-600">{supplier.company}</p>
                                )}
                                <div className="flex items-center space-x-2">
                                  <p className="text-xs text-gray-500">{supplier.email}</p>
                                  <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                                    {supplier.category}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-500">
                                {t('archive.table.registered')}: {formatDate(supplier.createdAt)}
                              </div>
                              <button 
                                onClick={() => onViewSupplier?.(supplier)}
                                className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors mt-1"
                                title={t('archive.actions.view')}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-orange-200 bg-orange-50">
                      <Pagination
                        page={supPage}
                        pageSize={supPageSize}
                        total={filteredSuppliers.length}
                        onPageChange={setSupPage}
                        onPageSizeChange={handleSupPageSizeChange}
                      />
                    </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Archive Summary */}
          {activeTab === 'all' && (
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="w-5 h-5 text-gray-600 mr-2" />
                {t('archive.sections.archiveSummary')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">{t('archive.summary.financial')}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('archive.summary.totalIncome')}:</span>
                      <span className="font-semibold text-green-600">{formatAmount(totalArchivedAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('archive.summary.totalExpense')}:</span>
                      <span className="font-semibold text-red-600">{formatAmount(totalArchivedExpenses)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-300 pt-2">
                      <span className="text-gray-900 font-medium">{t('archive.summary.netArchive')}:</span>
                      <span className={`font-bold ${totalArchivedAmount - totalArchivedExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatAmount(totalArchivedAmount - totalArchivedExpenses)}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">{t('archive.summary.recordCounts')}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('archive.archivedInvoices')}:</span>
                      <span className="font-medium">{archivedInvoices.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('archive.archivedExpenses')}:</span>
                      <span className="font-medium">{archivedExpenses.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('archive.archivedSales')}:</span>
                      <span className="font-medium">{archivedSales.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('archive.totalContacts')}:</span>
                      <span className="font-medium">{archivedCustomers.length + archivedSuppliers.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800">{t('archive.info.title')}</h4>
                <p className="text-sm text-blue-700 mt-1">
                  {t('archive.info.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
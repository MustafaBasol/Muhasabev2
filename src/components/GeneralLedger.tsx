import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import InvoiceViewModal from './InvoiceViewModal';
import ExpenseViewModal from './ExpenseViewModal';
import SaleViewModal from './SaleViewModal';
import { useCurrency } from '../contexts/CurrencyContext';
import Pagination from './Pagination';
import { safeLocalStorage } from '../utils/localStorageSafe';
import * as invoicesApi from '../api/invoices';
import * as expensesApi from '../api/expenses';
import * as salesApi from '../api/sales';
import type { Sale } from '../types';
import type { ExpenseRecord, InvoiceRecord } from '../types/records';

// --- Helpers ---
// Sayısal stringleri güvenli biçimde sayıya çevir ("2000.00", "2.000,00", "2,000.00")
export const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;

  // Eğer hem nokta hem virgül varsa genelde binlik '.' ondalık ',' kabul edilir → 1.234,56
  if (s.includes('.') && s.includes(',')) {
    const withoutThousands = s.replace(/\./g, '');
    const withDotDecimal = withoutThousands.replace(/,/g, '.');
    const n = parseFloat(withDotDecimal);
    return Number.isFinite(n) ? n : 0;
  }

  // Sadece virgül içeriyorsa virgül ondalık ayracı kabul et → 123,45
  if (s.includes(',') && !s.includes('.')) {
    const n = parseFloat(s.replace(/,/g, '.'));
    return Number.isFinite(n) ? n : 0;
  }

  // Aksi halde doğrudan parse et ("2000.00" veya "2000")
  const n = parseFloat(s.replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
};

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  reference?: string;
  customer?: string;
  category?: string;
  // Raporlama için gerçek etkiler (ödenmiş/pay edilmiş tutarlar)
  debit: number;
  credit: number;
  // Görsel gösterim için her zaman dolu tutarlar (ödenmemiş olsa bile)
  displayDebit?: number;
  displayCredit?: number;
  balance: number;
  type: 'invoice' | 'expense' | 'sale';
  originalData: InvoiceRecord | ExpenseRecord | Sale;
}

interface GeneralLedgerProps {
  invoices: InvoiceRecord[];
  expenses: ExpenseRecord[];
  sales: Sale[];
  onViewInvoice?: (invoice: InvoiceRecord) => void;
  onEditInvoice?: (invoice: InvoiceRecord) => void;
  onViewExpense?: (expense: ExpenseRecord) => void;
  onEditExpense?: (expense: ExpenseRecord) => void;
  onViewSale?: (sale: Sale) => void;
  onEditSale?: (sale: Sale) => void;
  onViewEntry?: (entry: LedgerEntry) => void;
  onInvoicesUpdate?: (invoices: InvoiceRecord[]) => void;
  onExpensesUpdate?: (expenses: ExpenseRecord[]) => void;
  onSalesUpdate?: (sales: Sale[]) => void;
}

export default function GeneralLedger({
  invoices,
  expenses,
  sales,
  onInvoicesUpdate,
  onExpensesUpdate,
  onSalesUpdate,
}: GeneralLedgerProps) {
  const { formatCurrency } = useCurrency();
  const { t, i18n } = useTranslation();
  
  const [searchTerm] = useState('');
  const [startDate] = useState('');
  const [endDate] = useState('');
  const [customerSearch] = useState('');
  const [categoryFilter] = useState('');
  const [typeFilter] = useState('all');
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceRecord | null>(null);
  const [viewingExpense, setViewingExpense] = useState<ExpenseRecord | null>(null);
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const LEDGER_PAGE_SIZES = [20, 50, 100] as const;
  const isValidLedgerPageSize = (value: number): value is (typeof LEDGER_PAGE_SIZES)[number] =>
    LEDGER_PAGE_SIZES.includes(value as (typeof LEDGER_PAGE_SIZES)[number]);
  const getSavedLedgerPageSize = (): number => {
    const saved = safeLocalStorage.getItem('ledger_pageSize');
    const parsed = saved ? Number(saved) : LEDGER_PAGE_SIZES[0];
    return isValidLedgerPageSize(parsed) ? parsed : LEDGER_PAGE_SIZES[0];
  };

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => getSavedLedgerPageSize());

  const didRefreshRef = useRef(false);

  // Muhasebe sayfasına girince güncel veriyi backend'den çek.
  // Amaç: başka sayfada/sekmede silinen satış/fatura/gider burada “stale” kalmasın.
  useEffect(() => {
    if (didRefreshRef.current) return;
    didRefreshRef.current = true;
    let cancelled = false;

    const refresh = async () => {
      try {
        const nextInvoices = await invoicesApi.getInvoices();
        if (!cancelled) {
          (onInvoicesUpdate as any)?.(nextInvoices as any);
        }
      } catch {
        // Sessiz geç: sayfayı bozmasın
      }

      try {
        const nextExpenses = await expensesApi.getExpenses();
        if (!cancelled) {
          (onExpensesUpdate as any)?.(nextExpenses as any);
        }
      } catch {
        // Sessiz geç: sayfayı bozmasın
      }

      try {
        const nextSales = await salesApi.getSales();
        if (!cancelled) {
          (onSalesUpdate as any)?.(nextSales as any);
        }
      } catch {
        // Sessiz geç: sayfayı bozmasın
      }
    };
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [onExpensesUpdate, onInvoicesUpdate, onSalesUpdate]);

  // Convert all transactions to ledger entries
  const entries: LedgerEntry[] = useMemo(() => {
    const entries: LedgerEntry[] = [];
    const allTransactions: Array<{ date: string; type: 'invoice' | 'expense' | 'sale'; data: InvoiceRecord | ExpenseRecord | Sale; }> = [];

    const isSaleInvoiced = (sale: Sale): boolean => {
      const anySale = sale as any;
      const saleId = String(anySale?.id ?? '');
      if (!saleId) return false;

      // Direkt link alanı varsa
      if (anySale?.invoiceId) return true;

      // Invoice.saleId ile bağlanmış olabilir
      const viaSaleId = invoices.some((inv) => String((inv as any)?.saleId ?? '') === saleId);
      if (viaSaleId) return true;

      // Bazı sürümlerde invoice.notes içine satış numarası yazılıyor
      const saleNumber = String(anySale?.saleNumber ?? `SAL-${saleId}`);
      return invoices.some((inv) => {
        const notes = (inv as any)?.notes;
        return typeof notes === 'string' && notes.includes(saleNumber);
      });
    };

    // Helpers to robustly get amounts
    const getInvoiceTotal = (inv: InvoiceRecord): number => {
      if (inv == null) return 0;
      if (inv.total != null) return toNumber(inv.total);
      if (inv.amount != null) return toNumber(inv.amount);
      if (Array.isArray(inv.items)) {
        return inv.items.reduce((sum: number, it) => sum + toNumber(it.quantity) * toNumber(it.unitPrice), 0);
      }
      return 0;
    };
    const getExpenseAmount = (exp: ExpenseRecord): number => {
      if (exp == null) return 0;
      return toNumber(exp.amount);
    };
    const getSaleAmount = (sale: Sale): number => {
      const anySale = sale as any;
      // Prefer explicit totals if present
      if (anySale?.total != null) return toNumber(anySale.total);
      if (anySale?.amount != null) return toNumber(anySale.amount);

      // Multi-item sales: sum item totals (or qty*unitPrice)
      const items = Array.isArray(anySale?.items) ? anySale.items : [];
      if (items.length > 0) {
        const sum = items.reduce((acc: number, it: any) => {
          const lineTotal = it?.total != null
            ? toNumber(it.total)
            : (toNumber(it?.quantity) * toNumber(it?.unitPrice));
          return acc + lineTotal;
        }, 0);
        return toNumber(sum);
      }

      // Legacy single-item fields
      return toNumber(anySale?.quantity) * toNumber(anySale?.unitPrice);
    };

    const getSaleDate = (sale: Sale): string => {
      const anySale = sale as any;
      return String(anySale?.date || anySale?.saleDate || anySale?.createdAt || '') || '';
    };

    const getSaleCustomerName = (sale: Sale): string => {
      const anySale = sale as any;
      const direct = typeof anySale?.customerName === 'string' ? anySale.customerName : '';
      const fromObj = typeof anySale?.customer?.name === 'string' ? anySale.customer.name : '';
      return direct || fromObj || '';
    };

    const getSaleTitle = (sale: Sale): string => {
      const anySale = sale as any;
      const direct = typeof anySale?.productName === 'string' ? anySale.productName : '';
      if (direct) return direct;
      const items = Array.isArray(anySale?.items) ? anySale.items : [];
      const first = items[0];
      const firstName = (typeof first?.productName === 'string' && first.productName.trim())
        ? first.productName.trim()
        : (typeof first?.description === 'string' && first.description.trim())
          ? first.description.trim()
          : '';
      if (firstName) {
        const extraCount = Math.max(0, items.length - 1);
        return extraCount > 0 ? `${firstName} +${extraCount}` : firstName;
      }
      return t('common.generic.sale') as unknown as string;
    };

    // Add invoices
    invoices.forEach(invoice => {
      allTransactions.push({
        date: invoice.issueDate,
        type: 'invoice',
        data: invoice
      });
    });

    // Add expenses
    expenses.forEach(expense => {
      allTransactions.push({
        date: expense.expenseDate,
        type: 'expense',
        data: expense
      });
    });

    // Add sales (always visible in ledger).
    // Important: If a sale has an invoice, we still show the sale row, but we must NOT count it in totals
    // (otherwise sale + invoice would be double-counted). Totals will prefer the invoice.
    sales.forEach(sale => {
      allTransactions.push({
        date: getSaleDate(sale),
        type: 'sale',
        data: sale
      });
    });

  // Sort by date: newest first (desc)
  allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Running balance
    let runningBalance = 0;

    allTransactions.forEach(transaction => {
      if (transaction.type === 'invoice') {
        const invoice = transaction.data;
        const invTotal = getInvoiceTotal(invoice);
        // Affects balance only if invoice is paid
        if (invoice.status === 'paid') {
          runningBalance += invTotal;
        }

        const category = invoice.type === 'product'
          ? t('chartOfAccounts.accountNames.601')
          : t('chartOfAccounts.accountNames.602');

        entries.push({
          id: `inv-${invoice.id}`,
          date: invoice.issueDate,
          description: `${t('ledger.entry.invoicePrefix')} - ${invoice.customerName || invoice.customer?.name || t('common.generic.customer')}`,
          reference: invoice.invoiceNumber,
          customer: invoice.customerName || invoice.customer?.name || '',
          category,
          debit: 0,
          credit: invoice.status === 'paid' ? invTotal : 0,
          displayCredit: invTotal,
          balance: runningBalance,
          type: 'invoice',
          originalData: invoice
        });
      } else if (transaction.type === 'expense') {
        const expense = transaction.data;
        const expAmount = getExpenseAmount(expense);
        if (expense.status === 'paid') {
          runningBalance -= expAmount;
        }

        const expenseCategoryKey = `expenseCategories.${expense.category}`;
        const expenseCategoryLabel = i18n.exists(expenseCategoryKey) ? t(expenseCategoryKey) : expense.category;

        entries.push({
          id: `exp-${expense.id}`,
          date: expense.expenseDate,
          description: `${t('ledger.entry.expensePrefix')} - ${expense.description}`,
          reference: expense.expenseNumber,
          customer: expense.supplier?.name || expense.supplier || '',
          category: expenseCategoryLabel,
          debit: expense.status === 'paid' ? expAmount : 0,
          credit: 0,
          displayDebit: expAmount,
          balance: runningBalance,
          type: 'expense',
          originalData: expense
        });
      } else if (transaction.type === 'sale') {
        const sale = transaction.data;
        const saleAmount = getSaleAmount(sale);
        const saleTitle = getSaleTitle(sale);
        const saleCustomer = getSaleCustomerName(sale);
        const saleCompleted = String((sale as any)?.status || '').toLowerCase() === 'completed';
        const shouldCountSaleInTotals = saleCompleted && !isSaleInvoiced(sale);
        if (shouldCountSaleInTotals) {
          runningBalance += saleAmount;
        }

        entries.push({
          id: `sal-${sale.id}`,
          date: getSaleDate(sale),
          description: `${t('ledger.entry.salePrefix')} - ${saleTitle}`,
          reference: sale.saleNumber || `SAL-${sale.id}`,
          customer: saleCustomer,
          category: t('chartOfAccounts.accountNames.601'),
          debit: 0,
          credit: shouldCountSaleInTotals ? saleAmount : 0,
          displayCredit: saleAmount,
          balance: runningBalance,
          type: 'sale',
          originalData: sale
        });
      }
    });

    return entries;
  // Dil değiştiğinde yeniden oluştur (i18n.language bağımlılığı eklendi)
  }, [invoices, expenses, sales, i18n.language]);

  // Filters
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesType = typeFilter === 'all' || entry.type === typeFilter;
      const matchesSearch =
        !searchTerm ||
        (entry.description && entry.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (entry.reference && entry.reference.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (entry.customer && entry.customer.toLowerCase().includes(searchTerm.toLowerCase()));

      const entryDate = new Date(entry.date);
      const matchesStartDate = !startDate || entryDate >= new Date(startDate);
      const matchesEndDate = !endDate || entryDate <= new Date(endDate);
      const matchesDateRange = matchesStartDate && matchesEndDate;

      const matchesCustomer = !customerSearch ||
        (entry.customer && entry.customer.toLowerCase().includes(customerSearch.toLowerCase()));

      const matchesCategory = !categoryFilter ||
        (entry.category && entry.category.toLowerCase().includes(categoryFilter.toLowerCase()));

      return matchesType && matchesSearch && matchesDateRange && matchesCustomer && matchesCategory;
    });
  }, [entries, typeFilter, searchTerm, startDate, endDate, customerSearch, categoryFilter]);

  const paginatedEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, searchTerm, startDate, endDate, customerSearch, categoryFilter]);

  const handlePageSizeChange = (size: number) => {
    const nextSize = isValidLedgerPageSize(size) ? size : LEDGER_PAGE_SIZES[0];
    setPageSize(nextSize);
    safeLocalStorage.setItem('ledger_pageSize', String(nextSize));
    setPage(1);
  };

  // Rendering helpers
  const formatAmount = (n: number) =>
    formatCurrency(n || 0);

  const getTypeIcon = (type: 'invoice' | 'expense' | 'sale') => {
    if (type === 'invoice') {
      return (
        <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
          <span className="text-blue-600 text-xs font-bold">{t('ledger.typeAbbrev.invoice')}</span>
        </div>
      );
    } else if (type === 'expense') {
      return (
        <div className="w-6 h-6 bg-red-100 rounded flex items-center justify-center">
          <span className="text-red-600 text-xs font-bold">{t('ledger.typeAbbrev.expense')}</span>
        </div>
      );
    } else if (type === 'sale') {
      return (
        <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
          <span className="text-green-600 text-xs font-bold">{t('ledger.typeAbbrev.sale')}</span>
        </div>
      );
    }
    return null;
  };

  // UI (table/list) — bu kısım projendeki mevcut JSX yapısına göre zaten vardı,
  // burada yalnızca logic düzeltildi. Aşağıda örnek render devam eder:
  return (
    <div className="space-y-6">
      {/* Filters / Search */}
      {/* ... mevcut filtre ve arama UI kodların ... */}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-white shadow">
          <div className="text-sm text-gray-500">{t('ledger.totalCredit')}</div>
          <div className="text-xl font-semibold">
            {formatAmount(filteredEntries.reduce((sum, e) => sum + e.credit, 0))}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-white shadow">
          <div className="text-sm text-gray-500">{t('ledger.totalDebit')}</div>
          <div className="text-xl font-semibold">
            {formatAmount(filteredEntries.reduce((sum, e) => sum + e.debit, 0))}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-white shadow">
          <div className="text-sm text-gray-500">{t('ledger.netBalance')}</div>
          <div className="text-xl font-semibold">
            {formatAmount(
              filteredEntries.reduce((sum, e) => sum + e.credit - e.debit, 0)
            )}
          </div>
        </div>
      </div>

      {/* Entries List / Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="divide-y divide-gray-100">
          {paginatedEntries.map((entry) => (
            <div key={entry.id} className="grid grid-cols-12 items-center px-4 py-3">
              <div className="col-span-3 flex items-center gap-3">
                {getTypeIcon(entry.type)}
                <div>
                  <div className="text-sm font-medium text-gray-900">{entry.description}</div>
                  <div className="text-xs text-gray-500">
                    {entry.reference ? `${t('ledger.referenceShort')}: ${entry.reference} • ` : ''}{entry.customer || '-'}
                  </div>
                </div>
              </div>
              <div className="col-span-2 text-sm text-gray-700">{entry.date}</div>
              <div className="col-span-3 text-sm text-gray-700">{entry.category || '-'}</div>
              <div className="col-span-2 text-right">
                <span className={`text-sm font-medium ${(entry.displayDebit ?? entry.debit) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {formatAmount(entry.displayDebit ?? entry.debit)}
                </span>
              </div>
              <div className="col-span-2 text-right">
                <span className={`text-sm font-medium ${(entry.displayCredit ?? entry.credit) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {formatAmount(entry.displayCredit ?? entry.credit)}
                </span>
              </div>
            </div>
          ))}
          {filteredEntries.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-500">{t('ledger.empty')}</div>
          )}
        </div>
        <div className="p-3 border-t border-gray-200 bg-white">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filteredEntries.length}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      </div>

      {/* View Modals */}
      {viewingInvoice && (
        <InvoiceViewModal 
          invoice={viewingInvoice} 
          isOpen={true}
          onClose={() => setViewingInvoice(null)} 
          onEdit={() => {}} 
        />
      )}
      {viewingExpense && (
        <ExpenseViewModal 
          expense={viewingExpense} 
          isOpen={true}
          onClose={() => setViewingExpense(null)} 
          onEdit={() => {}} 
        />
      )}
      {viewingSale && (
        <SaleViewModal 
          sale={viewingSale} 
          isOpen={true}
          onClose={() => setViewingSale(null)} 
          onEdit={() => {}} 
        />
      )}
    </div>
  );
}

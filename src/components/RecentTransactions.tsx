import React, { useMemo } from 'react';
import { useCurrency, Currency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { normalizeStatusKey, resolveStatusLabel } from '../utils/status';
import { Invoice } from '../api/invoices';
import { Expense } from '../api/expenses';
import { SaleRecord } from '../api/sales';
import { Quote } from '../api/quotes';

type InvoiceLike = Partial<Invoice>;
type ExpenseLike = Partial<Expense>;
type SaleLike = Partial<SaleRecord>;
type QuoteLike = Partial<Quote>;

type TransactionType = 'invoice' | 'expense' | 'sale' | 'quote';

interface UnifiedTransaction {
  id: string;
  customer: string;
  amount: string;
  status?: string;
  date: string;
  type: TransactionType;
  originalData: InvoiceLike | ExpenseLike | SaleLike | QuoteLike;
  sortDate: Date;
}

interface RecentTransactionsProps {
  invoices?: InvoiceLike[];
  expenses?: ExpenseLike[];
  sales?: SaleLike[];
  quotes?: QuoteLike[];
  onViewInvoice?: (invoice: InvoiceLike) => void;
  onEditInvoice?: (invoice: InvoiceLike) => void;
  onDownloadInvoice?: (invoice: InvoiceLike) => void;
  onViewExpense?: (expense: ExpenseLike) => void;
  onEditExpense?: (expense: ExpenseLike) => void;
  onDownloadExpense?: (expense: ExpenseLike) => void;
  onViewSale?: (sale: SaleLike) => void;
  onEditSale?: (sale: SaleLike) => void;
  onDownloadSale?: (sale: SaleLike) => void;
  onViewQuote?: (quote: QuoteLike) => void;
  onViewAllTransactions?: () => void;
}

export default function RecentTransactions({ 
  invoices = [], 
  expenses = [], 
  sales = [],
  quotes = [],
  onViewInvoice,
  onEditInvoice,
  onDownloadInvoice,
  onViewExpense,
  onEditExpense,
  onDownloadExpense,
  onViewSale,
  onEditSale,
  onDownloadSale,
  onViewQuote,
  onViewAllTransactions
}: RecentTransactionsProps) {
  
  const { formatCurrency } = useCurrency();
  const { t, i18n } = useTranslation();

  const unusedCallbacks = { onEditInvoice, onDownloadInvoice, onEditExpense, onDownloadExpense, onEditSale, onDownloadSale };
  void unusedCallbacks;

  const isCurrency = (value?: string): value is Currency =>
    value === 'TRY' || value === 'USD' || value === 'EUR' || value === 'GBP';

  // Combine all transactions and sort by exact time (descending: newest first)
  const transactions = useMemo<UnifiedTransaction[]>(() => {
    const formatDate = (value?: string | number | Date | null): string => {
      if (!value) return '—';
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return '—';
      return date.toLocaleDateString(i18n.language, {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    };

    const formatAmount = (amount?: number | string | null) => {
      const n = Number(amount);
      const safe = Number.isFinite(n) ? n : 0;
      return formatCurrency(safe);
    };

    // Sıralama mantığı:
    // 1) Ana görünür tarih (issueDate/expenseDate/date) gün sıralamasını belirler.
    // 2) Aynı gün içindeki sıralama için createdAt varsa ve aynı güne denk geliyorsa onu saat/dakika için kullanır;
    //    yoksa updatedAt aynı günse onu kullanır; değilse ana tarih kullanılır.
    const parseDate = (value?: string | number | Date | null): Date | null => {
      if (!value) return null;
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const isSameDay = (a: Date | null, b: Date | null): boolean => {
      if (!a || !b) return false;
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    };
    const pickSortDate = (
      raw: Record<string, unknown> & { createdAt?: string | Date; updatedAt?: string | Date },
      baseField: string
    ): Date => {
      const base = parseDate(raw?.[baseField] as string | Date | undefined);
      const created = parseDate(raw?.createdAt);
      const updated = parseDate(raw?.updatedAt);
      if (base) {
        if (isSameDay(created, base)) return created as Date;
        if (isSameDay(updated, base)) return updated as Date;
        return base;
      }
      return created || updated || new Date(0);
    };
    const allTransactions = [
      // Invoices
      ...invoices.map((invoice, index) => {
        const id = invoice.invoiceNumber || invoice.id || invoice.createdAt || `invoice-${index}`;
        const customer = invoice.customer?.name || invoice.customerName || t('dashboard.noCustomer');
        const issueDate = invoice.issueDate || invoice.createdAt || invoice.updatedAt;
        return {
          id: String(id),
          customer,
          amount: formatAmount(invoice.total),
          status: invoice.status,
          date: formatDate(issueDate),
          type: 'invoice' as const,
          originalData: invoice,
          sortDate: pickSortDate(invoice, 'issueDate')
        };
      }),
      // Expenses
      ...expenses.map((expense, index) => {
        const id = expense.expenseNumber || expense.id || expense.createdAt || `expense-${index}`;
        const description = expense.description || t('dashboard.noCustomer');
        const expenseDate = expense.expenseDate || expense.date || expense.createdAt;
        return {
          id: String(id),
          customer: description,
          amount: formatAmount(expense.amount),
          status: expense.status,
          date: formatDate(expenseDate),
          type: 'expense' as const,
          originalData: expense,
          sortDate: pickSortDate(expense, 'expenseDate')
        };
      }),
      // Sales
      ...sales.map((sale, index) => {
        const rawId = sale.saleNumber || sale.id || sale.createdAt || `sale-${index}`;
        const id = sale.saleNumber ? String(rawId) : `SAL-${String(rawId)}`;
        const saleDate = sale.date || sale.saleDate || sale.createdAt;
        return {
          id,
          customer: sale.customerName || t('dashboard.noCustomer'),
          amount: formatAmount(sale.amount ?? sale.total),
          status: sale.status,
          date: formatDate(saleDate),
          type: 'sale' as const,
          originalData: sale,
          sortDate: pickSortDate(sale, 'date')
        };
      }),
      // Quotes
      ...quotes.map((quote, index) => {
        const rawId = quote.quoteNumber || quote.id || quote.createdAt || `quote-${index}`;
        const id = quote.quoteNumber ? String(rawId) : `Q-${String(rawId)}`;
        const quoteDate = quote.issueDate || quote.createdAt || quote.updatedAt;
        const currency = isCurrency(quote.currency) ? quote.currency : undefined;
        return {
          id,
          customer: quote.customerName || t('dashboard.noCustomer'),
          amount: formatCurrency(Number(quote.total) || 0, currency),
          status: quote.status,
          date: formatDate(quoteDate),
          type: 'quote' as const,
          originalData: quote,
          sortDate: pickSortDate(quote, 'issueDate')
        };
      })
    ];

    // Sort by exact datetime descending and take only the newest 3
    return allTransactions
      .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
      .slice(0, 3);
  }, [invoices, expenses, sales, quotes, t, formatCurrency, i18n.language]);

  const getStatusBadge = (status: string | undefined, type: TransactionType) => {
    const key = normalizeStatusKey(status || 'unknown');
    if (type === 'quote') {
      // Teklif durumları için bazı anahtarlar quotes.statusLabels.* altında tanımlı değil (draft, sent);
      // Bu nedenle önce quotes.statusLabels.* deniyoruz, bulunamazsa common:status.* fallback kullanıyoruz.
      const resolve = (primary: string, fallback: string) => {
        const val = t(primary);
        return val === primary ? t(`common:${fallback}`) : val;
      };
      const quoteStatus = {
        draft: { label: resolve('quotes.statusLabels.draft', 'status.draft'), class: 'bg-gray-100 text-gray-800' },
        sent: { label: resolve('quotes.statusLabels.sent', 'status.sent'), class: 'bg-blue-100 text-blue-800' },
        viewed: { label: resolve('quotes.statusLabels.viewed', 'status.viewed'), class: 'bg-indigo-100 text-indigo-800' },
        accepted: { label: resolve('quotes.statusLabels.accepted', 'status.accepted'), class: 'bg-green-100 text-green-800' },
        declined: { label: resolve('quotes.statusLabels.declined', 'status.declined'), class: 'bg-red-100 text-red-800' },
        expired: { label: resolve('quotes.statusLabels.expired', 'status.expired'), class: 'bg-yellow-100 text-yellow-800' }
      } as const;
      const cfg = quoteStatus[key as keyof typeof quoteStatus];
      return cfg || { label: t(`common:status.${key}`, key), class: 'bg-gray-100 text-gray-800' };
    }

    const statusConfig = {
      paid: { label: resolveStatusLabel(t, 'paid'), class: 'bg-green-100 text-green-800' },
      completed: { label: resolveStatusLabel(t, 'completed'), class: 'bg-green-100 text-green-800' },
      pending: { label: resolveStatusLabel(t, 'pending'), class: 'bg-yellow-100 text-yellow-800' },
      overdue: { label: resolveStatusLabel(t, 'overdue'), class: 'bg-red-100 text-red-800' },
      draft: { label: resolveStatusLabel(t, 'draft'), class: 'bg-gray-100 text-gray-800' },
      sent: { label: resolveStatusLabel(t, 'sent'), class: 'bg-blue-100 text-blue-800' },
      approved: { label: resolveStatusLabel(t, 'approved'), class: 'bg-blue-100 text-blue-800' },
      cancelled: { label: resolveStatusLabel(t, 'cancelled'), class: 'bg-red-100 text-red-800' }
    } as const;
    const config = statusConfig[key as keyof typeof statusConfig];
    return config || { label: resolveStatusLabel(t, key), class: 'bg-gray-100 text-gray-800' };
  };

  const getTypeIcon = (type: TransactionType) => {
    if (type === 'invoice') {
      return (
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <span className="text-blue-600 text-xs font-bold">F</span>
        </div>
      );
    } else if (type === 'expense') {
      return (
        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
          <span className="text-red-600 text-xs font-bold">G</span>
        </div>
      );
    } else if (type === 'sale') {
      return (
        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
          <span className="text-green-600 text-xs font-bold">S</span>
        </div>
      );
    } else if (type === 'quote') {
      return (
        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
          <span className="text-purple-600 text-xs font-bold">T</span>
        </div>
      );
    }
    return (
      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
        <span className="text-blue-600 text-xs font-bold">F</span>
      </div>
    );
  };

  // Simple click handlers
  const handleRowClick = (transaction: UnifiedTransaction) => {
    if (transaction.type === 'invoice') {
      onViewInvoice?.(transaction.originalData);
    } else if (transaction.type === 'expense') {
      onViewExpense?.(transaction.originalData);
    } else if (transaction.type === 'sale') {
      onViewSale?.(transaction.originalData);
    } else if (transaction.type === 'quote') {
      onViewQuote?.(transaction.originalData);
    }
  };

  // Not: Edit/Download ikonları kaldırıldığı için ilgili handler'lar da kaldırıldı.

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('dashboard.recentTransactions')}</h3>
            <p className="text-sm text-gray-500">{t('dashboard.lastTransactions').replace('{count}', transactions.length.toString())}</p>
          </div>
          {onViewAllTransactions && (
            <button
              onClick={onViewAllTransactions}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              {t('dashboard.viewAll')} →
            </button>
          )}
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('transactions.transaction')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('transactions.customerDescription')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('transactions.amount')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('transactions.status')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('transactions.date')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('transactions.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  {t('transactions.noTransactions')}
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => {
                const badge = getStatusBadge(transaction.status, transaction.type);
                const amountPrefix = transaction.type === 'expense' ? '-' : '+';
                return (
                  <tr 
                    key={transaction.id} 
                    onClick={() => handleRowClick(transaction)}
                    className="hover:bg-gray-50 transition-colors"
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        {getTypeIcon(transaction.type)}
                        <span className="text-sm text-gray-900">
                          {transaction.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {transaction.customer}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-semibold ${
                        transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'
                        }`}>
                        {amountPrefix}{transaction.amount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.class}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.date}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
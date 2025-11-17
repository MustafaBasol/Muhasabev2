import React, { useMemo } from 'react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { normalizeStatusKey, resolveStatusLabel } from '../utils/status';

interface RecentTransactionsProps {
  invoices?: any[];
  expenses?: any[];
  sales?: any[];
  quotes?: any[];
  onViewInvoice?: (invoice: any) => void;
  onEditInvoice?: (invoice: any) => void;
  onDownloadInvoice?: (invoice: any) => void;
  onViewExpense?: (expense: any) => void;
  onEditExpense?: (expense: any) => void;
  onDownloadExpense?: (expense: any) => void;
  onViewSale?: (sale: any) => void;
  onEditSale?: (sale: any) => void;
  onDownloadSale?: (sale: any) => void;
  onViewQuote?: (quote: any) => void;
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
  // Opsiyonel callback'ler şu an satır aksiyonlarında kullanılmıyor; lint uyarılarını önlemek için referansla.
  const _callbacks = { onEditInvoice, onDownloadInvoice, onEditExpense, onDownloadExpense, onEditSale, onDownloadSale, React };
  void _callbacks;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatAmount = (amount?: number | string) => {
    const n = Number(amount);
    const safe = Number.isFinite(n) ? n : 0;
    return formatCurrency(safe);
  };

  // Combine all transactions and sort by exact time (descending: newest first)
  const transactions = useMemo(() => {
    // Sıralama mantığı:
    // 1) Ana görünür tarih (issueDate/expenseDate/date) gün sıralamasını belirler.
    // 2) Aynı gün içindeki sıralama için createdAt varsa ve aynı güne denk geliyorsa onu saat/dakika için kullanır;
    //    yoksa updatedAt aynı günse onu kullanır; değilse ana tarih kullanılır.
    const parseDate = (v: any): Date | null => {
      if (!v) return null;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };
    const isSameDay = (a: Date | null, b: Date | null): boolean => {
      if (!a || !b) return false;
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    };
    const pickSortDate = (raw: any, baseField: string): Date => {
      const base = parseDate(raw?.[baseField]);
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
      ...invoices.map(invoice => ({
        id: invoice.invoiceNumber || invoice.id,
        customer: (invoice as any)?.customer?.name || (invoice as any)?.customerName || t('dashboard.noCustomer'),
        amount: formatAmount(invoice.total),
        status: invoice.status,
        date: formatDate(invoice.issueDate), // Görsel tarihte gün seviyesinde gösterim
        type: 'invoice',
        originalData: invoice,
        sortDate: pickSortDate(invoice, 'issueDate')
      })),
      // Expenses
      ...expenses.map(expense => ({
        id: expense.expenseNumber || expense.id,
        customer: expense.description,
        amount: formatAmount(expense.amount),
        status: expense.status,
        date: formatDate(expense.expenseDate),
        type: 'expense',
        originalData: expense,
        sortDate: pickSortDate(expense, 'expenseDate')
      })),
      // Sales
      ...sales.map(sale => ({
        id: sale.saleNumber || `SAL-${sale.id}`,
        customer: sale.customerName,
        amount: formatAmount(sale.amount),
        status: sale.status,
        date: formatDate(sale.date),
        type: 'sale',
        originalData: sale,
        sortDate: pickSortDate(sale, 'date')
      })),
      // Quotes
      ...quotes.map((q: any) => ({
        id: q.quoteNumber || `Q-${q.id}`,
        customer: q.customerName,
        amount: formatCurrency(Number(q.total) || 0, q.currency),
        status: q.status,
        date: formatDate(q.issueDate || q.createdAt || new Date().toISOString()),
        type: 'quote',
        originalData: q,
        sortDate: pickSortDate(q, 'issueDate')
      }))
    ];

    // Sort by exact datetime descending and take only the newest 3
    return allTransactions
      .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
      .slice(0, 3);
  }, [invoices, expenses, sales, quotes, t, formatCurrency, i18n.language]);

  const getStatusBadge = (status: string, type: string) => {
    const key = normalizeStatusKey(status);
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

  const getTypeIcon = (type: string) => {
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
  const handleRowClick = (transaction: any) => {
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
              transactions.map((transaction) => (
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
                      {transaction.type === 'expense' ? '-' : '+'}{transaction.amount}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(transaction.status, transaction.type).class}`}>
                      {getStatusBadge(transaction.status, transaction.type).label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.date}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { Search, Eye, Building2, FileText, Hash, RefreshCw } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { formatAppDate } from '../utils/dateFormat';
import { normalizeText } from '../utils/sortAndSearch';
import type { Expense } from '../api/expenses';

type IncomingExpense = Expense & {
  amount: number | string;
  expenseDate: string;
};

interface IncomingInvoiceListProps {
  expenses: IncomingExpense[];
  onViewExpense: (expense: IncomingExpense) => void;
  onSync?: () => Promise<void>;
}

export default function IncomingInvoiceList({ expenses, onViewExpense, onSync }: IncomingInvoiceListProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation('common');
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const filtered = expenses.filter(e => {
    const q = normalizeText(search);
    if (!q) return true;
    const haystack = [
      e.providerInvoiceNumber,
      e.senderName,
      e.senderVatNumber,
      e.description,
      String(e.amount),
    ].map(v => normalizeText(v ?? '')).join(' ');
    return haystack.includes(q);
  });

  const handleSync = async () => {
    if (!onSync) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      await onSync();
      setSyncMsg(t('integrations.pennylane.incomingSyncDone'));
    } catch {
      setSyncMsg(t('integrations.pennylane.incomingSyncError'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('incomingInvoices.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {t('incomingInvoices.count', { count: filtered.length })}
        </span>
        {/* Sağ: sync butonu + mesaj */}
        <div className="ml-auto flex items-center gap-3">
          {syncMsg && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{syncMsg}</span>
          )}
          {onSync && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing
                ? t('integrations.pennylane.incomingSyncing')
                : t('integrations.pennylane.syncIncoming')}
            </button>
          )}
        </div>
      </div>

      {/* Tablo */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm text-center max-w-sm">
              {expenses.length === 0
                ? t('incomingInvoices.empty')
                : t('incomingInvoices.noResults')}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('incomingInvoices.invoiceNo')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('incomingInvoices.sender')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('incomingInvoices.vatNo')}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('incomingInvoices.amount')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('incomingInvoices.date')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{t('incomingInvoices.source')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map(expense => (
                  <tr
                    key={expense.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-mono text-xs text-gray-700 dark:text-gray-200">
                          {expense.providerInvoiceNumber ?? expense.expenseNumber ?? '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-gray-800 dark:text-gray-100">
                          {expense.senderName ?? expense.description ?? '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                      {expense.senderVatNumber ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-100">
                      {formatCurrency(Number(expense.amount ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {expense.expenseDate ? formatAppDate(expense.expenseDate) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {expense.eInvoiceSource === 'pennylane' && (
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 rounded-full px-2 py-0.5">
                          Pennylane
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onViewExpense(expense)}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                        title={t('incomingInvoices.view')}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

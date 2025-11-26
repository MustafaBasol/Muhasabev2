import { useMemo } from 'react';
import { X, Receipt, Calendar } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { normalizeStatusKey, resolveStatusLabel } from '../utils/status';
import type { Expense } from '../api/expenses';
import type { Supplier as SupplierModel } from '../api/suppliers';

type SupplierSummary = Pick<SupplierModel, 'id' | 'name'> & Partial<Pick<SupplierModel, 'email' | 'company'>>;

type ExpenseListItem = Pick<Expense, 'id' | 'expenseNumber' | 'description' | 'amount' | 'status'> & {
  expenseDate?: string | Date;
  date?: string | Date;
};

type EnrichedExpense = ExpenseListItem & { _rowId: string };

interface SupplierHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: SupplierSummary | null;
  expenses: ExpenseListItem[];
  onViewExpense?: (expense: ExpenseListItem) => void;
  onCreateExpense?: (supplier: SupplierSummary) => void;
}

export default function SupplierHistoryModal({ 
  isOpen, 
  onClose, 
  supplier, 
  expenses,
  onViewExpense,
  onCreateExpense
}: SupplierHistoryModalProps) {
  const { formatCurrency } = useCurrency();
  const { t, i18n } = useTranslation();

  const statusLabels = useMemo(() => ({
    paid: `✅ ${resolveStatusLabel(t, 'paid')}`,
    approved: `📋 ${resolveStatusLabel(t, 'approved')}`,
    draft: `📝 ${resolveStatusLabel(t, 'draft')}`
  }), [t]);

  const formatDate = (value?: string | Date) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : undefined);
  };

  const formatAmount = (amount?: number) => {
    const numeric = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
    return formatCurrency(numeric);
  };

  const resolvedExpenses: EnrichedExpense[] = useMemo(() => {
    if (!Array.isArray(expenses)) return [];
    return expenses
      .filter(Boolean)
      .map((expense, index) => ({
        ...expense,
        _rowId: expense.id || expense.expenseNumber || `expense-${index}`,
      }));
  }, [expenses]);

  if (!isOpen || !supplier) return null;

  const handleCreateExpense = () => {
    onCreateExpense?.(supplier);
  };

  const handleViewExpense = (expense: ExpenseListItem) => {
    onViewExpense?.(expense);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {supplier.name} - {t('supplier.expenseHistory')}
            </h2>
            <p className="text-sm text-gray-500">
              {resolvedExpenses.length} {t('supplier.expensesFound')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {resolvedExpenses.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('supplier.noExpenseHistory')}
              </h3>
              <p className="text-gray-500 mb-6">
                {supplier.name} {t('supplier.noExpenseHistoryDesc')}
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  💡 <strong>{t('supplier.tip')}</strong> {t('supplier.tipDesc')}
                </p>
                <button
                  onClick={handleCreateExpense}
                  className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  {t('supplier.createExpense')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {resolvedExpenses.map((expense) => (
                <div key={expense._rowId} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <Receipt className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <button
                          onClick={() => handleViewExpense(expense)}
                          className="font-medium text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                          title={t('supplier.viewExpense')}
                        >
                          {expense.expenseNumber || t('expenses.unnamed', { defaultValue: 'Gider' })}
                        </button>
                        <p className="text-sm text-gray-600">{expense.description}</p>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(expense.expenseDate || expense.date)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-600">
                        -{formatAmount(expense.amount)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {(() => {
                          const key = normalizeStatusKey(String(expense.status || ''));
                          return statusLabels[key as keyof typeof statusLabels] || resolveStatusLabel(t, key);
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
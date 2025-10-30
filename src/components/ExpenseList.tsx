import { useState } from 'react';
import { Search, Plus, Eye, Edit, Download, Trash2, Receipt, Calendar, Check, X, Ban, RotateCcw } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';

interface Expense {
  id: string;
  expenseNumber: string;
  description: string;
  supplier?: {
    id: string;
    name: string;
    email: string;
    address: string;
  };
  amount: number | string;
  category: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  expenseDate: string;
  notes?: string;
  receiptUrl?: string;
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
}

interface ExpenseListProps {
  expenses: Expense[];
  onAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
  onViewExpense: (expense: Expense) => void;
  onUpdateExpense: (expense: Expense) => void;
  onDownloadExpense?: (expense: Expense) => void;
  onVoidExpense?: (expenseId: string, reason: string) => void;
  onRestoreExpense?: (expenseId: string) => void;
}

export default function ExpenseList({ 
  expenses, 
  onAddExpense, 
  onEditExpense, 
  onDeleteExpense,
  onViewExpense,
  onUpdateExpense,
  onDownloadExpense,
  onVoidExpense,
  onRestoreExpense
}: ExpenseListProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showVoided, setShowVoided] = useState(false);
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidingExpense, setVoidingExpense] = useState<Expense | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Kategori listesi
  const categories = ['equipment', 'utilities', 'rent', 'salaries', 'personnel', 'supplies', 'marketing', 'travel', 'insurance', 'taxes', 'other'];

  // Kategori çeviri fonksiyonu
  const getCategoryLabel = (category: string): string => {
    return t(`expenseCategories.${category}`) || category;
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = 
      expense.expenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (expense.supplier?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || expense.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
    
    // Void kontrolü - varsayılan olarak void edilmiş giderleri gizle
    const matchesVoidFilter = showVoided || !expense.isVoided;
    
    return matchesSearch && matchesStatus && matchesCategory && matchesVoidFilter;
  });

  const getStatusBadge = (status: string, isVoided?: boolean) => {
    if (isVoided) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          İptal Edildi
        </span>
      );
    }

    const statusConfig = {
      pending: { label: t('status.pending'), class: 'bg-yellow-100 text-yellow-800' },
      approved: { label: t('status.approved'), class: 'bg-blue-100 text-blue-800' },
      paid: { label: t('status.paid'), class: 'bg-green-100 text-green-800' },
      rejected: { label: t('status.rejected'), class: 'bg-red-100 text-red-800' }
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

  const formatAmount = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return formatCurrency(numAmount || 0);
  };

  const handleInlineEdit = (expenseId: string, field: string, currentValue: string) => {
    setEditingExpense(expenseId);
    setEditingField(field);
    setTempValue(currentValue);
  };

  const handleSaveInlineEdit = (expense: Expense) => {
    if (editingField === 'status') {
      onUpdateExpense({ ...expense, status: tempValue as any });
    }
    setEditingExpense(null);
    setEditingField(null);
    setTempValue('');
  };

  const handleCancelInlineEdit = () => {
    setEditingExpense(null);
    setEditingField(null);
    setTempValue('');
  };

  const handleVoidExpense = (expense: Expense) => {
    setVoidingExpense(expense);
    setShowVoidModal(true);
  };

  const handleConfirmVoid = () => {
    if (voidingExpense && onVoidExpense && voidReason.trim()) {
      onVoidExpense(voidingExpense.id, voidReason);
      setShowVoidModal(false);
      setVoidingExpense(null);
      setVoidReason('');
    }
  };

  const handleRestoreExpense = (expenseId: string) => {
    if (onRestoreExpense) {
      onRestoreExpense(expenseId);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{t('expenses.title')}</h2>
            <p className="text-sm text-gray-500">
              {expenses.length} {t('expenses.expensesRegistered')}
            </p>
          </div>
          <button
            onClick={onAddExpense}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('expenses.newExpense')}</span>
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t('expenses.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">{t('expenses.filterAll')}</option>
            <option value="pending">{t('status.pending')}</option>
            <option value="approved">{t('status.approved')}</option>
            <option value="paid">{t('status.paid')}</option>
            <option value="rejected">{t('status.rejected')}</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">{t('common.allCategories')}</option>
            {categories.map(category => (
              <option key={category} value={category}>{getCategoryLabel(category)}</option>
            ))}
          </select>
          <label className="flex items-center px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
            <input
              type="checkbox"
              checked={showVoided}
              onChange={(e) => setShowVoided(e.target.checked)}
              className="mr-2"
            />
{showVoided ? t('fiscalPeriods.filters.hideVoided') : t('fiscalPeriods.filters.showVoided')}
          </label>
        </div>
      </div>

      {/* Expense List */}
      <div className="divide-y divide-gray-200">
        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' ? t('expenses.noExpensesFound') : t('expenses.noExpenses')}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                ? t('expenses.noExpensesFoundDesc')
                : t('expenses.noExpensesDesc')
              }
            </p>
            {!searchTerm && statusFilter === 'all' && categoryFilter === 'all' && (
              <button
                onClick={onAddExpense}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                {t('expenses.createFirstExpense')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.description')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.supplier')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.category')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.amount')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.date')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('expenses.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                          <Receipt className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            <button
                              onClick={() => onViewExpense(expense)}
                              className="text-red-600 hover:text-red-800 font-medium transition-colors cursor-pointer"
                              title={t('expenses.viewExpense')}
                            >
                              {expense.expenseNumber}
                            </button>
                          </div>
                          <div className="text-xs text-gray-500">
                            {expense.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {expense.supplier?.name || 'Tedarikçi Yok'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                        {getCategoryLabel(expense.category)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-red-600">
                        -{formatAmount(expense.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingExpense === expense.id && editingField === 'status' ? (
                        <div className="flex items-center space-x-2">
                          <select
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500"
                          >
                            <option value="pending">{t('status.pending')}</option>
                            <option value="approved">{t('status.approved')}</option>
                            <option value="paid">{t('status.paid')}</option>
                            <option value="rejected">{t('status.rejected')}</option>
                          </select>
                          <button
                            onClick={() => handleSaveInlineEdit(expense)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={handleCancelInlineEdit}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => !expense.isVoided && handleInlineEdit(expense.id, 'status', expense.status)}
                          className={`${!expense.isVoided ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'} transition-opacity inline-block`}
                        >
                          {getStatusBadge(expense.status, expense.isVoided)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingExpense === expense.id && editingField === 'dueDate' ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="date"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500"
                          />
                          <button
                            onClick={() => handleSaveInlineEdit(expense)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={handleCancelInlineEdit}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(expense.expenseDate)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => onViewExpense(expense)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={t('expenses.view')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onEditExpense(expense)}
                          disabled={expense.isVoided}
                          className={`p-1 rounded transition-colors ${
                            expense.isVoided 
                              ? 'text-gray-300 cursor-not-allowed' 
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={expense.isVoided ? 'İptal edilmiş gider düzenlenemez' : t('expenses.edit')}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if (onDownloadExpense) {
                              onDownloadExpense(expense);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title={t('expenses.download')}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {expense.isVoided ? (
                          <button 
                            onClick={() => handleRestoreExpense(expense.id)}
                            className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Gideri geri yükle"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleVoidExpense(expense)}
                            className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="Gideri iptal et"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => onDeleteExpense(expense.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={t('expenses.delete')}
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

      {/* Void Modal */}
      {showVoidModal && voidingExpense && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Gideri İptal Et
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              <strong>{voidingExpense.description}</strong> giderini iptal etmek istediğinizden emin misiniz?
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
                  setVoidingExpense(null);
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
                Gideri İptal Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
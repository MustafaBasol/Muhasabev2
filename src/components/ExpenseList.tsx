import React, { useState } from 'react';
import { Search, Plus, Eye, Edit, Download, Trash2, Receipt, Calendar, DollarSign, Check, X } from 'lucide-react';

interface Expense {
  id: string;
  expenseNumber: string;
  description: string;
  supplier: string;
  amount: number;
  category: string;
  status: 'draft' | 'approved' | 'paid';
  expenseDate: string;
  dueDate: string;
  receiptUrl?: string;
}

interface ExpenseListProps {
  expenses: Expense[];
  onAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
  onViewExpense: (expense: Expense) => void;
  onUpdateExpense: (expense: Expense) => void;
  onDownloadExpense?: (expense: Expense) => void;
}

export default function ExpenseList({ 
  expenses, 
  onAddExpense, 
  onEditExpense, 
  onDeleteExpense,
  onViewExpense,
  onUpdateExpense,
  onDownloadExpense
}: ExpenseListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingExpense, setEditingExpense] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  const categories = ['Ofis Malzemeleri', 'Kira', 'Elektrik', 'Su', 'İnternet', 'Telefon', 'Yakıt', 'Yemek', 'Diğer'];

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = 
      expense.expenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || expense.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Taslak', class: 'bg-gray-100 text-gray-800' },
      approved: { label: 'Onaylandı', class: 'bg-blue-100 text-blue-800' },
      paid: { label: 'Ödendi', class: 'bg-green-100 text-green-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
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
    return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  const handleInlineEdit = (expenseId: string, field: string, currentValue: string) => {
    setEditingExpense(expenseId);
    setEditingField(field);
    setTempValue(currentValue);
  };

  const handleSaveInlineEdit = (expense: Expense) => {
    if (editingField === 'status') {
      onUpdateExpense({ ...expense, status: tempValue as any });
    } else if (editingField === 'dueDate') {
      onUpdateExpense({ ...expense, dueDate: tempValue });
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

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Giderler</h2>
            <p className="text-sm text-gray-500">
              {expenses.length} gider kaydı
            </p>
          </div>
          <button
            onClick={onAddExpense}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Gider</span>
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Gider numarası, açıklama veya tedarikçi ara..."
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
            <option value="all">Tüm Durumlar</option>
            <option value="draft">Taslak</option>
            <option value="approved">Onaylandı</option>
            <option value="paid">Ödendi</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">Tüm Kategoriler</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
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
              {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' ? 'Gider bulunamadı' : 'Henüz gider yok'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'Arama kriterlerinize uygun gider bulunamadı.'
                : 'İlk giderinizi ekleyerek başlayın.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && categoryFilter === 'all' && (
              <button
                onClick={onAddExpense}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                İlk Gideri Ekle
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tedarikçi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tutar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tarih
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
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
                              title="Gideri görüntüle"
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
                        {expense.supplier}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                        {expense.category}
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
                            <option value="draft">Taslak</option>
                            <option value="approved">Onaylandı</option>
                            <option value="paid">Ödendi</option>
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
                          onClick={() => handleInlineEdit(expense.id, 'status', expense.status)}
                          className="cursor-pointer hover:opacity-80 transition-opacity inline-block"
                        >
                          {getStatusBadge(expense.status)}
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
                        <div 
                          onClick={() => handleInlineEdit(expense.id, 'dueDate', expense.dueDate)}
                          className="cursor-pointer hover:bg-gray-50 rounded p-1"
                        >
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(expense.expenseDate)}
                          </div>
                          {expense.dueDate && (
                            <div className="text-xs text-gray-400">
                              Vade: {formatDate(expense.dueDate)}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => onViewExpense(expense)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Görüntüle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onEditExpense(expense)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Düzenle"
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
                          title="İndir"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onDeleteExpense(expense.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Sil"
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
    </div>
  );
}
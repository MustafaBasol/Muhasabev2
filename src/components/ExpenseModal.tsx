import React, { useState } from 'react';
import { X, Plus, Receipt, Calendar, Building2, Tag } from 'lucide-react';

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

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Expense) => void;
  expense?: Expense | null;
  supplierInfo?: {
    name: string;
    category?: string;
  } | null;
}

const categories = [
  'Ofis Malzemeleri',
  'Kira',
  'Elektrik',
  'Su',
  'İnternet',
  'Telefon',
  'Yakıt',
  'Yemek',
  'Kırtasiye',
  'Temizlik',
  'Bakım-Onarım',
  'Sigorta',
  'Vergi',
  'Diğer'
];

export default function ExpenseModal({ isOpen, onClose, onSave, expense, supplierInfo }: ExpenseModalProps) {
  const [expenseData, setExpenseData] = useState({
    expenseNumber: expense?.expenseNumber || `EXP-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
    description: expense?.description || '',
    supplier: expense?.supplier || supplierInfo?.name || '',
    amount: expense?.amount || 0,
    category: expense?.category || supplierInfo?.category || 'Diğer',
    status: expense?.status || 'draft',
    expenseDate: expense?.expenseDate || new Date().toISOString().split('T')[0],
    dueDate: expense?.dueDate || '',
    receiptUrl: expense?.receiptUrl || ''
  });

  // Reset form when modal opens for new expense
  React.useEffect(() => {
    if (isOpen && !expense) {
      // New expense - reset form
      setExpenseData({
        expenseNumber: `EXP-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
        description: '',
        supplier: supplierInfo?.name || '',
        amount: 0,
        category: supplierInfo?.category || 'Diğer',
        status: 'draft',
        expenseDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        receiptUrl: ''
      });
    } else if (isOpen && expense) {
      // Editing existing expense - load data
      setExpenseData({
        expenseNumber: expense.expenseNumber,
        description: expense.description,
        supplier: expense.supplier,
        amount: expense.amount || 0,
        category: expense.category,
        status: expense.status,
        expenseDate: expense.expenseDate,
        dueDate: expense.dueDate,
        receiptUrl: expense.receiptUrl || ''
      });
    }
  }, [isOpen, expense, supplierInfo]);

  const handleSave = () => {
    const expenseToSave: Expense = {
      id: expense?.id || Date.now().toString(),
      ...expenseData,
      createdAt: expense?.createdAt || new Date().toISOString()
    } as any;
    
    onSave(expenseToSave);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {expense ? 'Gideri Düzenle' : 'Yeni Gider Ekle'}
              </h2>
              <p className="text-sm text-gray-500">Gider bilgilerini girin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gider Numarası
              </label>
              <input
                type="text"
                value={expenseData.expenseNumber}
                onChange={(e) => setExpenseData({...expenseData, expenseNumber: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="w-4 h-4 inline mr-2" />
                Kategori *
              </label>
              <select
                value={expenseData.category}
                onChange={(e) => setExpenseData({...expenseData, category: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Açıklama *
            </label>
            <input
              type="text"
              value={expenseData.description}
              onChange={(e) => setExpenseData({...expenseData, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Gider açıklaması..."
              required
            />
          </div>

          {/* Supplier and Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Tedarikçi/Firma
              </label>
              <input
                type="text"
                value={expenseData.supplier}
                onChange={(e) => setExpenseData({...expenseData, supplier: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Tedarikçi adı..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tutar (₺) *
              </label>
              <input
                type="number"
                value={expenseData.amount}
                onChange={(e) => setExpenseData({...expenseData, amount: parseFloat(e.target.value) || 0})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="0.00"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          {/* Dates and Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Gider Tarihi *
              </label>
              <input
                type="date"
                value={expenseData.expenseDate}
                onChange={(e) => setExpenseData({...expenseData, expenseDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ödeme Tarihi
              </label>
              <input
                type="date"
                value={expenseData.dueDate}
                onChange={(e) => setExpenseData({...expenseData, dueDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Durum
              </label>
              <select
                value={expenseData.status}
                onChange={(e) => setExpenseData({...expenseData, status: e.target.value as any})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="draft">Taslak</option>
                <option value="approved">Onaylandı</option>
                <option value="paid">Ödendi</option>
              </select>
            </div>
          </div>

          {/* Receipt URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fiş/Fatura URL'si
            </label>
            <input
              type="url"
              value={expenseData.receiptUrl}
              onChange={(e) => setExpenseData({...expenseData, receiptUrl: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="https://example.com/receipt.pdf"
            />
            <p className="text-xs text-gray-500 mt-1">
              Fiş veya fatura görselinin/PDF'inin bağlantısını ekleyebilirsiniz
            </p>
          </div>

          {/* Amount Summary */}
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex justify-between items-center">
              <span className="text-red-800 font-medium">Toplam Gider:</span>
              <span className="text-xl font-bold text-red-600">
                ₺{(expenseData.amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={!expenseData.description || !expenseData.amount}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {expense ? 'Güncelle' : 'Gider Ekle'}
          </button>
        </div>
      </div>
    </div>
  );
}
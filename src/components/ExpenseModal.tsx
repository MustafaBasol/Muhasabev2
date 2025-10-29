import React, { useState } from 'react';
import { X, Receipt, Calendar, Building2, Tag } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';

interface Expense {
  id: string;
  expenseNumber: string;
  description: string;
  supplierId?: string;
  supplier?: {
    id: string;
    name: string;
  };
  amount: number;
  category: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  expenseDate: string;
  dueDate?: string;
  receiptUrl?: string;
  notes?: string;
}

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Expense) => void;
  expense?: Expense | null;
  suppliers?: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
  }>;
  supplierInfo?: {
    name: string;
    category?: string;
  } | null;
}

const categories = [
  { label: 'Diğer', value: 'other' },
  { label: 'Ekipman', value: 'equipment' },
  { label: 'Faturalar (Elektrik, Su, İnternet)', value: 'utilities' },
  { label: 'Kira', value: 'rent' },
  { label: 'Maaşlar', value: 'salaries' },
  { label: 'Malzemeler', value: 'supplies' },
  { label: 'Pazarlama', value: 'marketing' },
  { label: 'Seyahat', value: 'travel' },
  { label: 'Sigorta', value: 'insurance' },
  { label: 'Vergiler', value: 'taxes' },
];

export default function ExpenseModal({ isOpen, onClose, onSave, expense, suppliers = [], supplierInfo }: ExpenseModalProps) {
  const { formatCurrency } = useCurrency();
  
  const [expenseData, setExpenseData] = useState({
    expenseNumber: expense?.expenseNumber || `EXP-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
    description: expense?.description || '',
    supplier: expense?.supplier?.name || expense?.supplierId || supplierInfo?.name || '',
    supplierId: expense?.supplierId || '',
    amount: String(expense?.amount || 0),
    category: expense?.category || supplierInfo?.category || 'other',
    status: expense?.status || 'pending',
    expenseDate: expense?.expenseDate || new Date().toISOString().split('T')[0],
    dueDate: expense?.dueDate || '',
    receiptUrl: expense?.receiptUrl || '',
    notes: expense?.notes || ''
  });

  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [filteredSuppliers, setFilteredSuppliers] = useState(suppliers);

  // Reset form when modal opens for new expense
  React.useEffect(() => {
    if (isOpen && !expense) {
      // New expense - reset form
      setExpenseData({
        expenseNumber: `EXP-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
        description: '',
        supplier: supplierInfo?.name || '',
        supplierId: '',
        amount: "0",
        category: supplierInfo?.category || 'other',
        status: 'pending',
        expenseDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        receiptUrl: '',
        notes: ''
      });
    } else if (isOpen && expense) {
      // Editing existing expense - load data
      setExpenseData({
        expenseNumber: expense.expenseNumber,
        description: expense.description,
        supplier: expense.supplier?.name || '',
        supplierId: expense.supplier?.id || '',
        amount: String(expense.amount),
        category: expense.category,
        status: expense.status,
        expenseDate: expense.expenseDate,
        dueDate: expense.dueDate || '',
        receiptUrl: expense.receiptUrl || '',
        notes: expense.notes || ''
      });
    }
  }, [isOpen, expense, supplierInfo]);

  const handleSave = () => {
    // Validation
    if (!expenseData.description?.trim()) {
      alert('Lütfen açıklama girin');
      return;
    }
    if (!expenseData.amount || Number(expenseData.amount) <= 0) {
      alert('Lütfen geçerli bir tutar girin');
      return;
    }
    if (!expenseData.category) {
      alert('Lütfen kategori seçin');
      return;
    }
    
    const newExpense: any = {
      description: expenseData.description.trim(),
      amount: Number(expenseData.amount),
      category: expenseData.category,
      expenseDate: expenseData.expenseDate || new Date().toISOString().split('T')[0],
      supplierId: expenseData.supplierId && expenseData.supplierId.trim() ? expenseData.supplierId : null,
      status: expenseData.status || 'pending',
      notes: expenseData.notes?.trim() || '',
    };
    
    // Only include ID if editing
    if (expense?.id) {
      newExpense.id = expense.id;
    }
    
    onSave(newExpense);
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
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
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
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Tedarikçi/Firma
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={expenseData.supplier}
                  onChange={(e) => {
                    const value = e.target.value;
                    setExpenseData({...expenseData, supplier: value, supplierId: ''});
                    
                    // Filter suppliers
                    if (value.length >= 2) {
                      const filtered = suppliers?.filter(s => 
                        s.name.toLowerCase().includes(value.toLowerCase()) ||
                        s.email?.toLowerCase().includes(value.toLowerCase())
                      );
                      setFilteredSuppliers(filtered || []);
                      setShowSupplierDropdown(true);
                    } else {
                      setShowSupplierDropdown(false);
                    }
                  }}
                  onFocus={() => {
                    if (expenseData.supplier.length >= 2) {
                      setShowSupplierDropdown(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click on dropdown item
                    setTimeout(() => setShowSupplierDropdown(false), 200);
                  }}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Tedarikçi adı yazın..."
                />
                {/* Clear supplier button */}
                {expenseData.supplier && (
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseData({...expenseData, supplier: '', supplierId: ''});
                      setShowSupplierDropdown(false);
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* Autocomplete Dropdown */}
              {showSupplierDropdown && filteredSuppliers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredSuppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      onClick={() => {
                        setExpenseData({
                          ...expenseData,
                          supplier: supplier.name,
                          supplierId: supplier.id
                        });
                        setShowSupplierDropdown(false);
                      }}
                      className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{supplier.name}</div>
                      {supplier.email && (
                        <div className="text-sm text-gray-500">{supplier.email}</div>
                      )}
                      {supplier.phone && (
                        <div className="text-sm text-gray-500">{supplier.phone}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tutar (₺) *
              </label>
              <input
                type="number"
                value={expenseData.amount}
                onChange={(e) => setExpenseData({...expenseData, amount: e.target.value})}
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
                <option value="pending">Beklemede</option>
                <option value="approved">Onaylandı</option>
                <option value="paid">Ödendi</option>
                <option value="rejected">Reddedildi</option>
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
                {formatCurrency(Number(expenseData.amount) || 0)}
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
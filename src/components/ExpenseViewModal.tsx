import React from 'react';
import { X, Download, Edit, Calendar, Building2, Tag, Receipt } from 'lucide-react';

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

interface ExpenseViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  onEdit: (expense: Expense) => void;
  onDownload?: (expense: Expense) => void;
}

export default function ExpenseViewModal({ 
  isOpen, 
  onClose, 
  expense, 
  onEdit, 
  onDownload 
}: ExpenseViewModalProps) {
  if (!isOpen || !expense) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const formatAmount = (amount: number) => {
    return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Taslak', class: 'bg-gray-100 text-gray-800' },
      approved: { label: 'Onaylandı', class: 'bg-blue-100 text-blue-800' },
      paid: { label: 'Ödendi', class: 'bg-green-100 text-green-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.class}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{expense.expenseNumber}</h2>
              <p className="text-sm text-gray-500">Gider Detayları</p>
            </div>
            {getStatusBadge(expense.status)}
          </div>
          <div className="flex items-center space-x-2">
            {onDownload && (
              <button
                onClick={() => onDownload(expense)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>PDF İndir</span>
              </button>
            )}
            <button
              onClick={() => onEdit(expense)}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              <span>Düzenle</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6" id={`expense-${expense.id}`}>
          {/* Expense Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Gider Bilgileri</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Gider Tarihi:</span>
                  <span className="ml-2 font-medium">{formatDate(expense.expenseDate)}</span>
                </div>
                {expense.dueDate && (
                  <div className="flex items-center text-sm">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Ödeme Tarihi:</span>
                    <span className="ml-2 font-medium">{formatDate(expense.dueDate)}</span>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <Tag className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Kategori:</span>
                  <span className="ml-2 font-medium">{expense.category}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tedarikçi Bilgileri</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Tedarikçi:</span>
                  <span className="ml-2 font-medium">{expense.supplier}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Açıklama</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700">{expense.description}</p>
            </div>
          </div>

          {/* Amount */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tutar Bilgileri</h3>
            <div className="bg-red-50 rounded-lg p-6 border border-red-200">
              <div className="flex justify-between items-center">
                <span className="text-red-800 font-medium text-lg">Toplam Gider:</span>
                <span className="text-2xl font-bold text-red-600">
                  {formatAmount(expense.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Receipt */}
          {expense.receiptUrl && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Fiş/Fatura</h3>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <Receipt className="w-5 h-5 text-blue-600" />
                  <a 
                    href={expense.receiptUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 font-medium underline"
                  >
                    Fiş/Faturayı Görüntüle
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
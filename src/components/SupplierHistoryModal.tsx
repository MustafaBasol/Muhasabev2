import React from 'react';
import { X, Receipt, Calendar } from 'lucide-react';

interface SupplierHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: { name: string } | null;
  expenses: any[];
  onViewExpense?: (expense: any) => void;
  onCreateExpense?: (supplier: any) => void;
}

export default function SupplierHistoryModal({ 
  isOpen, 
  onClose, 
  supplier, 
  expenses,
  onViewExpense,
  onCreateExpense
}: SupplierHistoryModalProps) {
  if (!isOpen || !supplier) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const formatAmount = (amount: number) => {
    return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {supplier.name} - Gider Geçmişi
            </h2>
            <p className="text-sm text-gray-500">
              {expenses.length} gider bulundu
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
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Henüz Gider Geçmişi Yok
              </h3>
              <p className="text-gray-500 mb-6">
                {supplier.name} için henüz gider kaydı bulunmuyor.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  💡 <strong>İpucu:</strong> Bu tedarikçi için yeni bir gider oluşturarak işlem geçmişi başlatabilirsiniz.
                </p>
                <button
                  onClick={() => onCreateExpense?.(supplier)}
                  className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  Gider Oluştur
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {expenses.map((expense, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <Receipt className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <button
                          onClick={() => onViewExpense?.(expense)}
                          className="font-medium text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                          title="Gideri görüntüle"
                        >
                          {expense.expenseNumber}
                        </button>
                        <p className="text-sm text-gray-600">{expense.description}</p>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(expense.expenseDate)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-600">
                        -{formatAmount(expense.amount)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {expense.status === 'paid' ? '✅ Ödendi' : 
                         expense.status === 'approved' ? '📋 Onaylandı' : '📝 Taslak'}
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
import { X, Download, Edit, Calendar, Building2, Tag, Receipt } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';

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
  status: 'draft' | 'approved' | 'paid' | 'pending' | 'rejected';
  expenseDate: string;
  notes?: string;
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
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();

  const statusConfig = useMemo(() => ({
    draft: { label: t('status.draft'), class: 'bg-gray-100 text-gray-800' },
    approved: { label: t('status.approved'), class: 'bg-blue-100 text-blue-800' },
    paid: { label: t('status.paid'), class: 'bg-green-100 text-green-800' },
    pending: { label: t('status.pending'), class: 'bg-yellow-100 text-yellow-800' },
    rejected: { label: t('status.rejected'), class: 'bg-red-100 text-red-800' }
  }), [t]);
  
  if (!isOpen || !expense) return null;

  // Kategori çeviri fonksiyonu (i18n üzerinden)
  const getCategoryLabel = (category: string): string => {
    return t(`expenseCategories.${category}`) || category;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const formatAmount = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return formatCurrency(numAmount || 0);
  };

  // Tedarikçi adı güvenli gösterim
  const getSupplierDisplay = (name?: string) => {
    const n = (name || '').trim();
    // Dil bazlı varsayılan
    const lang = (t as any)?.i18n?.language ? String((t as any).i18n.language).slice(0,2).toLowerCase() : 'tr';
    const localizedFallback = lang === 'tr' ? 'Tedarikçi Yok' : lang === 'de' ? 'Kein Lieferant' : lang === 'fr' ? 'Aucun Fournisseur' : 'No Supplier';
    if (!n) return t('common:noSupplier', { defaultValue: localizedFallback });
    const normalized = n.toLowerCase();
    const placeholders = [
      'nosupplier',
      'no supplier',
      'tedarikçi yok',
      'kein lieferant',
      'aucun fournisseur'
    ];
    if (placeholders.includes(normalized)) return t('common:noSupplier', { defaultValue: localizedFallback });
    return n;
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig] || { 
      label: status || 'Bilinmeyen', 
      class: 'bg-gray-100 text-gray-800' 
    };
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
              <p className="text-sm text-gray-500">{t('expense.details')}</p>
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
                <span>{t('invoice.downloadPdf')}</span>
              </button>
            )}
            <button
              onClick={() => {
                onClose(); // Önce view modal'ı kapat
                setTimeout(() => onEdit(expense), 100); // Sonra edit modal'ı aç
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              <span>{t('common.edit')}</span>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('expense.information')}</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">{t('expense.date')}:</span>
                  <span className="ml-2 font-medium">{formatDate(expense.expenseDate)}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Tag className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">{t('expense.category')}:</span>
                  <span className="ml-2 font-medium">{getCategoryLabel(expense.category)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('expense.supplier')}</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">{t('expense.supplier')}:</span>
                  <span className="ml-2 font-medium">{getSupplierDisplay(
                    typeof (expense as any).supplier === 'string' 
                      ? String((expense as any).supplier) 
                      : (expense as any).supplier?.name
                  )}</span>
                </div>
                {expense.supplier?.email && (
                  <div className="flex items-center text-sm">
                    <span className="text-gray-600">E-posta:</span>
                    <span className="ml-2 font-medium">{expense.supplier.email}</span>
                  </div>
                )}
                {expense.supplier?.address && (
                  <div className="flex items-start text-sm">
                    <span className="text-gray-600">Adres:</span>
                    <span className="ml-2 font-medium">{expense.supplier.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('invoice.description')}</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700">{expense.description}</p>
            </div>
          </div>

          {/* Amount */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('expense.amount')}</h3>
            <div className="bg-red-50 rounded-lg p-6 border border-red-200">
              <div className="flex justify-between items-center">
                <span className="text-red-800 font-medium text-lg">{t('expense.amount')}:</span>
                <span className="text-2xl font-bold text-red-600">
                  {formatAmount(expense.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Receipt */}
          {expense.receiptUrl && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('expense.receipt')}</h3>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <Receipt className="w-5 h-5 text-blue-600" />
                  <a 
                    href={expense.receiptUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 font-medium underline"
                  >
                    {t('expense.viewReceipt')}
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {expense.notes && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('invoice.notes')}</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">{expense.notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
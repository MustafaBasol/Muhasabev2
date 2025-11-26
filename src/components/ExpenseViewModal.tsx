import { X, Download, Edit, Calendar, Building2, Tag, Receipt } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { normalizeStatusKey, resolveStatusLabel } from '../utils/status';
import { safeLocalStorage } from '../utils/localStorageSafe';
import type { Expense as ExpenseModel, ExpenseStatus } from '../api/expenses';

type ExpenseSupplierDetails = {
  id?: string;
  name?: string;
  email?: string;
  address?: string;
};

type ExpenseViewModel = Omit<ExpenseModel, 'amount' | 'expenseDate' | 'status' | 'supplier'> & {
  amount: number | string;
  expenseDate: string;
  status: ExpenseStatus | 'draft';
  supplier?: ExpenseSupplierDetails | string;
  createdByName?: string;
  updatedByName?: string;
};

interface ExpenseViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: ExpenseViewModel | null;
  onEdit: (expense: ExpenseViewModel) => void;
  onDownload?: (expense: ExpenseViewModel) => void;
}

export default function ExpenseViewModal({ 
  isOpen, 
  onClose, 
  expense, 
  onEdit, 
  onDownload 
}: ExpenseViewModalProps) {
  const { formatCurrency } = useCurrency();
  const { t, i18n } = useTranslation();

  // Güçlü çeviri: önce common: ile dener, sonra çıplak anahtarı, en sonda varsayılan metni verir
  const translate = (key: string, def: string) => {
    const scoped = t(`common:${key}`, { defaultValue: '' });
    if (scoped && scoped !== `common:${key}` && scoped.trim() !== '') return scoped;
    const raw = t(key, { defaultValue: '' });
    if (raw && raw !== key && raw.trim() !== '') return raw;
    return def;
  };

  // Sadece oluşturma/güncelleme bölümünde kullanılacak dil ve etiket yardımcıları
  const getActiveLang = () => {
    const stored = safeLocalStorage.getItem('i18nextLng');
    if (stored && typeof stored === 'string' && stored.length >= 2) return stored.slice(0,2).toLowerCase();
    const cand = (i18n?.resolvedLanguage || i18n?.language || 'en').toString();
    return cand.slice(0,2).toLowerCase();
  };
  const toLocale = (l: string) => (l === 'tr' ? 'tr-TR' : l === 'de' ? 'de-DE' : l === 'fr' ? 'fr-FR' : 'en-US');
  const labels: Record<string, Record<string, string>> = {
    tr: { createdBy: 'Oluşturan', createdAt: 'Oluşturulma', updatedBy: 'Son güncelleyen', updatedAt: 'Son güncelleme' },
    en: { createdBy: 'Created by', createdAt: 'Created at', updatedBy: 'Last updated by', updatedAt: 'Last updated' },
    de: { createdBy: 'Erstellt von', createdAt: 'Erstellt am', updatedBy: 'Zuletzt aktualisiert von', updatedAt: 'Zuletzt aktualisiert' },
    fr: { createdBy: 'Créé par', createdAt: 'Créé le', updatedBy: 'Dernière mise à jour par', updatedAt: 'Dernière mise à jour' },
  };
  const lang = getActiveLang();
  const L = labels[lang] || labels.en;

  const statusConfig = useMemo(() => ({
    draft: { label: resolveStatusLabel(t, 'draft'), className: 'bg-gray-100 text-gray-800' },
    approved: { label: resolveStatusLabel(t, 'approved'), className: 'bg-blue-100 text-blue-800' },
    paid: { label: resolveStatusLabel(t, 'paid'), className: 'bg-green-100 text-green-800' },
    pending: { label: resolveStatusLabel(t, 'pending'), className: 'bg-yellow-100 text-yellow-800' },
    rejected: { label: resolveStatusLabel(t, 'rejected'), className: 'bg-red-100 text-red-800' }
  } as Record<string, { label: string; className: string }>), [t]);
  
  if (!isOpen || !expense) return null;

  const supplierDetails = typeof expense.supplier === 'string' ? undefined : expense.supplier;
  const supplierName = typeof expense.supplier === 'string' ? expense.supplier : expense.supplier?.name;

  // Kategori çeviri fonksiyonu (i18n üzerinden)
  const getCategoryLabel = (category: string): string => {
    return t(`expenseCategories.${category}`) || category;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(toLocale(lang));
  };

  const formatAmount = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return formatCurrency(numAmount || 0);
  };

  // Tedarikçi adı güvenli gösterim
  const getSupplierDisplay = (name?: string) => {
    const n = (name || '').trim();
    // Dil bazlı varsayılan
    const langCode = (i18n?.language || 'tr').slice(0,2).toLowerCase();
    const localizedFallback = langCode === 'tr' ? 'Tedarikçi Yok' : langCode === 'de' ? 'Kein Lieferant' : langCode === 'fr' ? 'Aucun Fournisseur' : 'No Supplier';
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
    const key = normalizeStatusKey(status);
    const config = statusConfig[key] || {
      label: resolveStatusLabel(t, key),
      className: 'bg-gray-100 text-gray-800'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
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
              <p className="text-sm text-gray-500">{translate('expense.details', 'Expense Details')}</p>
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
          {/* Oluşturan / Güncelleyen Bilgisi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-xs text-gray-600">
            <div>
              <div>
                <span className="text-gray-500">{L.createdBy}:</span>{' '}
                <span className="font-medium">{expense.createdByName || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">{L.createdAt}:</span>{' '}
                <span className="font-medium">{expense.createdAt ? new Date(expense.createdAt).toLocaleString(toLocale(lang)) : '—'}</span>
              </div>
            </div>
            <div>
              <div>
                <span className="text-gray-500">{L.updatedBy}:</span>{' '}
                <span className="font-medium">{expense.updatedByName || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">{L.updatedAt}:</span>{' '}
                <span className="font-medium">{expense.updatedAt ? new Date(expense.updatedAt).toLocaleString(toLocale(lang)) : '—'}</span>
              </div>
            </div>
          </div>
          {/* Expense Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{translate('expense.information', 'Expense Information')}</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">{translate('expense.date', 'Expense Date')}:</span>
                  <span className="ml-2 font-medium">{formatDate(expense.expenseDate)}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Tag className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">{translate('expense.category', 'Category')}:</span>
                  <span className="ml-2 font-medium">{getCategoryLabel(expense.category)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{translate('expense.supplier', 'Supplier')}</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">{translate('expense.supplier', 'Supplier')}:</span>
                  <span className="ml-2 font-medium">{getSupplierDisplay(supplierName)}</span>
                </div>
                {supplierDetails?.email && (
                  <div className="flex items-center text-sm">
                    <span className="text-gray-600">E-posta:</span>
                    <span className="ml-2 font-medium">{supplierDetails.email}</span>
                  </div>
                )}
                {supplierDetails?.address && (
                  <div className="flex items-start text-sm">
                    <span className="text-gray-600">Adres:</span>
                    <span className="ml-2 font-medium">{supplierDetails.address}</span>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{translate('expense.amount', 'Amount')}</h3>
            <div className="bg-red-50 rounded-lg p-6 border border-red-200">
              <div className="flex justify-between items-center">
                <span className="text-red-800 font-medium text-lg">{translate('expense.amount', 'Amount')}:</span>
                <span className="text-2xl font-bold text-red-600">
                  {formatAmount(expense.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Receipt */}
          {expense.receiptUrl && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{translate('expense.receipt', 'Receipt')}</h3>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <Receipt className="w-5 h-5 text-blue-600" />
                  <a 
                    href={expense.receiptUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 font-medium underline"
                  >
                    {translate('expense.viewReceipt', 'View Receipt')}
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
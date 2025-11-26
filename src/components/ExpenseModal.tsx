import { useEffect, useMemo, useState } from 'react';
import { X, Receipt, Calendar, Building2, Tag } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { resolveStatusLabel } from '../utils/status';
import { useTranslation } from 'react-i18next';
import type { Expense as ExpenseModel } from '../api/expenses';
import { ExpenseStatus } from '../api/expenses';

type SupplierOption = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

type ExpenseFormState = {
  expenseNumber: string;
  description: string;
  supplierInput: string;
  supplierId: string;
  amount: string;
  category: string;
  status: ExpenseStatus;
  expenseDate: string;
  dueDate: string;
  receiptUrl: string;
  notes: string;
};

type ExpenseFormPayload = {
  id?: string;
  expenseNumber?: string;
  description: string;
  amount: number;
  category: string;
  status: ExpenseStatus;
  expenseDate: string;
  date?: string;
  supplierId?: string | null;
  dueDate?: string;
  receiptUrl?: string;
  notes: string;
};

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: ExpenseFormPayload) => void;
  expense?: ExpenseModel | null;
  suppliers?: SupplierOption[];
  supplierInfo?: {
    name: string;
    category?: string;
  } | null;
}

const categoryOptions = [
  { fallbackLabel: 'Diğer', value: 'other' },
  { fallbackLabel: 'Ekipman', value: 'equipment' },
  { fallbackLabel: 'Faturalar', value: 'utilities' },
  { fallbackLabel: 'Kira', value: 'rent' },
  { fallbackLabel: 'Maaşlar', value: 'salaries' },
  { fallbackLabel: 'Malzemeler', value: 'supplies' },
  { fallbackLabel: 'Pazarlama', value: 'marketing' },
  { fallbackLabel: 'Seyahat', value: 'travel' },
  { fallbackLabel: 'Sigorta', value: 'insurance' },
  { fallbackLabel: 'Vergiler', value: 'taxes' },
] as const;

const statusOptions: ExpenseStatus[] = [
  ExpenseStatus.PENDING,
  ExpenseStatus.APPROVED,
  ExpenseStatus.PAID,
  ExpenseStatus.REJECTED,
];

const getTodayIso = () => new Date().toISOString().split('T')[0];

const generateExpenseNumber = () => `EXP-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;

const ensureDateString = (value?: string | Date) => {
  if (!value) return getTodayIso();
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return value;
};

const buildFormState = (
  existing?: ExpenseModel | null,
  supplierPref?: ExpenseModalProps['supplierInfo']
): ExpenseFormState => {
  if (!existing) {
    return {
      expenseNumber: generateExpenseNumber(),
      description: '',
      supplierInput: supplierPref?.name || '',
      supplierId: '',
      amount: '0',
      category: supplierPref?.category || 'other',
      status: ExpenseStatus.PENDING,
      expenseDate: getTodayIso(),
      dueDate: '',
      receiptUrl: '',
      notes: ''
    };
  }

  const supplier = typeof existing.supplier === 'string'
    ? { id: existing.supplierId, name: existing.supplier || '' }
    : existing.supplier;

  return {
    expenseNumber: existing.expenseNumber || generateExpenseNumber(),
    description: existing.description || '',
    supplierInput: supplier?.name || '',
    supplierId: existing.supplierId || supplier?.id || '',
    amount: existing.amount ? String(existing.amount) : '0',
    category: existing.category || 'other',
    status: existing.status || ExpenseStatus.PENDING,
    expenseDate: ensureDateString(existing.expenseDate || existing.date),
    dueDate: existing.dueDate || '',
    receiptUrl: existing.receiptUrl || '',
    notes: existing.notes || ''
  };
};

const parseAmountInput = (value: string) => {
  if (!value) return Number.NaN;
  const normalized = value.replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

export default function ExpenseModal({ isOpen, onClose, onSave, expense, suppliers = [], supplierInfo }: ExpenseModalProps) {
  const { formatCurrency } = useCurrency();
  const { t, i18n } = useTranslation();

  const [expenseData, setExpenseData] = useState<ExpenseFormState>(() => buildFormState(expense, supplierInfo));
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [filteredSuppliers, setFilteredSuppliers] = useState<SupplierOption[]>(suppliers);

  const categorySelectOptions = useMemo(() => (
    categoryOptions.map(({ value, fallbackLabel }) => ({
      value,
      label: t(`expenseCategories.${value}`) || fallbackLabel,
    }))
  ), [t]);

  useEffect(() => {
    if (isOpen) {
      setExpenseData(buildFormState(expense, supplierInfo));
    }
  }, [isOpen, expense, supplierInfo]);

  useEffect(() => {
    setFilteredSuppliers(suppliers);
  }, [suppliers]);

  const handleSupplierInputChange = (value: string) => {
    setExpenseData(prev => ({ ...prev, supplierInput: value, supplierId: '' }));
    const normalized = value.trim().toLowerCase();
    if (normalized.length < 2) {
      setShowSupplierDropdown(false);
      setFilteredSuppliers(suppliers);
      return;
    }

    const filtered = suppliers.filter((supplier) => {
      const lowerName = supplier.name.toLowerCase();
      const lowerEmail = supplier.email ? supplier.email.toLowerCase() : '';
      const lowerPhone = supplier.phone ? supplier.phone.toLowerCase() : '';
      return lowerName.includes(normalized) || lowerEmail.includes(normalized) || lowerPhone.includes(normalized);
    });
    setFilteredSuppliers(filtered);
    setShowSupplierDropdown(filtered.length > 0);
  };

  const handleSave = () => {
    // Validation
    const trimmedDescription = expenseData.description.trim();
    if (!trimmedDescription) {
      alert(t('validation.descriptionRequired') || 'Lütfen açıklama girin');
      return;
    }
    const parsedAmount = parseAmountInput(expenseData.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert(t('validation.amountRequired') || 'Lütfen geçerli bir tutar girin');
      return;
    }
    if (!expenseData.category) {
      alert(t('validation.categoryRequired') || 'Lütfen kategori seçin');
      return;
    }
    
    const resolvedDate = expenseData.expenseDate || getTodayIso();
    const normalizedSupplierId = expenseData.supplierId.trim();

    const payload: ExpenseFormPayload = {
      id: expense?.id,
      expenseNumber: expenseData.expenseNumber.trim() || undefined,
      description: trimmedDescription,
      amount: parsedAmount,
      category: expenseData.category,
      status: expenseData.status,
      expenseDate: resolvedDate,
      date: resolvedDate,
      supplierId: normalizedSupplierId ? normalizedSupplierId : null,
      dueDate: expenseData.dueDate || undefined,
      receiptUrl: expenseData.receiptUrl.trim() || undefined,
      notes: expenseData.notes.trim(),
    };

    onSave(payload);
    onClose();
  };

  const previewAmount = (() => {
    const parsed = parseAmountInput(expenseData.amount);
    return Number.isFinite(parsed) ? parsed : 0;
  })();
  const isSaveDisabled = !expenseData.description.trim() || !expenseData.amount.trim();

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
                {expense ? (t('expenses.editExpense') || 'Gideri Düzenle') : (t('expenses.newExpense') || 'Yeni Gider Ekle')}
              </h2>
              <p className="text-sm text-gray-500">{t('expenses.enterExpenseInfo') || 'Gider bilgilerini girin'}</p>
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
                {t('expenses.expenseNumber') || 'Gider Numarası'}
              </label>
              <input
                type="text"
                value={expenseData.expenseNumber}
                onChange={(e) => setExpenseData(prev => ({ ...prev, expenseNumber: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="w-4 h-4 inline mr-2" />
                {t('expenses.category') || 'Kategori'} *
              </label>
              <select
                value={expenseData.category}
                onChange={(e) => setExpenseData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              >
                {categorySelectOptions.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.description') || 'Açıklama'} *
            </label>
            <input
              type="text"
              value={expenseData.description}
              onChange={(e) => setExpenseData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder={t('expenses.descriptionPlaceholder') || 'Gider açıklaması...'}
              required
            />
          </div>

          {/* Supplier and Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                {t('expenses.supplier') || 'Tedarikçi/Firma'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={expenseData.supplierInput}
                  onChange={(e) => handleSupplierInputChange(e.target.value)}
                  onFocus={() => {
                    if (expenseData.supplierInput.length >= 2 && filteredSuppliers.length > 0) {
                      setShowSupplierDropdown(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click on dropdown item
                    setTimeout(() => setShowSupplierDropdown(false), 200);
                  }}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder={t('expenses.supplierPlaceholder') || 'Tedarikçi adı yazın...'}
                />
                {/* Clear supplier button */}
                {expenseData.supplierInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseData(prev => ({ ...prev, supplierInput: '', supplierId: '' }));
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
                        setExpenseData(prev => ({
                          ...prev,
                          supplierInput: supplier.name,
                          supplierId: supplier.id
                        }));
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
                {t('expenses.amount') || 'Tutar'} *
              </label>
              <input
                type="number"
                value={expenseData.amount}
                onChange={(e) => setExpenseData(prev => ({ ...prev, amount: e.target.value }))}
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
                {t('expenses.expenseDate') || 'Gider Tarihi'} *
              </label>
              <input
                type="date"
                value={expenseData.expenseDate}
                onChange={(e) => setExpenseData(prev => ({ ...prev, expenseDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                lang={i18n.language}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('expenses.paymentDate') || 'Ödeme Tarihi'}
              </label>
              <input
                type="date"
                value={expenseData.dueDate}
                onChange={(e) => setExpenseData(prev => ({ ...prev, dueDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                lang={i18n.language}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('common:statusLabel') || t('common:statusLabel', { lng: 'en' }) || 'Status'}
              </label>
              <select
                value={expenseData.status}
                onChange={(e) => setExpenseData(prev => ({ ...prev, status: e.target.value as ExpenseStatus }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {statusOptions.map(status => (
                  <option key={status} value={status}>
                    {resolveStatusLabel(t, status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Receipt URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('expenses.receiptUrl')}
            </label>
            <input
              type="url"
              value={expenseData.receiptUrl}
              onChange={(e) => setExpenseData(prev => ({ ...prev, receiptUrl: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="https://example.com/receipt.pdf"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('expenses.receiptUrlHelper')}
            </p>
          </div>

          {/* Amount Summary */}
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex justify-between items-center">
              <span className="text-red-800 font-medium">{t('expenses.totalExpense') || 'Toplam Gider'}:</span>
              <span className="text-xl font-bold text-red-600">
                {formatCurrency(previewAmount)}
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
            {t('common.cancel') || 'İptal'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {expense ? (t('common.update') || 'Güncelle') : (t('expenses.addExpense') || 'Gider Ekle')}
          </button>
        </div>
      </div>
    </div>
  );
}
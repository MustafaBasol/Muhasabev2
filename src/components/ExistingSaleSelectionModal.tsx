import { useState, useMemo } from 'react';
import { X, Search, Calendar, User, DollarSign, FileText } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import type { Invoice, Sale } from '../types';
import { safeLocalStorage } from '../utils/localStorageSafe';
import { logger } from '../utils/logger';
import { normalizeText, toNumberSafe } from '../utils/sortAndSearch';

interface ExistingSaleSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSale: (sale: Sale) => void;
  sales: Sale[];
  // Halihazırda fatura kesilmiş satışları filtrele
  existingInvoices: Invoice[];
}

export default function ExistingSaleSelectionModal({
  isOpen,
  onClose,
  onSelectSale,
  sales,
  existingInvoices
}: ExistingSaleSelectionModalProps) {
  const { formatCurrency } = useCurrency();
  const { t, i18n } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const fallbackLocale = typeof window !== 'undefined' && window.navigator?.language
    ? window.navigator.language
    : 'tr-TR';
  const locale = useMemo(() => {
    return safeLocalStorage.getItem('language') || i18n.language || fallbackLocale;
  }, [i18n.language, fallbackLocale]);

  const normalizeId = (value: unknown): string | null => {
    if (value == null) return null;
    const str = String(value).trim();
    return str ? str : null;
  };

  const invoicedSaleIdSet = useMemo(() => {
    const set = new Set<string>();
    existingInvoices.forEach(invoice => {
      const saleId = normalizeId(invoice?.saleId);
      if (saleId) {
        set.add(saleId);
      }
    });
    return set;
  }, [existingInvoices]);

  // Fatura kesilmemiş satışları filtrele
  const availableSales = useMemo(() => {
    return sales.filter(sale => {
      const saleId = normalizeId(sale.id);
      if (saleId && invoicedSaleIdSet.has(saleId)) return false;
      if (sale.invoiceId) return false;
      return true;
    });
  }, [sales, invoicedSaleIdSet]);

  // Arama filtresi
  const filteredSales = useMemo(() => {
    if (!searchTerm.trim()) return availableSales;
    
    const term = normalizeText(searchTerm);
    return availableSales.filter(sale => {
      const matchesCustomer = normalizeText(sale.customerName).includes(term);
      const matchesProduct = normalizeText(sale.productName).includes(term);
      const matchesSaleNumber = sale.saleNumber ? normalizeText(sale.saleNumber).includes(term) : false;
      return matchesCustomer || matchesProduct || matchesSaleNumber;
    });
  }, [availableSales, searchTerm]);

  const formatDate = (value?: string | number | Date | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(locale);
  };

  if (!isOpen) return null;

  // Görselde gösterilecek tutar: KDV Hariç (satış sayfasıyla aynı mantık)
  const getDisplayAmountExclVAT = (sale: Sale): number => {
    const subtotal = toNumberSafe(sale.subtotal);
    if (subtotal > 0) return subtotal;

    if (Array.isArray(sale.items) && sale.items.length > 0) {
      const sum = sale.items.reduce((acc, item) => {
        const qty = toNumberSafe(item?.quantity);
        const unitPrice = toNumberSafe(item?.unitPrice);
        if (qty <= 0 || unitPrice <= 0) {
          const explicitTotal = toNumberSafe(item?.total);
          return acc + (explicitTotal > 0 ? explicitTotal : 0);
        }
        return acc + qty * unitPrice;
      }, 0);
      if (sum > 0) return sum;
    }

    const grossTotal = toNumberSafe(sale.amount ?? sale.total);
    const tax = toNumberSafe(sale.taxAmount);
    if (grossTotal > 0 && tax > 0 && grossTotal > tax) {
      return grossTotal - tax;
    }

    const quantity = toNumberSafe(sale.quantity);
    const unitPrice = toNumberSafe(sale.unitPrice);
    if (quantity > 0 && unitPrice > 0) {
      return quantity * unitPrice;
    }

    return grossTotal;
  };

  const handleSelectSale = (sale: Sale) => {
    logger.info('existingSaleModal.selectSale', {
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      customerName: sale.customerName,
    });
    onSelectSale(sale);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{t('sales.selectExistingSale')}</h2>
              <p className="text-sm text-gray-500">{t('sales.selectSaleForInvoice')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('sales.searchSalesPlaceholder')}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Sales List */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {filteredSales.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? t('sales.noSalesFound') : t('sales.noInvoiceableSales')}
              </h3>
              <p className="text-gray-500">
                {searchTerm 
                  ? t('sales.changeSearchCriteria')
                  : t('sales.allSalesInvoiced')
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  onClick={() => handleSelectSale(sale)}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-3">
                        <div className="flex items-center text-sm text-gray-600">
                          <User className="w-4 h-4 mr-1" />
                          <span className="font-medium">{sale.customerName}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="w-4 h-4 mr-1" />
                          <span>{formatDate(sale.date)}</span>
                        </div>
                      </div>
                      
                      <div className="mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {sale.productName}
                        </h3>
                        {sale.saleNumber && (
                          <p className="text-sm text-gray-500">
                            {t('sales.saleNumber')}: {sale.saleNumber}
                          </p>
                        )}
                      </div>

                      {sale.quantity && sale.unitPrice && (
                        <div className="text-sm text-gray-600 mb-2">
                          {sale.quantity} {t('sales.pieces')} × {formatCurrency(sale.unitPrice)}
                        </div>
                      )}

                      {sale.notes && (
                        <p className="text-sm text-gray-600 italic">
                          "{sale.notes}"
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="flex items-center text-lg font-bold text-green-600 mb-2">
                        <DollarSign className="w-5 h-5 mr-1" />
                        {formatCurrency(getDisplayAmountExclVAT(sale))}
                      </div>
                      
                      <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                        {t('sales.createInvoice')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {t('sales.salesWaitingForInvoice', { count: filteredSales.length })}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useMemo } from 'react';
import { X, Search, Calendar, User, DollarSign, FileText } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';

interface Sale {
  id: string;
  saleNumber?: string;
  customerName: string;
  customerEmail?: string;
  productName: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  date: string;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'check';
  notes?: string;
}

interface ExistingSaleSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSale: (sale: Sale) => void;
  sales: Sale[];
  // Halihazırda fatura kesilmiş satışları filtrele
  existingInvoices: any[];
}

export default function ExistingSaleSelectionModal({
  isOpen,
  onClose,
  onSelectSale,
  sales,
  existingInvoices
}: ExistingSaleSelectionModalProps) {
  const { formatCurrency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');

  // Fatura kesilmemiş satışları filtrele
  const availableSales = useMemo(() => {
    const invoicedSaleIds = existingInvoices
      .filter(inv => inv.saleId)
      .map(inv => inv.saleId);
    
    return sales.filter(sale => !invoicedSaleIds.includes(sale.id));
  }, [sales, existingInvoices]);

  // Arama filtresi
  const filteredSales = useMemo(() => {
    if (!searchTerm.trim()) return availableSales;
    
    const term = searchTerm.toLowerCase();
    return availableSales.filter(sale =>
      sale.customerName.toLowerCase().includes(term) ||
      sale.productName.toLowerCase().includes(term) ||
      sale.saleNumber?.toLowerCase().includes(term)
    );
  }, [availableSales, searchTerm]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  if (!isOpen) return null;

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
              <h2 className="text-xl font-semibold text-gray-900">Mevcut Satış Seç</h2>
              <p className="text-sm text-gray-500">Fatura kesilecek satışı seçin</p>
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
              placeholder="Müşteri adı, ürün adı veya satış numarası ile ara..."
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
                {searchTerm ? 'Satış bulunamadı' : 'Fatura kesilebilecek satış yok'}
              </h3>
              <p className="text-gray-500">
                {searchTerm 
                  ? 'Arama kriterlerinizi değiştirip tekrar deneyin'
                  : 'Tüm satışlara fatura kesilmiş durumda'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  onClick={() => onSelectSale(sale)}
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
                            Satış No: {sale.saleNumber}
                          </p>
                        )}
                      </div>

                      {sale.quantity && sale.unitPrice && (
                        <div className="text-sm text-gray-600 mb-2">
                          {sale.quantity} adet × {formatCurrency(sale.unitPrice)}
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
                        {formatCurrency(sale.amount)}
                      </div>
                      
                      <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                        Fatura Kes
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
              {filteredSales.length} satış fatura bekliyor
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
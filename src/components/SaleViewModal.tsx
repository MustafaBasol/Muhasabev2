import { X, Edit, Calendar, User, Package, CreditCard, Download, Trash2 } from 'lucide-react';
import type { Sale } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';

// Sayısal stringleri güvenli biçimde sayıya çevir ("2000.00", "2.000,00", "2,000.00")
const toNumber = (v: any): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;

  if (s.includes('.') && s.includes(',')) {
    const withoutThousands = s.replace(/\./g, '');
    const withDotDecimal = withoutThousands.replace(/,/g, '.');
    const n = parseFloat(withDotDecimal);
    return Number.isFinite(n) ? n : 0;
  }
  if (s.includes(',') && !s.includes('.')) {
    const n = parseFloat(s.replace(/,/g, '.'));
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseFloat(s.replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
};

interface SaleViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onEdit: (sale: Sale) => void;
  onDelete?: (saleId: string) => void;
  onDownload?: (sale: Sale) => void;
}

export default function SaleViewModal({ 
  isOpen, 
  onClose, 
  sale, 
  onEdit,
  onDelete,
  onDownload
}: SaleViewModalProps) {
  const { formatCurrency } = useCurrency();
  
  if (!isOpen || !sale) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const formatAmount = (amount: any) => {
  const n = toNumber(amount);
  return formatCurrency(n);
};

  const getStatusBadge = (status: string) => {
    const key = (status || '').toString().toLowerCase();
    let variant: 'completed' | 'pending' | 'cancelled' = 'pending';
    if (['completed', 'paid', 'invoiced', 'approved'].includes(key)) variant = 'completed';
    else if (['cancelled', 'canceled', 'void', 'refunded', 'deleted'].includes(key)) variant = 'cancelled';
    else if (['pending', 'created', 'new', 'draft', 'open', 'processing'].includes(key)) variant = 'pending';

    const statusConfig = {
      completed: { label: 'Tamamlandı', class: 'bg-green-100 text-green-800' },
      pending: { label: 'Bekliyor', class: 'bg-yellow-100 text-yellow-800' },
      cancelled: { label: 'İptal', class: 'bg-red-100 text-red-800' }
    } as const;

    const config = statusConfig[variant] || { label: key || 'Bekliyor', class: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.class}`}>
        {config.label}
      </span>
    );
  };

  const getPaymentMethodLabel = (method?: string) => {
    const methods = {
      cash: 'Nakit',
      card: 'Kredi/Banka Kartı',
      transfer: 'Havale/EFT',
      check: 'Çek'
    };
    return methods[method as keyof typeof methods] || method;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {sale.saleNumber || `SAL-${sale.id}`}
              </h2>
              <p className="text-sm text-gray-500">Satış Detayları</p>
            </div>
            {getStatusBadge(sale.status)}
          </div>
          <div className="flex items-center space-x-2">
            {onDownload && (
              <button
                onClick={() => onDownload(sale)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>PDF İndir</span>
              </button>
            )}
            <button
              onClick={() => onEdit(sale)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              <span>Düzenle</span>
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(sale.id)}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sil</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6" id={`sale-${sale.id}`}>
          {/* Sale Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Satış Bilgileri</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Satış Tarihi:</span>
                  <span className="ml-2 font-medium">{formatDate(sale.date)}</span>
                </div>
                {sale.paymentMethod && (
                  <div className="flex items-center text-sm">
                    <CreditCard className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-600">Ödeme Yöntemi:</span>
                    <span className="ml-2 font-medium">{getPaymentMethodLabel(sale.paymentMethod)}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Müşteri Bilgileri</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Müşteri:</span>
                  <span className="ml-2 font-medium">{sale.customerName}</span>
                </div>
                {sale.customerEmail && (
                  <div className="flex items-center text-sm">
                    <span className="w-4 h-4 text-gray-400 mr-2 text-xs">@</span>
                    <span className="text-gray-600">E-posta:</span>
                    <span className="ml-2 font-medium">{sale.customerEmail}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Product Info */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ürün/Hizmet Bilgileri</h3>
            
            {/* Çoklu ürün varsa tablo göster */}
            {sale.items && sale.items.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ürün/Hizmet
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Miktar
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Birim Fiyat
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Toplam
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sale.items.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{item.productName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {formatAmount(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {formatAmount(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-right font-semibold text-gray-900">
                        Genel Toplam:
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-green-600 text-lg">
                        {formatAmount(sale.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              /* Tek ürün gösterimi (eski sistem) */
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3 mb-2">
                  <Package className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-gray-900">{sale.productName}</span>
                </div>
                {sale.quantity && sale.unitPrice && (
                  <div className="text-sm text-gray-600 ml-8">
                    <span>Miktar: {sale.quantity}</span>
                    <span className="mx-2">•</span>
                    <span>Birim Fiyat: {formatAmount(sale.unitPrice)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount - Sadece tek ürün varsa göster */}
          {(!sale.items || sale.items.length === 0) && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tutar Bilgileri</h3>
              <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                <div className="flex justify-between items-center">
                  <span className="text-green-800 font-medium text-lg">Toplam Tutar:</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatAmount(sale.amount)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {sale.notes && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notlar</h3>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-gray-700">{sale.notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
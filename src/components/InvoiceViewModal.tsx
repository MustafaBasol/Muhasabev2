import { useMemo } from 'react';
import { X, Download, Edit, Calendar, Mail, MapPin } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer?: {
    id: string;
    name: string;
    email: string;
    address?: string;
  };
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  issueDate: string;
  dueDate: string;
  items?: any[];
  notes?: string;
  type?: 'product' | 'service';
}

interface InvoiceViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onEdit: (invoice: Invoice) => void;
  onDownload?: (invoice: Invoice) => void;
}

export default function InvoiceViewModal({ 
  isOpen, 
  onClose, 
  invoice, 
  onEdit, 
  onDownload 
}: InvoiceViewModalProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();

  const statusConfig = useMemo(() => ({
    draft: { label: t('status.draft'), class: 'bg-gray-100 text-gray-800' },
    sent: { label: t('status.sent'), class: 'bg-blue-100 text-blue-800' },
    paid: { label: t('status.paid'), class: 'bg-green-100 text-green-800' },
    overdue: { label: t('status.overdue'), class: 'bg-red-100 text-red-800' }
  }), [t]);

  if (!isOpen || !invoice) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const formatAmount = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return formatCurrency(numAmount || 0);
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.class}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h2>
              <p className="text-sm text-gray-500">{t('invoice.details')}</p>
            </div>
            {getStatusBadge(invoice.status)}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onDownload?.(invoice)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{t('invoice.downloadPdf')}</span>
            </button>
            <button
              onClick={() => {
                onClose(); // Önce view modal'ı kapat
                setTimeout(() => onEdit?.(invoice), 100); // Sonra edit modal'ı aç
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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

        <div className="p-6" id={`invoice-${invoice.id}`}>
          {/* Invoice Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('invoice.information')}</h3>
              <div className="space-y-2">
                <div className="flex items-center text-sm">
                  <span className="text-gray-600">{t('invoice.type')}:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    invoice.type === 'product'
                      ? 'bg-blue-100 text-blue-800'
                      : invoice.type === 'service'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {invoice.type === 'product'
                      ? t('invoice.productSale')
                      : invoice.type === 'service'
                        ? t('invoice.serviceSale')
                        : t('invoice.generalSale', 'Genel')}
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">{t('invoice.issueDate')}:</span>
                  <span className="ml-2 font-medium">{formatDate(invoice.issueDate)}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">{t('invoice.dueDate')}:</span>
                  <span className="ml-2 font-medium">{formatDate(invoice.dueDate)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('invoice.customerInfo')}</h3>
              <div className="space-y-2">
                <div className="font-medium text-gray-900">{invoice.customer?.name || invoice.customerName || 'Müşteri Yok'}</div>
                {(invoice.customer?.email || invoice.customerEmail) && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="w-4 h-4 mr-2" />
                    {invoice.customer?.email || invoice.customerEmail}
                  </div>
                )}
                {(invoice.customer?.address || invoice.customerAddress) && (
                  <div className="flex items-start text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mr-2 mt-0.5" />
                    <span>{invoice.customer?.address || invoice.customerAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('invoice.itemsServices')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{t('invoice.description')}</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">{t('invoice.quantity')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">{t('invoice.unitPrice')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">{t('invoice.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoice.items && Array.isArray(invoice.items) && invoice.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {formatAmount(Number(item.unitPrice) || 0)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {formatAmount(Number(item.total) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-80 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('invoice.subtotal')}:</span>
                <span className="font-medium">{formatAmount(Number(invoice.subtotal) || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('invoice.vat')}:</span>
                <span className="font-medium">{formatAmount(Number(invoice.taxAmount) || 0)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-3">
                <span>{t('invoice.grandTotal')}:</span>
                <span>{formatAmount(Number(invoice.total) || 0)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('invoice.notes')}</h3>
              <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import React from 'react';
import { X, Download, Edit, Calendar, Mail, Phone, MapPin } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  issueDate: string;
  dueDate: string;
  items: any[];
  notes?: string;
  type: 'product' | 'service';
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
  if (!isOpen || !invoice) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const formatAmount = (amount: number) => {
    return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Taslak', class: 'bg-gray-100 text-gray-800' },
      sent: { label: 'Gönderildi', class: 'bg-blue-100 text-blue-800' },
      paid: { label: 'Ödendi', class: 'bg-green-100 text-green-800' },
      overdue: { label: 'Gecikmiş', class: 'bg-red-100 text-red-800' }
    };
    
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
              <p className="text-sm text-gray-500">Fatura Detayları</p>
            </div>
            {getStatusBadge(invoice.status)}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onDownload?.(invoice)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>PDF İndir</span>
            </button>
            <button
              onClick={() => onEdit?.(invoice)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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

        <div className="p-6" id={`invoice-${invoice.id}`}>
          {/* Invoice Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Fatura Bilgileri</h3>
              <div className="space-y-2">
                <div className="flex items-center text-sm">
                  <span className="text-gray-600">Fatura Türü:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    invoice.type === 'product' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {invoice.type === 'product' ? 'Ürün Satışı' : 'Hizmet Satışı'}
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Düzenleme Tarihi:</span>
                  <span className="ml-2 font-medium">{formatDate(invoice.issueDate)}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Vade Tarihi:</span>
                  <span className="ml-2 font-medium">{formatDate(invoice.dueDate)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Müşteri Bilgileri</h3>
              <div className="space-y-2">
                <div className="font-medium text-gray-900">{invoice.customerName}</div>
                {invoice.customerEmail && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="w-4 h-4 mr-2" />
                    {invoice.customerEmail}
                  </div>
                )}
                {invoice.customerAddress && (
                  <div className="flex items-start text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mr-2 mt-0.5" />
                    <span>{invoice.customerAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ürün/Hizmetler</h3>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Açıklama</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Miktar</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Birim Fiyat</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoice.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-center">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {formatAmount(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {formatAmount(item.total)}
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
                <span className="text-gray-600">Ara Toplam:</span>
                <span className="font-medium">{formatAmount(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">KDV (%18):</span>
                <span className="font-medium">{formatAmount(invoice.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-3">
                <span>Genel Toplam:</span>
                <span>{formatAmount(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Notlar</h3>
              <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
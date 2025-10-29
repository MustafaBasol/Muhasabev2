import React, { useState } from 'react';
import { X, FileText, Calendar, User, Package } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';

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

interface InvoiceFromSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoiceData: any) => void;
  sale: Sale | null;
}

export default function InvoiceFromSaleModal({
  isOpen,
  onClose,
  onSave,
  sale
}: InvoiceFromSaleModalProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();
  
  const [invoiceData, setInvoiceData] = useState({
    dueDate: '',
    status: 'draft' as 'draft' | 'sent' | 'paid' | 'overdue',
    notes: ''
  });

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen && sale) {
      // Vade tarihi 30 gün sonra varsayılan
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      
      setInvoiceData({
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'draft',
        notes: sale.notes || ''
      });
    }
  }, [isOpen, sale]);

  const handleSave = () => {
    if (!sale) return;
    
    if (!invoiceData.dueDate) {
      alert(t('validation.dueDateRequired'));
      return;
    }

    // Satıştan fatura verisini hazırla
    const newInvoice = {
      saleId: sale.id,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: invoiceData.dueDate,
      status: invoiceData.status,
      notes: invoiceData.notes.trim(),
      // Satış verisinden alınacak bilgiler
      customerName: sale.customerName,
      customerEmail: sale.customerEmail || '',
      productName: sale.productName,
      quantity: sale.quantity || 1,
      unitPrice: sale.unitPrice || sale.amount,
      subtotal: sale.amount / 1.18, // KDV hariç tutar
      taxAmount: sale.amount - (sale.amount / 1.18), // KDV tutarı
      total: sale.amount,
      type: 'service',
      items: [{
        description: sale.productName,
        quantity: sale.quantity || 1,
        unitPrice: sale.unitPrice || sale.amount,
        total: sale.amount
      }]
    };

    onSave(newInvoice);
    onClose();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  if (!isOpen || !sale) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{t('invoices.createInvoiceFromSale')}</h2>
              <p className="text-sm text-gray-500">{t('invoices.completeInvoiceInfo')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Satış Bilgileri */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('sales.saleInfo')}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center text-sm">
                <User className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-gray-600">{t('common.customer')}:</span>
                <span className="ml-2 font-medium">{sale.customerName}</span>
              </div>
              
              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-gray-600">Satış Tarihi:</span>
                <span className="ml-2 font-medium">{formatDate(sale.date)}</span>
              </div>
              
              <div className="flex items-center text-sm">
                <Package className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-gray-600">Ürün:</span>
                <span className="ml-2 font-medium">{sale.productName}</span>
              </div>
              
              <div className="flex items-center text-sm">
                <span className="text-gray-600">Tutar:</span>
                <span className="ml-2 font-bold text-green-600">{formatCurrency(sale.amount)}</span>
              </div>
            </div>

            {sale.saleNumber && (
              <div className="mt-3 text-sm text-gray-600">
                <strong>Satış No:</strong> {sale.saleNumber}
              </div>
            )}
          </div>

          {/* Fatura Bilgileri */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Fatura Bilgileri</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Vade Tarihi *
                </label>
                <input
                  type="date"
                  value={invoiceData.dueDate}
                  onChange={(e) => setInvoiceData({...invoiceData, dueDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fatura Durumu
                </label>
                <select
                  value={invoiceData.status}
                  onChange={(e) => setInvoiceData({...invoiceData, status: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="draft">Taslak</option>
                  <option value="sent">Gönderildi</option>
                  <option value="paid">Ödendi</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fatura Notları
              </label>
              <textarea
                value={invoiceData.notes}
                onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Fatura ile ilgili notlar..."
              />
            </div>

            {/* Fatura Tutarları */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-medium text-gray-900 mb-3">Fatura Tutarları</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Ara Toplam:</span>
                  <span>{formatCurrency(sale.amount / 1.18)}</span>
                </div>
                <div className="flex justify-between">
                  <span>KDV:</span>
                  <span>{formatCurrency(sale.amount - (sale.amount / 1.18))}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t border-blue-300 pt-2">
                  <span>Toplam:</span>
                  <span>{formatCurrency(sale.amount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={!invoiceData.dueDate}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('invoices.createInvoice')}
          </button>
        </div>
      </div>
    </div>
  );
}
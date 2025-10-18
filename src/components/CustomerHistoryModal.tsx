import React from 'react';
import { X, FileText, Calendar, DollarSign } from 'lucide-react';

interface CustomerHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: { name: string } | null;
  invoices: any[];
  sales?: any[];
  onViewInvoice?: (invoice: any) => void;
  onCreateInvoice?: (customer: any) => void;
}

export default function CustomerHistoryModal({ 
  isOpen, 
  onClose, 
  customer, 
  invoices,
  sales = [],
  onViewInvoice,
  onCreateInvoice
}: CustomerHistoryModalProps) {
  if (!isOpen || !customer) return null;

  console.log('CustomerHistoryModal - customer:', customer);
  console.log('CustomerHistoryModal - sales:', sales);
  console.log('CustomerHistoryModal - invoices:', invoices);
  
  // Filter sales for this customer
  const customerSales = sales.filter(sale => {
    const nameMatch = sale.customerName === customer.name;
    const emailMatch = sale.customerEmail === customer.email;
    console.log(`Sale ${sale.id}: customerName="${sale.customerName}", customer.name="${customer.name}", nameMatch=${nameMatch}`);
    console.log(`Sale ${sale.id}: customerEmail="${sale.customerEmail}", customer.email="${customer.email}", emailMatch=${emailMatch}`);
    return nameMatch || emailMatch;
  });
  
  console.log('Filtered customer sales:', customerSales);

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
              {customer.name} - İşlem Geçmişi
            </h2>
            <p className="text-sm text-gray-500">
              {invoices.length + customerSales.length} işlem bulundu
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
          {invoices.length === 0 && customerSales.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Henüz İşlem Geçmişi Yok
              </h3>
              <p className="text-gray-500 mb-6">
                {customer.name} için henüz fatura veya işlem kaydı bulunmuyor.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>İpucu:</strong> Bu müşteri için yeni bir fatura oluşturarak işlem geçmişi başlatabilirsiniz.
                </p>
                <button
                  onClick={() => onCreateInvoice?.(customer)}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Fatura Oluştur
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Satışlar */}
              {customerSales.map((sale, index) => (
                <div key={`sale-${index}`} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-green-600 text-sm font-bold">S</span>
                      </div>
                      <div>
                        <div className="font-medium text-green-600">
                          {sale.saleNumber || `SAL-${sale.id}`}
                        </div>
                        <p className="text-sm text-gray-600">{sale.productName}</p>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(sale.date)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">
                        +{formatAmount(sale.amount)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {sale.status === 'completed' ? '✅ Tamamlandı' : '⏳ Bekliyor'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Faturalar */}
              {invoices.map((invoice, index) => (
                <div key={`invoice-${index}`} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <button
                          onClick={() => onViewInvoice?.(invoice)}
                          className="font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                          title="Faturayı görüntüle"
                        >
                          {invoice.invoiceNumber}
                        </button>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(invoice.issueDate)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {formatAmount(invoice.total)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {invoice.status === 'paid' ? '✅ Ödendi' : 
                         invoice.status === 'sent' ? '📤 Gönderildi' : 
                         invoice.status === 'overdue' ? '⚠️ Gecikmiş' : '📝 Taslak'}
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
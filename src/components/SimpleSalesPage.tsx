import React, { useState } from 'react';
import { TrendingUp, Plus, Calendar, DollarSign, User, Package, Search, Eye, Edit, Trash2, Download, Check, X, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import SaleModal from './SaleModal';
import type { Product } from './ProductList';
import SaleViewModal from './SaleViewModal';
import InvoiceViewModal from './InvoiceViewModal';



const toNumber = (v: any): number => {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  const s = String(v).trim();
  const normalized = s.replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
};

const TAX_RATE = 0.18;
interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  taxNumber: string;
  company: string;
  createdAt: string;
}

interface Sale {
  id: string;
  customerName: string;
  productName: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending';
  quantity?: number;
  unitPrice?: number;
  productId?: string;
  productUnit?: string;
}

interface SimpleSalesPageProps {
  customers?: Customer[];
  sales?: Sale[];
  invoices?: any[];
  onSalesUpdate?: (sales: any[]) => void;
  onCreateInvoice?: (invoiceData: any) => void;
  onViewInvoice?: (invoice: any) => void;
  onEditInvoice?: (invoice: any) => void;
  onDownloadSale?: (sale: Sale) => void;
  products?: Product[];
}

export default function SimpleSalesPage({ customers = [], sales = [], invoices = [], products = [], onSalesUpdate, onCreateInvoice, onViewInvoice, onEditInvoice, onDownloadSale }: SimpleSalesPageProps) {
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showSaleViewModal, setShowSaleViewModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showInvoiceConfirmModal, setShowInvoiceConfirmModal] = useState(false);
  const [showInvoiceViewModal, setShowInvoiceViewModal] = useState(false);
  const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState<any>(null);
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [pendingSale, setPendingSale] = useState<any>(null);
  const [viewingSale, setViewingSale] = useState<any>(null);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingField, setEditingField] = useState<{ saleId: string; field: string } | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  const handleAddSale = (newSale: any) => {
    // Store the sale data and show confirmation modal
    setPendingSale(newSale);
    setShowConfirmationModal(true);
  };

  const handleConfirmSale = (createInvoice: boolean) => {
    if (!pendingSale) return;

    // Create the sale record
    const saleToAdd = {
      id: pendingSale.id,
      saleNumber: pendingSale.saleNumber,
      customerName: pendingSale.customerName,
      customerEmail: pendingSale.customerEmail,
      productName: pendingSale.productName,
      quantity: pendingSale.quantity,
      unitPrice: pendingSale.unitPrice,
      amount: pendingSale.total,
      date: pendingSale.saleDate,
      status: pendingSale.status,
      paymentMethod: pendingSale.paymentMethod
    };
    
    const updatedSales = [saleToAdd, ...sales]; // Add to beginning for reverse order
    
    if (onSalesUpdate) {
      onSalesUpdate(updatedSales);
    }
    
    // Create invoice if requested
    if (createInvoice && onCreateInvoice) {
      const invoiceData = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
        customerName: pendingSale.customerName,
        customerEmail: pendingSale.customerEmail || '',
        customerAddress: '',
        issueDate: pendingSale.saleDate,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'sent',
        type: 'product',
        items: [{
          id: '1',
          description: pendingSale.productName,
          quantity: pendingSale.quantity || 1,
          unitPrice: pendingSale.unitPrice || pendingSale.total,
          total: pendingSale.total
        }],
        subtotal: pendingSale.total / 1.18,
        taxAmount: pendingSale.total - (pendingSale.total / 1.18),
        total: pendingSale.total,
        notes: `Bu fatura ${pendingSale.saleNumber || `SAL-${pendingSale.id}`} numaralı satıştan otomatik oluşturulmuştur.`
      };
      
      onCreateInvoice(invoiceData);
      
      // Auto-download PDF after a short delay
      setTimeout(() => {
        if (onDownloadSale) {
          onDownloadSale(saleToAdd);
        }
      }, 500);
    }
    
    // Close modal and reset
    setShowConfirmationModal(false);
    setPendingSale(null);
  };

  const handleEditSale = (sale: any) => {
    setEditingSale(sale);
    setShowSaleModal(true);
  };

  const handleUpdateSale = (updatedSale: any) => {
    const updatedSales = sales.map(sale => 
      sale.id === updatedSale.id ? updatedSale : sale
    );
    if (onSalesUpdate) {
      onSalesUpdate(updatedSales);
    }
    setEditingSale(null);
  };

  const handleDeleteSale = (saleId: string) => {
    if (confirm('Bu satışı silmek istediğinizden emin misiniz?')) {
      const updatedSales = sales.filter(sale => sale.id !== saleId);
      if (onSalesUpdate) {
        onSalesUpdate(updatedSales);
      }
    }
  };

  const handleViewSale = (sale: any) => {
    setViewingSale(sale);
    setShowSaleViewModal(true);
  };

  const formatAmount = (amount: number) => {
    if (amount == null || isNaN(amount)) {
      return '₺0,00';
    }
    return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const totalSales = sales.reduce((sum, sale) => sum + toNumber(sale.amount ?? sale.total ?? (toNumber(sale.quantity) * toNumber(sale.unitPrice))), 0);
  const completedSales = sales.filter(sale => sale.status === 'completed').length;

  const filteredSales = sales.filter(sale => {
    const matchesSearch = 
      sale.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.saleNumber && sale.saleNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: 'Tamamlandı', class: 'bg-green-100 text-green-800' },
      pending: { label: 'Bekliyor', class: 'bg-yellow-100 text-yellow-800' },
      cancelled: { label: 'İptal', class: 'bg-red-100 text-red-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.class}`}>
        {config.label}
      </span>
    );
  };

  const handleInlineEdit = (saleId: string, field: string, currentValue: string | number) => {
    setEditingField({ saleId, field });
    setTempValue(String(currentValue));
  };

  const handleSaveInlineEdit = (sale: any) => {
    if (!editingField) return;
    
    let updatedSale = { ...sale };
    
    if (editingField.field === 'amount') {
      const newAmount = parseFloat(tempValue) || 0;
      updatedSale.amount = newAmount;
    } else if (editingField.field === 'status') {
      updatedSale.status = tempValue as any;
    }
    
    const updatedSales = sales.map(s => 
      s.id === sale.id ? updatedSale : s
    );
    
    if (onSalesUpdate) {
      onSalesUpdate(updatedSales);
    }
    
    setEditingField(null);
    setTempValue('');
  };

  const handleCancelInlineEdit = () => {
    setEditingField(null);
    setTempValue('');
  };

  const handleCreateInvoiceFromSale = (sale: any) => {
    // Check if invoice already exists for this sale
    const existingInvoice = invoices.find(invoice => 
      invoice.notes && invoice.notes.includes(sale.saleNumber || `SAL-${sale.id}`)
    );

    if (existingInvoice) {
      // Open existing invoice in modal
      setViewingInvoice(existingInvoice);
      setShowInvoiceViewModal(true);
    } else {
      // Show confirmation modal
      setSelectedSaleForInvoice(sale);
      setShowInvoiceConfirmModal(true);
    }
  };

  const handleConfirmCreateInvoice = () => {
    if (selectedSaleForInvoice) {
      const sale = selectedSaleForInvoice;
      const quantity = sale.quantity && sale.quantity > 0 ? sale.quantity : 1;
      const matchedProduct = sale.productId
        ? products.find(product => String(product.id) === String(sale.productId))
        : products.find(product => product.name.toLowerCase() === (sale.productName || '').toLowerCase());

      const fallbackUnitPrice = sale.unitPrice && sale.unitPrice > 0
        ? sale.unitPrice
        : matchedProduct?.unitPrice ?? 0;

      const calculatedTotal = sale.amount && sale.amount > 0 ? sale.amount : fallbackUnitPrice * quantity;
      const totalAmount = Number.isFinite(calculatedTotal) ? calculatedTotal : 0;
      const unitPrice = quantity > 0 ? totalAmount / quantity : fallbackUnitPrice;
      const subtotalAmount = totalAmount / (1 + TAX_RATE);
      const taxAmount = totalAmount - subtotalAmount;

      const invoiceData = {
        id: 'inv-' + Date.now(),
        invoiceNumber: 'INV-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-3),
        customerName: sale.customerName,
        customerEmail: sale.customerEmail || '',
        customerAddress: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'sent',
        type: 'product',
        items: [
          {
            id: '1',
            productId: matchedProduct?.id,
            unit: matchedProduct?.unit,
            description: matchedProduct?.name || sale.productName,
            quantity,
            unitPrice,
            total: totalAmount,
          },
        ],
        subtotal: subtotalAmount,
        taxAmount,
        total: totalAmount,
        notes: 'Bu fatura ' + (sale.saleNumber || ('SAL-' + sale.id)) + ' numarali satisdan olusturulmustur.',
      };

      if (onCreateInvoice) {
        onCreateInvoice(invoiceData);
      }

      setViewingInvoice(invoiceData);
      setShowInvoiceViewModal(true);
    }
    setShowInvoiceConfirmModal(false);
    setSelectedSaleForInvoice(null);
  };

  const handleCancelCreateInvoice = () => {
    setShowInvoiceConfirmModal(false);
    setSelectedSaleForInvoice(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600 mr-3" />
              Satışlar
            </h1>
            <p className="text-gray-600">Satış kayıtlarınızı yönetin</p>
          </div>
          <button
            onClick={() => setShowSaleModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Satış</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-green-600">Toplam Satış</p>
                <p className="text-xl font-bold text-green-700">{formatAmount(totalSales)}</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-blue-600">Toplam Satış Sayısı</p>
                <p className="text-xl font-bold text-blue-700">{sales.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center">
              <User className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-purple-600">Tamamlanan</p>
                <p className="text-xl font-bold text-purple-700">{completedSales}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Satış Listesi</h3>
            <p className="text-sm text-gray-500">
              {sales.length} satış kayıtlı
            </p>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Satış numarası, müşteri veya ürün ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="completed">Tamamlandı</option>
              <option value="pending">Bekliyor</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredSales.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || statusFilter !== 'all' ? 'Satış bulunamadı' : 'Henüz satış yok'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? 'Arama kriterlerinize uygun satış bulunamadı.'
                  : 'İlk satışınızı ekleyerek başlayın.'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button
                  onClick={() => setShowSaleModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  İlk Satışı Ekle
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Satış
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Müşteri
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ürün/Hizmet
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tutar
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tarih
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              <button
                                onClick={() => handleViewSale(sale)}
                                className="text-green-600 hover:text-green-800 font-medium transition-colors cursor-pointer"
                                title="Satışı görüntüle"
                              >
                                {sale.saleNumber || `SAL-${sale.id}`}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {sale.customerName}
                          </div>
                          {sale.customerEmail && (
                            <div className="text-xs text-gray-500">
                              {sale.customerEmail}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{sale.productName}</div>
                        {sale.quantity && sale.unitPrice && (
                          <div className="text-xs text-gray-500">
                            {sale.quantity} x {formatAmount(sale.unitPrice)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingField?.saleId === sale.id && editingField?.field === 'amount' ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="w-24 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                              min="0"
                              step="0.01"
                            />
                            <button
                              onClick={() => handleSaveInlineEdit(sale)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={handleCancelInlineEdit}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span 
                            onClick={() => handleInlineEdit(sale.id, 'amount', sale.amount)}
                            className="text-sm font-semibold text-green-600 cursor-pointer hover:bg-green-50 rounded p-1 transition-colors"
                            title="Tutarı düzenlemek için tıklayın"
                          >
                            {formatAmount(sale.amount ?? sale.total ?? (toNumber(sale.quantity) * toNumber(sale.unitPrice)))}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingField?.saleId === sale.id && editingField?.field === 'status' ? (
                          <div className="flex items-center space-x-2">
                            <select
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                            >
                              <option value="completed">Tamamlandı</option>
                              <option value="pending">Bekliyor</option>
                              <option value="cancelled">İptal</option>
                            </select>
                            <button
                              onClick={() => handleSaveInlineEdit(sale)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={handleCancelInlineEdit}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => handleInlineEdit(sale.id, 'status', sale.status)}
                            className="cursor-pointer hover:opacity-80 transition-opacity inline-block"
                            title="Durumu düzenlemek için tıklayın"
                          >
                            {getStatusBadge(sale.status)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(sale.date)}
                        </div>
                        {sale.paymentMethod && (
                          <div className="text-xs text-gray-400">
                            {sale.paymentMethod === 'cash' ? 'Nakit' :
                             sale.paymentMethod === 'card' ? 'Kart' :
                             sale.paymentMethod === 'transfer' ? 'Transfer' : 'Çek'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => handleViewSale(sale)}
                            className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Görüntüle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEditSale(sale)}
                            className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Düzenle"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => onDownloadSale?.(sale)}
                            className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="PDF İndir"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleCreateInvoiceFromSale(sale)}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Fatura Oluştur"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteSale(sale.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sale Modal */}
      <SaleModal
        isOpen={showSaleModal}
        onClose={() => setShowSaleModal(false)}
        onSave={editingSale ? handleUpdateSale : handleAddSale}
        sale={editingSale}
        customers={customers || []}
        products={products}
      />

      {/* Sale View Modal */}
      <SaleViewModal
        isOpen={showSaleViewModal}
        onClose={() => {
          setShowSaleViewModal(false);
          setViewingSale(null);
        }}
        sale={viewingSale}
        onEdit={(sale) => {
          setShowSaleViewModal(false);
          handleEditSale(sale);
        }}
        onDownload={onDownloadSale}
      />

      {/* Sale Confirmation Modal */}
      {showConfirmationModal && pendingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Satış Tamamlandı!</h2>
                  <p className="text-sm text-gray-500">Fatura oluşturmak istiyor musunuz?</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Sale Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-gray-900 mb-2">Satış Özeti</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Müşteri:</span>
                    <span className="font-medium">{pendingSale.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ürün/Hizmet:</span>
                    <span className="font-medium">{pendingSale.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tutar:</span>
                    <span className="font-bold text-green-600">
                      {formatAmount(pendingSale.total || 0)}
                    </span>
                  </div>
                </div>
              {/* Invoice Question */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 mb-1">
                      Bu satış için fatura oluşturmak istiyor musunuz?
                    </p>
                    <p className="text-xs text-blue-600">
                      Fatura oluşturulursa otomatik olarak PDF formatında indirilecektir.
                    </p>
                  </div>
                </div>
              </div>
            </div>
              </div>
            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => handleConfirmSale(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Sadece Satış
              </button>
              <button
                onClick={() => handleConfirmSale(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
              >
                <FileText className="w-4 h-4" />
                <span>Fatura ile Birlikte</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice View Modal */}
      <InvoiceViewModal
        isOpen={showInvoiceViewModal}
        onClose={() => {
          setShowInvoiceViewModal(false);
          setViewingInvoice(null);
        }}
        invoice={viewingInvoice}
        onEdit={(invoice) => {
          setShowInvoiceViewModal(false);
          setViewingInvoice(null);
          setViewingInvoice(null);
          if (onEditInvoice) {
            onEditInvoice(invoice);
          }
        }}
        onDownload={(invoice) => {
          import('../utils/pdfGenerator').then(({ generateInvoicePDF }) => {
            generateInvoicePDF(invoice);
          });
        }}
      />

      {/* Invoice Confirmation Modal */}
      {showInvoiceConfirmModal && selectedSaleForInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Fatura Oluştur</h2>
                  <p className="text-sm text-gray-500">Bu satış için fatura oluşturmak istiyor musunuz?</p>
                </div>
              </div>
              <button
                onClick={handleCancelCreateInvoice}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              {/* Sale Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-800 mb-2">
                      Satış Detayları
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Müşteri:</strong> {selectedSaleForInvoice.customerName}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Ürün/Hizmet:</strong> {selectedSaleForInvoice.productName}
                    </p>
                    <p className="text-xs text-gray-600">
                      <strong>Tutar:</strong> {formatAmount(selectedSaleForInvoice.amount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Confirmation Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 mb-1">
                      Fatura oluşturulsun mu?
                    </p>
                    <p className="text-xs text-blue-600">
                      Fatura oluşturulduktan sonra görüntüleme penceresinde açılacaktır.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleCancelCreateInvoice}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleConfirmCreateInvoice}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
              >
                <FileText className="w-4 h-4" />
                <span>Evet, Oluştur</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}








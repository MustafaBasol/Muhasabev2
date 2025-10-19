import React, { useState } from 'react';
import { Search, Plus, Eye, Edit, Download, Trash2, FileText, Calendar, DollarSign, Check, X } from 'lucide-react';

// Archive threshold: invoices older than this many days will only appear in archive
const ARCHIVE_THRESHOLD_DAYS = 365; // 1 year

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: {
    id: string;
    name: string;
    email: string;
  };
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issueDate: string;
  dueDate: string;
  items: any[];
}

interface InvoiceListProps {
  invoices: Invoice[];
  onAddInvoice: () => void;
  onEditInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onUpdateInvoice: (invoice: Invoice) => void;
  onDownloadInvoice?: (invoice: Invoice) => void;
}

export default function InvoiceList({ 
  invoices, 
  onAddInvoice, 
  onEditInvoice, 
  onDeleteInvoice,
  onViewInvoice,
  onUpdateInvoice,
  onDownloadInvoice
}: InvoiceListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  // Filter out archived invoices (older than threshold)
  const currentInvoices = invoices.filter(invoice => {
    const issueDate = new Date(invoice.issueDate);
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - ARCHIVE_THRESHOLD_DAYS);
    return issueDate >= thresholdDate;
  });

  const filteredInvoices = invoices.filter(invoice => {
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch = 
      invoice.invoiceNumber.toLowerCase().includes(normalizedSearch) ||
      (invoice.customer?.name ? invoice.customer.name.toLowerCase().includes(normalizedSearch) : false);
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    // Only show invoices that are not archived (within threshold)
    const issueDate = new Date(invoice.issueDate);
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - ARCHIVE_THRESHOLD_DAYS);
    const isNotArchived = issueDate >= thresholdDate;
    
    return matchesSearch && matchesStatus && isNotArchived;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Taslak', class: 'bg-gray-100 text-gray-800' },
      sent: { label: 'Gönderildi', class: 'bg-blue-100 text-blue-800' },
      paid: { label: 'Ödendi', class: 'bg-green-100 text-green-800' },
      overdue: { label: 'Gecikmiş', class: 'bg-red-100 text-red-800' },
      cancelled: { label: 'İptal', class: 'bg-red-100 text-red-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.class}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const formatAmount = (amount: number) => {
    return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  const handleInlineEdit = (invoiceId: string, field: string, currentValue: string) => {
    setEditingInvoice(invoiceId);
    setEditingField(field);
    setTempValue(currentValue);
  };

  const handleSaveInlineEdit = (invoice: Invoice) => {
    if (editingField === 'status') {
      onUpdateInvoice({ ...invoice, status: tempValue as any });
    } else if (editingField === 'dueDate') {
      onUpdateInvoice({ ...invoice, dueDate: tempValue });
    }
    setEditingInvoice(null);
    setEditingField(null);
    setTempValue('');
  };

  const handleCancelInlineEdit = () => {
    setEditingInvoice(null);
    setEditingField(null);
    setTempValue('');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Faturalar</h2>
            <p className="text-sm text-gray-500">
              {currentInvoices.length} fatura kayıtlı • {invoices.length - currentInvoices.length} arşivde
            </p>
          </div>
          <button
            onClick={onAddInvoice}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Fatura</span>
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Fatura numarası veya müşteri ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="draft">Taslak</option>
            <option value="sent">Gönderildi</option>
            <option value="paid">Ödendi</option>
            <option value="overdue">Gecikmiş</option>
            <option value="cancelled">İptal</option>
          </select>
        </div>
      </div>

      {/* Invoice List */}
      <div className="divide-y divide-gray-200">
        {filteredInvoices.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' ? 'Fatura bulunamadı' : 'Henüz fatura yok'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Arama kriterlerinize uygun fatura bulunamadı.'
                : 'İlk faturanızı oluşturarak başlayın.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={onAddInvoice}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                İlk Faturayı Oluştur
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fatura
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Müşteri
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
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            <button
                              onClick={() => onViewInvoice(invoice)}
                              className="text-blue-600 hover:text-blue-800 font-medium transition-colors cursor-pointer"
                              title="Faturayı görüntüle"
                            >
                              {invoice.invoiceNumber}
                            </button>
                          </div>
                          <div className="text-xs text-gray-500 flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(invoice.issueDate)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {invoice.customer?.name || 'Müşteri Yok'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {invoice.customer?.email || ''}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatAmount(invoice.total)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingInvoice === invoice.id && editingField === 'status' ? (
                        <div className="flex items-center space-x-2">
                          <select
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="draft">Taslak</option>
                            <option value="sent">Gönderildi</option>
                            <option value="paid">Ödendi</option>
                            <option value="overdue">Gecikmiş</option>
                          </select>
                          <button
                            onClick={() => handleSaveInlineEdit(invoice)}
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
                          onClick={() => handleInlineEdit(invoice.id, 'status', invoice.status)}
                          className="cursor-pointer hover:opacity-80 transition-opacity inline-block"
                        >
                          {getStatusBadge(invoice.status)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingInvoice === invoice.id && editingField === 'dueDate' ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="date"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => handleSaveInlineEdit(invoice)}
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
                          onClick={() => handleInlineEdit(invoice.id, 'dueDate', invoice.dueDate)}
                          className="cursor-pointer hover:bg-gray-50 rounded p-1"
                        >
                          Vade: {formatDate(invoice.dueDate)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => onViewInvoice(invoice)}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Görüntüle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onEditInvoice(invoice)}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Düzenle"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if (onDownloadInvoice) {
                              onDownloadInvoice(invoice);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="İndir"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onDeleteInvoice(invoice.id)}
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
  );
}

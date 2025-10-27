import { useState } from 'react';
import { Search, Plus, Eye, Edit, Download, Trash2, FileText, Calendar, Check, X } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';

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
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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

  const filteredInvoices = invoices
    .filter(invoice => {
      const normalizedSearch = (searchTerm || '').toLowerCase();
      const matchesSearch = 
        (invoice.invoiceNumber || '').toLowerCase().includes(normalizedSearch) ||
        (invoice.customer?.name || '').toLowerCase().includes(normalizedSearch);
      
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      
      // Only show invoices that are not archived (within threshold)
      const issueDate = new Date(invoice.issueDate);
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - ARCHIVE_THRESHOLD_DAYS);
      const isNotArchived = issueDate >= thresholdDate;
      
      return matchesSearch && matchesStatus && isNotArchived;
    })
    .sort((a, b) => {
      // En yeni faturalar en üstte (ID'ye göre ters sıralama)
      const aId = String(a.id || '');
      const bId = String(b.id || '');
      return bId.localeCompare(aId);
    });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: t('status.draft'), class: 'bg-gray-100 text-gray-800' },
      sent: { label: t('status.sent'), class: 'bg-blue-100 text-blue-800' },
      paid: { label: t('status.paid'), class: 'bg-green-100 text-green-800' },
      overdue: { label: t('status.overdue'), class: 'bg-red-100 text-red-800' },
      cancelled: { label: t('status.cancelled'), class: 'bg-red-100 text-red-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, class: 'bg-gray-100 text-gray-800' };
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
    return formatCurrency(amount);
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
            <h2 className="text-xl font-semibold text-gray-900">{t('invoices.title')}</h2>
            <p className="text-sm text-gray-500">
              {currentInvoices.length} {t('invoices.invoicesRegistered')} • {invoices.length - currentInvoices.length} {t('invoices.inArchive')}
            </p>
          </div>
          <button
            onClick={onAddInvoice}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('invoices.newInvoice')}</span>
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t('invoices.search')}
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
            <option value="all">{t('invoices.filterAll')}</option>
            <option value="draft">{t('status.draft')}</option>
            <option value="sent">{t('status.sent')}</option>
            <option value="paid">{t('status.paid')}</option>
            <option value="overdue">{t('status.overdue')}</option>
            <option value="cancelled">{t('status.cancelled')}</option>
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
              {searchTerm || statusFilter !== 'all' ? t('invoices.noInvoicesFound') : t('invoices.noInvoices')}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? t('invoices.noInvoicesFoundDesc')
                : t('invoices.noInvoicesDesc')
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={onAddInvoice}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('invoices.createFirstInvoice')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('invoices.invoiceNumber')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('invoices.customer')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.description')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('invoices.amount')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('invoices.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('invoices.date')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('invoices.actions')}
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
                              title={t('invoices.viewInvoice')}
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
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700 max-w-xs">
                        {(() => {
                          const itemsList = invoice.items || (invoice as any).lineItems || [];
                          console.log('🔍 Fatura ürün bilgisi:', {
                            invoiceId: invoice.id,
                            invoiceNumber: invoice.invoiceNumber,
                            hasItems: !!invoice.items,
                            hasLineItems: !!(invoice as any).lineItems,
                            itemsLength: itemsList.length,
                            itemsList: itemsList
                          });
                          
                          if (itemsList.length > 0) {
                            return (
                              <div className="space-y-1">
                                {itemsList.slice(0, 2).map((item: any, idx: number) => (
                                  <div key={idx} className="flex items-start">
                                    <span className="text-gray-400 mr-1">•</span>
                                    <span className="line-clamp-1">
                                      {item.productName || item.description || 'Ürün'} 
                                      {item.quantity && ` (${item.quantity}x)`}
                                    </span>
                                  </div>
                                ))}
                                {itemsList.length > 2 && (
                                  <div className="text-xs text-gray-400">
                                    +{itemsList.length - 2} daha...
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return <span className="text-gray-400 text-xs">Ürün bilgisi yok</span>;
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatAmount(Number(invoice.total) || 0)}
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
                            <option value="draft">{t('status.draft')}</option>
                            <option value="sent">{t('status.sent')}</option>
                            <option value="paid">{t('status.paid')}</option>
                            <option value="overdue">{t('status.overdue')}</option>
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
                          {t('common.dueDate')}: {formatDate(invoice.dueDate)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => onViewInvoice(invoice)}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title={t('invoices.view')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onEditInvoice(invoice)}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title={t('invoices.edit')}
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
                          title={t('invoices.download')}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onDeleteInvoice(invoice.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={t('invoices.delete')}
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

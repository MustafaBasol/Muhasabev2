import React, { useState } from 'react';
import { 
  Archive, 
  Search, 
  Calendar, 
  Filter,
  Eye, 
  Download,
  FileText,
  Receipt,
  TrendingUp,
  Users,
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle
} from 'lucide-react';

interface ArchivePageProps {
  invoices?: any[];
  expenses?: any[];
  sales?: any[];
  customers?: any[];
  suppliers?: any[];
  onViewInvoice?: (invoice: any) => void;
  onViewExpense?: (expense: any) => void;
  onViewSale?: (sale: any) => void;
  onViewCustomer?: (customer: any) => void;
  onViewSupplier?: (supplier: any) => void;
  onDownloadInvoice?: (invoice: any) => void;
  onDownloadExpense?: (expense: any) => void;
  onDownloadSale?: (sale: any) => void;
}

export default function ArchivePage({
  invoices = [],
  expenses = [],
  sales = [],
  customers = [],
  suppliers = [],
  onViewInvoice,
  onViewExpense,
  onViewSale,
  onViewCustomer,
  onViewSupplier,
  onDownloadInvoice,
  onDownloadExpense,
  onDownloadSale
}: ArchivePageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['invoices', 'expenses', 'sales']));
  const [activeTab, setActiveTab] = useState('all');

  // Filter archived items (completed/paid items)
  const archivedInvoices = invoices.filter(invoice => 
    invoice.status === 'paid' || invoice.status === 'overdue'
  );
  
  const archivedExpenses = expenses.filter(expense => 
    expense.status === 'paid'
  );
  
  const archivedSales = sales.filter(sale => 
    sale.status === 'completed' || sale.status === 'cancelled'
  );

  // All customers and suppliers are shown in archive (no specific archive status)
  const archivedCustomers = customers;
  const archivedSuppliers = suppliers;

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const formatAmount = (amount: number) => {
    return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: string, type: string) => {
    const statusConfig = {
      // Invoice statuses
      paid: { label: 'Ödendi', class: 'bg-green-100 text-green-800' },
      overdue: { label: 'Gecikmiş', class: 'bg-red-100 text-red-800' },
      // Sale statuses
      completed: { label: 'Tamamlandı', class: 'bg-green-100 text-green-800' },
      cancelled: { label: 'İptal', class: 'bg-red-100 text-red-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return config ? (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.class}`}>
        {config.label}
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        {status}
      </span>
    );
  };

  // Filter function for search and date
  const filterItems = (items: any[], searchFields: string[]) => {
    return items.filter(item => {
      const matchesSearch = searchTerm === '' || searchFields.some(field => {
        const value = item[field];
        return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
      });

      const matchesDate = dateFilter === '' || (() => {
        const itemDate = new Date(item.issueDate || item.expenseDate || item.date || item.createdAt);
        const filterDate = new Date(dateFilter);
        return itemDate.toDateString() === filterDate.toDateString();
      })();

      return matchesSearch && matchesDate;
    });
  };

  const filteredInvoices = filterItems(archivedInvoices, ['invoiceNumber', 'customerName']);
  const filteredExpenses = filterItems(archivedExpenses, ['expenseNumber', 'description', 'supplier']);
  const filteredSales = filterItems(archivedSales, ['saleNumber', 'customerName', 'productName']);
  const filteredCustomers = filterItems(archivedCustomers, ['name', 'email', 'company']);
  const filteredSuppliers = filterItems(archivedSuppliers, ['name', 'email', 'company']);

  // Calculate totals
  const totalArchivedAmount = archivedInvoices.reduce((sum, inv) => sum + inv.total, 0) + 
                             archivedSales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalArchivedExpenses = archivedExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const tabs = [
    { id: 'all', label: 'Tümü', count: filteredInvoices.length + filteredExpenses.length + filteredSales.length },
    { id: 'invoices', label: 'Faturalar', count: filteredInvoices.length },
    { id: 'expenses', label: 'Giderler', count: filteredExpenses.length },
    { id: 'sales', label: 'Satışlar', count: filteredSales.length },
    { id: 'contacts', label: 'Kişiler', count: filteredCustomers.length + filteredSuppliers.length }
  ];

  const shouldShowSection = (sectionId: string) => {
    return activeTab === 'all' || activeTab === sectionId || 
           (activeTab === 'contacts' && (sectionId === 'customers' || sectionId === 'suppliers'));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Archive className="w-8 h-8 text-gray-600 mr-3" />
              Arşiv
            </h1>
            <p className="text-gray-600">Tamamlanmış ve eski kayıtlarınız</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Toplam Arşiv</p>
            <p className="text-2xl font-bold text-gray-900">
              {archivedInvoices.length + archivedExpenses.length + archivedSales.length + archivedCustomers.length + archivedSuppliers.length}
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <FileText className="w-6 h-6 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-blue-600">Arşiv Faturalar</p>
                <p className="text-lg font-bold text-blue-700">{archivedInvoices.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center">
              <Receipt className="w-6 h-6 text-red-600 mr-3" />
              <div>
                <p className="text-sm text-red-600">Arşiv Giderler</p>
                <p className="text-lg font-bold text-red-700">{archivedExpenses.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <TrendingUp className="w-6 h-6 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-green-600">Arşiv Satışlar</p>
                <p className="text-lg font-bold text-green-700">{archivedSales.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center">
              <Users className="w-6 h-6 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-purple-600">Toplam Kişi</p>
                <p className="text-lg font-bold text-purple-700">{archivedCustomers.length + archivedSuppliers.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Arşivde ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </div>
          <button
            onClick={() => {
              setSearchTerm('');
              setDateFilter('');
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Filtreleri Temizle
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-gray-600 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                <span className="ml-2 bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Archived Invoices */}
          {shouldShowSection('invoices') && (
            <div className="mb-8">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleSection('invoices')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FileText className="w-5 h-5 text-blue-600 mr-2" />
                  Arşivlenmiş Faturalar ({filteredInvoices.length})
                </h3>
                {expandedSections.has('invoices') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {expandedSections.has('invoices') && (
                <div className="bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
                  {filteredInvoices.length === 0 ? (
                    <div className="p-6 text-center">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">Arşivlenmiş fatura bulunmuyor</p>
                      <p className="text-sm text-gray-400">Ödenmiş veya gecikmiş faturalar burada görünecek</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-blue-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase">Fatura</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase">Müşteri</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase">Tutar</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase">Durum</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-blue-800 uppercase">Tarih</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-blue-800 uppercase">İşlemler</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-blue-100">
                          {filteredInvoices.map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-blue-25 transition-colors">
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => onViewInvoice?.(invoice)}
                                  className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                >
                                  {invoice.invoiceNumber}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{invoice.customerName}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                {formatAmount(invoice.total)}
                              </td>
                              <td className="px-4 py-3">
                                {getStatusBadge(invoice.status, 'invoice')}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {formatDate(invoice.issueDate)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <button 
                                    onClick={() => onViewInvoice?.(invoice)}
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Görüntüle"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => onDownloadInvoice?.(invoice)}
                                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title="İndir"
                                  >
                                    <Download className="w-4 h-4" />
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
              )}
            </div>
          )}

          {/* Archived Expenses */}
          {shouldShowSection('expenses') && (
            <div className="mb-8">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleSection('expenses')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Receipt className="w-5 h-5 text-red-600 mr-2" />
                  Arşivlenmiş Giderler ({filteredExpenses.length})
                </h3>
                {expandedSections.has('expenses') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {expandedSections.has('expenses') && (
                <div className="bg-red-50 rounded-lg border border-red-200 overflow-hidden">
                  {filteredExpenses.length === 0 ? (
                    <div className="p-6 text-center">
                      <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">Arşivlenmiş gider bulunmuyor</p>
                      <p className="text-sm text-gray-400">Ödenmiş giderler burada görünecek</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-red-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase">Gider</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase">Tedarikçi</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase">Kategori</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase">Tutar</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase">Tarih</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-red-800 uppercase">İşlemler</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-red-100">
                          {filteredExpenses.map((expense) => (
                            <tr key={expense.id} className="hover:bg-red-25 transition-colors">
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => onViewExpense?.(expense)}
                                  className="text-red-600 hover:text-red-800 font-medium transition-colors"
                                >
                                  {expense.expenseNumber}
                                </button>
                                <div className="text-xs text-gray-500">{expense.description}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{expense.supplier}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                                  {expense.category}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-red-600">
                                -{formatAmount(expense.amount)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {formatDate(expense.expenseDate)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <button 
                                    onClick={() => onViewExpense?.(expense)}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Görüntüle"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => onDownloadExpense?.(expense)}
                                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title="İndir"
                                  >
                                    <Download className="w-4 h-4" />
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
              )}
            </div>
          )}

          {/* Archived Sales */}
          {shouldShowSection('sales') && (
            <div className="mb-8">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleSection('sales')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
                  Arşivlenmiş Satışlar ({filteredSales.length})
                </h3>
                {expandedSections.has('sales') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {expandedSections.has('sales') && (
                <div className="bg-green-50 rounded-lg border border-green-200 overflow-hidden">
                  {filteredSales.length === 0 ? (
                    <div className="p-6 text-center">
                      <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">Arşivlenmiş satış bulunmuyor</p>
                      <p className="text-sm text-gray-400">Tamamlanmış satışlar burada görünecek</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-green-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase">Satış</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase">Müşteri</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase">Ürün/Hizmet</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase">Tutar</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase">Durum</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase">Tarih</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-green-800 uppercase">İşlemler</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-green-100">
                          {filteredSales.map((sale) => (
                            <tr key={sale.id} className="hover:bg-green-25 transition-colors">
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => onViewSale?.(sale)}
                                  className="text-green-600 hover:text-green-800 font-medium transition-colors"
                                >
                                  {sale.saleNumber || `SAL-${sale.id}`}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{sale.customerName}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{sale.productName}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-green-600">
                                {formatAmount(sale.amount)}
                              </td>
                              <td className="px-4 py-3">
                                {getStatusBadge(sale.status, 'sale')}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {formatDate(sale.date)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <button 
                                    onClick={() => onViewSale?.(sale)}
                                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title="Görüntüle"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => onDownloadSale?.(sale)}
                                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title="İndir"
                                  >
                                    <Download className="w-4 h-4" />
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
              )}
            </div>
          )}

          {/* Archived Customers */}
          {shouldShowSection('contacts') && (
            <div className="mb-8">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleSection('customers')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Users className="w-5 h-5 text-purple-600 mr-2" />
                  Müşteriler ({filteredCustomers.length})
                </h3>
                {expandedSections.has('customers') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {expandedSections.has('customers') && (
                <div className="bg-purple-50 rounded-lg border border-purple-200 overflow-hidden">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-6 text-center">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">Müşteri bulunmuyor</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-purple-100">
                      {filteredCustomers.map((customer) => (
                        <div key={customer.id} className="p-4 hover:bg-purple-25 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <span className="text-purple-600 font-semibold">
                                  {customer.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <button
                                  onClick={() => onViewCustomer?.(customer)}
                                  className="font-medium text-purple-600 hover:text-purple-800 transition-colors"
                                >
                                  {customer.name}
                                </button>
                                {customer.company && (
                                  <p className="text-sm text-gray-600">{customer.company}</p>
                                )}
                                <p className="text-xs text-gray-500">{customer.email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-500">
                                Kayıt: {formatDate(customer.createdAt)}
                              </div>
                              <button 
                                onClick={() => onViewCustomer?.(customer)}
                                className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors mt-1"
                                title="Görüntüle"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Archived Suppliers */}
          {shouldShowSection('contacts') && (
            <div className="mb-8">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => toggleSection('suppliers')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Building2 className="w-5 h-5 text-orange-600 mr-2" />
                  Tedarikçiler ({filteredSuppliers.length})
                </h3>
                {expandedSections.has('suppliers') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {expandedSections.has('suppliers') && (
                <div className="bg-orange-50 rounded-lg border border-orange-200 overflow-hidden">
                  {filteredSuppliers.length === 0 ? (
                    <div className="p-6 text-center">
                      <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">Tedarikçi bulunmuyor</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-orange-100">
                      {filteredSuppliers.map((supplier) => (
                        <div key={supplier.id} className="p-4 hover:bg-orange-25 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                <span className="text-orange-600 font-semibold">
                                  {supplier.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <button
                                  onClick={() => onViewSupplier?.(supplier)}
                                  className="font-medium text-orange-600 hover:text-orange-800 transition-colors"
                                >
                                  {supplier.name}
                                </button>
                                {supplier.company && (
                                  <p className="text-sm text-gray-600">{supplier.company}</p>
                                )}
                                <div className="flex items-center space-x-2">
                                  <p className="text-xs text-gray-500">{supplier.email}</p>
                                  <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                                    {supplier.category}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-500">
                                Kayıt: {formatDate(supplier.createdAt)}
                              </div>
                              <button 
                                onClick={() => onViewSupplier?.(supplier)}
                                className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors mt-1"
                                title="Görüntüle"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Archive Summary */}
          {activeTab === 'all' && (
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="w-5 h-5 text-gray-600 mr-2" />
                Arşiv Özeti
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Finansal Özet</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Toplam Arşiv Gelir:</span>
                      <span className="font-semibold text-green-600">{formatAmount(totalArchivedAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Toplam Arşiv Gider:</span>
                      <span className="font-semibold text-red-600">{formatAmount(totalArchivedExpenses)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-300 pt-2">
                      <span className="text-gray-900 font-medium">Net Arşiv:</span>
                      <span className={`font-bold ${totalArchivedAmount - totalArchivedExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatAmount(totalArchivedAmount - totalArchivedExpenses)}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Kayıt Sayıları</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Arşiv Faturalar:</span>
                      <span className="font-medium">{archivedInvoices.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Arşiv Giderler:</span>
                      <span className="font-medium">{archivedExpenses.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Arşiv Satışlar:</span>
                      <span className="font-medium">{archivedSales.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Toplam Kişi:</span>
                      <span className="font-medium">{archivedCustomers.length + archivedSuppliers.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800">Arşiv Hakkında</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Arşiv sayfası tamamlanmış işlemlerinizi saklar. Ödenmiş faturalar, onaylanmış giderler ve 
                  tamamlanmış satışlar otomatik olarak burada listelenir. Bu kayıtlar salt okunur durumdadır 
                  ve geçmiş analiz ile denetim amaçlı kullanılabilir.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
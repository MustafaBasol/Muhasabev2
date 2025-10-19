import React, { useState } from 'react';
import { X, Plus, Trash2, Calculator, Search, Check } from 'lucide-react';
import type { Product } from './ProductList';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  company?: string;
  taxNumber?: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  productId?: string;
  unit?: string;
}

interface InvoiceModalProps {
  onClose: () => void;
  onSave: (invoice: any) => void;
  invoice?: any;
  customers?: Customer[];
  products?: Product[];
}

const TAX_RATE = 0.18;

const defaultItems: InvoiceItem[] = [
  { id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 },
];

export default function InvoiceModal({ onClose, onSave, invoice, customers = [], products = [] }: InvoiceModalProps) {
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: '',
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerAddress: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    status: 'draft',
    type: 'service',
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeProductDropdown, setActiveProductDropdown] = useState<string | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>(defaultItems);
  const [validationError, setValidationError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!invoice) {
      setInvoiceData({
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
        customerId: '',
        customerName: '',
        customerEmail: '',
        customerAddress: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '',
        status: 'draft',
        type: 'service',
      });
      setItems(defaultItems);
      setCustomerSearch('');
      setSelectedCustomer(null);
      setShowCustomerDropdown(false);
      setActiveProductDropdown(null);
      setValidationError(null);
      return;
    }

    setInvoiceData({
      invoiceNumber: invoice.invoiceNumber || `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
      customerId: invoice.customerId || '',
      customerName: invoice.customer?.name || invoice.customerName || '',
      customerEmail: invoice.customer?.email || invoice.customerEmail || '',
      customerAddress: invoice.customer?.address || invoice.customerAddress || '',
      issueDate: invoice.issueDate || new Date().toISOString().split('T')[0],
      dueDate: invoice.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: invoice.notes || '',
      status: invoice.status || 'draft',
      type: invoice.type || 'service',
    });

    const normalisedItems: InvoiceItem[] = (invoice.items || defaultItems).map((item: InvoiceItem, index: number) => {
      const quantity = Number(item.quantity) || 1;
      const unitPrice = Number(item.unitPrice) || 0;
      const total = Number(item.total) || quantity * unitPrice;
      return {
        id: item.id || `${index + 1}`,
        description: item.description || '',
        quantity,
        unitPrice,
        total,
        productId: item.productId,
        unit: item.unit,
      };
    });

    setItems(normalisedItems.length ? normalisedItems : defaultItems);
    setCustomerSearch(invoice.customer?.name || invoice.customerName || '');
    
    // Set selected customer if available
    if (invoice.customer) {
      setSelectedCustomer(invoice.customer as Customer);
    } else {
      setSelectedCustomer(null);
    }
    
    setShowCustomerDropdown(false);
    setActiveProductDropdown(null);
    setValidationError(null);
  }, [invoice]);

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(prev => (prev.length === 1 ? prev : prev.filter(item => item.id !== id)));
    setActiveProductDropdown(prev => (prev === id ? null : prev));
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) {
          return item;
        }
        const updated: InvoiceItem = { ...item, [field]: value } as InvoiceItem;
        if (field === 'quantity' || field === 'unitPrice') {
          const quantity = Number(field === 'quantity' ? value : updated.quantity) || 0;
          const unitPrice = Number(field === 'unitPrice' ? value : updated.unitPrice) || 0;
          updated.total = quantity * unitPrice;
        }
        return updated;
      })
    );
  };

  const subtotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const taxAmount = subtotal * TAX_RATE;
  const total = subtotal + taxAmount;

  const filteredCustomers = customers.filter(customer => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }
    const name = customer.name ? customer.name.toLowerCase() : '';
    const company = customer.company ? customer.company.toLowerCase() : '';
    return name.includes(query) || company.includes(query);
  });

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setInvoiceData(current => ({
      ...current,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerAddress: customer.address || current.customerAddress,
    }));
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
    setValidationError(null);
  };

  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    setInvoiceData(current => ({
      ...current,
      customerName: value,
    }));
    setShowCustomerDropdown(value.length > 0);
    setSelectedCustomer(null);
  };

  const getProductMatches = (term: string) => {
    const query = term.trim().toLowerCase();
    return products
      .filter(product => {
        if (!query) {
          return true;
        }
        return (
          product.name.toLowerCase().includes(query) ||
          (product.sku || '').toLowerCase().includes(query) ||
          (product.category || '').toLowerCase().includes(query)
        );
      })
      .slice(0, 12);
  };

  const handleSelectProduct = (itemId: string, product: Product) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) {
          return item;
        }
        const quantity = item.quantity > 0 ? item.quantity : 1;
        const unitPrice = Number(product.unitPrice ?? item.unitPrice ?? 0);
        return {
          ...item,
          productId: product.id,
          description: product.name,
          unitPrice,
          unit: product.unit,
          quantity,
          total: quantity * unitPrice,
        };
      })
    );
    setActiveProductDropdown(null);
  };

  const handleSave = () => {
    // Validation
    if (!invoiceData.customerId) {
      setValidationError('Lütfen müşteri seçin');
      return;
    }
    if (items.length === 0) {
      setValidationError('Lütfen en az bir ürün ekleyin');
      return;
    }
    if (items.some(item => !item.description || item.quantity <= 0 || item.unitPrice <= 0)) {
      setValidationError('Lütfen tüm ürün bilgilerini eksiksiz doldurun');
      return;
    }
    
    // Calculate totals from items
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const taxAmount = subtotal * TAX_RATE;
    const total = subtotal + taxAmount;
    
    const newInvoice: any = {
      invoiceNumber: invoiceData.invoiceNumber,
      customerId: invoiceData.customerId,
      issueDate: invoiceData.issueDate || new Date().toISOString().split('T')[0],
      dueDate: invoiceData.dueDate || new Date().toISOString().split('T')[0],
      items,
      subtotal,
      taxAmount,
      total,
      notes: invoiceData.notes || '',
      status: invoiceData.status || 'draft',
    };
    
    // Only include ID if editing
    if (invoice?.id) {
      newInvoice.id = invoice.id;
      newInvoice.createdAt = invoice.createdAt;
    }
    
    onSave(newInvoice);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calculator className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {invoice ? 'Faturayi Duzenle' : 'Yeni Fatura Olustur'}
              </h2>
              <p className="text-sm text-gray-500">Musteri bilgilerini ve urun detaylarini girin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Kapat"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fatura Numarasi</label>
              <input
                type="text"
                value={invoiceData.invoiceNumber}
                onChange={(event) => setInvoiceData({ ...invoiceData, invoiceNumber: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duzenleme Tarihi</label>
              <input
                type="date"
                value={invoiceData.issueDate}
                onChange={(event) => setInvoiceData({ ...invoiceData, issueDate: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vade Tarihi</label>
              <input
                type="date"
                value={invoiceData.dueDate}
                onChange={(event) => setInvoiceData({ ...invoiceData, dueDate: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fatura Durumu</label>
              <select
                value={invoiceData.status}
                onChange={(event) => setInvoiceData({ ...invoiceData, status: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="draft">Taslak</option>
                <option value="sent">Gonderildi</option>
                <option value="paid">Odendi</option>
                <option value="overdue">Vadesi Gecti</option>
                <option value="cancelled">Iptal Edildi</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Musteri Adi</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(event) => handleCustomerSearchChange(event.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Musteri ara veya yeni musteri adi girin"
                />
                {selectedCustomer && (
                  <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500 w-4 h-4" />
                )}
              </div>
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  <div className="p-2 text-xs text-gray-500 border-b">
                    {filteredCustomers.length} musteri bulundu
                  </div>
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleCustomerSelect(customer)}
                      className="w-full p-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{customer.name}</div>
                      <div className="text-sm text-gray-600">{customer.company}</div>
                      <div className="text-xs text-gray-500">{customer.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">E-posta</label>
              <input
                type="email"
                value={invoiceData.customerEmail}
                onChange={(event) => setInvoiceData({ ...invoiceData, customerEmail: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="musteri@example.com"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Adres</label>
              <textarea
                value={invoiceData.customerAddress}
                onChange={(event) => setInvoiceData({ ...invoiceData, customerAddress: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Musteri adresi"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Urun ve Hizmetler</h3>
              <button
                onClick={addItem}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Satir Ekle</span>
              </button>
            </div>

            <div style={{ overflow: 'visible' }}>
              <table className="w-full border border-gray-200 rounded-lg table-fixed" style={{ position: 'relative' }}>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ width: '40%' }}>Aciklama</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ width: '12%' }}>Miktar</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ width: '18%' }}>Birim Fiyat</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ width: '18%' }}>Toplam</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700" style={{ width: '12%' }}>Islem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200" style={{ position: 'relative' }}>
                  {items.map((item) => {
                    const productMatches = getProductMatches(item.description);
                    const selectedProduct = item.productId
                      ? products.find(product => product.id === item.productId)
                      : null;

                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3" style={{ position: 'static' }}>
                          <div className="relative" style={{ position: 'static' }}>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(event) => {
                                updateItem(item.id, 'description', event.target.value);
                                if (event.target.value.length > 0) {
                                  setActiveProductDropdown(item.id);
                                }
                              }}
                              onClick={() => {
                                if (item.description.length > 0) {
                                  setActiveProductDropdown(item.id);
                                }
                              }}
                              onBlur={() => setTimeout(() => {
                                setActiveProductDropdown((current) => (current === item.id ? null : current));
                              }, 200)}
                              className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Urun veya hizmet aciklamasi"
                            />
                            {activeProductDropdown === item.id && productMatches.length > 0 && (
                              <div className="absolute z-[100] mt-1 w-[450px] left-0 rounded-lg border-2 border-gray-300 bg-white shadow-2xl max-h-[500px] overflow-y-auto">
                                <div className="sticky top-0 bg-blue-50 p-3 text-xs font-medium text-blue-700 border-b border-blue-200">
                                  <span className="flex items-center">
                                    <Search className="w-3 h-3 mr-1" />
                                    {productMatches.length} ürün bulundu
                                  </span>
                                </div>
                                {productMatches.map(product => (
                                  <button
                                    key={`${item.id}-${product.id}`}
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => handleSelectProduct(item.id, product)}
                                    className="w-full p-4 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                  >
                                    <div className="font-semibold text-gray-900 mb-1">{product.name}</div>
                                    <div className="flex items-center space-x-3 text-xs text-gray-600">
                                      {product.sku && (
                                        <span className="px-2 py-0.5 bg-gray-100 rounded">SKU: {product.sku}</span>
                                      )}
                                      {product.category && (
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{product.category}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between mt-2 text-sm">
                                      <span className="font-medium text-green-600">
                                        {product.unitPrice?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TRY
                                      </span>
                                      <span className="text-gray-500">
                                        Stok: <span className={product.stockQuantity > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                          {product.stockQuantity}
                                        </span>
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {item.unit && (
                            <p className="mt-1 text-xs text-gray-500">Birim: {item.unit}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(event) => updateItem(item.id, 'quantity', parseFloat(event.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(event) => updateItem(item.id, 'unitPrice', parseFloat(event.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">
                            {item.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TRY
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeItem(item.id)}
                            disabled={items.length === 1}
                            className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Ara Toplam:</span>
                  <span className="font-medium">{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TRY</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">KDV (%18):</span>
                  <span className="font-medium">{taxAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TRY</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                  <span>Genel Toplam:</span>
                  <span>{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TRY</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
            <textarea
              value={invoiceData.notes}
              onChange={(event) => setInvoiceData({ ...invoiceData, notes: event.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Fatura ile ilgili ek notlar"
            />
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Iptal
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {invoice ? 'Guncelle' : 'Fatura Olustur'}
          </button>
        </div>
      </div>

      {/* Validation Error Modal */}
      {validationError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Uyarı</h3>
                <p className="text-gray-600">{validationError}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setValidationError(null)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

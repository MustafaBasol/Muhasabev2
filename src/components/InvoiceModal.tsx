import React, { useState } from 'react';
import { X, Plus, Trash2, Calculator, Search, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../types';

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
  taxRate?: number; // KDV oranı
}

interface InvoiceModalProps {
  onClose: () => void;
  onSave: (invoice: any) => void;
  invoice?: any;
  customers?: Customer[];
  products?: Product[];
  invoices?: any[]; // mevcut faturalar (iade için seçim)
}

const defaultItems: InvoiceItem[] = [
  { id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 },
];

export default function InvoiceModal({ onClose, onSave, invoice, customers = [], products = [], invoices = [] }: InvoiceModalProps) {
  const { t, i18n } = useTranslation();
  
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
    type: 'product', // 'product' veya 'return'
    originalInvoiceId: '',
  });

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeProductDropdown, setActiveProductDropdown] = useState<string | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>(defaultItems);
  const [validationError, setValidationError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!invoice) {
      // Geçici fatura numarası - Backend gerçek numarayı oluşturacak
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const tempNumber = `INV-${year}-${month}-XXX`;
      
      setInvoiceData({
        invoiceNumber: tempNumber,
        customerId: '',
        customerName: '',
        customerEmail: '',
        customerAddress: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '',
        status: 'draft',
        type: 'product',
        originalInvoiceId: '',
      });
      setItems(defaultItems);
      setCustomerSearch('');
      setSelectedCustomer(null);
      setShowCustomerDropdown(false);
      setActiveProductDropdown(null);
      setValidationError(null);
      return;
    }

  // İade faturası bayrağını kontrol et
  const isReturnInvoice = (invoice as any)._isReturnInvoice === true || String(invoice?.type || '') === 'return';
  const linkedOriginalId = (invoice as any).originalInvoiceId || (invoice as any).refundedInvoiceId || '';

    // Düzenleme modunda backend'den gelen numarayı kullan
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const tempNumber = `INV-${year}-${month}-XXX`;
    
    setInvoiceData({
      invoiceNumber: invoice.invoiceNumber || tempNumber,
      customerId: invoice.customerId || '',
      customerName: invoice.customer?.name || invoice.customerName || '',
      customerEmail: invoice.customer?.email || invoice.customerEmail || '',
      customerAddress: invoice.customer?.address || invoice.customerAddress || '',
      issueDate: invoice.issueDate || new Date().toISOString().split('T')[0],
      dueDate: invoice.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: invoice.notes || '',
      status: invoice.status || 'draft',
      type: isReturnInvoice ? 'return' : (invoice.type || 'product'),
      originalInvoiceId: linkedOriginalId || '',
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

    // Auto-select and auto-load when editing a return invoice linked to an original
    if (isReturnInvoice && linkedOriginalId) {
      const original = invoices.find(inv => String(inv.id) === String(linkedOriginalId));
      if (original) {
        // Fill customer info from original if not already set
        setInvoiceData(prev => ({
          ...prev,
          originalInvoiceId: String(linkedOriginalId),
          customerId: prev.customerId || original.customerId || '',
          customerName: prev.customerName || original.customer?.name || original.customerName || '',
          customerEmail: prev.customerEmail || original.customer?.email || original.customerEmail || '',
          customerAddress: prev.customerAddress || original.customer?.address || original.customerAddress || '',
        }));

        // Reflect selection in UI inputs
        if (original.customer) {
          setSelectedCustomer(original.customer);
          setCustomerSearch(original.customer.name || '');
        } else if (original.customerName) {
          setCustomerSearch(original.customerName);
        }

        // If current items look empty or default-like, prefill negative items from original
        const hasMeaningfulItems = Array.isArray(invoice.items) && invoice.items.length > 0;
        if (!hasMeaningfulItems) {
          const mapped = (original.items || []).map((it: any, idx: number) => ({
            id: `ret-${Date.now()}-${idx}`,
            description: it.description || it.productName || '',
            quantity: -(Number(it.quantity) || 1),
            unitPrice: Number(it.unitPrice) || 0,
            total: -(Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
            productId: it.productId,
            unit: it.unit || undefined,
            taxRate: Number(it.taxRate ?? 18),
          }));
          setItems(mapped.length ? mapped : defaultItems);
        }
      }
    }
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

  // Real-time özet hesaplama - Her ürün kendi KDV oranıyla
  let subtotal = 0; // KDV HARİÇ toplam
  let taxAmount = 0; // KDV tutarı
  
  items.forEach(item => {
    const itemTotal = Number(item.total) || 0; // Bu KDV HARİÇ (quantity * unitPrice)
    const itemTaxRate = Number(item.taxRate ?? 18) / 100; // %18 -> 0.18
    const itemTax = itemTotal * itemTaxRate; // KDV tutarı
    
    subtotal += itemTotal; // KDV HARİÇ toplam
    taxAmount += itemTax; // KDV toplamı
  });
  
  const total = subtotal + taxAmount; // KDV DAHİL toplam

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
    console.log('🔍 Seçilen ürün:', {
      name: product.name,
      taxRate: product.taxRate,
      categoryTaxRateOverride: product.categoryTaxRateOverride,
      finalTaxRate: product.categoryTaxRateOverride ?? product.taxRate ?? 18
    });
    
    setItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) {
          return item;
        }
        const quantity = item.quantity > 0 ? item.quantity : 1;
        const unitPrice = Number(product.unitPrice ?? item.unitPrice ?? 0);
        // Öncelik: Ürüne özel KDV > Kategori KDV > Varsayılan %18
        const taxRate = Number(product.categoryTaxRateOverride ?? product.taxRate ?? 18);
        return {
          ...item,
          productId: product.id,
          description: product.name,
          unitPrice,
          unit: product.unit,
          quantity,
          total: quantity * unitPrice,
          taxRate, // KDV oranını item'a ekle
        };
      })
    );
    setActiveProductDropdown(null);
  };

  const handleSave = async () => {
    console.log('🔍 InvoiceModal handleSave - Validation başlıyor:', {
      customerId: invoiceData.customerId,
      customerName: invoiceData.customerName,
      selectedCustomer: selectedCustomer?.name,
      customerSearch: customerSearch
    });

    // Validation
    if (!invoiceData.customerId) {
      console.error('❌ customerId validation failed:', {
        customerId: invoiceData.customerId,
        selectedCustomer: selectedCustomer
      });
      setValidationError('Lütfen müşteri seçin');
      return;
    }
    if (invoiceData.type === 'return' && !invoiceData.originalInvoiceId) {
      setValidationError('İade faturası oluşturmak için iade edilecek faturayı seçmelisiniz');
      return;
    }
    if (items.length === 0) {
      setValidationError('Lütfen en az bir ürün ekleyin');
      return;
    }
    // İade faturaları için negatif miktar kabul et
    if (items.some(item => !item.description || item.unitPrice <= 0)) {
      setValidationError('Lütfen tüm ürün bilgilerini eksiksiz doldurun');
      return;
    }
    
    // İade faturaları için kalemleri negatifle (miktar negatif olmalı)
    const normalizedItems = (invoiceData.type === 'return')
      ? items.map(it => {
          const q = Number(it.quantity) || 0;
          const unitPrice = Number(it.unitPrice) || 0;
          const negQ = q > 0 ? -q : q; // pozitif girilmişse negatife çevir
          const lineTotal = negQ * unitPrice; // KDV HARİÇ
          return { ...it, quantity: negQ, total: lineTotal };
        })
      : items.map(it => {
          const q = Number(it.quantity) || 0;
          const unitPrice = Number(it.unitPrice) || 0;
          return { ...it, total: q * unitPrice };
        });

    // Her ürün kendi KDV oranıyla: item.total KDV HARİÇ kabul edilir
    let subtotal = 0; // KDV HARİÇ
    let taxAmount = 0; // KDV
    normalizedItems.forEach(item => {
      const itemTotal = Number(item.total) || 0; // KDV HARİÇ
      const itemTaxRate = Number(item.taxRate ?? 18) / 100;
      const itemTax = itemTotal * itemTaxRate; // işaret korunur
      subtotal += itemTotal;
      taxAmount += itemTax;
    });
    const total = subtotal + taxAmount; // KDV DAHİL
    
    const newInvoice: any = {
      invoiceNumber: invoiceData.invoiceNumber,
      customerId: invoiceData.customerId,
      customerName: invoiceData.customerName,
      customerEmail: invoiceData.customerEmail,
      customerAddress: invoiceData.customerAddress,
      issueDate: invoiceData.issueDate || new Date().toISOString().split('T')[0],
      dueDate: invoiceData.dueDate || new Date().toISOString().split('T')[0],
      items: normalizedItems,
      subtotal,
      taxAmount,
      total,
      notes: invoiceData.notes || '',
      status: invoiceData.status || 'draft',
      type: invoiceData.type || 'product',
      originalInvoiceId: invoiceData.originalInvoiceId || undefined,
    };
    
    // Only include ID if editing
    if (invoice?.id) {
      newInvoice.id = invoice.id;
      newInvoice.createdAt = invoice.createdAt;
    }
    // Yeni fatura akışından iade seçilip bir orijinal fatura belirlenmişse,
    // yeni kayıt oluşturmak yerine orijinal faturayı güncelle
    if (!newInvoice.id && newInvoice.type === 'return' && newInvoice.originalInvoiceId) {
      newInvoice.id = String(newInvoice.originalInvoiceId);
    }
    
    console.log('💾 InvoiceModal - onSave\'e gönderilecek veri:', {
      customerId: newInvoice.customerId,
      customerName: newInvoice.customerName,
      customerEmail: newInvoice.customerEmail,
      itemCount: newInvoice.items.length,
      total: newInvoice.total
    });
    
    await onSave(newInvoice);
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
                {invoice ? t('invoices.editInvoice') : t('invoices.newInvoice')}
              </h2>
              <p className="text-sm text-gray-500">{t('invoices.enterInvoiceInfo')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('invoices.invoiceNumber')}</label>
              <input
                type="text"
                value={invoiceData.invoiceNumber}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                title={t('invoices.invoiceNumberAutoGenerated')}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="text-indigo-600 font-semibold">{t('invoices.invoiceType')}</span>
              </label>
              <select
                value={invoiceData.type}
                onChange={e => {
                  const nextType = e.target.value;
                  setInvoiceData(prev => ({ ...prev, type: nextType }));
                  if (nextType === 'return') {
                    // Eğer mevcut bir fatura düzenleniyorsa, onu otomatik orijinal olarak seç
                    const candidateId = invoice?.id ? String(invoice.id) : '';
                    if (candidateId) {
                      const original = invoices.find(inv => String(inv.id) === candidateId);
                      if (original) {
                        // Müşteri ve orijinal fatura alanlarını doldur
                        setInvoiceData(prev => ({
                          ...prev,
                          originalInvoiceId: candidateId,
                          invoiceNumber: original.invoiceNumber || prev.invoiceNumber,
                          customerId: prev.customerId || original.customerId || '',
                          customerName: prev.customerName || original.customer?.name || original.customerName || '',
                          customerEmail: prev.customerEmail || original.customer?.email || original.customerEmail || '',
                          customerAddress: prev.customerAddress || original.customer?.address || original.customerAddress || '',
                        }));
                        if (original.customer) {
                          setSelectedCustomer(original.customer);
                          setCustomerSearch(original.customer.name || '');
                        } else if (original.customerName) {
                          setCustomerSearch(original.customerName);
                        }
                        // Eğer satırlar boşsa otomatik negatif kalemleri yükle
                        const isEmptyItems = items.length === 0 || (items.length === 1 && !items[0].description && (Number(items[0].total) || 0) === 0);
                        if (isEmptyItems) {
                          const mapped = (original.items || []).map((it: any, idx: number) => ({
                            id: `ret-${Date.now()}-${idx}`,
                            description: it.description || it.productName || '',
                            quantity: -(Number(it.quantity) || 1),
                            unitPrice: Number(it.unitPrice) || 0,
                            total: -(Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
                            productId: it.productId,
                            unit: it.unit || undefined,
                            taxRate: Number(it.taxRate ?? 18),
                          }));
                          setItems(mapped.length ? mapped : defaultItems);
                        }
                      }
                    }
                  } else {
                    // Normal fatura tipine dönüldüyse orijinal fatura alanını temizle (opsiyonel)
                    setInvoiceData(prev => ({ ...prev, originalInvoiceId: '' }));
                  }
                }}
                className="w-full px-3 py-2 border-2 border-indigo-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              >
                <option value="product">✓ {t('invoices.productInvoice')}</option>
                <option value="return">↩ {t('invoices.returnInvoice')}</option>
              </select>
            </div>
          </div>

          {invoiceData.type === 'return' && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                <span className="text-red-600">⚠ {t('invoices.invoiceToReturn')}</span>
              </label>
              <select
                value={invoiceData.originalInvoiceId}
                onChange={e => {
                  const id = e.target.value;
                  
                  // Eğer bir fatura seçildiyse onun bilgilerini al
                  const original = invoices.find(inv => String(inv.id) === String(id));
                  if (original) {
                    // Müşteri bilgilerini de doldur
                    setInvoiceData(prev => ({
                      ...prev,
                      originalInvoiceId: id,
                      invoiceNumber: original.invoiceNumber || prev.invoiceNumber,
                      customerId: original.customerId || '',
                      customerName: original.customer?.name || original.customerName || '',
                      customerEmail: original.customer?.email || original.customerEmail || '',
                      customerAddress: original.customer?.address || original.customerAddress || '',
                    }));
                    
                    // Müşteri seçimini de ayarla
                    if (original.customer) {
                      setSelectedCustomer(original.customer);
                      setCustomerSearch(original.customer.name || '');
                    } else if (original.customerName) {
                      setCustomerSearch(original.customerName);
                    }
                    
                    // Kalemleri negatif olarak ekle
                    const mapped = (original.items || []).map((it: any, idx: number) => ({
                      id: `ret-${Date.now()}-${idx}`,
                      description: it.description || it.productName || '',
                      quantity: -(Number(it.quantity) || 1),
                      unitPrice: Number(it.unitPrice) || 0,
                      total: -(Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
                      productId: it.productId,
                      unit: it.unit || undefined,
                      taxRate: Number(it.taxRate ?? 18),
                    }));
                    setItems(mapped.length ? mapped : defaultItems);
                  } else {
                    // Seçim temizlendiyse bilgileri sıfırla
                    setInvoiceData(prev => ({ ...prev, originalInvoiceId: id }));
                  }
                }}
                className="w-full px-3 py-2 border-2 border-yellow-400 rounded-lg bg-white"
              >
                <option value="">{t('invoices.selectInvoiceToReturn')}</option>
                {invoices.map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.invoiceNumber} - {inv.customerName || inv.customer?.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-600 mt-2">{t('invoices.returnInvoiceAutoLoad')}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('invoices.issueDate')}</label>
              <input
                type="date"
                value={invoiceData.issueDate}
                onChange={(event) => setInvoiceData({ ...invoiceData, issueDate: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                lang={i18n.language}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('invoices.dueDate')}</label>
              <input
                type="date"
                value={invoiceData.dueDate}
                onChange={(event) => setInvoiceData({ ...invoiceData, dueDate: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                lang={i18n.language}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('invoices.status')}</label>
              <select
                value={invoiceData.status}
                onChange={(event) => setInvoiceData({ ...invoiceData, status: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="draft">{t('status.draft')}</option>
                <option value="sent">{t('status.sent')}</option>
                <option value="paid">{t('status.paid')}</option>
                <option value="overdue">{t('status.overdue')}</option>
                <option value="cancelled">{t('status.cancelled')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('invoices.customerName')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(event) => handleCustomerSearchChange(event.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('invoices.customerSearchPlaceholder')}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('customers.email')}</label>
              <input
                type="email"
                value={invoiceData.customerEmail}
                onChange={(event) => setInvoiceData({ ...invoiceData, customerEmail: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('customers.emailPlaceholder')}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('customers.address')}</label>
              <textarea
                value={invoiceData.customerAddress}
                onChange={(event) => setInvoiceData({ ...invoiceData, customerAddress: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder={t('customers.addressPlaceholder')}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">{t('invoices.productsAndServices')}</h3>
              <button
                onClick={addItem}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>{t('invoices.addLine')}</span>
              </button>
            </div>

            <div style={{ overflow: 'visible' }}>
              <table className="w-full border border-gray-200 rounded-lg table-fixed" style={{ position: 'relative' }}>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ width: '40%' }}>{t('invoices.description')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ width: '12%' }}>{t('invoices.quantity')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ width: '18%' }}>{t('invoices.unitPriceExclVAT')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ width: '18%' }}>{t('invoices.totalInclVAT')}</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700" style={{ width: '12%' }}>{t('invoices.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200" style={{ position: 'relative' }}>
                  {items.map((item) => {
                    const productMatches = getProductMatches(item.description);

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
                              placeholder={t('invoices.productServiceDescription')}
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
                                        {product.unitPrice?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
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
                            onChange={(event) => updateItem(item.id, 'quantity', parseInt(event.target.value, 10) || 1)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            min="1"
                            step="1"
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
                            {item.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
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
                  <span className="text-gray-600">{t('invoices.subtotalExclVAT')}:</span>
                  <span className="font-medium">{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('invoices.vat')}:</span>
                  <span className="font-medium">{taxAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                  <span>{t('invoices.grandTotalInclVAT')}:</span>
                  <span>{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('invoices.notes')}</label>
            <textarea
              value={invoiceData.notes}
              onChange={(event) => setInvoiceData({ ...invoiceData, notes: event.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder={t('invoices.notesPlaceholder')}
            />
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel') || 'Iptal'}
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {invoice ? (t('common.update') || 'Guncelle') : (t('invoices.createInvoice') || 'Fatura Olustur')}
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('common.warning')}</h3>
                <p className="text-gray-600">{validationError}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setValidationError(null)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                {t('common.ok')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

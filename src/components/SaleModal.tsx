import React, { useState } from 'react';
import {
  X,
  TrendingUp,
  User,
  Package,
  DollarSign,
  Calendar,
  CreditCard,
  Search,
  Check
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { normalizeStatusKey, resolveStatusLabel } from '../utils/status';
import type { Product } from '../types';
import type { Sale } from '../types';

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

interface SaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sale: Sale) => void;
  sale?: Sale | null;
  customers?: Customer[];
  products?: Product[];
}

export default function SaleModal({
  isOpen,
  onClose,
  onSave,
  sale,
  customers = [],
  products = [],
}: SaleModalProps) {
  const { t, i18n } = useTranslation();
  const [saleData, setSaleData] = useState({
    saleNumber: sale?.saleNumber || '', // Boş bırak, backend oluşturacak
    customerName: sale?.customerName || '',
    customerEmail: sale?.customerEmail || '',
    productId: sale?.productId || '',
    productName: sale?.productName || '',
    productUnit: sale?.productUnit || '',
    quantity: sale?.quantity || 1,
    unitPrice: sale?.unitPrice || 0,
    status: sale?.status || 'completed',
    date: sale?.date || new Date().toISOString().split('T')[0],
    paymentMethod: sale?.paymentMethod || 'cash',
    notes: sale?.notes || '',
  });

  const [customerSearch, setCustomerSearch] = useState(sale?.customerName || '');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [productSearch, setProductSearch] = useState(sale?.productName || '');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [selectedProductOption, setSelectedProductOption] = useState<Product | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createInvoice, setCreateInvoice] = useState(false);

  React.useEffect(() => {
    console.log('🎬 SaleModal useEffect çalıştı:', { 
      isOpen, 
      hasSale: !!sale,
      saleId: sale?.id,
      saleName: sale?.customerName 
    });
    
    if (!isOpen) {
      return;
    }

    if (!sale) {
      console.log('📝 Yeni satış formu hazırlanıyor');
      setSaleData({
        saleNumber: '', // Backend oluşturacak
        customerName: '',
        customerEmail: '',
        productId: '',
        productName: '',
        productUnit: '',
        quantity: 1,
        unitPrice: 0,
        status: 'completed',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'cash',
        notes: '',
      });
      setCustomerSearch('');
      setProductSearch('');
      setSelectedCustomer(null);
      setSelectedProductOption(null);
      setShowCustomerDropdown(false);
      setShowProductDropdown(false);
      setErrors({});
      setCreateInvoice(false);
      return;
    }

    console.log('✏️ Mevcut satış formu yükleniyor:', sale.saleNumber);
    setSaleData({
      saleNumber: sale.saleNumber || '', // Mevcut numarayı kullan
      customerName: sale.customerName || '',
      customerEmail: sale.customerEmail || '',
      productId: sale.productId || '',
      productName: sale.productName || '',
      productUnit: sale.productUnit || '',
      quantity: sale.quantity || 1,
      unitPrice: sale.unitPrice || 0,
      status: sale.status,
      date: sale.date || new Date().toISOString().split('T')[0],
      paymentMethod: sale.paymentMethod || 'cash',
      notes: sale.notes || '',
    });
    setCustomerSearch(sale.customerName || '');
    setProductSearch(sale.productName || '');
    setSelectedCustomer(null);
    const matchedProduct = products.find(product =>
      product.id === sale.productId ||
      (product.name ? product.name.toLowerCase() : '') === (sale.productName || '').toLowerCase()
    );
    setSelectedProductOption(matchedProduct || null);
    setShowCustomerDropdown(false);
    setShowProductDropdown(false);
    setErrors({});
    setCreateInvoice(false);
  }, [isOpen, sale, products]);

  const total = saleData.quantity * saleData.unitPrice;
  const safeTotal = Number.isFinite(total) ? total : 0;

  const filteredCustomers = customers.filter(customer => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }
    const name = customer.name ? customer.name.toLowerCase() : '';
    const company = customer.company ? customer.company.toLowerCase() : '';
    const email = customer.email ? customer.email.toLowerCase() : '';
    return name.includes(query) || company.includes(query) || email.includes(query);
  });

  const filteredProducts = products
      .filter(product => {
        const query = productSearch.trim().toLowerCase();
        if (!query) {
          return true;
        }
        const name = product.name ? product.name.toLowerCase() : '';
        const sku = product.sku ? product.sku.toLowerCase() : '';
        const category = product.category ? product.category.toLowerCase() : '';
        return name.includes(query) || sku.includes(query) || category.includes(query);
      })
    .slice(0, 12);

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSaleData(current => ({
      ...current,
      customerName: customer.name,
      customerEmail: customer.email,
    }));
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
    if (errors.customerName) {
      setErrors(current => ({ ...current, customerName: '' }));
    }
  };

  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    setSaleData(current => ({
      ...current,
      customerName: value,
    }));
    setShowCustomerDropdown(value.length > 0);
    setSelectedCustomer(null);
    if (errors.customerName) {
      setErrors(current => ({ ...current, customerName: '' }));
    }
  };

  const handleProductSearchChange = (value: string) => {
    setProductSearch(value);
    setSaleData(current => ({
      ...current,
      productName: value,
      productId: '',
      productUnit: current.productUnit,
    }));
    setShowProductDropdown(true);
    setSelectedProductOption(null);
    if (errors.productName) {
      setErrors(current => ({ ...current, productName: '' }));
    }
  };

  const handleProductSelect = (product: Product) => {
    const nextQuantity = saleData.quantity > 0 ? saleData.quantity : 1;
    const unitPrice = Number(product.unitPrice ?? saleData.unitPrice ?? 0);
    setSelectedProductOption(product);
    setProductSearch(product.name);
    setSaleData(current => ({
      ...current,
      productId: product.id,
      productName: product.name,
      productUnit: product.unit || current.productUnit,
      unitPrice,
      quantity: nextQuantity,
    }));
    setShowProductDropdown(false);
    if (errors.productName) {
      setErrors(current => ({ ...current, productName: '' }));
    }
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!saleData.customerName.trim()) {
      nextErrors.customerName = t('validation.customerNameRequired');
    } else {
        const customerExists = customers.some(customer => {
          if (!customer.name) {
            return false;
          }
          return customer.name.toLowerCase() === saleData.customerName.trim().toLowerCase();
        });
      if (!customerExists) {
        nextErrors.customerName = t('validation.customerNotFound');
      }
    }

    if (!saleData.productName.trim()) {
      nextErrors.productName = t('validation.productNameRequired');
    } else {
      // Ürün de sistemde olmalı
      const productExists = products.some(product => {
        if (!product.name) {
          return false;
        }
        return product.name.toLowerCase() === saleData.productName.trim().toLowerCase();
      });
      if (!productExists) {
        nextErrors.productName = t('validation.productNotFound');
      }
    }

    if (!saleData.date) {
      nextErrors.date = t('validation.saleDateRequired');
    }

    if (saleData.unitPrice <= 0) {
      nextErrors.unitPrice = t('validation.unitPriceRequired');
    }

    if (saleData.quantity <= 0) {
      nextErrors.quantity = t('validation.quantityRequired');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    const amount = safeTotal;

    const saleToSave: any = {
      ...saleData,
      amount,
      total: amount,
      createInvoice,
    };
    
    // Only include ID if editing
    if (sale?.id) {
      saleToSave.id = sale.id;
    }
    
    // Remove empty saleNumber - backend will generate it
    if (!saleToSave.saleNumber || saleToSave.saleNumber === '') {
      delete saleToSave.saleNumber;
    }

    console.log('💾 SaleModal kayıt gönderiyor:', saleToSave);
    onSave(saleToSave);
    // onClose'u biraz geciktir ki state güncellensin
    setTimeout(() => {
      console.log('🚪 SaleModal kapanıyor');
      onClose();
    }, 10);
  };

  if (!isOpen) {
    console.log('🚫 SaleModal render edilmiyor (isOpen=false)');
    return null;
  }

  console.log('✅ SaleModal render ediliyor:', { 
    saleNumber: saleData.saleNumber || 'YENİ',
    customerName: saleData.customerName || 'BOŞ'
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {sale ? t('sales.editSale') : t('sales.newSale')}
              </h2>
              <p className="text-sm text-gray-500">{t('sales.enterSaleInfo')}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('sales.saleNumber')}</label>
              <input
                type="text"
                value={saleData.saleNumber || t('sales.autoGenerated')}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
              />
              {!saleData.saleNumber && (
                <p className="text-xs text-gray-500 mt-1">{t('sales.autoNumberNote')}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                {t('sales.saleDate')} *
              </label>
              <input
                type="date"
                value={saleData.date}
                onChange={(event) => setSaleData({ ...saleData, date: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                lang={i18n.language}
              />
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                {t('customers.name')} *
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(event) => handleCustomerSearchChange(event.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.customerName 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-green-500'
                  }`}
                  placeholder={t('customers.selectFromList')}
                />
                {selectedCustomer && (
                  <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500 w-4 h-4" />
                )}
              </div>
              {errors.customerName && <p className="text-red-500 text-xs mt-1">{errors.customerName}</p>}
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  <div className="p-2 text-xs text-gray-500 border-b">
                    {filteredCustomers.length} {t('customers.customersFound')}
                  </div>
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleCustomerSelect(customer)}
                      className="w-full p-3 text-left hover:bg-green-50 border-b border-gray-100 last:border-b-0"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.email')}</label>
              <input
                type="email"
                value={saleData.customerEmail}
                onChange={(event) => setSaleData({ ...saleData, customerEmail: event.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder={t('customers.emailPlaceholder')}
              />
              {errors.customerEmail && <p className="text-red-500 text-xs mt-1">{errors.customerEmail}</p>}
            </div>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Package className="w-4 h-4 inline mr-2" />
              {t('products.productServiceName')} *
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={productSearch}
                onChange={(event) => handleProductSearchChange(event.target.value)}
                onFocus={() => setShowProductDropdown(true)}
                onBlur={() => setTimeout(() => setShowProductDropdown(false), 120)}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.productName 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-green-500'
                }`}
                placeholder={t('products.selectFromList')}
              />
              {selectedProductOption && (
                <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500 w-4 h-4" />
              )}
            </div>
            {selectedProductOption && (
              <p className="mt-1 text-xs text-gray-500">
                {t('products.stock')}: {selectedProductOption.stockQuantity} {selectedProductOption.unit || ''} | {t('products.price')}: {selectedProductOption.unitPrice?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
            )}
            {errors.productName && <p className="text-red-500 text-xs mt-1">{errors.productName}</p>}
            {showProductDropdown && filteredProducts.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <div className="p-2 text-xs text-gray-500 border-b">
                  {filteredProducts.length} {t('products.productsFound')}
                </div>
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleProductSelect(product)}
                    className="w-full p-3 text-left hover:bg-green-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{product.name}</div>
                    <div className="text-xs text-gray-500">
                      {(product.sku ? `SKU: ${product.sku}` : '')}{product.sku && product.category ? ' • ' : ''}{product.category || ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {t('products.price')}: {product.unitPrice?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} | {t('products.stock')}: {product.stockQuantity}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.quantity')} *</label>
              <input
                type="number"
                value={saleData.quantity}
                onChange={(event) => setSaleData({ ...saleData, quantity: parseInt(event.target.value, 10) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                min="1"
                step="1"
              />
              {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-2" />
                {t('sales.unitPriceExclVAT')} *
              </label>
              <input
                type="number"
                value={saleData.unitPrice}
                onChange={(event) => setSaleData({ ...saleData, unitPrice: parseFloat(event.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
              {errors.unitPrice && <p className="text-red-500 text-xs mt-1">{errors.unitPrice}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('sales.totalExclVAT')}</label>
              <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-medium">
                {safeTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.status')}</label>
              <select
                value={saleData.status}
                onChange={(event) => setSaleData({ ...saleData, status: event.target.value as Sale['status'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="completed">{resolveStatusLabel(t, normalizeStatusKey('completed'))}</option>
                <option value="pending">{resolveStatusLabel(t, normalizeStatusKey('pending'))}</option>
                <option value="cancelled">{resolveStatusLabel(t, normalizeStatusKey('cancelled'))}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CreditCard className="w-4 h-4 inline mr-2" />
                {t('payment.method')}
              </label>
              <select
                value={saleData.paymentMethod || 'cash'}
                onChange={(event) => setSaleData({ ...saleData, paymentMethod: event.target.value as 'cash' | 'card' | 'transfer' | 'check' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="cash">{t('payment.cash')}</option>
                <option value="card">{t('payment.card')}</option>
                <option value="transfer">{t('payment.transfer')}</option>
                <option value="check">{t('payment.check')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.notes')}</label>
            <textarea
              value={saleData.notes}
              onChange={(event) => setSaleData({ ...saleData, notes: event.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              rows={3}
              placeholder={t('sales.notesPlaceholder')}
            />
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            {sale ? t('common.update') : t('sales.addSale')}
          </button>
        </div>
      </div>
    </div>
  );
}


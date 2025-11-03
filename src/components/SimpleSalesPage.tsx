/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Plus, Calendar, DollarSign, User, Package, Search, Eye, Edit, Trash2, Download, Check, X, FileText, CheckCircle } from 'lucide-react';
import SaleModal from './SaleModal';
import type { Product } from '../types';
import SaleViewModal from './SaleViewModal';
import InvoiceViewModal from './InvoiceViewModal';
import type { Sale } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { compareBy, defaultStatusOrderSales, normalizeText, parseDateSafe, toNumberSafe, SortDir } from '../utils/sortAndSearch';



const toNumber = (v: any): number => {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  const s = String(v).trim();
  const normalized = s.replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
};

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

interface SimpleSalesPageProps {
  customers?: Customer[];
  sales?: Sale[];
  invoices?: any[];
  onSalesUpdate?: (sales: any[]) => void;
  onUpsertSale?: (sale: any) => void; // Tek satış için
  onCreateInvoice?: (invoiceData: any) => Promise<any>; // Promise döndürüyor
  onEditInvoice?: (invoice: any) => void;
  onDownloadSale?: (sale: Sale) => void;
  products?: Product[];
}

export default function SimpleSalesPage({ customers = [], sales = [], invoices = [], products = [], onSalesUpdate, onUpsertSale, onCreateInvoice, onEditInvoice, onDownloadSale }: SimpleSalesPageProps) {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  
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
  const [sortBy, setSortBy] = useState<'saleNumber' | 'customer' | 'product' | 'amount' | 'status' | 'date'>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const handleAddSale = (newSale: any) => {
    console.log('➕ SimpleSalesPage: Yeni satış ekleniyor');
    // Eğer onUpsertSale varsa kullan (numara oluşturma için)
    if (onUpsertSale) {
      onUpsertSale(newSale);
      setShowSaleModal(false);
      setEditingSale(null);
    } else {
      // Fallback: eski yöntem
      setPendingSale(newSale);
      setShowConfirmationModal(true);
    }
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
    console.log('✏️ SimpleSalesPage: Satış düzenleniyor:', sale.id);
    setEditingSale(sale);
    setShowSaleModal(true);
  };

  const handleUpdateSale = (updatedSale: any) => {
    console.log('✏️ SimpleSalesPage: Satış güncelleniyor');
    // Eğer onUpsertSale varsa kullan
    if (onUpsertSale) {
      onUpsertSale(updatedSale);
      setEditingSale(null);
      setShowSaleModal(false);
    } else {
      // Fallback: eski yöntem
      const updatedSales = sales.map(sale => 
        sale.id === updatedSale.id ? updatedSale : sale
      );
      if (onSalesUpdate) {
        onSalesUpdate(updatedSales);
      }
      setEditingSale(null);
    }
  };

  const handleDeleteSale = (saleId: string) => {
    if (confirm(t('sales.deleteConfirm'))) {
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
      return formatCurrency(0);
    }
    return formatCurrency(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const totalSales = sales.reduce((sum, sale) => sum + toNumber(sale.amount ?? sale.total ?? (toNumber(sale.quantity) * toNumber(sale.unitPrice))), 0);
  const completedSales = sales.filter(sale => sale.status === 'completed').length;

  const filteredSales = sales
    .filter(sale => {
      const q = normalizeText(debouncedSearch);
      const firstItemName = (sale.items && sale.items.length > 0) ? (sale.items[0].productName || '') : '';
      const haystack = [
        sale.saleNumber,
        sale.customerName,
        sale.customerEmail,
        sale.productName,
        firstItemName,
        sale.status,
        sale.date,
        String(sale.amount ?? sale.total ?? toNumberSafe(sale.quantity) * toNumberSafe(sale.unitPrice))
      ].map(normalizeText).join(' ');

      const matchesSearch = q.length === 0 || haystack.includes(q);
      const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'saleNumber':
          return compareBy(a, b, x => x.saleNumber || `SAL-${x.id}`, sortDir, 'string');
        case 'customer':
          return compareBy(a, b, x => x.customerName || '', sortDir, 'string');
        case 'product': {
          const sel = (x: any) => (x.items && x.items.length > 0) ? (x.items[0].productName || '') : (x.productName || '');
          return compareBy(a, b, sel, sortDir, 'string');
        }
        case 'amount': {
          const sel = (x: any) => toNumberSafe(x.amount ?? x.total ?? toNumberSafe(x.quantity) * toNumberSafe(x.unitPrice));
          return compareBy(a, b, sel, sortDir, 'number');
        }
        case 'status':
          return compareBy(a, b, x => x.status, sortDir, 'string', defaultStatusOrderSales);
        case 'date':
        default:
          return compareBy(a, b, x => parseDateSafe(x.date), sortDir, 'date');
      }
    });

  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'amount' || column === 'date' ? 'desc' : 'asc');
    }
  };

  const SortIndicator = ({ active }: { active: boolean }) => (
    <span className="inline-block ml-1 text-gray-400">{active ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
  );

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: t('status.completed'), class: 'bg-green-100 text-green-800' },
      pending: { label: t('status.pending'), class: 'bg-yellow-100 text-yellow-800' },
      cancelled: { label: t('status.cancelled'), class: 'bg-red-100 text-red-800' }
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
    
    const updatedSale = { ...sale };
    
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
    console.log('📄 Fatura oluşturma talebi:', sale.id, sale.saleNumber);
    
    // Check if invoice already exists for this sale (iki türlü kontrol)
    const existingInvoice = invoices.find(invoice => 
      (invoice.saleId && String(invoice.saleId) === String(sale.id)) ||
      (sale.invoiceId && String(sale.invoiceId) === String(invoice.id))
    );

    if (existingInvoice) {
      console.log('✅ Mevcut fatura bulundu:', existingInvoice.invoiceNumber, existingInvoice);
      console.log('👤 Müşteri bilgisi:', existingInvoice.customer);
      // Open existing invoice in modal
      setViewingInvoice(existingInvoice);
      setShowInvoiceViewModal(true);
    } else {
      console.log('➕ Yeni fatura oluşturulacak');
      // Show confirmation modal
      setSelectedSaleForInvoice(sale);
      setShowInvoiceConfirmModal(true);
    }
  };

  const handleConfirmCreateInvoice = async () => {
    if (selectedSaleForInvoice) {
      const sale = selectedSaleForInvoice;
      
      // Satışın zaten faturası var mı kontrol et
      if (sale.invoiceId) {
        console.log('ℹ️ Bu satışın zaten faturası var:', sale.invoiceId);
        
        // Mevcut faturayı bul ve göster
        const existingInvoice = invoices.find(inv => inv.id === sale.invoiceId);
        if (existingInvoice) {
          setShowInvoiceConfirmModal(false);
          setSelectedSaleForInvoice(null);
          setViewingInvoice(existingInvoice);
          setShowInvoiceViewModal(true);
          return;
        }
      }
      
      console.log('🔍 Fatura oluşturma başladı:', {
        saleCustomerName: sale.customerName,
        saleCustomerEmail: sale.customerEmail,
        totalCustomers: customers.length,
        availableCustomers: customers.map(c => ({ id: c.id, name: c.name, email: c.email }))
      });
      
      const quantity = sale.quantity && sale.quantity > 0 ? sale.quantity : 1;
      const matchedProduct = sale.productId
        ? products.find(product => String(product.id) === String(sale.productId))
        : products.find(product => product.name.toLowerCase() === (sale.productName || '').toLowerCase());

      const fallbackUnitPrice = sale.unitPrice && sale.unitPrice > 0
        ? sale.unitPrice
        : matchedProduct?.unitPrice ?? 0;

      const calculatedTotal = sale.amount && sale.amount > 0 ? sale.amount : fallbackUnitPrice * quantity;
      const totalAmount = Number.isFinite(calculatedTotal) ? calculatedTotal : 0;
      
      // Satıştaki tutar ZATEN KDV DAHİL
      // Backend InvoiceModal mantığıyla çalışıyor: items'daki fiyatlar KDV DAHİL olmalı
      // Backend kendi KDV hesabını yapacak (totalWithTax / 1.18 = subtotal)
      
      // Birim fiyat KDV DAHİL olmalı (satıştaki gibi)
      const unitPriceWithTax = quantity > 0 ? totalAmount / quantity : fallbackUnitPrice;

      // Fatura türünü ürün kategorisine göre belirle
      const productCategory = (matchedProduct?.category || '').toLowerCase().trim();
      const productNameLower = (matchedProduct?.name || sale.productName || '').toLowerCase().trim();
      
      console.log('🔍 FATURA TÜRÜ DEBUG:', {
        'Ürün Adı': matchedProduct?.name || sale.productName,
        'Kategori (Raw)': matchedProduct?.category,
        'Kategori (Lower)': productCategory,
        'Ürün Adı (Lower)': productNameLower,
        'matchedProduct': matchedProduct
      });
      
      // VARSAYILAN: Ürün Satışı (Sadece hizmet kategorisindeki ürünler "Hizmet Satışı" olmalı)
      let invoiceType: 'product' | 'service' = 'product';
      
      // Hizmet kategorileri - SADECE bunlar "Hizmet Satışı" olacak
      const serviceCategories = ['hizmet', 'danışmanlık', 'danismanlik', 'eğitim', 'egitim', 'reklam', 'pazarlama'];
      
      // Önce kategoriyi kontrol et
      if (serviceCategories.some(cat => productCategory.includes(cat))) {
        invoiceType = 'service';
        console.log('✅ Kategori kontrolünden HİZMET SATIŞI belirlendi');
      } else if (productCategory.length === 0) {
        // Kategori yoksa ürün adına bak
        if (serviceCategories.some(cat => productNameLower.includes(cat))) {
          invoiceType = 'service';
          console.log('✅ Ürün adından HİZMET SATIŞI belirlendi');
        } else {
          console.log('✅ ÜRÜN SATIŞI belirlendi (varsayılan - kategori yok)');
        }
      } else {
        console.log('✅ ÜRÜN SATIŞI belirlendi (varsayılan - hizmet değil)');
      }

      console.log('🎯 SONUÇ: invoiceType =', invoiceType);

      // Check if customers list is empty
      if (customers.length === 0) {
        console.error('❌ Müşteri listesi boş! Önce müşteri ekleyin.');
        alert('Fatura oluşturmak için önce en az bir müşteri eklemelisiniz.\n\n"Müşteriler" sayfasından yeni müşteri ekleyebilirsiniz.');
        setShowInvoiceConfirmModal(false);
        return;
      }

      // Find customer by name or email (flexible matching)
      const customerNameLower = sale.customerName?.toLowerCase().trim() || '';
      const customerEmailLower = sale.customerEmail?.toLowerCase().trim() || '';
      
      const matchedCustomer = customers.find(c => {
        const nameLower = c.name?.toLowerCase().trim() || '';
        const emailLower = c.email?.toLowerCase().trim() || '';
        
        // Check exact match or partial match
        return nameLower === customerNameLower ||
               emailLower === customerEmailLower ||
               nameLower.includes(customerNameLower) ||
               customerNameLower.includes(nameLower);
      });

      console.log('🔍 Müşteri eşleştirme sonucu:', {
        found: !!matchedCustomer,
        matchedCustomer: matchedCustomer ? { id: matchedCustomer.id, name: matchedCustomer.name } : null
      });

      // If no match found, use first customer as fallback
      const customerToUse = matchedCustomer || customers[0];
      
      if (!matchedCustomer) {
        console.warn('⚠️ Tam eşleşme bulunamadı, ilk müşteri kullanılıyor:', {
          fallbackCustomer: { id: customerToUse.id, name: customerToUse.name }
        });
      }

      const invoiceData = {
        saleId: sale.id, // Satış ID'sini ekle
        customerId: String(customerToUse.id), // Backend için customerId gerekli
        type: invoiceType, // Fatura türü (product/service)
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'sent',
        lineItems: [
          {
            productId: matchedProduct?.id,
            productName: matchedProduct?.name || sale.productName,
            description: matchedProduct?.name || sale.productName,
            quantity,
            unitPrice: unitPriceWithTax, // KDV DAHİL fiyat (InvoiceModal ile tutarlı)
            total: totalAmount, // KDV DAHİL toplam (InvoiceModal ile tutarlı)
            taxRate: matchedProduct?.taxRate ?? 18, // Ürünün KDV oranı veya varsayılan %18
          },
        ],
        // subtotal ve taxAmount'u backend hesaplayacak (App.tsx'deki mantık)
        notes: 'Bu fatura ' + (sale.saleNumber || ('SAL-' + sale.id)) + ' numaralı satıştan oluşturulmuştur.',
      };

      console.log('📄 Fatura data hazır:', {
        customerId: invoiceData.customerId,
        customerName: sale.customerName,
        saleId: invoiceData.saleId,
        totalWithTax: totalAmount,
        unitPriceWithTax: unitPriceWithTax,
        quantity: quantity,
        lineItems: invoiceData.lineItems
      });

      try {
        if (onCreateInvoice) {
          // Faturayı oluştur ve ID'sini al
          const createdInvoice = await onCreateInvoice(invoiceData);
          
          // Eğer invoice oluşturuldu ve ID varsa
          if (createdInvoice && createdInvoice.id) {
            console.log('✅ Fatura oluşturuldu, satış güncelleniyor:', {
              invoiceId: createdInvoice.id,
              saleId: sale.id
            });
            
            // Satışı invoiceId ile güncelle
            const updatedSale = { ...sale, invoiceId: createdInvoice.id };
            const updatedSales = sales.map(s => s.id === sale.id ? updatedSale : s);
            
            if (onSalesUpdate) {
              onSalesUpdate(updatedSales);
            }
            
            console.log('🔗 Satış-Fatura ilişkisi kuruldu');
            
            // Başarılı olduktan sonra modal'ı kapat
            setShowInvoiceConfirmModal(false);
            setSelectedSaleForInvoice(null);
          } else {
            console.error('❌ Fatura oluşturuldu ama ID alınamadı:', createdInvoice);
            // Modal açık kalsın, kullanıcı tekrar denesin
          }
        }
      } catch (error) {
        console.error('❌ Fatura oluşturma hatası:', error);
        // Hata durumunda modal açık kalır, kullanıcı tekrar deneyebilir
        return;
      }
    }
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
              {t('sidebar.sales')}
            </h1>
            <p className="text-gray-600">{t('sales.subtitle')}</p>
          </div>
          <button
            onClick={() => {
              console.log('➕ SimpleSalesPage: Yeni Satış butonu tıklandı, editingSale temizleniyor');
              setEditingSale(null);
              setShowSaleModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('sales.newSale')}</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-green-600">{t('sales.totalSales')}</p>
                <p className="text-xl font-bold text-green-700">{formatAmount(totalSales)}</p>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-blue-600">{t('sales.totalSalesCount')}</p>
                <p className="text-xl font-bold text-blue-700">{sales.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center">
              <User className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-purple-600">{t('sales.completed')}</p>
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
            <h3 className="text-lg font-semibold text-gray-900">{t('sales.salesList')}</h3>
            <p className="text-sm text-gray-500">
              {sales.length} {t('sales.salesRegistered')}
            </p>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={t('sales.search')}
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
              <option value="all">
                {i18n.language === 'tr' ? 'Tüm Durumlar' : 
                 i18n.language === 'en' ? 'All Statuses' :
                 i18n.language === 'de' ? 'Alle Status' :
                 i18n.language === 'fr' ? 'Tous les Statuts' : 'All Statuses'}
              </option>
              <option value="completed">{t('status.completed')}</option>
              <option value="pending">{t('status.pending')}</option>
              <option value="cancelled">{t('status.cancelled')}</option>
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
                {searchTerm || statusFilter !== 'all' ? t('sales.noSalesFound') : t('sales.noSales')}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? t('sales.noSalesFoundDesc')
                  : t('sales.noSalesDesc')
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <button
                  onClick={() => {
                    console.log('➕ SimpleSalesPage: Yeni Satış butonu (boş liste) tıklandı');
                    setEditingSale(null);
                    setShowSaleModal(true);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {t('sales.createFirstSale')}
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th onClick={() => toggleSort('saleNumber')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                      {t('sales.sale')}<SortIndicator active={sortBy==='saleNumber'} />
                    </th>
                    <th onClick={() => toggleSort('customer')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                      {t('sales.customer')}<SortIndicator active={sortBy==='customer'} />
                    </th>
                    <th onClick={() => toggleSort('product')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                      {t('sales.productService')}<SortIndicator active={sortBy==='product'} />
                    </th>
                    <th onClick={() => toggleSort('amount')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                      {t('sales.amount')}<SortIndicator active={sortBy==='amount'} />
                    </th>
                    <th onClick={() => toggleSort('status')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                      {t('sales.status')}<SortIndicator active={sortBy==='status'} />
                    </th>
                    <th onClick={() => toggleSort('date')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none">
                      {t('sales.date')}<SortIndicator active={sortBy==='date'} />
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('sales.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSales.map((sale) => (
                    <tr key={`${sale.id}-${sale.saleNumber || ''}`} className="hover:bg-gray-50 transition-colors">
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
                                title={t('sales.viewSale')}
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
                        {sale.items && sale.items.length > 0 ? (
                          <div>
                            <div className="text-sm text-gray-900">
                              {sale.items[0].productName}
                              {sale.items.length > 1 && (
                                <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  +{sale.items.length - 1} ürün
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {sale.items.map((item, idx) => (
                                <span key={idx}>
                                  {item.quantity} x {formatAmount(item.unitPrice)}
                                  {idx < sale.items!.length - 1 && ', '}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm text-gray-900">{sale.productName}</div>
                            {sale.quantity && sale.unitPrice && (
                              <div className="text-xs text-gray-500">
                                {sale.quantity} x {formatAmount(sale.unitPrice)}
                              </div>
                            )}
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
                              <option value="completed">{t('status.completed')}</option>
                              <option value="pending">{t('status.pending')}</option>
                              <option value="cancelled">{t('status.cancelled')}</option>
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
                            title={t('sales.editSale')}
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
                            {sale.paymentMethod === 'cash' ? t('common.cash') :
                             sale.paymentMethod === 'card' ? t('common.card') :
                             sale.paymentMethod === 'transfer' ? t('common.transfer') : t('common.check')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => handleViewSale(sale)}
                            className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title={t('sales.viewSale')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEditSale(sale)}
                            className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title={t('sales.editSale')}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => onDownloadSale?.(sale)}
                            className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title={t('sales.download')}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleCreateInvoiceFromSale(sale)}
                            className={`p-1 rounded transition-colors ${
                              invoices.some(inv => 
                                (inv.saleId && String(inv.saleId) === String(sale.id)) ||
                                (sale.invoiceId && String(sale.invoiceId) === String(inv.id))
                              )
                                ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 bg-blue-50'
                                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                            title={
                              invoices.some(inv => 
                                (inv.saleId && String(inv.saleId) === String(sale.id)) ||
                                (sale.invoiceId && String(sale.invoiceId) === String(inv.id))
                              )
                                ? t('sales.viewSale')
                                : t('sales.createInvoice')
                            }
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteSale(sale.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={t('sales.deleteSale')}
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
        onClose={() => {
          console.log('🚪 SimpleSalesPage: Modal kapatılıyor, editingSale temizleniyor');
          setShowSaleModal(false);
          setEditingSale(null);
        }}
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
                  <h2 className="text-xl font-semibold text-gray-900">{t('sales.saleCompleted')}</h2>
                  <p className="text-sm text-gray-500">{t('sales.createInvoiceQuestion')}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Sale Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-gray-900 mb-2">{t('sales.saleSummary')}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('sales.customer')}:</span>
                    <span className="font-medium">{pendingSale.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('sales.productService')}:</span>
                    <span className="font-medium">{pendingSale.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('sales.amount')}:</span>
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
                      {t('sales.createInvoiceQuestion')}
                    </p>
                    <p className="text-xs text-blue-600">
                      {t('sales.invoiceWillBeDownloaded')}
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
            // PDF generator için customer bilgilerini tamamla
            const invoiceWithCustomer = {
              ...invoice,
              customerName: invoice.customer?.name || invoice.customerName || 'Müşteri Yok',
              customerEmail: invoice.customer?.email || invoice.customerEmail || '',
              customerAddress: invoice.customer?.address || invoice.customerAddress || '',
            };
            generateInvoicePDF(invoiceWithCustomer as any);
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
                  <h2 className="text-xl font-semibold text-gray-900">{t('invoice.createInvoice')}</h2>
                  <p className="text-sm text-gray-500">{t('sales.createInvoiceQuestion')}</p>
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
                      {t('sales.saleSummary')}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>{t('sales.customer')}:</strong> {selectedSaleForInvoice.customerName}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>{t('sales.productService')}:</strong> {selectedSaleForInvoice.productName}
                    </p>
                    <p className="text-xs text-gray-600">
                      <strong>{t('sales.amount')}:</strong> {formatAmount(selectedSaleForInvoice.amount)}
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
                      {t('sales.confirmInvoiceCreation')}
                    </p>
                    <p className="text-xs text-blue-600">
                      {t('sales.invoiceWillOpen')}
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








import React, { useState } from 'react';
import { X, FileText, Calendar, User, Package, Loader2 } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { getProducts, type Product } from '../api/products';
import { productCategoriesApi } from '../api/product-categories';

interface Sale {
  id: string;
  saleNumber?: string;
  customerName: string;
  customerEmail?: string;
  productName: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  // Backend'ten gelen alanlar (varsa)
  subtotal?: number; // KDV hariç toplam
  taxAmount?: number; // KDV tutarı
  total?: number; // KDV dahil toplam
  productId?: string;
  items?: Array<{ productId?: string; productName?: string; description?: string; quantity?: number; unitPrice?: number; taxRate?: number; total?: number }>; // satış kalemleri
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
  const [productsCache, setProductsCache] = React.useState<Product[] | null>(null);
  const [categoriesCache, setCategoriesCache] = React.useState<Array<{ name: string; taxRate: number }> | null>(null);
  const [loadingMeta, setLoadingMeta] = React.useState(false);

  // Modal açıldığında ürün ve kategori verilerini hafızaya al (localStorage'a güvenme)
  React.useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      if (!isOpen) return;
      setLoadingMeta(true);
      try {
        const [prods, cats] = await Promise.allSettled([
          getProducts(),
          productCategoriesApi.getAll().then((x) => x.map((c) => ({ name: c.name, taxRate: Number(c.taxRate) }))),
        ]);
        if (cancelled) return;
        if (prods.status === 'fulfilled') setProductsCache(prods.value || []);
        if (cats.status === 'fulfilled') setCategoriesCache(cats.value || []);
      } catch {}
      finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }
    loadMeta();
    return () => { cancelled = true; };
  }, [isOpen]);
  
  // Ürün KDV oranını çöz (önce bellek cache'i, sonra localStorage; kategori ismi ile eşleşme)
  const resolveProductTaxRate = React.useCallback((productId?: string, fallback?: number, productNameHint?: string) => {
    try {
      // 1) Bellek cache (API'den)
      if (Array.isArray(productsCache) && productsCache.length) {
        let p = productsCache.find((x) => String(x.id) === String(productId));
        if (!p && productNameHint) {
          const nameLc = String(productNameHint).trim().toLowerCase();
          p = productsCache.find((x) => String(x.name || '').trim().toLowerCase() === nameLc)
            || productsCache.find((x) => String(x.name || '').toLowerCase().includes(nameLc));
        }
        if (p) {
          const override = p.categoryTaxRateOverride;
          if (override !== undefined && override !== null && Number.isFinite(Number(override))) return Number(override);
          // Kategori verisi
          if (p.category && Array.isArray(categoriesCache)) {
            const cat = categoriesCache.find((c) => String(c.name).toLowerCase() === String(p.category).toLowerCase());
            if (cat && Number.isFinite(Number(cat.taxRate))) return Number(cat.taxRate);
          }
          if (p.taxRate !== undefined && p.taxRate !== null && Number.isFinite(Number(p.taxRate))) return Number(p.taxRate);
        }
      }

      // 2) localStorage fallback (mevcut davranış)
      const tid = (localStorage.getItem('tenantId') || '') as string;
      const key = tid ? `products_cache_${tid}` : 'products_cache';
      const raw = localStorage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          let p = arr.find((x: any) => String(x.id) === String(productId));
          if (!p && productNameHint) {
            const nameLc = String(productNameHint).trim().toLowerCase();
            p = arr.find((x: any) => String(x.name || '').trim().toLowerCase() === nameLc);
            if (!p) {
              p = arr.find((x: any) => String(x.name || '').toLowerCase().includes(nameLc));
            }
          }
          if (p) {
            // Kategori override > kategori oranı > ürün.taxRate
            const override = p.categoryTaxRateOverride;
            if (override !== undefined && override !== null && Number.isFinite(Number(override))) return Number(override);
            if (p.category && Array.isArray(categoriesCache)) {
              const cat = categoriesCache.find((c) => String(c.name).toLowerCase() === String(p.category).toLowerCase());
              if (cat && Number.isFinite(Number(cat.taxRate))) return Number(cat.taxRate);
            }
            const v = Number(p.taxRate);
            if (Number.isFinite(v) && v >= 0) return v;
          }
        }
      }
    } catch {}
    const fb = Number(fallback);
    return Number.isFinite(fb) && fb >= 0 ? fb : 18;
  }, [productsCache, categoriesCache]);
  
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
    const qty = Number(sale.quantity || 1);
    // Unit price KDV HARIÇ olmalı; yoksa amount/subtotal üzerinden tahmin et
    let unitPriceExcl = Number(sale.unitPrice || 0);
    if (!Number.isFinite(unitPriceExcl) || unitPriceExcl <= 0) {
      const subtotalGuess = Number((sale as any).subtotal ?? 0);
      if (Number.isFinite(subtotalGuess) && subtotalGuess > 0 && qty > 0) {
        unitPriceExcl = subtotalGuess / qty;
      } else if (Number.isFinite(sale.amount) && qty > 0) {
        // Varsayılan oran bilinmiyorsa %18 varsayımıyla yaklaşıkla (son çare, backend yine hesaplayacak)
        unitPriceExcl = (sale.amount / 1.18) / qty;
      }
    }

    // Items listesi varsa her bir kalemi KDV hariç şekilde geçir; yoksa tek satır oluştur
    const originalItems: any[] = Array.isArray((sale as any).items) ? (sale as any).items : [];
    const lineItems = (originalItems.length > 0)
      ? originalItems.map((it) => {
          const q = Number(it.quantity) || 1;
          const up = Number(it.unitPrice) || unitPriceExcl;
          const tx = resolveProductTaxRate(String(it.productId || (sale as any).productId), undefined, it.productName || it.description || sale.productName);
          return {
            productId: it.productId ?? sale.productId,
            description: it.productName || it.description || sale.productName,
            quantity: q,
            unitPrice: up,
            taxRate: Number.isFinite(tx) && tx >= 0 ? tx : undefined,
            total: q * up,
          };
        })
      : [{
          productId: (sale as any).productId,
          description: sale.productName,
          quantity: qty,
          unitPrice: unitPriceExcl,
          total: qty * unitPriceExcl,
          taxRate: resolveProductTaxRate((sale as any).productId, Number((originalItems[0]||{} as any).taxRate), sale.productName),
        }];

    // Preview subtotal (KDV hariç)
    const previewSubtotal = (() => {
      const explicit = Number((sale as any).subtotal);
      if (Number.isFinite(explicit) && explicit > 0) return explicit;
      return lineItems.reduce((sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0), 0);
    })();
    // Preview tax: her kalemi ürün KDV oranıyla hesapla (sale.taxAmount'ı kullanma)
    const previewTax = lineItems.reduce((sum, li) => {
      const q = Number(li.quantity) || 0;
      const up = Number(li.unitPrice) || 0;
      const rate = Number((li as any).taxRate);
      const r = Number.isFinite(rate) && rate >= 0 ? rate : resolveProductTaxRate(String(li.productId));
      return sum + q * up * (r / 100);
    }, 0);
    const previewTotal = previewSubtotal + previewTax;

    const newInvoice = {
      saleId: sale.id,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: invoiceData.dueDate,
      status: invoiceData.status,
      notes: invoiceData.notes.trim(),
      // Satış verisinden alınacak bilgiler
      customerName: sale.customerName,
      customerEmail: sale.customerEmail || '',
      type: 'service',
      items: lineItems.map(li => ({
        productId: li.productId,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        taxRate: li.taxRate, // varsa explicit gönder
      })),
      lineItems: lineItems.map(li => ({
        productId: li.productId,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        taxRate: li.taxRate,
      })),
      subtotal: previewSubtotal,
      taxAmount: previewTax,
      total: previewTotal || previewSubtotal + previewTax,
    };

    onSave(newInvoice);
    onClose();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  if (!isOpen || !sale) return null;

  // --- ÖNİZLEME HESAPLARI (render sırasında gösterim için) ---
  const qtyPreview = Number(sale.quantity || 1);
  let unitPriceExclPreview = Number(sale.unitPrice || 0);
  if (!Number.isFinite(unitPriceExclPreview) || unitPriceExclPreview <= 0) {
    const subPrev = Number((sale as any).subtotal ?? 0);
    if (Number.isFinite(subPrev) && subPrev > 0 && qtyPreview > 0) {
      unitPriceExclPreview = subPrev / qtyPreview;
    } else if (Number.isFinite(sale.amount) && qtyPreview > 0) {
      unitPriceExclPreview = (sale.amount / 1.18) / qtyPreview; // son çare varsayım
    }
  }
  const originalPreviewItems: any[] = Array.isArray((sale as any).items) ? (sale as any).items : [];
  const previewLineItems = (originalPreviewItems.length > 0)
    ? originalPreviewItems.map((it) => {
        const q = Number(it.quantity) || 1;
        const up = Number(it.unitPrice) || unitPriceExclPreview;
        const tx = resolveProductTaxRate(String(it.productId || (sale as any).productId), undefined, it.productName || it.description || sale.productName);
        return { q, up, txRate: Number.isFinite(tx) && tx >= 0 ? tx : undefined };
      })
    : [{ q: qtyPreview, up: unitPriceExclPreview, txRate: resolveProductTaxRate((sale as any).productId, Number((originalPreviewItems[0]||{} as any).taxRate), sale.productName) }];

  const previewSubtotalUi = (() => {
    const explicit = Number((sale as any).subtotal);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    return previewLineItems.reduce((sum, li) => sum + li.q * li.up, 0);
  })();
  const previewTaxUi = previewLineItems.reduce((sum, li) => {
    const eff = Number(li.txRate);
    const rate = Number.isFinite(eff) && eff >= 0 ? eff : resolveProductTaxRate(String((sale as any)?.productId), undefined, (sale as any)?.productName);
    return sum + (li.q * li.up) * ((Number(rate) || 18) / 100);
  }, 0);
  const previewTotalUi = previewSubtotalUi + previewTaxUi;

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
                <span className="text-gray-600">{t('common.customer', { defaultValue: 'Müşteri' })}:</span>
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
                <span className="text-gray-600">Tutar (KDV Hariç):</span>
                <span className="ml-2 font-bold text-green-600" title={`Orijinal satış tutarı (KDV dahil olabilir): ${formatCurrency(sale.amount)}`}>
                  {loadingMeta ? (
                    <span className="inline-flex items-center text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin mr-1" /> —
                    </span>
                  ) : (
                    formatCurrency(previewSubtotalUi)
                  )}
                </span>
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
                  <span>{formatCurrency(previewSubtotalUi)}</span>
                </div>
                <div className="flex justify-between">
                  <span>KDV:</span>
                  <span>
                    {loadingMeta ? (
                      <span className="inline-flex items-center text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin mr-1" /> —
                      </span>
                    ) : (
                      formatCurrency(previewTaxUi)
                    )}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t border-blue-300 pt-2">
                  <span>Toplam:</span>
                  <span>{formatCurrency(previewSubtotalUi + previewTaxUi)}</span>
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
            disabled={!invoiceData.dueDate || loadingMeta}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('invoices.createInvoice')}
          </button>
        </div>
      </div>
    </div>
  );
}
import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, FileText, Calendar, User, Package, Loader2 } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { getProducts, type Product } from '../api/products';
import StockWarningModal from './StockWarningModal';
import { productCategoriesApi } from '../api/product-categories';
import { readLegacyTenantId, safeLocalStorage } from '../utils/localStorageSafe';
import type { Invoice, Sale, ProductCategory } from '../types';
import { logger } from '../utils/logger';
import { toNumberSafe } from '../utils/sortAndSearch';
import {
  DEFAULT_TAX_RATE,
  ensureLineItemTaxRate,
  calculateInvoiceTotals,
  normalizeTaxRateInput,
} from '../utils/tax';

type SaleItemWithMeta = Sale['items'] extends Array<infer T>
  ? T & { description?: string; taxRate?: number }
  : {
      productId?: string;
      productName?: string;
      description?: string;
      quantity?: number;
      unitPrice?: number;
      taxRate?: number;
      total?: number;
    };

type InvoiceLineItemDraft = {
  productId?: string | number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  total: number;
};

export type InvoiceDraftPayload = {
  saleId: string;
  customerId?: string;
  issueDate: string;
  dueDate: string;
  status: Invoice['status'];
  notes: string;
  customerName: string;
  customerEmail?: string;
  type: 'product' | 'service';
  items: InvoiceLineItemDraft[];
  lineItems: InvoiceLineItemDraft[];
  subtotal: number;
  taxAmount: number;
  total: number;
  discountAmount?: number;
};

type InvoiceFormState = {
  dueDate: string;
  status: Invoice['status'];
  notes: string;
};

type PricingSnapshot = {
  lineItems: InvoiceLineItemDraft[];
  subtotal: number;
  tax: number;
  total: number;
};

type StockWarningState = {
  product: Product;
  requested: number;
  available: number;
};

type CategoryMeta = {
  id?: string;
  name?: string;
  parentId?: string | null;
  taxRate?: number | null;
};

interface InvoiceFromSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoiceData: InvoiceDraftPayload) => void;
  sale: Sale | null;
}

export default function InvoiceFromSaleModal({
  isOpen,
  onClose,
  onSave,
  sale
}: InvoiceFromSaleModalProps) {
  const { formatCurrency } = useCurrency();
  const { t, i18n } = useTranslation();
  const [productsCache, setProductsCache] = useState<Product[] | null>(null);
  const [categoriesCache, setCategoriesCache] = useState<CategoryMeta[] | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [stockWarning, setStockWarning] = useState<StockWarningState | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoiceFormState>({
    dueDate: '',
    status: 'draft',
    notes: '',
  });

  const fallbackLocale = typeof window !== 'undefined' && window.navigator?.language
    ? window.navigator.language
    : 'tr-TR';
  const locale = useMemo(() => {
    return safeLocalStorage.getItem('language') || i18n.language || fallbackLocale;
  }, [i18n.language, fallbackLocale]);

  // Modal açıldığında ürün ve kategori verilerini hafızaya al (localStorage'a güvenme)
  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      if (!isOpen) return;
      setLoadingMeta(true);
      try {
        const [prods, cats] = await Promise.allSettled([
          getProducts(),
          productCategoriesApi.getAll().then((collection) =>
            collection.map((c) => ({
              id: c.id,
              name: c.name,
              parentId: c.parentId ?? null,
              taxRate: normalizeTaxRateInput(c.taxRate),
            }))
          ),
        ]);
        if (cancelled) return;
        if (prods.status === 'fulfilled') setProductsCache(prods.value || []);
        if (cats.status === 'fulfilled') setCategoriesCache(cats.value || []);
      } catch (error) {
        logger.warn('invoiceFromSale.metaLoad.failed', error);
      }
      finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }

    loadMeta();
    return () => { cancelled = true; };
  }, [isOpen]);
  
  // Ürün KDV oranını çöz (önce bellek cache'i, sonra localStorage; kategori ismi ile eşleşme)
  const legacyProducts = useMemo(() => {
    try {
      const tenantId = readLegacyTenantId();
      const key = tenantId ? `products_cache_${tenantId}` : 'products_cache';
      const raw = safeLocalStorage.getItem(key);
      if (!raw) {
        return [] as Partial<Product>[];
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as Partial<Product>[];
      }
    } catch (error) {
      logger.warn('invoiceFromSale.productsCache.parseFailed', error);
    }
    return [] as Partial<Product>[];
  }, []);

  const resolveLineItemWithTax = useCallback(
    (item: InvoiceLineItemDraft): InvoiceLineItemDraft => {
      const primary = ensureLineItemTaxRate(item, {
        products: productsCache ?? undefined,
        categories: (categoriesCache ?? undefined) as unknown as ProductCategory[] | undefined,
        defaultRate: DEFAULT_TAX_RATE,
      });
      if (normalizeTaxRateInput(primary.taxRate) !== null) {
        return primary;
      }
      if (legacyProducts.length) {
        return ensureLineItemTaxRate(primary, {
          products: legacyProducts as Product[],
          categories: (categoriesCache ?? undefined) as unknown as ProductCategory[] | undefined,
          defaultRate: DEFAULT_TAX_RATE,
        });
      }
      return primary;
    },
    [productsCache, categoriesCache, legacyProducts],
  );

  // Reset form when modal opens
  useEffect(() => {
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

  const pricingDetails = useMemo<PricingSnapshot>(() => {
    if (!sale) {
      return { lineItems: [], subtotal: 0, tax: 0, total: 0 };
    }

    const saleItems: SaleItemWithMeta[] = Array.isArray(sale.items) ? sale.items : [];
    const quantityFallback = Math.max(1, toNumberSafe(sale.quantity) || 1);
    let unitPriceExcl = toNumberSafe(sale.unitPrice);

    if (unitPriceExcl <= 0 && quantityFallback > 0) {
      const subtotalGuess = toNumberSafe(sale.subtotal);
      if (subtotalGuess > 0) {
        unitPriceExcl = subtotalGuess / quantityFallback;
      } else {
        const grossAmount = toNumberSafe(sale.amount);
        if (grossAmount > 0) {
          unitPriceExcl = (grossAmount / 1.18) / quantityFallback;
        }
      }
    }

    const fallbackDescription = sale.productName || t('products.name', 'Product');
    const normalizedLineItems: InvoiceLineItemDraft[] = (saleItems.length > 0
      ? saleItems
      : [{
          productId: sale.productId,
          productName: fallbackDescription,
          quantity: quantityFallback,
          unitPrice: unitPriceExcl,
          description: fallbackDescription,
        }]
    ).map((item) => {
      const quantity = Math.max(1, toNumberSafe(item.quantity) || quantityFallback);
      const normalizedUnitPrice = toNumberSafe(item.unitPrice);
      const unitPrice = normalizedUnitPrice > 0 ? normalizedUnitPrice : unitPriceExcl;
      const description = item.productName || item.description || fallbackDescription;
      const base: InvoiceLineItemDraft = {
        productId: item.productId ?? sale.productId,
        productName: description,
        description,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
        taxRate: normalizeTaxRateInput(item.taxRate) ?? undefined,
      };
      return resolveLineItemWithTax(base);
    });

    const { subtotal, taxAmount: tax, total } = calculateInvoiceTotals(
      normalizedLineItems,
      0,
      DEFAULT_TAX_RATE,
    );

    return {
      lineItems: normalizedLineItems,
      subtotal,
      tax,
      total,
    };
  }, [sale, resolveLineItemWithTax, t]);

  const handleSave = () => {
    if (!sale) return;

    if (!invoiceData.dueDate) {
      window.alert(t('validation.dueDateRequired'));
      return;
    }

    if (!pricingDetails.lineItems.length) {
      logger.warn('invoiceFromSale.noLineItems', { saleId: sale.id });
      window.alert(t('invoices.noLineItemsError', { defaultValue: 'Faturaya aktarılacak satır bulunamadı.' }));
      return;
    }

    try {
      const inventory = Array.isArray(productsCache) ? productsCache : [];
      for (const item of pricingDetails.lineItems) {
        let product = inventory.find((p) => String(p.id) === String(item.productId));
        if (!product && item.description) {
          const nameLc = item.description.toLowerCase();
          product = inventory.find((p) => String(p.name || '').trim().toLowerCase() === nameLc)
            || inventory.find((p) => String(p.name || '').toLowerCase().includes(nameLc));
        }
        if (product) {
          const available = toNumberSafe((product as Partial<Product>).stock ?? (product as Partial<Product>).stockQuantity);
          const requested = item.quantity;
          if (available > 0 && requested > available) {
            logger.info('invoiceFromSale.stockWarning', {
              saleId: sale.id,
              productId: product.id,
              requested,
              available,
            });
            setStockWarning({ product, requested, available });
            return;
          }
        }
      }
    } catch (error) {
      logger.warn('invoiceFromSale.stockCheck.error', error);
    }

    const normalizedLineItems = pricingDetails.lineItems.map((item) => ({ ...item }));
    const discountAmount = Math.max(0, toNumberSafe(sale.discountAmount));
    const payload: InvoiceDraftPayload = {
      saleId: sale.id,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: invoiceData.dueDate,
      status: invoiceData.status,
      notes: invoiceData.notes.trim(),
      customerName: sale.customerName,
      customerEmail: sale.customerEmail,
      type: 'service',
      items: normalizedLineItems,
      lineItems: normalizedLineItems,
      subtotal: pricingDetails.subtotal,
      taxAmount: pricingDetails.tax,
      total: pricingDetails.total,
      discountAmount,
    };

    logger.info('invoiceFromSale.save.request', {
      saleId: sale.id,
      lineItemCount: normalizedLineItems.length,
      subtotal: pricingDetails.subtotal,
    });

    try {
      onSave(payload);
      logger.info('invoiceFromSale.save.success', { saleId: sale.id });
      onClose();
    } catch (error) {
      logger.error('invoiceFromSale.save.failed', error);
    }
  };

  const formatDate = useCallback((value?: string | number | Date | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(locale);
  }, [locale]);

  if (!isOpen || !sale) return null;

  return (
    <>
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
                <span className="text-gray-600">{t('invoices.customer')}:</span>
                <span className="ml-2 font-medium">{sale.customerName}</span>
              </div>
              
              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-gray-600">{t('sales.saleDate')}:</span>
                <span className="ml-2 font-medium">{formatDate(sale.date)}</span>
              </div>
              
              <div className="flex items-center text-sm">
                <Package className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-gray-600">{t('sales.productService', { defaultValue: t('products.name', 'Product') })}:</span>
                <span className="ml-2 font-medium">{sale.productName}</span>
              </div>
              
              <div className="flex items-center text-sm">
                <span className="text-gray-600">{t('invoices.amountExclTax', { defaultValue: 'Tutar (KDV Hariç)' })}:</span>
                <span className="ml-2 font-bold text-green-600" title={`Orijinal satış tutarı (KDV dahil olabilir): ${formatCurrency(toNumberSafe(sale.amount))}`}>
                  {loadingMeta ? (
                    <span className="inline-flex items-center text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin mr-1" /> —
                    </span>
                  ) : (
                    formatCurrency(pricingDetails.subtotal)
                  )}
                </span>
              </div>
            </div>

            {sale.saleNumber && (
              <div className="mt-3 text-sm text-gray-600">
                <strong>{t('sales.saleNumber')}:</strong> {sale.saleNumber}
              </div>
            )}
          </div>

          {/* Fatura Bilgileri */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">{t('invoices.invoiceInfo', { defaultValue: 'Fatura Bilgileri' })}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  {t('common.dueDate')} *
                </label>
                <input
                  type="date"
                  value={invoiceData.dueDate}
                  onChange={(e) => setInvoiceData((prev) => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('invoices.invoiceStatus', { defaultValue: 'Invoice Status' })}
                </label>
                <select
                  value={invoiceData.status}
                  onChange={(e) => setInvoiceData((prev) => ({ ...prev, status: e.target.value as Invoice['status'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="draft">{t('status.draft', { defaultValue: 'Taslak' })}</option>
                  <option value="sent">{t('status.sent', { defaultValue: 'Gönderildi' })}</option>
                  <option value="paid">{t('status.paid', { defaultValue: 'Ödendi' })}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('invoices.invoiceNotes', { defaultValue: 'Fatura Notları' })}
              </label>
              <textarea
                value={invoiceData.notes}
                onChange={(e) => setInvoiceData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('invoices.notesPlaceholder', { defaultValue: 'Fatura ile ilgili notlar...' })}
              />
            </div>

            {/* Fatura Tutarları */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-medium text-gray-900 mb-3">{t('invoices.invoiceTotals', { defaultValue: 'Invoice Totals' })}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{t('invoice.subtotal')}</span>
                    <span>{formatCurrency(pricingDetails.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('invoice.vat')}</span>
                  <span>
                    {loadingMeta ? (
                      <span className="inline-flex items-center text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin mr-1" /> —
                      </span>
                    ) : (
                        formatCurrency(pricingDetails.tax)
                    )}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t border-blue-300 pt-2">
                  <span>{t('invoice.grandTotal')}</span>
                    <span>{formatCurrency(pricingDetails.total)}</span>
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
            {t('common.cancel')}
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
    {stockWarning && (
      <StockWarningModal
        isOpen={true}
        product={stockWarning.product}
        requested={stockWarning.requested}
        available={stockWarning.available}
        onClose={() => setStockWarning(null)}
      />
    )}
    </>
  );
}
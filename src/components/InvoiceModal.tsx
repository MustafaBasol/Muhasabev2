import React, { useState } from 'react';
import { X, Plus, Trash2, Calculator, Search, Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolveStatusLabel } from '../utils/status';
import type {
  Customer,
  Invoice as InvoiceRecord,
  InvoiceItem as InvoiceItemType,
  Product,
  ProductCategory,
} from '../types';
import { productCategoriesApi } from '../api/product-categories';
import StockWarningModal from './StockWarningModal';
import { logger } from '../utils/logger';

type InvoiceStatus = InvoiceRecord['status'] | 'cancelled';
type InvoiceKind = 'product' | 'return';

type InvoiceLineItem = InvoiceItemType & {
  id: string;
  unit?: string;
};

type RawInvoiceItem = (InvoiceItemType & { unit?: string }) | InvoiceLineItem;

type InvoiceLike = Partial<InvoiceRecord> & {
  customer?: Customer;
  items?: InvoiceLineItem[];
  originalInvoiceId?: string | number;
  refundedInvoiceId?: string | number;
  _isReturnInvoice?: boolean;
  type?: InvoiceKind;
  customerId?: string | number;
};

type InvoicePayload = {
  id?: string;
  createdAt?: string;
  originalInvoiceId?: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceLineItem[];
  lineItems?: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  notes: string;
  status: InvoiceStatus;
  type: InvoiceKind;
};

interface InvoiceModalProps {
  onClose: () => void;
  onSave: (invoice: InvoicePayload) => Promise<unknown> | void;
  invoice?: InvoiceLike | null;
  customers?: Customer[];
  products?: Product[];
  invoices?: InvoiceLike[];
}

interface InvoiceFormState {
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  status: InvoiceStatus;
  type: InvoiceKind;
  originalInvoiceId: string;
  discountAmount: number;
}

interface StockWarningState {
  itemId: string;
  product: Product;
  requested: number;
  available: number;
}

const createEmptyItem = (seed?: number): InvoiceLineItem => ({
  id: `item-${Date.now()}-${seed ?? Math.random().toString(36).slice(2, 6)}`,
  description: '',
  quantity: 1,
  unitPrice: 0,
  total: 0,
  taxRate: 18,
});

const createDefaultItems = (): InvoiceLineItem[] => [createEmptyItem()];

const INVOICE_NUMBER_PREFIX = 'INV';

const buildTempInvoiceNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${INVOICE_NUMBER_PREFIX}-${year}-${month}-XXX`;
};

const toStringId = (value?: string | number | null) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

const isReturnInvoiceRecord = (record?: InvoiceLike | null): boolean => {
  if (!record) {
    return false;
  }
  return record._isReturnInvoice === true || String(record.type || '') === 'return';
};

const resolveLinkedOriginalId = (record?: InvoiceLike | null) => {
  if (!record) {
    return '';
  }
  return toStringId(record.originalInvoiceId ?? record.refundedInvoiceId ?? '');
};

const normalizeInvoiceItems = (rawItems?: RawInvoiceItem[]): InvoiceLineItem[] => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return createDefaultItems();
  }

  return rawItems.map((item, index) => {
    const quantity = Number(item.quantity) || 1;
    const unitPrice = Number(item.unitPrice) || 0;
    const computedTotal = Number.isFinite(Number(item.total)) ? Number(item.total) : quantity * unitPrice;
    const hasProductId = item.productId !== undefined && item.productId !== null;
    return {
      ...item,
      id: item.id ? String(item.id) : `${index + 1}`,
      description: item.description || item.productName || '',
      quantity,
      unitPrice,
      total: computedTotal,
      productId: hasProductId ? toStringId(item.productId) : undefined,
      unit: item.unit,
      taxRate: Number.isFinite(Number(item.taxRate)) ? Number(item.taxRate) : 18,
    };
  });
};

const mapReturnItemsFromOriginal = (original?: InvoiceLike | null): InvoiceLineItem[] => {
  if (!original) {
    return createDefaultItems();
  }
  const normalized = normalizeInvoiceItems(original.items);
  if (!normalized.length) {
    return createDefaultItems();
  }
  return normalized.map((item, index) => {
    const positiveQuantity = Math.abs(Number(item.quantity) || 0) || 1;
    const unitPrice = Number(item.unitPrice) || 0;
    const quantity = -positiveQuantity;
    return {
      ...item,
      id: `ret-${Date.now()}-${index}`,
      quantity,
      total: quantity * unitPrice,
    };
  });
};

const getAvailableStock = (product?: Product): number | null => {
  if (!product) {
    return null;
  }
  const candidates: Array<number | undefined> = [product.stock, (product as Partial<Product>).stockQuantity];
  for (const value of candidates) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
};

const parseTaxRateValue = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }
  return numeric;
};

const isPromiseLike = (value: unknown): value is Promise<unknown> => {
  return Boolean(value) && typeof (value as Promise<unknown>).then === 'function';
};

export default function InvoiceModal({ onClose, onSave, invoice, customers = [], products = [], invoices = [] }: InvoiceModalProps) {
  const { t, i18n } = useTranslation();
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  const [invoiceData, setInvoiceData] = useState<InvoiceFormState>(() => ({
    invoiceNumber: buildTempInvoiceNumber(),
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
    discountAmount: 0,
  }));

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeProductDropdown, setActiveProductDropdown] = useState<string | null>(null);
  const [items, setItems] = useState<InvoiceLineItem[]>(() => createDefaultItems());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [stockWarning, setStockWarning] = useState<StockWarningState | null>(null);
  const originalItemStateRef = React.useRef<Record<string, { productId?: string; quantity: number }>>({});

  const snapshotOriginalItems = React.useCallback((lineItems: InvoiceLineItem[]) => {
    const snapshot: Record<string, { productId?: string; quantity: number }> = {};
    lineItems.forEach(item => {
      snapshot[item.id] = {
        productId: item.productId ? toStringId(item.productId) : undefined,
        quantity: Number(item.quantity) || 0,
      };
    });
    originalItemStateRef.current = snapshot;
  }, []);

  const resolveCategoryTaxRate = React.useCallback(
    (categoryName?: string | null): number | null => {
      if (!categoryName || !categories.length) {
        return null;
      }
      const normalized = String(categoryName).trim().toLowerCase();
      if (!normalized) {
        return null;
      }
      const matchByName = categories.find(
        cat => String(cat.name || '').trim().toLowerCase() === normalized,
      );
      const matchById = categories.find(cat => String(cat.id) === normalized);
      const target = matchByName || matchById;
      if (target) {
        const rate = parseTaxRateValue(target.taxRate);
        if (rate !== null) {
          return rate;
        }
        if (target.parentId) {
          const parent = categories.find(cat => String(cat.id) === String(target.parentId));
          const parentRate = parent ? parseTaxRateValue(parent.taxRate) : null;
          if (parentRate !== null) {
            return parentRate;
          }
        }
      }
      return null;
    },
    [categories],
  );

  const resolveProductTaxRate = React.useCallback(
    (product?: Product | null): number | null => {
      if (!product) {
        return null;
      }
      const override = parseTaxRateValue(product.categoryTaxRateOverride);
      if (override !== null) {
        return override;
      }
      const productSpecific = parseTaxRateValue(product.taxRate);
      if (productSpecific !== null) {
        return productSpecific;
      }
      const categoryRate = resolveCategoryTaxRate(product.category);
      if (categoryRate !== null) {
        return categoryRate;
      }
      return null;
    },
    [resolveCategoryTaxRate],
  );

  const ensureLineItemTaxRate = React.useCallback(
    (item: InvoiceLineItem): InvoiceLineItem => {
      const currentRate = parseTaxRateValue(item.taxRate);
      let nextRate = currentRate;
      if (nextRate === null) {
        const pid = item.productId ? toStringId(item.productId) : '';
        let productMatch: Product | undefined;
        if (pid) {
          productMatch = products.find(p => toStringId(p.id) === pid);
        }
        if (!productMatch && item.description) {
          const needle = item.description.trim().toLowerCase();
          productMatch =
            products.find(p => String(p.name || '').trim().toLowerCase() === needle) ||
            products.find(p => String(p.name || '').toLowerCase().includes(needle));
        }
        const resolved = resolveProductTaxRate(productMatch);
        nextRate = typeof resolved === 'number' ? resolved : null;
      }
      if (nextRate === null) {
        nextRate = 18;
      }
      if (currentRate === nextRate && item.taxRate === nextRate) {
        return item;
      }
      return { ...item, taxRate: nextRate };
    },
    [products, resolveProductTaxRate],
  );

  const getBaselineQuantity = React.useCallback(
    (itemId: string, productId?: string | number) => {
      const original = originalItemStateRef.current[itemId];
      if (!original) {
        return 0;
      }
      if (!original.productId || !productId) {
        return 0;
      }
      return toStringId(original.productId) === toStringId(productId)
        ? Number(original.quantity) || 0
        : 0;
    },
    [],
  );

  React.useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const cats = await productCategoriesApi.getAll();
        if (isActive) {
          setCategories(Array.isArray(cats) ? cats : []);
        }
      } catch (error) {
        if (isActive) {
          setCategories([]);
          logger.warn('InvoiceModal: category load failed', error);
        }
      } finally {
        /* noop */
      }
    })();
    return () => {
      isActive = false;
    };
  }, []);

  React.useEffect(() => {
    if (!invoice) {
      setInvoiceData({
        invoiceNumber: buildTempInvoiceNumber(),
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
        discountAmount: 0,
      });
      const defaults = createDefaultItems().map(ensureLineItemTaxRate);
      setItems(defaults);
      snapshotOriginalItems([]);
      setCustomerSearch('');
      setSelectedCustomer(null);
      setShowCustomerDropdown(false);
      setActiveProductDropdown(null);
      setValidationError(null);
      return;
    }

    const isReturn = isReturnInvoiceRecord(invoice);
    const linkedOriginalId = resolveLinkedOriginalId(invoice);
    setInvoiceData({
      invoiceNumber: invoice.invoiceNumber || buildTempInvoiceNumber(),
      customerId: toStringId(invoice.customerId),
      customerName: invoice.customer?.name || invoice.customerName || '',
      customerEmail: invoice.customer?.email || invoice.customerEmail || '',
      customerAddress: invoice.customer?.address || invoice.customerAddress || '',
      issueDate: invoice.issueDate || new Date().toISOString().split('T')[0],
      dueDate: invoice.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: invoice.notes || '',
      status: invoice.status || 'draft',
      type: isReturn ? 'return' : (invoice.type as InvoiceKind) || 'product',
      originalInvoiceId: linkedOriginalId,
      discountAmount: Number(invoice.discountAmount ?? 0) || 0,
    });

    const normalizedItems = normalizeInvoiceItems(invoice.items);
    const baseline = normalizedItems.length ? normalizedItems : createDefaultItems();
    const hydratedItems = baseline.map(ensureLineItemTaxRate);
    setItems(hydratedItems);
    snapshotOriginalItems(normalizedItems.length ? normalizedItems : []);
    setCustomerSearch(invoice.customer?.name || invoice.customerName || '');
    setSelectedCustomer(invoice.customer ?? null);
    setShowCustomerDropdown(false);
    setActiveProductDropdown(null);
    setValidationError(null);

    if (isReturn && linkedOriginalId) {
      const original = invoices.find(inv => toStringId(inv.id) === linkedOriginalId);
      if (original) {
        setInvoiceData(prev => ({
          ...prev,
          originalInvoiceId: linkedOriginalId,
          customerId: prev.customerId || toStringId(original.customerId),
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

        const hasMeaningfulItems = Array.isArray(invoice.items) && invoice.items.length > 0;
        if (!hasMeaningfulItems) {
          const mapped = mapReturnItemsFromOriginal(original);
          const fallbackItems = (mapped.length ? mapped : createDefaultItems()).map(ensureLineItemTaxRate);
          setItems(fallbackItems);
          snapshotOriginalItems(mapped.length ? mapped : []);
        }
      }
    }
  }, [invoice, invoices, snapshotOriginalItems, ensureLineItemTaxRate]);

  const addItem = () => {
    setItems(prev => {
      const newItem = createEmptyItem(prev.length + 1);
      originalItemStateRef.current[newItem.id] = { quantity: 0 };
      return [...prev, newItem];
    });
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      if (prev.length === 1) return prev;
      const next = prev.filter(item => item.id !== id);
      if (originalItemStateRef.current[id]) {
        const snapshot = { ...originalItemStateRef.current };
        delete snapshot[id];
        originalItemStateRef.current = snapshot;
      }
      return next;
    });
    setActiveProductDropdown(prev => (prev === id ? null : prev));
  };

  const updateItem = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setItems(prev => {
      const next = prev.map(item => {
        if (item.id !== id) {
          return item;
        }
        const updated: InvoiceLineItem = { ...item, [field]: value } as InvoiceLineItem;
        if (field === 'quantity' || field === 'unitPrice') {
          const quantity = Number(field === 'quantity' ? value : updated.quantity) || 0;
          const unitPrice = Number(field === 'unitPrice' ? value : updated.unitPrice) || 0;
          updated.total = quantity * unitPrice;
        }
        return updated;
      });

      if (field === 'quantity') {
        const target = next.find(i => i.id === id);
        if (target?.productId) {
          const product = products.find(p => toStringId(p.id) === toStringId(target.productId));
          const available = getAvailableStock(product);
          const requested = Number(value) || 0;
          const baseline = getBaselineQuantity(id, target.productId);
          const effectiveAvailable = available !== null ? available + baseline : null;
          if (product && effectiveAvailable !== null && requested > effectiveAvailable) {
            setStockWarning({ itemId: id, product, requested, available });
          }
        }
      }

      return next;
    });
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
  const discountBase = subtotal + taxAmount;
  const rawDiscountInput = Number(invoiceData.discountAmount) || 0;
  const discountAmount = Math.min(discountBase, Math.max(0, rawDiscountInput));
  const total = subtotal + taxAmount - discountAmount; // KDV DAHİL toplam

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
    logger.debug('InvoiceModal: product selected', {
      productId: product.id,
      name: product.name,
      taxRate: product.taxRate,
      categoryTaxRateOverride: product.categoryTaxRateOverride,
      category: product.category,
    });
    const effectiveRate = resolveProductTaxRate(product) ?? 18;
    const available = getAvailableStock(product);
    setItems(prev => {
      const next = prev.map(item => {
        if (item.id !== itemId) {
          return item;
        }
        const quantity = item.quantity > 0 ? item.quantity : 1;
        const unitPrice = Number(product.unitPrice ?? item.unitPrice ?? 0);
        const taxRate = Number(effectiveRate);
        return {
          ...item,
          productId: product.id,
          description: product.name,
          unitPrice,
          unit: product.unit,
          quantity,
          total: quantity * unitPrice,
          taxRate,
        };
      });

      if (available !== null) {
        const target = next.find(i => i.id === itemId);
        if (target && target.quantity > available) {
          setStockWarning({ itemId, product, requested: target.quantity, available });
        }
      }

      return next;
    });
    setActiveProductDropdown(null);
  };

  const handleSave = async () => {
    if (isSaving) return;
    logger.debug('InvoiceModal: starting validation', {
      customerId: invoiceData.customerId,
      customerName: invoiceData.customerName,
      selectedCustomer: selectedCustomer?.name,
    });

    for (const it of items) {
      const pid = toStringId(it.productId);
      let prod = pid ? products.find(p => toStringId(p.id) === pid) : undefined;
      if (!prod && it.description) {
        const nameLc = String(it.description).trim().toLowerCase();
        prod = products.find(p => String(p.name || '').trim().toLowerCase() === nameLc)
          || products.find(p => String(p.name || '').toLowerCase().includes(nameLc));
      }
      if (prod) {
        const available = getAvailableStock(prod);
        const requested = Number(it.quantity) || 0;
        const baseline = it.productId ? getBaselineQuantity(it.id, it.productId) : 0;
        const effectiveAvailable = available !== null ? available + baseline : null;
        if (effectiveAvailable !== null && requested > effectiveAvailable) {
          setStockWarning({ itemId: String(it.id), product: prod, requested, available });
          return;
        }
      }
    }

    if (!invoiceData.customerId) {
      logger.error('InvoiceModal: customerId validation failed', {
        customerId: invoiceData.customerId,
        selectedCustomer,
      });
      setValidationError('Lütfen müşteri seçin');
      return;
    }
    if (invoiceData.type === 'return' && !invoiceData.originalInvoiceId) {
      setValidationError('İade faturası oluşturmak için iade edilecek faturayı seçmelisiniz');
      return;
    }
    if (!items.length) {
      setValidationError('Lütfen en az bir ürün ekleyin');
      return;
    }
    if (items.some(item => !item.description || item.unitPrice <= 0)) {
      setValidationError('Lütfen tüm ürün bilgilerini eksiksiz doldurun');
      return;
    }

    const normalizedItems = (invoiceData.type === 'return')
      ? items.map(it => {
          const quantity = Number(it.quantity) || 0;
          const unitPrice = Number(it.unitPrice) || 0;
          const negQuantity = quantity > 0 ? -quantity : quantity;
          return { ...it, quantity: negQuantity, total: negQuantity * unitPrice };
        })
      : items.map(it => {
          const quantity = Number(it.quantity) || 0;
          const unitPrice = Number(it.unitPrice) || 0;
          return { ...it, total: quantity * unitPrice };
        });

    const preparedItems = normalizedItems.map(ensureLineItemTaxRate);

    let subtotal = 0;
    let taxAmount = 0;
    preparedItems.forEach(item => {
      const itemTotal = Number(item.total) || 0;
      const itemTaxRate = Number(item.taxRate ?? 18) / 100;
      taxAmount += itemTotal * itemTaxRate;
      subtotal += itemTotal;
    });
    const maxDiscount = subtotal + taxAmount;
    const normalizedDiscount = Math.min(
      maxDiscount,
      Math.max(0, Number(invoiceData.discountAmount) || 0),
    );
    const total = subtotal + taxAmount - normalizedDiscount;

    const newInvoice: InvoicePayload = {
      invoiceNumber: invoiceData.invoiceNumber,
      customerId: invoiceData.customerId,
      customerName: invoiceData.customerName,
      customerEmail: invoiceData.customerEmail,
      customerAddress: invoiceData.customerAddress,
      issueDate: invoiceData.issueDate || new Date().toISOString().split('T')[0],
      dueDate: invoiceData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: preparedItems,
      lineItems: preparedItems,
      subtotal,
      taxAmount,
      discountAmount: normalizedDiscount,
      total,
      notes: invoiceData.notes || '',
      status: invoiceData.status || 'draft',
      type: invoiceData.type,
      originalInvoiceId: invoiceData.originalInvoiceId || undefined,
    };

    if (invoice?.id) {
      newInvoice.id = toStringId(invoice.id);
      if (invoice.createdAt) {
        newInvoice.createdAt = invoice.createdAt;
      }
    }

    if (!newInvoice.id && newInvoice.type === 'return' && newInvoice.originalInvoiceId) {
      newInvoice.id = newInvoice.originalInvoiceId;
    }

    logger.debug('InvoiceModal: submitting invoice payload', {
      customerId: newInvoice.customerId,
      customerName: newInvoice.customerName,
      itemCount: newInvoice.items.length,
      total: newInvoice.total,
    });

    try {
      setIsSaving(true);
      const maybePromise = onSave(newInvoice);
      if (isPromiseLike(maybePromise)) {
        maybePromise
          .catch(error => {
            logger.error('InvoiceModal: save failed', error);
          })
          .finally(() => setIsSaving(false));
      } else {
        setIsSaving(false);
      }
    } catch (error) {
      setIsSaving(false);
      logger.error('InvoiceModal: save threw synchronously', error);
    }

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
                  const nextType = e.target.value as InvoiceKind;
                  setInvoiceData(prev => ({ ...prev, type: nextType }));
                  if (nextType === 'return') {
                    // Eğer mevcut bir fatura düzenleniyorsa, onu otomatik orijinal olarak seç
                    const candidateId = invoice?.id ? toStringId(invoice.id) : '';
                    if (candidateId) {
                      const original = invoices.find(inv => toStringId(inv.id) === candidateId);
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
                          const mapped = mapReturnItemsFromOriginal(original);
                          setItems(mapped.length ? mapped : createDefaultItems());
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
                  const original = invoices.find(inv => toStringId(inv.id) === id);
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
                    const mapped = mapReturnItemsFromOriginal(original);
                    setItems(mapped.length ? mapped : createDefaultItems());
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
                onChange={(event) => setInvoiceData({ ...invoiceData, status: event.target.value as InvoiceStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="draft">{resolveStatusLabel(t, 'draft')}</option>
                <option value="sent">{resolveStatusLabel(t, 'sent')}</option>
                <option value="paid">{resolveStatusLabel(t, 'paid')}</option>
                <option value="overdue">{resolveStatusLabel(t, 'overdue')}</option>
                <option value="cancelled">{resolveStatusLabel(t, 'cancelled')}</option>
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
                                {productMatches.map(product => {
                                  const availableStock = getAvailableStock(product);
                                  const safeStock = Math.max(0, availableStock ?? 0);
                                  const stockClass = (availableStock ?? 0) > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium';
                                  return (
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
                                          {(product.unitPrice ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                        </span>
                                        <span className="text-gray-500">
                                          Stok: <span className={stockClass}>{safeStock}</span>
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
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
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('invoices.discount') || 'İskonto'}:</span>
                  <input
                    type="number"
                    value={invoiceData.discountAmount ?? 0}
                    onChange={event => {
                      const numeric = Number(event.target.value);
                      setInvoiceData(prev => ({
                        ...prev,
                        discountAmount: Number.isFinite(numeric) && numeric >= 0 ? numeric : 0,
                      }));
                    }}
                    className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                  />
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
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common.cancel') || 'Iptal'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('common.creating', { defaultValue: 'Oluşturuluyor…' })}</span>
              </>
            ) : (
              invoice ? (t('common.update') || 'Guncelle') : (t('invoices.createInvoice') || 'Fatura Olustur')
            )}
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
      {stockWarning && (
        <StockWarningModal
          isOpen={true}
          product={stockWarning.product}
          requested={stockWarning.requested}
          available={stockWarning.available}
          onAdjust={() => {
            setItems(prev => prev.map(it => it.id === stockWarning.itemId ? { ...it, quantity: stockWarning.available, total: stockWarning.available * (Number(it.unitPrice)||0) } : it));
          }}
          onClose={() => setStockWarning(null)}
        />
      )}
    </div>
  );
}

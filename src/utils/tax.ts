import type { Product, ProductCategory } from '../types';

export const DEFAULT_TAX_RATE = 18;

const normalizeCategoryToken = (value?: string | number | null): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

export const normalizeTaxRateInput = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.round(numeric * 100) / 100;
};

const findCategoryMatch = (
  categories: ProductCategory[] | undefined,
  ref?: string | number | null,
): ProductCategory | undefined => {
  if (!categories || !categories.length || ref === null || ref === undefined) {
    return undefined;
  }
  const refStr = String(ref).trim();
  if (!refStr) {
    return undefined;
  }
  const byId = categories.find(cat => String(cat.id) === refStr);
  if (byId) {
    return byId;
  }
  const normalizedRef = normalizeCategoryToken(refStr);
  const byName = categories.find(cat => normalizeCategoryToken(cat.name) === normalizedRef);
  if (byName) {
    return byName;
  }
  if (refStr.includes('>') || refStr.includes('/')) {
    const separators = refStr.includes('>') ? '>' : '/';
    const segments = refStr
      .split(separators)
      .map(segment => normalizeCategoryToken(segment))
      .filter(Boolean);
    for (let idx = segments.length - 1; idx >= 0; idx -= 1) {
      const match = categories.find(cat => normalizeCategoryToken(cat.name) === segments[idx]);
      if (match) {
        return match;
      }
    }
  }
  return undefined;
};

export const resolveCategoryTaxRate = (
  categoryRef: string | number | null | undefined,
  categories?: ProductCategory[],
): number | null => {
  if (!categories?.length || !categoryRef) {
    return null;
  }
  const visited = new Set<string>();
  let cursor = findCategoryMatch(categories, categoryRef);
  while (cursor) {
    const rate = normalizeTaxRateInput(cursor.taxRate);
    if (rate !== null) {
      return rate;
    }
    if (!cursor.parentId) {
      break;
    }
    const parentId = String(cursor.parentId);
    if (visited.has(parentId)) {
      break;
    }
    visited.add(parentId);
    cursor = findCategoryMatch(categories, parentId);
  }
  return null;
};

const findProductMatch = (
  products: Product[] | undefined,
  reference?: { id?: string | number; name?: string | null },
): Product | undefined => {
  if (!products || !products.length) {
    return undefined;
  }
  if (reference?.id) {
    const byId = products.find(prod => String(prod.id) === String(reference.id));
    if (byId) {
      return byId;
    }
  }
  if (reference?.name) {
    const normalized = normalizeCategoryToken(reference.name);
    if (normalized) {
      const byName = products.find(prod => normalizeCategoryToken(prod.name) === normalized);
      if (byName) {
        return byName;
      }
    }
  }
  return undefined;
};

export const resolveProductTaxRate = (
  product?: Product | null,
  categories?: ProductCategory[],
  categoryHint?: string | number | null,
  defaultRate = DEFAULT_TAX_RATE,
): number => {
  const override = normalizeTaxRateInput(product?.categoryTaxRateOverride);
  if (override !== null) {
    return override;
  }
  const productSpecific = normalizeTaxRateInput(product?.taxRate);
  if (productSpecific !== null) {
    return productSpecific;
  }
  const categoryRate = resolveCategoryTaxRate(product?.category ?? categoryHint, categories);
  if (categoryRate !== null) {
    return categoryRate;
  }
  const hintRate = resolveCategoryTaxRate(categoryHint ?? null, categories);
  if (hintRate !== null) {
    return hintRate;
  }
  return defaultRate;
};

export type LineItemWithTax = {
  taxRate?: number;
  productId?: string | number;
  description?: string;
  productName?: string;
  total?: number;
};

export const ensureLineItemTaxRate = <T extends LineItemWithTax>(
  item: T,
  options: {
    products?: Product[];
    categories?: ProductCategory[];
    defaultRate?: number;
  },
): T => {
  const parsed = normalizeTaxRateInput(item.taxRate);
  if (parsed !== null) {
    if (item.taxRate === parsed) {
      return item;
    }
    return { ...item, taxRate: parsed };
  }
  const productMatch = findProductMatch(options.products, {
    id: item.productId,
    name: item.productName ?? item.description,
  });
  const resolved = resolveProductTaxRate(
    productMatch,
    options.categories,
    item.productName ?? item.description,
    options.defaultRate,
  );
  if (item.taxRate === resolved) {
    return item;
  }
  return { ...item, taxRate: resolved };
};

export const ensureItemsHaveTaxRate = <T extends LineItemWithTax>(
  items: T[],
  options: {
    products?: Product[];
    categories?: ProductCategory[];
    defaultRate?: number;
  },
): T[] => {
  if (!Array.isArray(items)) {
    return [];
  }
  let changed = false;
  const next = items.map(item => {
    const ensured = ensureLineItemTaxRate(item, options);
    if (ensured !== item) {
      changed = true;
    }
    return ensured;
  });
  return changed ? next : items;
};

export const calculateInvoiceTotals = (
  items: Array<{ total?: number; taxRate?: number }>,
  discountInput: unknown,
  defaultRate = DEFAULT_TAX_RATE,
) => {
  const safeItems = Array.isArray(items) ? items : [];
  let subtotal = 0;
  let taxAmount = 0;
  safeItems.forEach(item => {
    const lineTotal = Number(item.total) || 0;
    const rate = normalizeTaxRateInput(item.taxRate);
    const effectiveRate = (rate ?? defaultRate) / 100;
    subtotal += lineTotal;
    taxAmount += lineTotal * effectiveRate;
  });
  const discountBase = subtotal + taxAmount;
  const rawDiscount = Number(discountInput);
  const discount = Number.isFinite(rawDiscount)
    ? Math.min(discountBase, Math.max(0, rawDiscount))
    : 0;
  const total = subtotal + taxAmount - discount;
  return {
    subtotal,
    taxAmount,
    total,
    discount,
  };
};

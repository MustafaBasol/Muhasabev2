import React from 'react';
import {
  X,
  Package,
  Barcode,
  Tag,
  Layers,
  DollarSign,
  FileText
} from 'lucide-react';
import type { Product } from './ProductList';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
  product?: Product | null;
  categories: string[];
}

interface ProductFormState {
  name: string;
  sku: string;
  category: string;
  unitPrice: string;
  costPrice: string;
  stockQuantity: string;
  reorderLevel: string;
  unit: string;
  description: string;
}

const defaultState: ProductFormState = {
  name: '',
  sku: '',
  category: '',
  unitPrice: '',
  costPrice: '',
  stockQuantity: '',
  reorderLevel: '10',
  unit: 'adet',
  description: '',
};

export default function ProductModal({ isOpen, onClose, onSave, product, categories }: ProductModalProps) {
  const [formState, setFormState] = React.useState<ProductFormState>(defaultState);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const categoryOptions = React.useMemo(() => {
    const optionSet = new Set(
      categories
        .map(category => category.trim())
        .filter(category => Boolean(category))
    );
    if (product?.category) {
      optionSet.add(product.category.trim());
    }
    return Array.from(optionSet).sort((a, b) => a.localeCompare(b, 'tr-TR'));
  }, [categories, product]);

  React.useEffect(() => {
    if (!isOpen) {
      setFormState(defaultState);
      setErrors({});
      return;
    }

    if (product) {
      setFormState({
        name: product.name || '',
        sku: product.sku || '',
        category: product.category || categoryOptions[0] || '',
        unitPrice: product.unitPrice ? String(product.unitPrice) : '',
        costPrice: product.costPrice ? String(product.costPrice) : '',
        stockQuantity: product.stockQuantity ? String(product.stockQuantity) : '',
        reorderLevel: product.reorderLevel ? String(product.reorderLevel) : '10',
        unit: product.unit || 'adet',
        description: product.description || '',
      });
    } else {
      setFormState({
        ...defaultState,
        category: categoryOptions[0] || '',
      });
    }
    setErrors({});
  }, [isOpen, product, categoryOptions]);

  const handleChange = (field: keyof ProductFormState, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!formState.name.trim()) {
      nextErrors.name = 'Urun adi zorunlu';
    }
    if (!formState.sku.trim()) {
      nextErrors.sku = 'SKU zorunlu';
    }
    if (categoryOptions.length > 0 && !formState.category.trim()) {
      nextErrors.category = 'Kategori secin';
    }
    if (!formState.unitPrice.trim() || Number.isNaN(Number(formState.unitPrice))) {
      nextErrors.unitPrice = 'Gecerli bir fiyat girin';
    }
    if (!formState.stockQuantity.trim() || Number.isNaN(Number(formState.stockQuantity))) {
      nextErrors.stockQuantity = 'Gecerli stok adedi girin';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }

    const unitPrice = Number(formState.unitPrice) || 0;
    const costPrice = Number(formState.costPrice) || 0;
    const stockQuantity = Number(formState.stockQuantity) || 0;
    const reorderLevel = Number(formState.reorderLevel) || 0;
    const selectedCategory = formState.category.trim() || categoryOptions[0] || 'Genel';

    const nextProduct: Product = {
      id: product?.id || Date.now().toString(),
      name: formState.name.trim(),
      sku: formState.sku.trim(),
      category: selectedCategory,
      unitPrice,
      costPrice,
      stockQuantity,
      reorderLevel,
      unit: formState.unit.trim() || 'adet',
      description: formState.description.trim(),
      createdAt: product?.createdAt || new Date().toISOString(),
      status: stockQuantity === 0 ? 'out-of-stock' : stockQuantity <= reorderLevel ? 'low' : 'active',
    };

    onSave(nextProduct);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-100">
              <Package className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {product ? 'Urunu duzenle' : 'Yeni urun ekle'}
              </h2>
              <p className="text-sm text-gray-500">Urun bilgilerini doldurun ve stok durumunu guncelleyin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-8 p-6">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Genel Bilgiler</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="product-name">
                  <Package className="h-4 w-4 text-gray-400" />
                  Urun adi *
                </label>
                <input
                  id="product-name"
                  type="text"
                  value={formState.name}
                  onChange={(event) => handleChange('name', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ornek: Akilli Telefon"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="product-sku">
                  <Barcode className="h-4 w-4 text-gray-400" />
                  SKU *
                </label>
                <input
                  id="product-sku"
                  type="text"
                  value={formState.sku}
                  onChange={(event) => handleChange('sku', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="SKU-001"
                />
                {errors.sku && <p className="mt-1 text-xs text-red-600">{errors.sku}</p>}
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="product-category">
                  <Tag className="h-4 w-4 text-gray-400" />
                  Kategori *
                </label>
                <select
                  id="product-category"
                  value={formState.category}
                  onChange={(event) => handleChange('category', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={categoryOptions.length === 0}
                >
                  {categoryOptions.length === 0 ? (
                    <option value="">Kategori bulunmuyor</option>
                  ) : (
                    categoryOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))
                  )}
                </select>
                {categoryOptions.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Önce yeni bir kategori oluşturmanız gerekiyor.
                  </p>
                )}
                {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="product-unit">
                  <Layers className="h-4 w-4 text-gray-400" />
                  Birim
                </label>
                <input
                  id="product-unit"
                  type="text"
                  value={formState.unit}
                  onChange={(event) => handleChange('unit', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="adet"
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Fiyat ve Stok</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="product-price">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  Satis fiyati *
                </label>
                <input
                  id="product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.unitPrice}
                  onChange={(event) => handleChange('unitPrice', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
                {errors.unitPrice && <p className="mt-1 text-xs text-red-600">{errors.unitPrice}</p>}
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="product-cost">
                  <DollarSign className="h-4 w-4 text-gray-300" />
                  Maliyet
                </label>
                <input
                  id="product-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.costPrice}
                  onChange={(event) => handleChange('costPrice', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="product-stock">
                  <Layers className="h-4 w-4 text-gray-400" />
                  Stok adedi *
                </label>
                <input
                  id="product-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={formState.stockQuantity}
                  onChange={(event) => handleChange('stockQuantity', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0"
                />
                {errors.stockQuantity && <p className="mt-1 text-xs text-red-600">{errors.stockQuantity}</p>}
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="product-reorder">
                  <Layers className="h-4 w-4 text-gray-300" />
                  Kritik stok
                </label>
                <input
                  id="product-reorder"
                  type="number"
                  min="0"
                  step="1"
                  value={formState.reorderLevel}
                  onChange={(event) => handleChange('reorderLevel', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="10"
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Notlar</h3>
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="product-description">
                <FileText className="h-4 w-4 text-gray-400" />
                Aciklama
              </label>
              <textarea
                id="product-description"
                value={formState.description}
                onChange={(event) => handleChange('description', event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Urun ozellikleri, garanti bilgisi vb."
              />
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Vazgec
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

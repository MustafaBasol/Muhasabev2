import React from 'react';
import { X, Tag, PlusCircle, Percent, Layers } from 'lucide-react';
import type { ProductCategory } from '../types';
import { useTranslation } from 'react-i18next';

// Ana kategori isimlerini çeviren yardımcı fonksiyon
const translateCategoryName = (categoryName: string, t: (key: string) => string): string => {
  const normalizedName = categoryName.trim();
  
  // Ana kategoriler için çeviri
  if (normalizedName === 'Ürünler') {
    return t('products.mainCategories.products');
  }
  if (normalizedName === 'Hizmetler') {
    return t('products.mainCategories.services');
  }
  
  // Diğer kategoriler için orijinal ismi döndür
  return categoryName;
};

interface ProductCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (categoryName: string, taxRate: number, parentId?: string) => void;
  categories: string[];
  categoryObjects?: ProductCategory[];
  editingCategory?: {
    id: string;
    name: string;
    taxRate: number;
    isActive: boolean;
    isProtected?: boolean;
  } | null;
  onArchive?: (id: string) => void | Promise<void>;
  onRestore?: (id: string) => void | Promise<void>;
}

export default function ProductCategoryModal({
  isOpen,
  onClose,
  onSubmit,
  categories,
  categoryObjects = [],
  editingCategory,
  onArchive,
  onRestore,
}: ProductCategoryModalProps) {
  const { t } = useTranslation();
  const [name, setName] = React.useState('');
  const [taxRate, setTaxRate] = React.useState('18');
  const [parentId, setParentId] = React.useState('');
  const [error, setError] = React.useState('');

  const isEditMode = !!editingCategory;

  // Sadece korumalı (ana) kategorileri seç
  const parentCategories = React.useMemo(
    () => categoryObjects.filter(cat => cat.isProtected && cat.isActive),
    [categoryObjects]
  );

  React.useEffect(() => {
    if (!isOpen) {
      setName('');
      setTaxRate('18');
      setParentId('');
      setError('');
      return;
    }
    if (editingCategory) {
      setName(editingCategory.name);
      setTaxRate(editingCategory.taxRate.toString());
      setParentId('');
    } else {
      setName('');
      setTaxRate('18');
      // Varsayılan olarak ilk ana kategoriyi seç
      if (parentCategories.length > 0) {
        setParentId(parentCategories[0].id);
      }
    }
    setError('');
  }, [isOpen, editingCategory, parentCategories]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = () => {
    const normalized = name.trim();
    if (!normalized) {
      setError('Kategori adı zorunludur');
      return;
    }

    // Yeni kategori ekleniyorsa parent ID zorunlu
    if (!isEditMode && !parentId) {
      setError('Ana kategori seçimi zorunludur');
      return;
    }

    const taxRateNum = parseFloat(taxRate);
    if (isNaN(taxRateNum) || taxRateNum < 0 || taxRateNum > 100) {
      setError('KDV oranı 0-100 arasında olmalıdır');
      return;
    }

    // Düzenleme modunda ise ve isim değişmediyse, isim kontrolünü atla
    if (isEditMode && editingCategory && normalized.toLocaleLowerCase('tr-TR') === editingCategory.name.toLocaleLowerCase('tr-TR')) {
      onSubmit(normalized, taxRateNum);
      onClose();
      return;
    }

    const exists = categories
      .map(current => current.toLocaleLowerCase('tr-TR'))
      .includes(normalized.toLocaleLowerCase('tr-TR'));

    if (exists) {
      setError('Bu kategori zaten mevcut');
      return;
    }

    onSubmit(normalized, taxRateNum, parentId || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
              <PlusCircle className="h-5 w-5 text-indigo-600" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditMode ? 'Kategori Düzenle' : 'Kategori Ekle'}
              </h2>
              <p className="text-sm text-gray-500">
                {isEditMode ? 'Kategori bilgilerini güncelleyin.' : 'Yeni ürün kategorisini kaydedin.'}
              </p>
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

        <div className="px-6 py-5">
          {!isEditMode && parentCategories.length > 0 && (
            <>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="parent-category">
                <Layers className="h-4 w-4 text-gray-400" />
                Ana Kategori
              </label>
              <select
                id="parent-category"
                value={parentId}
                onChange={event => {
                  setParentId(event.target.value);
                  if (error) {
                    setError('');
                  }
                }}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {parentCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {translateCategoryName(cat.name, t)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Bu kategori hangi ana kategoriye ait olacak?</p>
            </>
          )}

          <label className={`flex items-center gap-2 text-sm font-medium text-gray-700 ${!isEditMode && parentCategories.length > 0 ? 'mt-4' : ''}`} htmlFor="category-name">
            <Tag className="h-4 w-4 text-gray-400" />
            Kategori adı
          </label>
          <input
            id="category-name"
            type="text"
            value={name}
            onChange={event => {
              setName(event.target.value);
              if (error) {
                setError('');
              }
            }}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Örn: Elektronik"
          />
          
          <label className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-700" htmlFor="category-tax-rate">
            <Percent className="h-4 w-4 text-gray-400" />
            KDV Oranı (%)
          </label>
          <input
            id="category-tax-rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={event => {
              setTaxRate(event.target.value);
              if (error) {
                setError('');
              }
            }}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Örn: 18"
          />
          <p className="mt-1 text-xs text-gray-500">
            {!isEditMode && parentCategories.length > 0 
              ? 'Alt kategori KDV\'si varsa ana kategori KDV\'sini geçersiz kılar'
              : 'Bu kategorideki ürünler için varsayılan KDV oranı'}
          </p>
          
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          {isEditMode && editingCategory && !editingCategory.isProtected && (
            <div className="flex items-center gap-2">
              {editingCategory.isActive ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!editingCategory?.id) return;
                    const ok = window.confirm(t('products.archiveConfirm'));
                    if (ok) onArchive?.(editingCategory.id);
                  }}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  {t('products.archive')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => editingCategory?.id && onRestore?.(editingCategory.id)}
                  className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50"
                >
                  {t('products.activate')}
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

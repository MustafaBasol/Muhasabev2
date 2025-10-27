import React, { useMemo, useState, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Layers,
  BarChart2,
  Tag,
  AlertTriangle,
  ChevronDown,
  Check,
  X
} from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import ProductCategoryModal from './ProductCategoryModal';
import { productCategoriesApi } from '../api/product-categories';
import type { ProductCategory } from '../types';

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

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: number;
  costPrice: number;
  stockQuantity: number;
  reorderLevel: number;
  unit: string;
  createdAt: string;
  status?: string;
  description?: string;
  taxRate?: number; // KDV oranı (örn: 18 = %18)
  categoryTaxRateOverride?: number; // Ürüne özel KDV oranı (kategorinin KDV'sini override eder)
}

interface ProductListProps {
  products: Product[];
  categories: string[];
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onViewProduct: (product: Product) => void;
  onAddCategory: () => void;
  onEditCategory: (currentName: string, nextName: string) => void;
  onDeleteCategory: (categoryName: string) => void;
  onBulkAction?: (action: ProductBulkAction, productIds: string[]) => void;
}

type FilterId = 'category' | 'stock' | 'sort';
export type ProductBulkAction = 'update-price' | 'assign-category' | 'archive' | 'delete';

interface FilterDefinition {
  id: FilterId;
  label: string;
  value: string;
  display: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  defaultValue: string;
  menuRef: React.RefObject<HTMLDivElement>;
}

export default function ProductList({
  products,
  categories,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onViewProduct,
  onEditCategory,
  onDeleteCategory,
  onBulkAction,
}: ProductListProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortOption, setSortOption] = useState('recent');
  const [isCategoryPanelOpen, setIsCategoryPanelOpen] = useState(false);
  const [activeFilterMenu, setActiveFilterMenu] = useState<FilterId | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [editingCategoryData, setEditingCategoryData] = useState<{ name: string; taxRate: number } | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryObjects, setCategoryObjects] = useState<ProductCategory[]>([]);

  // Kategori bilgilerini backend'den çek
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await productCategoriesApi.getAll();
        setCategoryObjects(data);
      } catch (error) {
        console.error('Kategoriler yüklenirken hata:', error);
      }
    };
    fetchCategories();
  }, []);

  const categoryFilterMenuRef = React.useRef<HTMLDivElement | null>(null);
  const stockFilterMenuRef = React.useRef<HTMLDivElement | null>(null);
  const sortFilterMenuRef = React.useRef<HTMLDivElement | null>(null);
  const selectAllCheckboxRef = React.useRef<HTMLInputElement | null>(null);

  const defaultCategoryName = 'Genel';
  const categoriesEqual = (left: string, right: string) =>
    left.localeCompare(right, 'tr-TR', { sensitivity: 'accent' }) === 0;

  const availableCategories = useMemo(
    () => {
      const cats = categoryObjects
        .filter(cat => cat.isActive)
        .map(cat => cat.name.trim())
        .filter(name => Boolean(name))
        .sort((a, b) => a.localeCompare(b, 'tr-TR'));
      return cats;
    },
    [categoryObjects]
  );

  const categoryUsage = useMemo(() => {
    const usage = new Map<string, number>();
    products.forEach(product => {
      const category = (product.category || defaultCategoryName).trim() || defaultCategoryName;
      usage.set(category, (usage.get(category) ?? 0) + 1);
    });
    return usage;
  }, [products]);

  React.useEffect(() => {
    if (
      categoryFilter !== 'all' &&
      !availableCategories.some(category => categoriesEqual(category, categoryFilter))
    ) {
      setCategoryFilter('all');
    }
  }, [availableCategories, categoryFilter]);

  React.useEffect(() => {
    if (!activeFilterMenu) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const refs: Record<FilterId, React.RefObject<HTMLDivElement>> = {
        category: categoryFilterMenuRef,
        stock: stockFilterMenuRef,
        sort: sortFilterMenuRef,
      };
      const currentRef = refs[activeFilterMenu]?.current;
      if (currentRef && !currentRef.contains(target)) {
        setActiveFilterMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeFilterMenu]);

  React.useEffect(() => {
    setSelectedProductIds(prev =>
      prev.filter(id => products.some(product => product.id === id))
    );
  }, [products]);

  const inventorySnapshot = useMemo(() => {
    const totalStock = Math.floor(products.reduce((acc, product) => {
      const qty = Number(product.stockQuantity) || 0;
      return acc + qty;
    }, 0));
    const totalValue = products.reduce((acc, product) => {
      const qty = Number(product.stockQuantity) || 0;
      const price = Number(product.unitPrice) || 0;
      return acc + (qty * price);
    }, 0);
    const lowStock = products.filter(product => {
      const qty = Number(product.stockQuantity) || 0;
      const minQty = Number(product.reorderLevel) || 0;
      return qty < minQty;
    }).length;
    const activeCount = products.filter(product => product.status !== 'archived').length;

    return {
      totalStock,
      totalValue,
      lowStock,
      activeCount,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const matchesSearch = (product: Product) => {
      if (!normalizedSearch) return true;
      return (
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.sku.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch)
      );
    };

    const matchesCategory = (product: Product) => {
      if (categoryFilter === 'all') return true;
      return categoriesEqual(product.category, categoryFilter);
    };

    const matchesStockFilter = (product: Product) => {
      if (stockFilter === 'all') return true;
      if (stockFilter === 'low') return product.stockQuantity < product.reorderLevel;
      if (stockFilter === 'out') return product.stockQuantity === 0;
      if (stockFilter === 'overstock') return product.stockQuantity > product.reorderLevel * 2;
      return true;
    };

    const sorted = products
      .filter(product => matchesSearch(product) && matchesCategory(product) && matchesStockFilter(product))
      .sort((a, b) => {
        switch (sortOption) {
          case 'price-desc':
            return b.unitPrice - a.unitPrice;
          case 'price-asc':
            return a.unitPrice - b.unitPrice;
          case 'stock-desc':
            return b.stockQuantity - a.stockQuantity;
          case 'stock-asc':
            return a.stockQuantity - b.stockQuantity;
          case 'recent':
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });

    return sorted;
  }, [products, searchTerm, categoryFilter, stockFilter, sortOption]);

  const handleCategoryRename = (category: string) => {
    // Kategori objesini bul ve gerçek KDV oranını al
    const categoryObj = categoryObjects.find(cat => 
      cat.name.localeCompare(category, 'tr-TR', { sensitivity: 'accent' }) === 0
    );
    
    setEditingCategoryData({ 
      name: category.trim(), 
      taxRate: categoryObj?.taxRate ?? 18 // Backend'den gelen değer veya varsayılan 18
    });
  };

  const handleCategoryEditSubmit = async (newName: string, newTaxRate: number, parentId?: string) => {
    if (!editingCategoryData) {
      // Yeni kategori ekleniyor
      try {
        await productCategoriesApi.create({
          name: newName.trim(),
          taxRate: newTaxRate,
          parentId,
        });
        
        // Kategori listesini yenile
        const updatedCategories = await productCategoriesApi.getAll();
        setCategoryObjects(updatedCategories);
        
        // Modal'ı kapat
        setIsCategoryModalOpen(false);
        return;
      } catch (error: any) {
        console.error('Kategori eklenirken hata:', error);
        if (error.response?.data?.message) {
          alert(error.response.data.message);
        }
        return;
      }
    }
    
    // Mevcut kategori güncelleniyor
    const currentName = editingCategoryData.name;
    const updated = newName.trim();
    
    // Kategori objesini bul
    const categoryObj = categoryObjects.find(cat => 
      cat.name.localeCompare(currentName, 'tr-TR', { sensitivity: 'accent' }) === 0
    );
    
    if (!categoryObj) {
      console.error('Kategori bulunamadı:', currentName);
      setEditingCategoryData(null);
      return;
    }
    
    // Korumalı kategorilerin ismini değiştirmeyi engelle
    if (categoryObj.isProtected && updated !== currentName) {
      alert(`"${currentName}" ana kategori olduğu için ismi değiştirilemez. Sadece KDV oranı güncellenebilir.`);
      setEditingCategoryData(null);
      return;
    }
    
    try {
      // Backend'e KDV oranı güncellemesini gönder
      await productCategoriesApi.update(categoryObj.id, {
        name: updated !== currentName ? updated : undefined,
        taxRate: newTaxRate !== editingCategoryData.taxRate ? newTaxRate : undefined,
      });
      
      // Kategori listesini yenile
      const updatedCategories = await productCategoriesApi.getAll();
      setCategoryObjects(updatedCategories);
      
      // İsim değiştiyse parent component'i bilgilendir
      if (updated !== currentName) {
        const hasDuplicate = availableCategories.some(
          existing => !categoriesEqual(existing, currentName) && categoriesEqual(existing, updated)
        );
        
        if (hasDuplicate) {
          return; // Hata modal içinde gösterilecek
        }
        
        onEditCategory(currentName, updated);
      }
      
      setEditingCategoryData(null);
    } catch (error: any) {
      console.error('Kategori güncellenirken hata:', error);
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      }
    }
  };

  const handleCategoryDelete = async (category: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    if (categoriesEqual(category, defaultCategoryName)) {
      window.alert('Genel kategorisi silinemez.');
      return;
    }
    
    // Kategori objesini bul ve korumalı mı kontrol et
    const categoryObj = categoryObjects.find(cat => 
      cat.name.localeCompare(category, 'tr-TR', { sensitivity: 'accent' }) === 0
    );
    
    if (categoryObj?.isProtected) {
      window.alert(`"${category}" ana kategori olduğu için silinemez.`);
      return;
    }
    
    const usage = categoryUsage.get(category) ?? 0;
    const message =
      usage > 0
        ? `Bu kategoride ${usage} urun var. Silerseniz urunler "${defaultCategoryName}" kategorisine tasinacak. Devam etmek istiyor musunuz?`
        : 'Bu kategoriyi silmek istediginizden emin misiniz?';
    if (window.confirm(message)) {
      try {
        if (categoryObj) {
          await productCategoriesApi.delete(categoryObj.id);
          const updatedCategories = await productCategoriesApi.getAll();
          setCategoryObjects(updatedCategories);
        }
        onDeleteCategory(category);
      } catch (error: any) {
        console.error('Kategori silinirken hata:', error);
        if (error.response?.data?.message) {
          alert(error.response.data.message);
        }
      }
    }
  };

  const categoryOptions = [
    { value: 'all', label: t('products.allCategories') },
    ...availableCategories.map(category => ({ value: category, label: category })),
  ];

  const stockFilterLabels: Record<string, string> = {
    all: t('products.allStock'),
    low: t('products.lowStockFilter'),
    out: t('products.outOfStock'),
    overstock: t('products.overstock'),
  };

  const sortOptionLabels: Record<string, string> = {
    recent: t('products.newest'),
    'price-desc': t('products.priceHighLow'),
    'price-asc': t('products.priceLowHigh'),
    'stock-desc': t('products.stockHighLow'),
    'stock-asc': t('products.stockLowHigh'),
  };

  const filterDefinitions: FilterDefinition[] = [
    {
      id: 'category',
      label: t('products.category'),
      value: categoryFilter,
      display: categoryFilter === 'all' ? t('products.allCategories') : categoryFilter,
      options: categoryOptions,
      onChange: setCategoryFilter,
      defaultValue: 'all',
      menuRef: categoryFilterMenuRef,
    },
    {
      id: 'stock',
      label: 'Stok',
      value: stockFilter,
      display: stockFilterLabels[stockFilter] ?? stockFilter,
      options: Object.entries(stockFilterLabels).map(([value, label]) => ({ value, label })),
      onChange: setStockFilter,
      defaultValue: 'all',
      menuRef: stockFilterMenuRef,
    },
    {
      id: 'sort',
      label: 'Siralama',
      value: sortOption,
      display: sortOptionLabels[sortOption] ?? sortOption,
      options: Object.entries(sortOptionLabels).map(([value, label]) => ({ value, label })),
      onChange: setSortOption,
      defaultValue: 'recent',
      menuRef: sortFilterMenuRef,
    },
  ];

  const activeFilterCount =
    Number(categoryFilter !== 'all') + Number(stockFilter !== 'all') + Number(sortOption !== 'recent');

  const handleClearFilters = () => {
    setCategoryFilter('all');
    setStockFilter('all');
    setSortOption('recent');
    setActiveFilterMenu(null);
    setSelectedProductIds([]);
  };

  const handleCategorySelect = (value: string) => {
    setCategoryFilter(value);
    if (activeFilterMenu === 'category') {
      setActiveFilterMenu(null);
    }
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsCategoryPanelOpen(false);
    }
  };

  const visibleProductIds = useMemo(
    () => filteredProducts.map(product => product.id),
    [filteredProducts]
  );

  const visibleSelectedIds = useMemo(
    () => visibleProductIds.filter(id => selectedProductIds.includes(id)),
    [visibleProductIds, selectedProductIds]
  );

  const allVisibleSelected =
    visibleProductIds.length > 0 && visibleSelectedIds.length === visibleProductIds.length;
  const someVisibleSelected = visibleSelectedIds.length > 0 && !allVisibleSelected;

  const hasSelection = visibleSelectedIds.length > 0;
  const hasProducts = products.length > 0;
  const isFilteredEmpty = hasProducts && filteredProducts.length === 0;
  const bulkActions: { action: ProductBulkAction; label: string; tone?: 'danger' }[] = [
    { action: 'update-price', label: 'Fiyat guncelle' },
    { action: 'assign-category', label: 'Kategori ata' },
    { action: 'archive', label: 'Arsivle' },
    { action: 'delete', label: 'Sil', tone: 'danger' },
  ];

  const toggleSelectProduct = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const toggleSelectAllVisible = (_event?: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedProductIds(prev => {
      if (visibleProductIds.length === 0) {
        return prev;
      }
      const everyVisibleSelected = visibleProductIds.every(id => prev.includes(id));
      if (everyVisibleSelected) {
        return prev.filter(id => !visibleProductIds.includes(id));
      }
      const merged = new Set([...prev, ...visibleProductIds]);
      return Array.from(merged);
    });
  };

  const handleBulkActionClick = (action: ProductBulkAction) => {
    if (!visibleSelectedIds.length) {
      return;
    }
    onBulkAction?.(action, visibleSelectedIds);
    setSelectedProductIds(prev => prev.filter(id => !visibleSelectedIds.includes(id)));
  };

  React.useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">{t('products.totalProducts')}</h3>
            <Package className="h-5 w-5 text-indigo-500" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{inventorySnapshot.activeCount}</p>
          <p className="text-xs text-gray-500">{t('products.activeProductsDesc')}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">{t('products.stockValue')}</h3>
            <BarChart2 className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(inventorySnapshot.totalValue || 0)}
          </p>
          <p className="text-xs text-gray-500">{t('products.totalStockCostDesc')}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">{t('products.totalStock')}</h3>
            <Layers className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{inventorySnapshot.totalStock.toLocaleString('tr-TR')} adet</p>
          <p className="text-xs text-gray-500">{t('products.totalUnitsDesc')}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">{t('products.lowStock')}</h3>
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{inventorySnapshot.lowStock}</p>
          <p className="text-xs text-gray-500">{t('products.criticalLevelDesc')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className={`${isCategoryPanelOpen ? 'block' : 'hidden'} lg:block lg:w-72 lg:flex-shrink-0`}>
          <div className="rounded-xl border border-gray-200 bg-white p-4 lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{t('products.productCategories')}</h3>
                <p className="text-xs text-gray-500">
                  {availableCategories.length} {t('products.categoriesCount')} - {products.length} {t('products.productsCount')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCategoryData(null);
                  setIsCategoryModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <Tag className="h-4 w-4" />
                {t('products.addCategory')}
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => handleCategorySelect('all')}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  categoryFilter === 'all' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="truncate">Tum urunler</span>
                <span className="text-xs text-gray-500">{products.length}</span>
              </button>
              {availableCategories.length === 0 ? (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">Henuz kategori yok.</p>
              ) : (
                availableCategories.map(category => {
                  const usage = categoryUsage.get(category) ?? 0;
                  const isActive = categoryFilter !== 'all' && categoriesEqual(category, categoryFilter);
                  const isDefault = categoriesEqual(category, defaultCategoryName);
                  const categoryObj = categoryObjects.find(cat => 
                    cat.name.localeCompare(category, 'tr-TR', { sensitivity: 'accent' }) === 0
                  );
                  const isProtected = categoryObj?.isProtected || false;
                  
                  return (
                    <div
                      key={category}
                      className="rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-gray-200"
                    >
                      <button
                        type="button"
                        onClick={() => handleCategorySelect(category)}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm transition-colors ${
                          isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate flex items-center gap-1">
                          {translateCategoryName(category, t)}
                          {isProtected && <span className="text-xs text-amber-500" title="Ana kategori">🔒</span>}
                        </span>
                        <span className="text-xs text-gray-500">{usage}</span>
                      </button>
                      <div className="mt-1 flex items-center gap-2 px-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleCategoryRename(category)}
                          className="text-gray-400 transition-colors hover:text-gray-600"
                          title={isProtected ? "Ana kategorilerin sadece KDV'si değiştirilebilir" : "Kategoriyi düzenle"}
                        >
                          Duzenle
                        </button>
                        <span className="text-gray-300">-</span>
                        <button
                          type="button"
                          onClick={() => handleCategoryDelete(category)}
                          disabled={isDefault || isProtected}
                          className={`transition-colors ${
                            isDefault || isProtected ? 'cursor-not-allowed text-gray-300' : 'text-red-500 hover:text-red-600'
                          }`}
                          title={isDefault ? 'Genel kategorisi silinemez' : isProtected ? 'Ana kategori silinemez' : undefined}
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        <div className="flex-1 space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{t('products.title')}</h2>
                <p className="text-sm text-gray-500">
                  {filteredProducts.length} {t('products.title').toLowerCase()} - {t('invoice.total')}: {products.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryPanelOpen(prev => !prev)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 lg:hidden"
              >
                <Tag className="h-4 w-4" />
                {isCategoryPanelOpen ? t('common.close') : t('products.manageCategories')}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="sticky top-16 z-20">
              <div className="rounded-xl border border-gray-200 bg-white/95 p-4 shadow-sm backdrop-blur">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder={t('products.search')}
                      className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={onAddProduct}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4" />
                    {t('products.newProduct')}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {filterDefinitions.map(({ id, label, display, value, options, onChange, defaultValue, menuRef }) => {
                    const isActive = value !== defaultValue;
                    return (
                      <div key={id} ref={menuRef} className="relative flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveFilterMenu(prev => (prev === id ? null : id))}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            isActive
                              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800'
                          }`}
                        >
                          <span className="whitespace-nowrap">
                            {label}: {display}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        {isActive && (
                          <button
                            type="button"
                            onClick={() => {
                              onChange(defaultValue);
                              if (activeFilterMenu === id) {
                                setActiveFilterMenu(null);
                              }
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {activeFilterMenu === id && (
                          <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                            {options.map(option => {
                              const optionActive = option.value === value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    onChange(option.value);
                                    setActiveFilterMenu(null);
                                  }}
                                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                                    optionActive
                                      ? 'bg-indigo-50 text-indigo-700'
                                      : 'text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <span>{option.label}</span>
                                  {optionActive && <Check className="h-4 w-4" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="ml-auto text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                    >
                      Tumunu temizle
                    </button>
                  )}
                </div>
                {hasSelection && (
                  <div className="mt-3 flex flex-col gap-3 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 md:flex-row md:items-center md:justify-between">
                    <span className="font-medium">
                      Toplu islem icin {visibleSelectedIds.length} urun secildi
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {bulkActions.map(({ action, label, tone }) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => handleBulkActionClick(action)}
                          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                            tone === 'danger'
                              ? 'border border-red-200 bg-white text-red-600 hover:border-red-300 hover:text-red-700'
                              : 'border border-indigo-200 bg-white text-indigo-600 hover:border-indigo-300 hover:text-indigo-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedProductIds(prev => prev.filter(id => !visibleSelectedIds.includes(id)))
                        }
                        className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
                      >
                        Secimleri kaldir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white">
              {filteredProducts.length === 0 ? (
                !hasProducts ? (
                  <div className="flex flex-col items-center justify-center space-y-3 py-16">
                    <Package className="h-12 w-12 text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-900">Henuz urun yok</h3>
                    <p className="max-w-md text-center text-sm text-gray-500">
                      Urun ekleyerek envanterinizi takip etmeye baslayin. Fiyat, stok ve kategori bilgileriniz burada
                      gorunecek.
                    </p>
                    <button
                      type="button"
                      onClick={onAddProduct}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      {t('products.addFirstProduct')}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-3 py-16">
                    <Package className="h-12 w-12 text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-900">{t('products.noProducts')}</h3>
                    <p className="max-w-md text-center text-sm text-gray-500">
                      {t('transactions.noTransactions')}
                    </p>
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-100"
                    >
                      {t('common.search')}
                    </button>
                  </div>
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-12 px-4 py-3">
                          <input
                            ref={selectAllCheckboxRef}
                            type="checkbox"
                            checked={visibleProductIds.length > 0 && allVisibleSelected}
                            onChange={toggleSelectAllVisible}
                            aria-label={t('common.yes')}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('products.name')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('products.category')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('products.price')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('products.stock')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('products.status')}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('products.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredProducts.map(product => {
                        const isSelected = selectedProductIds.includes(product.id);
                        const isOutOfStock = product.stockQuantity === 0;
                        const isCritical = !isOutOfStock && product.stockQuantity < product.reorderLevel;
                        const statusLabel = isOutOfStock ? t('products.depleted') : isCritical ? t('products.critical') : t('products.inStock');
                        const statusTone = isOutOfStock ? 'danger' : isCritical ? 'warning' : 'success';
                        const statusClass =
                          statusTone === 'danger'
                            ? 'bg-red-100 text-red-700'
                            : statusTone === 'warning'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700';

                        return (
                          <tr
                            key={product.id}
                            className={`transition-colors hover:bg-gray-50 ${isSelected ? 'bg-indigo-50' : ''}`}
                          >
                            <td className="px-4 py-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectProduct(product.id)}
                                aria-label={`Urunu sec: ${product.name}`}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                                  <Package className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => onViewProduct(product)}
                                    className="font-medium text-gray-900 hover:text-indigo-600 transition-colors text-left"
                                  >
                                    {product.name}
                                  </button>
                                  <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Tag className="h-4 w-4 text-gray-400" />
                                <span>{product.category}</span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                              <div className="font-semibold">
                                {formatCurrency(product.unitPrice || 0)}
                              </div>
                              <div className="text-xs text-gray-500">
                                Maliyet: {formatCurrency(product.costPrice || 0)}
                              </div>
                            </td>
                            <td
                              className="whitespace-nowrap px-6 py-4 text-sm text-gray-900"
                              title={`${t('products.minStock')}: ${Math.floor(product.reorderLevel)}`}
                            >
                              <div className="font-semibold">
                                {Math.floor(product.stockQuantity)} {product.unit}
                              </div>
                              <div className="text-xs text-gray-500">{t('products.minStock')}: {Math.floor(product.reorderLevel)}</div>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => onViewProduct(product)}
                                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-indigo-600"
                                  title={t('products.viewProduct')}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onEditProduct(product)}
                                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600"
                                  title={t('products.edit')}
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteProduct(product.id)}
                                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600"
                                  title={t('products.delete')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Kategori Düzenleme Modal */}
      <ProductCategoryModal
        isOpen={isCategoryModalOpen || !!editingCategoryData}
        onClose={() => {
          setEditingCategoryData(null);
          setIsCategoryModalOpen(false);
        }}
        onSubmit={handleCategoryEditSubmit}
        categories={availableCategories}
        categoryObjects={categoryObjects}
        editingCategory={editingCategoryData}
      />
    </div>
  );
}

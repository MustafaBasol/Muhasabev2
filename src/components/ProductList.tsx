import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Product } from '../types';
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
  X,
  Download,
  Upload,
} from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import ProductCategoryModal from './ProductCategoryModal';
import InfoModal from './InfoModal';
import ConfirmModal from './ConfirmModal';
import Pagination from './Pagination';
// product-categories API'yi dinamik içeri aktararak kod bölmeyi (code-splitting) iyileştir
const loadProductCategoriesApi = async () => (await import('../api/product-categories')).productCategoriesApi;
import type { ProductCategory } from '../types';

// Ana kategori isimlerini çeviren yardımcı fonksiyon
const translateCategoryName = (categoryName: string, t: (key: string) => string): string => {
  const normalizedName = categoryName.trim();
  
  // Ana kategoriler için çeviri - Türkçe isimler ile eşleştir
  switch (normalizedName) {
    case 'Hizmetler':
      return t('products.mainCategories.services');
    case 'Ürünler':
      return t('products.mainCategories.products');
    default:
      // Alt kategoriler veya diğer kategoriler için orijinal ismi döndür
      return normalizedName;
  }
  return categoryName;
};



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
  onImportProducts?: (file: File) => void;
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
  categories: _categories,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onViewProduct,
  onEditCategory,
  onDeleteCategory,
  onBulkAction,
  onImportProducts,
}: ProductListProps) {
  const { formatCurrency } = useCurrency();
  const { t } = useTranslation();
  const [infoModal, setInfoModal] = useState<{ title: string; message: string } | null>(null);
  
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('products_pageSize') : null;
    const n = saved ? Number(saved) : 20;
    return [20, 50, 100].includes(n) ? n : 20;
  });

  // Kategori bilgilerini backend'den çek
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const api = await loadProductCategoriesApi();
        const data = await api.getAll();
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

  // Kategori hiyerarşisini organize et
  const categoryHierarchy = useMemo(() => {
    // Ana kategorileri bul
    const mainCategories = availableCategories.filter(category => {
      const categoryObj = categoryObjects.find(cat => 
        cat.name.localeCompare(category, 'tr-TR', { sensitivity: 'accent' }) === 0
      );
      return categoryObj?.isProtected || categoriesEqual(category, defaultCategoryName);
    });

    // Her ana kategori için alt kategorilerini organize et
    const hierarchicalCategories = mainCategories.map(mainCategory => {
      const categoryObj = categoryObjects.find(cat => 
        cat.name.localeCompare(mainCategory, 'tr-TR', { sensitivity: 'accent' }) === 0
      );
      
      // Bu ana kategorinin alt kategorilerini bul
      const subCategories = availableCategories.filter(category => {
        const subCategoryObj = categoryObjects.find(cat => 
          cat.name.localeCompare(category, 'tr-TR', { sensitivity: 'accent' }) === 0
        );
        // Alt kategori ise ve bu ana kategoriye ait ise
        return !subCategoryObj?.isProtected && 
               !categoriesEqual(category, defaultCategoryName) &&
               subCategoryObj?.parentId === categoryObj?.id;
      });

      return {
        mainCategory,
        subCategories,
        categoryObj
      };
    });

    // Orphan alt kategorileri (ana kategorisi olmayan) ayrı bir bölümde göster
    const orphanSubCategories = availableCategories.filter(category => {
      const categoryObj = categoryObjects.find(cat => 
        cat.name.localeCompare(category, 'tr-TR', { sensitivity: 'accent' }) === 0
      );
      return !categoryObj?.isProtected && 
             !categoriesEqual(category, defaultCategoryName) &&
             !categoryObj?.parentId;
    });

    return { hierarchicalCategories, orphanSubCategories };
  }, [availableCategories, categoryObjects, defaultCategoryName]);

  const { hierarchicalCategories, orphanSubCategories } = categoryHierarchy;

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
        const api = await loadProductCategoriesApi();
        await api.create({
          name: newName.trim(),
          taxRate: newTaxRate,
          parentId,
        });
        
        // Kategori listesini yenile
        const updatedCategories = await (await loadProductCategoriesApi()).getAll();
        setCategoryObjects(updatedCategories);
        try { window.dispatchEvent(new Event('product-categories-updated')); } catch {}
        
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
      const api = await loadProductCategoriesApi();
      await api.update(categoryObj.id, {
        name: updated !== currentName ? updated : undefined,
        taxRate: newTaxRate !== editingCategoryData.taxRate ? newTaxRate : undefined,
      });
      
      // Kategori listesini yenile
      const updatedCategories = await (await loadProductCategoriesApi()).getAll();
      setCategoryObjects(updatedCategories);
      try { window.dispatchEvent(new Event('product-categories-updated')); } catch {}
      
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
        setInfoModal({ title: t('common.error'), message: error.response.data.message });
      }
    }
  };

  const handleCategoryDelete = async (category: string) => {
    if (typeof window === 'undefined') return;
    if (categoriesEqual(category, defaultCategoryName)) {
      setInfoModal({ title: t('common.warning'), message: t('products.generalCategoryCannotDeleteAlert') });
      return;
    }
    
    // Kategori objesini bul ve korumalı mı kontrol et
    const categoryObj = categoryObjects.find(cat => 
      cat.name.localeCompare(category, 'tr-TR', { sensitivity: 'accent' }) === 0
    );
    
    if (categoryObj?.isProtected) {
      setInfoModal({ title: t('common.warning'), message: t('products.categoryCannotDeleteProtected', { category }) });
      return;
    }
    
    const usage = categoryUsage.get(category) ?? 0;
    const message = usage > 0
      ? t('products.deleteCategoryWithProducts', { count: usage, defaultCategory: defaultCategoryName })
      : t('products.deleteCategoryConfirm');

    setConfirmModal({
      title: t('products.deleteCategory'),
      message,
      confirmText: t('common.yes'),
      cancelText: t('common.no'),
      onConfirm: async () => {
        try {
          if (categoryObj) {
            const api = await loadProductCategoriesApi();
            await api.delete(categoryObj.id);
            const updatedCategories = await (await loadProductCategoriesApi()).getAll();
            setCategoryObjects(updatedCategories);
            try { window.dispatchEvent(new Event('product-categories-updated')); } catch {}
          }
          onDeleteCategory(category);
        } catch (error: any) {
          console.error('Kategori silinirken hata:', error);
          if (error.response?.data?.message) {
            setInfoModal({ title: t('common.error'), message: error.response.data.message });
          }
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const categoryOptions = [
    { value: 'all', label: t('products.filterCategory') },
    ...availableCategories.map(category => ({ value: category, label: category })),
  ];

  const stockFilterLabels: Record<string, string> = {
    all: t('products.allStock'),
    low: t('products.lowStockFilter'),
    out: t('products.outOfStock'),
    overstock: t('products.overstock'),
  };

  // --

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
      display: categoryFilter === 'all' ? t('products.filterCategory') : categoryFilter,
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

  const handleFilePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = '';
      return;
    }
    if (onImportProducts) {
      onImportProducts(file);
    }
    event.target.value = '';
  };

  const downloadTemplate = () => {
    // Ürün içe aktarma için kapsamlı CSV şablonu
    const csvContent = [
      'Name,SKU,UnitPrice,CostPrice,TaxRate,StockQuantity,ReorderLevel,Unit,Category,Description',
      'Örnek Ürün A,SKU-001,199.90,120.00,18,50,10,adet,Genel,"Açıklama: örnek ürün A"',
      'Örnek Ürün B,SKU-002,49.99,25.00,10,200,20,adet,Genel,"Açıklama: örnek ürün B"'
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'product_import_template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
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

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  const visibleProductIds = useMemo(
    () => paginatedProducts.map(product => product.id),
    [paginatedProducts]
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
  const bulkActions: { action: ProductBulkAction; label: string; tone?: 'danger' }[] = [
    { action: 'update-price', label: t('products.updatePrice') },
    { action: 'assign-category', label: t('products.assignCategory') },
    { action: 'archive', label: t('products.archive') },
    { action: 'delete', label: t('products.delete'), tone: 'danger' },
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

  // Reset page when search/filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, categoryFilter, stockFilter, sortOption]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    if (typeof window !== 'undefined') {
      localStorage.setItem('products_pageSize', String(size));
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {confirmModal && (
        <ConfirmModal
          isOpen={true}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          danger
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      {infoModal && (
        <InfoModal
          isOpen={true}
          title={infoModal.title}
          message={infoModal.message}
          onClose={() => setInfoModal(null)}
        />
      )}
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
          <p className="mt-3 text-2xl font-semibold text-gray-900">{inventorySnapshot.totalStock.toLocaleString('tr-TR')} {t('products.unit')}</p>
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
            <div className="mt-4 space-y-1">
              <button
                type="button"
                onClick={() => handleCategorySelect('all')}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  categoryFilter === 'all' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="truncate">{t('products.allProducts')}</span>
                <span className="text-xs text-gray-500">{products.length}</span>
              </button>
              {availableCategories.length === 0 ? (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">{t('products.noCategories')}</p>
              ) : (
                <>
                  {/* Hiyerarşik Kategori Ağacı */}
                  {hierarchicalCategories.map(({ mainCategory, subCategories, categoryObj }) => {
                    const mainUsage = categoryUsage.get(mainCategory) ?? 0;
                    const isMainActive = categoryFilter !== 'all' && categoriesEqual(mainCategory, categoryFilter);
                    const isDefault = categoriesEqual(mainCategory, defaultCategoryName);
                    const isProtected = categoryObj?.isProtected || false;
                    
                    return (
                      <div key={mainCategory} className="space-y-1 mb-4">
                        {/* Ana Kategori */}
                        <div className="ml-2">
                          <button
                            type="button"
                            onClick={() => handleCategorySelect(mainCategory)}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                              isMainActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className="truncate flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                              {translateCategoryName(mainCategory, t)}

                            </span>
                            <span className="text-xs text-gray-500">{mainUsage}</span>
                          </button>
                          <div className="mt-1 flex items-center gap-2 px-5 text-[11px]">
                            <button
                              type="button"
                              onClick={() => handleCategoryRename(mainCategory)}
                              className="text-gray-400 transition-colors hover:text-gray-600"
                              title={isProtected ? t('products.mainCategoryEditTooltip') : t('products.editCategoryTooltip')}
                            >
                              {t('products.editCategory')}
                            </button>
                            <span className="text-gray-300">-</span>
                            <button
                              type="button"
                              onClick={() => handleCategoryDelete(mainCategory)}
                              disabled={isDefault || isProtected}
                              className={`transition-colors ${
                                isDefault || isProtected ? 'cursor-not-allowed text-gray-300' : 'text-red-500 hover:text-red-600'
                              }`}
                              title={isDefault ? t('products.generalCategoryCannotDelete') : isProtected ? t('products.mainCategoryCannotDelete') : undefined}
                            >
                              {t('products.deleteCategory')}
                            </button>
                          </div>
                        </div>

                        {/* Alt Kategoriler */}
                        {subCategories.length > 0 && (
                          <div className="ml-6 space-y-1">
                            {subCategories.map(subCategory => {
                              const subUsage = categoryUsage.get(subCategory) ?? 0;
                              const isSubActive = categoryFilter !== 'all' && categoriesEqual(subCategory, categoryFilter);
                              
                              return (
                                <div key={subCategory}>
                                  <button
                                    type="button"
                                    onClick={() => handleCategorySelect(subCategory)}
                                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                                      isSubActive ? 'bg-gray-50 text-gray-700' : 'text-gray-600 hover:bg-gray-25'
                                    }`}
                                  >
                                    <span className="truncate flex items-center gap-2">
                                      <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                      {translateCategoryName(subCategory, t)}
                                    </span>
                                    <span className="text-xs text-gray-500">{subUsage}</span>
                                  </button>
                                  <div className="mt-1 flex items-center gap-2 px-5 text-[11px]">
                                    <button
                                      type="button"
                                      onClick={() => handleCategoryRename(subCategory)}
                                      className="text-gray-400 transition-colors hover:text-gray-600"
                                      title={t('products.editCategoryTooltip')}
                                    >
                                      {t('products.editCategory')}
                                    </button>
                                    <span className="text-gray-300">-</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCategoryDelete(subCategory)}
                                      className="text-red-500 transition-colors hover:text-red-600"
                                    >
                                      {t('products.deleteCategory')}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Orphan Alt Kategoriler (Ana kategorisi olmayan) */}
                  {orphanSubCategories.length > 0 && (
                    <div className="space-y-1 mt-4">
                      <div className="px-2 py-1">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('products.subCategories')}</div>
                      </div>
                      {orphanSubCategories.map(category => {
                        const usage = categoryUsage.get(category) ?? 0;
                        const isActive = categoryFilter !== 'all' && categoriesEqual(category, categoryFilter);
                        
                        return (
                          <div key={category} className="ml-4">
                            <button
                              type="button"
                              onClick={() => handleCategorySelect(category)}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                                isActive ? 'bg-gray-50 text-gray-700' : 'text-gray-600 hover:bg-gray-25'
                              }`}
                            >
                              <span className="truncate flex items-center gap-2">
                                <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                {translateCategoryName(category, t)}
                              </span>
                              <span className="text-xs text-gray-500">{usage}</span>
                            </button>
                            <div className="mt-1 flex items-center gap-2 px-5 text-[11px]">
                              <button
                                type="button"
                                onClick={() => handleCategoryRename(category)}
                                className="text-gray-400 transition-colors hover:text-gray-600"
                                title={t('products.editCategoryTooltip')}
                              >
                                {t('products.editCategory')}
                              </button>
                              <span className="text-gray-300">-</span>
                              <button
                                type="button"
                                onClick={() => handleCategoryDelete(category)}
                                className="text-red-500 transition-colors hover:text-red-600"
                              >
                                {t('products.deleteCategory')}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
                    title={t('customers.downloadTemplate')}
                  >
                    <Download className="h-4 w-4" />
                    {t('customers.downloadTemplate')}
                  </button>
                  <button
                    type="button"
                    onClick={handleFilePick}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 px-3 py-2 text-sm font-semibold text-purple-600 transition-colors hover:bg-purple-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-300"
                    disabled={!onImportProducts}
                    title={t('customers.importCSV')}
                  >
                    <Upload className="h-4 w-4" />
                    {t('customers.importCSV')}
                  </button>
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
                    <h3 className="text-lg font-semibold text-gray-900">{t('products.noProductsYet')}</h3>
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
                  <table className="w-full min-w-[1024px] table-fixed divide-y divide-gray-200">
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
                        <th className="w-[320px] px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('products.name')}
                        </th>
                        <th className="w-40 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('products.category')}
                        </th>
                        <th className="w-32 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('products.price')}
                        </th>
                        <th className="w-32 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('products.stock')}
                        </th>
                        <th className="w-32 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('products.status')}
                        </th>
                        <th className="sticky right-0 z-10 w-44 min-w-[176px] px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50">
                          {t('products.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {paginatedProducts.map(product => {
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
                            className={`group transition-colors hover:bg-gray-50 ${isSelected ? 'bg-indigo-50' : ''}`}
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
                            <td className="w-[320px] whitespace-nowrap px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                                  <Package className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => onViewProduct(product)}
                                    className="block max-w-[260px] truncate text-left font-medium text-gray-900 transition-colors hover:text-indigo-600"
                                  >
                                    {product.name}
                                  </button>
                                  <div className="hidden text-xs text-gray-500 lg:block">
                                    <span className="inline-block max-w-[260px] truncate" title={`SKU: ${product.sku}`}>
                                      SKU: {product.sku}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="w-40 whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2 min-w-0">
                                <Tag className="h-4 w-4 text-gray-400" />
                                <span className="truncate" title={product.category}>{product.category}</span>
                              </div>
                            </td>
                            <td className="w-32 whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                              <div className="font-semibold">
                                {formatCurrency(product.unitPrice || 0)}
                              </div>
                              <div className="hidden text-xs text-gray-500 lg:block">
                                {t('products.costPrice')}: {formatCurrency(product.costPrice || 0)}
                              </div>
                            </td>
                            <td
                              className="w-32 whitespace-nowrap px-6 py-4 text-sm text-gray-900"
                              title={`${t('products.minStock')}: ${Math.floor(product.reorderLevel)}`}
                            >
                              <div className="font-semibold">
                                {Math.floor(product.stockQuantity)} {product.unit}
                              </div>
                              <div className="text-xs text-gray-500">{t('products.minStock')}: {Math.floor(product.reorderLevel)}</div>
                            </td>
                            <td className="w-32 whitespace-nowrap px-6 py-4 text-sm">
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="sticky right-0 w-44 min-w-[176px] whitespace-nowrap px-6 py-4 text-right text-sm font-medium bg-white group-hover:bg-gray-50">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => onViewProduct(product)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-indigo-600"
                                  title={t('products.viewProduct')}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onEditProduct(product)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600"
                                  title={t('products.edit')}
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteProduct(product.id)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600"
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
            <div className="p-4 border border-t-0 border-gray-200 rounded-b-xl bg-white">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={filteredProducts.length}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
              />
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

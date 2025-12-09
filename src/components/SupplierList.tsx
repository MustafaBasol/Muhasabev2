import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit, Trash2, Mail, Phone, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Pagination from './Pagination';
import SavedViewsBar from './SavedViewsBar';
import { useSavedListViews } from '../hooks/useSavedListViews';
import { safeLocalStorage } from '../utils/localStorageSafe';
import { logger } from '../utils/logger';
import type { Supplier as SupplierModel } from '../api/suppliers';
// preset etiketleri i18n'den alınır

type SupplierRecord = SupplierModel & {
  category?: string;
};

interface SupplierListProps {
  suppliers?: SupplierRecord[];
  onAddSupplier: () => void;
  onEditSupplier: (supplier: SupplierRecord) => void;
  onDeleteSupplier: (supplierId: string) => void;
  onViewSupplier: (supplier: SupplierRecord) => void;
  onSelectSupplier?: (supplier: SupplierRecord) => void;
  selectionMode?: boolean;
}

type SupplierListViewState = {
  searchTerm: string;
  categoryFilter: string;
  startDate?: string;
  endDate?: string;
  pageSize?: number;
};

const SUPPLIER_PAGE_SIZES = [20, 50, 100] as const;
const isValidSupplierPageSize = (value: number): value is (typeof SUPPLIER_PAGE_SIZES)[number] =>
  SUPPLIER_PAGE_SIZES.includes(value as (typeof SUPPLIER_PAGE_SIZES)[number]);

const toSafeLower = (value?: string | null) => (value ?? '').toLowerCase();

const getSavedSupplierPageSize = (): number => {
  const saved = safeLocalStorage.getItem('suppliers_pageSize');
  const parsed = saved ? Number(saved) : SUPPLIER_PAGE_SIZES[0];
  return isValidSupplierPageSize(parsed) ? parsed : SUPPLIER_PAGE_SIZES[0];
};

export default function SupplierList({ 
  suppliers, 
  onAddSupplier, 
  onEditSupplier, 
  onDeleteSupplier,
  onViewSupplier,
  onSelectSupplier,
  selectionMode = false
}: SupplierListProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];
  // Kategori çok-dilli etiketleri
  const categoryLabels: Record<string, Record<string, string>> = {
    'Ofis Malzemeleri': { tr: 'Ofis Malzemeleri', en: 'Office Supplies', fr: 'Fournitures de bureau', de: 'Büromaterial' },
    'Teknoloji': { tr: 'Teknoloji', en: 'Technology', fr: 'Technologie', de: 'Technologie' },
    'Hizmet': { tr: 'Hizmet', en: 'Services', fr: 'Services', de: 'Dienstleistungen' },
    'Üretim': { tr: 'Üretim', en: 'Manufacturing', fr: 'Production', de: 'Fertigung' },
    'Lojistik': { tr: 'Lojistik', en: 'Logistics', fr: 'Logistique', de: 'Logistik' },
    'Diğer': { tr: 'Diğer', en: 'Other', fr: 'Autre', de: 'Sonstiges' },
  };
  const getCategoryLabel = (value: string) => categoryLabels[value]?.[lang] || value;
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => getSavedSupplierPageSize());
  const safeSuppliers = useMemo(() => (Array.isArray(suppliers) ? suppliers.filter(Boolean) : []), [suppliers]);
  const totalSuppliers = safeSuppliers.length;

  // Default kaydedilmiş görünüm uygula
  const { getDefault } = useSavedListViews<SupplierListViewState>({ listType: 'suppliers' });
  useEffect(() => {
    const def = getDefault();
    if (def && def.state) {
      try {
        setSearchTerm(def.state.searchTerm ?? '');
        setCategoryFilter(def.state.categoryFilter ?? 'all');
        if (def.state.startDate) setStartDate(def.state.startDate);
        if (def.state.endDate) setEndDate(def.state.endDate);
        if (def.state.pageSize && isValidSupplierPageSize(def.state.pageSize)) {
          handlePageSizeChange(def.state.pageSize);
        }
      } catch (error) {
        logger.warn('Failed to hydrate supplier saved view', error);
      }
    }
  }, []);

  const categories = ['Ofis Malzemeleri', 'Teknoloji', 'Hizmet', 'Üretim', 'Lojistik', 'Diğer'];

  const filteredSuppliers = useMemo(() => {
    const lookup = searchTerm.trim().toLowerCase();
    return safeSuppliers.filter((supplier) => {
      const name = toSafeLower(supplier?.name);
      const email = toSafeLower(supplier?.email);
      const company = toSafeLower(supplier?.company);
      const matchesSearch = !lookup || name.includes(lookup) || email.includes(lookup) || company.includes(lookup);
      const matchesCategory = categoryFilter === 'all' || supplier?.category === categoryFilter;
      let matchesDate = true;
      const createdAt = supplier?.createdAt ? new Date(supplier.createdAt) : null;
      if (createdAt && startDate) matchesDate = matchesDate && createdAt >= new Date(startDate);
      if (createdAt && endDate) matchesDate = matchesDate && createdAt <= new Date(endDate);
      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [safeSuppliers, searchTerm, categoryFilter, startDate, endDate]);

  const paginatedSuppliers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSuppliers.slice(start, start + pageSize);
  }, [filteredSuppliers, page, pageSize]);

  useEffect(() => {
    // Filtre değiştiğinde ilk sayfaya dön
    setPage(1);
  }, [searchTerm, categoryFilter, startDate, endDate]);

  const handlePageSizeChange = (size: number) => {
    const nextSize = isValidSupplierPageSize(size) ? size : SUPPLIER_PAGE_SIZES[0];
    setPageSize(nextSize);
    safeLocalStorage.setItem('suppliers_pageSize', String(nextSize));
    setPage(1);
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="bg-white rounded-xl border border-gray-200 min-w-full lg:min-w-[920px]">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectionMode ? 'Tedarikçi Seç' : t('suppliers.title')}
            </h2>
            <p className="text-sm text-gray-500">
              {totalSuppliers} {t('suppliers.suppliersRegistered')}
            </p>
          </div>
          {!selectionMode && (
            <button
              onClick={onAddSupplier}
              className="flex items-center gap-2 self-start rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700"
            >
              <Plus className="w-4 h-4" />
              <span>{t('suppliers.newSupplier')}</span>
            </button>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t('suppliers.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 md:w-56"
            >
              <option value="all">
                {i18n.language === 'tr' ? 'Tüm kategoriler' : 
                 i18n.language === 'en' ? 'All categories' :
                 i18n.language === 'de' ? 'Alle Kategorien' :
                 i18n.language === 'fr' ? 'Toutes les catégories' : 'All categories'}
              </option>
              {categories.map(category => (
                <option key={category} value={category}>{getCategoryLabel(category)}</option>
              ))}
            </select>
          </div>
          {/* Tarih filtreleri */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-700 whitespace-nowrap">{t('startDate')}</span>
            <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500" />
            <span className="text-sm text-gray-700 whitespace-nowrap">{t('endDate')}</span>
            <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500" />
            {(startDate || endDate) && (
              <button onClick={()=>{setStartDate(''); setEndDate('');}} className="rounded-lg bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200">{t('archive.clearFilters')}</button>
            )}
          </div>
          <div className="flex w-full flex-wrap justify-start sm:justify-end">
            <SavedViewsBar
              listType="suppliers"
              getState={() => ({ searchTerm, categoryFilter, startDate, endDate, pageSize })}
              applyState={(s) => {
                const st: Partial<SupplierListViewState> = s ?? {};
                setSearchTerm(st.searchTerm ?? '');
                setCategoryFilter(st.categoryFilter ?? 'all');
                setStartDate(st.startDate ?? '');
                setEndDate(st.endDate ?? '');
                if (st.pageSize && isValidSupplierPageSize(st.pageSize)) {
                  handlePageSizeChange(st.pageSize);
                }
              }}
              presets={[
                { id:'cat-office', label: getCategoryLabel('Ofis Malzemeleri'), apply:()=> setCategoryFilter('Ofis Malzemeleri') },
                { id:'cat-technology', label: getCategoryLabel('Teknoloji'), apply:()=> setCategoryFilter('Teknoloji') },
                { id:'cat-services', label: getCategoryLabel('Hizmet'), apply:()=> setCategoryFilter('Hizmet') },
                { id:'added-this-month', label: t('presets.addedThisMonth'), apply:()=>{
                  const d = new Date();
                  const s = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
                  const e = new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().slice(0,10);
                  setStartDate(s); setEndDate(e);
                }},
              ]}
            />
          </div>
        </div>
      </div>

      {/* Supplier List */}
      <div className="divide-y divide-gray-200">
        {filteredSuppliers.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || categoryFilter !== 'all' ? t('suppliers.noSuppliersFound') : t('suppliers.noSuppliers')}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || categoryFilter !== 'all'
                ? t('suppliers.noSuppliersFoundDesc')
                : t('suppliers.noSuppliersDesc')}
            </p>
            {!selectionMode && !searchTerm && categoryFilter === 'all' && (
              <button
                onClick={onAddSupplier}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                {t('suppliers.createFirstSupplier')}
              </button>
            )}
          </div>
        ) : (
          paginatedSuppliers.map((supplier, index) => {
            const displayName = supplier.name?.trim() || t('suppliers.unnamed', { defaultValue: 'İsimsiz Tedarikçi' });
            const initials = displayName.charAt(0).toUpperCase();
            const companyName = supplier.company?.trim();
            const emailLabel = supplier.email || t('suppliers.noEmail', { defaultValue: 'E-posta yok' });
            const phoneLabel = supplier.phone || '';
            const supplierKey = supplier.id || `supplier-${index}`;
            const categoryToken = supplier.category || 'Diğer';
            const categoryLabel = getCategoryLabel(categoryToken);
            return (
            <div 
              key={supplierKey} 
              className={`p-4 hover:bg-gray-50 transition-colors ${
                selectionMode ? 'cursor-pointer' : ''
              }`}
              onClick={() => selectionMode && onSelectSupplier?.(supplier)}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start sm:items-center gap-4 min-w-0 w-full">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-orange-600 font-semibold text-lg">
                      {initials}
                    </span>
                  </div>
                  <div className="min-w-0">
                    {selectionMode ? (
                      <h3 className="font-semibold text-gray-900">{displayName}</h3>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onViewSupplier(supplier);
                        }}
                        className="font-semibold text-orange-600 hover:text-orange-800 transition-colors cursor-pointer text-left"
                        title="Tedarikçi detaylarını görüntüle"
                      >
                        {displayName}
                      </button>
                    )}
                    {companyName && (
                      <p className="text-sm text-gray-600 flex items-center truncate">
                        <Building2 className="w-3 h-3 mr-1" />
                        <span className="truncate">{companyName}</span>
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 min-w-0">
                      <span className="text-sm text-gray-500 flex items-center truncate">
                        <Mail className="w-3 h-3 mr-1" />
                        <span className="truncate">{emailLabel}</span>
                      </span>
                      {phoneLabel && (
                        <span className="text-sm text-gray-500 flex items-center truncate">
                          <Phone className="w-3 h-3 mr-1" />
                          <span className="truncate">{phoneLabel}</span>
                        </span>
                      )}
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                        {categoryLabel}
                      </span>
                    </div>

                    {/* Mobile actions */}
                    {!selectionMode && (
                      <div className="flex items-center gap-2 mt-3 sm:hidden">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditSupplier(supplier); }}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          aria-label="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteSupplier(supplier.id); }}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {!selectionMode && (
                  <div className="hidden sm:flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => onEditSupplier(supplier)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteSupplier(supplier.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>
      {/* Pagination */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filteredSuppliers.length}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
      </div>
    </div>
  );
}
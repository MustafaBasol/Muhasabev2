import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit, Trash2, Mail, Phone, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Pagination from './Pagination';

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  taxNumber: string;
  company: string;
  category: string;
  createdAt: string;
}

interface SupplierListProps {
  suppliers: Supplier[];
  onAddSupplier: () => void;
  onEditSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (supplierId: string) => void;
  onViewSupplier: (supplier: Supplier) => void;
  onSelectSupplier?: (supplier: Supplier) => void;
  selectionMode?: boolean;
}

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
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('suppliers_pageSize') : null;
    const n = saved ? Number(saved) : 20;
    return [20, 50, 100].includes(n) ? n : 20;
  });

  const categories = ['Ofis Malzemeleri', 'Teknoloji', 'Hizmet', 'Üretim', 'Lojistik', 'Diğer'];

  const filteredSuppliers = useMemo(() => suppliers.filter(supplier => {
    const matchesSearch = 
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.company || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || supplier.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }), [suppliers, searchTerm, categoryFilter]);

  const paginatedSuppliers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSuppliers.slice(start, start + pageSize);
  }, [filteredSuppliers, page, pageSize]);

  useEffect(() => {
    // Filtre değiştiğinde ilk sayfaya dön
    setPage(1);
  }, [searchTerm, categoryFilter]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    if (typeof window !== 'undefined') {
      localStorage.setItem('suppliers_pageSize', String(size));
    }
    setPage(1);
  };

  return (
    <div className="overflow-x-auto">
      <div className="bg-white rounded-xl border border-gray-200 min-w-[720px]">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {selectionMode ? 'Tedarikçi Seç' : t('suppliers.title')}
            </h2>
            <p className="text-sm text-gray-500">
              {suppliers.length} {t('suppliers.suppliersRegistered')}
            </p>
          </div>
          {!selectionMode && (
            <button
              onClick={onAddSupplier}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t('suppliers.newSupplier')}</span>
            </button>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t('suppliers.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">
              {i18n.language === 'tr' ? 'Tüm kategoriler' : 
               i18n.language === 'en' ? 'All categories' :
               i18n.language === 'de' ? 'Alle Kategorien' :
               i18n.language === 'fr' ? 'Toutes les catégories' : 'All categories'}
            </option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
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
          paginatedSuppliers.map((supplier) => (
            <div 
              key={supplier.id} 
              className={`p-4 hover:bg-gray-50 transition-colors ${
                selectionMode ? 'cursor-pointer' : ''
              }`}
              onClick={() => selectionMode && onSelectSupplier?.(supplier)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-orange-600 font-semibold text-lg">
                      {supplier.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    {selectionMode ? (
                      <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
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
                        {supplier.name}
                      </button>
                    )}
                    {supplier.company && (
                      <p className="text-sm text-gray-600 flex items-center truncate">
                        <Building2 className="w-3 h-3 mr-1" />
                        <span className="truncate">{supplier.company}</span>
                      </p>
                    )}
                    <div className="flex items-center space-x-4 mt-1 min-w-0">
                      <span className="text-sm text-gray-500 flex items-center truncate">
                        <Mail className="w-3 h-3 mr-1" />
                        <span className="truncate">{supplier.email}</span>
                      </span>
                      {supplier.phone && (
                        <span className="text-sm text-gray-500 flex items-center truncate">
                          <Phone className="w-3 h-3 mr-1" />
                          <span className="truncate">{supplier.phone}</span>
                        </span>
                      )}
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                        {supplier.category}
                      </span>
                    </div>

                    {/* Mobile actions */}
                    {!selectionMode && (
                      <div className="flex items-center gap-2 mt-2 sm:hidden">
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
          ))
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
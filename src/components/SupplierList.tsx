import React, { useState } from 'react';
import { Search, Plus, Edit, Trash2, Mail, Phone, Building2, MapPin } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = ['Ofis Malzemeleri', 'Teknoloji', 'Hizmet', 'Üretim', 'Lojistik', 'Diğer'];

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = 
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.company || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || supplier.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {selectionMode ? 'Tedarikçi Seç' : 'Tedarikçiler'}
            </h2>
            <p className="text-sm text-gray-500">
              {suppliers.length} tedarikçi kayıtlı
            </p>
          </div>
          {!selectionMode && (
            <button
              onClick={onAddSupplier}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Tedarikçi</span>
            </button>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Tedarikçi ara..."
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
            <option value="all">Tüm Kategoriler</option>
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
              {searchTerm || categoryFilter !== 'all' ? 'Tedarikçi bulunamadı' : 'Henüz tedarikçi yok'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || categoryFilter !== 'all'
                ? 'Arama kriterlerinize uygun tedarikçi bulunamadı.'
                : 'İlk tedarikçinizi ekleyerek başlayın.'
              }
            </p>
            {!selectionMode && !searchTerm && categoryFilter === 'all' && (
              <button
                onClick={onAddSupplier}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                İlk Tedarikçiyi Ekle
              </button>
            )}
          </div>
        ) : (
          filteredSuppliers.map((supplier) => (
            <div 
              key={supplier.id} 
              className={`p-4 hover:bg-gray-50 transition-colors ${
                selectionMode ? 'cursor-pointer' : ''
              }`}
              onClick={() => selectionMode && onSelectSupplier?.(supplier)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-orange-600 font-semibold text-lg">
                      {supplier.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
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
                      <p className="text-sm text-gray-600 flex items-center">
                        <Building2 className="w-3 h-3 mr-1" />
                        {supplier.company}
                      </p>
                    )}
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-sm text-gray-500 flex items-center">
                        <Mail className="w-3 h-3 mr-1" />
                        {supplier.email}
                      </span>
                      {supplier.phone && (
                        <span className="text-sm text-gray-500 flex items-center">
                          <Phone className="w-3 h-3 mr-1" />
                          {supplier.phone}
                        </span>
                      )}
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                        {supplier.category}
                      </span>
                    </div>
                  </div>
                </div>
                
                {!selectionMode && (
                  <div className="flex items-center space-x-2">
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
    </div>
  );
}
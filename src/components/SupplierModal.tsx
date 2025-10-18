import React, { useState } from 'react';
import { X, User, Mail, Phone, MapPin, Building2, Tag } from 'lucide-react';

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

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: Supplier) => void;
  supplier?: Supplier | null;
}

const categories = ['Ofis Malzemeleri', 'Teknoloji', 'Hizmet', 'Üretim', 'Lojistik', 'Diğer'];

export default function SupplierModal({ isOpen, onClose, onSave, supplier }: SupplierModalProps) {
  const [supplierData, setSupplierData] = useState({
    name: supplier?.name || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    taxNumber: supplier?.taxNumber || '',
    company: supplier?.company || '',
    category: supplier?.category || 'Diğer'
  });

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen && supplier) {
      // Editing existing supplier - load data
      setSupplierData({
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        taxNumber: supplier.taxNumber,
        company: supplier.company,
        category: supplier.category
      });
    } else if (isOpen && !supplier) {
      // New supplier - reset form
      setSupplierData({
        name: '',
        email: '',
        phone: '',
        address: '',
        taxNumber: '',
        company: '',
        category: 'Diğer'
      });
    }
  }, [isOpen, supplier]);

  const handleSave = () => {
    const newSupplier: Supplier = {
      id: supplier?.id || Date.now().toString(),
      ...supplierData,
      createdAt: supplier?.createdAt || new Date().toISOString()
    };
    onSave(newSupplier);
    onClose();
    setSupplierData({
      name: '',
      email: '',
      phone: '',
      address: '',
      taxNumber: '',
      company: '',
      category: 'Diğer'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {supplier ? 'Tedarikçiyi Düzenle' : 'Yeni Tedarikçi Ekle'}
              </h2>
              <p className="text-sm text-gray-500">Tedarikçi bilgilerini girin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Tedarikçi Adı *
              </label>
              <input
                type="text"
                value={supplierData.name}
                onChange={(e) => setSupplierData({...supplierData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="ABC Tedarik Ltd."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Şirket Adı
              </label>
              <input
                type="text"
                value={supplierData.company}
                onChange={(e) => setSupplierData({...supplierData, company: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="ABC Tedarik Ltd. Şti."
              />
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                E-posta *
              </label>
              <input
                type="email"
                value={supplierData.email}
                onChange={(e) => setSupplierData({...supplierData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="info@abctedarik.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Telefon
              </label>
              <input
                type="tel"
                value={supplierData.phone}
                onChange={(e) => setSupplierData({...supplierData, phone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="+90 555 123 45 67"
              />
            </div>
          </div>

          {/* Category and Tax Number */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="w-4 h-4 inline mr-2" />
                Kategori *
              </label>
              <select
                value={supplierData.category}
                onChange={(e) => setSupplierData({...supplierData, category: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vergi Numarası
              </label>
              <input
                type="text"
                value={supplierData.taxNumber}
                onChange={(e) => setSupplierData({...supplierData, taxNumber: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="1234567890"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-2" />
              Adres
            </label>
            <textarea
              value={supplierData.address}
              onChange={(e) => setSupplierData({...supplierData, address: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              rows={3}
              placeholder="Tam adres bilgisi..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={!supplierData.name || !supplierData.email}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {supplier ? 'Güncelle' : 'Tedarikçi Ekle'}
          </button>
        </div>
      </div>
    </div>
  );
}
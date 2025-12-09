import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

// Temel kategori anahtarları (depoda Türkçe stringler kullanılıyordu; görüntü çok-dilli)
const baseCategories = ['Ofis Malzemeleri', 'Teknoloji', 'Hizmet', 'Üretim', 'Lojistik', 'Diğer'];

export default function SupplierModal({ isOpen, onClose, onSave, supplier }: SupplierModalProps) {
  const { t } = useTranslation('common');
  const { i18n } = useTranslation();
  const [supplierData, setSupplierData] = useState({
    name: supplier?.name || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    taxNumber: supplier?.taxNumber || '',
    company: supplier?.company || '',
    category: supplier?.category || 'Diğer'
  });

  // Kategori etiketleri (SupplierList ile tutarlı)
  const categoryLabels: Record<string, Record<string, string>> = {
    'Ofis Malzemeleri': { tr: 'Ofis Malzemeleri', en: 'Office Supplies', fr: 'Fournitures de bureau', de: 'Büromaterial' },
    'Teknoloji': { tr: 'Teknoloji', en: 'Technology', fr: 'Technologie', de: 'Technologie' },
    'Hizmet': { tr: 'Hizmet', en: 'Services', fr: 'Services', de: 'Dienstleistungen' },
    'Üretim': { tr: 'Üretim', en: 'Manufacturing', fr: 'Production', de: 'Fertigung' },
    'Lojistik': { tr: 'Lojistik', en: 'Logistics', fr: 'Logistique', de: 'Logistik' },
    'Diğer': { tr: 'Diğer', en: 'Other', fr: 'Autre', de: 'Sonstiges' },
  };
  const getCategoryLabel = (val: string) => categoryLabels[val]?.[i18n.language] || val;

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
      ...supplierData,
      // id ve createdAt sadece mevcut tedarikçi düzenleniyorsa eklenecek
      ...(supplier?.id ? { id: supplier.id, createdAt: supplier.createdAt } : {} as Partial<Supplier>),
    } as Supplier;
    
    // Only include ID if editing existing supplier (yukarıda eklendi)

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center p-4 z-50 overflow-y-auto items-start sm:items-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {supplier ? (t('suppliers.modal.editTitle') || 'Tedarikçiyi Düzenle') : (t('suppliers.modal.newTitle') || 'Yeni Tedarikçi Ekle')}
              </h2>
              <p className="text-sm text-gray-500">{t('suppliers.modal.subtitle') || 'Tedarikçi bilgilerini girin'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                {t('suppliers.modal.nameLabel') || 'Tedarikçi Adı'} *
              </label>
              <input
                type="text"
                value={supplierData.name}
                onChange={(e) => setSupplierData({...supplierData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder={t('suppliers.modal.namePlaceholder') || 'ABC Tedarik Ltd.'}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                {t('suppliers.modal.companyLabel') || 'Şirket Adı'}
              </label>
              <input
                type="text"
                value={supplierData.company}
                onChange={(e) => setSupplierData({...supplierData, company: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder={t('suppliers.modal.companyPlaceholder') || 'ABC Tedarik Ltd. Şti.'}
              />
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                {t('suppliers.modal.emailLabel') || 'E-posta'} *
              </label>
              <input
                type="email"
                value={supplierData.email}
                onChange={(e) => setSupplierData({...supplierData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder={t('suppliers.modal.emailPlaceholder') || 'info@abctedarik.com'}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                {t('suppliers.modal.phoneLabel') || 'Telefon'}
              </label>
              <input
                type="tel"
                value={supplierData.phone}
                onChange={(e) => setSupplierData({...supplierData, phone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder={t('suppliers.modal.phonePlaceholder') || '+90 555 123 45 67'}
              />
            </div>
          </div>

          {/* Category and Tax Number */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="w-4 h-4 inline mr-2" />
                {t('suppliers.modal.categoryLabel') || 'Kategori'} *
              </label>
              <select
                value={supplierData.category}
                onChange={(e) => setSupplierData({...supplierData, category: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              >
                {baseCategories.map(category => (
                  <option key={category} value={category}>{getCategoryLabel(category)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('suppliers.modal.taxNumberLabel') || 'Vergi Numarası'}
              </label>
              <input
                type="text"
                value={supplierData.taxNumber}
                onChange={(e) => setSupplierData({...supplierData, taxNumber: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder={t('suppliers.modal.taxNumberPlaceholder') || '1234567890'}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-2" />
              {t('suppliers.modal.addressLabel') || 'Adres'}
            </label>
            <textarea
              value={supplierData.address}
              onChange={(e) => setSupplierData({...supplierData, address: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              rows={3}
              placeholder={t('suppliers.modal.addressPlaceholder') || 'Tam adres bilgisi...'}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!supplierData.name || !supplierData.email}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {supplier ? (t('update') || 'Güncelle') : (t('suppliers.newSupplier') || 'Tedarikçi Ekle')}
          </button>
        </div>
      </div>
    </div>
  );
}
import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Edit, Mail, Phone, MapPin, Building2, User, Calendar, Tag } from 'lucide-react';

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

interface SupplierViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onEdit: (supplier: Supplier) => void;
  onCreateExpense?: (supplier: Supplier) => void;
  onViewHistory?: (supplier: Supplier) => void;
}

export default function SupplierViewModal({ 
  isOpen, 
  onClose, 
  supplier, 
  onEdit,
  onCreateExpense,
  onViewHistory
}: SupplierViewModalProps) {
  if (!isOpen || !supplier) {
    return null;
  }

  const { t, i18n } = useTranslation();
  const getActiveLang = () => {
    try {
      const stored = localStorage.getItem('i18nextLng');
      if (stored && stored.length >= 2) return stored.slice(0,2).toLowerCase();
    } catch {}
    const cand = (i18n.resolvedLanguage || i18n.language || 'en') as string;
    return cand.slice(0,2).toLowerCase();
  };
  const toLocale = (l: string) => (l === 'tr' ? 'tr-TR' : l === 'de' ? 'de-DE' : l === 'fr' ? 'fr-FR' : 'en-US');
  const lang = getActiveLang();
  const L = {
    details: { tr:'Tedarikçi Detayları', en:'Supplier Details', fr:'Détails Fournisseur', de:'Lieferant Details' }[lang as 'tr'|'en'|'fr'|'de'] || 'Supplier Details',
    createdBy: { tr:'Oluşturan', en:'Created by', fr:'Créé par', de:'Erstellt von' }[lang as 'tr'|'en'|'fr'|'de'] || 'Created by',
    createdAt: { tr:'Oluşturulma', en:'Created at', fr:'Créé le', de:'Erstellt am' }[lang as 'tr'|'en'|'fr'|'de'] || 'Created at',
    updatedBy: { tr:'Son güncelleyen', en:'Last updated by', fr:'Dernière mise à jour par', de:'Zuletzt aktualisiert von' }[lang as 'tr'|'en'|'fr'|'de'] || 'Last updated by',
    updatedAt: { tr:'Son güncelleme', en:'Last updated', fr:'Dernière mise à jour', de:'Zuletzt aktualisiert' }[lang as 'tr'|'en'|'fr'|'de'] || 'Last updated',
    basicInfo: { tr:'Temel Bilgiler', en:'Basic Information', fr:'Informations de base', de:'Grundinformationen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Basic Information',
    supplierName: { tr:'Tedarikçi Adı', en:'Supplier Name', fr:'Nom du Fournisseur', de:'Lieferantenname' }[lang as 'tr'|'en'|'fr'|'de'] || 'Supplier Name',
    email: { tr:'E-posta', en:'Email', fr:'E-mail', de:'E-Mail' }[lang as 'tr'|'en'|'fr'|'de'] || 'Email',
    phone: { tr:'Telefon', en:'Phone', fr:'Téléphone', de:'Telefon' }[lang as 'tr'|'en'|'fr'|'de'] || 'Phone',
    registeredAt: { tr:'Kayıt Tarihi', en:'Registered Date', fr:"Date d'enregistrement", de:'Registrierungsdatum' }[lang as 'tr'|'en'|'fr'|'de'] || 'Registered Date',
    companyInfo: { tr:'Şirket Bilgileri', en:'Company Information', fr:'Informations Société', de:'Firmendaten' }[lang as 'tr'|'en'|'fr'|'de'] || 'Company Information',
    company: { tr:'Şirket', en:'Company', fr:'Société', de:'Firma' }[lang as 'tr'|'en'|'fr'|'de'] || 'Company',
    category: { tr:'Kategori', en:'Category', fr:'Catégorie', de:'Kategorie' }[lang as 'tr'|'en'|'fr'|'de'] || 'Category',
    taxNumber: { tr:'Vergi No', en:'Tax Number', fr:'Numéro Fiscal', de:'Steuernummer' }[lang as 'tr'|'en'|'fr'|'de'] || 'Tax Number',
    addressInfo: { tr:'Adres Bilgileri', en:'Address Information', fr:"Informations d'adresse", de:'Adressinformationen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Address Information',
    quickActions: { tr:'Hızlı İşlemler', en:'Quick Actions', fr:'Actions Rapides', de:'Schnellaktionen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Quick Actions',
    createExpense: { tr:'Gider Oluştur', en:'Create Expense', fr:'Créer Dépense', de:'Ausgabe erstellen' }[lang as 'tr'|'en'|'fr'|'de'] || 'Create Expense',
    viewHistory: { tr:'Geçmiş İşlemler', en:'View History', fr:'Historique', de:'Verlauf anzeigen' }[lang as 'tr'|'en'|'fr'|'de'] || 'View History',
    edit: { tr:'Düzenle', en:'Edit', fr:'Modifier', de:'Bearbeiten' }[lang as 'tr'|'en'|'fr'|'de'] || 'Edit',
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString(toLocale(lang));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center">
              <span className="text-orange-600 font-bold text-2xl">
                {supplier.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{supplier.name}</h2>
              <p className="text-sm text-gray-500">{L.details}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
        </div>

        <div className="p-6" id={`supplier-${supplier.id}`}>
          {/* Oluşturan / Güncelleyen */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-xs text-gray-600">
            <div>
              <div>
                <span className="text-gray-500">{L.createdBy}:</span>{' '}
                <span className="font-medium">{(supplier as any).createdByName || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">{L.createdAt}:</span>{' '}
                <span className="font-medium">{supplier.createdAt ? new Date(supplier.createdAt).toLocaleString(toLocale(lang)) : '—'}</span>
              </div>
            </div>
            <div>
              <div>
                <span className="text-gray-500">{L.updatedBy}:</span>{' '}
                <span className="font-medium">{(supplier as any).updatedByName || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">{L.updatedAt}:</span>{' '}
                <span className="font-medium">{(supplier as any).updatedAt ? new Date((supplier as any).updatedAt).toLocaleString(toLocale(lang)) : '—'}</span>
              </div>
            </div>
          </div>
          {/* Supplier Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{L.basicInfo}</h3>
              <div className="space-y-4">
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{L.supplierName}:</span>
                    <span className="ml-2 font-medium text-gray-900">{supplier.name}</span>
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <Mail className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{L.email}:</span>
                    <span className="ml-2 font-medium text-gray-900">{supplier.email}</span>
                  </div>
                </div>
                {supplier.phone && (
                  <div className="flex items-center text-sm">
                    <Phone className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <span className="text-gray-600">{L.phone}:</span>
                      <span className="ml-2 font-medium text-gray-900">{supplier.phone}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{L.registeredAt}:</span>
                    <span className="ml-2 font-medium text-gray-900">{formatDate(supplier.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{L.companyInfo}</h3>
              <div className="space-y-4">
                {supplier.company && (
                  <div className="flex items-center text-sm">
                    <Building2 className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <span className="text-gray-600">{L.company}:</span>
                      <span className="ml-2 font-medium text-gray-900">{supplier.company}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <Tag className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{L.category}:</span>
                    <span className="ml-2">
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                        {supplier.category}
                      </span>
                    </span>
                  </div>
                </div>
                {supplier.taxNumber && (
                  <div className="flex items-center text-sm">
                    <span className="w-4 h-4 text-gray-400 mr-3 text-xs font-bold flex items-center justify-center">VN</span>
                    <div>
                      <span className="text-gray-600">{L.taxNumber}:</span>
                      <span className="ml-2 font-medium text-gray-900">{supplier.taxNumber}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          {supplier.address && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{L.addressInfo}</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-start">
                  <MapPin className="w-4 h-4 text-gray-400 mr-3 mt-0.5" />
                  <p className="text-gray-700">{supplier.address}</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{L.quickActions}</h3>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => onCreateExpense?.(supplier)}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                <span>{L.createExpense}</span>
              </button>
              <button 
                onClick={() => onViewHistory?.(supplier)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                <span>{L.viewHistory}</span>
              </button>
              <button 
                onClick={() => {
                  onClose();
                  setTimeout(() => onEdit(supplier), 100);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
              >
                <Edit className="w-4 h-4" />
                <span>{L.edit}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
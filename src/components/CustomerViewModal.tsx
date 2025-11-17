import React from 'react';
import { X, Edit, Mail, Phone, MapPin, Building2, User, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  taxNumber: string;
  company: string;
  createdAt: string;
}

interface CustomerViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onEdit: (customer: Customer) => void;
  onCreateInvoice?: (customer: Customer) => void;
  onRecordPayment?: (customer: Customer) => void;
  onViewHistory?: (customer: Customer) => void;
}

export default function CustomerViewModal({ 
  isOpen, 
  onClose, 
  customer, 
  onEdit,
  onCreateInvoice,
  onRecordPayment,
  onViewHistory
}: CustomerViewModalProps) {
  const { t } = useTranslation();
  if (!isOpen || !customer) {
    return null;
  }

  // Güvenli çeviri yardımcısı: önce common:, sonra düz anahtar; yoksa varsayılan
  const te = (key: string, def: string) => {
    const v1 = t(`common:${key}`, { defaultValue: '' });
    if (v1 && v1 !== `common:${key}` && v1.trim() !== '') return v1;
    const v2 = t(key as any, { defaultValue: '' });
    if (v2 && v2 !== key && v2.trim() !== '') return v2;
    return def;
  };

  // Aktif dili ve tarih yerelini belirle
  const getActiveLang = () => {
    try {
      const stored = localStorage.getItem('i18nextLng');
      if (stored && typeof stored === 'string' && stored.length >= 2) return stored.slice(0,2).toLowerCase();
    } catch {}
    const i18 = (t as any)?.i18n;
    const cand = (i18?.resolvedLanguage || i18?.language || 'en') as string;
    return cand.slice(0,2).toLowerCase();
  };
  const toLocale = (l: string) => (l === 'tr' ? 'tr-TR' : l === 'de' ? 'de-DE' : l === 'fr' ? 'fr-FR' : 'en-US');
  const lang = getActiveLang();
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString(toLocale(lang));

  const L = {
    createdBy: { tr: 'Oluşturan', en: 'Created by', de: 'Erstellt von', fr: 'Créé par' }[lang as 'tr'|'en'|'de'|'fr'] || 'Created by',
    createdAt: { tr: 'Oluşturulma', en: 'Created at', de: 'Erstellt am', fr: 'Créé le' }[lang as 'tr'|'en'|'de'|'fr'] || 'Created at',
    updatedBy: { tr: 'Son güncelleyen', en: 'Last updated by', de: 'Zuletzt aktualisiert von', fr: 'Dernière mise à jour par' }[lang as 'tr'|'en'|'de'|'fr'] || 'Last updated by',
    updatedAt: { tr: 'Son güncelleme', en: 'Last updated', de: 'Zuletzt aktualisiert', fr: 'Dernière mise à jour' }[lang as 'tr'|'en'|'de'|'fr'] || 'Last updated',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center">
              <span className="text-purple-600 font-bold text-2xl">
                {customer.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
              <p className="text-sm text-gray-500">{te('customer.details', 'Customer Details')}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEdit(customer)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Edit className="w-5 h-5 text-gray-500" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6" id={`customer-${customer.id}`}>
          {/* Oluşturan / Güncelleyen */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-xs text-gray-600">
            <div>
              <div>
                <span className="text-gray-500">{L.createdBy}:</span>{' '}
                <span className="font-medium">{(customer as any).createdByName || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">{L.createdAt}:</span>{' '}
                <span className="font-medium">{customer.createdAt ? new Date(customer.createdAt).toLocaleString(toLocale(lang)) : '—'}</span>
              </div>
            </div>
            <div>
              <div>
                <span className="text-gray-500">{L.updatedBy}:</span>{' '}
                <span className="font-medium">{(customer as any).updatedByName || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">{L.updatedAt}:</span>{' '}
                <span className="font-medium">{(customer as any).updatedAt ? new Date((customer as any).updatedAt).toLocaleString(toLocale(lang)) : '—'}</span>
              </div>
            </div>
          </div>
          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{te('customer.personalInfo', 'Personal Information')}</h3>
              <div className="space-y-4">
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{te('customer.name', 'Name')}:</span>
                    <span className="ml-2 font-medium text-gray-900">{customer.name}</span>
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <Mail className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{te('customer.email', 'Email')}:</span>
                    <span className="ml-2 font-medium text-gray-900">{customer.email}</span>
                  </div>
                </div>
                {customer.phone && (
                  <div className="flex items-center text-sm">
                    <Phone className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <span className="text-gray-600">{te('customer.phone', 'Phone')}:</span>
                      <span className="ml-2 font-medium text-gray-900">{customer.phone}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">{te('customer.registeredAt', 'Registered Date')}:</span>
                    <span className="ml-2 font-medium text-gray-900">{formatDate(customer.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{te('customer.companyInfo', 'Company Information')}</h3>
              <div className="space-y-4">
                {customer.company && (
                  <div className="flex items-center text-sm">
                    <Building2 className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <span className="text-gray-600">{te('customer.company', 'Company')}:</span>
                      <span className="ml-2 font-medium text-gray-900">{customer.company}</span>
                    </div>
                  </div>
                )}
                {customer.taxNumber && (
                  <div className="flex items-center text-sm">
                    <span className="w-4 h-4 text-gray-400 mr-3 text-xs font-bold flex items-center justify-center">VN</span>
                    <div>
                      <span className="text-gray-600">{te('customer.taxNumber', 'Tax Number')}:</span>
                      <span className="ml-2 font-medium text-gray-900">{customer.taxNumber}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          {customer.address && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{te('customer.addressInfo', 'Address Information')}</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-start">
                  <MapPin className="w-4 h-4 text-gray-400 mr-3 mt-0.5" />
                  <p className="text-gray-700">{customer.address}</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{te('customer.quickActions', 'Quick Actions')}</h3>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => onCreateInvoice?.(customer)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <span>{te('customer.createInvoice', 'Create Invoice')}</span>
              </button>
              <button 
                onClick={() => onViewHistory?.(customer)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                <span>{te('customer.viewHistory', 'View History')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
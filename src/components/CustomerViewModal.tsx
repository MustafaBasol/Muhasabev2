import React from 'react';
import { X, Edit, Mail, Phone, MapPin, Building2, User, Calendar } from 'lucide-react';

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
  if (!isOpen || !customer) {
    return null;
  }


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
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
              <p className="text-sm text-gray-500">Müşteri Detayları</p>
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
          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Kişisel Bilgiler</h3>
              <div className="space-y-4">
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">Ad Soyad:</span>
                    <span className="ml-2 font-medium text-gray-900">{customer.name}</span>
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <Mail className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">E-posta:</span>
                    <span className="ml-2 font-medium text-gray-900">{customer.email}</span>
                  </div>
                </div>
                {customer.phone && (
                  <div className="flex items-center text-sm">
                    <Phone className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <span className="text-gray-600">Telefon:</span>
                      <span className="ml-2 font-medium text-gray-900">{customer.phone}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">Kayıt Tarihi:</span>
                    <span className="ml-2 font-medium text-gray-900">{formatDate(customer.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Şirket Bilgileri</h3>
              <div className="space-y-4">
                {customer.company && (
                  <div className="flex items-center text-sm">
                    <Building2 className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <span className="text-gray-600">Şirket:</span>
                      <span className="ml-2 font-medium text-gray-900">{customer.company}</span>
                    </div>
                  </div>
                )}
                {customer.taxNumber && (
                  <div className="flex items-center text-sm">
                    <span className="w-4 h-4 text-gray-400 mr-3 text-xs font-bold flex items-center justify-center">VN</span>
                    <div>
                      <span className="text-gray-600">Vergi No:</span>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Adres Bilgileri</h3>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Hızlı İşlemler</h3>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => onCreateInvoice?.(customer)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <span>Fatura Oluştur</span>
              </button>
              <button 
                onClick={() => onViewHistory?.(customer)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                <span>Geçmiş İşlemler</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { X, User, Mail, Phone, MapPin, Building2 } from 'lucide-react';

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

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Customer) => void;
  customer?: Customer | null;
}

export default function CustomerModal({ isOpen, onClose, onSave, customer }: CustomerModalProps) {
  const [customerData, setCustomerData] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    taxNumber: customer?.taxNumber || '',
    company: customer?.company || ''
  });

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen && customer) {
      // Editing existing customer - load data
      setCustomerData({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        taxNumber: customer.taxNumber,
        company: customer.company
      });
    } else if (isOpen && !customer) {
      // New customer - reset form
      setCustomerData({
        name: '',
        email: '',
        phone: '',
        address: '',
        taxNumber: '',
        company: ''
      });
    }
  }, [isOpen, customer]);

  const handleSave = () => {
    const newCustomer: Customer = {
      id: customer?.id || Date.now().toString(),
      ...customerData,
      createdAt: customer?.createdAt || new Date().toISOString()
    };
    onSave(newCustomer);
    onClose();
    setCustomerData({
      name: '',
      email: '',
      phone: '',
      address: '',
      taxNumber: '',
      company: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {customer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri Ekle'}
              </h2>
              <p className="text-sm text-gray-500">Müşteri bilgilerini girin</p>
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
                Müşteri Adı *
              </label>
              <input
                type="text"
                value={customerData.name}
                onChange={(e) => setCustomerData({...customerData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Ahmet Yılmaz"
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
                value={customerData.company}
                onChange={(e) => setCustomerData({...customerData, company: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="ABC Teknoloji Ltd."
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
                value={customerData.email}
                onChange={(e) => setCustomerData({...customerData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="ahmet@example.com"
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
                value={customerData.phone}
                onChange={(e) => setCustomerData({...customerData, phone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="+90 555 123 45 67"
              />
            </div>
          </div>

          {/* Tax Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vergi Numarası
            </label>
            <input
              type="text"
              value={customerData.taxNumber}
              onChange={(e) => setCustomerData({...customerData, taxNumber: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="1234567890"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-2" />
              Adres
            </label>
            <textarea
              value={customerData.address}
              onChange={(e) => setCustomerData({...customerData, address: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
            disabled={!customerData.name || !customerData.email}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {customer ? 'Güncelle' : 'Müşteri Ekle'}
          </button>
        </div>
      </div>
    </div>
  );
}
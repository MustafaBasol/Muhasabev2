import React, { useState } from 'react';
import { X, User, Mail, Phone, MapPin, Building2, FileText, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Customer as CustomerModel } from '../api/customers';
import { CustomerType } from '../api/customers';
import type { CountryCode } from '../utils/pdfGenerator';

type CustomerDraft = Partial<CustomerModel>;

type CustomerFormState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxNumber: string;
  siretNumber: string;
  sirenNumber: string;
  tvaNumber: string;
  customerType: CustomerType | '';
  billingCity: string;
  billingPostalCode: string;
  billingCountry: string;
  company: string;
};

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: CustomerDraft) => void;
  customer?: CustomerDraft | null;
  companyCountry?: CountryCode;
}

export default function CustomerModal({ isOpen, onClose, onSave, customer, companyCountry }: CustomerModalProps) {
  const { t } = useTranslation();

  const buildInitialState = (c?: CustomerDraft | null): CustomerFormState => ({
    name: c?.name || '',
    email: c?.email || '',
    phone: c?.phone || '',
    address: c?.address || '',
    taxNumber: c?.taxNumber || '',
    siretNumber: (c as any)?.siretNumber || '',
    sirenNumber: (c as any)?.sirenNumber || '',
    tvaNumber: (c as any)?.tvaNumber || '',
    customerType: (c as any)?.customerType || '',
    billingCity: (c as any)?.billingAddress?.city || '',
    billingPostalCode: (c as any)?.billingAddress?.postalCode || '',
    billingCountry: (c as any)?.billingAddress?.country || '',
    company: c?.company || '',
  });

  const [customerData, setCustomerData] = useState<CustomerFormState>(() => buildInitialState(customer));
  const [siretError, setSiretError] = useState('');
  const [sirenError, setSirenError] = useState('');

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCustomerData(buildInitialState(customer));
      setSiretError('');
      setSirenError('');
    }
  }, [isOpen, customer]);

  const handleSave = () => {
    // Format validation (warn, not block)
    let valid = true;
    if (customerData.siretNumber && !/^\d{14}$/.test(customerData.siretNumber.replace(/\s/g, ''))) {
      setSiretError('SIRET 14 rakam olmalıdır');
      valid = false;
    } else {
      setSiretError('');
    }
    if (customerData.sirenNumber && !/^\d{9}$/.test(customerData.sirenNumber.replace(/\s/g, ''))) {
      setSirenError('SIREN 9 rakam olmalıdır');
      valid = false;
    } else {
      setSirenError('');
    }
    if (!valid) return;

    const billingAddress =
      customerData.billingCity || customerData.billingPostalCode || customerData.billingCountry
        ? {
            street: customerData.address || undefined,
            city: customerData.billingCity || undefined,
            postalCode: customerData.billingPostalCode || undefined,
            country: customerData.billingCountry ? customerData.billingCountry.toUpperCase() : undefined,
          }
        : undefined;

    const newCustomer: CustomerDraft = {
      name: customerData.name,
      email: customerData.email || undefined,
      phone: customerData.phone || undefined,
      address: customerData.address || undefined,
      taxNumber: customerData.taxNumber || undefined,
      siretNumber: customerData.siretNumber || undefined,
      sirenNumber: customerData.sirenNumber || undefined,
      tvaNumber: customerData.tvaNumber || undefined,
      customerType: (customerData.customerType as CustomerType) || undefined,
      billingAddress: billingAddress,
      company: customerData.company || undefined,
    };

    // Only include ID if editing existing customer
    if (customer?.id) {
      newCustomer.id = customer.id;
      if (customer.createdAt) {
        newCustomer.createdAt = customer.createdAt;
      }
    }

    onSave(newCustomer);
    onClose();
    setCustomerData(buildInitialState(null));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {customer ? t('customers.editCustomer') : t('customers.newCustomer')}
              </h2>
              <p className="text-sm text-gray-500">{t('customers.enterCustomerInfo')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                {t('customers.name')} *
              </label>
              <input
                type="text"
                value={customerData.name}
                onChange={(e) => setCustomerData({...customerData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder={t('customers.namePlaceholder')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                {t('customers.company')}
              </label>
              <input
                type="text"
                value={customerData.company}
                onChange={(e) => setCustomerData({...customerData, company: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder={t('customers.companyPlaceholder')}
              />
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                {t('customers.email')} *
              </label>
              <input
                type="email"
                value={customerData.email}
                onChange={(e) => setCustomerData({...customerData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder={t('customers.emailPlaceholder')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                {t('customers.phone')}
              </label>
              <input
                type="tel"
                value={customerData.phone}
                onChange={(e) => setCustomerData({...customerData, phone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder={t('customers.phonePlaceholder')}
              />
            </div>
          </div>

          {/* Tax Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('customers.taxNumber')}
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
              {t('customers.address')}
            </label>
            <textarea
              value={customerData.address}
              onChange={(e) => setCustomerData({...customerData, address: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={2}
              placeholder={t('customers.addressPlaceholder')}
            />
          </div>

          {/* E-Invoice Section */}
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-amber-600" />
              <span className="font-semibold text-amber-800 text-sm">{t('customers.eInvoiceSection')}</span>
            </div>
            <p className="text-xs text-amber-700">{t('customers.eInvoiceSectionHint')}</p>

            {/* Customer Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('customers.customerType')} <span className="text-red-500">*</span>
              </label>
              <select
                value={customerData.customerType}
                onChange={(e) => setCustomerData({...customerData, customerType: e.target.value as CustomerType | ''})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              >
                <option value="">{t('common.select')}...</option>
                <option value={CustomerType.B2B}>{t('customers.customerTypeB2B')}</option>
                <option value={CustomerType.B2C}>{t('customers.customerTypeB2C')}</option>
              </select>
            </div>

            {/* TVA / VAT */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('customers.tvaNumber')}
              </label>
              <input
                type="text"
                value={customerData.tvaNumber}
                onChange={(e) => setCustomerData({...customerData, tvaNumber: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder={t('customers.tvaNumberPlaceholder')}
              />
            </div>

            {/* SIREN + SIRET */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('customers.sirenNumber')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerData.sirenNumber}
                  onChange={(e) => { setCustomerData({...customerData, sirenNumber: e.target.value}); setSirenError(''); }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${sirenError ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder={t('customers.sirenNumberPlaceholder')}
                  maxLength={9}
                />
                {sirenError && <p className="text-xs text-red-500 mt-1">{sirenError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('customers.siretNumber')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerData.siretNumber}
                  onChange={(e) => { setCustomerData({...customerData, siretNumber: e.target.value}); setSiretError(''); }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${siretError ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder={t('customers.siretNumberPlaceholder')}
                  maxLength={14}
                />
                {siretError && <p className="text-xs text-red-500 mt-1">{siretError}</p>}
              </div>
            </div>

            {/* Billing Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                {t('customers.billingCity')} / {t('customers.billingPostalCode')} / {t('customers.billingCountry')}
                <span className="text-red-500"> *</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={customerData.billingCity}
                  onChange={(e) => setCustomerData({...customerData, billingCity: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  placeholder="Paris"
                />
                <input
                  type="text"
                  value={customerData.billingPostalCode}
                  onChange={(e) => setCustomerData({...customerData, billingPostalCode: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  placeholder="75001"
                />
                <input
                  type="text"
                  value={customerData.billingCountry}
                  onChange={(e) => setCustomerData({...customerData, billingCountry: e.target.value.toUpperCase()})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  placeholder={t('customers.billingCountryPlaceholder')}
                  maxLength={2}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {t('customers.billingCity')} / {t('customers.billingPostalCode')} / {t('customers.billingCountry')}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!customerData.name || !customerData.email}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {customer ? t('common.update') : t('customers.addCustomer')}
          </button>
        </div>
      </div>
    </div>
  );
}
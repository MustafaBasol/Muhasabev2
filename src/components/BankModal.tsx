import React, { useState } from 'react';
import { X, CreditCard, Building2, User, Hash, Globe, DollarSign } from 'lucide-react';

interface Bank {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  balance: number;
  currency: string;
  accountType: 'checking' | 'savings' | 'business';
  isActive: boolean;
  createdAt: string;
}

interface BankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bank: Bank) => void;
  bank?: Bank | null;
  bankAccount?: Bank | null;
}

const currencies = [
  { code: 'TRY', name: 'Türk Lirası', symbol: '₺' },
  { code: 'USD', name: 'Amerikan Doları', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'İngiliz Sterlini', symbol: '£' }
];

const bankNames = [
  'Türkiye İş Bankası',
  'Garanti BBVA',
  'Yapı Kredi Bankası',
  'Akbank',
  'Ziraat Bankası',
  'Halkbank',
  'VakıfBank',
  'QNB Finansbank',
  'DenizBank',
  'İNG Bank',
  'HSBC',
  'Şekerbank',
  'TEB',
  'Odeabank',
  'Diğer'
];

export default function BankModal({ isOpen, onClose, onSave, bank, bankAccount }: BankModalProps) {
  // Use bankAccount if provided, otherwise use bank
  const initialBankData = bankAccount || bank;
  
  const [bankData, setBankData] = useState({
    bankName: initialBankData?.bankName || '',
    accountName: initialBankData?.accountName || '',
    accountNumber: initialBankData?.accountNumber || '',
    iban: initialBankData?.iban || '',
    balance: initialBankData?.balance || 0,
    currency: initialBankData?.currency || 'TRY',
    accountType: initialBankData?.accountType || 'checking',
    isActive: initialBankData?.isActive !== undefined ? initialBankData.isActive : true
  });

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen && initialBankData) {
      // Editing existing bank - load data
      setBankData({
        bankName: initialBankData.bankName,
        accountName: initialBankData.accountName,
        accountNumber: initialBankData.accountNumber,
        iban: initialBankData.iban,
        balance: initialBankData.balance || 0,
        currency: initialBankData.currency,
        accountType: initialBankData.accountType,
        isActive: initialBankData.isActive
      });
    } else if (isOpen && !initialBankData) {
      // New bank - reset form
      setBankData({
        bankName: '',
        accountName: '',
        accountNumber: '',
        iban: '',
        balance: 0,
        currency: 'TRY',
        accountType: 'checking',
        isActive: true
      });
    }
  }, [isOpen, initialBankData]);

  const handleSave = () => {
    const newBank: Bank = {
      id: initialBankData?.id || Date.now().toString(),
      ...bankData,
      createdAt: initialBankData?.createdAt || new Date().toISOString()
    };
    onSave(newBank);
    onClose();
  };

  const formatIban = (value: string) => {
    // Remove spaces and convert to uppercase
    const cleaned = value.replace(/\s/g, '').toUpperCase();
    // Add spaces every 4 characters
    return cleaned.replace(/(.{4})/g, '$1 ').trim();
  };

  const handleIbanChange = (value: string) => {
    const formatted = formatIban(value);
    setBankData({...bankData, iban: formatted});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {initialBankData ? 'Hesabı Düzenle' : 'Yeni Banka Hesabı'}
              </h2>
              <p className="text-sm text-gray-500">Banka hesap bilgilerini girin</p>
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
          {/* Bank and Account Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Banka Adı *
              </label>
              <select
                value={bankData.bankName}
                onChange={(e) => setBankData({...bankData, bankName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              >
                <option value="">Banka seçin</option>
                {bankNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Hesap Adı *
              </label>
              <input
                type="text"
                value={bankData.accountName}
                onChange={(e) => setBankData({...bankData, accountName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Şirket Adı veya Kişi Adı"
                required
              />
            </div>
          </div>

          {/* Account Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Hash className="w-4 h-4 inline mr-2" />
                Hesap Numarası *
              </label>
              <input
                type="text"
                value={bankData.accountNumber}
                onChange={(e) => setBankData({...bankData, accountNumber: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="1234567890"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hesap Türü
              </label>
              <select
                value={bankData.accountType}
                onChange={(e) => setBankData({...bankData, accountType: e.target.value as any})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="checking">Vadesiz Hesap</option>
                <option value="savings">Vadeli Hesap</option>
                <option value="business">Ticari Hesap</option>
              </select>
            </div>
          </div>

          {/* IBAN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Globe className="w-4 h-4 inline mr-2" />
              IBAN *
            </label>
            <input
              type="text"
              value={bankData.iban}
              onChange={(e) => handleIbanChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              maxLength={34}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              IBAN otomatik olarak formatlanacaktır
            </p>
          </div>

          {/* Balance and Currency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-2" />
                Mevcut Bakiye
              </label>
              <input
                type="number"
                value={bankData.balance}
                onChange={(e) => setBankData({...bankData, balance: parseFloat(e.target.value) || 0})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Para Birimi
              </label>
              <select
                value={bankData.currency}
                onChange={(e) => setBankData({...bankData, currency: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {currencies.map(currency => (
                  <option key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="isActive"
              checked={bankData.isActive}
              onChange={(e) => setBankData({...bankData, isActive: e.target.checked})}
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Hesap aktif
            </label>
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
            disabled={!bankData.bankName || !bankData.accountName || !bankData.accountNumber || !bankData.iban}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initialBankData ? 'Güncelle' : 'Hesap Ekle'}
          </button>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { X, CreditCard, Building2, User, Hash, Globe, DollarSign } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';

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
  // Şirket ayarlarındaki seçili ülke: TR | US | DE | FR | OTHER
  country?: 'TR' | 'US' | 'DE' | 'FR' | 'OTHER' | string;
}

// Ülkelere göre banka isimleri
const bankNamesByCountry: Record<string, string[]> = {
  TR: [
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
  ],
  DE: [
    'Deutsche Bank',
    'Commerzbank',
    'Sparkasse',
    'Volksbank',
    'N26',
    'DKB',
    'ING-DiBa',
    'Postbank',
    'HypoVereinsbank',
    'Targobank',
    'Consorsbank',
    'Andere'
  ],
  FR: [
    'BNP Paribas',
    'Société Générale',
    'Crédit Agricole',
    'Crédit Mutuel',
    'Banque Populaire',
    'La Banque Postale',
    'Crédit du Nord',
    'HSBC France',
    'LCL',
    'Boursorama',
    'Hello bank!',
    'Autre'
  ],
  US: [
    'Bank of America',
    'Chase',
    'Wells Fargo',
    'Citi',
    'US Bank',
    'Capital One',
    'PNC',
    'TD Bank',
    'Truist',
    'Other'
  ],
  OTHER: ['Other']
};

export default function BankModal({ isOpen, onClose, onSave, bank, bankAccount, country }: BankModalProps) {
  const { t } = useTranslation();
  const { currency: defaultCurrency } = useCurrency();
  const normalizedCountry = (country || 'TR').toUpperCase();
  const bankNames = bankNamesByCountry[normalizedCountry] || bankNamesByCountry['OTHER'];
  const showIBAN = normalizedCountry !== 'US';
  const showRoutingNumber = normalizedCountry === 'US';
  const showSwiftBic = normalizedCountry === 'DE' || normalizedCountry === 'FR';
  const showBranchCode = normalizedCountry === 'TR';
  
  // Dynamic currency list with translations
  const currencies = [
    { code: 'TRY', name: t('currencies.TRY'), symbol: '₺' },
    { code: 'USD', name: t('currencies.USD'), symbol: '$' },
    { code: 'EUR', name: t('currencies.EUR'), symbol: '€' },
    { code: 'GBP', name: t('currencies.GBP'), symbol: '£' }
  ];
  
  // Use bankAccount if provided, otherwise use bank
  const initialBankData = bankAccount || bank;
  
  const [bankData, setBankData] = useState({
    bankName: initialBankData?.bankName || '',
    accountName: initialBankData?.accountName || '',
    accountNumber: initialBankData?.accountNumber || '',
    iban: initialBankData?.iban || '',
    branchCode: (initialBankData as any)?.branchCode || '',
    routingNumber: (initialBankData as any)?.routingNumber || '',
    swiftBic: (initialBankData as any)?.swiftBic || '',
    balance: initialBankData?.balance || 0,
    currency: initialBankData?.currency || defaultCurrency,
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
        branchCode: (initialBankData as any).branchCode || '',
        routingNumber: (initialBankData as any).routingNumber || '',
        swiftBic: (initialBankData as any).swiftBic || '',
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
        branchCode: '',
        routingNumber: '',
        swiftBic: '',
        balance: 0,
        currency: defaultCurrency,
        accountType: 'checking',
        isActive: true
      });
    }
  }, [isOpen, initialBankData, defaultCurrency]);

    const handleSave = () => {
    const newBank: any = {
      ...bankData,
    };
    
    // Only include ID if editing
    if (initialBankData?.id) {
      newBank.id = initialBankData.id;
      newBank.createdAt = initialBankData.createdAt;
    }
    
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
                {initialBankData ? t('banks.editAccount') : t('banks.newAccount')}
              </h2>
              <p className="text-sm text-gray-500">{t('banks.enterAccountInfo')}</p>
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
                {t('banks.bankName')} *
              </label>
              <select
                value={bankData.bankName}
                onChange={(e) => setBankData({...bankData, bankName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              >
                <option value="">{t('banks.selectBank')}</option>
                {bankNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                {t('banks.accountName')} *
              </label>
              <input
                type="text"
                value={bankData.accountName}
                onChange={(e) => setBankData({...bankData, accountName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder={t('banks.accountNamePlaceholder')}
                required
              />
            </div>
          </div>

          {/* Account Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Hash className="w-4 h-4 inline mr-2" />
                {t('banks.accountNumber')} *
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
                {t('banks.accountType')}
              </label>
              <select
                value={bankData.accountType}
                onChange={(e) => setBankData({...bankData, accountType: e.target.value as any})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="checking">{t('banks.accountTypes.checking')}</option>
                <option value="savings">{t('banks.accountTypes.savings')}</option>
                <option value="business">{t('banks.accountTypes.business')}</option>
              </select>
            </div>
          </div>

          {/* Ülkeye göre alanlar */}
          {showIBAN && (
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
                placeholder={normalizedCountry === 'DE' ? 'DE00 0000 0000 0000 0000 00' : normalizedCountry === 'FR' ? 'FR00 0000 0000 0000 0000 0000 000' : 'TR00 0000 0000 0000 0000 0000 00'}
                maxLength={34}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('banks.ibanAutoFormat')}
              </p>
            </div>
          )}

          {showRoutingNumber && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('banks.routingNumber')} *
              </label>
              <input
                type="text"
                value={(bankData as any).routingNumber}
                onChange={(e) => setBankData({ ...bankData, routingNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="123456789"
                required
              />
            </div>
          )}

          {showSwiftBic && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('banks.swiftBic')}
              </label>
              <input
                type="text"
                value={(bankData as any).swiftBic}
                onChange={(e) => setBankData({ ...bankData, swiftBic: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="ABCDEF12XXX"
                maxLength={11}
              />
            </div>
          )}

          {showBranchCode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('banks.branchCode')}
              </label>
              <input
                type="text"
                value={(bankData as any).branchCode}
                onChange={(e) => setBankData({ ...bankData, branchCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="1234"
                maxLength={8}
              />
            </div>
          )}

          {/* Balance and Currency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-2" />
                {t('banks.currentBalance')}
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
                {t('banks.currency')}
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
              {t('banks.accountActive')}
            </label>
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
            disabled={!bankData.bankName || !bankData.accountName || !bankData.accountNumber || (showIBAN ? !bankData.iban : !((bankData as any).routingNumber))}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initialBankData ? t('common.update') : t('banks.addAccount')}
          </button>
        </div>
      </div>
    </div>
  );
}
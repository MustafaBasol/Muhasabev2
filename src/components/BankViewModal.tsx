import React from 'react';
import { X, Edit, CreditCard, Building2, User, Hash, Globe, DollarSign, Calendar, Activity } from 'lucide-react';

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

interface BankViewModalProps {
  isOpen?: boolean;
  onClose: () => void;
  bankAccount: Bank | null;
  bank?: Bank | null;
  onEdit: (bank: Bank) => void;
  onAddTransaction?: (bank: Bank) => void;
  onViewTransactions?: (bank: Bank) => void;
}

export default function BankViewModal({ 
  isOpen = true, 
  onClose, 
  bankAccount,
  bank,
  onEdit,
  onAddTransaction,
  onViewTransactions
}: BankViewModalProps) {
  const bankData = bankAccount || bank;
  
  if (!isOpen || !bankData) {
    return null;
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Belirtilmemiş';
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const formatAmount = (amount: number, currency: string = 'TRY') => {
    const symbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
    return `${symbol}${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  const getAccountTypeLabel = (type: string) => {
    const types = {
      checking: 'Vadesiz Hesap',
      savings: 'Vadeli Hesap',
      business: 'Ticari Hesap'
    };
    return types[type as keyof typeof types] || type;
  };

  const getCurrencyName = (code: string) => {
    const currencies = {
      TRY: 'Türk Lirası',
      USD: 'Amerikan Doları',
      EUR: 'Euro',
      GBP: 'İngiliz Sterlini'
    };
    return currencies[code as keyof typeof currencies] || code;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{bankData.bankName}</h2>
              <p className="text-sm text-gray-500">Banka Hesap Detayları</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEdit(bankData)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Düzenle"
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

        <div className="p-6" id={`bank-${bankData.id}`}>
          {/* Balance Card */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Mevcut Bakiye</p>
                <p className="text-3xl font-bold">{formatAmount(bankData.balance, bankData.currency)}</p>
                <p className="text-green-100 text-sm mt-1">{getCurrencyName(bankData.currency)}</p>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  bankData.isActive 
                    ? 'bg-green-400 text-green-900' 
                    : 'bg-gray-400 text-gray-900'
                }`}>
                  {bankData.isActive ? 'Aktif' : 'Pasif'}
                </span>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Hesap Bilgileri</h3>
              <div className="space-y-4">
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">Hesap Adı:</span>
                    <span className="ml-2 font-medium text-gray-900">{bankData.accountName}</span>
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <Hash className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">Hesap No:</span>
                    <span className="ml-2 font-medium text-gray-900">{bankData.accountNumber}</span>
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <Activity className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">Hesap Türü:</span>
                    <span className="ml-2 font-medium text-gray-900">{getAccountTypeLabel(bankData.accountType)}</span>
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">Açılış Tarihi:</span>
                    <span className="ml-2 font-medium text-gray-900">{formatDate(bankData.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Banka Bilgileri</h3>
              <div className="space-y-4">
                <div className="flex items-center text-sm">
                  <Building2 className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">Banka:</span>
                    <span className="ml-2 font-medium text-gray-900">{bankData.bankName}</span>
                  </div>
                </div>
                <div className="flex items-start text-sm">
                  <Globe className="w-4 h-4 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <span className="text-gray-600">IBAN:</span>
                    <div className="ml-2 font-medium text-gray-900 font-mono text-xs bg-gray-100 p-2 rounded mt-1">
                      {bankData.iban}
                    </div>
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <DollarSign className="w-4 h-4 text-gray-400 mr-3" />
                  <div>
                    <span className="text-gray-600">Para Birimi:</span>
                    <span className="ml-2 font-medium text-gray-900">{bankData.currency} - {getCurrencyName(bankData.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Hızlı İşlemler</h3>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => {
                  const iban = bankData.iban.replace(/\s/g, '');
                  navigator.clipboard.writeText(iban);
                  alert('IBAN kopyalandı!');
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <Globe className="w-4 h-4" />
                <span>IBAN Kopyala</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
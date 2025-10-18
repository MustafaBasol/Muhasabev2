import React, { useState } from 'react';
import { Search, Plus, Edit, Trash2, CreditCard, Building2, Eye, DollarSign } from 'lucide-react';

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

interface BankListProps {
  bankAccounts: Bank[];
  onAddBank: () => void;
  onEditBank: (bank: Bank) => void;
  onDeleteBank: (bankId: string) => void;
  onViewBank: (bank: Bank) => void;
}

export default function BankList({ 
  bankAccounts, 
  onAddBank, 
  onEditBank, 
  onDeleteBank,
  onViewBank
}: BankListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredBanks = bankAccounts.filter(bank => {
    const matchesSearch = 
      bank.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bank.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bank.accountNumber.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && bank.isActive) ||
      (statusFilter === 'inactive' && !bank.isActive);
    
    return matchesSearch && matchesStatus;
  });

  const formatAmount = (amount: number, currency: string = 'TRY') => {
    const symbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
    return `${symbol}${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  const getAccountTypeBadge = (type: string) => {
    const typeConfig = {
      checking: { label: 'Vadesiz', class: 'bg-blue-100 text-blue-800' },
      savings: { label: 'Vadeli', class: 'bg-green-100 text-green-800' },
      business: { label: 'Ticari', class: 'bg-purple-100 text-purple-800' }
    };
    
    const config = typeConfig[type as keyof typeof typeConfig];
    if (!config) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {type}
        </span>
      );
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.class}`}>
        {config.label}
      </span>
    );
  };

  const totalBalance = filteredBanks.reduce((sum, bank) => {
    if (bank.currency === 'TRY') return sum + bank.balance;
    return sum;
  }, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Banka Hesapları</h2>
            <p className="text-sm text-gray-500">
              {bankAccounts.length} hesap kayıtlı • Toplam bakiye: {formatAmount(totalBalance)}
            </p>
          </div>
          <button
            onClick={onAddBank}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Hesap</span>
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Banka adı, hesap adı veya hesap numarası ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">Tüm Hesaplar</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </select>
        </div>
      </div>

      {/* Bank List */}
      <div className="divide-y divide-gray-200">
        {filteredBanks.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' ? 'Hesap bulunamadı' : 'Henüz banka hesabı yok'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Arama kriterlerinize uygun hesap bulunamadı.'
                : 'İlk banka hesabınızı ekleyerek başlayın.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={onAddBank}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                İlk Hesabı Ekle
              </button>
            )}
          </div>
        ) : (
          filteredBanks.map((bank) => (
            <div key={bank.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <button
                      onClick={() => onViewBank(bank)}
                      className="font-semibold text-green-600 hover:text-green-800 transition-colors cursor-pointer text-left"
                      title="Hesap detaylarını görüntüle"
                    >
                      {bank.bankName}
                    </button>
                    <p className="text-sm text-gray-600 flex items-center">
                      <Building2 className="w-3 h-3 mr-1" />
                      {bank.accountName}
                    </p>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-sm text-gray-500">
                        {bank.accountNumber}
                      </span>
                      {getAccountTypeBadge(bank.accountType)}
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        bank.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {bank.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 flex items-center">
                      <DollarSign className="w-4 h-4 mr-1 text-green-600" />
                      {formatAmount(bank.balance, bank.currency)}
                    </div>
                    <div className="text-xs text-gray-500">
                      IBAN: {bank.iban.slice(0, 8)}...
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onViewBank(bank)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Görüntüle"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEditBank(bank)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Düzenle"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteBank(bank.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit, Trash2, CreditCard, Building2, Eye, DollarSign } from 'lucide-react';
import { formatCurrency as formatCurrencyUtil, type Currency } from '../utils/currencyFormatter';
import { useTranslation } from 'react-i18next';
import Pagination from './Pagination';

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
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('banks_pageSize') : null;
    const n = saved ? Number(saved) : 20;
    return [20, 50, 100].includes(n) ? n : 20;
  });

  const filteredBanks = useMemo(() => bankAccounts.filter(bank => {
    const matchesSearch = 
      bank.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bank.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bank.accountNumber.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && bank.isActive) ||
      (statusFilter === 'inactive' && !bank.isActive);
    
    return matchesSearch && matchesStatus;
  }), [bankAccounts, searchTerm, statusFilter]);

  const paginatedBanks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBanks.slice(start, start + pageSize);
  }, [filteredBanks, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    if (typeof window !== 'undefined') {
      localStorage.setItem('banks_pageSize', String(size));
    }
    setPage(1);
  };

  const formatAmount = (amount: number, currency: string = 'TRY') => {
    return formatCurrencyUtil(amount, currency as Currency);
  };
  const formatAmountNoSymbol = (amount: number) => {
    const safe = typeof amount === 'number' ? amount : 0;
    return safe.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <div className="min-w-[720px]">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{t('banks.title')}</h2>
            <p className="text-sm text-gray-500">
              {bankAccounts.length} {t('banks.accountsRegistered')} • {t('banks.totalBalance')}: {formatAmountNoSymbol(totalBalance)}
            </p>
          </div>
          <button
            onClick={onAddBank}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('banks.newAccount')}</span>
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t('banks.search')}
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
            <option value="all">{t('banks.filterAll')}</option>
            <option value="active">{t('chartOfAccounts.active')}</option>
            <option value="inactive">{t('chartOfAccounts.passive')}</option>
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
              {searchTerm || statusFilter !== 'all' ? t('banks.noBanksFound') : t('banks.noBanks')}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? t('banks.noBanksFoundDesc')
                : t('banks.noBanksDesc')
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={onAddBank}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {t('banks.createFirstAccount')}
              </button>
            )}
          </div>
        ) : (
          paginatedBanks.map((bank) => (
            <div key={bank.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <button
                      onClick={() => onViewBank(bank)}
                      className="font-semibold text-green-600 hover:text-green-800 transition-colors cursor-pointer text-left"
                      title="Hesap detaylarını görüntüle"
                    >
                      {bank.bankName}
                    </button>
                    <p className="text-sm text-gray-600 flex items-center truncate">
                      <Building2 className="w-3 h-3 mr-1" />
                      <span className="truncate">{bank.accountName}</span>
                    </p>
                    <div className="flex items-center space-x-4 mt-1 min-w-0">
                      <span className="text-sm text-gray-500 truncate">
                        <span className="truncate">{bank.accountNumber}</span>
                      </span>
                      {getAccountTypeBadge(bank.accountType)}
                      {(() => { const active = bank?.isActive !== false; return (
                        <span className={`text-xs px-2 py-1 rounded-full ${active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {active ? 'Aktif' : 'Pasif'}
                        </span>
                      ); })()}
                    </div>

                    {/* Mobile actions */}
                    <div className="flex items-center gap-2 mt-2 sm:hidden">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewBank(bank); }}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        aria-label="View"
                        title={t('common.view') as string}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditBank(bank); }}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        aria-label="Edit"
                        title={t('common.edit') as string}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteBank(bank.id); }}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label="Delete"
                        title={t('common.delete') as string}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 flex items-center">
                      <DollarSign className="w-4 h-4 mr-1 text-green-600 sm:inline hidden" />
                      {formatAmount(bank.balance, bank.currency)}
                    </div>
                    <div className="text-xs text-gray-500">
                      IBAN: {bank.iban.slice(0, 8)}...
                    </div>
                  </div>
                  
                  <div className="hidden sm:flex items-center space-x-2">
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
      <div className="p-4 border-t border-gray-200 bg-white">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filteredBanks.length}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </div>
    </div>
    
  );
}
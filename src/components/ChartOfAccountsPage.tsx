import React, { useState } from 'react';
import { BookOpen, Plus, Edit, Trash2, Search, Eye, FolderOpen, Folder, Save, X, Check } from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parentId?: string;
  isActive: boolean;
  balance: number;
  createdAt: string;
}

interface ChartOfAccountsPageProps {
  accounts?: Account[];
  onAccountsUpdate?: (accounts: Account[]) => void;
  invoices?: any[];
  expenses?: any[];
  sales?: any[];
  customers?: any[];
}

export default function ChartOfAccountsPage({ 
  accounts = [], 
  onAccountsUpdate,
  invoices = [],
  expenses = [],
  sales = [],
  customers = []
}: ChartOfAccountsPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [inlineEditingAccount, setInlineEditingAccount] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState<{[key: string]: string}>({});

  // Demo hesap planı
  const defaultAccounts: Account[] = [
    // VARLIKLAR (ASSETS)
    { id: '1', code: '100', name: 'DÖNEN VARLIKLAR', type: 'asset', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '2', code: '101', name: 'Kasa', type: 'asset', parentId: '1', isActive: true, balance: 15000, createdAt: '2024-01-01' },
    { id: '3', code: '102', name: 'Bankalar', type: 'asset', parentId: '1', isActive: true, balance: 200000, createdAt: '2024-01-01' },
    { id: '4', code: '120', name: 'Alıcılar', type: 'asset', parentId: '1', isActive: true, balance: 85000, createdAt: '2024-01-01' },
    { id: '5', code: '150', name: 'DURAN VARLIKLAR', type: 'asset', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '6', code: '151', name: 'Demirbaşlar', type: 'asset', parentId: '5', isActive: true, balance: 125000, createdAt: '2024-01-01' },
    
    // YÜKÜMLÜLÜKLER (LIABILITIES)
    { id: '7', code: '200', name: 'KISA VADELİ YÜKÜMLÜLÜKLER', type: 'liability', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '8', code: '201', name: 'Satıcılar', type: 'liability', parentId: '7', isActive: true, balance: 45000, createdAt: '2024-01-01' },
    { id: '9', code: '220', name: 'Vergi Dairesi', type: 'liability', parentId: '7', isActive: true, balance: 12000, createdAt: '2024-01-01' },
    
    // ÖZKAYNAKLAR (EQUITY)
    { id: '10', code: '300', name: 'ÖZKAYNAKLAR', type: 'equity', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '11', code: '301', name: 'Sermaye', type: 'equity', parentId: '10', isActive: true, balance: 100000, createdAt: '2024-01-01' },
    { id: '12', code: '302', name: 'Geçmiş Yıl Karları', type: 'equity', parentId: '10', isActive: true, balance: 75000, createdAt: '2024-01-01' },
    
    // GELİRLER (REVENUE)
    { id: '13', code: '600', name: 'GELİRLER', type: 'revenue', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '14', code: '601', name: 'Satış Gelirleri', type: 'revenue', parentId: '13', isActive: true, balance: 250000, createdAt: '2024-01-01' },
    { id: '15', code: '602', name: 'Hizmet Gelirleri', type: 'revenue', parentId: '13', isActive: true, balance: 180000, createdAt: '2024-01-01' },
    
    // GİDERLER (EXPENSES)
    { id: '16', code: '700', name: 'GİDERLER', type: 'expense', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '17', code: '701', name: 'Kira Giderleri', type: 'expense', parentId: '16', isActive: true, balance: 36000, createdAt: '2024-01-01' },
    { id: '18', code: '702', name: 'Personel Giderleri', type: 'expense', parentId: '16', isActive: true, balance: 120000, createdAt: '2024-01-01' },
    { id: '19', code: '703', name: 'Elektrik Giderleri', type: 'expense', parentId: '16', isActive: true, balance: 8500, createdAt: '2024-01-01' },
  ];

  const [currentAccounts, setCurrentAccounts] = useState<Account[]>(
    accounts.length > 0 ? accounts : defaultAccounts
  );

  // Calculate dynamic balances from actual data
  const calculateDynamicBalance = (account: Account): number => {
    const accountCode = account.code;
    const accountType = account.type;
    
    // Calculate based on account type and code
    switch (accountCode) {
      case '101': // Kasa - Cash from completed sales
        return sales
          .filter(sale => sale.status === 'completed' && sale.paymentMethod === 'cash')
          .reduce((sum, sale) => sum + sale.amount, 0);
      
      case '102': // Bankalar - Bank transfers and card payments
        return sales
          .filter(sale => sale.status === 'completed' && (sale.paymentMethod === 'card' || sale.paymentMethod === 'transfer'))
          .reduce((sum, sale) => sum + sale.amount, 0);
      
      case '120': // Alıcılar - Unpaid invoices (receivables)
        return invoices
          .filter(invoice => invoice.status === 'sent' || invoice.status === 'overdue')
          .reduce((sum, invoice) => sum + invoice.total, 0);
      
      case '201': // Satıcılar - Unpaid expenses (payables)
        return expenses
          .filter(expense => expense.status === 'approved')
          .reduce((sum, expense) => sum + expense.amount, 0);
      
      case '601': // Satış Gelirleri - Total sales revenue
        return invoices
          .filter(invoice => invoice.status === 'paid' && invoice.type === 'product')
          .reduce((sum, invoice) => sum + invoice.total, 0);
      
      case '602': // Hizmet Gelirleri - Service revenue (invoices)
        return invoices
          .filter(invoice => invoice.status === 'paid' && invoice.type === 'service')
          .reduce((sum, invoice) => sum + invoice.total, 0);
      
      case '701': // Kira Giderleri - Rent expenses
        return expenses
          .filter(expense => expense.category === 'Kira' && expense.status === 'paid')
          .reduce((sum, expense) => sum + expense.amount, 0);
      
      case '702': // Personel Giderleri - Personnel expenses
        return expenses
          .filter(expense => expense.category === 'Personel' && expense.status === 'paid')
          .reduce((sum, expense) => sum + expense.amount, 0);
      
      case '703': // Elektrik Giderleri - Electricity expenses
        return expenses
          .filter(expense => expense.category === 'Elektrik' && expense.status === 'paid')
          .reduce((sum, expense) => sum + expense.amount, 0);
      
      default:
        // For other accounts, use the stored balance
        return account.balance;
    }
  };

  // Check if account data comes from other pages (should not be editable)
  const isDataFromOtherPages = (account: Account): boolean => {
    const dynamicAccountCodes = ['101', '102', '120', '201', '601', '602', '701', '702', '703'];
    return dynamicAccountCodes.includes(account.code);
  };

  // Update accounts with dynamic balances
  React.useEffect(() => {
    const updatedAccounts = currentAccounts.map(account => ({
      ...account,
      balance: isDataFromOtherPages(account) ? calculateDynamicBalance(account) : account.balance
    }));
    setCurrentAccounts(updatedAccounts);
  }, [invoices, expenses, sales, customers]);

  const filteredAccounts = currentAccounts.filter(account => {
    const matchesSearch = 
      account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.code.includes(searchTerm);
    
    const matchesType = typeFilter === 'all' || account.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const getAccountTypeLabel = (type: string) => {
    const types = {
      asset: 'Varlık',
      liability: 'Yükümlülük',
      equity: 'Özkaynak',
      revenue: 'Gelir',
      expense: 'Gider'
    };
    return types[type as keyof typeof types] || type;
  };

  const getAccountTypeColor = (type: string) => {
    const colors = {
      asset: 'bg-blue-100 text-blue-800',
      liability: 'bg-red-100 text-red-800',
      equity: 'bg-purple-100 text-purple-800',
      revenue: 'bg-green-100 text-green-800',
      expense: 'bg-orange-100 text-orange-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatAmount = (amount: number) => {
    return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  const toggleGroup = (accountId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedGroups(newExpanded);
  };

  const getChildAccounts = (parentId: string) => {
    return filteredAccounts.filter(account => account.parentId === parentId);
  };

  const isParentAccount = (accountId: string) => {
    return filteredAccounts.some(account => account.parentId === accountId);
  };

  // Inline editing functions
  const startInlineEdit = (accountId: string, field: string, currentValue: string | number) => {
    setInlineEditingAccount(accountId);
    setEditingField(field);
    setTempValues({ [field]: String(currentValue) });
  };

  const saveInlineEdit = (account: Account) => {
    if (!editingField || !inlineEditingAccount) return;

    const updatedAccount = { ...account };
    
    if (editingField === 'code') {
      updatedAccount.code = tempValues.code || account.code;
    } else if (editingField === 'name') {
      updatedAccount.name = tempValues.name || account.name;
    } else if (editingField === 'balance') {
      updatedAccount.balance = parseFloat(tempValues.balance) || account.balance;
    }

    const updatedAccounts = currentAccounts.map(acc => 
      acc.id === account.id ? updatedAccount : acc
    );
    
    setCurrentAccounts(updatedAccounts);
    if (onAccountsUpdate) {
      onAccountsUpdate(updatedAccounts);
    }
    
    cancelInlineEdit();
  };

  const cancelInlineEdit = () => {
    setInlineEditingAccount(null);
    setEditingField(null);
    setTempValues({});
  };

  const handleTempValueChange = (field: string, value: string) => {
    setTempValues(prev => ({ ...prev, [field]: value }));
  };

  const addNewAccount = (parentId?: string) => {
    const newAccount: Account = {
      id: Date.now().toString(),
      code: '',
      name: 'Yeni Hesap',
      type: parentId ? getParentAccountType(parentId) : 'asset',
      parentId,
      isActive: true,
      balance: 0,
      createdAt: new Date().toISOString()
    };

    const updatedAccounts = [...currentAccounts, newAccount];
    setCurrentAccounts(updatedAccounts);
    if (onAccountsUpdate) {
      onAccountsUpdate(updatedAccounts);
    }

    // Automatically start editing the new account
    setTimeout(() => {
      startInlineEdit(newAccount.id, 'name', newAccount.name);
    }, 100);
  };

  const getParentAccountType = (parentId: string): Account['type'] => {
    const parent = currentAccounts.find(acc => acc.id === parentId);
    return parent?.type || 'asset';
  };

  // Calculate parent account balance from children
  const calculateParentBalance = (parentId: string): number => {
    const children = currentAccounts.filter(acc => acc.parentId === parentId);
    return children.reduce((total, child) => {
      // If child has its own children, calculate recursively
      const childHasChildren = currentAccounts.some(acc => acc.parentId === child.id);
      if (childHasChildren) {
        return total + calculateParentBalance(child.id);
      }
      return total + (isDataFromOtherPages(child) ? calculateDynamicBalance(child) : child.balance);
    }, 0);
  };

  // Get display balance for account (calculated for parents, actual for children)
  const getDisplayBalance = (account: Account): number => {
    const hasChildren = isParentAccount(account.id);
    if (hasChildren) {
      return calculateParentBalance(account.id);
    }
    return isDataFromOtherPages(account) ? calculateDynamicBalance(account) : account.balance;
  };

  const deleteAccount = (accountId: string) => {
    if (confirm('Bu hesabı silmek istediğinizden emin misiniz?')) {
      // Check if account has children
      const hasChildren = currentAccounts.some(acc => acc.parentId === accountId);
      if (hasChildren) {
        alert('Bu hesabın alt hesapları var. Önce alt hesapları silin.');
        return;
      }

      const updatedAccounts = currentAccounts.filter(acc => acc.id !== accountId);
      setCurrentAccounts(updatedAccounts);
      if (onAccountsUpdate) {
        onAccountsUpdate(updatedAccounts);
      }
    }
  };

  const toggleAccountStatus = (account: Account) => {
    const updatedAccount = { ...account, isActive: !account.isActive };
    const updatedAccounts = currentAccounts.map(acc => 
      acc.id === account.id ? updatedAccount : acc
    );
    
    setCurrentAccounts(updatedAccounts);
    if (onAccountsUpdate) {
      onAccountsUpdate(updatedAccounts);
    }
  };

  const renderAccount = (account: Account, level: number = 0) => {
    const hasChildren = isParentAccount(account.id);
    const isExpanded = expandedGroups.has(account.id);
    const children = getChildAccounts(account.id);
    const isEditing = inlineEditingAccount === account.id;

    return (
      <React.Fragment key={account.id}>
        <tr className="hover:bg-gray-50 transition-colors">
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center" style={{ paddingLeft: `${level * 20}px` }}>
              {hasChildren && (
                <button
                  onClick={() => toggleGroup(account.id)}
                  className="mr-2 p-1 hover:bg-gray-200 rounded"
                >
                  {isExpanded ? (
                    <FolderOpen className="w-4 h-4 text-gray-600" />
                  ) : (
                    <Folder className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              )}
              <div className="flex items-center space-x-3 flex-1">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    {/* Code editing */}
                    {isEditing && editingField === 'code' ? (
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          value={tempValues.code || ''}
                          onChange={(e) => handleTempValueChange('code', e.target.value)}
                          className="w-16 px-2 py-1 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => saveInlineEdit(account)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={cancelInlineEdit}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span 
                        onClick={() => !isDataFromOtherPages(account) && startInlineEdit(account.id, 'code', account.code)}
                        className={`text-sm font-medium text-blue-600 px-1 py-0.5 rounded ${
                          isDataFromOtherPages(account) 
                            ? 'cursor-not-allowed opacity-60' 
                            : 'cursor-pointer hover:bg-blue-50'
                        }`}
                        title={isDataFromOtherPages(account) 
                          ? 'Bu hesap diğer sayfalardan otomatik yönetilir' 
                          : 'Kodu düzenlemek için tıklayın'
                        }
                      >
                        {account.code}
                        {isDataFromOtherPages(account) && (
                          <span className="ml-1 text-xs">🔒</span>
                        )}
                      </span>
                    )}
                    
                    <span className="text-gray-400">-</span>
                    
                    {/* Name editing */}
                    {isEditing && editingField === 'name' ? (
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          value={tempValues.name || ''}
                          onChange={(e) => handleTempValueChange('name', e.target.value)}
                          className="px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => saveInlineEdit(account)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={cancelInlineEdit}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span 
                        onClick={() => !isDataFromOtherPages(account) && startInlineEdit(account.id, 'name', account.name)}
                        className={`text-sm font-medium text-gray-900 px-1 py-0.5 rounded ${
                          isDataFromOtherPages(account) 
                            ? 'cursor-not-allowed opacity-60' 
                            : 'cursor-pointer hover:bg-gray-50'
                        }`}
                        title={isDataFromOtherPages(account) 
                          ? 'Bu hesap diğer sayfalardan otomatik yönetilir' 
                          : 'Adı düzenlemek için tıklayın'
                        }
                      >
                        {account.name}
                        {isDataFromOtherPages(account) && (
                          <span className="ml-1 text-xs">🔒</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAccountTypeColor(account.type)}`}>
              {getAccountTypeLabel(account.type)}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right">
            {isEditing && editingField === 'balance' ? (
              <div className="flex items-center justify-end space-x-1">
                <input
                  type="number"
                  value={tempValues.balance || ''}
                  onChange={(e) => handleTempValueChange('balance', e.target.value)}
                  className="w-24 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                  step="0.01"
                  autoFocus
                />
                <button
                  onClick={() => saveInlineEdit(account)}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={cancelInlineEdit}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="text-right">
                {hasChildren ? (
                  <div>
                    <span className="text-sm font-bold text-blue-600">
                      {formatAmount(getDisplayBalance(account))}
                    </span>
                    <div className="text-xs text-gray-500">
                      (Alt hesaplar toplamı)
                    </div>
                  </div>
                ) : (
                  <span 
                    onClick={() => !isDataFromOtherPages(account) && startInlineEdit(account.id, 'balance', account.balance)}
                    className={`text-sm font-semibold text-gray-900 px-2 py-1 rounded ${
                      isDataFromOtherPages(account) 
                        ? 'cursor-not-allowed opacity-60' 
                        : 'cursor-pointer hover:bg-gray-50'
                    }`}
                    title={isDataFromOtherPages(account) 
                      ? 'Bu hesap diğer sayfalardan otomatik hesaplanır' 
                      : 'Bakiyeyi düzenlemek için tıklayın'
                    }
                  >
                    {formatAmount(getDisplayBalance(account))}
                    {isDataFromOtherPages(account) && (
                      <span className="ml-1 text-xs text-blue-600">🔄</span>
                    )}
                  </span>
                )}
              </div>
            )}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <button
              onClick={() => toggleAccountStatus(account)}
              className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                account.isActive 
                  ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
              title="Durumu değiştirmek için tıklayın"
            >
              {account.isActive ? 'Aktif' : 'Pasif'}
            </button>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <div className="flex items-center justify-end space-x-2">
              <button 
                onClick={() => addNewAccount(account.id)}
                className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Alt hesap ekle"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button 
                onClick={() => deleteAccount(account.id)}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Hesabı sil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
        
        {hasChildren && isExpanded && children.map(child => renderAccount(child, level + 1))}
      </React.Fragment>
    );
  };

  const rootAccounts = filteredAccounts.filter(account => !account.parentId);

  // Calculate totals by type
  const totals = currentAccounts.reduce((acc, account) => {
    // Only count leaf accounts (accounts without children) to avoid double counting
    const hasChildren = isParentAccount(account.id);
    if (!hasChildren && account.isActive) {
      // Use dynamic balance for accounts with data from other pages, actual balance for others
      const balance = isDataFromOtherPages(account) ? calculateDynamicBalance(account) : account.balance;
      acc[account.type] = (acc[account.type] || 0) + balance;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <BookOpen className="w-8 h-8 text-blue-600 mr-3" />
              Hesap Planı
            </h1>
            <p className="text-gray-600">Muhasebe hesap planınızı yönetin</p>
          </div>
          <button 
            onClick={() => addNewAccount()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Ana Hesap</span>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 mb-1">Varlıklar</div>
            <div className="text-lg font-bold text-blue-700">
              {formatAmount(totals.asset || 0)}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-sm text-red-600 mb-1">Yükümlülükler</div>
            <div className="text-lg font-bold text-red-700">
              {formatAmount(totals.liability || 0)}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-purple-600 mb-1">Özkaynaklar</div>
            <div className="text-lg font-bold text-purple-700">
              {formatAmount(totals.equity || 0)}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 mb-1">Gelirler</div>
            <div className="text-lg font-bold text-green-700">
              {formatAmount(totals.revenue || 0)}
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-orange-600 mb-1">Giderler</div>
            <div className="text-lg font-bold text-orange-700">
              {formatAmount(totals.expense || 0)}
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Hesap kodu veya adı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tüm Hesap Türleri</option>
            <option value="asset">Varlıklar</option>
            <option value="liability">Yükümlülükler</option>
            <option value="equity">Özkaynaklar</option>
            <option value="revenue">Gelirler</option>
            <option value="expense">Giderler</option>
          </select>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Hesap Listesi</h3>
              <p className="text-sm text-gray-500">
                {currentAccounts.length} hesap kayıtlı • Düzenlemek için hesap adı, kodu veya bakiyeye tıklayın
              </p>
            </div>
            <div className="text-xs text-gray-500 bg-blue-50 px-3 py-2 rounded-lg">
              💡 İpucu: Hesapları düzenlemek için üzerine tıklayın
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hesap
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tür
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bakiye
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rootAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-lg mb-2">Henüz hesap bulunmuyor</p>
                    <p className="text-gray-400 text-sm">Yeni hesap eklemek için yukarıdaki butonu kullanın</p>
                  </td>
                </tr>
              ) : (
                rootAccounts.map(account => renderAccount(account))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Plus, Trash2, Search, FolderOpen, Folder, X, Check, Calendar } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
// Debug bileşeni sadece çeviri sorunlarını teşhis etmek için (dev mod / query param)
import TranslationDebug from './TranslationDebug';
import type { ChartAccount } from '../types';

type DatePreset =
  | 'this-month'
  | 'this-quarter'
  | 'this-year'
  | 'last-year'
  | 'all'
  | 'custom';

type DateRangeConfig = {
  startMs?: number;
  endMs?: number;
  preset: DatePreset;
};

const DATE_PRESET_OPTIONS: Array<{
  value: DatePreset;
  labelKey: string;
  defaultLabel: string;
}> = [
  { value: 'this-month', labelKey: 'chartOfAccounts.dateFilters.thisMonth', defaultLabel: 'Bu Ay' },
  { value: 'this-quarter', labelKey: 'chartOfAccounts.dateFilters.thisQuarter', defaultLabel: 'Bu Çeyrek' },
  { value: 'this-year', labelKey: 'chartOfAccounts.dateFilters.thisYear', defaultLabel: 'Bu Yıl' },
  { value: 'last-year', labelKey: 'chartOfAccounts.dateFilters.lastYear', defaultLabel: 'Geçen Yıl' },
  { value: 'all', labelKey: 'chartOfAccounts.dateFilters.all', defaultLabel: 'Tümü' },
  { value: 'custom', labelKey: 'chartOfAccounts.dateFilters.custom', defaultLabel: 'Özel Tarih' },
];

const startOfDay = (date: Date) => {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
};

const endOfDay = (date: Date) => {
  const clone = new Date(date);
  clone.setHours(23, 59, 59, 999);
  return clone;
};

const parseMaybeDate = (input: unknown): Date => {
  if (!input) return new Date('1970-01-01');
  const value = String(input).trim();
  if (!value) return new Date('1970-01-01');
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value);
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split('.');
    return new Date(`${yyyy}-${mm}-${dd}`);
  }
  return new Date(value);
};

const getInvoiceDate = (invoice: Record<string, unknown>) =>
  parseMaybeDate(invoice?.issueDate ?? (invoice as any)?.date);

const getExpenseDate = (expense: Record<string, unknown>) =>
  parseMaybeDate(expense?.expenseDate ?? (expense as any)?.date);

const getSaleDate = (sale: Record<string, unknown>) =>
  parseMaybeDate((sale as any)?.date ?? (sale as any)?.saleDate);

const parseDateInput = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
};

const isDateWithinRange = (
  date: Date | null | undefined,
  startMs?: number,
  endMs?: number,
) => {
  if (!date || Number.isNaN(date.getTime())) return true;
  const timestamp = date.getTime();
  if (typeof startMs === 'number' && timestamp < startMs) return false;
  if (typeof endMs === 'number' && timestamp > endMs) return false;
  return true;
};

interface ChartOfAccountsPageProps {
  accounts?: ChartAccount[];
  onAccountsUpdate?: (accounts: ChartAccount[]) => void;
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
  const { formatCurrency, getCurrencySymbol } = useCurrency();
  const { t } = useTranslation('common');

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [inlineEditingAccount, setInlineEditingAccount] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState<{[key: string]: string}>({});
  const [showExpenseCategoryModal, setShowExpenseCategoryModal] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('this-year');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const activeDateRangeLabel = useMemo(() => {
    if (datePreset === 'custom') {
      if (customStartDate || customEndDate) {
        const startLabel = customStartDate || '…';
        const endLabel = customEndDate || '…';
        return `${startLabel} – ${endLabel}`;
      }
      return t('chartOfAccounts.dateFilters.custom', { defaultValue: 'Özel Tarih' });
    }
    const preset = DATE_PRESET_OPTIONS.find((option) => option.value === datePreset);
    if (preset) {
      return t(preset.labelKey, { defaultValue: preset.defaultLabel });
    }
    return t('chartOfAccounts.dateFilters.all', { defaultValue: 'Tümü' });
  }, [customEndDate, customStartDate, datePreset, t]);

  // Gider kategorileri (ExpenseModal ile aynı)
  const expenseCategories = [
    { label: 'Diğer', value: 'other' },
    { label: 'Ekipman', value: 'equipment' },
    { label: 'Faturalar', value: 'utilities' },
    { label: 'Kira', value: 'rent' },
    { label: 'Maaşlar', value: 'salaries' },
    { label: 'Malzemeler', value: 'supplies' },
    { label: 'Pazarlama', value: 'marketing' },
    { label: 'Personel', value: 'personnel' },
    { label: 'Seyahat', value: 'travel' },
    { label: 'Sigorta', value: 'insurance' },
    { label: 'Vergiler', value: 'taxes' },
  ];

  // Kategori isminden değere eşleme
  const categoryNameToValue: { [key: string]: string } = {
    'Kira Giderleri': 'rent',
    'Personel Giderleri': 'personnel',
    'Fatura Giderleri': 'utilities',
    'Diğer': 'other',
    'Ekipman': 'equipment',
    'Faturalar': 'utilities',
    'Kira': 'rent',
    'Maaşlar': 'salaries',
    'Malzemeler': 'supplies',
    'Pazarlama': 'marketing',
    'Personel': 'personnel',
    'Seyahat': 'travel',
    'Sigorta': 'insurance',
    'Vergiler': 'taxes',
  };

  // Gerçek verilerden hesap planı oluştur
  const getDefaultAccounts = (): ChartAccount[] => [
    // VARLIKLAR (ASSETS)
    { id: '1', code: '100', name: t('chartOfAccounts.accountNames.100'), type: 'asset', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '2', code: '101', name: t('chartOfAccounts.accountNames.101'), type: 'asset', parentId: '1', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '3', code: '102', name: t('chartOfAccounts.accountNames.102'), type: 'asset', parentId: '1', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '4', code: '120', name: t('chartOfAccounts.accountNames.120'), type: 'asset', parentId: '1', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '5', code: '150', name: t('chartOfAccounts.accountNames.150'), type: 'asset', isActive: true, balance: 0, createdAt: '2024-01-01' },
    
    // YÜKÜMLÜLÜKLER (LIABILITIES)
    { id: '7', code: '200', name: t('chartOfAccounts.accountNames.200'), type: 'liability', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '8', code: '201', name: t('chartOfAccounts.accountNames.201'), type: 'liability', parentId: '7', isActive: true, balance: 0, createdAt: '2024-01-01' },
    
    // ÖZKAYNAKLAR (EQUITY)
    { id: '10', code: '300', name: t('chartOfAccounts.accountNames.300'), type: 'equity', isActive: true, balance: 0, createdAt: '2024-01-01' },
    
    // GELİRLER (REVENUE)
    { id: '13', code: '600', name: t('chartOfAccounts.accountNames.600'), type: 'revenue', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '14', code: '601', name: t('chartOfAccounts.accountNames.601'), type: 'revenue', parentId: '13', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '15', code: '602', name: t('chartOfAccounts.accountNames.602'), type: 'revenue', parentId: '13', isActive: true, balance: 0, createdAt: '2024-01-01' },
    
    // GİDERLER (EXPENSES)
    { id: '16', code: '700', name: t('chartOfAccounts.accountNames.700'), type: 'expense', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '17', code: '701', name: t('chartOfAccounts.accountNames.701'), type: 'expense', parentId: '16', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '18', code: '702', name: t('chartOfAccounts.accountNames.702'), type: 'expense', parentId: '16', isActive: true, balance: 0, createdAt: '2024-01-01' },
    { id: '19', code: '703', name: t('chartOfAccounts.accountNames.703'), type: 'expense', parentId: '16', isActive: true, balance: 0, createdAt: '2024-01-01' },
  ];

  const [currentAccounts, setCurrentAccounts] = useState<ChartAccount[]>(
    accounts.length > 0 ? accounts : getDefaultAccounts()
  );

  const activeDateRange = useMemo<DateRangeConfig>(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    let start: Date | undefined;
    let end: Date | undefined;

    switch (datePreset) {
      case 'this-month':
        start = startOfDay(new Date(currentYear, now.getMonth(), 1));
        end = endOfDay(new Date(currentYear, now.getMonth() + 1, 0));
        break;
      case 'this-quarter': {
        const quarterIndex = Math.floor(now.getMonth() / 3);
        const quarterStartMonth = quarterIndex * 3;
        start = startOfDay(new Date(currentYear, quarterStartMonth, 1));
        end = endOfDay(new Date(currentYear, quarterStartMonth + 3, 0));
        break;
      }
      case 'this-year':
        start = startOfDay(new Date(currentYear, 0, 1));
        end = endOfDay(new Date(currentYear, 11, 31));
        break;
      case 'last-year':
        start = startOfDay(new Date(currentYear - 1, 0, 1));
        end = endOfDay(new Date(currentYear - 1, 11, 31));
        break;
      case 'custom': {
        const customStart = parseDateInput(customStartDate);
        const customEnd = parseDateInput(customEndDate);
        start = customStart ? startOfDay(customStart) : undefined;
        end = customEnd ? endOfDay(customEnd) : undefined;
        break;
      }
      case 'all':
      default:
        start = undefined;
        end = undefined;
        break;
    }

    if (start && end && start.getTime() > end.getTime()) {
      const temp = start;
      start = end;
      end = temp;
    }

    return {
      startMs: start?.getTime(),
      endMs: end?.getTime(),
      preset: datePreset,
    };
  }, [datePreset, customStartDate, customEndDate]);

  const { startMs, endMs } = activeDateRange;

  const scopedInvoices = useMemo(() => {
    if (!startMs && !endMs) return invoices;
    return invoices.filter((invoice) =>
      isDateWithinRange(getInvoiceDate(invoice as Record<string, unknown>), startMs, endMs)
    );
  }, [invoices, startMs, endMs]);

  const scopedExpenses = useMemo(() => {
    if (!startMs && !endMs) return expenses;
    return expenses.filter((expense) =>
      isDateWithinRange(getExpenseDate(expense as Record<string, unknown>), startMs, endMs)
    );
  }, [expenses, startMs, endMs]);

  const scopedSales = useMemo(() => {
    if (!startMs && !endMs) return sales;
    return sales.filter((sale) =>
      isDateWithinRange(getSaleDate(sale as Record<string, unknown>), startMs, endMs)
    );
  }, [sales, startMs, endMs]);

  // Update accounts when language changes
  useEffect(() => {
    if (accounts.length === 0) {
      setCurrentAccounts(getDefaultAccounts());
    }
  }, [t]);

  // Calculate dynamic balances from actual data
  const calculateDynamicBalance = (account: ChartAccount): number => {
    const accountCode = account.code;
    
    // Calculate based on account type and code
    switch (accountCode) {
      case '101': // Kasa - Cash payments from paid invoices
        return scopedInvoices
          .filter(invoice => invoice.status === 'paid' && invoice.paymentMethod === 'cash')
          .reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0);
      
      case '102': // Bankalar - Bank/card payments from paid invoices
        return scopedInvoices
          .filter(invoice => invoice.status === 'paid' && (invoice.paymentMethod === 'card' || invoice.paymentMethod === 'transfer'))
          .reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0);
      
      case '120': // Alıcılar - Unpaid invoices (receivables)
        return scopedInvoices
          .filter(invoice => invoice.status === 'sent' || invoice.status === 'overdue')
          .reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0);
      
      case '201': // Satıcılar - Unpaid expenses (payables)
        return scopedExpenses
          .filter(expense => expense.status === 'approved' || expense.status === 'pending')
          .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
      
      case '600': // GELİRLER - Sum of revenue children or total invoices
        {
          const revenueChildren = currentAccounts.filter(acc => acc.parentId === account.id);
          if (revenueChildren.length > 0) {
            return revenueChildren.reduce((sum, child) => sum + calculateDynamicBalance(child), 0);
          }
          return scopedInvoices
            .filter(invoice =>
              invoice.type !== 'refund' &&
              (invoice.status === 'paid' || invoice.status === 'sent' || invoice.status === 'overdue')
            )
            .reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0);
        }
      case '601': // Satış Gelirleri - Product invoices only (no duplicate counting)
        return scopedInvoices
          .filter(invoice => 
            invoice.type !== 'refund' && 
            (invoice.status === 'paid' || invoice.status === 'sent' || invoice.status === 'overdue') && 
            invoice.type === 'product'
          )
          .reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0);
      
      case '602': // Hizmet Gelirleri - Service invoices only
        return scopedInvoices
          .filter(invoice => 
            invoice.type !== 'refund' && 
            (invoice.status === 'paid' || invoice.status === 'sent' || invoice.status === 'overdue') && 
            invoice.type === 'service'
          )
          .reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0);
      
      case '701': // Kira Giderleri - Rent expenses (all statuses)
        return scopedExpenses
          .filter(expense => expense.category === 'rent')
          .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
      
      case '702': // Personel Giderleri - Personnel expenses (all statuses)
        return scopedExpenses
          .filter(expense => expense.category === 'personnel')
          .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
      
      case '703': // Fatura Giderleri - Utilities expenses (all statuses)
        return scopedExpenses
          .filter(expense => expense.category === 'utilities')
          .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
      
      case '700': // GİDERLER - All expenses total
        return scopedExpenses
          .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
      
      default:
        // Dinamik gider kategorileri için (704+)
        if (account.type === 'expense' && account.parentId) {
          const parent = currentAccounts.find(acc => acc.id === account.parentId);
          if (parent?.code === '700') {
            // Hesap isminden kategori değerini bul
            const categoryValue = categoryNameToValue[account.name];
            if (categoryValue) {
              return scopedExpenses
                .filter(expense => expense.category === categoryValue)
                .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
            }
          }
        }
        
        // For other accounts, use the stored balance
        return account.balance;
    }
  };

  // Check if account data comes from other pages (should not be editable)
  const isDataFromOtherPages = (account: Account): boolean => {
    const dynamicAccountCodes = ['101', '102', '120', '201', '600', '601', '602', '700', '701', '702', '703'];
    
    // Dinamik gider kategorileri de kilitli olmalı
    if (account.type === 'expense' && account.parentId) {
      const parent = currentAccounts.find(acc => acc.id === account.parentId);
      if (parent?.code === '700' && categoryNameToValue[account.name]) {
        return true;
      }
    }
    
    return dynamicAccountCodes.includes(account.code);
  };

  // Get tooltip text for locked accounts
  const getLockedAccountTooltip = (account: Account): string => {
    const code = account.code;
    const tooltips: { [key: string]: string } = {
      '101': 'Kasa: Ödenen faturaların nakit ödemeleri (Faturalar > Ödendi)',
      '102': 'Bankalar: Ödenen faturaların banka/kart ödemeleri (Faturalar > Ödendi)',
      '120': 'Alıcılar: Ödenmemiş faturalar (Faturalar > Gönderildi/Vadesi Geçti)',
      '201': 'Satıcılar: Ödenmemiş giderler (Giderler > Onaylandı/Beklemede)',
      '600': 'GELİRLER: Tüm gelirler toplamı (Faturalar sayfasından)',
      '601': 'Satış Gelirleri: Ürün kategorili faturalar (Ürünler > Ürünler kategorisi)',
      '602': 'Hizmet Gelirleri: Hizmet kategorili faturalar (Ürünler > Hizmetler kategorisi)',
      '700': 'GİDERLER: Tüm giderler toplamı (Giderler sayfasından)',
      '701': 'Kira Giderleri: Kira kategorili giderler (Giderler sayfasından)',
      '702': 'Personel Giderleri: Personel kategorili giderler (Giderler sayfasından)',
      '703': 'Fatura Giderleri: Fatura kategorili giderler (Giderler sayfasından)'
    };
    
    // Dinamik kategoriler için
    if (account.type === 'expense' && account.parentId) {
      const parent = currentAccounts.find(acc => acc.id === account.parentId);
      if (parent?.code === '700') {
        const categoryValue = categoryNameToValue[account.name];
        if (categoryValue) {
          return `${account.name}: ${account.name} kategorili giderler (Giderler sayfasından)`;
        }
      }
    }
    
    return tooltips[code] || 'Bu hesap diğer sayfalardan otomatik yönetilir';
  };

  // Update accounts with dynamic balances
  React.useEffect(() => {
    console.log('📊 Hesap Planı Veri Kontrolü:', {
      invoicesCount: scopedInvoices.length,
      expensesCount: scopedExpenses.length,
      salesCount: scopedSales.length,
      customersCount: customers.length,
      sampleInvoice: scopedInvoices[0],
      sampleExpense: scopedExpenses[0],
      sampleSale: scopedSales[0]
    });
    
    const updatedAccounts = currentAccounts.map(account => {
      if (isDataFromOtherPages(account)) {
        const dynamicBalance = calculateDynamicBalance(account);
        return {
          ...account,
          balance: Number.isFinite(dynamicBalance) ? dynamicBalance : 0
        };
      }
      return account;
    });
    setCurrentAccounts(updatedAccounts);
  }, [scopedInvoices, scopedExpenses, scopedSales, customers]);

  const filteredAccounts = currentAccounts.filter(account => {
    const matchesSearch = 
      account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.code.includes(searchTerm);
    
    const matchesType = typeFilter === 'all' || account.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const getAccountTypeLabel = (type: string) => {
    const typeKey = type as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
    return t(`chartOfAccounts.accountTypeLabels.${typeKey}`, type);
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
    // Remove leading zeros and format properly
    const cleanAmount = Number(amount) || 0;
    return formatCurrency(cleanAmount);
  };

  // Format amount for summary cards (compact format for large numbers)
  const formatAmountCompact = (amount: number) => {
    const cleanAmount = Number(amount) || 0;
    const absAmount = Math.abs(cleanAmount);
    const symbol = getCurrencySymbol();
    
    // Manual compact formatting for large numbers
    if (absAmount >= 1000000) {
      const millions = cleanAmount / 1000000;
      return `${symbol}${millions.toFixed(2)}M`;
    }
    
    if (absAmount >= 1000) {
      const thousands = cleanAmount / 1000;
      return `${symbol}${thousands.toFixed(2)}K`;
    }
    
    return formatCurrency(cleanAmount);
  };

  // Clean account code - remove leading zeros
  const cleanAccountCode = (code: string): string => {
    if (!code) return '';
    // Remove leading zeros but keep the code structure
    return code.replace(/^0+/, '') || '0';
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

  const handleDatePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextPreset = event.target.value as DatePreset;
    setDatePreset(nextPreset);
    if (nextPreset !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  const addNewAccount = (parentId?: string) => {
    // Eğer parent 700 (GİDERLER) ise ve zaten alt kategorisi varsa, modal göster
    if (parentId) {
      const parent = currentAccounts.find(acc => acc.id === parentId);
      
      // Eğer parent'ın kendisi de bir child ise (yani alt kategoriye alt kategori eklemeye çalışıyorsa)
      if (parent?.parentId) {
        alert('Alt kategorilere tekrar alt kategori eklenemez. Sadece ana kategorilere alt kategori eklenebilir.');
        return;
      }
      
      // Eğer parent 700 (GİDERLER) ise, kategori seçimi modalını göster
      if (parent?.code === '700') {
        setPendingParentId(parentId);
        setShowExpenseCategoryModal(true);
        return;
      }
    }

    // Normal hesap ekleme
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

  // Gider kategorisi seçildiğinde yeni alt hesap ekle
  const handleExpenseCategorySelected = (categoryValue: string, categoryLabel: string) => {
    if (!pendingParentId) return;

    // Aynı kategori değeri zaten var mı kontrol et (isim değil değer bazında)
    const categoryExists = currentAccounts.some(acc => {
      if (acc.parentId !== pendingParentId) return false;
      
      // Mevcut hesabın kategori değerini bul
      const existingCategoryValue = categoryNameToValue[acc.name];
      return existingCategoryValue === categoryValue;
    });

    if (categoryExists) {
      alert(`"${categoryLabel}" kategorisi zaten eklenmiş. Her kategori sadece bir kez eklenebilir.`);
      setShowExpenseCategoryModal(false);
      setPendingParentId(null);
      return;
    }

    // Kategori için yeni kod bul (704'ten başlayarak)
    const existingExpenseCodes = currentAccounts
      .filter(acc => acc.code.startsWith('70') && acc.parentId === pendingParentId)
      .map(acc => parseInt(acc.code))
      .filter(code => !isNaN(code));
    
    const nextCode = existingExpenseCodes.length > 0 
      ? Math.max(...existingExpenseCodes) + 1 
      : 704;

    const newAccount: Account = {
      id: Date.now().toString(),
      code: nextCode.toString(),
      name: categoryLabel,
      type: 'expense',
      parentId: pendingParentId,
      isActive: true,
      balance: 0,
      createdAt: new Date().toISOString()
    };

    const updatedAccounts = [...currentAccounts, newAccount];
    setCurrentAccounts(updatedAccounts);
    if (onAccountsUpdate) {
      onAccountsUpdate(updatedAccounts);
    }

    // Modalı kapat
    setShowExpenseCategoryModal(false);
    setPendingParentId(null);
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
      
      let childBalance = 0;
      if (isDataFromOtherPages(child)) {
        const dynamicBalance = calculateDynamicBalance(child);
        childBalance = Number.isFinite(dynamicBalance) ? dynamicBalance : 0;
      } else {
        childBalance = Number(child.balance) || 0;
      }
      
      return total + childBalance;
    }, 0);
  };

  // Get display balance for account (calculated for parents, actual for children)
  const getDisplayBalance = (account: Account): number => {
    // Özel durum: 700 ve 600 kodları için dinamik hesaplama kullan (alt hesapların toplamı değil)
    if (account.code === '700' || account.code === '600') {
      const dynamicBalance = calculateDynamicBalance(account);
      return Number.isFinite(dynamicBalance) ? dynamicBalance : 0;
    }
    
    const hasChildren = isParentAccount(account.id);
    if (hasChildren) {
      return calculateParentBalance(account.id);
    }
    
    // Use dynamic balance with fallback to stored balance
    if (isDataFromOtherPages(account)) {
      const dynamicBalance = calculateDynamicBalance(account);
      return Number.isFinite(dynamicBalance) ? dynamicBalance : 0;
    }
    
    return Number(account.balance) || 0;
  };

  const deleteAccount = (accountId: string) => {
    if (confirm(t('chartOfAccounts.deleteConfirm', 'Bu hesabı silmek istediğinizden emin misiniz?'))) {
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
                          ? getLockedAccountTooltip(account)
                          : 'Kodu düzenlemek için tıklayın'
                        }
                      >
                        {cleanAccountCode(account.code)}
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
                          ? getLockedAccountTooltip(account)
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
          <td className="px-6 py-4 text-right" style={{ minWidth: '180px' }}>
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
              <div className="text-right max-w-xs ml-auto">
                {hasChildren ? (
                  <div>
                    <div className="text-sm font-bold text-blue-600 truncate" title={formatAmount(getDisplayBalance(account))}>
                      {formatAmount(getDisplayBalance(account))}
                    </div>
                    <div className="text-xs text-gray-500">
                      ({t('chartOfAccounts.allSummed')})
                    </div>
                  </div>
                ) : (
                  <span 
                    onClick={() => !isDataFromOtherPages(account) && startInlineEdit(account.id, 'balance', account.balance)}
                    className={`inline-block text-sm font-semibold text-gray-900 px-2 py-1 rounded truncate max-w-full ${
                      isDataFromOtherPages(account) 
                        ? 'cursor-not-allowed opacity-60' 
                        : 'cursor-pointer hover:bg-gray-50'
                    }`}
                    title={isDataFromOtherPages(account) 
                      ? `${formatAmount(getDisplayBalance(account))} - ${getLockedAccountTooltip(account)}`
                      : `${formatAmount(getDisplayBalance(account))} (Düzenlemek için tıklayın)`
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
              title={t('chartOfAccounts.tooltips.toggleStatus', { defaultValue: 'Durumu değiştirmek için tıklayın' }) as string}
            >
              {account.isActive ? t('chartOfAccounts.statusLabels.active') : t('chartOfAccounts.statusLabels.inactive')}
            </button>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <div className="flex items-center justify-end space-x-2">
              <button 
                onClick={() => addNewAccount(account.id)}
                className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title={t('chartOfAccounts.tooltips.addSubAccount', { defaultValue: 'Alt hesap ekle' }) as string}
              >
                <Plus className="w-4 h-4" />
              </button>
              <button 
                onClick={() => deleteAccount(account.id)}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title={t('chartOfAccounts.tooltips.deleteAccount', { defaultValue: 'Hesabı sil' }) as string}
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
      let balance = 0;
      if (isDataFromOtherPages(account)) {
        const dynamicBalance = calculateDynamicBalance(account);
        balance = Number.isFinite(dynamicBalance) ? dynamicBalance : 0;
      } else {
        balance = Number(account.balance) || 0;
      }
      
      // Debug logging for revenue and expense accounts
      if (account.type === 'revenue' || account.type === 'expense') {
        console.log(`💰 ${account.name} (${account.code}):`, {
          type: account.type,
          balance,
          storedBalance: account.balance,
          isDataFromOtherPages: isDataFromOtherPages(account),
          hasChildren
        });
      }
      
      acc[account.type] = (acc[account.type] || 0) + balance;
    }
    return acc;
  }, {} as Record<string, number>);

  // Summary cards for revenue/expense should mirror their dynamic root accounts
  const revenueRoot = currentAccounts.find((account) => account.code === '600');
  if (revenueRoot) {
    const revenueTotal = calculateDynamicBalance(revenueRoot);
    if (Number.isFinite(revenueTotal)) {
      totals.revenue = revenueTotal;
    }
  }

  const expenseRoot = currentAccounts.find((account) => account.code === '700');
  if (expenseRoot) {
    const expenseTotal = calculateDynamicBalance(expenseRoot);
    if (Number.isFinite(expenseTotal)) {
      totals.expense = expenseTotal;
    }
  }
  
  console.log('📊 Hesaplanan Toplamlar:', totals);

  return (
    <div className="space-y-6">
      {/* Çeviri tanılama (yalnızca debugTranslations query paramı varsa göster) */}
      {typeof window !== 'undefined' && window.location.search.includes('debugTranslations') && (
        <div className="border border-yellow-300 rounded-lg bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800 mb-2">Çeviri Tanılama Paneli</p>
          <TranslationDebug />
        </div>
      )}
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <BookOpen className="w-8 h-8 text-blue-600 mr-3" />
              {t('chartOfAccounts.title')}
            </h1>
            <p className="text-gray-600">{t('chartOfAccounts.subtitle')}</p>
          </div>
          <button 
            onClick={() => addNewAccount()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('chartOfAccounts.newAccount')}</span>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 mb-1">{t('chartOfAccounts.accountTypesPlural.asset')}</div>
            <div className="text-lg font-bold text-blue-700 truncate" title={formatAmount(totals.asset || 0)}>
              {formatAmountCompact(totals.asset || 0)}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-sm text-red-600 mb-1">{t('chartOfAccounts.accountTypesPlural.liability')}</div>
            <div className="text-lg font-bold text-red-700 truncate" title={formatAmount(totals.liability || 0)}>
              {formatAmountCompact(totals.liability || 0)}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-purple-600 mb-1">{t('chartOfAccounts.accountTypesPlural.equity')}</div>
            <div className="text-lg font-bold text-purple-700 truncate" title={formatAmount(totals.equity || 0)}>
              {formatAmountCompact(totals.equity || 0)}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 mb-1">{t('chartOfAccounts.accountTypesPlural.revenue')}</div>
            <div className="text-lg font-bold text-green-700 truncate" title={formatAmount(totals.revenue || 0)}>
              {formatAmountCompact(totals.revenue || 0)}
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-orange-600 mb-1">{t('chartOfAccounts.accountTypesPlural.expense')}</div>
            <div className="text-lg font-bold text-orange-700 truncate" title={formatAmount(totals.expense || 0)}>
              {formatAmountCompact(totals.expense || 0)}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-6">
          {t('chartOfAccounts.activeDateRangeLabel', { defaultValue: 'Tarih filtresi:' })}{' '}
          <span className="font-medium text-gray-700">{activeDateRangeLabel}</span>
        </p>

        {/* Search and Filter */}
        <div className="flex flex-col xl:flex-row gap-4 items-start">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t('chartOfAccounts.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('chartOfAccounts.accountTypes.all')}</option>
              <option value="asset">{t('chartOfAccounts.accountTypesPlural.asset')}</option>
              <option value="liability">{t('chartOfAccounts.accountTypesPlural.liability')}</option>
              <option value="equity">{t('chartOfAccounts.accountTypesPlural.equity')}</option>
              <option value="revenue">{t('chartOfAccounts.accountTypesPlural.revenue')}</option>
              <option value="expense">{t('chartOfAccounts.accountTypesPlural.expense')}</option>
            </select>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <select
                  value={datePreset}
                  onChange={handleDatePresetChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DATE_PRESET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey, { defaultValue: option.defaultLabel })}
                    </option>
                  ))}
                </select>
              </div>
              {datePreset === 'custom' && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('chartOfAccounts.title')}</h3>
              <p className="text-sm text-gray-500">
                {currentAccounts.length} {t('chartOfAccounts.accountsRegistered')} • {t('chartOfAccounts.clickToEdit')}
              </p>
            </div>
            <div className="text-xs text-gray-500 bg-blue-50 px-3 py-2 rounded-lg">
              {t('chartOfAccounts.tooltips.editHint')}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-full lg:min-w-[1024px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('chartOfAccounts.accountName')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('chartOfAccounts.type')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('chartOfAccounts.balance')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('chartOfAccounts.status')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('chartOfAccounts.actions')}
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
                    <p className="text-gray-400 text-sm">{t('chartOfAccounts.addAccountTip')}</p>
                  </td>
                </tr>
              ) : (
                rootAccounts.map(account => renderAccount(account))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gider Kategorisi Seçim Modalı */}
      {showExpenseCategoryModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Gider Kategorisi Seçin
                </h3>
                <button
                  onClick={() => {
                    setShowExpenseCategoryModal(false);
                    setPendingParentId(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Giderler kategorisine eklenecek alt kategoriyi seçin. Bu kategori, giderler sayfasındaki kategorilerle otomatik eşleştirilecektir.
              </p>

              <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {expenseCategories.map((category) => {
                  // Kategori değeri zaten eklenmiş mi kontrol et (isim değil değer bazında)
                  const isAlreadyAdded = currentAccounts.some(acc => {
                    if (acc.parentId !== pendingParentId) return false;
                    const existingCategoryValue = categoryNameToValue[acc.name];
                    return existingCategoryValue === category.value;
                  });
                  
                  return (
                    <button
                      key={category.value}
                      onClick={() => !isAlreadyAdded && handleExpenseCategorySelected(category.value, category.label)}
                      disabled={isAlreadyAdded}
                      className={`px-4 py-3 text-left border rounded-lg transition-colors ${
                        isAlreadyAdded
                          ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'
                          : 'border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-sm font-medium flex items-center justify-between">
                        {category.label}
                        {isAlreadyAdded && (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setShowExpenseCategoryModal(false);
                    setPendingParentId(null);
                  }}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
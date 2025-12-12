import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Receipt, 
  ChevronDown,
  ChevronUp,
  BarChart3,
  Activity,
  Target,
  FileText,
  FileDown
} from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import * as quotesApi from '../api/quotes';
import type { Quote, QuoteItemDto } from '../api/quotes';
import { normalizeStatusKey, resolveStatusLabel } from '../utils/status';
import { logger } from '../utils/logger';
import { listLocalStorageKeys, readLegacyTenantId, safeLocalStorage } from '../utils/localStorageSafe';
import { toNumberSafe } from '../utils/sortAndSearch';

type NumericInput = number | string | null | undefined;

interface InvoiceItemLike {
  description?: string | null;
  quantity?: NumericInput;
  unitPrice?: NumericInput;
  total?: NumericInput;
}

interface InvoiceLike {
  id?: string | number | null;
  customerName?: string | null;
  customer?: { name?: string | null } | null;
  status?: unknown;
  total?: NumericInput;
  amount?: NumericInput;
  subtotal?: NumericInput;
  taxAmount?: NumericInput;
  issueDate?: string | null;
  date?: string | null;
  dueDate?: string | null;
  saleId?: string | number | null;
  notes?: string | null;
  items?: InvoiceItemLike[] | null;
}

interface ExpenseLike {
  id?: string | number | null;
  description?: string | null;
  category?: string | null;
  supplier?: string | null;
  status?: unknown;
  amount?: NumericInput;
  expenseDate?: string | null;
  date?: string | null;
}

interface SaleLike {
  id?: string | number | null;
  saleNumber?: string | null;
  customerName?: string | null;
  productName?: string | null;
  status?: unknown;
  items?: InvoiceItemLike[] | null;
  amount?: NumericInput;
  total?: NumericInput;
  quantity?: NumericInput;
  unitPrice?: NumericInput;
  invoiceId?: string | number | null;
  date?: string | null;
  saleDate?: string | null;
}

type QuoteItemLike = Partial<QuoteItemDto> & {
  quantity?: NumericInput;
  unitPrice?: NumericInput;
  total?: NumericInput;
};

type QuoteLike = {
  id: string;
  quoteNumber?: Quote['quoteNumber'] | null;
  customerId?: string | number | null;
  customerName?: Quote['customerName'];
  issueDate?: Quote['issueDate'];
  validUntil?: Quote['validUntil'];
  currency?: Quote['currency'] | string | null;
  total?: NumericInput;
  amount?: NumericInput;
  status?: Quote['status'] | string | null;
  version?: Quote['version'];
  scopeOfWorkHtml?: Quote['scopeOfWorkHtml'];
  items?: QuoteItemLike[];
  createdAt?: Quote['createdAt'];
  updatedAt?: Quote['updatedAt'];
};

type UnknownQuote = QuoteLike | Record<string, unknown>;

const ensureString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
};

const toIsoDateString = (value: unknown): string | undefined => {
  const candidate = ensureString(value).trim();
  if (!candidate) return undefined;
  return candidate.slice(0, 10);
};

const normalizeQuoteItem = (item: unknown): QuoteItemLike => {
  if (!item || typeof item !== 'object') return {};
  const candidate = item as Record<string, unknown>;
  return {
    description: ensureString(candidate.description),
    quantity: candidate.quantity as NumericInput,
    unitPrice: candidate.unitPrice as NumericInput,
    total: candidate.total as NumericInput,
  };
};

const normalizeQuote = (quote: UnknownQuote, fallbackIndex = 0): QuoteLike => {
  const source = (quote ?? {}) as Record<string, unknown>;
  const id = ensureString(source.id, ensureString(source.quoteNumber, `quote-${fallbackIndex}`));
  return {
    id,
    quoteNumber: ensureString(source.quoteNumber),
    customerId: source.customerId as string | number | null,
    customerName: ensureString(source.customerName ?? (source.customer as { name?: string })?.name),
    issueDate: toIsoDateString(source.issueDate),
    validUntil: toIsoDateString(source.validUntil),
    currency: ensureString(source.currency),
    total: source.total as NumericInput,
    amount: source.amount as NumericInput,
    status: source.status,
    version: typeof source.version === 'number' ? source.version : undefined,
    scopeOfWorkHtml: ensureString(source.scopeOfWorkHtml),
    items: Array.isArray(source.items) ? source.items.map(normalizeQuoteItem) : [],
    createdAt: ensureString(source.createdAt ?? source.created_at),
    updatedAt: ensureString(source.updatedAt ?? source.updated_at),
  };
};

const normalizeQuoteArray = (value: unknown): QuoteLike[] => {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => normalizeQuote(entry as UnknownQuote, index));
};

const escapeCsvValue = (value: unknown): string => {
  if (value == null) return '""';
  const stringValue = String(value);
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
};

/* __REPORTS_HELPERS__ */
const toNumber = (value: unknown): number => toNumberSafe(value);

const getLineItemTotal = (item?: InvoiceItemLike | null): number => {
  if (!item) return 0;
  if (item.total != null) return toNumber(item.total);
  return toNumber(item.quantity) * toNumber(item.unitPrice);
};

const parseMaybeDate = (input: unknown): Date => {
  if (!input) return new Date('1970-01-01');
  const value = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value);
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split('.');
    return new Date(`${yyyy}-${mm}-${dd}`);
  }
  return new Date(value);
};

const statusToLower = (status: unknown): string => String(status ?? '').toLowerCase();

const isPaidLike = (status: unknown) => {
  const normalized = statusToLower(status);
  return normalized.includes('paid') || normalized.includes('öden') || normalized.includes('odendi') || normalized.includes('ödendi');
};

const isReportableExpenseStatus = (status: unknown) => {
  const normalized = normalizeStatusKey(String(status ?? ''));
  return normalized === 'paid' || normalized === 'approved';
};

const isCompletedLike = (status: unknown) => {
  const normalized = statusToLower(status);
  return normalized.includes('completed') || normalized.includes('tamam');
};

const getInvoiceTotal = (invoice: InvoiceLike | null | undefined): number => {
  if (!invoice) return 0;
  const explicit = toNumber(invoice.total ?? invoice.amount);
  if (explicit > 0) return explicit;
  if (Array.isArray(invoice.items)) {
    return invoice.items.reduce((sum, item) => sum + getLineItemTotal(item), 0);
  }
  return 0;
};

const getExpenseAmount = (expense: ExpenseLike | null | undefined): number => toNumber(expense?.amount);

const getSaleAmount = (sale: SaleLike | null | undefined): number => {
  if (!sale) return 0;
  if (Array.isArray(sale.items) && sale.items.length) {
    return sale.items.reduce((sum, item) => sum + getLineItemTotal(item), 0);
  }
  if (sale.total != null) return toNumber(sale.total);
  if (sale.amount != null) return toNumber(sale.amount);
  const quantity = toNumber(sale.quantity);
  const unitPrice = toNumber(sale.unitPrice);
  if (quantity > 0 && unitPrice > 0) {
    return quantity * unitPrice;
  }
  return 0;
};

const getInvoiceVatAmount = (invoice: InvoiceLike | null | undefined): number => {
  if (!invoice) return 0;
  const explicit = toNumber((invoice as any)?.taxAmount);
  if (explicit > 0) return explicit;
  const subtotal = toNumber((invoice as any)?.subtotal);
  const total = toNumber(invoice?.total ?? invoice?.amount);
  if (total > 0 && subtotal >= 0 && total >= subtotal) {
    const diff = total - subtotal;
    if (diff > 0) return diff;
  }
  if (Array.isArray(invoice?.items)) {
    const vatFromItems = invoice.items.reduce((sum, item) => {
      const rate = toNumber((item as Record<string, unknown>)?.taxRate);
      if (rate <= 0) return sum;
      return sum + getLineItemTotal(item) * (rate / 100);
    }, 0);
    if (vatFromItems > 0) return vatFromItems;
  }
  return 0;
};

const isSaleInvoiced = (sale: SaleLike | null | undefined, allInvoices: InvoiceLike[]): boolean => {
  if (!sale) return false;
  const saleId = String(sale.id ?? '');
  if (!saleId) return false;
  if (sale.invoiceId) return true;

  const viaSaleId = allInvoices.some((invoice) => String(invoice?.saleId ?? '') === saleId);
  if (viaSaleId) return true;

  const saleNumber = sale.saleNumber || `SAL-${saleId}`;
  return allInvoices.some((invoice) => typeof invoice?.notes === 'string' && invoice.notes.includes(saleNumber));
};

const getInvoiceDate = (invoice: InvoiceLike | null | undefined): Date =>
  parseMaybeDate(invoice?.issueDate ?? invoice?.date);

const getExpenseDate = (expense: ExpenseLike | null | undefined): Date =>
  parseMaybeDate(expense?.expenseDate ?? expense?.date);

const getSaleDate = (sale: SaleLike | null | undefined): Date =>
  parseMaybeDate(sale?.date ?? sale?.saleDate);

const resolveCustomerName = (source: unknown): string => {
  if (!source || typeof source !== 'object') return '';
  const payload = source as Record<string, unknown>;
  const nested = payload.customer as Record<string, unknown> | null | undefined;
  const candidates = [
    ensureString(payload.customerName),
    ensureString(payload.companyName),
    ensureString(payload.customerCompany),
    ensureString(payload.customerCompanyName),
    ensureString(payload.clientName),
    ensureString(payload.contactName),
    ensureString(payload.name),
  ];

  if (nested && typeof nested === 'object') {
    candidates.unshift(
      ensureString(nested.name),
      ensureString(nested.fullName),
      ensureString(nested.companyName),
      ensureString(nested.company)
    );
  }

  for (const value of candidates) {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return '';
};
interface ReportsPageProps {
  invoices?: InvoiceLike[];
  expenses?: ExpenseLike[];
  sales?: SaleLike[];
  customers?: Array<Record<string, unknown>>;
  quotes?: QuoteLike[];
}

const QUOTES_CACHE_EVENT = 'quotes-cache-updated';

const getQuoteDate = (quote: QuoteLike): Date => parseMaybeDate(quote?.issueDate);
const getQuoteTotal = (quote: QuoteLike): number => toNumber(quote?.total ?? quote?.amount);
const isOpenQuoteStatus = (status: unknown) => {
  const normalized = normalizeStatusKey(String(status ?? ''));
  return normalized === 'draft' || normalized === 'sent' || normalized === 'viewed';
};

export default function ReportsPage({
  invoices = [],
  expenses = [],
  sales = [],
  customers = [],
  quotes = [],
}: ReportsPageProps) {
  const { t, i18n } = useTranslation('common');
  const { formatCurrency } = useCurrency();
  const currentDate = new Date(); // Current date for report display
  const logDebug = (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      logger.debug('[ReportsPage]', ...args);
    }
  };

  const paidInvoicesAll = useMemo(() => invoices.filter((invoice) => isPaidLike(invoice.status)), [invoices]);

  const normalizedQuotes = useMemo(() => normalizeQuoteArray(quotes), [quotes]);
  const [liveQuotes, setLiveQuotes] = useState<QuoteLike[]>(normalizedQuotes);

  useEffect(() => {
    setLiveQuotes(normalizedQuotes);
  }, [normalizedQuotes]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || !event.key.includes('quotes_cache')) {
        return;
      }
      try {
        const parsed = event.newValue ? JSON.parse(event.newValue) : [];
        const nextQuotes = normalizeQuoteArray(parsed);
        if (nextQuotes.length) {
          setLiveQuotes(nextQuotes);
        }
      } catch (error) {
        logger.debug('Failed to parse quotes_cache storage event', error);
      }
    };

    const refreshFromLocal = () => {
      try {
        const keys = listLocalStorageKeys().filter((key) => key.includes('quotes_cache'));
        for (const key of keys) {
          const raw = safeLocalStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : [];
          const nextQuotes = normalizeQuoteArray(parsed);
          if (nextQuotes.length) {
            setLiveQuotes(nextQuotes);
            break;
          }
        }
      } catch (error) {
        logger.debug('Unable to refresh quotes from localStorage', error);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshFromLocal();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(QUOTES_CACHE_EVENT, refreshFromLocal as EventListener);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(QUOTES_CACHE_EVENT, refreshFromLocal as EventListener);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let cancelled = false;

    const hydrateQuotesIfEmpty = async () => {
      if (liveQuotes.length > 0) return;
      try {
        const data = await quotesApi.getQuotes();
        if (cancelled) return;
        const mapped = normalizeQuoteArray(data as unknown);
        if (!mapped.length) return;
        setLiveQuotes(mapped);
        try {
          const tenantId = readLegacyTenantId() || '';
          const cacheKey = tenantId ? `quotes_cache_${tenantId}` : 'quotes_cache';
          safeLocalStorage.setItem(cacheKey, JSON.stringify(mapped));
          window.dispatchEvent(new Event(QUOTES_CACHE_EVENT));
        } catch (storageError) {
          logger.debug('Unable to cache quotes locally', storageError);
        }
      } catch (error) {
        logger.error('Reports quotes preload failed:', error);
      }
    };

    hydrateQuotesIfEmpty();
    return () => {
      cancelled = true;
    };
  }, [liveQuotes.length]);
  
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  const last6Months = useMemo(() => {
    const currentDate = new Date();
    logDebug('Generating last 6 months starting from', currentDate.toISOString());

    const monthNames = [
      t('months.short.jan'),
      t('months.short.feb'),
      t('months.short.mar'),
      t('months.short.apr'),
      t('months.short.may'),
      t('months.short.jun'),
      t('months.short.jul'),
      t('months.short.aug'),
      t('months.short.sep'),
      t('months.short.oct'),
      t('months.short.nov'),
      t('months.short.dec'),
    ];

    const months = [] as Array<{ month: string; monthIndex: number; year: number; income: number; expense: number; vat: number }>;

    for (let offset = 0; offset < 6; offset += 1) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - offset, 1);
      const monthIndex = date.getMonth();
      const year = date.getFullYear();
      logDebug('Evaluating month window', { offset, label: `${monthNames[monthIndex]} ${year}` });

      const monthInvoices = invoices.filter((invoice) => {
        if (!isPaidLike(invoice.status)) return false;
        const invoiceDate = getInvoiceDate(invoice);
        return invoiceDate.getMonth() === monthIndex && invoiceDate.getFullYear() === year;
      });

      const monthExpenses = expenses.filter((expense) => {
        if (!isReportableExpenseStatus(expense.status)) return false;
        const expenseDate = getExpenseDate(expense);
        return expenseDate.getMonth() === monthIndex && expenseDate.getFullYear() === year;
      });

      const monthSales = sales.filter((sale) => {
        if (!isCompletedLike(sale.status)) return false;
        if (isSaleInvoiced(sale, invoices)) return false;
        const saleDate = getSaleDate(sale);
        return saleDate.getMonth() === monthIndex && saleDate.getFullYear() === year;
      });

      const invoiceIncome = monthInvoices.reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
      const vatAmount = monthInvoices.reduce((sum, invoice) => sum + getInvoiceVatAmount(invoice), 0);
      const salesIncome = monthSales.reduce((sum, sale) => sum + getSaleAmount(sale), 0);
      const totalIncome = invoiceIncome + salesIncome;
      const totalExpense = monthExpenses.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);

      logDebug('Monthly summary', {
        month: monthNames[monthIndex],
        invoiceIncome,
        salesIncome,
        totalIncome,
        totalExpense,
        vatAmount,
      });

      months.push({
        month: monthNames[monthIndex],
        monthIndex,
        year,
        income: totalIncome,
        expense: totalExpense,
        vat: vatAmount,
      });
    }

    return months;
  }, [expenses, invoices, sales, t]);

  // Calculate metrics
  // Calculate total revenue from paid invoices
  const paidInvoiceRevenue = paidInvoicesAll
    .reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
  
  // Calculate revenue from direct sales (not converted to invoices)
  const directSalesRevenue = sales
    .filter(sale => {
      if (!isCompletedLike(sale.status)) return false;
      return !isSaleInvoiced(sale, invoices);
    })
    .reduce((sum, sale) => sum + getSaleAmount(sale), 0);
  
  const totalRevenue = paidInvoiceRevenue + directSalesRevenue;
  
  logDebug('Revenue calculation', {
    paidInvoiceRevenue,
    directSalesRevenue,
    totalRevenue,
  });

  const totalExpenses = expenses
    .filter((expense) => isReportableExpenseStatus(expense.status))
    .reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  
  logDebug('Total expenses (paid only)', totalExpenses);

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;

  // Monthly data calculation
  const monthlyData = last6Months.map(monthInfo => {
    return {
      month: monthInfo.month,
      income: monthInfo.income,
      expense: monthInfo.expense,
      net: monthInfo.income - monthInfo.expense
    };
  });

  const vatMonthlyBreakdown = useMemo(() =>
    last6Months.map((monthInfo) => ({
      label: `${monthInfo.month} ${monthInfo.year}`,
      amount: monthInfo.vat ?? 0,
    })),
  [last6Months]);

  const vatMonthlyMax = Math.max(...vatMonthlyBreakdown.map((entry) => entry.amount), 1);
  const vatCurrentMonth = vatMonthlyBreakdown[0]?.amount ?? 0;
  const vatPreviousMonth = vatMonthlyBreakdown[1]?.amount ?? 0;
  const vatYearToDate = paidInvoicesAll.reduce((sum, invoice) => {
    const invoiceDate = getInvoiceDate(invoice);
    return invoiceDate.getFullYear() === currentDate.getFullYear()
      ? sum + getInvoiceVatAmount(invoice)
      : sum;
  }, 0);
  const vatLastYear = paidInvoicesAll.reduce((sum, invoice) => {
    const invoiceDate = getInvoiceDate(invoice);
    return invoiceDate.getFullYear() === currentDate.getFullYear() - 1
      ? sum + getInvoiceVatAmount(invoice)
      : sum;
  }, 0);
  const vatSixMonthAverage = vatMonthlyBreakdown.length
    ? vatMonthlyBreakdown.reduce((sum, entry) => sum + entry.amount, 0) / vatMonthlyBreakdown.length
    : 0;
  const vatMonthChange = vatPreviousMonth > 0
    ? ((vatCurrentMonth - vatPreviousMonth) / vatPreviousMonth) * 100
    : (vatCurrentMonth ? 100 : 0);
  const vatYearChange = vatLastYear > 0
    ? ((vatYearToDate - vatLastYear) / vatLastYear) * 100
    : (vatYearToDate ? 100 : 0);

  // Product sales analysis
  const productSales = useMemo(() => {
    type ProductAggregate = { name: string; total: number; count: number };
    const productMap = new Map<string, ProductAggregate>();

    invoices
      .filter((invoice) => isPaidLike(invoice.status))
      .forEach((invoice) => {
        (invoice.items ?? []).forEach((item) => {
          const label = item.description || '—';
          const existing = productMap.get(label) ?? { name: label, total: 0, count: 0 };
          existing.total += getLineItemTotal(item);
          existing.count += 1;
          productMap.set(label, existing);
        });
      });

    sales.forEach((sale) => {
      if (!isCompletedLike(sale.status) || isSaleInvoiced(sale, invoices)) {
        return;
      }
      const label = sale.productName || '—';
      const existing = productMap.get(label) ?? { name: label, total: 0, count: 0 };
      existing.total += getSaleAmount(sale);
      existing.count += 1;
      productMap.set(label, existing);
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [invoices, sales]);

  // Expense categories with demo data if empty
  const expenseCategories = useMemo(() => {
    const categoryMap = new Map();
    
    expenses
      .filter((expense) => isReportableExpenseStatus(expense.status))
      .forEach(expense => {
        const existing = categoryMap.get(expense.category) || { category: expense.category, total: 0, count: 0 };
        existing.total += toNumber(expense.amount);
        existing.count += 1;
        categoryMap.set(expense.category, existing);
      });
    
    return Array.from(categoryMap.values())
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  // Customer analysis with demo data if empty
  const customerAnalysis = useMemo(() => {
    type CustomerAggregate = {
      name: string;
      total: number;
      count: number;
      lastPurchase?: string;
    };

    const customerMap = new Map<string, CustomerAggregate>();
    const UNKNOWN_KEY = '__unknown__';

    const getCustomerKey = (name: string) => {
      const trimmed = name.trim();
      return trimmed ? trimmed.toLowerCase() : UNKNOWN_KEY;
    };

    const upsertCustomer = (rawName: string, amount: number, activityDate: string) => {
      const key = getCustomerKey(rawName);
      const existing = customerMap.get(key);
      const normalizedName = rawName.trim();
      const nextName = normalizedName || existing?.name || rawName;
      const nextTotal = (existing?.total ?? 0) + amount;
      const nextCount = (existing?.count ?? 0) + 1;
      const previousDate = existing?.lastPurchase;
      const shouldUpdateDate = !previousDate || new Date(activityDate) > new Date(previousDate);

      customerMap.set(key, {
        name: nextName,
        total: nextTotal,
        count: nextCount,
        lastPurchase: shouldUpdateDate ? activityDate : previousDate,
      });
    };
    
    invoices
      .filter((invoice) => isPaidLike(invoice.status))
      .forEach((invoice) => {
        const name = resolveCustomerName(invoice);
        const invoiceDate = getInvoiceDate(invoice).toISOString();
        upsertCustomer(name, getInvoiceTotal(invoice), invoiceDate);
      });

    sales
      .filter((sale) => isCompletedLike(sale.status))
      .forEach((sale) => {
        if (!isSaleInvoiced(sale, invoices)) {
          const name = resolveCustomerName(sale);
          const saleDate = getSaleDate(sale).toISOString();
          upsertCustomer(name, getSaleAmount(sale), saleDate);
        }
      });
    
    return Array.from(customerMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [invoices, sales]);

  const formatAmount = useCallback((amount: unknown) => formatCurrency(toNumber(amount)), [formatCurrency]);
  const formatPercent = useCallback((value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, []);

  const formatDate = useCallback((value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }, [i18n.language]);

  const getSupplierDisplay = useCallback((name?: string | null) => {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      return t('common:noSupplier', { defaultValue: 'No Supplier' });
    }
    return trimmed;
  }, [t]);

  const getCategoryLabel = useCallback((category?: string | null) => {
    if (!category) return t('expenses.category', { defaultValue: 'Category' });
    const translated = t(`expenseCategories.${category}`, { defaultValue: category });
    return translated || category;
  }, [t]);

  const handleExportExpenses = useCallback(() => {
    if (typeof window === 'undefined') return;
    const paidExpenses = expenses.filter((expense) => isPaidLike(expense.status));
    if (!paidExpenses.length) {
      logger.info('[ReportsPage] Expense export skipped: no paid expenses');
      return;
    }

    try {
      const headers = [
        t('expenses.expenseNumber', { defaultValue: 'Expense Number' }),
        t('common.description', { defaultValue: 'Description' }),
        t('expenses.supplier', { defaultValue: 'Supplier' }),
        t('expenses.category', { defaultValue: 'Category' }),
        t('common.statusLabel', { defaultValue: 'Status' }),
        t('expenses.expenseDate', { defaultValue: 'Expense Date' }),
        t('expenses.amount', { defaultValue: 'Amount' }),
      ];

      const rows = paidExpenses.map((expense, index) => {
        const status = resolveStatusLabel(t, normalizeStatusKey(expense.status));
        return [
          expense.id || expense.expenseDate || `expense-${index}`,
          expense.description || '',
          getSupplierDisplay(expense.supplier),
          getCategoryLabel(expense.category),
          status,
          formatDate(expense.expenseDate ?? expense.date),
          formatAmount(expense.amount),
        ];
      });

      const csvContent = [headers, ...rows]
        .map((row) => row.map(escapeCsvValue).join(','))
        .join('\r\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `reports_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      logger.info('[ReportsPage] Expense export completed', { rowCount: paidExpenses.length });
    } catch (error) {
      logger.error('[ReportsPage] Expense export failed', error);
    }
  }, [expenses, formatAmount, formatDate, getCategoryLabel, getSupplierDisplay, t]);

  // Calculate growth rate (comparing last 2 months)
  const currentMonthData = monthlyData[monthlyData.length - 1];
  const previousMonthData = monthlyData[monthlyData.length - 2];
  const growthRate = previousMonthData?.income > 0 
    ? ((currentMonthData.income - previousMonthData.income) / previousMonthData.income * 100)
    : 0;

  // Average sale amount
  const paidInvoicesCount = invoices.filter(invoice => isPaidLike(invoice.status)).length;
  const completedSalesCount = sales.filter(sale => {
    if (!isCompletedLike(sale.status)) return false;
    return !isSaleInvoiced(sale, invoices);
  }).length;
  
  const totalTransactions = paidInvoicesCount + completedSalesCount;
  const averageSale = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  
  logDebug('Transaction counts', {
    paidInvoicesCount,
    completedSalesCount,
    totalTransactions,
    averageSale,
  });

  // KPI calculations
  const kpiData = [
    {
      title: t('reports.growthRate'),
      value: `${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}%`,
      change: growthRate >= 0 ? 'increase' : 'decrease',
      color: 'blue',
      icon: TrendingUp
    },
    {
      title: t('reports.profitMargin'),
      value: `${profitMargin.toFixed(1)}%`,
      change: profitMargin >= 20 ? 'increase' : 'decrease',
      color: 'green',
      icon: Target
    },
    {
      title: t('reports.averageSale'),
      value: formatAmount(averageSale),
      change: 'increase',
      color: 'purple',
      icon: DollarSign
    },
    {
      title: t('reports.activeCustomers'),
      value: customerAnalysis.length.toString(),
      change: 'increase',
      color: 'orange',
      icon: Users
    }
  ];
  
  const displayMonthlyData = monthlyData;
  const displayMaxValue = Math.max(...displayMonthlyData.flatMap(d => [d.income, d.expense]), 1);

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <BarChart3 className="w-8 h-8 text-blue-600 mr-3" />
              {t('reports.title')}
            </h1>
            <p className="text-gray-600">{t('reports.subtitle')}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">{t('reports.reportDate')}</p>
            <p className="text-lg font-semibold text-gray-900">
              {currentDate.toLocaleDateString('tr-TR')}
            </p>
          </div>
        </div>
      </div>

      {/* 1. General Overview */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div 
          className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('overview')}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Activity className="w-6 h-6 text-blue-600 mr-3" />
              {t('reports.overview')}
            </h2>
            {collapsedSections.has('overview') ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {!collapsedSections.has('overview') && (
          <div className="p-6 space-y-6">
            {/* Basic Metrics */}
            <div 
              className="cursor-pointer"
              onClick={() => toggleSection('basic-metrics')}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('reports.basicMetrics')}</h3>
                {collapsedSections.has('basic-metrics') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                )}
              </div>
              
              {!collapsedSections.has('basic-metrics') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <TrendingUp className="w-8 h-8 text-green-600 mr-3" />
                      <div>
                        <p className="text-sm text-green-600">{t('reports.totalIncome')}</p>
                        <p className="text-xl font-bold text-green-700">
                          {formatAmount(totalRevenue)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <TrendingDown className="w-8 h-8 text-red-600 mr-3" />
                      <div>
                        <p className="text-sm text-red-600">{t('reports.totalExpense')}</p>
                        <p className="text-xl font-bold text-red-700">
                          {formatAmount(totalExpenses)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <DollarSign className="w-8 h-8 text-blue-600 mr-3" />
                      <div>
                        <p className="text-sm text-blue-600">{t('reports.netProfit')}</p>
                        <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                          {formatAmount(netProfit)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <Users className="w-8 h-8 text-purple-600 mr-3" />
                      <div>
                        <p className="text-sm text-purple-600">{t('reports.totalCustomers')}</p>
                        <p className="text-xl font-bold text-purple-700">
                          {customers.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Monthly Chart */}
            <div 
              className="cursor-pointer"
              onClick={() => toggleSection('monthly-chart')}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('reports.last6MonthsPerformance')}</h3>
                {collapsedSections.has('monthly-chart') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                )}
              </div>
              
              {!collapsedSections.has('monthly-chart') && (
                <div className="space-y-4">
                  {displayMonthlyData.map((data, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">{data.month}</span>
                        <div className="text-xs text-gray-500">
                          {t('reports.net')}: {formatAmount(data.net)}
                        </div>
                      </div>
                      
                      <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-4 bg-blue-500 rounded-sm"
                          style={{ width: `${displayMaxValue > 0 ? (data.income / displayMaxValue) * 100 : 0}%` }}
                        ></div>
                        <div 
                          className="absolute bottom-0 left-0 h-4 bg-red-500 rounded-sm"
                          style={{ width: `${displayMaxValue > 0 ? (data.expense / displayMaxValue) * 100 : 0}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{t('common.income')}: {formatAmount(data.income)}</span>
                        <span>{t('common.expense')}: {formatAmount(data.expense)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financial Health */}
            <div 
              className="cursor-pointer"
              onClick={() => toggleSection('financial-health')}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('reports.financialHealth')}</h3>
                {collapsedSections.has('financial-health') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                )}
              </div>
              
              {!collapsedSections.has('financial-health') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm">{t('reports.profitMargin')}</p>
                        <p className="text-2xl font-bold">
                          {profitMargin.toFixed(1)}%
                        </p>
                      </div>
                      <Target className="w-8 h-8 text-green-200" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm">{t('reports.growthRate')}</p>
                        <p className="text-2xl font-bold">
                          {`${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}`}%
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-blue-200" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm">{t('reports.averageSale')}</p>
                        <p className="text-2xl font-bold">
                          {formatAmount(averageSale)}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-purple-200" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Status Analysis */}
            <div 
              className="cursor-pointer"
              onClick={() => toggleSection('payment-status')}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('reports.paymentStatusAnalysis')}</h3>
                {collapsedSections.has('payment-status') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                )}
              </div>
              
              {!collapsedSections.has('payment-status') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">{t('reports.invoiceStatuses')}</h4>
                    <div className="space-y-2">
                      {(['paid', 'sent', 'draft', 'overdue'] as const).map(statusKey => {
                        const today = new Date(); today.setHours(0,0,0,0);
                        const count = statusKey === 'overdue'
                          ? invoices.filter(inv => {
                              if (!inv.dueDate) return false;
                              const due = parseMaybeDate(inv.dueDate);
                              due.setHours(0, 0, 0, 0);
                              return due.getTime() < today.getTime() && !isPaidLike(inv.status);
                            }).length
                          : invoices.filter(inv => normalizeStatusKey(String(inv.status ?? '')) === statusKey).length;
                        const colors = {
                          paid: 'bg-green-100 text-green-800',
                          sent: 'bg-blue-100 text-blue-800',
                          draft: 'bg-gray-100 text-gray-800',
                          overdue: 'bg-red-100 text-red-800'
                        } as const;
                        return (
                          <div key={statusKey} className="flex justify-between items-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[statusKey]}`}>
                              {resolveStatusLabel(t, statusKey)}
                            </span>
                            <span className="font-medium">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">{t('reports.expenseStatuses')}</h4>
                    <div className="space-y-2">
                      {(['paid', 'approved', 'draft'] as const).map(statusKey => {
                        const count = expenses.filter(exp => normalizeStatusKey(String(exp.status ?? '')) === statusKey).length;
                        const colors = {
                          paid: 'bg-green-100 text-green-800',
                          approved: 'bg-blue-100 text-blue-800',
                          draft: 'bg-gray-100 text-gray-800'
                        } as const;
                        return (
                          <div key={statusKey} className="flex justify-between items-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[statusKey]}`}>
                              {resolveStatusLabel(t, statusKey)}
                            </span>
                            <span className="font-medium">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* VAT Analysis */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div 
          className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('vat')}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Receipt className="w-6 h-6 text-orange-600 mr-3" />
                {t('reports.vatAnalysis')}
              </h2>
              <p className="text-gray-600">{t('reports.vatAnalysisSubtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">{t('reports.currentYearLabel', { year: currentDate.getFullYear() })}</p>
                <p className="text-xl font-semibold text-gray-900">{formatAmount(vatYearToDate)}</p>
              </div>
              {collapsedSections.has('vat') ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>
        {!collapsedSections.has('vat') && (
          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <p className="text-sm text-amber-700">{t('reports.vatYearToDate')}</p>
                <p className="text-2xl font-bold text-amber-900">{formatAmount(vatYearToDate)}</p>
                <p className="text-xs text-amber-700 mt-1">
                  {t('reports.vatChangeVsLastYear', {
                    percent: formatPercent(vatYearChange),
                    lastYear: formatAmount(vatLastYear)
                  })}
                </p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <p className="text-sm text-orange-700">{t('reports.vatThisMonth')}</p>
                <p className="text-2xl font-bold text-orange-900">{formatAmount(vatCurrentMonth)}</p>
                <p className="text-xs text-orange-700 mt-1">
                  {t('reports.vatChangeVsPreviousMonth', {
                    percent: formatPercent(vatMonthChange),
                    previous: formatAmount(vatPreviousMonth)
                  })}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-700">{t('reports.vatAverageSixMonths')}</p>
                <p className="text-2xl font-bold text-blue-900">{formatAmount(vatSixMonthAverage)}</p>
                <p className="text-xs text-blue-700 mt-1">{t('reports.vatAverageHint')}</p>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('reports.vatMonthlyBreakdown')}</h3>
                <span className="text-sm text-gray-500">{t('reports.lastMonthsPerformance', { count: vatMonthlyBreakdown.length })}</span>
              </div>
              {vatMonthlyBreakdown.length ? (
                <div className="space-y-3">
                  {vatMonthlyBreakdown.map((entry) => (
                    <div key={entry.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-900">{entry.label}</span>
                        <span className="font-semibold text-gray-900">{formatAmount(entry.amount)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-orange-500 rounded-full"
                          style={{ width: `${vatMonthlyMax > 0 ? (entry.amount / vatMonthlyMax) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t('reports.noVatData')}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Revenue Analysis */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div 
          className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('revenue')}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <TrendingUp className="w-6 h-6 text-green-600 mr-3" />
              {t('reports.revenueAnalysis')}
            </h2>
            {collapsedSections.has('revenue') ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {!collapsedSections.has('revenue') && (
          <div className="p-6 space-y-6">
            {/* Product Sales */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.productBasedSales')}</h3>
              <div className="space-y-3">
                {productSales.map((product, index) => (
                  <div key={index} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.count} {t('reports.sales')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">{formatAmount(product.total)}</div>
                      <div className="text-xs text-gray-500">
                        {t('reports.avg')}: {formatAmount(product.total / product.count)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Revenue Trend */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.monthlyRevenueTrend')}</h3>
              <div className="space-y-3">
                {displayMonthlyData.map((data, index) => (
                  <div key={index} className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-700 w-12">{data.month}</span>
                    <div className="flex-1 mx-4">
                      <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-300"
                          style={{ width: `${displayMaxValue > 0 ? (data.income / displayMaxValue) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-green-600 w-24 text-right">
                      {formatAmount(data.income)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Expense Analysis */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div 
          className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('expenses')}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Receipt className="w-6 h-6 text-red-600 mr-3" />
              {t('reports.expenseAnalysis')}
            </h2>
            {collapsedSections.has('expenses') ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {!collapsedSections.has('expenses') && (
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                {t('reports.expenseExportHint', { defaultValue: 'Includes paid expenses only.' })}
              </p>
              <button
                type="button"
                onClick={handleExportExpenses}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <FileDown className="w-4 h-4" />
                <span>{t('reports.exportExpensesCsv', { defaultValue: 'Export CSV' })}</span>
              </button>
            </div>

            {/* Expense Categories */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.categoryBasedExpenses')}</h3>
              <div className="space-y-3">
                {expenseCategories.map((category, index) => (
                  <div key={index} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{category.category}</div>
                      <div className="text-sm text-gray-500">{category.count} {t('reports.expenses')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-600">{formatAmount(category.total)}</div>
                      <div className="text-xs text-gray-500">
                        {t('reports.avg')}: {formatAmount(category.total / category.count)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Expense Trend */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.monthlyExpenseTrend')}</h3>
              <div className="space-y-3">
                {displayMonthlyData.map((data, index) => (
                  <div key={index} className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-700 w-12">{data.month}</span>
                    <div className="flex-1 mx-4">
                      <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all duration-300"
                          style={{ width: `${displayMaxValue > 0 ? (data.expense / displayMaxValue) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-red-600 w-24 text-right">
                      {formatAmount(data.expense)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Suppliers by Expense */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.topSuppliers')}</h3>
              <div className="space-y-3">
                {(() => {
                  const supplierMap = new Map();
                  
                  expenses
                    .filter((expense) => isReportableExpenseStatus(expense.status))
                    .forEach(expense => {
                      const existing = supplierMap.get(expense.supplier) || { 
                        name: expense.supplier, 
                        total: 0, 
                        count: 0,
                        lastExpense: expense.expenseDate
                      };
                      existing.total += toNumber(expense.amount);
                      existing.count += 1;
                      if (new Date(expense.expenseDate) > new Date(existing.lastExpense)) {
                        existing.lastExpense = expense.expenseDate;
                      }
                      supplierMap.set(expense.supplier, existing);
                    });
                  
                  // Demo tedarikçi ekleme kaldırıldı: yalnızca gerçek veriler gösterilir
                  
                  return Array.from(supplierMap.values())
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 5);
                })().map((supplier, index) => (
                  <div key={index} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-red-600 font-semibold text-sm">
                          {(supplier.name?.charAt(0)?.toUpperCase()) || "?"}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{supplier.name || t('reports.noSupplier')}</div>
                        <div className="text-sm text-gray-500">
                          {supplier.count} {t('reports.expenses')} • {t('reports.last')}: {formatDate(supplier.lastExpense)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-600">{formatAmount(supplier.total)}</div>
                      <div className="text-xs text-gray-500">
                        {t('reports.avg')}: {formatAmount(supplier.total / supplier.count)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Expenses */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.recentExpenses')}</h3>
              <div className="space-y-2">
                {expenses
                  .filter((expense) => isReportableExpenseStatus(expense.status))
                  .sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())
                  .slice(0, 5)
                  .map((expense, index) => (
                  <div key={index} className="flex flex-wrap items-center justify-between gap-3 p-2 hover:bg-gray-50 rounded">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{expense.description}</div>
                      <div className="text-xs text-gray-500">{expense.supplier} • {formatDate(expense.expenseDate)}</div>
                    </div>
                    <div className="text-sm font-semibold text-red-600">
                      {formatAmount(expense.amount)}
                    </div>
                  </div>
                  ))}
              </div>
            </div>

            {/* Expense vs Budget Analysis */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.expenseCategoryDistribution')}</h3>
              <div className="space-y-3">
                {expenseCategories.slice(0, 6).map((category, index) => {
                  const percentage = totalExpenses > 0 ? (category.total / totalExpenses * 100) : 0;
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">{category.category}</span>
                        <div className="text-xs text-gray-500">
                          {percentage.toFixed(1)}% • {formatAmount(category.total)}
                        </div>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Quote Analysis */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div 
          className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('quotes')}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <FileText className="w-6 h-6 text-indigo-600 mr-3" />
              {t('reports.quoteAnalysis')}
            </h2>
            {collapsedSections.has('quotes') ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {!collapsedSections.has('quotes') && (
          <div className="p-6 space-y-6">
            {/* Quote KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(() => {
                const totalQuotes = liveQuotes.length;
                const accepted = liveQuotes.filter(q => normalizeStatusKey(q?.status) === 'accepted').length;
                const expiringSoon = (() => {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
                  return liveQuotes.filter(q => {
                    const s = normalizeStatusKey(q?.status);
                    if (s === 'accepted' || s === 'declined' || s === 'expired') return false;
                    if (!q?.validUntil) return false;
                    const d = parseMaybeDate(q.validUntil); d.setHours(0,0,0,0);
                    return d.getTime() >= today.getTime() && d.getTime() <= in7.getTime();
                  }).length;
                })();
                const avgQuote = totalQuotes > 0 ? (liveQuotes.reduce((sum, q) => sum + getQuoteTotal(q), 0) / totalQuotes) : 0;
                const cards = [
                  { label: t('reports.totalQuotes'), value: String(totalQuotes), color: 'indigo' },
                  { label: t('reports.acceptedRate'), value: totalQuotes > 0 ? `${((accepted/totalQuotes)*100).toFixed(1)}%` : '0%', color: 'green' },
                  { label: t('reports.averageQuote'), value: formatAmount(avgQuote), color: 'purple' },
                  { label: t('reports.expiringSoon'), value: String(expiringSoon), color: 'orange' },
                ];
                return cards.map((c, idx) => (
                  <div key={idx} className={`bg-${c.color}-50 rounded-lg p-4 border border-${c.color}-200`}>
                    <div className={`text-sm text-${c.color}-600`}>{c.label}</div>
                    <div className={`text-2xl font-bold text-${c.color}-700`}>{c.value}</div>
                  </div>
                ));
              })()}
            </div>

            {/* Quote Statuses */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.quoteStatuses')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="space-y-2">
                    {(['accepted','declined','expired','viewed','sent','draft'] as const).map(statusKey => {
                      const count = liveQuotes.filter(q => normalizeStatusKey(String(q.status ?? '')) === statusKey).length;
                      const colors = {
                        accepted: 'bg-green-100 text-green-800',
                        declined: 'bg-red-100 text-red-800',
                        expired: 'bg-gray-100 text-gray-800',
                        viewed: 'bg-blue-100 text-blue-800',
                        sent: 'bg-indigo-100 text-indigo-800',
                        draft: 'bg-yellow-100 text-yellow-800'
                      } as const;
                      return (
                        <div key={statusKey} className="flex flex-wrap justify-between items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[statusKey]}`}>
                            {resolveStatusLabel(t, statusKey)}
                          </span>
                          <span className="font-medium">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Expiring soon list */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">{t('reports.expiringSoon')}</h4>
                  <div className="space-y-2">
                    {(() => {
                      const today = new Date(); today.setHours(0,0,0,0);
                      const in14 = new Date(today); in14.setDate(in14.getDate() + 14);
                      const items = liveQuotes
                        .filter(q => isOpenQuoteStatus(q?.status) && q?.validUntil)
                        .map(q => ({
                          q,
                          dt: (() => { const d = parseMaybeDate(q.validUntil); d.setHours(0,0,0,0); return d; })()
                        }))
                        .filter(x => x.dt.getTime() >= today.getTime() && x.dt.getTime() <= in14.getTime())
                        .sort((a, b) => a.dt.getTime() - b.dt.getTime())
                        .slice(0, 5);
                      return items.map(({ q, dt }, idx) => {
                        const daysLeft = Math.ceil((dt.getTime() - today.getTime()) / (1000*60*60*24));
                        return (
                          <div key={idx} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-gray-50 rounded">
                            <div className="text-sm text-gray-900 font-medium">{q.quoteNumber || '—'}</div>
                            <div className="text-xs text-gray-500">
                              {t('reports.daysLeft')}: {daysLeft} • {formatAmount(getQuoteTotal(q))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Quotes */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.recentQuotes')}</h3>
              <div className="space-y-2">
                {liveQuotes
                  .slice()
                  .sort((a, b) => getQuoteDate(b).getTime() - getQuoteDate(a).getTime())
                  .slice(0, 5)
                  .map((q, idx) => (
                  <div key={idx} className="flex flex-wrap items-center justify-between gap-3 p-2 hover:bg-gray-50 rounded">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{q.quoteNumber || '—'}</div>
                      <div className="text-xs text-gray-500">{resolveStatusLabel(t, normalizeStatusKey(q.status))} • {getQuoteDate(q).toLocaleDateString('tr-TR')}</div>
                    </div>
                    <div className="text-sm font-semibold text-indigo-600">
                      {formatAmount(getQuoteTotal(q))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Customer Analysis */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div 
          className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('customers')}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Users className="w-6 h-6 text-purple-600 mr-3" />
              {t('reports.customerAnalysis')}
            </h2>
            {collapsedSections.has('customers') ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {!collapsedSections.has('customers') && (
          <div className="p-6 space-y-6">
            {/* Top Customers */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.topCustomers')}</h3>
              <div className="space-y-3">
                {customerAnalysis.map((customer, index) => (
                  <div key={index} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 font-semibold text-sm">
                          {(customer.name?.charAt(0)?.toUpperCase()) || "?"}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{customer.name || t('reports.noCustomer')}</div>
                        <div className="text-sm text-gray-500">
                          {customer.count} {t('reports.purchases')} • {t('reports.last')}: {formatDate(customer.lastPurchase)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-purple-600">{formatAmount(customer.total)}</div>
                      <div className="text-xs text-gray-500">
                        {t('reports.avg')}: {formatAmount(customer.total / customer.count)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Statistics */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.customerStatistics')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">{customers.length}</div>
                  <div className="text-sm text-purple-600">{t('reports.totalCustomers')}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">{customerAnalysis.length}</div>
                  <div className="text-sm text-green-600">{t('reports.activeCustomersCount')}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatAmount(customerAnalysis.length > 0 ? totalRevenue / customerAnalysis.length : 0)}
                  </div>
                  <div className="text-sm text-blue-600">{t('reports.revenuePerCustomer')}</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-600">
                    {customerAnalysis.length > 0 ? (totalTransactions / customerAnalysis.length).toFixed(1) : '0'}
                  </div>
                  <div className="text-sm text-orange-600">{t('reports.salesPerCustomer')}</div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-indigo-600">
                    {customerAnalysis.length > 0 ? Math.round(totalTransactions / customerAnalysis.length) : 0}
                  </div>
                  <div className="text-sm text-indigo-600">{t('reports.averagePurchases')}</div>
                </div>
                <div className="bg-pink-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-pink-600">
                    {customerAnalysis.length > 0 ? Math.max(...customerAnalysis.map(c => c.count)) : 0}
                  </div>
                  <div className="text-sm text-pink-600">{t('reports.maxPurchases')}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. Performance Reports */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div 
          className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('performance')}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Target className="w-6 h-6 text-orange-600 mr-3" />
              {t('reports.performanceReports')}
            </h2>
            {collapsedSections.has('performance') ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {!collapsedSections.has('performance') && (
          <div className="p-6 space-y-6">
            {/* KPI Dashboard */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.kpiDashboard')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiData.map((kpi, index) => (
                  <div key={index} className={`bg-${kpi.color}-50 rounded-lg p-4 border border-${kpi.color}-200`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-${kpi.color}-600 text-sm font-medium`}>{kpi.title}</p>
                        <p className={`text-2xl font-bold text-${kpi.color}-700`}>{kpi.value}</p>
                      </div>
                      <kpi.icon className={`w-8 h-8 text-${kpi.color}-600`} />
                    </div>
                    <div className="mt-2 flex items-center">
                      {kpi.change === 'increase' ? (
                        <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                      )}
                      <span className={`text-xs ${kpi.change === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
                        {kpi.change === 'increase' ? t('reports.increase') : t('reports.decrease')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Performance Table */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.monthlyPerformanceTable')}</h3>
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-sm text-green-600 mb-1">{t('reports.totalIncome6Months')}</div>
                  <div className="text-lg font-bold text-green-700">
                    {formatAmount(displayMonthlyData.reduce((sum, data) => sum + data.income, 0))}
                  </div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-sm text-red-600 mb-1">{t('reports.totalExpense6Months')}</div>
                  <div className="text-lg font-bold text-red-700">
                    {formatAmount(displayMonthlyData.reduce((sum, data) => sum + data.expense, 0))}
                  </div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm text-blue-600 mb-1">{t('reports.netProfit6Months')}</div>
                  <div className={`text-lg font-bold ${
                    displayMonthlyData.reduce((sum, data) => sum + data.net, 0) >= 0 ? 'text-blue-700' : 'text-red-700'
                  }`}>
                    {formatAmount(displayMonthlyData.reduce((sum, data) => sum + data.net, 0))}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">{t('reports.month')}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">{t('common.income')}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">{t('common.expense')}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">{t('reports.profit')}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">{t('reports.profitMarginPercent')}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">{t('reports.expenseRatio')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {displayMonthlyData.map((data, index) => {
                      const margin = data.income > 0 ? ((data.net / data.income) * 100) : 0;
                      const expenseRatio = data.income > 0 ? ((data.expense / data.income) * 100) : 0;
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{data.month}</td>
                          <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                            {formatAmount(data.income)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                            {formatAmount(data.expense)}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${data.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatAmount(data.net)}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {margin.toFixed(1)}%
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${expenseRatio <= 70 ? 'text-green-600' : expenseRatio <= 85 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {expenseRatio.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expense Efficiency Analysis */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.expenseEfficiency')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">{t('reports.expenseCategoryPerformance')}</h4>
                  <div className="space-y-2">
                    {expenseCategories.slice(0, 5).map((category, index) => {
                      const percentage = totalExpenses > 0 ? (category.total / totalExpenses * 100) : 0;
                      return (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-900">{category.category}</span>
                            <span className="text-xs text-gray-500">
                              {percentage.toFixed(1)}% • {formatAmount(category.total)}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
import React, { useState, useMemo } from 'react';
import { Search, Calendar, Filter, Eye, Edit, Trash2, BookOpen, TrendingUp, TrendingDown, X } from 'lucide-react';
import InvoiceViewModal from './InvoiceViewModal';
import ExpenseViewModal from './ExpenseViewModal';
import SaleViewModal from './SaleViewModal';
import { useCurrency } from '../contexts/CurrencyContext';

// --- Helpers ---
// Safely parse localized currency strings (e.g., '1.234,56') into numbers
export const toNumber = (v: any): number => {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  const s = String(v).trim();
  const normalized = s.replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
};

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  reference?: string;
  customer?: string;
  category?: string;
  debit: number;
  credit: number;
  balance: number;
  type: 'invoice' | 'expense' | 'sale';
  originalData: any;
}

interface GeneralLedgerProps {
  invoices: any[];
  expenses: any[];
  sales: any[];
  onViewInvoice?: (invoice: any) => void;
  onEditInvoice?: (invoice: any) => void;
  onViewExpense?: (expense: any) => void;
  onEditExpense?: (expense: any) => void;
  onViewSale?: (sale: any) => void;
  onEditSale?: (sale: any) => void;
  onViewEntry?: (entry: LedgerEntry) => void;
  onInvoicesUpdate?: (invoices: any[]) => void;
  onExpensesUpdate?: (expenses: any[]) => void;
  onSalesUpdate?: (sales: any[]) => void;
}

export default function GeneralLedger({
  invoices,
  expenses,
  sales,
  onViewInvoice,
  onEditInvoice,
  onViewExpense,
  onEditExpense,
  onViewSale,
  onEditSale,
  onViewEntry
}: GeneralLedgerProps) {
  const { formatCurrency } = useCurrency();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [viewingExpense, setViewingExpense] = useState<any>(null);
  const [viewingSale, setViewingSale] = useState<any>(null);

  // Convert all transactions to ledger entries
  const entries: LedgerEntry[] = useMemo(() => {
    const entries: LedgerEntry[] = [];
    const allTransactions: Array<{ date: string; type: 'invoice' | 'expense' | 'sale'; data: any; }> = [];

    // Add invoices
    invoices.forEach(invoice => {
      allTransactions.push({
        date: invoice.issueDate,
        type: 'invoice',
        data: invoice
      });
    });

    // Add expenses
    expenses.forEach(expense => {
      allTransactions.push({
        date: expense.expenseDate,
        type: 'expense',
        data: expense
      });
    });

    // Add sales (for visibility if you also record direct sales separate from invoices)
    sales.forEach(sale => {
      allTransactions.push({
        date: sale.date,
        type: 'sale',
        data: sale
      });
    });

    // Sort by date
    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Running balance
    let runningBalance = 0;

    allTransactions.forEach(transaction => {
      if (transaction.type === 'invoice') {
        const invoice = transaction.data;

        // Affects balance only if invoice is paid
        if (invoice.status === 'paid') {
          runningBalance += toNumber(invoice.total);
        }

        const category = invoice.type === 'product' ? 'Ürün Satış Geliri' : 'Hizmet Geliri';

        entries.push({
          id: `inv-${invoice.id}`,
          date: invoice.issueDate,
          description: `Fatura - ${invoice.customerName}`,
          reference: invoice.invoiceNumber,
          customer: invoice.customerName,
          category,
          debit: 0,
          credit: invoice.status === 'paid' ? toNumber(invoice.total) : 0,
          balance: runningBalance,
          type: 'invoice',
          originalData: invoice
        });
      } else if (transaction.type === 'expense') {
        const expense = transaction.data;

        if (expense.status === 'paid') {
          runningBalance -= toNumber(expense.amount);
        }

        entries.push({
          id: `exp-${expense.id}`,
          date: expense.expenseDate,
          description: `Gider - ${expense.description}`,
          reference: expense.expenseNumber,
          customer: expense.supplier,
          category: expense.category,
          debit: expense.status === 'paid' ? toNumber(expense.amount) : 0,
          credit: 0,
          balance: runningBalance,
          type: 'expense',
          originalData: expense
        });
      } else if (transaction.type === 'sale') {
        const sale = transaction.data;

        if (sale.status === 'completed') {
          runningBalance += toNumber(sale.amount);
        }

        entries.push({
          id: `sal-${sale.id}`,
          date: sale.date,
          description: `Direkt Satış - ${sale.productName}`,
          reference: sale.saleNumber || `SAL-${sale.id}`,
          customer: sale.customerName,
          category: 'Direkt Satış Geliri',
          debit: 0,
          credit: sale.status === 'completed' ? toNumber(sale.amount) : 0,
          balance: runningBalance,
          type: 'sale',
          originalData: sale
        });
      }
    });

    return entries;
  }, [invoices, expenses, sales]);

  // Filters
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesType = typeFilter === 'all' || entry.type === typeFilter;
      const matchesSearch =
        !searchTerm ||
        (entry.description && entry.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (entry.reference && entry.reference.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (entry.customer && entry.customer.toLowerCase().includes(searchTerm.toLowerCase()));

      const entryDate = new Date(entry.date);
      const matchesStartDate = !startDate || entryDate >= new Date(startDate);
      const matchesEndDate = !endDate || entryDate <= new Date(endDate);
      const matchesDateRange = matchesStartDate && matchesEndDate;

      const matchesCustomer = !customerSearch ||
        (entry.customer && entry.customer.toLowerCase().includes(customerSearch.toLowerCase()));

      const matchesCategory = !categoryFilter ||
        (entry.category && entry.category.toLowerCase().includes(categoryFilter.toLowerCase()));

      return matchesType && matchesSearch && matchesDateRange && matchesCustomer && matchesCategory;
    });
  }, [entries, typeFilter, searchTerm, startDate, endDate, customerSearch, categoryFilter]);

  // Rendering helpers
  const formatAmount = (n: number) =>
    formatCurrency(n || 0);

  const getTypeIcon = (type: string) => {
    if (type === 'invoice') {
      return (
        <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
          <span className="text-blue-600 text-xs font-bold">F</span>
        </div>
      );
    } else if (type === 'expense') {
      return (
        <div className="w-6 h-6 bg-red-100 rounded flex items-center justify-center">
          <span className="text-red-600 text-xs font-bold">G</span>
        </div>
      );
    } else if (type === 'sale') {
      return (
        <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
          <span className="text-green-600 text-xs font-bold">S</span>
        </div>
      );
    }
    return null;
  };

  // UI (table/list) — bu kısım projendeki mevcut JSX yapısına göre zaten vardı,
  // burada yalnızca logic düzeltildi. Aşağıda örnek render devam eder:
  return (
    <div className="space-y-6">
      {/* Filters / Search */}
      {/* ... mevcut filtre ve arama UI kodların ... */}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-white shadow">
          <div className="text-sm text-gray-500">Toplam Credit</div>
          <div className="text-xl font-semibold">
            {formatAmount(filteredEntries.reduce((sum, e) => sum + e.credit, 0))}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-white shadow">
          <div className="text-sm text-gray-500">Toplam Debit</div>
          <div className="text-xl font-semibold">
            {formatAmount(filteredEntries.reduce((sum, e) => sum + e.debit, 0))}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-white shadow">
          <div className="text-sm text-gray-500">Net Bakiye</div>
          <div className="text-xl font-semibold">
            {formatAmount(
              filteredEntries.reduce((sum, e) => sum + e.credit - e.debit, 0)
            )}
          </div>
        </div>
      </div>

      {/* Entries List / Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="divide-y divide-gray-100">
          {filteredEntries.map((entry) => (
            <div key={entry.id} className="grid grid-cols-12 items-center px-4 py-3">
              <div className="col-span-3 flex items-center gap-3">
                {getTypeIcon(entry.type)}
                <div>
                  <div className="text-sm font-medium text-gray-900">{entry.description}</div>
                  <div className="text-xs text-gray-500">
                    {entry.reference ? `Ref: ${entry.reference} • ` : ''}{entry.customer || '-'}
                  </div>
                </div>
              </div>
              <div className="col-span-2 text-sm text-gray-700">{entry.date}</div>
              <div className="col-span-3 text-sm text-gray-700">{entry.category || '-'}</div>
              <div className="col-span-2 text-right">
                <span className={`text-sm font-medium ${entry.debit > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {formatAmount(entry.debit)}
                </span>
              </div>
              <div className="col-span-2 text-right">
                <span className={`text-sm font-medium ${entry.credit > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {formatAmount(entry.credit)}
                </span>
              </div>
            </div>
          ))}
          {filteredEntries.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-500">Kayıt bulunamadı.</div>
          )}
        </div>
      </div>

      {/* View Modals */}
      {viewingInvoice && (
        <InvoiceViewModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />
      )}
      {viewingExpense && (
        <ExpenseViewModal expense={viewingExpense} onClose={() => setViewingExpense(null)} />
      )}
      {viewingSale && (
        <SaleViewModal sale={viewingSale} onClose={() => setViewingSale(null)} />
      )}
    </div>
  );
}

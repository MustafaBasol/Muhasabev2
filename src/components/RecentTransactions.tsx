import React, { useState, useMemo } from 'react';
import { Eye, Edit, Download } from 'lucide-react';

interface RecentTransactionsProps {
  invoices?: any[];
  expenses?: any[];
  sales?: any[];
  onViewInvoice?: (invoice: any) => void;
  onEditInvoice?: (invoice: any) => void;
  onDownloadInvoice?: (invoice: any) => void;
  onViewExpense?: (expense: any) => void;
  onEditExpense?: (expense: any) => void;
  onDownloadExpense?: (expense: any) => void;
  onViewSale?: (sale: any) => void;
  onEditSale?: (sale: any) => void;
  onDownloadSale?: (sale: any) => void;
  onViewAllTransactions?: () => void;
}

export default function RecentTransactions({ 
  invoices = [], 
  expenses = [], 
  sales = [],
  onViewInvoice,
  onEditInvoice,
  onDownloadInvoice,
  onViewExpense,
  onEditExpense,
  onDownloadExpense,
  onViewSale,
  onEditSale,
  onDownloadSale,
  onViewAllTransactions
}: RecentTransactionsProps) {
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

const formatAmount = (amount?: number | string) => {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  return `₺${safe.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
};

  // Combine all transactions and sort by date
  const transactions = useMemo(() => {
    const allTransactions = [
      // Invoices
      ...invoices.map(invoice => ({
        id: invoice.invoiceNumber || invoice.id,
        customer: invoice.customerName,
        amount: formatAmount(invoice.total),
        status: invoice.status,
        date: formatDate(invoice.issueDate),
        type: 'invoice',
        originalData: invoice,
        sortDate: new Date(invoice.issueDate)
      })),
      // Expenses
      ...expenses.map(expense => ({
        id: expense.expenseNumber || expense.id,
        customer: expense.description,
        amount: formatAmount(expense.amount),
        status: expense.status,
        date: formatDate(expense.expenseDate),
        type: 'expense',
        originalData: expense,
        sortDate: new Date(expense.expenseDate)
      })),
      // Sales
      ...sales.map(sale => ({
        id: sale.saleNumber || `SAL-${sale.id}`,
        customer: sale.customerName,
        amount: formatAmount(sale.amount),
        status: sale.status,
        date: formatDate(sale.date),
        type: 'sale',
        originalData: sale,
        sortDate: new Date(sale.date)
      }))
    ];

    // Sort by date (newest first) and take only the last 3
    return allTransactions
      .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
      .slice(0, 3);
  }, [invoices, expenses, sales]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      paid: { label: 'Ödendi', class: 'bg-green-100 text-green-800' },
      completed: { label: 'Tamamlandı', class: 'bg-green-100 text-green-800' },
      pending: { label: 'Bekliyor', class: 'bg-yellow-100 text-yellow-800' },
      overdue: { label: 'Gecikmiş', class: 'bg-red-100 text-red-800' },
      draft: { label: 'Taslak', class: 'bg-gray-100 text-gray-800' },
      sent: { label: 'Gönderildi', class: 'bg-blue-100 text-blue-800' },
      approved: { label: 'Onaylandı', class: 'bg-blue-100 text-blue-800' },
      cancelled: { label: 'İptal', class: 'bg-red-100 text-red-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return config || { label: status, class: 'bg-gray-100 text-gray-800' };
  };

  const getTypeIcon = (type: string) => {
    if (type === 'invoice') {
      return (
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <span className="text-blue-600 text-xs font-bold">F</span>
        </div>
      );
    } else if (type === 'expense') {
      return (
        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
          <span className="text-red-600 text-xs font-bold">G</span>
        </div>
      );
    } else if (type === 'sale') {
      return (
        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
          <span className="text-green-600 text-xs font-bold">S</span>
        </div>
      );
    }
    return (
      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
        <span className="text-blue-600 text-xs font-bold">F</span>
      </div>
    );
  };

  // Simple click handlers
  const handleRowClick = (transaction: any) => {
    console.log('Row clicked:', transaction);
    console.log('Transaction type:', transaction.type);
    console.log('Original data:', transaction.originalData);
    
    if (transaction.type === 'invoice') {
      console.log('Opening invoice view');
      onViewInvoice?.(transaction.originalData);
    } else if (transaction.type === 'expense') {
      console.log('Opening expense view');
      onViewExpense?.(transaction.originalData);
    } else if (transaction.type === 'sale') {
      console.log('Opening sale view');
      onViewSale?.(transaction.originalData);
    }
  };

  const handleEdit = (e: React.MouseEvent, transaction: any) => {
    e.stopPropagation();
    
    if (transaction.type === 'invoice') {
      onEditInvoice?.(transaction.originalData);
    } else if (transaction.type === 'expense') {
      onEditExpense?.(transaction.originalData);
    } else if (transaction.type === 'sale') {
      onEditSale?.(transaction.originalData);
    }
  };

  const handleDownload = (e: React.MouseEvent, transaction: any) => {
    e.stopPropagation();
    
    if (transaction.type === 'invoice') {
      onDownloadInvoice?.(transaction.originalData);
    } else if (transaction.type === 'expense') {
      onDownloadExpense?.(transaction.originalData);
    } else if (transaction.type === 'sale') {
      onDownloadSale?.(transaction.originalData);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Son İşlemler</h3>
            <p className="text-sm text-gray-500">Son 3 işleminiz</p>
          </div>
          {onViewAllTransactions && (
            <button
              onClick={onViewAllTransactions}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              Tümünü Gör →
            </button>
          )}
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                İşlem
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Müşteri/Açıklama
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tutar
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Durum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tarih
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Henüz işlem bulunmuyor
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr 
                  key={transaction.id} 
                  onClick={() => handleRowClick(transaction)}
                  className="hover:bg-gray-50 transition-colors"
                  style={{ cursor: 'pointer' }}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      {getTypeIcon(transaction.type)}
                      <span className="text-sm text-gray-900">
                        {transaction.id}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {transaction.customer}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-semibold ${
                      transaction.type === 'expense' ? 'text-red-600' : 'text-green-600'
                      }`}>
                      {transaction.type === 'expense' ? '-' : '+'}{transaction.amount}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(transaction.status).class}`}>
                      {getStatusBadge(transaction.status).label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.date}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
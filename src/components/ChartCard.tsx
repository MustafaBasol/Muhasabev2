import React from 'react';

interface ChartCardProps {
  sales?: any[];
  expenses?: any[];
  invoices?: any[];
}

export default function ChartCard({ sales = [], expenses = [], invoices = [] }: ChartCardProps) {
  // Get current date and calculate last 6 months dynamically
  const getCurrentDate = () => new Date(2025, 8, 10); // September 10, 2025
  const currentDate = getCurrentDate();

  const getLast6Months = () => {
    const months = [];
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      months.push({
        month: monthNames[date.getMonth()],
        year: date.getFullYear(),
        monthIndex: date.getMonth()
      });
    }
    return months;
  };

  const last6Months = getLast6Months();

  // Calculate monthly data from actual sales and expenses
  const monthlyData = last6Months.map(monthInfo => {
    // Calculate income from multiple sources
    let income = 0;
    
    // 1. Paid invoices for this month
    const paidInvoices = invoices.filter(invoice => {
      if (invoice.status !== 'paid') return false;
      const invoiceDate = new Date(invoice.issueDate);
      return invoiceDate.getMonth() === monthInfo.monthIndex && invoiceDate.getFullYear() === monthInfo.year;
    });
    income += paidInvoices.reduce((sum, invoice) => sum + (Number(invoice.total) || 0), 0);
    
    // 2. Completed sales that haven't been converted to invoices
    const completedSales = sales.filter(sale => {
      if (sale.status !== 'completed') return false;
      const saleDate = new Date(sale.date);
      const isInMonth = saleDate.getMonth() === monthInfo.monthIndex && saleDate.getFullYear() === monthInfo.year;
      
      if (!isInMonth) return false;
      
      // Check if this sale has been converted to an invoice
      const hasInvoice = invoices.some(invoice => 
        invoice.notes && invoice.notes.includes(sale.saleNumber || `SAL-${sale.id}`)
      );
      
      return !hasInvoice; // Only include if no invoice exists
    });
    income += completedSales.reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0);
    
    // 3. Get paid expenses for this month
    const paidExpenses = expenses.filter(expense => {
      if (expense.status !== 'paid') return false;
      const expenseDate = new Date(expense.expenseDate);
      return expenseDate.getMonth() === monthInfo.monthIndex && expenseDate.getFullYear() === monthInfo.year;
    });
    const expense = paidExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

    return {
      month: monthInfo.month,
      income,
      expense
    };
  });

  const maxValue = Math.max(...monthlyData.flatMap(d => [d.income, d.expense]));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Aylık Gelir/Gider</h3>
          <p className="text-sm text-gray-500">Son 6 aylık performans</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Gelir</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Gider</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {monthlyData.map((data, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">{data.month}</span>
              <div className="text-xs text-gray-500">
                Net: ₺{(data.income - data.expense).toLocaleString()}
              </div>
            </div>
            
            <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-4 bg-blue-500 rounded-sm"
                style={{ width: `${(data.income / maxValue) * 100}%` }}
              ></div>
              <div 
                className="absolute bottom-0 left-0 h-4 bg-red-500 rounded-sm"
                style={{ width: `${(data.expense / maxValue) * 100}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between text-xs text-gray-500">
              <span>₺{data.income.toLocaleString()}</span>
              <span>₺{data.expense.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
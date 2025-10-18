import React, { useState, useMemo } from 'react';



import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  FileText, 
  Receipt, 
  Calendar,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Wallet
} from 'lucide-react';

/* __REPORTS_HELPERS__ */
// numeric
const toNumber = (v: any): number => {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  const s = String(v).trim().replace(/\s/g,'').replace(/\./g,'').replace(/,/g,'.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

// date parsing: supports 'yyyy-mm-dd' and 'dd.mm.yyyy'
const parseMaybeDate = (input: any): Date => {
  if (!input) return new Date('1970-01-01');
  const s = String(input);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return new Date(s);
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('.');
    return new Date(`${yyyy}-${mm}-${dd}`);
  }
  return new Date(s);
};

// status helpers (tr/en, case-insensitive)
const isPaidLike = (status: any) => {
  const s = String(status || '').toLowerCase();
  return s.includes('paid') || s.includes('öden') || s.includes('odendi') || s.includes('ödendi');
};
const isCompletedLike = (status: any) => {
  const s = String(status || '').toLowerCase();
  return s.includes('completed') || s.includes('tamam');
};

// amount helpers
const getInvoiceTotal = (inv: any): number => {
  if (inv == null) return 0;
  if (inv.total != null) return toNumber(inv.total);
  if (inv.amount != null) return toNumber(inv.amount);
  if (Array.isArray(inv.items)) {
    return inv.items.reduce((sum: number, it: any) => sum + toNumber(it.quantity) * toNumber(it.unitPrice), 0);
  }
  return 0;
};
const getExpenseAmount = (exp: any): number => toNumber(exp?.amount);
const getSaleAmount = (sale: any): number => {
  if (sale?.amount != null) return toNumber(sale.amount);
  return toNumber(sale?.quantity) * toNumber(sale?.unitPrice);
};

// date getters
const getInvoiceDate = (inv: any): Date => parseMaybeDate(inv?.issueDate ?? inv?.date);
const getExpenseDate = (exp: any): Date => parseMaybeDate(exp?.expenseDate ?? exp?.date);
const getSaleDate = (sale: any): Date => parseMaybeDate(sale?.date ?? sale?.saleDate);
interface ReportsPageProps {
  invoices?: any[];
  expenses?: any[];
  sales?: any[];
  customers?: any[];
}

export default function ReportsPage({ 
  invoices = [], 
  expenses = [], 
  sales = [],
  customers = []
}: ReportsPageProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Debug: Log all data to see what we have
  console.log('=== REPORTS DEBUG ===');
  console.log('All invoices:', invoices);
  console.log('All expenses:', expenses);
  console.log('All sales:', sales);
  console.log('Paid invoices:', invoices.filter(inv => inv.status === 'paid'));
  console.log('Paid expenses:', expenses.filter(exp => exp.status === 'paid'));
  console.log('Completed sales:', sales.filter(sale => sale.status === 'completed'));

  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  const getCurrentDate = () => new Date(); // Use actual current date
  const currentDate = getCurrentDate();

  const getLast6Months = () => {
    const months = [];
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthIndex = date.getMonth();
      const year = date.getFullYear();
      
      // Get paid invoices for this month
      const monthInvoices = invoices.filter(invoice => {
  if (!isPaidLike(invoice.status)) return false;
  const d = getInvoiceDate(invoice);
  return d.getMonth() === monthIndex && d.getFullYear() === year;
});
      
      // Get paid expenses for this month
      const monthExpenses = expenses.filter(expense => {
  if (!isPaidLike(expense.status)) return false;
  const d = getExpenseDate(expense);
  return d.getMonth() === monthIndex && d.getFullYear() === year;
});
      
      // Get completed sales for this month (that haven't been converted to invoices)
      const monthSales = sales.filter(sale => {
  if (!isCompletedLike(sale.status)) return false;
  const hasInvoice = invoices.some(inv => inv.notes && (inv.notes.includes(sale.saleNumber || `SAL-${sale.id}`)));
  if (hasInvoice) return false;
  const d = getSaleDate(sale);
  return d.getMonth() === monthIndex && d.getFullYear() === year;
});
        
      
      // Calculate income from both invoices and direct sales
      const invoiceIncome = monthInvoices.reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
const salesIncome = monthSales.reduce((sum, sale) => sum + getSaleAmount(sale), 0);
const totalIncome = invoiceIncome + salesIncome;
      
      const totalExpense = monthExpenses.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
console.log(`Month ${monthNames[monthIndex]}: invoiceIncome=${invoiceIncome}, salesIncome=${salesIncome}, totalIncome=${totalIncome}, totalExpense=${totalExpense}`);
      
      const monthData = {
        month: monthNames[monthIndex],
        monthIndex,
        year,
        income: totalIncome,
        expense: totalExpense
      };
      
      months.push(monthData);
    }
    return months;
  };

  const last6Months = getLast6Months();

  // Calculate metrics
  // Calculate total revenue from paid invoices
  const paidInvoiceRevenue = invoices
    .filter(invoice => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
  
  // Calculate revenue from direct sales (not converted to invoices)
  const directSalesRevenue = sales
    .filter(sale => {
      if (sale.status !== 'completed') return false;
      
      // Check if this sale has been converted to an invoice
      const hasInvoice = invoices.some(invoice => 
        invoice.notes && invoice.notes.includes(sale.saleNumber || `SAL-${sale.id}`)
      );
      
      return !hasInvoice;
    })
    .reduce((sum, sale) => sum + getSaleAmount(sale), 0);
  
  const totalRevenue = paidInvoiceRevenue + directSalesRevenue;
  
  console.log('Revenue calculation:');
  console.log('- Paid invoice revenue:', paidInvoiceRevenue);
  console.log('- Direct sales revenue:', directSalesRevenue);
  console.log('- Total revenue:', totalRevenue);

  const totalExpenses = expenses
    .filter(expense => expense.status === 'paid')
    .reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  
  console.log('Total expenses (paid only):', totalExpenses);

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

  const maxValue = Math.max(...monthlyData.flatMap(d => [d.income, d.expense]));

  // Product sales analysis
  const productSales = useMemo(() => {
    const productMap = new Map();
    
    // Add products from paid invoices
    invoices
      .filter(invoice => invoice.status === 'paid')
      .forEach(invoice => {
        (invoice.items || []).forEach(item => {
          const existing = productMap.get(item.description) || { name: item.description, total: 0, count: 0 };
          existing.total += toNumber(item.total);
          existing.count += 1;
          productMap.set(item.description, existing);
        });
      });
    
    // Add direct sales that haven't been converted to invoices
    sales.forEach(sale => {
      if (sale.status === 'completed') {
        // Check if this sale has been converted to an invoice
        const hasInvoice = invoices.some(invoice => 
          invoice.notes && invoice.notes.includes(sale.saleNumber || `SAL-${sale.id}`)
        );
        
        if (!hasInvoice) {
          const existing = productMap.get(sale.productName) || { name: sale.productName, total: 0, count: 0 };
          existing.total += toNumber(sale.amount);
          existing.count += 1;
          productMap.set(sale.productName, existing);
        }
      }
    });
    
    // If no real data, add some demo data for visualization
    if (productMap.size === 0) {
      const demoProducts = [
        { name: 'Web Tasarım Hizmeti', total: 15000, count: 3 },
        { name: 'Mobil Uygulama', total: 25000, count: 2 },
        { name: 'SEO Danışmanlığı', total: 8000, count: 4 },
        { name: 'Grafik Tasarım', total: 5000, count: 5 }
      ];
      
      demoProducts.forEach(product => {
        productMap.set(product.name, product);
      });
    }
    
    return Array.from(productMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [invoices, sales]);

  // Expense categories with demo data if empty
  const expenseCategories = useMemo(() => {
    const categoryMap = new Map();
    
    expenses
      .filter(expense => expense.status === 'paid')
      .forEach(expense => {
        const existing = categoryMap.get(expense.category) || { category: expense.category, total: 0, count: 0 };
        existing.total += toNumber(expense.amount);
        existing.count += 1;
        categoryMap.set(expense.category, existing);
      });
    
    // If no real data, add some demo data
    if (categoryMap.size === 0) {
      const demoCategories = [
        { category: 'Kira', total: 12000, count: 6 },
        { category: 'Elektrik', total: 3500, count: 6 },
        { category: 'İnternet', total: 1800, count: 6 },
        { category: 'Ofis Malzemeleri', total: 2500, count: 8 }
      ];
      
      demoCategories.forEach(cat => {
        categoryMap.set(cat.category, cat);
      });
    }
    
    return Array.from(categoryMap.values())
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  // Customer analysis with demo data if empty
  const customerAnalysis = useMemo(() => {
    const customerMap = new Map();
    
    // Get customer data from paid invoices
    invoices
      .filter(invoice => invoice.status === 'paid')
      .forEach(invoice => {
        const existing = customerMap.get(invoice.customerName) || { 
          name: invoice.customerName, 
          total: 0, 
          count: 0,
          lastPurchase: invoice.issueDate
        };
        existing.total += toNumber(invoice.total);
        existing.count += 1;
        if (new Date(invoice.issueDate) > new Date(existing.lastPurchase)) {
          existing.lastPurchase = invoice.issueDate;
        }
        customerMap.set(invoice.customerName, existing);
      });
    
    // Also include direct sales that haven't been converted to invoices
    sales
      .filter(sale => sale.status === 'completed')
      .forEach(sale => {
        // Check if this sale has been converted to an invoice
        const hasInvoice = invoices.some(invoice => 
          invoice.notes && invoice.notes.includes(sale.saleNumber || `SAL-${sale.id}`)
        );
        
        if (!hasInvoice) {
          const existing = customerMap.get(sale.customerName) || { 
            name: sale.customerName, 
            total: 0, 
            count: 0,
            lastPurchase: sale.date
          };
          existing.total += toNumber(sale.amount);
          existing.count += 1;
          if (new Date(sale.date) > new Date(existing.lastPurchase)) {
            existing.lastPurchase = sale.date;
          }
          customerMap.set(sale.customerName, existing);
        }
      });
    
    // If no real data, add some demo data
    if (customerMap.size === 0) {
      const demoCustomers = [
        { name: 'ABC Teknoloji', total: 25000, count: 3, lastPurchase: '2024-12-01' },
        { name: 'XYZ Şirketi', total: 18000, count: 2, lastPurchase: '2024-11-15' },
        { name: 'DEF Ltd.', total: 12000, count: 4, lastPurchase: '2024-11-20' }
      ];
      
      demoCustomers.forEach(customer => {
        customerMap.set(customer.name, customer);
      });
    }
    
    return Array.from(customerMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [invoices, sales]);

  const formatAmount = (amount: any) => { const n = toNumber(amount); return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`; };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  // Calculate growth rate (comparing last 2 months)
  const currentMonthData = monthlyData[monthlyData.length - 1];
  const previousMonthData = monthlyData[monthlyData.length - 2];
  const growthRate = previousMonthData?.income > 0 
    ? ((currentMonthData.income - previousMonthData.income) / previousMonthData.income * 100)
    : 0;

  // Average sale amount
  const paidInvoicesCount = invoices.filter(invoice => invoice.status === 'paid').length;
  const completedSalesCount = sales.filter(sale => {
    if (sale.status !== 'completed') return false;
    const hasInvoice = invoices.some(invoice => 
      invoice.notes && invoice.notes.includes(sale.saleNumber || `SAL-${sale.id}`)
    );
    return !hasInvoice;
  }).length;
  
  const totalTransactions = paidInvoicesCount + completedSalesCount;
  const averageSale = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  
  console.log('Transaction counts:');
  console.log('- Paid invoices:', paidInvoicesCount);
  console.log('- Direct sales:', completedSalesCount);
  console.log('- Total transactions:', totalTransactions);
  console.log('- Average sale:', averageSale);

  // KPI calculations
  const kpiData = [
    {
      title: 'Büyüme Oranı',
      value: `${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}%`,
      change: growthRate >= 0 ? 'increase' : 'decrease',
      color: 'blue',
      icon: TrendingUp
    },
    {
      title: 'Kar Marjı',
      value: `${profitMargin.toFixed(1)}%`,
      change: profitMargin >= 20 ? 'increase' : 'decrease',
      color: 'green',
      icon: Target
    },
    {
      title: 'Ortalama Satış',
      value: formatAmount(averageSale),
      change: 'increase',
      color: 'purple',
      icon: DollarSign
    },
    {
      title: 'Aktif Müşteri',
      value: customerAnalysis.length.toString(),
      change: 'increase',
      color: 'orange',
      icon: Users
    }
  ];

  // Cash flow data
  const cashFlowData = monthlyData.map(data => ({
    ...data,
    cashIn: data.income,
    cashOut: data.expense,
    netFlow: data.net
  }));

  const totalCashIn = cashFlowData.reduce((sum, data) => sum + data.cashIn, 0);
  const totalCashOut = cashFlowData.reduce((sum, data) => sum + data.cashOut, 0);
  const netCashFlow = totalCashIn - totalCashOut;
  
  // If no real data exists, create demo data for better visualization
  const hasRealData = totalRevenue > 0 || totalExpenses > 0;
  
  // Demo monthly data if no real data exists
  const demoMonthlyData = [
    { month: 'Tem', income: 45000, expense: 18000, net: 27000 },
    { month: 'Ağu', income: 52000, expense: 22000, net: 30000 },
    { month: 'Eyl', income: 38000, expense: 19000, net: 19000 },
    { month: 'Eki', income: 61000, expense: 25000, net: 36000 },
    { month: 'Kas', income: 47000, expense: 21000, net: 26000 },
    { month: 'Ara', income: 55000, expense: 23000, net: 32000 }
  ];
  
  const displayMonthlyData = hasRealData ? monthlyData : demoMonthlyData;
  const displayMaxValue = Math.max(...displayMonthlyData.flatMap(d => [d.income, d.expense]));

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <BarChart3 className="w-8 h-8 text-blue-600 mr-3" />
              Raporlar
            </h1>
            <p className="text-gray-600">İşletmenizin detaylı analiz raporları</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Rapor Tarihi</p>
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
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Activity className="w-6 h-6 text-blue-600 mr-3" />
              Genel Bakış
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Temel Metrikler</h3>
                {!hasRealData && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                    Demo Veri
                  </span>
                )}
                {collapsedSections.has('basic-metrics') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                )}
              </div>
              
              {!collapsedSections.has('basic-metrics') && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <TrendingUp className="w-8 h-8 text-green-600 mr-3" />
                      <div>
                        <p className="text-sm text-green-600">Toplam Gelir</p>
                        <p className="text-xl font-bold text-green-700">
                          {formatAmount(hasRealData ? totalRevenue : 298000)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <TrendingDown className="w-8 h-8 text-red-600 mr-3" />
                      <div>
                        <p className="text-sm text-red-600">Toplam Gider</p>
                        <p className="text-xl font-bold text-red-700">
                          {formatAmount(hasRealData ? totalExpenses : 128000)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <DollarSign className="w-8 h-8 text-blue-600 mr-3" />
                      <div>
                        <p className="text-sm text-blue-600">Net Kar</p>
                        <p className={`text-xl font-bold ${(hasRealData ? netProfit : 170000) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                          {formatAmount(hasRealData ? netProfit : 170000)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <Users className="w-8 h-8 text-purple-600 mr-3" />
                      <div>
                        <p className="text-sm text-purple-600">Toplam Müşteri</p>
                        <p className="text-xl font-bold text-purple-700">
                          {hasRealData ? customers.length : 15}
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Son 6 Aylık Performans</h3>
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
                          Net: {formatAmount(data.net)}
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
                        <span>Gelir: {formatAmount(data.income)}</span>
                        <span>Gider: {formatAmount(data.expense)}</span>
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Finansal Sağlık</h3>
                {collapsedSections.has('financial-health') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                )}
              </div>
              
              {!collapsedSections.has('financial-health') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm">Kar Marjı</p>
                        <p className="text-2xl font-bold">
                          {hasRealData ? profitMargin.toFixed(1) : '57.0'}%
                        </p>
                      </div>
                      <Target className="w-8 h-8 text-green-200" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm">Büyüme Oranı</p>
                        <p className="text-2xl font-bold">
                          {hasRealData ? `${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}` : '+12.5'}%
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-blue-200" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm">Ortalama Satış</p>
                        <p className="text-2xl font-bold">
                          {formatAmount(hasRealData ? averageSale : 19867)}
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Ödeme Durumu Analizi</h3>
                {collapsedSections.has('payment-status') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                )}
              </div>
              
              {!collapsedSections.has('payment-status') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Fatura Durumları</h4>
                    <div className="space-y-2">
                      {['paid', 'sent', 'draft', 'overdue'].map(status => {
                        const count = invoices.filter(inv => inv.status === status).length;
                        const statusLabels = {
                          paid: 'Ödendi',
                          sent: 'Gönderildi', 
                          draft: 'Taslak',
                          overdue: 'Gecikmiş'
                        };
                        const colors = {
                          paid: 'bg-green-100 text-green-800',
                          sent: 'bg-blue-100 text-blue-800',
                          draft: 'bg-gray-100 text-gray-800',
                          overdue: 'bg-red-100 text-red-800'
                        };
                        return (
                          <div key={status} className="flex justify-between items-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]}`}>
                              {statusLabels[status as keyof typeof statusLabels]}
                            </span>
                            <span className="font-medium">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Gider Durumları</h4>
                    <div className="space-y-2">
                      {['paid', 'approved', 'draft'].map(status => {
                        const count = expenses.filter(exp => exp.status === status).length;
                        const statusLabels = {
                          paid: 'Ödendi',
                          approved: 'Onaylandı',
                          draft: 'Taslak'
                        };
                        const colors = {
                          paid: 'bg-green-100 text-green-800',
                          approved: 'bg-blue-100 text-blue-800',
                          draft: 'bg-gray-100 text-gray-800'
                        };
                        return (
                          <div key={status} className="flex justify-between items-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]}`}>
                              {statusLabels[status as keyof typeof statusLabels]}
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

      {/* 2. Revenue Analysis */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div 
          className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('revenue')}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <TrendingUp className="w-6 h-6 text-green-600 mr-3" />
              Gelir Analizi
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ürün Bazında Satışlar</h3>
              <div className="space-y-3">
                {productSales.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.count} satış</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">{formatAmount(product.total)}</div>
                      <div className="text-xs text-gray-500">
                        Ort: {formatAmount(product.total / product.count)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Revenue Trend */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Aylık Gelir Trendi</h3>
              <div className="space-y-3">
                {displayMonthlyData.map((data, index) => (
                  <div key={index} className="flex items-center justify-between">
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
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Receipt className="w-6 h-6 text-red-600 mr-3" />
              Gider Analizi
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
            {/* Expense Categories */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Kategori Bazında Giderler</h3>
              <div className="space-y-3">
                {expenseCategories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{category.category}</div>
                      <div className="text-sm text-gray-500">{category.count} gider</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-600">{formatAmount(category.total)}</div>
                      <div className="text-xs text-gray-500">
                        Ort: {formatAmount(category.total / category.count)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Expense Trend */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Aylık Gider Trendi</h3>
              <div className="space-y-3">
                {displayMonthlyData.map((data, index) => (
                  <div key={index} className="flex items-center justify-between">
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">En Çok Gider Yapılan Tedarikçiler</h3>
              <div className="space-y-3">
                {(() => {
                  const supplierMap = new Map();
                  
                  expenses
                    .filter(expense => expense.status === 'paid')
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
                  
                  // If no real data, add demo suppliers
                  if (supplierMap.size === 0) {
                    const demoSuppliers = [
                      { name: 'Elektrik Şirketi', total: 8500, count: 6, lastExpense: '2024-12-01' },
                      { name: 'İnternet Sağlayıcısı', total: 1800, count: 6, lastExpense: '2024-11-30' },
                      { name: 'Ofis Malzemeleri A.Ş.', total: 2500, count: 4, lastExpense: '2024-11-25' }
                    ];
                    
                    demoSuppliers.forEach(supplier => {
                      supplierMap.set(supplier.name, supplier);
                    });
                  }
                  
                  return Array.from(supplierMap.values())
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 5);
                })().map((supplier, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-red-600 font-semibold text-sm">
                          {supplier.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{supplier.name}</div>
                        <div className="text-sm text-gray-500">
                          {supplier.count} gider • Son: {formatDate(supplier.lastExpense)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-600">{formatAmount(supplier.total)}</div>
                      <div className="text-xs text-gray-500">
                        Ort: {formatAmount(supplier.total / supplier.count)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Expenses */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Son Giderler</h3>
              <div className="space-y-2">
                {expenses
                  .filter(expense => expense.status === 'paid')
                  .sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())
                  .slice(0, 5)
                  .map((expense, index) => (
                  <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Gider Kategorisi Dağılımı</h3>
              <div className="space-y-3">
                {expenseCategories.slice(0, 6).map((category, index) => {
                  const displayTotalExpenses = hasRealData ? totalExpenses : 19800;
                  const percentage = displayTotalExpenses > 0 ? (category.total / displayTotalExpenses * 100) : 0;
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

      {/* 4. Customer Analysis */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div 
          className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('customers')}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Users className="w-6 h-6 text-purple-600 mr-3" />
              Müşteri Analizi
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">En Değerli Müşteriler</h3>
              <div className="space-y-3">
                {customerAnalysis.map((customer, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 font-semibold text-sm">
                          {customer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{customer.name}</div>
                        <div className="text-sm text-gray-500">
                          {customer.count} alışveriş • Son: {formatDate(customer.lastPurchase)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-purple-600">{formatAmount(customer.total)}</div>
                      <div className="text-xs text-gray-500">
                        Ort: {formatAmount(customer.total / customer.count)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Statistics */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Müşteri İstatistikleri</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">{customers.length}</div>
                  <div className="text-sm text-purple-600">Toplam Müşteri</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">{customerAnalysis.length}</div>
                  <div className="text-sm text-green-600">Aktif Müşteri</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatAmount(customerAnalysis.length > 0 ? totalRevenue / customerAnalysis.length : 0)}
                  </div>
                  <div className="text-sm text-blue-600">Müşteri Başına Gelir</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-600">
                    {customerAnalysis.length > 0 ? (totalTransactions / customerAnalysis.length).toFixed(1) : '0'}
                  </div>
                  <div className="text-sm text-orange-600">Müşteri Başına Satış</div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-indigo-600">
                    {customerAnalysis.length > 0 ? Math.round(totalTransactions / customerAnalysis.length) : 0}
                  </div>
                  <div className="text-sm text-indigo-600">Ortalama Alışveriş</div>
                </div>
                <div className="bg-pink-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-pink-600">
                    {customerAnalysis.length > 0 ? Math.max(...customerAnalysis.map(c => c.count)) : 0}
                  </div>
                  <div className="text-sm text-pink-600">En Çok Alışveriş</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Performance Reports */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div 
          className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('performance')}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Target className="w-6 h-6 text-orange-600 mr-3" />
              Performans Raporları
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">KPI Dashboard</h3>
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
                        {kpi.change === 'increase' ? 'Artış' : 'Azalış'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Performance Table */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Aylık Performans Tablosu</h3>
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-sm text-green-600 mb-1">Toplam Gelir (6 Ay)</div>
                  <div className="text-lg font-bold text-green-700">
                    {formatAmount(displayMonthlyData.reduce((sum, data) => sum + data.income, 0))}
                  </div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-sm text-red-600 mb-1">Toplam Gider (6 Ay)</div>
                  <div className="text-lg font-bold text-red-700">
                    {formatAmount(displayMonthlyData.reduce((sum, data) => sum + data.expense, 0))}
                  </div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm text-blue-600 mb-1">Net Kar (6 Ay)</div>
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
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Ay</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Gelir</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Gider</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Kar</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Kar Marjı</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Gider Oranı</th>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Gider Verimliliği Analizi</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Gider Kategorisi Performansı</h4>
                  <div className="space-y-2">
                    {expenseCategories.slice(0, 5).map((category, index) => {
                      const percentage = totalExpenses > 0 ? (category.total / totalExpenses * 100) : 0;
                      const avgPerExpense = category.total / category.count;
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
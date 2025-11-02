import { useState, useMemo } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';

interface ChartCardProps {
  sales?: any[];
  expenses?: any[];
  invoices?: any[];
}

export default function ChartCard({ sales = [], expenses = [], invoices = [] }: ChartCardProps) {
  const { formatCurrency } = useCurrency();
  const { t, i18n } = useTranslation();
  const [isVisible, setIsVisible] = useState(true);

  const getLast6Months = () => {
    const currentDate = new Date(); // Get current date dynamically each time
    const months = [];
    // Month names will use translation
    
    // Start from current month (i=0) and go back 5 months
    // This will show: current month, -1 month, -2 months, ... -5 months
    for (let i = 0; i <= 5; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthIndex = date.getMonth();
      // Use translation keys for month names
      const monthKey = `months.short.${['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][monthIndex]}`;
      months.push({
        month: t(monthKey),
        year: date.getFullYear(),
        monthIndex: monthIndex
      });
    }
    return months;
  };

  const last6Months = useMemo(() => getLast6Months(), [t]);

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
      if (String(sale?.status).toLowerCase() !== 'completed') return false;
      const saleDate = new Date(sale?.date);
      const isInMonth = saleDate.getMonth() === monthInfo.monthIndex && saleDate.getFullYear() === monthInfo.year;
      if (!isInMonth) return false;

      // Check if this sale has been converted to an invoice
      const hasInvoice =
        Boolean(sale?.invoiceId) ||
        invoices.some(inv => String(inv?.saleId || '') === String(sale?.id || ''));

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
          <h3 className="text-lg font-semibold text-gray-900">
            {i18n.language === 'tr' ? 'Aylık Gelir/Gider' : 
             i18n.language === 'en' ? 'Monthly Income/Expense' :
             i18n.language === 'de' ? 'Monatliche Einnahmen/Ausgaben' :
             i18n.language === 'fr' ? 'Revenus/Dépenses Mensuels' :
             'Monthly Income/Expense'}
          </h3>
          <p className="text-sm text-gray-500">
            {i18n.language === 'tr' ? 'Son 6 ay performansı (en yeni → en eski)' : 
             i18n.language === 'en' ? 'Last 6 months performance (newest → oldest)' :
             i18n.language === 'de' ? 'Leistung der letzten 6 Monate (neueste → älteste)' :
             i18n.language === 'fr' ? 'Performance des 6 derniers mois (plus récent → plus ancien)' :
             'Last 6 months performance (newest → oldest)'}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-600">
              {i18n.language === 'tr' ? 'Gelir' : 
               i18n.language === 'en' ? 'Income' :
               i18n.language === 'de' ? 'Einkommen' :
               i18n.language === 'fr' ? 'Revenu' : 'Income'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm text-gray-600">
              {i18n.language === 'tr' ? 'Gider' : 
               i18n.language === 'en' ? 'Expense' :
               i18n.language === 'de' ? 'Ausgaben' :
               i18n.language === 'fr' ? 'Dépense' : 'Expense'}
            </span>
          </div>
          <button
            onClick={() => setIsVisible(!isVisible)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={isVisible ? 
              (i18n.language === 'tr' ? 'Grafiği Gizle' : 
               i18n.language === 'en' ? 'Hide Chart' :
               i18n.language === 'de' ? 'Diagramm Ausblenden' :
               i18n.language === 'fr' ? 'Masquer le Graphique' : 'Hide Chart') :
              (i18n.language === 'tr' ? 'Grafiği Göster' : 
               i18n.language === 'en' ? 'Show Chart' :
               i18n.language === 'de' ? 'Diagramm Anzeigen' :
               i18n.language === 'fr' ? 'Afficher le Graphique' : 'Show Chart')}
          >
            {isVisible ? (
              <EyeOff className="w-4 h-4 text-gray-600" />
            ) : (
              <Eye className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {isVisible && (
        <div className="space-y-4">
          {monthlyData.map((data, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">{data.month}</span>
                <div className="text-xs text-gray-500">
                  Net: {formatCurrency(data.income - data.expense)}
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
                <span>{formatCurrency(data.income)}</span>
                <span>{formatCurrency(data.expense)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {!isVisible && (
        <div className="text-center py-8 text-gray-400">
          <Eye className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">
            {i18n.language === 'tr' ? 'Grafik gizlendi' : 
             i18n.language === 'en' ? 'Chart hidden' :
             i18n.language === 'de' ? 'Diagramm ausgeblendet' :
             i18n.language === 'fr' ? 'Graphique masqué' : 'Chart hidden'}
          </p>
        </div>
      )}
    </div>
  );
}
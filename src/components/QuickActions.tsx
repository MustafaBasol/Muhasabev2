import {
  FileText,
  Receipt,
  TrendingUp,
  Users,
  Building2,
  CreditCard,
  Package
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface QuickActionsProps {
  onNewInvoice: () => void;
  onNewExpense: () => void;
  onNewSale: () => void;
  onNewCustomer: () => void;
  onNewProduct: () => void;
  onViewCustomers: () => void;
  onViewSuppliers: () => void;
  onViewBanks: () => void;
  onViewProducts: () => void;
  customers?: any[];
  suppliers?: any[];
  banks?: any[];
  products?: any[];
}

export default function QuickActions({
  onNewInvoice,
  onNewExpense,
  onNewSale,
  onNewCustomer,
  onNewProduct,
  onViewCustomers,
  onViewSuppliers,
  onViewBanks,
  onViewProducts,
  customers = [],
  suppliers = [],
  banks = [],
  products = [],
}: QuickActionsProps) {
  const { t } = useTranslation();
  const productCount = products.length;

  const quickActions = [
    {
      title: t('quickActions.newInvoice'),
      description: t('quickActions.newInvoiceDesc'),
      icon: FileText,
      color: 'bg-blue-500 hover:bg-blue-600',
      onClick: onNewInvoice,
    },
    {
      title: t('quickActions.newExpense'),
      description: t('quickActions.newExpenseDesc'),
      icon: Receipt,
      color: 'bg-red-500 hover:bg-red-600',
      onClick: onNewExpense,
    },
    {
      title: t('quickActions.newSale'),
      description: t('quickActions.newSaleDesc'),
      icon: TrendingUp,
      color: 'bg-green-500 hover:bg-green-600',
      onClick: onNewSale,
    },
    {
      title: t('quickActions.newCustomer'),
      description: t('quickActions.newCustomerDesc'),
      icon: Users,
      color: 'bg-purple-500 hover:bg-purple-600',
      onClick: onNewCustomer,
    },
    {
      title: t('quickActions.newProduct'),
      description: t('quickActions.newProductDesc'),
      icon: Package,
      color: 'bg-amber-500 hover:bg-amber-600',
      onClick: onNewProduct,
    },
  ];

  const shortcuts = [
    {
      label: t('quickActions.customers'),
      value: customers.length,
      icon: Users,
      accent: 'text-purple-600',
      onClick: onViewCustomers,
    },
    {
      label: t('quickActions.suppliers'),
      value: suppliers.length,
      icon: Building2,
      accent: 'text-orange-500',
      onClick: onViewSuppliers,
    },
    {
      label: t('quickActions.banks'),
      value: banks.length,
      icon: CreditCard,
      accent: 'text-emerald-500',
      onClick: onViewBanks,
    },
    {
      label: t('quickActions.products'),
      value: productCount,
      icon: Package,
      accent: 'text-amber-500',
      onClick: onViewProducts,
    },
  ];  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">{t('dashboard.quickActions')}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action, index) => (
            <button
              key={index}
              type="button"
              onClick={action.onClick}
              className={`${action.color} rounded-lg px-4 py-4 text-left text-white shadow transition-all duration-200 md:hover:scale-[1.02] md:hover:shadow-lg h-28`}
            >
              {/* Başlık üst satırda */}
              <div className="h-6 flex items-center mb-3">
                <div className="text-sm font-semibold">{action.title}</div>
              </div>
              
              {/* İkon ve açıklama yan yana alt satırda */}
              <div className="flex items-start space-x-3">
                <action.icon className="h-5 w-5 flex-shrink-0" />
                <div className="text-xs opacity-90 leading-normal">{action.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">{t('dashboard.quickAccess')}</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {shortcuts.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={item.onClick}
              className="flex flex-col items-start rounded-lg border border-gray-100 bg-gray-50 p-3 text-left transition-colors hover:border-gray-200 hover:bg-gray-100"
            >
              <div className={`mb-2 flex items-center gap-2 text-xs font-medium ${item.accent}`}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
              <span className="text-lg font-semibold text-gray-900">{item.value}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import {
  FileText,
  Receipt,
  TrendingUp,
  Users,
  Building2,
  CreditCard,
  Package
} from 'lucide-react';

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
  const productCount = products.length;

  const quickActions = [
    {
      title: 'Yeni Fatura',
      description: 'Müşteri faturası oluştur',
      icon: FileText,
      color: 'bg-blue-500 hover:bg-blue-600',
      onClick: onNewInvoice,
    },
    {
      title: 'Yeni Gider',
      description: 'Gider kaydı ekle',
      icon: Receipt,
      color: 'bg-red-500 hover:bg-red-600',
      onClick: onNewExpense,
    },
    {
      title: 'Yeni Satış',
      description: 'Satış işlemi kaydet',
      icon: TrendingUp,
      color: 'bg-green-500 hover:bg-green-600',
      onClick: onNewSale,
    },
    {
      title: 'Yeni Müşteri',
      description: 'Müşteri bilgisi ekle',
      icon: Users,
      color: 'bg-purple-500 hover:bg-purple-600',
      onClick: onNewCustomer,
    },
    {
      title: 'Yeni Ürün',
      description: 'Ürün bilgisi ekle',
      icon: Package,
      color: 'bg-amber-500 hover:bg-amber-600',
      onClick: onNewProduct,
    },
  ];

  const shortcuts = [
    {
      label: 'Müşteriler',
      value: customers.length,
      icon: Users,
      accent: 'text-purple-600',
      onClick: onViewCustomers,
    },
    {
      label: 'Tedarikçiler',
      value: suppliers.length,
      icon: Building2,
      accent: 'text-orange-500',
      onClick: onViewSuppliers,
    },
    {
      label: 'Bankalar',
      value: banks.length,
      icon: CreditCard,
      accent: 'text-emerald-500',
      onClick: onViewBanks,
    },
    {
      label: 'Ürünler',
      value: productCount,
      icon: Package,
      accent: 'text-amber-500',
      onClick: onViewProducts,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Hızlı İşlemler</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action, index) => (
            <button
              key={index}
              type="button"
              onClick={action.onClick}
              className={`${action.color} rounded-lg px-4 py-4 text-left text-white shadow transition-all duration-200 hover:scale-[1.02] hover:shadow-lg h-28`}
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
        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Hızlı erişim</h4>
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

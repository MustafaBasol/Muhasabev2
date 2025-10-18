import React from 'react';
import { AlertTriangle, Clock, CheckCircle, TrendingUp, Calendar } from 'lucide-react';

interface DashboardAlertsProps {
  invoices?: any[];
  expenses?: any[];
  onViewOverdueInvoices?: () => void;
  onViewPendingExpenses?: () => void;
}

export default function DashboardAlerts({ 
  invoices = [], 
  expenses = [],
  onViewOverdueInvoices,
  onViewPendingExpenses
}: DashboardAlertsProps) {
  // Calculate alerts
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;
  const pendingExpenses = expenses.filter(exp => exp.status === 'draft').length;
  const dueSoonInvoices = invoices.filter(inv => {
    if (inv.status === 'sent') {
      const dueDate = new Date(inv.dueDate);
      const today = new Date();
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7 && diffDays > 0;
    }
    return false;
  }).length;

  const alerts = [
    {
      type: 'error',
      title: 'Gecikmiş Faturalar',
      count: overdueInvoices,
      description: 'Vadesi geçmiş fatura',
      icon: AlertTriangle,
      color: 'bg-red-50 border-red-200 text-red-800',
      iconColor: 'text-red-600',
      onClick: onViewOverdueInvoices
    },
    {
      type: 'warning',
      title: 'Yaklaşan Vadeler',
      count: dueSoonInvoices,
      description: '7 gün içinde vadesi dolacak',
      icon: Clock,
      color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      iconColor: 'text-yellow-600',
      onClick: onViewOverdueInvoices
    },
    {
      type: 'info',
      title: 'Bekleyen Giderler',
      count: pendingExpenses,
      description: 'Onay bekleyen gider',
      icon: Calendar,
      color: 'bg-blue-50 border-blue-200 text-blue-800',
      iconColor: 'text-blue-600',
      onClick: onViewPendingExpenses
    }
  ];

  const activeAlerts = alerts.filter(alert => alert.count > 0);

  if (activeAlerts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Her Şey Yolunda!</h3>
            <p className="text-sm text-gray-500">Bekleyen işlem veya uyarı bulunmuyor.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
        Dikkat Gereken Konular
      </h3>
      <div className="space-y-3">
        {activeAlerts.map((alert, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${alert.color} cursor-pointer hover:opacity-80 transition-opacity`}
            onClick={alert.onClick}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <alert.icon className={`w-5 h-5 ${alert.iconColor}`} />
                <div>
                  <div className="font-medium">{alert.title}</div>
                  <div className="text-sm opacity-80">{alert.description}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{alert.count}</div>
                <div className="text-xs opacity-80">adet</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
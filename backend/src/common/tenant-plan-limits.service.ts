import { SubscriptionPlan } from '../tenants/entities/tenant.entity';

// Merkezi plan limitleri: Tenant bazlı kısıtlar
export interface TenantPlanLimits {
  maxUsers: number; // -1 = sınırsız
  maxCustomers: number; // -1 = sınırsız
  maxSuppliers: number; // -1 = sınırsız
  maxBankAccounts: number; // -1 = sınırsız (ileride uygulanacak)
  monthly: {
    maxInvoices: number; // -1 = sınırsız
    maxExpenses: number; // -1 = sınırsız
  };
}

// Not: Var olan SubscriptionPlan enum: FREE | BASIC | PROFESSIONAL | ENTERPRISE
// İstenen iş kuralları:
// - Free: 1 kullanıcı, 1 müşteri, 1 tedarikçi, 1 banka hesabı, ayda 5 gelir (fatura) + 5 gider
// - Pro: 1 şirket (tenant), en fazla 3 kullanıcı, diğerleri sınırsız
// - Business: sınırsız, fiyat yerine "iletişime geçin"
// Bu koddaki haritalamada BASIC/PROFESSIONAL -> Pro eşdeğeri kabul edilmiştir.
export const TENANT_PLAN_LIMITS: Record<SubscriptionPlan, TenantPlanLimits> = {
  [SubscriptionPlan.FREE]: {
    maxUsers: 1,
    maxCustomers: 1,
    maxSuppliers: 1,
    maxBankAccounts: 1,
    monthly: {
      maxInvoices: 5,
      maxExpenses: 5,
    },
  },
  [SubscriptionPlan.BASIC]: {
    // "Pro" eşdeğeri kabul edilmiştir
    maxUsers: 3,
    maxCustomers: -1,
    maxSuppliers: -1,
    maxBankAccounts: -1,
    monthly: {
      maxInvoices: -1,
      maxExpenses: -1,
    },
  },
  [SubscriptionPlan.PROFESSIONAL]: {
    // "Pro" eşdeğeri kabul edilmiştir
    maxUsers: 3,
    maxCustomers: -1,
    maxSuppliers: -1,
    maxBankAccounts: -1,
    monthly: {
      maxInvoices: -1,
      maxExpenses: -1,
    },
  },
  [SubscriptionPlan.ENTERPRISE]: {
    // Business: sınırsız
    maxUsers: -1,
    maxCustomers: -1,
    maxSuppliers: -1,
    maxBankAccounts: -1,
    monthly: {
      maxInvoices: -1,
      maxExpenses: -1,
    },
  },
};

export class TenantPlanLimitService {
  static getLimits(plan: SubscriptionPlan): TenantPlanLimits {
    return (
      TENANT_PLAN_LIMITS[plan] ?? TENANT_PLAN_LIMITS[SubscriptionPlan.FREE]
    );
  }

  static isUnlimited(value: number): boolean {
    return value === -1;
  }

  static canAddUser(currentCount: number, plan: SubscriptionPlan): boolean {
    const max = this.getLimits(plan).maxUsers;
    return this.isUnlimited(max) || currentCount < max;
  }

  static canAddCustomer(currentCount: number, plan: SubscriptionPlan): boolean {
    const max = this.getLimits(plan).maxCustomers;
    return this.isUnlimited(max) || currentCount < max;
  }

  static canAddSupplier(currentCount: number, plan: SubscriptionPlan): boolean {
    const max = this.getLimits(plan).maxSuppliers;
    return this.isUnlimited(max) || currentCount < max;
  }

  static canAddBankAccount(
    currentCount: number,
    plan: SubscriptionPlan,
  ): boolean {
    const max = this.getLimits(plan).maxBankAccounts;
    return this.isUnlimited(max) || currentCount < max;
  }

  static canAddInvoiceThisMonth(
    currentMonthCount: number,
    plan: SubscriptionPlan,
  ): boolean {
    const max = this.getLimits(plan).monthly.maxInvoices;
    return this.isUnlimited(max) || currentMonthCount < max;
  }

  static canAddExpenseThisMonth(
    currentMonthCount: number,
    plan: SubscriptionPlan,
  ): boolean {
    const max = this.getLimits(plan).monthly.maxExpenses;
    return this.isUnlimited(max) || currentMonthCount < max;
  }

  static errorMessageFor(
    entity:
      | 'user'
      | 'customer'
      | 'supplier'
      | 'bankAccount'
      | 'invoice'
      | 'expense',
    plan: SubscriptionPlan,
  ): string {
    const limits = this.getLimits(plan);
    switch (entity) {
      case 'user':
        return this.isUnlimited(limits.maxUsers)
          ? 'Business planında kullanıcı sınırı yok.'
          : `Plan limitine ulaşıldı: En fazla ${limits.maxUsers} kullanıcı eklenebilir. Daha fazla kullanıcı için plan yükseltin.`;
      case 'customer':
        return this.isUnlimited(limits.maxCustomers)
          ? 'Bu planda müşteri sayısı sınırsız.'
          : `Plan limitine ulaşıldı: En fazla ${limits.maxCustomers} müşteri eklenebilir. Planınızı yükseltin.`;
      case 'supplier':
        return this.isUnlimited(limits.maxSuppliers)
          ? 'Bu planda tedarikçi sayısı sınırsız.'
          : `Plan limitine ulaşıldı: En fazla ${limits.maxSuppliers} tedarikçi eklenebilir. Planınızı yükseltin.`;
      case 'bankAccount':
        return this.isUnlimited(limits.maxBankAccounts)
          ? 'Bu planda banka hesabı sayısı sınırsız.'
          : `Plan limitine ulaşıldı: En fazla ${limits.maxBankAccounts} banka hesabı eklenebilir. Planınızı yükseltin.`;
      case 'invoice':
        return this.isUnlimited(limits.monthly.maxInvoices)
          ? 'Bu planda aylık fatura limiti yok.'
          : `Plan limitine ulaşıldı: Bu ay en fazla ${limits.monthly.maxInvoices} fatura oluşturabilirsiniz. Planınızı yükseltin.`;
      case 'expense':
        return this.isUnlimited(limits.monthly.maxExpenses)
          ? 'Bu planda aylık gider kaydı limiti yok.'
          : `Plan limitine ulaşıldı: Bu ay en fazla ${limits.monthly.maxExpenses} gider kaydı oluşturabilirsiniz. Planınızı yükseltin.`;
    }
  }
}

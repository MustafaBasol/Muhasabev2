import { SubscriptionPlan, Tenant } from '../tenants/entities/tenant.entity';

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

// Güncelleme için derin kısmi tip
export type UpdateTenantPlanLimits = Partial<
  Omit<TenantPlanLimits, 'monthly'>
> & {
  monthly?: Partial<TenantPlanLimits['monthly']>;
};

// Tenant bazlı override için kısmi tip
export type TenantPlanOverrides = UpdateTenantPlanLimits;

// SubscriptionPlan enum: FREE | BASIC (legacy) | PROFESSIONAL | ENTERPRISE
// Yeni iş kuralları (landing page ile hizalı):
// - Starter (FREE): 1 kullanıcı, 1 müşteri, 1 tedarikçi, 1 banka hesabı, ayda 5 fatura + 5 gider
// - Pro (PROFESSIONAL & BASIC legacy): 3 kullanıcı (koltuk), diğer varlıklar sınırsız, aylık sınır yok
// - Business (ENTERPRISE): sınırsız (tüm sayısal limitler -1)
// Not: BASIC geçmiş uyumluluk için tutulur ve PROFESSIONAL ile aynı limitleri paylaşır.
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
    // Legacy: Pro ile aynı
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

  static getAllLimits(): Record<SubscriptionPlan, TenantPlanLimits> {
    return TENANT_PLAN_LIMITS;
  }

  static setLimits(
    plan: SubscriptionPlan,
    limits: UpdateTenantPlanLimits,
  ): TenantPlanLimits {
    const current = this.getLimits(plan);
    const merged: TenantPlanLimits = {
      maxUsers: limits.maxUsers ?? current.maxUsers,
      maxCustomers: limits.maxCustomers ?? current.maxCustomers,
      maxSuppliers: limits.maxSuppliers ?? current.maxSuppliers,
      maxBankAccounts: limits.maxBankAccounts ?? current.maxBankAccounts,
      monthly: {
        maxInvoices: limits.monthly?.maxInvoices ?? current.monthly.maxInvoices,
        maxExpenses: limits.monthly?.maxExpenses ?? current.monthly.maxExpenses,
      },
    };
    // In-memory güncelleme (kalıcı değildir; uygulama yeniden başlarsa dosyadan/DB'den yüklenmelidir)
    TENANT_PLAN_LIMITS[plan] = merged;
    return merged;
  }

  // === Tenant bazlı override desteği ===
  static mergeWithOverrides(
    base: TenantPlanLimits,
    overrides?: TenantPlanOverrides | null,
  ): TenantPlanLimits {
    if (!overrides) return base;
    return {
      maxUsers: overrides.maxUsers ?? base.maxUsers,
      maxCustomers: overrides.maxCustomers ?? base.maxCustomers,
      maxSuppliers: overrides.maxSuppliers ?? base.maxSuppliers,
      maxBankAccounts: overrides.maxBankAccounts ?? base.maxBankAccounts,
      monthly: {
        maxInvoices: overrides.monthly?.maxInvoices ?? base.monthly.maxInvoices,
        maxExpenses: overrides.monthly?.maxExpenses ?? base.monthly.maxExpenses,
      },
    };
  }

  static getLimitsForTenant(
    tenant: Pick<Tenant, 'subscriptionPlan' | 'settings'>,
  ): TenantPlanLimits {
    const base = this.getLimits(tenant.subscriptionPlan);
    const overrides = (tenant.settings as any)?.planOverrides as
      | TenantPlanOverrides
      | undefined;
    return this.mergeWithOverrides(base, overrides);
  }

  static isUnlimited(value: number): boolean {
    return value === -1;
  }

  static canAddUser(currentCount: number, plan: SubscriptionPlan): boolean {
    const max = this.getLimits(plan).maxUsers;
    return this.isUnlimited(max) || currentCount < max;
  }

  static canAddUserForTenant(
    currentCount: number,
    tenant: Pick<Tenant, 'subscriptionPlan' | 'settings'>,
  ): boolean {
    const max = this.getLimitsForTenant(tenant).maxUsers;
    return this.isUnlimited(max) || currentCount < max;
  }

  static canAddCustomer(currentCount: number, plan: SubscriptionPlan): boolean {
    const max = this.getLimits(plan).maxCustomers;
    return this.isUnlimited(max) || currentCount < max;
  }

  static canAddCustomerForTenant(
    currentCount: number,
    tenant: Pick<Tenant, 'subscriptionPlan' | 'settings'>,
  ): boolean {
    const max = this.getLimitsForTenant(tenant).maxCustomers;
    return this.isUnlimited(max) || currentCount < max;
  }

  static canAddSupplier(currentCount: number, plan: SubscriptionPlan): boolean {
    const max = this.getLimits(plan).maxSuppliers;
    return this.isUnlimited(max) || currentCount < max;
  }

  static canAddSupplierForTenant(
    currentCount: number,
    tenant: Pick<Tenant, 'subscriptionPlan' | 'settings'>,
  ): boolean {
    const max = this.getLimitsForTenant(tenant).maxSuppliers;
    return this.isUnlimited(max) || currentCount < max;
  }

  static canAddBankAccount(
    currentCount: number,
    plan: SubscriptionPlan,
  ): boolean {
    const max = this.getLimits(plan).maxBankAccounts;
    return this.isUnlimited(max) || currentCount < max;
  }

  static canAddBankAccountForTenant(
    currentCount: number,
    tenant: Pick<Tenant, 'subscriptionPlan' | 'settings'>,
  ): boolean {
    const max = this.getLimitsForTenant(tenant).maxBankAccounts;
    return this.isUnlimited(max) || currentCount < max;
  }

  static canAddInvoiceThisMonth(
    currentMonthCount: number,
    plan: SubscriptionPlan,
  ): boolean {
    const max = this.getLimits(plan).monthly.maxInvoices;
    return this.isUnlimited(max) || currentMonthCount < max;
  }

  static canAddInvoiceThisMonthForTenant(
    currentMonthCount: number,
    tenant: Pick<Tenant, 'subscriptionPlan' | 'settings'>,
  ): boolean {
    const max = this.getLimitsForTenant(tenant).monthly.maxInvoices;
    return this.isUnlimited(max) || currentMonthCount < max;
  }

  static canAddExpenseThisMonth(
    currentMonthCount: number,
    plan: SubscriptionPlan,
  ): boolean {
    const max = this.getLimits(plan).monthly.maxExpenses;
    return this.isUnlimited(max) || currentMonthCount < max;
  }

  static canAddExpenseThisMonthForTenant(
    currentMonthCount: number,
    tenant: Pick<Tenant, 'subscriptionPlan' | 'settings'>,
  ): boolean {
    const max = this.getLimitsForTenant(tenant).monthly.maxExpenses;
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

  static errorMessageForWithLimits(
    entity:
      | 'user'
      | 'customer'
      | 'supplier'
      | 'bankAccount'
      | 'invoice'
      | 'expense',
    limits: TenantPlanLimits,
  ): string {
    switch (entity) {
      case 'user':
        return this.isUnlimited(limits.maxUsers)
          ? 'Kullanıcı sayısı sınırsız.'
          : `Plan limitine ulaşıldı: En fazla ${limits.maxUsers} kullanıcı eklenebilir.`;
      case 'customer':
        return this.isUnlimited(limits.maxCustomers)
          ? 'Müşteri sayısı sınırsız.'
          : `Plan limitine ulaşıldı: En fazla ${limits.maxCustomers} müşteri eklenebilir.`;
      case 'supplier':
        return this.isUnlimited(limits.maxSuppliers)
          ? 'Tedarikçi sayısı sınırsız.'
          : `Plan limitine ulaşıldı: En fazla ${limits.maxSuppliers} tedarikçi eklenebilir.`;
      case 'bankAccount':
        return this.isUnlimited(limits.maxBankAccounts)
          ? 'Banka hesabı sayısı sınırsız.'
          : `Plan limitine ulaşıldı: En fazla ${limits.maxBankAccounts} banka hesabı eklenebilir.`;
      case 'invoice':
        return this.isUnlimited(limits.monthly.maxInvoices)
          ? 'Aylık fatura limiti yok.'
          : `Plan limitine ulaşıldı: Bu ay en fazla ${limits.monthly.maxInvoices} fatura oluşturabilirsiniz.`;
      case 'expense':
        return this.isUnlimited(limits.monthly.maxExpenses)
          ? 'Aylık gider kaydı limiti yok.'
          : `Plan limitine ulaşıldı: Bu ay en fazla ${limits.monthly.maxExpenses} gider kaydı oluşturabilirsiniz.`;
    }
  }
}

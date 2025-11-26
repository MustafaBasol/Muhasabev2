export interface AdminTenantSummary {
  id: string;
  name?: string | null;
  companyName?: string | null;
  subscriptionPlan?: string | null;
  status?: string | null;
  slug?: string | null;
  createdAt?: string | null;
}

export interface AdminTenantDetails extends AdminTenantSummary {
  maxUsers?: number | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  downgradePendingUntil?: string | null;
  requiredUserReduction?: number | null;
}

export interface TenantPlanLimits {
  maxUsers: number;
  maxCustomers: number;
  maxSuppliers: number;
  maxBankAccounts: number;
  monthly: {
    maxInvoices: number;
    maxExpenses: number;
  };
}

export type TenantPlanLimitOverrides = Partial<Omit<TenantPlanLimits, 'monthly'>> & {
  monthly?: Partial<TenantPlanLimits['monthly']>;
};

export interface TenantLimitsPayload {
  default?: TenantPlanLimits;
  overrides?: TenantPlanLimitOverrides | null;
  effective?: TenantPlanLimits;
}

export interface TenantUsageMonthly {
  invoices: number;
  expenses: number;
}

export interface TenantUsage {
  users: number;
  customers: number;
  suppliers: number;
  bankAccounts: number;
  monthly: TenantUsageMonthly;
}

export interface TenantUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  lastLoginTimeZone?: string | null;
  lastLoginUtcOffsetMinutes?: number | null;
  createdAt?: string | null;
}

export interface TenantInvite {
  id: string;
  email: string;
  role?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  acceptedAt?: string | null;
  organizationName?: string | null;
}

export interface TenantOrganizationSummary {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface TenantOverview {
  success?: boolean;
  tenant: AdminTenantDetails;
  limits: TenantLimitsPayload;
  usage: TenantUsage;
  users: TenantUser[];
  organizations?: TenantOrganizationSummary[];
  invites?: TenantInvite[];
}

export interface TenantLimitsResponse {
  success?: boolean;
  tenant: AdminTenantDetails;
  limits: TenantLimitsPayload;
  usage: TenantUsage;
}

export interface TenantSubscriptionRawItem {
  id: string;
  priceId: string;
  quantity: number;
  interval: 'month' | 'year' | null;
  product: string | null;
}

export interface TenantSubscriptionRaw {
  subscriptionId: string | null;
  status: string | null;
  interval: 'month' | 'year' | null;
  items: TenantSubscriptionRawItem[];
  baseIncluded: number;
  addonQty: number;
  computedSeats: number;
  plan?: string | null;
}

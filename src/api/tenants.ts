import apiClient from './client';

export interface TenantSettings {
  brand?: Record<string, unknown>;
  billing?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UpdateTenantDto {
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  website?: string;
  taxOffice?: string;
  mersisNumber?: string;
  kepAddress?: string;
  siretNumber?: string;
  sirenNumber?: string;
  apeCode?: string;
  tvaNumber?: string;
  rcsNumber?: string;
  steuernummer?: string;
  umsatzsteuerID?: string;
  handelsregisternummer?: string;
  geschaeftsfuehrer?: string;
  einNumber?: string;
  taxId?: string;
  businessLicenseNumber?: string;
  stateOfIncorporation?: string;
  // Free-form settings blob to store brand/logo, default bank, country etc.
  settings?: TenantSettings;
}

export interface TenantProfile extends UpdateTenantDto {
  id: string;
  slug?: string;
  status?: string;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: string;
  maxUsers?: number;
  cancelAtPeriodEnd?: boolean;
  billingInterval?: 'month' | 'year' | null;
  createdAt?: string;
  updatedAt?: string;
}

export type SubscriptionHistoryEventType = 'plan.current' | 'plan.renewal_due' | 'cancel.at_period_end';

export interface SubscriptionHistoryEvent {
  type: SubscriptionHistoryEventType | string;
  plan?: string;
  at?: string;
  users?: number;
}

export interface SubscriptionHistoryResponse {
  success: boolean;
  events: SubscriptionHistoryEvent[];
}

export const tenantsApi = {
  getMyTenant: async (): Promise<TenantProfile> => {
    const res = await apiClient.get<TenantProfile>('/tenants/my-tenant');
    return res.data;
  },
  updateMyTenant: async (data: UpdateTenantDto): Promise<TenantProfile> => {
    const res = await apiClient.patch<TenantProfile>('/tenants/my-tenant', data);
    return res.data;
  },
  updateMySubscription: async (data: { plan?: string; users?: number; billing?: 'monthly' | 'yearly'; cancel?: boolean; cancelAtPeriodEnd?: boolean }): Promise<{ success: boolean; tenant: TenantProfile }> => {
    const res = await apiClient.patch<{ success: boolean; tenant: TenantProfile }>('/tenants/my-tenant/subscription', data);
    return res.data;
  },
  async getMySubscriptionHistory(): Promise<SubscriptionHistoryResponse> {
    const res = await apiClient.get<SubscriptionHistoryResponse>('/tenants/my-tenant/subscription/history');
    return res.data;
  },
};

import apiClient from './client';

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
  settings?: Record<string, any>;
}

export const tenantsApi = {
  getMyTenant: async () => {
    const res = await apiClient.get('/tenants/my-tenant');
    return res.data;
  },
  updateMyTenant: async (data: UpdateTenantDto) => {
    const res = await apiClient.patch('/tenants/my-tenant', data);
    return res.data;
  },
  updateMySubscription: async (data: { plan?: string; users?: number; billing?: 'monthly' | 'yearly'; cancel?: boolean; cancelAtPeriodEnd?: boolean }) => {
    const res = await apiClient.patch('/tenants/my-tenant/subscription', data);
    return res.data;
  },
  async getMySubscriptionHistory(): Promise<any> {
    const res = await apiClient.get('/tenants/my-tenant/subscription/history');
    return res.data;
  },
};

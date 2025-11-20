import apiClient from './client';

// Helper function to get admin token from localStorage
const getAdminToken = () => {
  return localStorage.getItem('admin-token');
};

// Helper function to get admin headers
const getAdminHeaders = () => {
  const token = getAdminToken();
  return token ? { 'admin-token': token } : {};
};

export const adminApi = {
  login: async (username: string, password: string, totp?: string) => {
    const response = await apiClient.post('/admin/login', { username, password, totp });
    return response.data;
  },

  getUsers: async (tenantId?: string) => {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const response = await apiClient.get(`/admin/users${qs}`, {
      headers: getAdminHeaders()
    });
    return response.data;
  },
  // Admin Security
  getSecurityConfig: async () => {
    const response = await apiClient.get('/admin/security/config', {
      headers: getAdminHeaders(),
    });
    return response.data;
  },
  updateAdminCredentials: async (payload: { currentPassword: string; newUsername?: string; newPassword?: string }) => {
    const response = await apiClient.post('/admin/security/credentials', payload, {
      headers: getAdminHeaders(),
    });
    return response.data;
  },
  twoFASetup: async () => {
    const response = await apiClient.post('/admin/security/2fa/setup', {}, {
      headers: getAdminHeaders(),
    });
    return response.data;
  },
  twoFAVerify: async (payload: { token: string }) => {
    const response = await apiClient.post('/admin/security/2fa/verify', payload, {
      headers: getAdminHeaders(),
    });
    return response.data;
  },
  twoFADisable: async () => {
    const response = await apiClient.post('/admin/security/2fa/disable', {}, {
      headers: getAdminHeaders(),
    });
    return response.data;
  },

  getTenants: async (filters?: { status?: string; plan?: string; startFrom?: string; startTo?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.plan) params.append('plan', filters.plan);
    if (filters?.startFrom) params.append('startFrom', filters.startFrom);
    if (filters?.startTo) params.append('startTo', filters.startTo);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await apiClient.get(`/admin/tenants${qs}`, {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  getUserData: async (userId: string) => {
    const response = await apiClient.get(`/admin/user/${userId}/data`, {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  getTenantData: async (tenantId: string) => {
    const response = await apiClient.get(`/admin/tenant/${tenantId}/data`, {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  getTables: async () => {
    const response = await apiClient.get('/admin/tables', {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  getTableData: async (tableName: string, tenantId?: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenantId', tenantId);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    const response = await apiClient.get(`/admin/table/${tableName}?${params.toString()}`, {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  // Data Retention APIs
  getRetentionConfig: async () => {
    const response = await apiClient.get('/admin/retention/config', {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  getRetentionStatus: async () => {
    const response = await apiClient.get('/admin/retention/status', {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  getRetentionHistory: async (limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    const response = await apiClient.get(`/admin/retention/history?${params.toString()}`, {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  executeRetentionDryRun: async () => {
    const response = await apiClient.post('/admin/retention/dry-run', {}, {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  executeRetention: async () => {
    const response = await apiClient.post('/admin/retention/execute', { confirm: true }, {
      headers: getAdminHeaders()
    });
    return response.data;
  },
  // Admin Organizations
  listOrganizations: async () => {
    const response = await apiClient.get('/admin/organizations', {
      headers: getAdminHeaders()
    });
    return response.data;
  },
  getOrganizationMembers: async (orgId: string) => {
    const response = await apiClient.get(`/admin/organizations/${orgId}/members`, {
      headers: getAdminHeaders()
    });
    return response.data;
  },
  getOrganizationInvites: async (orgId: string) => {
    const response = await apiClient.get(`/admin/organizations/${orgId}/invites`, {
      headers: getAdminHeaders()
    });
    return response.data;
  },
  updateMemberRole: async (orgId: string, memberId: string, role: string) => {
    const response = await apiClient.patch(`/admin/organizations/${orgId}/members/${memberId}/role`, { role }, {
      headers: getAdminHeaders()
    });
    return response.data;
  },
  removeMember: async (orgId: string, memberId: string) => {
    const response = await apiClient.delete(`/admin/organizations/${orgId}/members/${memberId}`, {
      headers: getAdminHeaders()
    });
    return response.data;
  },
  updateUserStatus: async (userId: string, isActive: boolean) => {
    const response = await apiClient.patch(`/admin/users/${userId}/status`, { isActive }, {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  updateUserDetails: async (
    userId: string,
    payload: { firstName?: string; lastName?: string; email?: string; phone?: string; role?: string }
  ) => {
    const response = await apiClient.patch(`/admin/users/${userId}`, payload, {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  sendPasswordReset: async (userId: string) => {
    const response = await apiClient.post(`/admin/users/${userId}/password-reset`, {}, {
      headers: getAdminHeaders()
    });
    return response.data;
  },
  updateTenantDetails: async (
    tenantId: string,
    payload: { name?: string; companyName?: string }
  ) => {
    const response = await apiClient.patch(`/admin/tenant/${tenantId}`, payload, {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  updateTenantSubscription: async (
    tenantId: string,
    payload: { plan?: string; status?: string; nextBillingAt?: string; cancel?: boolean }
  ) => {
    const response = await apiClient.patch(`/admin/tenant/${tenantId}/subscription`, payload, {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  deleteTenant: async (
    tenantId: string,
    options?: { hard?: boolean; backupBefore?: boolean }
  ) => {
    try {
      const response = await apiClient.patch(
        `/admin/tenant/${tenantId}/delete`,
        { confirm: true, hard: options?.hard ?? true, backupBefore: options?.backupBefore ?? false },
        { headers: getAdminHeaders() }
      );
      return response.data;
    } catch (e: any) {
      // 404 veya diğer durumlarda hata detayını yukarı aktar
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message;
      throw new Error(`Silme hatası${status ? ` (HTTP ${status})` : ''}: ${msg || 'Bilinmeyen'}`);
    }
  },

  deleteUser: async (
    userId: string,
    options?: { hard?: boolean }
  ) => {
    const response = await apiClient.delete(
      `/admin/users/${userId}`,
      {
        headers: getAdminHeaders(),
        data: { confirm: true, hard: options?.hard ?? false }
      }
    );
    return response.data;
  },

  // Plan Limits
  getPlanLimits: async () => {
    const response = await apiClient.get('/admin/plan-limits', {
      headers: getAdminHeaders()
    });
    return response.data;
  },
  updatePlanLimits: async (
    plan: 'free' | 'professional' | 'enterprise',
    payload: {
      maxUsers?: number;
      maxCustomers?: number;
      maxSuppliers?: number;
      maxBankAccounts?: number;
      monthly?: { maxInvoices?: number; maxExpenses?: number };
    }
  ) => {
    const response = await apiClient.patch(`/admin/plan-limits/${plan}`, payload, {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  // Tenant-specific limits
  getTenantLimits: async (tenantId: string) => {
    const response = await apiClient.get(`/admin/tenant/${tenantId}/limits`, {
      headers: getAdminHeaders(),
    });
    return response.data;
  },
  updateTenantLimits: async (
    tenantId: string,
    payload: {
      maxUsers?: number;
      maxCustomers?: number;
      maxSuppliers?: number;
      maxBankAccounts?: number;
      monthly?: { maxInvoices?: number; maxExpenses?: number };
    }
  ) => {
    const response = await apiClient.patch(`/admin/tenant/${tenantId}/limits`, payload, {
      headers: getAdminHeaders(),
    });
    return response.data;
  },

  // Tenant consolidated overview
  getTenantOverview: async (tenantId: string) => {
    const response = await apiClient.get(`/admin/tenant/${tenantId}/overview`, {
      headers: getAdminHeaders(),
    });
    return response.data;
  },
  // Tenant Stripe subscription raw details (koltuk hesaplaması, addon qty vb.)
  getTenantSubscriptionRaw: async (tenantId: string) => {
    const response = await apiClient.get(`/admin/tenant/${tenantId}/subscription-raw`, {
      headers: getAdminHeaders(),
    });
    return response.data;
  },
  // Tenant invoice history (Stripe invoices)
  getTenantInvoices: async (tenantId: string) => {
    try {
      const response = await apiClient.get(`/admin/tenant/${tenantId}/invoices`, {
        headers: getAdminHeaders(),
      });
      return response.data;
    } catch (e: any) {
      // 404 durumunda UI'yı kırmayalım; boş liste döndür
      const status = e?.response?.status;
      if (status === 404) return { invoices: [] };
      throw e;
    }
  },
  // Add user to tenant (no email verification)
  addUserToTenant: async (
    tenantId: string,
    payload: { email: string; firstName?: string; lastName?: string; role?: string; password?: string; autoPassword?: boolean; activate?: boolean }
  ) => {
    const response = await apiClient.post(`/admin/tenant/${tenantId}/users`, payload, {
      headers: getAdminHeaders(),
    });
    return response.data;
  },
};
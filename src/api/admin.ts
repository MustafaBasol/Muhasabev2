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
  login: async (username: string, password: string) => {
    const response = await apiClient.post('/admin/login', { username, password });
    return response.data;
  },

  getUsers: async () => {
    const response = await apiClient.get('/admin/users', {
      headers: getAdminHeaders()
    });
    return response.data;
  },

  getTenants: async () => {
    const response = await apiClient.get('/admin/tenants', {
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
};
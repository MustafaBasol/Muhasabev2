import apiClient from './client';

export const adminApi = {
  login: async (username: string, password: string) => {
    const response = await apiClient.post('/admin/login', { username, password });
    return response.data;
  },

  getUsers: async () => {
    const response = await apiClient.get('/admin/users', {
      headers: {
        'admin-token': 'admin-access-granted'
      }
    });
    return response.data;
  },

  getTenants: async () => {
    const response = await apiClient.get('/admin/tenants', {
      headers: {
        'admin-token': 'admin-access-granted'
      }
    });
    return response.data;
  },

  getUserData: async (userId: string) => {
    const response = await apiClient.get(`/admin/user/${userId}/data`, {
      headers: {
        'admin-token': 'admin-access-granted'
      }
    });
    return response.data;
  },

  getTenantData: async (tenantId: string) => {
    const response = await apiClient.get(`/admin/tenant/${tenantId}/data`, {
      headers: {
        'admin-token': 'admin-access-granted'
      }
    });
    return response.data;
  },

  getTables: async () => {
    const response = await apiClient.get('/admin/tables', {
      headers: {
        'admin-token': 'admin-access-granted'
      }
    });
    return response.data;
  },

  getTableData: async (tableName: string, tenantId?: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenantId', tenantId);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    const response = await apiClient.get(`/admin/table/${tableName}?${params.toString()}`, {
      headers: {
        'admin-token': 'admin-access-granted'
      }
    });
    return response.data;
  },
};
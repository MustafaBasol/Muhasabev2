import apiClient from './client';
import { adminAuthStorage } from '../utils/adminAuthStorage';

const API_URL = '/admin/backups';

// Admin token için header (localStorage'tan dinamik al)
const getAdminHeaders = () => {
  const token = adminAuthStorage.getToken();
  return {
    headers: token ? { 'admin-token': token } : {},
  };
};

export interface BackupMetadata {
  id: string;
  type: 'system' | 'user' | 'tenant';
  entityId?: string;
  entityName?: string;
  filename: string;
  size: number;
  createdAt: string;
  description?: string;
}

export interface BackupStatistics {
  total: number;
  systemBackups: number;
  userBackups: number;
  tenantBackups: number;
  totalSize: number;
  totalSizeMB: string;
  oldestBackup: string | null;
  newestBackup: string | null;
}

export const backupsApi = {
  // Tüm backup'ları listele
  list: async (type?: 'system' | 'user' | 'tenant'): Promise<BackupMetadata[]> => {
    const params = type ? { type } : {};
    const response = await apiClient.get(API_URL, { params, ...getAdminHeaders() });
    return response.data;
  },

  // Kullanıcının backup'larını listele
  listUserBackups: async (userId: string): Promise<BackupMetadata[]> => {
    const response = await apiClient.get(`${API_URL}/user/${userId}`, getAdminHeaders());
    return response.data;
  },

  // Sistem backup'ı oluştur
  createSystemBackup: async (description?: string): Promise<BackupMetadata> => {
    const response = await apiClient.post(`${API_URL}/system`, { description }, getAdminHeaders());
    return response.data;
  },

  // Kullanıcı backup'ı oluştur
  createUserBackup: async (userId: string, description?: string): Promise<BackupMetadata> => {
    const response = await apiClient.post(`${API_URL}/user/${userId}`, { description }, getAdminHeaders());
    return response.data;
  },

  // Tenant backup'ı oluştur
  createTenantBackup: async (tenantId: string, description?: string): Promise<BackupMetadata> => {
    const response = await apiClient.post(`${API_URL}/tenant/${tenantId}`, { description }, getAdminHeaders());
    return response.data;
  },

  // Sistem restore
  restoreSystem: async (backupId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post(`${API_URL}/restore/system/${backupId}`, { confirm: true }, getAdminHeaders());
    return response.data;
  },

  // Kullanıcı restore
  restoreUser: async (userId: string, backupId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post(`${API_URL}/restore/user/${userId}/${backupId}`, { confirm: true }, getAdminHeaders());
    return response.data;
  },

  // Tenant restore
  restoreTenant: async (tenantId: string, backupId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post(`${API_URL}/restore/tenant/${tenantId}/${backupId}`, { confirm: true }, getAdminHeaders());
    return response.data;
  },

  // Backup sil
  delete: async (backupId: string): Promise<{ success: boolean }> => {
    const response = await apiClient.delete(`${API_URL}/${backupId}`, getAdminHeaders());
    return response.data;
  },

  // Eski backup'ları temizle
  cleanup: async (): Promise<{ success: boolean; message: string; deleted: number }> => {
    const response = await apiClient.post(`${API_URL}/cleanup`, {}, getAdminHeaders());
    return response.data;
  },

  // İstatistikleri al
  getStatistics: async (): Promise<BackupStatistics> => {
    const response = await apiClient.get(`${API_URL}/statistics`, getAdminHeaders());
    return response.data;
  },
};

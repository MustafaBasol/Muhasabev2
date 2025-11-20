import apiClient from './client';

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
}

export const usersApi = {
  /**
   * Mevcut kullanıcının profilini getir
   */
  getProfile: async () => {
    const response = await apiClient.get('/users/me');
    return response.data;
  },

  /**
   * Mevcut kullanıcının profilini güncelle
   */
  updateProfile: async (data: UpdateProfileDto) => {
    const response = await apiClient.put('/users/me', data);
    return response.data;
  },

  /**
   * Bildirim tercihlerini getir
   */
  getNotificationPreferences: async (): Promise<{
    invoiceReminders?: boolean;
    expenseAlerts?: boolean;
    salesNotifications?: boolean;
    lowStockAlerts?: boolean;
    quoteReminders?: boolean;
  }> => {
    const response = await apiClient.get('/users/me/notification-preferences');
    return response.data || {};
  },

  /**
   * Bildirim tercihlerini güncelle
   */
  updateNotificationPreferences: async (prefs: {
    invoiceReminders?: boolean;
    expenseAlerts?: boolean;
    salesNotifications?: boolean;
    lowStockAlerts?: boolean;
    quoteReminders?: boolean;
  }) => {
    const response = await apiClient.put('/users/me/notification-preferences', prefs);
    return response.data;
  },

  /**
   * Şifre değiştir
   */
  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await apiClient.put('/users/me/password', { currentPassword, newPassword });
    return response.data;
  },
  
  // 2FA: durum
  getTwoFactorStatus: async (): Promise<{ enabled: boolean; backupCodesCount: number }> => {
    const response = await apiClient.get('/users/2fa/status');
    return response.data;
  },

  // 2FA: kurulum başlat
  setupTwoFactor: async (): Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }> => {
    const response = await apiClient.post('/users/2fa/setup', {});
    return response.data;
  },

  // 2FA: etkinleştir
  enableTwoFactor: async (token: string): Promise<{ message: string; backupCodes: string[] }> => {
    const response = await apiClient.post('/users/2fa/enable', { token });
    return response.data;
  },

  // 2FA: devre dışı bırak
  disableTwoFactor: async (token: string): Promise<{ message: string }> => {
    const response = await apiClient.post('/users/2fa/disable', { token });
    return response.data;
  },

  // 2FA: yedek kodları yeniden oluştur
  regenerateTwoFactorBackupCodes: async (): Promise<{ backupCodes: string[]; count: number }> => {
    const response = await apiClient.post('/users/2fa/backup-codes/regenerate', {});
    return response.data;
  },

  // Oturumlar: Tümünü sonlandır (tokenVersion artırır ve yeni token döner)
  terminateAllSessions: async (): Promise<{ token: string }> => {
    const response = await apiClient.post('/users/sessions/terminate-all', {});
    return response.data;
  },
};

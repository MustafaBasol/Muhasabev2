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
};

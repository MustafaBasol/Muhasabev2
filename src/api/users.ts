import apiClient from './client';
import type { User as AuthUser } from '../contexts/AuthContext';

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
}

export interface NotificationPreferences {
  invoiceReminders?: boolean;
  expenseAlerts?: boolean;
  salesNotifications?: boolean;
  lowStockAlerts?: boolean;
  quoteReminders?: boolean;
}

export interface PasswordChangeResponse {
  message?: string;
  success?: boolean;
}

export interface TwoFactorStatus {
  enabled: boolean;
  backupCodesCount: number;
}

export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorEnableResponse {
  message: string;
  backupCodes: string[];
}

export const usersApi = {
  /**
   * Mevcut kullanıcının profilini getir
   */
  getProfile: async (): Promise<AuthUser> => {
    const response = await apiClient.get<AuthUser>('/users/me');
    return response.data;
  },

  /**
   * Mevcut kullanıcının profilini güncelle
   */
  updateProfile: async (data: UpdateProfileDto): Promise<AuthUser> => {
    const response = await apiClient.put<AuthUser>('/users/me', data);
    return response.data;
  },

  /**
   * Bildirim tercihlerini getir
   */
  getNotificationPreferences: async (): Promise<NotificationPreferences> => {
    const response = await apiClient.get<NotificationPreferences>('/users/me/notification-preferences');
    return response.data || {};
  },

  /**
   * Bildirim tercihlerini güncelle
   */
  updateNotificationPreferences: async (prefs: NotificationPreferences): Promise<NotificationPreferences> => {
    const response = await apiClient.put<NotificationPreferences>('/users/me/notification-preferences', prefs);
    return response.data;
  },

  /**
   * Şifre değiştir
   */
  changePassword: async (currentPassword: string, newPassword: string): Promise<PasswordChangeResponse> => {
    const response = await apiClient.put<PasswordChangeResponse>('/users/me/password', { currentPassword, newPassword });
    return response.data;
  },
  
  // 2FA: durum
  getTwoFactorStatus: async (): Promise<TwoFactorStatus> => {
    const response = await apiClient.get<TwoFactorStatus>('/users/2fa/status');
    return response.data;
  },

  // 2FA: kurulum başlat
  setupTwoFactor: async (): Promise<TwoFactorSetupResponse> => {
    const response = await apiClient.post<TwoFactorSetupResponse>('/users/2fa/setup', {});
    return response.data;
  },

  // 2FA: etkinleştir
  enableTwoFactor: async (token: string): Promise<TwoFactorEnableResponse> => {
    const response = await apiClient.post<TwoFactorEnableResponse>('/users/2fa/enable', { token });
    return response.data;
  },

  // 2FA: devre dışı bırak
  disableTwoFactor: async (token: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/users/2fa/disable', { token });
    return response.data;
  },

  // 2FA: yedek kodları yeniden oluştur
  regenerateTwoFactorBackupCodes: async (): Promise<{ backupCodes: string[]; count: number }> => {
    const response = await apiClient.post<{ backupCodes: string[]; count: number }>('/users/2fa/backup-codes/regenerate', {});
    return response.data;
  },

  // Oturumlar: Tümünü sonlandır (tokenVersion artırır ve yeni token döner)
  terminateAllSessions: async (): Promise<{ token: string }> => {
    const response = await apiClient.post<{ token: string }>('/users/sessions/terminate-all', {});
    return response.data;
  },
};

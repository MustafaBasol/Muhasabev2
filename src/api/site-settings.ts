import apiClient from './client';
import { adminAuthStorage } from '../utils/adminAuthStorage';

const getAdminToken = () => {
  return adminAuthStorage.getToken();
};

// Helper function to get admin headers
const getAdminHeaders = () => {
  const token = getAdminToken();
  return token ? { 'admin-token': token } : {};
};

export interface SiteSettings {
  id: number;
  defaultMetaTitle: string | null;
  defaultMetaDescription: string | null;
  defaultOgImageUrl: string | null;
  canonicalBaseUrl: string | null;
  enableIndexing: boolean;
  googleAnalyticsId: string | null;
  googleTagManagerId: string | null;
  pinterestTagId: string | null;
  metaPixelId: string | null;
  linkedinInsightTagId: string | null;
  customHeadHtml: string | null;
  customBodyStartHtml: string | null;
  customBodyEndHtml: string | null;
  // Announcements
  announcementEnabled: boolean;
  announcementMessage: string | null;
  announcementType: 'info' | 'warning' | 'critical';
  // Maintenance
  maintenanceModeEnabled: boolean;
  maintenanceMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export const siteSettingsApi = {
  /**
   * Get current site settings (public)
   */
  getSettings: async (): Promise<SiteSettings> => {
    const response = await apiClient.get<SiteSettings>('/site-settings');
    return response.data;
  },

  /**
   * Update site settings (admin only)
   */
  updateSettings: async (updates: Partial<SiteSettings>): Promise<SiteSettings> => {
    const response = await apiClient.put<SiteSettings>('/site-settings', updates, {
      headers: getAdminHeaders(),
    });
    return response.data;
  },
};

import apiClient from './client';
import { logger } from '../utils/logger';

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
  };
  tenant?: {
    id: string;
    name: string;
    slug: string;
    subscriptionPlan: string;
    status: string;
  };
  token: string;
}

export interface RefreshResponse {
  token: string;
  expiresIn?: string;
}

export const authService = {
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/register', data);
      return response.data;
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Kayıt sırasında hata oluştu';
      throw new Error(message);
    }
  },

  async login(data: LoginData): Promise<AuthResponse> {
    try {
      // Avoid logging raw credentials; keep minimal debug only
      logger.debug('🔑 auth.login called');
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      logger.debug('🔍 Fetch response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || 'Geçersiz email veya şifre';
        throw new Error(message);
      }
      
      const responseData = await response.json();
      // Don't log tokens or full response bodies in console
      logger.debug('🔍 Auth service response received');
      return responseData as AuthResponse;
      
    } catch (error: any) {
      logger.error('🔍 Auth service error:', error);
      throw error;
    }
  },

  async getProfile() {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  async refresh(): Promise<RefreshResponse> {
    // Authenticated route re-issues a short-lived access token
    // Prefer alt path in case "/auth/refresh" collides with proxies.
    try {
      const response = await apiClient.post<RefreshResponse>('/auth/refresh-token', {});
      return response.data;
    } catch (err) {
      // Fallback to original path
      const response = await apiClient.post<RefreshResponse>('/auth/refresh', {});
      return response.data;
    }
  },

  async resendVerification(email: string) {
    const response = await apiClient.post('/auth/resend-verification', { email });
    return response.data;
  },

  async verifyEmail(token: string) {
    const response = await apiClient.get(`/auth/verify-email`, { params: { token } });
    return response.data;
  },

  async forgotPassword(email: string) {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(token: string, newPassword: string) {
    const response = await apiClient.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },

  logout() {
    // Auth verileri
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    localStorage.removeItem('tenantId');
    
    // Cache'leri temizle (güvenlik için)
  localStorage.removeItem('bankAccounts');
    localStorage.removeItem('customers_cache');
    localStorage.removeItem('suppliers_cache');
    localStorage.removeItem('products_cache');
    localStorage.removeItem('invoices_cache');
    localStorage.removeItem('expenses_cache');
    localStorage.removeItem('notifications'); // Bildirimler de kullanıcıya özel
    
    // NOT: localStorage.clear() KULLANMA - diğer browser ayarlarını siler!
  },
};

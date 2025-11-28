import apiClient from './client';
import { logger } from '../utils/logger';
import { safeLocalStorage, clearLegacySessionCaches } from '../utils/localStorageSafe';

type ApiErrorLike = {
  response?: {
    data?: {
      message?: string;
    };
    status?: number;
  };
  message?: string;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const apiError = error as ApiErrorLike;
    return apiError.response?.data?.message || apiError.message || fallback;
  }
  return fallback;
};

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  turnstileToken?: string; // Human verification token
}

export interface LoginData {
  email: string;
  password: string;
  twoFactorToken?: string;
  turnstileToken?: string; // Human verification token (after threshold)
  // Client environment hints (optional)
  clientTimeZone?: string; // IANA TZ, e.g. "Europe/Istanbul"
  clientUtcOffsetMinutes?: number; // minutes relative to UTC (e.g. +180 -> 180)
  clientLocale?: string; // e.g. "tr-TR"
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
    // Optional extra fields returned by backend
    isEmailVerified?: boolean;
    lastLoginAt?: string;
    lastLoginTimeZone?: string;
    lastLoginUtcOffsetMinutes?: number;
  };
  tenant?: {
    id: string;
    name: string;
    slug: string;
    subscriptionPlan: string;
    status: string;
    maxUsers?: number | null;
    effectiveMaxUsers?: number | null;
    subscriptionExpiresAt?: string | null;
    cancelAtPeriodEnd?: boolean;
    billingInterval?: 'month' | 'year' | null;
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
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, 'Kayıt sırasında hata oluştu'));
    }
  },

  async login(data: LoginData): Promise<AuthResponse | { mfaRequired: true } > {
    try {
      // Avoid logging raw credentials; keep minimal debug only
      logger.debug('🔑 auth.login called');
      // Attach client timezone/locale hints if not provided
      let clientHints: Partial<LoginData> = {};
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const off = -new Date().getTimezoneOffset();
        const loc = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : undefined;
        clientHints = {
          clientTimeZone: tz || undefined,
          clientUtcOffsetMinutes: Number.isNaN(off) ? undefined : off,
          clientLocale: loc,
        };
      } catch (hintError) {
        logger.debug('Client hint detection failed', hintError);
      }
      const body = { ...data, ...clientHints };
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      logger.debug('🔍 Fetch response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || 'Geçersiz email veya şifre';
        if (message === 'MFA_REQUIRED') {
          // Frontend bu durumu özel olarak ele alacak
          return { mfaRequired: true } as const;
        }
        throw new Error(message);
      }
      
      const responseData = await response.json();
      // Don't log tokens or full response bodies in console
      logger.debug('🔍 Auth service response received');
      return responseData as AuthResponse;
      
    } catch (error: unknown) {
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
    } catch (error) {
      logger.debug('refresh-token endpoint unavailable, falling back', error);
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

  async verifyEmailHashed(token: string, userId: string) {
    const response = await apiClient.get(`/auth/verify`, { params: { token, u: userId } });
    return response.data;
  },

  async forgotPassword(email: string) {
    // Öncelikle yeni hashed token akışını kullan (POST /auth/forgot)
    // Eğer endpoint mevcut değilse (ör: eski backend) geriye uyumluluk için legacy /auth/forgot-password'e düş.
    try {
      const response = await apiClient.post('/auth/forgot', { email });
      return response.data;
    } catch (error: unknown) {
      const status = (error as ApiErrorLike).response?.status;
      if (status === 404) {
        const legacy = await apiClient.post('/auth/forgot-password', { email });
        return legacy.data;
      }
      throw error;
    }
  },

  async resetPassword(token: string, newPassword: string) {
    const response = await apiClient.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },

  async resetPasswordHashed(token: string, userId: string, newPassword: string) {
    const response = await apiClient.post('/auth/reset', { token, u: userId, newPassword });
    return response.data;
  },

  async signup(data: RegisterData): Promise<{ success: boolean }> {
    // Spec-compliant minimal response endpoint
    const response = await apiClient.post('/api/auth/register', data);
    return response.data;
  },

  logout() {
    clearLegacySessionCaches();
    const keysToClear = [
      'bankAccounts',
      'customers_cache',
      'suppliers_cache',
      'products_cache',
      'invoices_cache',
      'expenses_cache',
      'notifications',
    ];

    keysToClear.forEach(key => safeLocalStorage.removeItem(key));

    logger.info('🔐 Auth/logout: Cleared cached session keys');
    // NOT: localStorage.clear() KULLANMA - diğer browser ayarlarını siler!
  },
};

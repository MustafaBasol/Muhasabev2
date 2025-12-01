import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosHeaders } from 'axios';
import type { RawAxiosRequestHeaders, RawAxiosResponseHeaders } from 'axios';
import { logger } from '../utils/logger';
import { adminAuthStorage } from '../utils/adminAuthStorage';
import { safeLocalStorage, readLegacyAuthToken, clearLegacySessionCaches } from '../utils/localStorageSafe';

// Use proxy in Codespaces (more reliable)
// Use proxy in Codespaces (more reliable)
export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim() && import.meta.env.VITE_API_URL?.length
    ? import.meta.env.VITE_API_URL
    : import.meta.env.DEV
      ? '/api'
      : 'https://api.comptario.com/api';


if (import.meta.env.DEV) {
  // Yalnızca geliştirmede bilgi amaçlı logla (varsayılan olarak sessiz)
  logger.info('🔗 API Base URL (PROXY):', API_BASE_URL);
  logger.info('🏭 Backend will be proxied through Vite dev server');
}

// Create axios instance with retry configuration
let lastCsrfToken: string | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const setHeaderValue = (
  headers: InternalAxiosRequestConfig['headers'] | undefined,
  key: string,
  value: string
): InternalAxiosRequestConfig['headers'] => {
  if (headers instanceof AxiosHeaders) {
    headers.set(key, value);
    return headers;
  }

  const normalizedHeaders: RawAxiosRequestHeaders = {
    ...((headers as RawAxiosRequestHeaders | undefined) ?? {}),
    [key]: value,
  };

  return normalizedHeaders;
};

const getHeaderValue = (
  headers: RawAxiosResponseHeaders | AxiosHeaders | undefined,
  key: string
): string | undefined => {
  if (!headers) return undefined;
  const normalizedKey = key.toLowerCase();

  if (headers instanceof AxiosHeaders) {
    return (
      headers.get(normalizedKey) ??
      headers.get(key) ??
      headers.get(key.toUpperCase()) ??
      undefined
    );
  }

  for (const [currentKey, headerValue] of Object.entries(headers)) {
    if (currentKey.toLowerCase() === normalizedKey) {
      return typeof headerValue === 'string' ? headerValue : String(headerValue);
    }
  }
  return undefined;
};

const ensureString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const extractMessage = (payload: unknown): string | undefined => {
  if (!payload) return undefined;
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) {
    const combined = payload.filter((entry): entry is string => typeof entry === 'string').join(', ');
    return combined || undefined;
  }
  if (isRecord(payload) && 'message' in payload) {
    const rawMessage = (payload as { message?: unknown }).message;
    if (typeof rawMessage === 'string') return rawMessage;
    if (Array.isArray(rawMessage)) {
      const combined = rawMessage
        .filter((entry): entry is string => typeof entry === 'string')
        .join(', ');
      return combined || undefined;
    }
  }
  return undefined;
};

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: (status) => status >= 200 && status < 300, // Sadece 2xx başarılı sayılır
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (import.meta.env.DEV) {
      logger.debug('📤 API Request:', config.method?.toUpperCase(), config.url);
    }
    
    const token = readLegacyAuthToken();
    const url = config.url || '';
    const isPublic = typeof url === 'string' && (url.startsWith('/public/') || url.startsWith('/auth/public') || url.includes('/public/'));
    if (token && config.headers && !isPublic) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // CSRF: Yazma isteklerinde token'ı ekle (varsa)
    const method = (config.method || 'get').toLowerCase();
    const isMutating = ['post', 'put', 'patch', 'delete'].includes(method);
    if (isMutating && lastCsrfToken) {
      config.headers = setHeaderValue(config.headers, 'X-CSRF-Token', lastCsrfToken);
    }
    
    return config;
  },
  (error: AxiosError) => {
    logger.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors and retry logic
apiClient.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      logger.debug('✅ API Response:', response.status, response.config.url);
    }
    // CSRF: Sunucudan gelen token'ı yakala
    const headerToken = getHeaderValue(response.headers, 'x-csrf-token');
    if (headerToken) {
      lastCsrfToken = headerToken;
    }
    return response;
  },
  async (error: AxiosError) => {
    // Gürültüyü azalt: Admin fatura 404'lerini loglama (UI fallback ile yönetiliyor)
    const url = error.config?.url || '';
    const status = error.response?.status;
    const suppressLog =
      status === 404 && typeof url === 'string' && /^\/admin\/tenant\/.+\/invoices/.test(url);

    if (!suppressLog) {
      logger.error('❌ API Error:', {
        message: error.message,
        code: error.code,
        url: error.config?.url,
        status: error.response?.status,
      });
    }

    // Handle network errors - NO RETRY for now to stop spam
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      logger.error('Network error - Backend unavailable:', error.config?.url);
      
      // Return a clear error without retry
      return Promise.reject({
        message: 'Backend servisi erişilebilir değil. Port 3000 kontrol edin.',
        code: 'NETWORK_ERROR',
        originalError: error,
      });
    }

    // Plan limiti hatalarını kullanıcıya hızlıca göster (400 + belirli mesaj)
    const planLimitStatus = error.response?.status;
    const planLimitMessage = extractMessage(error.response?.data);
    if (
      typeof window !== 'undefined' &&
      planLimitStatus === 400 &&
      typeof planLimitMessage === 'string' &&
      planLimitMessage.includes('Plan limitine ulaşıldı')
    ) {
      try {
        window.dispatchEvent(
          new CustomEvent('showToast', { detail: { message: planLimitMessage, tone: 'error' } })
        );
      } catch (dispatchError) {
        logger.debug('Plan limit toast dispatch failed', dispatchError);
      }
    }

    // Maintenance mode: show friendly message and block action
    const maintenanceStatus = error.response?.status;
    const maintenancePayload = isRecord(error.response?.data) ? (error.response?.data as Record<string, unknown>) : undefined;
    const maintenanceError = ensureString(maintenancePayload?.['error']);
    const maintenanceMessage = ensureString(maintenancePayload?.['message']);
    const containsMaintenanceText = maintenanceMessage?.toLowerCase().includes('maintenance') ?? false;
    if (
      maintenanceStatus === 503 &&
      (maintenanceError === 'MAINTENANCE_MODE' || containsMaintenanceText)
    ) {
      const fallbackMessage = maintenanceMessage || 'Sistem bakım modunda (salt okunur). Lütfen daha sonra tekrar deneyin.';
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('showToast', { detail: { message: fallbackMessage, tone: 'error' } })
          );
        }
      } catch (dispatchError) {
        logger.debug('Maintenance toast dispatch failed', dispatchError);
      }
    }

    // Handle authentication errors (user JWT)
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Admin endpoints: admin-token iptal
      if (url.startsWith('/admin')) {
        try {
          adminAuthStorage.clearToken();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('adminAuthExpired'));
          }
        } catch (storageError) {
          logger.debug('Admin token cleanup failed', storageError);
        }
      }

      // User endpoints: spurious logout'u azalt — ardışık 2×401 eşiği
      if (readLegacyAuthToken()) {
        // Kimlik akışı (/auth/*) için logout yapma
        if (!url.includes('/auth/')) {
          try {
            const now = Date.now();
            const keyCount = '__auth_401_count';
            const keyTs = '__auth_401_ts';
            const prevCount = parseInt(safeLocalStorage.getItem(keyCount) || '0', 10) || 0;
            const prevTs = parseInt(safeLocalStorage.getItem(keyTs) || '0', 10) || 0;
            const within = now - prevTs < 15_000; // 15s penceresi
            const nextCount = within ? prevCount + 1 : 1;
            safeLocalStorage.setItem(keyCount, String(nextCount));
            safeLocalStorage.setItem(keyTs, String(now));

            // Bazı düşük öncelikli uç noktalar için sayacı etkileme
            const lowPriority = (
              typeof url === 'string' && (
                url.includes('/site-settings') ||
                url.includes('/status') ||
                url.includes('/health')
              )
            );
            if (lowPriority) {
              return Promise.reject(error);
            }

            if (nextCount >= 2) {
              if (import.meta.env.DEV) logger.info('🔐 2×401 tespit edildi, çıkış yapılıyor…');
              safeLocalStorage.removeItem(keyCount);
              safeLocalStorage.removeItem(keyTs);
              clearLegacySessionCaches();
              if (typeof window !== 'undefined') window.location.href = '/';
            }
          } catch (logoutError) {
            logger.debug('Auth 401 logout flow failed', logoutError);
          }
          return Promise.reject(error);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

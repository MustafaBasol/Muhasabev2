import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger';

// Use proxy in Codespaces (more reliable)
const API_BASE_URL = '/api';

if (import.meta.env.DEV) {
  // Yalnızca geliştirmede bilgi amaçlı logla (varsayılan olarak sessiz)
  logger.info('🔗 API Base URL (PROXY):', API_BASE_URL);
  logger.info('🏭 Backend will be proxied through Vite dev server');
}

// Create axios instance with retry configuration
let lastCsrfToken: string | null = null;

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
    
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // CSRF: Yazma isteklerinde token'ı ekle (varsa)
    const method = (config.method || 'get').toLowerCase();
    const isMutating = ['post', 'put', 'patch', 'delete'].includes(method);
    if (isMutating && lastCsrfToken && config.headers) {
      (config.headers as any)['X-CSRF-Token'] = lastCsrfToken;
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
    const headerToken = (response.headers as any)?.['x-csrf-token'];
    if (headerToken) {
      lastCsrfToken = headerToken as string;
    }
    return response;
  },
  async (error: AxiosError) => {
    logger.error('❌ API Error:', {
      message: error.message,
      code: error.code,
      url: error.config?.url,
      status: error.response?.status,
    });

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
    try {
      const status = error.response?.status;
      const serverMsg = (error.response?.data as any)?.message;
      if (typeof window !== 'undefined' && status === 400 && typeof serverMsg === 'string') {
        if (serverMsg.includes('Plan limitine ulaşıldı')) {
          window.dispatchEvent(
            new CustomEvent('showToast', { detail: { message: serverMsg, tone: 'error' } })
          );
        }
      }
    } catch {}

    // Handle authentication errors - sadece zaten login olmuş kullanıcılar için
    if (error.response?.status === 401 && localStorage.getItem('auth_token')) {
      // Login/register endpoint'lerinde redirect yapma
      if (!error.config?.url?.includes('/auth/')) {
        if (import.meta.env.DEV) {
          logger.info('🔐 Authentication error, clearing token...');
        }
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('tenant');
        window.location.href = '/';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

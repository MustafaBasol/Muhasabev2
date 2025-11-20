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
    const url = config.url || '';
    const isPublic = typeof url === 'string' && (url.startsWith('/public/') || url.startsWith('/auth/public') || url.includes('/public/'));
    if (token && config.headers && !isPublic) {
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

    // Maintenance mode: show friendly message and block action
    try {
      const status = error.response?.status;
      const data: any = error.response?.data || {};
      if (status === 503 && (data?.error === 'MAINTENANCE_MODE' || String(data?.message || '').toLowerCase().includes('maintenance'))) {
        const msg = data?.message || 'Sistem bakım modunda (salt okunur). Lütfen daha sonra tekrar deneyin.';
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('showToast', { detail: { message: msg, tone: 'error' } }));
        }
      }
    } catch {}

    // Handle authentication errors (user JWT)
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Admin endpoints: admin-token iptal
      if (url.startsWith('/admin')) {
        try {
          localStorage.removeItem('admin-token');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('adminAuthExpired'));
          }
        } catch {}
      }

      // User endpoints: spurious logout'u azalt — ardışık 2×401 eşiği
      if (localStorage.getItem('auth_token')) {
        // Kimlik akışı (/auth/*) için logout yapma
        if (!url.includes('/auth/')) {
          try {
            const now = Date.now();
            const keyCount = '__auth_401_count';
            const keyTs = '__auth_401_ts';
            const prevCount = parseInt(localStorage.getItem(keyCount) || '0', 10) || 0;
            const prevTs = parseInt(localStorage.getItem(keyTs) || '0', 10) || 0;
            const within = now - prevTs < 15_000; // 15s penceresi
            const nextCount = within ? prevCount + 1 : 1;
            localStorage.setItem(keyCount, String(nextCount));
            localStorage.setItem(keyTs, String(now));

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
              localStorage.removeItem(keyCount);
              localStorage.removeItem(keyTs);
              localStorage.removeItem('auth_token');
              localStorage.removeItem('user');
              localStorage.removeItem('tenant');
              if (typeof window !== 'undefined') window.location.href = '/';
            }
          } catch {}
          return Promise.reject(error);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// Use proxy in Codespaces (more reliable)
const API_BASE_URL = '/api';

console.log('🔗 API Base URL (PROXY):', API_BASE_URL);
console.log('🏭 Backend will be proxied through Vite dev server');

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
    console.log('📤 API Request:', config.method?.toUpperCase(), config.url);
    
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
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors and retry logic
apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.status, response.config.url);
    // CSRF: Sunucudan gelen token'ı yakala
    const headerToken = (response.headers as any)?.['x-csrf-token'];
    if (headerToken) {
      lastCsrfToken = headerToken as string;
    }
    return response;
  },
  async (error: AxiosError) => {
    console.error('❌ API Error:', {
      message: error.message,
      code: error.code,
      url: error.config?.url,
      status: error.response?.status,
    });

    // Handle network errors - NO RETRY for now to stop spam
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      console.error('� Network error - Backend unavailable:', error.config?.url);
      
      // Return a clear error without retry
      return Promise.reject({
        message: 'Backend servisi erişilebilir değil. Port 3000 kontrol edin.',
        code: 'NETWORK_ERROR',
        originalError: error,
      });
    }

    // Handle authentication errors - sadece zaten login olmuş kullanıcılar için
    if (error.response?.status === 401 && localStorage.getItem('auth_token')) {
      // Login/register endpoint'lerinde redirect yapma
      if (!error.config?.url?.includes('/auth/')) {
        console.log('🔐 Authentication error, clearing token...');
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

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// Use /api prefix to leverage Vite proxy in development
// In production, the API will be on the same origin
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : '/api');

console.log('🔗 API Base URL:', API_BASE_URL);
console.log('🏭 Production Mode:', import.meta.env.PROD);

// Create axios instance with retry configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: (status) => status < 500,
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    console.log('📤 API Request:', config.method?.toUpperCase(), config.url);
    
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
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
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    console.error('❌ API Error:', {
      message: error.message,
      code: error.code,
      url: error.config?.url,
      status: error.response?.status,
    });

    // Handle network errors with retry
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      console.log('🔄 Network error detected, attempting retry...');
      
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        
        // Wait 1 second and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          console.log('🔄 Retrying request...');
          return await apiClient.request(originalRequest);
        } catch (retryError) {
          console.error('❌ Retry failed:', retryError);
        }
      }
      
      // If retry fails, show user-friendly message
      return Promise.reject({
        message: 'Bağlantı hatası. Lütfen backend servisinin çalıştığından emin olun.',
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

import apiClient from './client';

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
      console.log('🔑 Login with fetch API:', data.email);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      console.log('🔍 Fetch response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || 'Geçersiz email veya şifre';
        throw new Error(message);
      }
      
      const responseData = await response.json();
      console.log('🔍 Auth service response:', responseData);
      return responseData;
      
    } catch (error: any) {
      console.error('🔍 Auth service error:', error);
      throw error;
    }
  },

  async getProfile() {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  logout() {
    // Auth verileri
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    
    // Cache'leri temizle (güvenlik için)
    localStorage.removeItem('bankAccounts');
    localStorage.removeItem('sales');
    localStorage.removeItem('customers_cache');
    localStorage.removeItem('suppliers_cache');
    localStorage.removeItem('products_cache');
    localStorage.removeItem('invoices_cache');
    localStorage.removeItem('expenses_cache');
    localStorage.removeItem('notifications'); // Bildirimler de kullanıcıya özel
    
    // NOT: localStorage.clear() KULLANMA - diğer browser ayarlarını siler!
  },
};

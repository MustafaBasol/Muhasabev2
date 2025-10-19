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
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  async login(data: LoginData): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  async getProfile() {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },
};

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, AuthResponse } from '../api/auth';
import { secureStorage } from '../utils/storage';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subscriptionPlan: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    company?: string;
    phone?: string;
    address?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>; // Yeni: User bilgisini backend'den yeniden yükle
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');
    const storedTenant = localStorage.getItem('tenant');

    console.log('🔍 AuthContext localStorage kontrolü:', {
      token: token ? 'var' : 'yok',
      storedUser,
      storedTenant
    });

    const initUser = async () => {
      if (token && storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
        try {
          // Önce localStorage'dan hızlı başlat
          let parsedUser;
          try {
            parsedUser = JSON.parse(storedUser);
          } catch (parseError) {
            console.error('❌ User parse hatası:', parseError);
            clearCorruptedData();
            return;
          }
          setUser(parsedUser);
          console.log('✅ User localStorage\'dan yüklendi:', parsedUser.email);
          
          // Sonra backend'den güncel bilgiyi al
          try {
            console.log('🔄 Backend\'den güncel user bilgisi çekiliyor...');
            const updatedUser = await authService.getProfile();
            setUser(updatedUser);
            await secureStorage.setJSON('user', updatedUser);
            console.log('✅ User bilgisi backend\'den güncellendi:', updatedUser);
          } catch (error) {
            console.error('⚠️ Backend\'den user yüklenemedi, localStorage kullanılıyor:', error);
          }
          
        } catch (error) {
          console.error('❌ User parse hatası:', error);
          localStorage.removeItem('user');
        }
        
        if (storedTenant && storedTenant !== 'undefined' && storedTenant !== 'null') {
          try {
            const parsedTenant = JSON.parse(storedTenant);
            setTenant(parsedTenant);
            console.log('✅ Tenant localStorage\'dan yüklendi:', parsedTenant.name);
          } catch (error) {
            console.error('❌ Tenant parse hatası:', error);
            console.log('🧹 Bozuk tenant data temizleniyor...');
            localStorage.removeItem('tenant');
          }
        }
      }
      setIsLoading(false);
    };

    initUser();
  }, []);

  const handleAuthSuccess = (data: AuthResponse) => {
    console.log('🔍 Auth data received:', data);
    
    // Safety check
    if (!data || !data.user || !data.token) {
      console.error('❌ Invalid auth data:', data);
      throw new Error('Geçersiz auth verisi alındı');
    }
    
    // Önce eski verileri temizle
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    
    // Yeni verileri kaydet
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);

    if (data.tenant) {
      localStorage.setItem('tenant', JSON.stringify(data.tenant));
      setTenant(data.tenant);
    }
    
    console.log('✅ Yeni kullanıcı girişi:', {
      email: data.user?.email,
      tenantId: data.user?.tenantId,
      tenant: data.tenant?.name
    });
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('🔑 Login başlatılıyor:', { email });
      const data = await authService.login({ email, password });
      console.log('🔍 Login response:', data);
      handleAuthSuccess(data);
      console.log('✅ Login tamamlandı');
    } catch (error: any) {
      console.error('❌ Login failed:', error);
      
      // Error mesajını düzelt
      const errorMessage = error?.response?.data?.message || 
                          error?.message || 
                          'Giriş sırasında bir hata oluştu';
      
      throw new Error(errorMessage);
    }
  };

  const register = async (registerData: {
    name: string;
    email: string;
    password: string;
    company?: string;
    phone?: string;
    address?: string;
  }) => {
    try {
      // Name'i firstName ve lastName olarak ayır
      const nameParts = registerData.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const authData = {
        email: registerData.email,
        password: registerData.password,
        firstName,
        lastName,
        companyName: registerData.company
      };
      
      const data = await authService.register(authData);
      handleAuthSuccess(data);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const clearCorruptedData = () => {
    console.log('🧹 Corrupted localStorage data temizleniyor...');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('customers_cache');
    localStorage.removeItem('suppliers_cache');
    localStorage.removeItem('products_cache');
    localStorage.removeItem('invoices_cache');
    localStorage.removeItem('expenses_cache');
    localStorage.removeItem('bankAccounts');
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setTenant(null);
      clearCorruptedData();
    }
  };  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.log('⚠️ Token yok, refreshUser iptal');
        return;
      }

      console.log('🔄 Backend\'den güncel user bilgisi alınıyor...');
      const updatedUser = await authService.getProfile();
      
      console.log('✅ User bilgisi backend\'den güncellendi:', updatedUser);
      console.log('📝 Detay - firstName:', updatedUser.firstName, 'lastName:', updatedUser.lastName);
      
      // State'i güncelle
      setUser(updatedUser);
      
      // localStorage'ı güncelle
      localStorage.setItem('user', JSON.stringify(updatedUser));
      console.log('💾 localStorage user güncellendi');
    } catch (error) {
      console.error('❌ HATA: User refresh başarısız oldu!', error);
      if (error instanceof Error) {
        console.error('❌ Error message:', error.message);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser, // Yeni fonksiyon
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

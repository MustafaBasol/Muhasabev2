import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, type AuthResponse } from '../api/auth';
import { usersApi } from '../api/users';

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
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          console.log('✅ User localStorage\'dan yüklendi:', parsedUser.email);
          
          // Sonra backend'den güncel bilgiyi al
          try {
            console.log('🔄 Backend\'den güncel user bilgisi çekiliyor...');
            const updatedUser = await usersApi.getProfile();
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
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
            setTenant(JSON.parse(storedTenant));
            console.log('✅ Tenant localStorage\'dan yüklendi');
          } catch (error) {
            console.error('❌ Tenant parse hatası:', error);
            localStorage.removeItem('tenant');
          }
        }
      }
      setIsLoading(false);
    };

    initUser();
  }, []);

  const handleAuthSuccess = (data: AuthResponse) => {
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
      email: data.user.email,
      tenantId: data.user.tenantId,
      tenant: data.tenant?.name
    });
  };

  const login = async (email: string, password: string) => {
    try {
      const data = await authService.login({ email, password });
      handleAuthSuccess(data);
      console.log('✅ Login tamamlandı');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
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

  const logout = () => {
    console.log('🚪 Kullanıcı çıkış yapıyor...');
    authService.logout();
    setUser(null);
    setTenant(null);
    // Sayfayı yenile (login sayfasına yönlendir)
    window.location.href = '/';
  };

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.log('⚠️ Token yok, refreshUser iptal');
        return;
      }

      console.log('🔄 Backend\'den güncel user bilgisi alınıyor...');
      const updatedUser = await usersApi.getProfile();
      
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

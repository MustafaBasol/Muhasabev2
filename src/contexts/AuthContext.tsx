import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { authService, AuthResponse } from '../api/auth';
// import { secureStorage } from '../utils/storage';
import { logger } from '../utils/logger';
import { createSessionManager, SessionManager } from '../utils/sessionManager';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  isEmailVerified?: boolean;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subscriptionPlan: string;
  status: string;
  subscriptionExpiresAt?: string;
  maxUsers?: number;
  cancelAtPeriodEnd?: boolean;
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
  const sessionRef = useRef<SessionManager | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');
    const storedTenant = localStorage.getItem('tenant');

    logger.info('🔍 AuthContext localStorage kontrolü:', {
      token: token ? 'var' : 'yok',
      storedUser,
      storedTenant
    });

    const initUser = async () => {
      try {
        // 1) Local hızlı başlangıç (varsa ve parse edilebilirse)
        if (storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
          try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            logger.info("✅ User localStorage'dan yüklendi:", parsedUser?.email);
          } catch (parseError) {
            console.error('❌ User parse hatası (yoksayılıp yenisi çekilecek):', parseError);
            // Sadece bozuk user kaydını temizle, token kalsın
            localStorage.removeItem('user');
          }
        }

        // 2) Tenant'i localStorage'dan oku (varsa)
        if (storedTenant && storedTenant !== 'undefined' && storedTenant !== 'null') {
          try {
            const parsedTenant = JSON.parse(storedTenant);
            setTenant(parsedTenant);
            logger.info("✅ Tenant localStorage'dan yüklendi:", parsedTenant?.name);
          } catch (e) {
            console.error('❌ Tenant parse hatası:', e);
            localStorage.removeItem('tenant');
          }
        }

        // 3) Token varsa backend'den güncel profili çek (storedUser olsa da olmasa da)
        if (token) {
          try {
            logger.info("🔄 Backend'den güncel user bilgisi çekiliyor...");
            const res = await authService.getProfile();
            // API bazı durumlarda { user, tenant } dönebilir
            const nextUser = (res as any)?.user || res;
            const nextTenant = (res as any)?.tenant;
            if (nextUser) {
              setUser(nextUser);
              localStorage.setItem('user', JSON.stringify(nextUser));
              logger.info('✅ User bilgisi backend\'den güncellendi');
            }
            if (nextTenant) {
              setTenant(nextTenant);
              localStorage.setItem('tenant', JSON.stringify(nextTenant));
            }
          } catch (e) {
            console.error('⚠️ Backend\'den profil çekilemedi:', e);
            // Token çalışmıyorsa kullanıcı oturumu olmayabilir; ama burada token'ı silmeyelim.
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    initUser();
    return () => {
      // cleanup on unmount
      try { sessionRef.current?.stop(); } catch {}
    };
  }, []);

  const handleAuthSuccess = (data: AuthResponse) => {
  logger.info('🔍 Auth data received:', data);
    
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
    // Start/Restart session manager for activity + refresh
    try {
      sessionRef.current?.stop();
      sessionRef.current = createSessionManager(
        () => localStorage.getItem('auth_token'),
        (t: string) => localStorage.setItem('auth_token', t),
        () => logout(),
        {
          idleTimeoutMinutes: Number((import.meta as any)?.env?.VITE_IDLE_TIMEOUT_MINUTES) || 30,
        }
      );
      sessionRef.current.start();
    } catch (e) {
      // ignore
    }
    
    logger.info('✅ Yeni kullanıcı girişi:', {
      email: data.user?.email,
      tenantId: data.user?.tenantId,
      tenant: data.tenant?.name
    });
  };

  const login = async (email: string, password: string) => {
    try {
      logger.info('🔑 Login başlatılıyor:', { email });
      const data = await authService.login({ email, password });
      logger.debug('🔍 Login response:', data);
      handleAuthSuccess(data);
      logger.info('✅ Login tamamlandı');
    } catch (err: unknown) {
      console.error('❌ Login failed:', err);
      
      // Error mesajını düzelt
      type HasResponseMessage = { response?: { data?: { message?: string } } };
      const maybe = (typeof err === 'object' && err !== null) ? (err as HasResponseMessage) : undefined;
      const apiMessage = maybe?.response?.data?.message;
      const errorMessage = (typeof apiMessage === 'string')
        ? apiMessage
        : (err instanceof Error ? err.message : 'Giriş sırasında bir hata oluştu');
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
      
      const verificationRequired = String(import.meta.env.VITE_EMAIL_VERIFICATION_REQUIRED || '').toLowerCase() === 'true';

      // Eğer e-posta doğrulaması zorunlu ise spec uyumlu /auth/signup kullan
      if (verificationRequired) {
        await authService.signup(authData);
        try { sessionStorage.setItem('pending_verification_email', registerData.email); } catch {}
      } else {
        const data = await authService.register(authData);
        handleAuthSuccess(data);
      }
      // Eğer e-posta doğrulaması zorunlu ise, otomatik giriş yapma
      if (verificationRequired) {
        // Yönlendirme: verify notice ekranı
        window.location.hash = 'verify-notice';
      }
    } catch (error: any) {
      console.error('Registration failed:', error);
      // 409 özel durumu kullanıcı dostu şekilde komponentte ele alabilmek için fırlat
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message || 'Kayıt sırasında bir hata oluştu';
      if (status === 409) {
        const err = new Error('EMAIL_IN_USE');
        (err as any).status = 409;
        throw err;
      }
      throw new Error(message);
    }
  };

  const clearCorruptedData = () => {
  logger.warn('🧹 Corrupted localStorage data temizleniyor...');
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
      try { sessionRef.current?.stop(); } catch {}
      setUser(null);
      setTenant(null);
      clearCorruptedData();
      try { sessionStorage.removeItem('pending_verification_email'); } catch {}
    }
  };
  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        logger.warn('⚠️ Token yok, refreshUser iptal');
        return;
      }

      logger.info("🔄 Backend'den güncel user bilgisi alınıyor...");
      const res = await authService.getProfile();
      // API: { user: {...}, tenant: {...} }
      logger.info("✅ User bilgisi backend'den güncellendi:", res);
      logger.debug('📝 Detay - firstName:', res?.user?.firstName, 'lastName:', res?.user?.lastName);
  // Email doğrulama durumunu logla
  try { logger.info('📧 Email doğrulama durumu:', res?.user?.isEmailVerified); } catch {}

      // State'i güncelle
      if (res?.user) setUser(res.user);
      if (res?.tenant) setTenant(res.tenant);

      // localStorage'ı güncelle
      if (res?.user) localStorage.setItem('user', JSON.stringify(res.user));
      if (res?.tenant) localStorage.setItem('tenant', JSON.stringify(res.tenant));
      logger.debug('💾 localStorage user/tenant güncellendi');
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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { authService, AuthResponse } from '../api/auth';
// import { secureStorage } from '../utils/storage';
import { logger } from '../utils/logger';
import { createSessionManager, SessionManager } from '../utils/sessionManager';
import { isEmailVerificationRequired } from '../utils/emailVerification';
import {
  safeLocalStorage,
  safeSessionStorage,
  readLegacyAuthToken,
  writeLegacyAuthToken,
  readLegacyUserProfile,
  writeLegacyUserProfile,
  readLegacyTenantProfile,
  writeLegacyTenantProfile,
  clearLegacySessionCaches,
  listLocalStorageKeys,
} from '../utils/localStorageSafe';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  isEmailVerified?: boolean;
  // Optional enriched fields
  lastLoginAt?: string;
  lastLoginTimeZone?: string;
  lastLoginUtcOffsetMinutes?: number;
}

export interface Tenant {
  id: string;
  name: string;
  companyName?: string | null;
  slug: string;
  subscriptionPlan: string;
  status: string;
  subscriptionExpiresAt?: string;
  maxUsers?: number;
  effectiveMaxUsers?: number | null;
  cancelAtPeriodEnd?: boolean;
  billingInterval?: 'month' | 'year' | null;
  updatedAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    twoFactorToken?: string,
    turnstileToken?: string,
  ) => Promise<{ mfaRequired?: true; captchaRequired?: true } | void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    company?: string;
    phone?: string;
    address?: string;
    turnstileToken?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>; // Yeni: User bilgisini backend'den yeniden yükle
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type ProfileEnvelope = {
  user?: User;
  tenant?: Tenant;
};

const isProfileEnvelope = (value: unknown): value is ProfileEnvelope =>
  typeof value === 'object' && value !== null && ('user' in value || 'tenant' in value);

const isUser = (value: unknown): value is User =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  'email' in value &&
  'tenantId' in value;

const extractProfile = (value: unknown): ProfileEnvelope => {
  if (isProfileEnvelope(value)) {
    return value;
  }
  if (isUser(value)) {
    return { user: value };
  }
  return {};
};

const USER_CACHE_KEY = 'user';
const TENANT_CACHE_KEY = 'tenant';
const PENDING_INVITE_KEY = 'pending_invite_token';

const readCachedUser = (): User | null => {
  const cached = readLegacyUserProfile<User>();
  if (!cached) {
    safeLocalStorage.removeItem(USER_CACHE_KEY);
  }
  return cached;
};

const readCachedTenant = (): Tenant | null => {
  const cached = readLegacyTenantProfile<Tenant>();
  if (!cached) {
    safeLocalStorage.removeItem(TENANT_CACHE_KEY);
  }
  return cached;
};

const persistCachedUser = (value: User | null): void => {
  writeLegacyUserProfile(value);
};

const persistCachedTenant = (value: Tenant | null): void => {
  writeLegacyTenantProfile(value);
};

const readAuthToken = (): string | null => readLegacyAuthToken();

const persistAuthToken = (token: string | null): void => {
  writeLegacyAuthToken(token);
};

const getIdleTimeoutMinutes = () => {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  const raw = env?.VITE_IDLE_TIMEOUT_MINUTES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
};

type ApiErrorLike = {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
};

const getApiErrorDetails = (error: unknown): ApiErrorLike =>
  typeof error === 'object' && error !== null ? (error as ApiErrorLike) : {};

type StatusAssignableError = Error & { status?: number };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRef = useRef<SessionManager | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const nextAllowedRefreshAtRef = useRef<number>(0);

  useEffect(() => {
    // Check if user is already logged in
    const token = readAuthToken();
    const cachedUser = readCachedUser();
    const cachedTenant = readCachedTenant();

    logger.info('🔍 AuthContext local cache kontrolü:', {
      token: token ? 'var' : 'yok',
      cachedUserEmail: cachedUser?.email ?? null,
      cachedTenantName: cachedTenant?.name ?? null,
    });

    const initUser = async () => {
      try {
        // 1) Local hızlı başlangıç
        if (cachedUser) {
          setUser(cachedUser);
          logger.info("✅ User local cache'den yüklendi:", cachedUser.email);
        }

        // 2) Tenant'i local cache'den oku (varsa)
        if (cachedTenant) {
          setTenant(cachedTenant);
          logger.info("✅ Tenant local cache'den yüklendi:", cachedTenant.name);
        }

        // 3) Token varsa backend'den güncel profili çek (storedUser olsa da olmasa da)
        if (token) {
          try {
            logger.info("🔄 Backend'den güncel user bilgisi çekiliyor...");
            const res = await authService.getProfile();
            const { user: nextUser, tenant: nextTenant } = extractProfile(res);
            if (nextUser) {
              setUser(nextUser);
              persistCachedUser(nextUser);
              logger.info('✅ User bilgisi backend\'den güncellendi');
            }
            if (nextTenant) {
              setTenant(nextTenant);
              persistCachedTenant(nextTenant);
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
      try {
        sessionRef.current?.stop();
      } catch (stopError) {
        logger.warn('Session manager cleanup failed', stopError);
      }
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
    persistAuthToken(null);
    persistCachedUser(null);
    persistCachedTenant(null);
    
    // Yeni verileri kaydet
    persistAuthToken(data.token);
    persistCachedUser(data.user);
    setUser(data.user);

    if (data.tenant) {
      persistCachedTenant(data.tenant);
      setTenant(data.tenant);
    }
    // Start/Restart session manager for activity + refresh
    try {
      sessionRef.current?.stop();
      sessionRef.current = createSessionManager(
        () => readAuthToken(),
        (t: string) => persistAuthToken(t),
        () => logout(),
        {
          idleTimeoutMinutes: getIdleTimeoutMinutes(),
        }
      );
      sessionRef.current.start();
    } catch (sessionError) {
      logger.warn('Session manager başlatılırken hata oluştu', sessionError);
    }
    
    logger.info('✅ Yeni kullanıcı girişi:', {
      email: data.user?.email,
      tenantId: data.user?.tenantId,
      tenant: data.tenant?.name
    });

    // Davet akışı: login sonrası pending_invite_token varsa otomatik kabul et
    try {
      const pendingToken = safeSessionStorage.getItem(PENDING_INVITE_KEY) || safeLocalStorage.getItem(PENDING_INVITE_KEY);
      if (pendingToken) {
        // import dynamically to avoid circular deps
        import('../api/organizations').then(async (m) => {
          try {
            await m.organizationsApi.acceptInvite({ token: pendingToken });
            safeSessionStorage.removeItem(PENDING_INVITE_KEY);
            safeLocalStorage.removeItem(PENDING_INVITE_KEY);
            // Profil/tenant bilgilerini tazele
            try {
              await refreshUser();
            } catch (refreshError) {
              logger.warn('Org invite sonrası refreshUser başarısız', refreshError);
            }
            // İsteğe bağlı: dashboard'a yönlendir
            try {
              window.dispatchEvent(new Event('org-invite-accepted'));
            } catch (dispatchError) {
              logger.warn('Org invite event dispatch başarısız', dispatchError);
            }
          } catch (e) {
            // Hata olursa token'ı koru, kullanıcı tekrar deneyebilir
            console.error('Invite accept after login failed:', e);
          }
        });
      }
    } catch (inviteError) {
      logger.warn('Invite token kontrolü sırasında hata oluştu', inviteError);
    }
  };

  const login = async (
    email: string,
    password: string,
    twoFactorToken?: string,
    turnstileToken?: string,
  ) => {
    try {
      logger.info('🔑 Login başlatılıyor:', { email });
      const data = await authService.login({
        email,
        password,
        twoFactorToken,
        turnstileToken,
      });
      logger.debug('🔍 Login response:', data);
      if ('mfaRequired' in data) {
        // İkinci adım gerekli, çağırana haber ver
        return { mfaRequired: true } as const;
      }
      handleAuthSuccess(data);
      // Hemen ardından profili tazele (TZ gibi zengin alanları almak için)
      try {
        await refreshUser();
      } catch (refreshError) {
        logger.warn('Login sonrası refreshUser başarısız', refreshError);
      }
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
    turnstileToken?: string;
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
        companyName: registerData.company,
        turnstileToken: registerData.turnstileToken,
      };
      
      const verificationRequired = isEmailVerificationRequired();

      // Eğer e-posta doğrulaması zorunlu ise spec uyumlu /auth/signup kullan
      if (verificationRequired) {
        await authService.signup(authData);
        try {
          safeSessionStorage.setItem('pending_verification_email', registerData.email);
        } catch (storageError) {
          logger.warn('pending_verification_email kaydedilemedi', storageError);
        }
      } else {
        const data = await authService.register(authData);
        handleAuthSuccess(data);
      }
      // Eğer e-posta doğrulaması zorunlu ise, otomatik giriş yapma
      if (verificationRequired) {
        // Yönlendirme: verify notice ekranı
        window.location.hash = 'verify-notice';
      }
    } catch (error: unknown) {
      console.error('Registration failed:', error);
      // 409 özel durumu kullanıcı dostu şekilde komponentte ele alabilmek için fırlat
      const details = getApiErrorDetails(error);
      const status = details.response?.status;
      const message = details.response?.data?.message || details.message || 'Kayıt sırasında bir hata oluştu';
      if (status === 409) {
        const err: StatusAssignableError = new Error('EMAIL_IN_USE');
        err.status = 409;
        throw err;
      }
      throw new Error(message);
    }
  };

  const clearCorruptedData = () => {
    logger.warn('🧹 Corrupted localStorage verileri temizleniyor...');
    clearLegacySessionCaches();
    [
      'customers_cache',
      'suppliers_cache',
      'products_cache',
      'invoices_cache',
      'expenses_cache',
      'bankAccounts',
    ].forEach(key => safeLocalStorage.removeItem(key));
    try {
      const prefixes = [
        'customers_cache_', 'suppliers_cache_', 'products_cache_', 'invoices_cache_', 'expenses_cache_',
        'sales_', 'sales_cache_', 'sales_backup_', 'sales_last_seen_ts_', 'bankAccounts_', 'quotes_cache_'
      ];
      const keys = listLocalStorageKeys();
      keys.forEach((key) => {
        if (prefixes.some((prefix) => key.startsWith(prefix))) {
          safeLocalStorage.removeItem(key);
        }
      });
    } catch (cleanupError) {
      logger.warn('Cache temizleme sırasında hata oluştu', cleanupError);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      try {
        sessionRef.current?.stop();
      } catch (stopError) {
        logger.warn('Logout sırasında session manager durdurulamadı', stopError);
      }
      setUser(null);
      setTenant(null);
      clearCorruptedData();
      try {
        safeSessionStorage.removeItem('pending_verification_email');
      } catch (storageError) {
        logger.warn('pending_verification_email temizlenemedi', storageError);
      }
    }
  };
  const refreshUser = useCallback(async (options?: { force?: boolean }): Promise<void> => {
    const token = readAuthToken();
    if (!token) {
      logger.warn('⚠️ Token yok, refreshUser iptal');
      return;
    }

    if (refreshInFlightRef.current) {
      logger.debug('⏳ refreshUser beklemede, mevcut çağrıya eklendi');
      return refreshInFlightRef.current;
    }

    const now = Date.now();
    const DEFAULT_THROTTLE_MS = 5_000;
    const RATE_LIMIT_BACKOFF_MS = 15_000;
    if (!options?.force && now < nextAllowedRefreshAtRef.current) {
      logger.debug('⏳ refreshUser throttled', { msLeft: nextAllowedRefreshAtRef.current - now });
      return;
    }

    const execPromise = (async () => {
      try {
        logger.info("🔄 Backend'den güncel user bilgisi alınıyor...");
        const res = await authService.getProfile();
        logger.info("✅ User bilgisi backend'den güncellendi:", res);
        logger.debug('📝 Detay - firstName:', res?.user?.firstName, 'lastName:', res?.user?.lastName);
        logger.info('📧 Email doğrulama durumu:', res?.user?.isEmailVerified);

        if (res?.user) {
          setUser(res.user);
          persistCachedUser(res.user);
        }
        if (res?.tenant) {
          setTenant(res.tenant);
          persistCachedTenant(res.tenant);
        }
        logger.debug('💾 Yerel user/tenant cache güncellendi');
        nextAllowedRefreshAtRef.current = Date.now() + DEFAULT_THROTTLE_MS;
      } catch (error) {
        const details = getApiErrorDetails(error);
        const status = details.response?.status;
        if (status === 429) {
          logger.warn('⚠️ refreshUser rate limit (429). Geçici olarak bekleniyor.');
          nextAllowedRefreshAtRef.current = Date.now() + RATE_LIMIT_BACKOFF_MS;
        } else {
          console.error('❌ HATA: User refresh başarısız oldu!', error);
          if (error instanceof Error) {
            console.error('❌ Error message:', error.message);
          }
          nextAllowedRefreshAtRef.current = Date.now() + DEFAULT_THROTTLE_MS;
        }
      }
    })();

    refreshInFlightRef.current = execPromise;

    try {
      await execPromise;
    } finally {
      refreshInFlightRef.current = null;
    }
  }, []);

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

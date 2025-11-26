import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usersApi } from '../api/users';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';
import {
  buildTenantScopedKey,
  getCachedTenantId,
  getCachedUserId,
  parseLocalObject,
  readNotificationPrefsCache as readScopedNotificationPrefsCache,
  readTenantScopedObject,
  safeLocalStorage,
  writeNotificationPrefsCache,
  writeTenantScopedObject,
} from '../utils/localStorageSafe';

export interface NotificationPreferences {
  invoiceReminders?: boolean;
  expenseAlerts?: boolean;
  salesNotifications?: boolean;
  lowStockAlerts?: boolean;
  quoteReminders?: boolean;
}

interface NotificationPreferencesContextValue {
  prefs: NotificationPreferences;
  loading: boolean;
  refresh: () => Promise<void>;
  updatePref: (key: keyof NotificationPreferences, value: boolean) => Promise<void>;
}

const NotificationPreferencesContext = createContext<NotificationPreferencesContextValue | undefined>(undefined);

const LOCAL_CACHE_KEY = 'notif_prefs_cache_last';

const defaultPrefs: NotificationPreferences = {
  invoiceReminders: true,
  expenseAlerts: true,
  salesNotifications: true,
  lowStockAlerts: true,
  quoteReminders: true,
};

const buildUserScopedCacheKey = (userId: string): string => `${LOCAL_CACHE_KEY}:${userId ?? 'anon'}`;

const resolveTenantScope = () => ({
  tenantId: getCachedTenantId(),
  userId: getCachedUserId(),
});

const readTenantScopedPrefsCache = (): NotificationPreferences | null => {
  const { tenantId, userId } = resolveTenantScope();
  const baseKey = buildUserScopedCacheKey(userId);
  try {
    const scoped = readTenantScopedObject<NotificationPreferences>(baseKey, { tenantId, fallbackToBase: true });
    if (scoped) {
      return { ...defaultPrefs, ...scoped };
    }
  } catch (error) {
    logger.warn('Tenant scoped notification prefs cache okunamadı', error);
  }
  return null;
};

const deriveNotificationStorageKeys = (): Set<string> => {
  const { tenantId, userId } = resolveTenantScope();
  const baseKey = buildUserScopedCacheKey(userId);
  const scopedKey = buildTenantScopedKey(baseKey, tenantId);
  const keys = new Set<string>();
  [scopedKey, baseKey, LOCAL_CACHE_KEY].forEach(key => {
    if (key) keys.add(key);
  });
  return keys;
};

export const NotificationPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPrefs);
  const [loading, setLoading] = useState<boolean>(true);
  const [pollMs] = useState<number>(5 * 60 * 1000); // 5 dakika
  const { isAuthenticated } = useAuth();

  const readLegacyPrefs = (): NotificationPreferences | null => {
    try {
      return readScopedNotificationPrefsCache<NotificationPreferences>({
        userIds: [getCachedUserId()],
      });
    } catch (error) {
      logger.warn('Legacy prefs okunamadı', error);
      return null;
    }
  };

  const loadFromLocal = (): NotificationPreferences | null => {
    const tenantScoped = readTenantScopedPrefsCache();
    if (tenantScoped) {
      return tenantScoped;
    }

    try {
      const cached = parseLocalObject<NotificationPreferences>(
        safeLocalStorage.getItem(LOCAL_CACHE_KEY),
        'notification preferences local cache'
      );
      if (cached) {
        return { ...defaultPrefs, ...cached };
      }
    } catch (error) {
      logger.warn('Legacy notification preferences local cache okunamadı', error);
    }

    try {
      const scoped = readScopedNotificationPrefsCache<NotificationPreferences>();
      if (scoped) {
        return { ...defaultPrefs, ...scoped };
      }
    } catch (error) {
      logger.warn('Scoped notification preferences cache okunamadı', error);
    }

    return null;
  };

  const persistLocal = (p: NotificationPreferences) => {
    const { tenantId, userId } = resolveTenantScope();
    const baseKey = buildUserScopedCacheKey(userId);
    try {
      writeTenantScopedObject(baseKey, p, { tenantId, mirrorToBase: true });
    } catch (error) {
      logger.warn('Notification preferences tenant cache yazılamadı', error);
    }

    try {
      writeNotificationPrefsCache(p, {
        tenantIds: [tenantId],
        userIds: [userId],
        includeDefaultTenant: true,
      });
    } catch (error) {
      logger.warn('Notification preferences cache helper yazılamadı', error);
    }
  };

  const refresh = useCallback(async () => {
    // Kimlik doğrulama yoksa backend'e istek atmayıp local cache'i kullan
    if (!isAuthenticated) {
      const cached = loadFromLocal();
      if (cached) setPrefs(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const remote = await usersApi.getNotificationPreferences();

      let effective: NotificationPreferences = { ...defaultPrefs, ...remote };
      // Eğer backend boş/eksik ve local legacy varsa bir defalık backend'e taşı
      const legacy = readLegacyPrefs();
      const hasRemote = Object.values(remote || {}).some(v => typeof v === 'boolean');
      if (!hasRemote && legacy) {
        try {
          const toSend = { ...defaultPrefs, ...legacy };
          await usersApi.updateNotificationPreferences(toSend);
          effective = toSend;
        } catch (error) {
          logger.warn('Legacy bildirim tercihlerini backend ile senkron edemedik', error);
        }
      }

      setPrefs(effective);
      persistLocal(effective);
    } catch (error) {
      logger.warn('Notification preferences yenilenemedi, cache kullanılacak', error);
      // offline ise veya istek düşerse local cache kullan
      const cached = loadFromLocal();
      if (cached) setPrefs(cached);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh, isAuthenticated]);

  // Çok sekmeli senkron: periyodik backend fetch ve localStorage değişiminde senkron
  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {};
    }
    // Yalnızca oturum açıkken periyodik poll
    const id = isAuthenticated ? setInterval(() => { refresh(); }, pollMs) : null;
    const trackedKeys = deriveNotificationStorageKeys();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !trackedKeys.has(e.key)) {
        return;
      }
      try {
        const parsed = parseLocalObject<NotificationPreferences>(
          e.newValue,
          `notification prefs storage event (${e.key})`
        );
        if (parsed) {
          setPrefs(prev => ({ ...prev, ...parsed }));
        }
      } catch (error) {
        logger.warn('Notification prefs storage event parse hatası', error);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      if (id) clearInterval(id);
      window.removeEventListener('storage', onStorage);
    };
  }, [pollMs, refresh, isAuthenticated]);

  const updatePref = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    const previousValue = prefs[key] ?? defaultPrefs[key] ?? false;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    persistLocal(next);
    try {
      await usersApi.updateNotificationPreferences(next);
    } catch (error) {
      logger.error('Notification preference güncellenemedi, geri alınıyor', error);
      const rollback = { ...next, [key]: previousValue };
      setPrefs(rollback);
      persistLocal(rollback);
    }
  }, [prefs]);

  return (
    <NotificationPreferencesContext.Provider value={{ prefs, loading, refresh, updatePref }}>
      {children}
    </NotificationPreferencesContext.Provider>
  );
};

export const useNotificationPreferences = (): NotificationPreferencesContextValue => {
  const ctx = useContext(NotificationPreferencesContext);
  if (!ctx) throw new Error('useNotificationPreferences must be used within NotificationPreferencesProvider');
  return ctx;
};

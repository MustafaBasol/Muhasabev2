import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usersApi } from '../api/users';
import { useAuth } from './AuthContext';

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

export const NotificationPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPrefs);
  const [loading, setLoading] = useState<boolean>(true);
  const [pollMs] = useState<number>(5 * 60 * 1000); // 5 dakika
  const { isAuthenticated } = useAuth();

  const loadFromLocal = (): NotificationPreferences | null => {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...defaultPrefs, ...parsed };
      }
    } catch {}
    return null;
  };

  const persistLocal = (p: NotificationPreferences) => {
    try { localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(p)); } catch {}
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

      const readLegacyPrefs = (): NotificationPreferences | null => {
        try {
          const tid = (localStorage.getItem('tenantId') || 'default') as string;
          let localUid = 'anon';
          try {
            const userRaw = localStorage.getItem('user');
            if (userRaw) { const u = JSON.parse(userRaw); localUid = u?.id || u?._id || localUid; }
          } catch {}
          const candidates: string[] = [
            `notif_prefs:${tid}:${localUid}`,
            `notif_prefs:default:${localUid}`,
          ];
          for (const k of candidates) {
            const raw = localStorage.getItem(k);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') return parsed;
              } catch {}
            }
          }
        } catch {}
        return null;
      };

      let effective: NotificationPreferences = { ...defaultPrefs, ...remote };
      // Eğer backend boş/eksik ve local legacy varsa bir defalık backend'e taşı
      const legacy = readLegacyPrefs();
      const hasRemote = Object.values(remote || {}).some(v => typeof v === 'boolean');
      if (!hasRemote && legacy) {
        try {
          const toSend = { ...defaultPrefs, ...legacy };
          await usersApi.updateNotificationPreferences(toSend);
          effective = toSend;
        } catch {}
      }

      setPrefs(effective);
      persistLocal(effective);
    } catch {
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
    // Yalnızca oturum açıkken periyodik poll
    const id = isAuthenticated ? setInterval(() => { refresh(); }, pollMs) : null;
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_CACHE_KEY) {
        try {
          const parsed = JSON.parse(e.newValue || '{}');
          if (parsed && typeof parsed === 'object') {
            setPrefs(prev => ({ ...prev, ...parsed }));
          }
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      if (id) clearInterval(id);
      window.removeEventListener('storage', onStorage);
    };
  }, [pollMs, refresh, isAuthenticated]);

  const updatePref = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      persistLocal(next); // optimistic local
      return next;
    });
    try {
      const toSend = { ...prefs, [key]: value };
      await usersApi.updateNotificationPreferences(toSend);
    } catch (e) {
      // rollback basit: başarısız olursa eski değeri geri al
      setPrefs(prev => ({ ...prev, [key]: !value }));
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

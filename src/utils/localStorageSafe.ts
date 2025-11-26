import { logger } from './logger';

type Nullable<T> = T | null | undefined;

const resolveStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch (error) {
    logger.warn('[storage] localStorage is not accessible', error);
    return null;
  }
};

const resolveSessionStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch (error) {
    logger.warn('[storage] sessionStorage is not accessible', error);
    return null;
  }
};

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    const storage = resolveStorage();
    if (!storage) return null;
    try {
      return storage.getItem(key);
    } catch (error) {
      logger.warn(`[storage] Failed to read key ${key}`, error);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    const storage = resolveStorage();
    if (!storage) return;
    try {
      storage.setItem(key, value);
    } catch (error) {
      logger.warn(`[storage] Failed to write key ${key}`, error);
    }
  },
  removeItem: (key: string): void => {
    const storage = resolveStorage();
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch (error) {
      logger.warn(`[storage] Failed to remove key ${key}`, error);
    }
  },
};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    const storage = resolveSessionStorage();
    if (!storage) return null;
    try {
      return storage.getItem(key);
    } catch (error) {
      logger.warn(`[storage] Failed to read session key ${key}`, error);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    const storage = resolveSessionStorage();
    if (!storage) return;
    try {
      storage.setItem(key, value);
    } catch (error) {
      logger.warn(`[storage] Failed to write session key ${key}`, error);
    }
  },
  removeItem: (key: string): void => {
    const storage = resolveSessionStorage();
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch (error) {
      logger.warn(`[storage] Failed to remove session key ${key}`, error);
    }
  },
};

export const listLocalStorageKeys = (): string[] => {
  const storage = resolveStorage();
  if (!storage) return [];
  try {
    return Object.keys(storage);
  } catch (error) {
    logger.warn('[storage] Failed to enumerate keys', error);
    return [];
  }
};

export const safeParseJson = (raw: string | null, context: string): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    logger.warn(`[storage] JSON parse failed for ${context}`, {
      error,
      sample: raw.slice(0, 64),
    });
    return null;
  }
};

export const parseLocalObject = <T extends Record<string, unknown>>(raw: string | null, context: string): T | null => {
  const parsed = safeParseJson(raw, context);
  if (parsed && typeof parsed === 'object') {
    return parsed as T;
  }
  if (parsed !== null) {
    logger.warn(`[storage] Parsed value for ${context} is not an object`, { context });
  }
  return null;
};

export const parseLocalArray = <T = unknown>(raw: string | null, context: string): T[] | null => {
  const parsed = safeParseJson(raw, context);
  if (Array.isArray(parsed)) {
    return parsed as T[];
  }
  if (parsed !== null) {
    logger.warn(`[storage] Parsed value for ${context} is not an array`, { context });
  }
  return null;
};

const sanitizeString = (value: Nullable<string | number>): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
};

const pickIdentifier = (source: Nullable<{ id?: unknown; _id?: unknown }>): string | null => {
  if (!source) return null;
  return sanitizeString(source.id as Nullable<string | number>)
    ?? sanitizeString(source._id as Nullable<string | number>)
    ?? null;
};

export const getCachedTenantId = (): string => {
  return readLegacyTenantId() ?? 'default';
};

export const getCachedUserId = (): string => {
  const cachedUser = readLegacyUserProfile<{ id?: unknown; _id?: unknown }>();
  return pickIdentifier(cachedUser) ?? 'anon';
};

export const buildNotificationPrefsKey = (tenantId: string, userId: string): string => `notif_prefs:${tenantId}:${userId}`;

export const buildTenantScopedKey = (baseKey: string, tenantId?: Nullable<string | number>): string => {
  const normalizedBase = typeof baseKey === 'string' && baseKey.trim() ? baseKey.trim() : baseKey;
  if (!normalizedBase) return baseKey;
  const preferredTenant = sanitizeString(tenantId) ?? getCachedTenantId();
  if (preferredTenant && preferredTenant !== 'default') {
    return `${normalizedBase}_${preferredTenant}`;
  }
  return normalizedBase;
};

export interface TenantScopedReadOptions {
  tenantId?: Nullable<string | number>;
  fallbackToBase?: boolean;
}

export interface TenantScopedWriteOptions {
  tenantId?: Nullable<string | number>;
  mirrorToBase?: boolean;
}

export const readTenantScopedArray = <T = unknown>(baseKey: string, options?: TenantScopedReadOptions): T[] | null => {
  const key = buildTenantScopedKey(baseKey, options?.tenantId);
  const parsed = parseLocalArray<T>(safeLocalStorage.getItem(key), `tenant scoped array (${key})`);
  if (parsed !== null) return parsed;
  const fallbackToBase = options?.fallbackToBase ?? true;
  if (fallbackToBase && key !== baseKey) {
    return parseLocalArray<T>(safeLocalStorage.getItem(baseKey), `tenant scoped array (${baseKey})`);
  }
  return null;
};

export const writeTenantScopedArray = <T = unknown>(baseKey: string, value: T[], options?: TenantScopedWriteOptions): void => {
  if (!Array.isArray(value)) return;
  const key = buildTenantScopedKey(baseKey, options?.tenantId);
  try {
    const serialized = JSON.stringify(value);
    safeLocalStorage.setItem(key, serialized);
    const mirrorToBase = options?.mirrorToBase ?? true;
    if (mirrorToBase && key !== baseKey) {
      safeLocalStorage.setItem(baseKey, serialized);
    }
  } catch (error) {
    logger.warn(`[storage] Failed to serialize tenant scoped array (${key})`, error);
  }
};

export const readTenantScopedValue = (baseKey: string, options?: TenantScopedReadOptions): string | null => {
  const key = buildTenantScopedKey(baseKey, options?.tenantId);
  const value = safeLocalStorage.getItem(key);
  if (value !== null) return value;
  const fallbackToBase = options?.fallbackToBase ?? true;
  if (fallbackToBase && key !== baseKey) {
    return safeLocalStorage.getItem(baseKey);
  }
  return null;
};

export const writeTenantScopedValue = (baseKey: string, value: string | number | boolean, options?: TenantScopedWriteOptions): void => {
  if (value === undefined || value === null) return;
  const key = buildTenantScopedKey(baseKey, options?.tenantId);
  try {
    const serialized = typeof value === 'string' ? value : String(value);
    safeLocalStorage.setItem(key, serialized);
    const mirrorToBase = options?.mirrorToBase ?? true;
    if (mirrorToBase && key !== baseKey) {
      safeLocalStorage.setItem(baseKey, serialized);
    }
  } catch (error) {
    logger.warn(`[storage] Failed to persist tenant scoped value (${key})`, error);
  }
};

export const readTenantScopedObject = <T extends Record<string, unknown>>(baseKey: string, options?: TenantScopedReadOptions): T | null => {
  const key = buildTenantScopedKey(baseKey, options?.tenantId);
  const parsed = parseLocalObject<T>(safeLocalStorage.getItem(key), `tenant scoped object (${key})`);
  if (parsed) return parsed;
  const fallbackToBase = options?.fallbackToBase ?? true;
  if (fallbackToBase && key !== baseKey) {
    return parseLocalObject<T>(safeLocalStorage.getItem(baseKey), `tenant scoped object (${baseKey})`);
  }
  return null;
};

export const writeTenantScopedObject = <T extends Record<string, unknown>>(baseKey: string, value: T, options?: TenantScopedWriteOptions): void => {
  if (!value || typeof value !== 'object') return;
  const key = buildTenantScopedKey(baseKey, options?.tenantId);
  try {
    const serialized = JSON.stringify(value);
    safeLocalStorage.setItem(key, serialized);
    const mirrorToBase = options?.mirrorToBase ?? true;
    if (mirrorToBase && key !== baseKey) {
      safeLocalStorage.setItem(baseKey, serialized);
    }
  } catch (error) {
    logger.warn(`[storage] Failed to persist tenant scoped object (${key})`, error);
  }
};

const uniqueStrings = (values: Array<Nullable<string>>): string[] => {
  const set = new Set<string>();
  values.forEach(value => {
    const normalized = sanitizeString(value ?? null);
    if (normalized) set.add(normalized);
  });
  return Array.from(set.values());
};

export interface NotificationPrefsScopeOptions {
  tenantIds?: string[];
  userIds?: string[];
  includeDefaultTenant?: boolean;
}

export const deriveNotificationPrefKeys = (options?: NotificationPrefsScopeOptions): string[] => {
  const includeDefaultTenant = options?.includeDefaultTenant ?? true;
  const tenantCandidates = options?.tenantIds?.length ? options.tenantIds : [getCachedTenantId()];
  const tenants = includeDefaultTenant
    ? uniqueStrings([...tenantCandidates, 'default'])
    : uniqueStrings(tenantCandidates);
  const userCandidates = options?.userIds?.length ? options.userIds : [getCachedUserId()];
  const users = uniqueStrings(userCandidates.length ? userCandidates : ['anon']);

  const keys: string[] = [];
  tenants.forEach(tenantId => {
    users.forEach(userId => {
      keys.push(buildNotificationPrefsKey(tenantId, userId));
    });
  });
  return keys;
};

export const readNotificationPrefsCache = <T extends Record<string, unknown>>(options?: NotificationPrefsScopeOptions): T | null => {
  const keys = deriveNotificationPrefKeys(options);
  for (const key of keys) {
    const parsed = parseLocalObject<T>(safeLocalStorage.getItem(key), `notification preferences cache (${key})`);
    if (parsed) return parsed;
  }
  return null;
};

export const writeNotificationPrefsCache = <T extends Record<string, unknown>>(prefs: T, options?: NotificationPrefsScopeOptions): void => {
  if (!prefs) return;
  const keys = deriveNotificationPrefKeys(options);
  keys.forEach(key => {
    try {
      safeLocalStorage.setItem(key, JSON.stringify(prefs));
    } catch (error) {
      logger.warn(`[storage] Failed to persist notification preferences to ${key}`, error);
    }
  });
};

const LEGACY_AUTH_TOKEN_KEY = 'auth_token';
const LEGACY_TENANT_ID_KEY = 'tenantId';
const LEGACY_USER_CACHE_KEY = 'user';
const LEGACY_TENANT_CACHE_KEY = 'tenant';

export const readLegacyAuthToken = (): string | null => {
  return safeLocalStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
};

export const writeLegacyAuthToken = (token: Nullable<string>): void => {
  if (!token) {
    safeLocalStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    return;
  }
  safeLocalStorage.setItem(LEGACY_AUTH_TOKEN_KEY, token);
};

export const readLegacyTenantId = (): string | null => {
  return sanitizeString(safeLocalStorage.getItem(LEGACY_TENANT_ID_KEY));
};

export const writeLegacyTenantId = (tenantId: Nullable<string | number>): void => {
  const normalized = sanitizeString(tenantId ?? null);
  if (!normalized) {
    safeLocalStorage.removeItem(LEGACY_TENANT_ID_KEY);
    return;
  }
  safeLocalStorage.setItem(LEGACY_TENANT_ID_KEY, normalized);
};

export const readLegacyUserProfile = <T extends Record<string, unknown> = Record<string, unknown>>(): T | null => {
  return parseLocalObject<T>(safeLocalStorage.getItem(LEGACY_USER_CACHE_KEY), 'legacy user cache');
};

export const writeLegacyUserProfile = <T extends Record<string, unknown>>(value: Nullable<T>): void => {
  if (!value) {
    safeLocalStorage.removeItem(LEGACY_USER_CACHE_KEY);
    return;
  }
  try {
    safeLocalStorage.setItem(LEGACY_USER_CACHE_KEY, JSON.stringify(value));
  } catch (error) {
    logger.warn('[storage] Failed to persist legacy user profile', error);
  }
};

export const readLegacyTenantProfile = <T extends Record<string, unknown> = Record<string, unknown>>(): T | null => {
  return parseLocalObject<T>(safeLocalStorage.getItem(LEGACY_TENANT_CACHE_KEY), 'legacy tenant cache');
};

export const writeLegacyTenantProfile = <T extends Record<string, unknown>>(value: Nullable<T>): void => {
  if (!value) {
    safeLocalStorage.removeItem(LEGACY_TENANT_CACHE_KEY);
    return;
  }
  try {
    safeLocalStorage.setItem(LEGACY_TENANT_CACHE_KEY, JSON.stringify(value));
  } catch (error) {
    logger.warn('[storage] Failed to persist legacy tenant profile', error);
  }
};

const LEGACY_SESSION_KEYS = [
  LEGACY_AUTH_TOKEN_KEY,
  LEGACY_USER_CACHE_KEY,
  LEGACY_TENANT_CACHE_KEY,
  LEGACY_TENANT_ID_KEY,
];

export const clearLegacySessionCaches = (): void => {
  LEGACY_SESSION_KEYS.forEach(key => {
    try {
      safeLocalStorage.removeItem(key);
    } catch (error) {
      logger.warn(`[storage] Failed to remove legacy session key ${key}`, error);
    }
  });
};

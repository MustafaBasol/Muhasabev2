import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import { safeLocalStorage, readTenantScopedArray, writeTenantScopedArray } from '../utils/localStorageSafe';

export type ListType = 'invoices' | 'expenses' | 'sales' | 'customers' | 'products' | 'suppliers' | 'quotes';

export interface SavedListView<State = unknown> {
  id: string;
  name: string;
  state: State;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  isDefault?: boolean;
}

interface UseSavedListViewsOptions<State> {
  listType: ListType;
  initialState?: State;
}

const nowISO = () => new Date().toISOString();

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
};

const toSafeString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const normalizeSavedView = <State>(candidate: unknown, fallbackState: State | undefined): SavedListView<State> | null => {
  if (!isPlainObject(candidate)) return null;
  const id = toSafeString(candidate.id).trim();
  if (!id) return null;
  const name = toSafeString(candidate.name).trim() || 'Görünüm';
  const createdAt = toSafeString(candidate.createdAt) || nowISO();
  const updatedAt = toSafeString(candidate.updatedAt) || createdAt;
  const state = (candidate.state as State) ?? fallbackState ?? ({} as State);
  const isDefault = typeof candidate.isDefault === 'boolean' ? candidate.isDefault : undefined;
  return { id, name, state, createdAt, updatedAt, isDefault };
};

const normalizeSavedViewsArray = <State>(entries: unknown, fallbackState: State | undefined): SavedListView<State>[] => {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => normalizeSavedView<State>(entry, fallbackState))
    .filter((view): view is SavedListView<State> => Boolean(view));
};

const parseSavedViews = <State>(raw: string | null, fallbackState: State | undefined): SavedListView<State>[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return normalizeSavedViewsArray<State>(parsed, fallbackState);
  } catch (error) {
    logger.warn('[useSavedListViews] Failed to parse localStorage snapshot', error);
    return [];
  }
};

const resolveTenantId = (tenant: { id?: string | null } | null | undefined): string => {
  if (!tenant) return '';
  if (tenant.id) return String(tenant.id);
  const legacyTenantId = (tenant as { tenantId?: string | null })?.tenantId;
  return legacyTenantId ? String(legacyTenantId) : '';
};

export function useSavedListViews<State = unknown>({ listType, initialState }: UseSavedListViewsOptions<State>) {
  const { tenant } = useAuth();
  const tenantId = resolveTenantId(tenant);
  const tenantScopedId = tenantId || 'anon';
  const baseStorageKey = useMemo(() => `saved_lv_${listType}`, [listType]);
  const legacyStorageKey = useMemo(() => {
    const tid = tenantScopedId || 'anon';
    return `lv_${tid}_${listType}`;
  }, [tenantScopedId, listType]);

  const [views, setViews] = useState<SavedListView<State>[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      let parsed = normalizeSavedViewsArray<State>(
        readTenantScopedArray<unknown>(baseStorageKey, { tenantId: tenantScopedId, fallbackToBase: true }) ?? [],
        initialState
      );
      let migratedFromLegacy = false;

      if (!parsed.length) {
        const legacyRaw = safeLocalStorage.getItem(legacyStorageKey);
        const legacyParsed = parseSavedViews<State>(legacyRaw, initialState);
        if (legacyParsed.length) {
          parsed = legacyParsed;
          migratedFromLegacy = true;
        }
      }

      setViews(parsed);
      const def = parsed.find(v => v.isDefault);
      if (def) {
        setActiveViewId(def.id);
      } else {
        setActiveViewId(null);
      }

      if (migratedFromLegacy && parsed.length) {
        writeTenantScopedArray(baseStorageKey, parsed, { tenantId: tenantScopedId, mirrorToBase: true });
        safeLocalStorage.removeItem(legacyStorageKey);
      }
    } catch (error) {
      logger.warn('[useSavedListViews] Unable to read from localStorage', error);
      setViews([]);
      setActiveViewId(null);
    }
  }, [baseStorageKey, tenantScopedId, initialState, legacyStorageKey]);

  const persist = useCallback((next: SavedListView<State>[]) => {
    setViews(next);
    writeTenantScopedArray(baseStorageKey, next, { tenantId: tenantScopedId, mirrorToBase: true });
  }, [baseStorageKey, tenantScopedId]);

  const saveCurrent = useCallback((name: string, state: State) => {
    const timestamp = nowISO();
    const id = crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    const view: SavedListView<State> = { id, name: name.trim() || 'Görünüm', state, createdAt: timestamp, updatedAt: timestamp };
    const next = [view, ...views];
    persist(next);
    setActiveViewId(id);
    return view;
  }, [views, persist]);

  const updateView = useCallback((id: string, patch: Partial<SavedListView<State>>) => {
    const next = views.map(v => v.id === id ? { ...v, ...patch, updatedAt: nowISO() } : v);
    persist(next);
  }, [views, persist]);

  const deleteView = useCallback((id: string) => {
    const next = views.filter(v => v.id !== id);
    // If deleted was default, clear default
    persist(next);
    if (activeViewId === id) setActiveViewId(null);
  }, [views, persist, activeViewId]);

  const setDefault = useCallback((id: string | null) => {
    const next = views.map(v => ({ ...v, isDefault: id ? v.id === id : false, updatedAt: nowISO() }));
    persist(next);
    setActiveViewId(id);
  }, [views, persist]);

  const renameView = useCallback((id: string, name: string) => updateView(id, { name }), [updateView]);

  const getDefault = useCallback(() => views.find(v => v.isDefault) || null, [views]);

  const clearAll = useCallback(() => {
    persist([]);
    setActiveViewId(null);
  }, [persist]);

  return {
    views,
    activeViewId,
    setActiveViewId,
    saveCurrent,
    updateView,
    deleteView,
    setDefault,
    renameView,
    getDefault,
    clearAll,
  } as const;
}

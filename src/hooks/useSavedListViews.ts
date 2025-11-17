import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export type ListType = 'invoices' | 'expenses' | 'sales' | 'customers' | 'products' | 'suppliers' | 'quotes';

export interface SavedListView<State = any> {
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

export function useSavedListViews<State = any>({ listType, initialState }: UseSavedListViewsOptions<State>) {
  const { tenant } = useAuth();
  const tenantId = String((tenant as any)?.id || (tenant as any)?.tenantId || '');
  const storageKey = useMemo(() => {
    const tid = tenantId || 'anon';
    return `lv_${tid}_${listType}`;
  }, [tenantId, listType]);

  const [views, setViews] = useState<SavedListView<State>[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) as SavedListView<State>[] : [];
      setViews(Array.isArray(parsed) ? parsed : []);
      const def = (parsed || []).find(v => v.isDefault);
      if (def) {
        setActiveViewId(def.id);
      } else {
        setActiveViewId(null);
      }
    } catch {
      setViews([]);
      setActiveViewId(null);
    }
  }, [storageKey]);

  const persist = useCallback((next: SavedListView<State>[]) => {
    setViews(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  }, [storageKey]);

  const saveCurrent = useCallback((name: string, state: State) => {
    const id = crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    const view: SavedListView<State> = { id, name: name.trim() || 'Görünüm', state, createdAt: nowISO(), updatedAt: nowISO() };
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
    persist(next.map(v => v));
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

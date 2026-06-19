'use client';

import { getPreferences, updatePreferences, type Preferences } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type ComponentTab = 'warehouse' | 'params' | 'eco';
export const COMPONENT_TABS: { key: ComponentTab; label: string }[] = [
  { key: 'warehouse', label: 'Ubicazioni' },
  { key: 'params', label: 'Parametri' },
  { key: 'eco', label: 'Economia' },
];

/** Every column the components table can show; the order here is the default. */
export const COMPONENT_COLUMNS: { key: string; label: string }[] = [
  { key: 'internalCode', label: 'Codice' },
  { key: 'name', label: 'Nome' },
  { key: 'category', label: 'Categoria' },
  { key: 'mpn', label: 'MPN' },
  { key: 'manufacturer', label: 'Produttore' },
  { key: 'value', label: 'Valore' },
  { key: 'footprint', label: 'Footprint' },
];
const COLUMN_KEYS = COMPONENT_COLUMNS.map((c) => c.key);

export interface AppPrefs {
  /** Which tab opens first on a component card. */
  defaultComponentTab: ComponentTab;
  /** Visible columns of the components list, in display order. */
  componentColumns: string[];
  /** Rows fetched per page in the components list. */
  pageSize: number;
}

export const DEFAULT_PREFS: AppPrefs = {
  defaultComponentTab: 'warehouse',
  componentColumns: ['internalCode', 'name', 'category', 'mpn', 'value', 'footprint'],
  pageSize: 50,
};

/** Coerce the loosely-typed uiState blob into a valid AppPrefs (with defaults). */
export function parsePrefs(ui: Record<string, unknown> | undefined): AppPrefs {
  const u = ui ?? {};
  const tab = COMPONENT_TABS.some((t) => t.key === u.defaultComponentTab)
    ? (u.defaultComponentTab as ComponentTab)
    : DEFAULT_PREFS.defaultComponentTab;
  const cols = Array.isArray(u.componentColumns)
    ? (u.componentColumns as unknown[]).filter((k): k is string => typeof k === 'string' && COLUMN_KEYS.includes(k))
    : [];
  const ps = Number(u.pageSize);
  return {
    defaultComponentTab: tab,
    componentColumns: cols.length ? cols : DEFAULT_PREFS.componentColumns,
    pageSize: Number.isFinite(ps) && ps > 0 ? Math.min(Math.floor(ps), 200) : DEFAULT_PREFS.pageSize,
  };
}

/** Read the current user's app preferences (durable, server-side). */
export function usePrefs(): AppPrefs {
  const { data } = useQuery({ queryKey: ['preferences'], queryFn: getPreferences, staleTime: 60_000 });
  return parsePrefs(data?.uiState);
}

/** Mutation that persists a partial preferences patch (merged server-side). */
export function useUpdatePrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AppPrefs>) => updatePreferences({ uiState: patch as Record<string, unknown> }),
    onSuccess: (data: Preferences) => {
      qc.setQueryData(['preferences'], data);
      qc.invalidateQueries({ queryKey: ['preferences'] });
    },
  });
}

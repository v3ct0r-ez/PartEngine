'use client';

import { getPreferences, updatePreferences, type Preferences } from '@/lib/api';
import { DEFAULT_LABEL_PREFS, type LabelPrefs } from '@/lib/label';
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
  { key: 'stock', label: 'Q.tà magazzino' },
];
const COLUMN_KEYS = COMPONENT_COLUMNS.map((c) => c.key);

export interface AppPrefs {
  /** Which tab opens first on a component card. */
  defaultComponentTab: ComponentTab;
  /** Visible columns of the components list, in display order. */
  componentColumns: string[];
  /** Rows fetched per page in the components list. */
  pageSize: number;
  /** Print-label styling (size, QR, printed values). */
  label: LabelPrefs;
}

export const DEFAULT_PREFS: AppPrefs = {
  defaultComponentTab: 'warehouse',
  componentColumns: ['internalCode', 'name', 'category', 'mpn', 'value', 'footprint'],
  pageSize: 50,
  label: DEFAULT_LABEL_PREFS,
};

/** Coerce a loosely-typed blob into valid LabelPrefs (with defaults). */
export function parseLabelPrefs(v: unknown): LabelPrefs {
  const d = DEFAULT_LABEL_PREFS;
  if (typeof v !== 'object' || v === null) return d;
  const o = v as Record<string, unknown>;
  const num = (x: unknown, def: number, min: number, max: number) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def;
  };
  const bool = (x: unknown, def: boolean) => (typeof x === 'boolean' ? x : def);
  return {
    widthMm: num(o.widthMm, d.widthMm, 20, 120),
    heightMm: num(o.heightMm, d.heightMm, 15, 120),
    marginMm: num(o.marginMm, d.marginMm, 0, 10),
    qrEnabled: bool(o.qrEnabled, d.qrEnabled),
    qrPosition: o.qrPosition === 'right' ? 'right' : 'left',
    qrSizeMm: num(o.qrSizeMm, d.qrSizeMm, 8, 120),
    qrEcLevel: o.qrEcLevel === 'L' || o.qrEcLevel === 'M' || o.qrEcLevel === 'Q' || o.qrEcLevel === 'H' ? o.qrEcLevel : d.qrEcLevel,
    qrMarginModules: Math.round(num(o.qrMarginModules, d.qrMarginModules, 0, 8)),
    qrColor: typeof o.qrColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.qrColor) ? o.qrColor : d.qrColor,
    showCode: bool(o.showCode, d.showCode),
    showName: bool(o.showName, d.showName),
    logoInQr: bool(o.logoInQr, d.logoInQr),
    qrLogoScale: num(o.qrLogoScale, d.qrLogoScale, 10, 40),
    gapMm: num(o.gapMm, d.gapMm, 0, 20),
    textAlign: o.textAlign === 'center' || o.textAlign === 'right' ? o.textAlign : 'left',
    textColor: typeof o.textColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.textColor) ? o.textColor : d.textColor,
    codeFontMm: num(o.codeFontMm, d.codeFontMm, 1.2, 12),
    nameFontMm: num(o.nameFontMm, d.nameFontMm, 1, 12),
    nameAutoFit: bool(o.nameAutoFit, d.nameAutoFit),
    border: bool(o.border, d.border),
  };
}

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
    label: parseLabelPrefs(u.label),
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

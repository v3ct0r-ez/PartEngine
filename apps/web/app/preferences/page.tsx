'use client';

import { useTheme } from '@/components/theme';
import type { ThemePref } from '@/lib/api';
import {
  COMPONENT_COLUMNS,
  COMPONENT_TABS,
  usePrefs,
  useUpdatePrefs,
  type ComponentTab,
} from '@/lib/preferences';
import { useEffect, useState } from 'react';

const card = 'space-y-4 rounded-lg border border-border p-5';
const inp = 'rounded border border-border bg-background px-2 py-1.5 text-sm';
const colLabel = (k: string) => COMPONENT_COLUMNS.find((c) => c.key === k)?.label ?? k;

export default function PreferencesPage() {
  const prefs = usePrefs();
  const update = useUpdatePrefs();
  const [theme, setTheme] = useTheme();

  // Working copy for the column editor; (re)seeded from the saved prefs until
  // the user starts editing, so it picks up the real values once they load.
  const [order, setOrder] = useState<string[]>([]);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const colsKey = prefs.componentColumns.join(',');
  useEffect(() => {
    if (dirty) return;
    const vis = prefs.componentColumns;
    const hidden = COMPONENT_COLUMNS.map((c) => c.key).filter((k) => !vis.includes(k));
    setOrder([...vis, ...hidden]);
    setVisible(Object.fromEntries(COMPONENT_COLUMNS.map((c) => [c.key, vis.includes(c.key)])));
  }, [colsKey, dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  function persistColumns(nextOrder: string[], nextVisible: Record<string, boolean>) {
    const cols = nextOrder.filter((k) => nextVisible[k]);
    if (cols.length === 0) return; // never hide every column
    update.mutate({ componentColumns: cols });
  }
  function move(key: string, dir: -1 | 1) {
    const i = order.indexOf(key);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setDirty(true);
    setOrder(next);
    persistColumns(next, visible);
  }
  function toggle(key: string) {
    const next = { ...visible, [key]: !visible[key] };
    setDirty(true);
    setVisible(next);
    persistColumns(order, next);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Preferenze</h1>

      <section className={card}>
        <h2 className="font-semibold">Aspetto</h2>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Tema</span>
          <select className={inp} value={theme} onChange={(e) => setTheme(e.target.value as ThemePref)}>
            <option value="system">Sistema</option>
            <option value="light">Chiaro</option>
            <option value="dark">Scuro</option>
          </select>
        </label>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Scheda componente</h2>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Tab mostrata per prima</span>
          <select
            className={inp}
            value={prefs.defaultComponentTab}
            onChange={(e) => update.mutate({ defaultComponentTab: e.target.value as ComponentTab })}
          >
            {COMPONENT_TABS.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </label>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Elenco componenti</h2>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Righe per pagina</span>
          <input
            type="number"
            min={10}
            max={200}
            className={`${inp} w-24`}
            defaultValue={prefs.pageSize}
            key={`ps-${prefs.pageSize}`}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) update.mutate({ pageSize: n });
            }}
          />
        </label>

        <div>
          <p className="mb-2 text-sm text-muted-foreground">Colonne visibili e ordine</p>
          <ul className="divide-y divide-border rounded border border-border">
            {order.map((k, i) => (
              <li key={k} className="flex items-center gap-3 px-3 py-2 text-sm">
                <input type="checkbox" checked={!!visible[k]} onChange={() => toggle(k)} className="h-4 w-4" />
                <span className="flex-1">{colLabel(k)}</span>
                <button onClick={() => move(k, -1)} disabled={i === 0} className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Su">▲</button>
                <button onClick={() => move(k, 1)} disabled={i === order.length - 1} className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Giù">▼</button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {update.isError && <p className="text-sm text-red-500">Salvataggio non riuscito. Riprova.</p>}
      <p className="text-xs text-muted-foreground">
        Le preferenze sono salvate sul tuo profilo e si applicano automaticamente.
      </p>
    </div>
  );
}

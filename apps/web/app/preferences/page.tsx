'use client';

import { useTheme } from '@/components/theme';
import type { ThemePref } from '@/lib/api';
import { buildLabelHtml, type LabelPrefs } from '@/lib/label';
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

      <LabelPrefsSection />

      {update.isError && <p className="text-sm text-red-500">Salvataggio non riuscito. Riprova.</p>}
      <p className="text-xs text-muted-foreground">
        Le preferenze sono salvate sul tuo profilo e si applicano automaticamente.
      </p>
    </div>
  );
}

const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: '50 × 30 mm', w: 50, h: 30 },
  { label: '40 × 30 mm', w: 40, h: 30 },
  { label: '60 × 40 mm', w: 60, h: 40 },
  { label: '100 × 50 mm', w: 100, h: 50 },
];

/** Print-label customisation: size, QR position/size, which values to print. */
function LabelPrefsSection() {
  const prefs = usePrefs();
  const update = useUpdatePrefs();

  // Working copy, (re)seeded from saved prefs until the user starts editing.
  const [lab, setLab] = useState<LabelPrefs>(prefs.label);
  const [dirty, setDirty] = useState(false);
  const savedKey = JSON.stringify(prefs.label);
  useEffect(() => {
    if (!dirty) setLab(prefs.label);
  }, [savedKey, dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(patch: Partial<LabelPrefs>) {
    const next = { ...lab, ...patch };
    setDirty(true);
    setLab(next);
    update.mutate({ label: next });
  }

  // Live preview of a representative QR label.
  const [html, setHtml] = useState<string | null>(null);
  const labKey = JSON.stringify(lab);
  useEffect(() => {
    let alive = true;
    buildLabelHtml({ code: 'R-0001', name: 'Resistenza 10kΩ 0603', qr: true }, lab).then((h) => { if (alive) setHtml(h); });
    return () => { alive = false; };
  }, [labKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const presetValue = SIZE_PRESETS.find((p) => p.w === lab.widthMm && p.h === lab.heightMm)?.label ?? 'custom';
  const scale = Math.min(3, 150 / lab.widthMm);

  return (
    <section className={card}>
      <h2 className="font-semibold">Etichette di stampa</h2>

      {/* Dimensione */}
      <div className="space-y-2">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Dimensione</span>
          <select
            className={inp}
            value={presetValue}
            onChange={(e) => {
              const p = SIZE_PRESETS.find((x) => x.label === e.target.value);
              if (p) set({ widthMm: p.w, heightMm: p.h });
            }}
          >
            {SIZE_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
            <option value="custom">Personalizzata…</option>
          </select>
        </label>
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-xs text-muted-foreground">Larghezza</span>
          <input type="number" min={20} max={120} className={`${inp} w-20`} value={lab.widthMm}
            onChange={(e) => set({ widthMm: Number(e.target.value) || lab.widthMm })} />
          <span className="text-xs text-muted-foreground">× Altezza</span>
          <input type="number" min={15} max={120} className={`${inp} w-20`} value={lab.heightMm}
            onChange={(e) => set({ heightMm: Number(e.target.value) || lab.heightMm })} />
          <span className="text-xs text-muted-foreground">mm</span>
        </div>
      </div>

      {/* Margine interno */}
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Margine (mm)</span>
        <input type="number" min={0} max={10} step={0.5} className={`${inp} w-24`} value={lab.marginMm}
          onChange={(e) => {
            const m = Number(e.target.value);
            set({ marginMm: Number.isFinite(m) ? m : lab.marginMm });
          }} />
      </label>

      {/* QR */}
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Mostra QR</span>
        <input type="checkbox" checked={lab.qrEnabled} onChange={(e) => set({ qrEnabled: e.target.checked })} className="h-4 w-4" />
      </label>
      {/* QR sub-options appear only when the QR is enabled (no disabled/dimmed rows). */}
      {lab.qrEnabled && (
        <>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Posizione QR</span>
            <select className={inp} value={lab.qrPosition}
              onChange={(e) => set({ qrPosition: e.target.value as 'left' | 'right' })}>
              <option value="left">Sinistra</option>
              <option value="right">Destra</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Dimensione QR (mm)</span>
            <input type="number" min={8} max={Math.round(lab.heightMm - 2 * lab.marginMm)} className={`${inp} w-24`} value={lab.qrSizeMm}
              onChange={(e) => set({ qrSizeMm: Number(e.target.value) || lab.qrSizeMm })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Logo nel QR</span>
            <input type="checkbox" checked={lab.logoInQr} onChange={(e) => set({ logoInQr: e.target.checked })} className="h-4 w-4" />
          </label>
        </>
      )}

      {/* Valori stampati */}
      <div>
        <p className="mb-2 text-sm text-muted-foreground">Valori stampati</p>
        <div className="space-y-2 rounded border border-border p-3">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={lab.showCode} onChange={(e) => set({ showCode: e.target.checked })} className="h-4 w-4" />
            <span>Codice</span>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={lab.showName} onChange={(e) => set({ showName: e.target.checked })} className="h-4 w-4" />
            <span>Nome</span>
          </label>
        </div>
      </div>

      {/* Live preview */}
      <div>
        <p className="mb-2 text-sm text-muted-foreground">Anteprima</p>
        <div className="flex justify-center rounded border border-border bg-white p-4">
          <div style={{ width: `calc(${lab.widthMm}mm * ${scale})`, height: `calc(${lab.heightMm}mm * ${scale})` }}>
            {html && (
              <iframe
                title="Anteprima etichetta"
                srcDoc={html}
                scrolling="no"
                className="border border-border bg-white"
                style={{ width: `${lab.widthMm}mm`, height: `${lab.heightMm}mm`, transform: `scale(${scale})`, transformOrigin: 'top left' }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

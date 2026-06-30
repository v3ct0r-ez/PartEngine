'use client';

import { Icon } from '@/components/icons';
import { downloadReport, getDashboard } from '@/lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

type Accent = 'primary' | 'emerald' | 'amber' | 'red' | 'violet' | 'sky';
const ACCENT: Record<Accent, { box: string; value?: string }> = {
  primary: { box: 'bg-primary/10 text-primary' },
  emerald: { box: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  violet: { box: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  sky: { box: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  amber: { box: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', value: 'text-amber-600 dark:text-amber-400' },
  red: { box: 'bg-red-500/10 text-red-600 dark:text-red-400', value: 'text-red-600 dark:text-red-400' },
};

export default function DashboardPage() {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });
  const dl = useMutation({
    mutationFn: ({ name, file }: { name: 'inventory' | 'value' | 'movements'; file: string }) =>
      downloadReport(name, file),
  });

  const lowStock = data?.lowStock ?? 0;
  const outOfStock = data?.outOfStock ?? 0;

  const kpis: Array<{ label: string; value: ReactNode; icon: string; accent: Accent; warn?: boolean }> = [
    { label: 'Componenti totali', value: data?.totalComponents ?? '—', icon: 'components', accent: 'primary' },
    { label: 'Valore magazzino', value: data ? `${data.stockValue.toLocaleString('it-IT')} ${data.currency}` : '—', icon: 'value', accent: 'emerald' },
    { label: 'Sotto scorta', value: data?.lowStock ?? '—', icon: 'lowStock', accent: lowStock > 0 ? 'amber' : 'primary', warn: lowStock > 0 },
    { label: 'Esauriti', value: data?.outOfStock ?? '—', icon: 'outOfStock', accent: outOfStock > 0 ? 'red' : 'primary', warn: outOfStock > 0 },
    { label: 'Fornitori', value: data?.totalSuppliers ?? '—', icon: 'suppliers', accent: 'violet' },
    { label: 'Movimenti (30gg)', value: data?.movements30d ?? '—', icon: 'movements', accent: 'sky' },
  ];

  const total = data?.byCategory?.reduce((s, c) => s + c.count, 0) ?? 0;
  const maxCat = Math.max(1, ...(data?.byCategory ?? []).map((c) => c.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          {([
            { name: 'inventory', file: 'inventario.csv', label: 'Inventario' },
            { name: 'value', file: 'valore-magazzino.csv', label: 'Valore' },
            { name: 'movements', file: 'movimenti.csv', label: 'Movimenti' },
          ] as const).map((r) => (
            <button
              key={r.name}
              onClick={() => dl.mutate({ name: r.name, file: r.file })}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon name="download" size={16} />
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {kpis.map((k) => {
          const a = ACCENT[k.accent];
          return (
            <div
              key={k.label}
              className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.box}`}><Icon name={k.icon} size={20} /></span>
              </div>
              <div className={`mt-3 text-2xl font-bold tabular-nums ${k.warn ? a.value : ''}`}>{k.value}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-semibold">Distribuzione per categoria</h2>
          {total > 0 && <span className="text-xs text-muted-foreground">{total.toLocaleString('it-IT')} componenti</span>}
        </div>
        <div className="space-y-2.5">
          {(data?.byCategory ?? []).map((c) => {
            const pct = total ? Math.round((c.count / total) * 100) : 0;
            return (
              <div key={c.category} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate" title={c.category}>{c.category}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted">
                  <div
                    className="flex h-5 items-center justify-end rounded-md bg-gradient-to-r from-primary/70 to-primary px-2 transition-all duration-500"
                    style={{ width: `${Math.max((c.count / maxCat) * 100, 6)}%` }}
                  >
                    <span className="text-[10px] font-medium text-primary-foreground/90">{pct}%</span>
                  </div>
                </div>
                <span className="w-10 text-right tabular-nums text-muted-foreground">{c.count}</span>
              </div>
            );
          })}
          {data && data.byCategory.length === 0 && <p className="text-sm text-muted-foreground">Nessun componente.</p>}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Vai a <a className="text-primary underline" href="/components">Componenti</a> per cercare, creare, scansionare e gestire il magazzino.
      </p>
      {dl.isError && <p className="text-sm text-red-500">{(dl.error as Error).message}</p>}
    </div>
  );
}

'use client';

import { downloadReport, getDashboard } from '@/lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';

export default function DashboardPage() {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });
  const dl = useMutation({
    mutationFn: ({ name, file }: { name: 'inventory' | 'value' | 'movements'; file: string }) =>
      downloadReport(name, file),
  });

  const kpis = [
    { label: 'Componenti totali', value: data?.totalComponents ?? '—' },
    { label: 'Valore magazzino', value: data ? `${data.stockValue.toLocaleString('it-IT')} ${data.currency}` : '—' },
    { label: 'Sotto scorta', value: data?.lowStock ?? '—', warn: (data?.lowStock ?? 0) > 0 },
    { label: 'Esauriti', value: data?.outOfStock ?? '—', warn: (data?.outOfStock ?? 0) > 0 },
    { label: 'Fornitori', value: data?.totalSuppliers ?? '—' },
    { label: 'Movimenti (30gg)', value: data?.movements30d ?? '—' },
  ];

  const maxCat = Math.max(1, ...(data?.byCategory ?? []).map((c) => c.count));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <button onClick={() => dl.mutate({ name: 'inventory', file: 'inventario.csv' })} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Export inventario</button>
          <button onClick={() => dl.mutate({ name: 'value', file: 'valore-magazzino.csv' })} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Export valore</button>
          <button onClick={() => dl.mutate({ name: 'movements', file: 'movimenti.csv' })} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Export movimenti</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-border p-4">
            <div className="text-xs uppercase text-muted-foreground">{k.label}</div>
            <div className={`mt-2 text-2xl font-bold ${k.warn ? 'text-amber-600' : ''}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="mb-3 font-semibold">Distribuzione per categoria</h2>
        <div className="space-y-2">
          {(data?.byCategory ?? []).map((c) => (
            <div key={c.category} className="flex items-center gap-3 text-sm">
              <span className="w-40 shrink-0 truncate">{c.category}</span>
              <div className="h-4 flex-1 rounded bg-muted">
                <div className="h-4 rounded bg-primary" style={{ width: `${(c.count / maxCat) * 100}%` }} />
              </div>
              <span className="w-10 text-right text-muted-foreground">{c.count}</span>
            </div>
          ))}
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

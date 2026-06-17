'use client';

import { ComponentSearch } from '@/components/component-search';
import {
  buildKit,
  createKit,
  getKit,
  listKits,
  listWarehouses,
  type ComponentRow,
} from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const inp = 'rounded border border-border bg-background px-2 py-1.5 text-sm';

export default function KitsPage() {
  const qc = useQueryClient();
  const { data: kits = [] } = useQuery({ queryKey: ['kits'], queryFn: listKits });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // create kit
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [lines, setLines] = useState<{ component: ComponentRow; quantity: number }[]>([]);
  const create = useMutation({
    mutationFn: () =>
      createKit({ code, name, lines: lines.map((l) => ({ componentId: l.component.id, quantity: l.quantity })) }),
    onSuccess: (k) => {
      setCode(''); setName(''); setLines([]);
      qc.invalidateQueries({ queryKey: ['kits'] });
      setSelectedId(k.id);
    },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Kit & assemblaggi</h1>

      <form
        onSubmit={(e) => { e.preventDefault(); if (code && name && lines.length) create.mutate(); }}
        className="space-y-3 rounded-lg border border-border p-4"
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Codice</span>
            <input className={inp} value={code} onChange={(e) => setCode(e.target.value)} placeholder="KIT-001" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Nome</span>
            <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kit riparazione" /></label>
        </div>
        <div className="max-w-md">
          <span className="text-xs text-muted-foreground">Aggiungi componente</span>
          <ComponentSearch onPick={(c) => setLines((ls) => ls.some((l) => l.component.id === c.id) ? ls : [...ls, { component: c, quantity: 1 }])} />
        </div>
        {lines.length > 0 && (
          <table className="w-full max-w-2xl text-sm">
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.component.id} className="border-t border-border">
                  <td className="py-1"><span className="font-mono text-xs">{l.component.internalCode}</span> {l.component.name}</td>
                  <td className="py-1 w-24"><input type="number" className={`${inp} w-20`} value={l.quantity}
                    onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} /></td>
                  <td className="py-1 text-right"><button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">rimuovi</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button type="submit" disabled={!code || !name || lines.length === 0 || create.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">+ Crea kit</button>
        {create.isError && <span className="ml-3 text-xs text-red-500">{(create.error as Error).message}</span>}
      </form>

      <div className="flex gap-6">
        <ul className="w-64 shrink-0 space-y-0.5 border-r border-border pr-3 text-sm">
          {kits.map((k) => (
            <li key={k.id}>
              <button onClick={() => setSelectedId(k.id)}
                className={`w-full rounded px-2 py-1.5 text-left hover:bg-muted ${selectedId === k.id ? 'bg-muted font-medium' : ''}`}>
                <span className="font-mono text-xs">{k.code}</span> · {k.name}
              </button>
            </li>
          ))}
          {kits.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">Nessun kit.</li>}
        </ul>
        <div className="flex-1">
          {selectedId ? <KitDetailView id={selectedId} /> : <p className="text-sm text-muted-foreground">Seleziona o crea un kit.</p>}
        </div>
      </div>
    </div>
  );
}

function KitDetailView({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: kit } = useQuery({ queryKey: ['kit', id], queryFn: () => getKit(id) });
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });
  const [whId, setWhId] = useState('');
  const wh = warehouses.find((w) => w.id === whId) ?? warehouses[0];
  const [locId, setLocId] = useState('');
  const [qty, setQty] = useState('1');

  const build = useMutation({
    mutationFn: () => buildKit(id, { locationId: locId, quantity: Number(qty) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recent-movements'] });
    },
  });

  if (!kit) return null;
  const locations = wh?.locations ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold"><span className="font-mono text-sm">{kit.code}</span> — {kit.name}</h2>
      <table className="w-full max-w-2xl text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr><th className="px-3 py-2">Componente</th><th className="px-3 py-2">Qtà / kit</th></tr>
        </thead>
        <tbody>
          {kit.lines.map((l) => (
            <tr key={l.id} className="border-t border-border">
              <td className="px-3 py-2"><span className="font-mono text-xs">{l.component?.internalCode}</span> {l.component?.name}</td>
              <td className="px-3 py-2 font-mono">{l.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-2 text-sm font-semibold">Assembla (consuma i componenti)</h3>
        <div className="flex flex-wrap items-end gap-2">
          {warehouses.length > 1 && (
            <select className={inp} value={wh?.id ?? ''} onChange={(e) => setWhId(e.target.value)}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Ubicazione</span>
            <select className={inp} value={locId} onChange={(e) => setLocId(e.target.value)}>
              <option value="">—</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code} ({l.kind})</option>)}
            </select></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Quantità kit</span>
            <input type="number" className={`${inp} w-24`} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
          <button onClick={() => build.mutate()} disabled={!locId || !qty || build.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {build.isPending ? 'Assemblaggio…' : 'Assembla'}</button>
        </div>
        {build.isError && <p className="mt-2 text-xs text-red-500">{(build.error as Error).message}</p>}
        {build.isSuccess && <p className="mt-2 text-xs text-green-600">Assemblati {build.data.built} kit — stock aggiornato.</p>}
      </div>
    </div>
  );
}

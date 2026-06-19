'use client';

import { ComponentSearch } from '@/components/component-search';
import {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  listSuppliers,
  listWarehouses,
  receivePurchaseOrder,
  submitPurchaseOrder,
  type ComponentRow,
} from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const inp = 'rounded border border-border bg-background px-2 py-1.5 text-sm';
const STATUS: Record<string, string> = { DRAFT: 'Bozza', ORDERED: 'Ordinato', PARTIAL: 'Parziale', RECEIVED: 'Ricevuto', CANCELLED: 'Annullato' };

export default function OrdersPage() {
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ['orders'], queryFn: listPurchaseOrders });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<{ c: ComponentRow; quantity: number; unitPrice?: number }[]>([]);
  const create = useMutation({
    mutationFn: () => createPurchaseOrder({
      code, supplierId,
      lines: lines.map((l) => ({ componentId: l.c.id, quantity: l.quantity, unitPrice: l.unitPrice })),
    }),
    onSuccess: (po) => { setCode(''); setLines([]); qc.invalidateQueries({ queryKey: ['orders'] }); setSelectedId(po.id); },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Ordini d'acquisto</h1>

      <form onSubmit={(e) => { e.preventDefault(); if (code && supplierId && lines.length) create.mutate(); }}
        className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Codice</span>
            <input className={inp} value={code} onChange={(e) => setCode(e.target.value)} placeholder="PO-001" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Fornitore</span>
            <select className={inp} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">—</option>
              {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
        </div>
        <div className="max-w-md"><span className="text-xs text-muted-foreground">Aggiungi riga</span>
          <ComponentSearch onPick={(c) => setLines((ls) => ls.some((l) => l.c.id === c.id) ? ls : [...ls, { c, quantity: 1 }])} /></div>
        {lines.length > 0 && (
          <table className="w-full max-w-2xl text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th>Componente</th><th>Qtà</th><th>Prezzo unit.</th><th /></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.c.id} className="border-t border-border">
                  <td className="py-1"><span className="font-mono text-xs">{l.c.internalCode}</span> {l.c.name}</td>
                  <td><input type="number" className={`${inp} w-20`} value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} /></td>
                  <td><input type="number" step="0.0001" className={`${inp} w-24`} value={l.unitPrice ?? ''} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, unitPrice: e.target.value ? Number(e.target.value) : undefined } : x))} /></td>
                  <td className="text-right"><button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">rimuovi</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button type="submit" disabled={!code || !supplierId || lines.length === 0 || create.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">+ Crea ordine</button>
        {create.isError && <span className="ml-3 text-xs text-red-500">{(create.error as Error).message}</span>}
        {suppliers.data?.length === 0 && <span className="ml-3 text-xs text-muted-foreground">Crea prima un fornitore.</span>}
      </form>

      <div className="flex gap-6">
        <div className="w-72 shrink-0 space-y-0.5 border-r border-border pr-3 text-sm">
          {orders.data?.map((o) => (
            <button key={o.id} onClick={() => setSelectedId(o.id)}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-muted ${selectedId === o.id ? 'bg-muted font-medium' : ''}`}>
              <span><span className="font-mono text-xs">{o.code}</span> · {o.supplier?.name}</span>
              <span className="text-xs text-muted-foreground">{STATUS[o.status] ?? o.status}</span>
            </button>
          ))}
          {orders.data?.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Nessun ordine.</p>}
        </div>
        <div className="flex-1">
          {selectedId ? <OrderDetail id={selectedId} onChanged={() => qc.invalidateQueries({ queryKey: ['orders'] })} /> : <p className="text-sm text-muted-foreground">Seleziona o crea un ordine.</p>}
        </div>
      </div>
    </div>
  );
}

function OrderDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const qc = useQueryClient();
  const po = useQuery({ queryKey: ['order', id], queryFn: () => getPurchaseOrder(id) });
  const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });
  const [whId, setWhId] = useState('');
  const wh = warehouses.data?.find((w) => w.id === whId) ?? warehouses.data?.[0];
  const [locId, setLocId] = useState('');
  const [recv, setRecv] = useState<Record<string, string>>({});

  const refresh = () => { qc.invalidateQueries({ queryKey: ['order', id] }); onChanged(); };
  const submit = useMutation({ mutationFn: () => submitPurchaseOrder(id, locId), onSuccess: refresh });
  const receive = useMutation({
    mutationFn: () => receivePurchaseOrder(id, locId, po.data!.lines
      .map((l) => ({ lineId: l.id, quantity: Number(recv[l.id] || 0) }))
      .filter((x) => x.quantity > 0)),
    onSuccess: () => { setRecv({}); refresh(); qc.invalidateQueries({ queryKey: ['stock'] }); },
  });

  if (!po.data) return null;
  const p = po.data;
  const locations = wh?.locations ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        <span className="font-mono text-sm">{p.code}</span> — {p.supplier?.name}
        <span className="ml-3 rounded bg-muted px-2 py-0.5 text-xs">{STATUS[p.status] ?? p.status}</span>
      </h2>

      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr><th className="px-3 py-2">Componente</th><th className="px-3 py-2">Ordinati</th><th className="px-3 py-2">Ricevuti</th><th className="px-3 py-2">Prezzo</th>{(p.status === 'ORDERED' || p.status === 'PARTIAL') && <th className="px-3 py-2">Ricevi ora</th>}</tr>
        </thead>
        <tbody>
          {p.lines.map((l) => (
            <tr key={l.id} className="border-t border-border">
              <td className="px-3 py-2">{l.component ? <><span className="font-mono text-xs">{l.component.internalCode}</span> {l.component.name}</> : l.componentId}</td>
              <td className="px-3 py-2 font-mono">{Number(l.quantity)}</td>
              <td className="px-3 py-2 font-mono">{Number(l.received)}</td>
              <td className="px-3 py-2">{l.unitPrice != null ? Number(l.unitPrice) : '—'}</td>
              {(p.status === 'ORDERED' || p.status === 'PARTIAL') && (
                <td className="px-3 py-2"><input type="number" className={`${inp} w-20`} value={recv[l.id] ?? ''} onChange={(e) => setRecv((r) => ({ ...r, [l.id]: e.target.value }))} placeholder={`max ${Number(l.quantity) - Number(l.received)}`} /></td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {(p.status === 'DRAFT' || p.status === 'ORDERED' || p.status === 'PARTIAL') && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-4">
          {warehouses.data && warehouses.data.length > 1 && (
            <select className={inp} value={wh?.id ?? ''} onChange={(e) => setWhId(e.target.value)}>{warehouses.data.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
          )}
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Ubicazione (slot)</span>
            <select className={inp} value={locId} onChange={(e) => setLocId(e.target.value)}>
              <option value="">—</option>
              {/* Stock lives in slots, not the root containers — match the movements convention. */}
              {locations.filter((l) => l.parentId != null).map((l) => <option key={l.id} value={l.id}>{l.code} ({l.kind})</option>)}
            </select></label>
          {p.status === 'DRAFT' ? (
            <button onClick={() => submit.mutate()} disabled={!locId || submit.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Invia ordine</button>
          ) : (
            <button onClick={() => receive.mutate()} disabled={!locId || receive.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Registra ricezione</button>
          )}
          {(submit.isError || receive.isError) && <span className="text-xs text-red-500">{((submit.error || receive.error) as Error)?.message}</span>}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Alla ricezione lo stock aumenta e i prezzi medio/ultimo del componente vengono aggiornati.</p>
    </div>
  );
}

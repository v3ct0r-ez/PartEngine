'use client';

import {
  createMovement,
  getComponentMovements,
  getComponentStock,
  listWarehouses,
  releaseStock,
  reserveStock,
  type MovementType,
} from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const inp = 'rounded border border-border bg-background px-2 py-1.5 text-sm';
const OPS: { value: MovementType; label: string; needs: ('from' | 'to')[] }[] = [
  { value: 'INBOUND', label: 'Carico', needs: ['to'] },
  { value: 'OUTBOUND', label: 'Scarico', needs: ['from'] },
  { value: 'TRANSFER', label: 'Trasferimento', needs: ['from', 'to'] },
  { value: 'ADJUSTMENT', label: 'Correzione', needs: ['from'] },
];
const HEALTH: Record<string, string> = {
  OK: 'text-green-600', LOW: 'text-amber-600', CRITICAL: 'text-orange-600', OUT_OF_STOCK: 'text-red-600',
};
const KIND_IT: Record<string, string> = {
  zone: 'zona', shelf: 'scaffale', cabinet: 'armadio', drawer: 'cassetto', box: 'slot',
};

/** Warehouse operations for one component: stock, load/unload/transfer/adjust,
 * allocation (reserve/release) and movement history. Reused by the unified
 * components page. */
export function WarehouseOperations({ componentId }: { componentId: string }) {
  const qc = useQueryClient();
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });
  const stock = useQuery({ queryKey: ['stock', componentId], queryFn: () => getComponentStock(componentId) });
  const movements = useQuery({ queryKey: ['movements', componentId], queryFn: () => getComponentMovements(componentId) });

  const [whId, setWhId] = useState('');
  const wh = warehouses.find((w) => w.id === whId) ?? warehouses[0];
  const locations = wh?.locations ?? [];

  const [type, setType] = useState<MovementType>('INBOUND');
  const [qty, setQty] = useState('');
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const needs = OPS.find((o) => o.value === type)!.needs;

  const locLabel = (l: { code: string; kind: string }) => `${l.code} (${KIND_IT[l.kind] ?? l.kind})`;
  // Stock lives in slots, never in the root container, so loading/transferring
  // targets only slots (locations with a parent). "From" must additionally be a
  // location where the component currently has stock.
  const whLocationIds = new Set(locations.map((l) => l.id));
  const slots = locations.filter((l) => l.parentId != null);
  const toOptions = slots.map((l) => ({ id: l.id, label: locLabel(l) }));
  const fromOptions = (stock.data?.byLocation ?? [])
    .filter((b) => Number(b.quantity) > 0 && (whLocationIds.size === 0 || whLocationIds.has(b.locationId)))
    .map((b) => ({ id: b.locationId, label: `${b.locationCode} · ${b.quantity} pz` }));

  function refresh() {
    qc.invalidateQueries({ queryKey: ['stock', componentId] });
    qc.invalidateQueries({ queryKey: ['movements', componentId] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  }

  const move = useMutation({
    mutationFn: () =>
      createMovement({
        type,
        componentId,
        quantity: Number(qty),
        fromLocationId: needs.includes('from') ? fromLoc : undefined,
        toLocationId: needs.includes('to') ? toLoc : undefined,
        reason: reason || undefined,
        reference: reference || undefined,
      }),
    onSuccess: () => { setQty(''); setReason(''); setReference(''); refresh(); },
  });

  const [allocLoc, setAllocLoc] = useState('');
  const [allocQty, setAllocQty] = useState('');
  const reserve = useMutation({
    mutationFn: () => reserveStock({ componentId, locationId: allocLoc, quantity: Number(allocQty) }),
    onSuccess: refresh,
  });
  const release = useMutation({
    mutationFn: () => releaseStock({ componentId, locationId: allocLoc, quantity: Number(allocQty) }),
    onSuccess: refresh,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-border p-4">
        <h3 className="mb-2 font-semibold">Disponibilità</h3>
        {stock.data && (
          <>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold">{stock.data.available}</span>
              <span className="text-sm text-muted-foreground">disponibili</span>
              <span className={`text-xs font-semibold ${HEALTH[stock.data.health]}`}>{stock.data.health}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Totale {stock.data.quantity} · Riservati {stock.data.reserved} · In ordine {stock.data.onOrder} · Min {stock.data.minQty}
            </div>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-1">Ubicazione</th><th>Qtà</th><th>Risv.</th><th>Disp.</th></tr>
              </thead>
              <tbody>
                {stock.data.byLocation.map((l) => (
                  <tr key={l.locationId} className="border-t border-border">
                    <td className="py-1 font-mono text-xs">{l.locationCode}</td>
                    <td>{l.quantity}</td><td>{l.reserved}</td><td>{l.available}</td>
                  </tr>
                ))}
                {stock.data.byLocation.length === 0 && <tr><td colSpan={4} className="py-2 text-muted-foreground">Nessuna giacenza.</td></tr>}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h3 className="font-semibold">Nuovo movimento</h3>
        <div className="flex flex-wrap gap-2">
          {OPS.map((o) => (
            <button key={o.value} type="button" onClick={() => setType(o.value)}
              className={`rounded px-3 py-1.5 text-sm ${type === o.value ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{o.label}</button>
          ))}
        </div>
        {warehouses.length > 1 && (
          <select className={`${inp} w-full`} value={wh?.id ?? ''} onChange={(e) => setWhId(e.target.value)}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        <input className={`${inp} w-full`} type="number" value={qty} onChange={(e) => setQty(e.target.value)}
          placeholder={type === 'ADJUSTMENT' ? 'Delta (±)' : 'Quantità'} />
        {needs.includes('from') && (
          // Outbound/transfer can only leave a location that actually holds stock;
          // an adjustment (e.g. initial count) may target any location.
          type === 'ADJUSTMENT' ? (
            <LocSelect label="Ubicazione (slot)" value={fromLoc} onChange={setFromLoc} options={toOptions}
              empty={toOptions.length === 0 ? 'Nessuno slot: creane uno nelle Ubicazioni' : undefined} />
          ) : (
            <LocSelect label="Da ubicazione" value={fromLoc} onChange={setFromLoc} options={fromOptions}
              empty={fromOptions.length === 0 ? 'Nessuna giacenza per questo componente' : undefined} />
          )
        )}
        {needs.includes('to') && (
          <LocSelect label="A ubicazione (slot)" value={toLoc} onChange={setToLoc} options={toOptions}
            empty={toOptions.length === 0 ? 'Nessuno slot: creane uno nelle Ubicazioni' : undefined} />
        )}
        <input className={`${inp} w-full`} value={reference} onChange={(e) => setReference(e.target.value)}
          placeholder="Riferimento (es. ordine, DDT) — opzionale" />
        <input className={`${inp} w-full`} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder={type === 'ADJUSTMENT' ? 'Motivo (obbligatorio)' : 'Motivo — opzionale'} />
        <button onClick={() => move.mutate()} disabled={move.isPending || !qty}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {move.isPending ? 'Registrazione…' : 'Registra movimento'}</button>
        {move.isError && <p className="text-xs text-red-500">{(move.error as Error).message}</p>}

        <div className="mt-3 border-t border-border pt-3">
          <h4 className="mb-2 text-sm font-semibold">Allocazione (prenota / rilascia)</h4>
          <div className="flex flex-wrap items-end gap-2">
            <LocSelect label="Ubicazione" value={allocLoc} onChange={setAllocLoc} options={fromOptions} />
            <input className={inp} type="number" value={allocQty} onChange={(e) => setAllocQty(e.target.value)} placeholder="Qtà" />
            <button onClick={() => reserve.mutate()} disabled={!allocLoc || !allocQty || reserve.isPending} className="rounded-md border border-border px-3 py-1.5 text-sm">Prenota</button>
            <button onClick={() => release.mutate()} disabled={!allocLoc || !allocQty || release.isPending} className="rounded-md border border-border px-3 py-1.5 text-sm">Rilascia</button>
          </div>
          {(reserve.isError || release.isError) && <p className="mt-1 text-xs text-red-500">{((reserve.error || release.error) as Error)?.message}</p>}
        </div>
      </section>

      <section className="lg:col-span-2">
        <h3 className="mb-2 font-semibold">Storico movimenti</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Qtà</th><th className="px-3 py-2">Rif.</th><th className="px-3 py-2">Motivo</th></tr>
            </thead>
            <tbody>
              {movements.data?.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs">{new Date(m.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{m.type}</td>
                  <td className="px-3 py-2 font-mono">{m.quantity}</td>
                  <td className="px-3 py-2">{m.reference ?? '—'}</td>
                  <td className="px-3 py-2">{m.reason ?? '—'}</td>
                </tr>
              ))}
              {movements.data?.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">Nessun movimento.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function LocSelect({
  label, value, onChange, options, empty,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { id: string; label: string }[];
  empty?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select className={inp} value={value} onChange={(e) => onChange(e.target.value)} disabled={options.length === 0}>
        <option value="">—</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      {empty && <span className="text-xs text-amber-600">{empty}</span>}
    </label>
  );
}

'use client';

import {
  createMovement,
  getComponentMovements,
  getComponentStock,
  type MovementType,
} from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const HEALTH_STYLES: Record<string, string> = {
  OK: 'bg-green-500/15 text-green-600',
  LOW: 'bg-amber-500/15 text-amber-600',
  CRITICAL: 'bg-orange-500/15 text-orange-600',
  OUT_OF_STOCK: 'bg-red-500/15 text-red-600',
};

const TYPES: { value: MovementType; label: string; needs: ('from' | 'to')[] }[] = [
  { value: 'INBOUND', label: 'Carico', needs: ['to'] },
  { value: 'OUTBOUND', label: 'Scarico', needs: ['from'] },
  { value: 'TRANSFER', label: 'Trasferimento', needs: ['from', 'to'] },
  { value: 'ADJUSTMENT', label: 'Correzione', needs: ['from'] },
];

export default function InventoryPage() {
  const [componentId, setComponentId] = useState('');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Magazzino — Movimenti</h1>
      <input
        value={componentId}
        onChange={(e) => setComponentId(e.target.value.trim())}
        placeholder="ID componente"
        className="w-96 rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      {componentId && <InventoryDetail componentId={componentId} />}
    </div>
  );
}

function InventoryDetail({ componentId }: { componentId: string }) {
  const qc = useQueryClient();
  const stock = useQuery({
    queryKey: ['stock', componentId],
    queryFn: () => getComponentStock(componentId),
  });
  const movements = useQuery({
    queryKey: ['movements', componentId],
    queryFn: () => getComponentMovements(componentId),
  });

  const [type, setType] = useState<MovementType>('INBOUND');
  const [quantity, setQuantity] = useState('');
  const [fromLocationId, setFrom] = useState('');
  const [toLocationId, setTo] = useState('');
  const [reason, setReason] = useState('');
  const needs = TYPES.find((t) => t.value === type)!.needs;

  const mutation = useMutation({
    mutationFn: () =>
      createMovement({
        type,
        componentId,
        quantity: Number(quantity),
        fromLocationId: needs.includes('from') ? fromLocationId : undefined,
        toLocationId: needs.includes('to') ? toLocationId : undefined,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      setQuantity('');
      qc.invalidateQueries({ queryKey: ['stock', componentId] });
      qc.invalidateQueries({ queryKey: ['movements', componentId] });
    },
  });

  if (stock.isError) return <p className="text-sm text-red-500">Componente non trovato.</p>;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-3">
        <h2 className="font-semibold">Disponibilità</h2>
        {stock.data && (
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold">{stock.data.available}</span>
              <span className="text-sm text-muted-foreground">disponibili</span>
              <span className={`rounded px-2 py-0.5 text-xs ${HEALTH_STYLES[stock.data.health]}`}>
                {stock.data.health}
              </span>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Totale {stock.data.quantity} · Riservati {stock.data.reserved} · In ordine{' '}
              {stock.data.onOrder} · Min {stock.data.minQty}
            </div>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-1">Ubicazione</th>
                  <th>Qtà</th>
                  <th>Riservati</th>
                  <th>Disp.</th>
                </tr>
              </thead>
              <tbody>
                {stock.data.byLocation.map((l) => (
                  <tr key={l.locationId} className="border-t border-border">
                    <td className="py-1 font-mono text-xs">{l.locationCode}</td>
                    <td>{l.quantity}</td>
                    <td>{l.reserved}</td>
                    <td>{l.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Nuovo movimento</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-3 rounded-lg border border-border p-4"
        >
          <div className="flex gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`rounded px-3 py-1.5 text-sm ${type === t.value ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            type="number"
            placeholder={type === 'ADJUSTMENT' ? 'Delta (±)' : 'Quantità'}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
          {needs.includes('from') && (
            <input
              value={fromLocationId}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="Ubicazione origine (ID)"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          )}
          {needs.includes('to') && (
            <input
              value={toLocationId}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Ubicazione destinazione (ID)"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          )}
          {type === 'ADJUSTMENT' && (
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo (obbligatorio)"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          )}
          <button
            type="submit"
            disabled={mutation.isPending || !quantity}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {mutation.isPending ? 'Registrazione…' : 'Registra movimento'}
          </button>
          {mutation.isError && (
            <p className="text-xs text-red-500">{(mutation.error as Error).message}</p>
          )}
        </form>

        <div>
          <h3 className="mb-1 text-sm font-semibold">Storico movimenti</h3>
          <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
            {movements.data?.map((m) => (
              <li key={m.id} className="flex justify-between border-b border-border py-1">
                <span>{m.type}</span>
                <span className="font-mono">{m.quantity}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
            {movements.data?.length === 0 && (
              <li className="text-muted-foreground">Nessun movimento.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

'use client';

import { AutoAcronyms } from '@/components/info-dot';

import {
  getComponent,
  getComponentStock,
  listSuppliers,
  listSupplierParts,
  upsertSupplierPart,
} from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const inp = 'rounded border border-border bg-background px-2 py-1.5 text-sm';
const n = (v: unknown) => (v == null || v === '' ? null : Number(v));

/** Economic summary (prices + on-hand value + stock thresholds) and per-supplier
 * sourcing prices for a component. */
export function EconomicPanel({ componentId }: { componentId: string }) {
  const qc = useQueryClient();
  const comp = useQuery({ queryKey: ['component-eco', componentId], queryFn: () => getComponent(componentId) });
  const stock = useQuery({ queryKey: ['stock', componentId], queryFn: () => getComponentStock(componentId) });
  const parts = useQuery({ queryKey: ['supplier-parts', componentId], queryFn: () => listSupplierParts(componentId) });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });

  const [supplierId, setSupplierId] = useState('');
  const [price, setPrice] = useState('');
  const [moq, setMoq] = useState('');
  const [lead, setLead] = useState('');
  const add = useMutation({
    mutationFn: () =>
      upsertSupplierPart({
        supplierId, componentId,
        unitPrice: price ? Number(price) : undefined,
        moq: moq ? Number(moq) : undefined,
        leadTimeDays: lead ? Number(lead) : undefined,
      }),
    onSuccess: () => {
      setPrice(''); setMoq(''); setLead('');
      // The component's valuation price is derived from supplier prices, so
      // refresh the economy figures and the dashboard total as well.
      qc.invalidateQueries({ queryKey: ['supplier-parts', componentId] });
      qc.invalidateQueries({ queryKey: ['component-eco', componentId] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const c = comp.data;
  const avg = n(c?.avgPrice);
  const last = n(c?.lastPrice);
  const currency = c?.currency || 'EUR';
  const onHand = stock.data?.quantity ?? 0;
  // Value uses the average price, falling back to the last price so entering
  // either one yields a stock value.
  const unitPrice = avg ?? last;
  const value = unitPrice != null ? Math.round(unitPrice * onHand * 100) / 100 : null;
  const fmt = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('it-IT')} ${currency}`);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-border p-4">
        <h3 className="mb-2 font-semibold">Economia</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Kpi label="Prezzo medio" value={fmt(avg)} />
          <Kpi label="Ultimo prezzo" value={fmt(last)} />
          <Kpi label="Valore giacenza" value={fmt(value)} hint={`${onHand} pz`} />
          <Kpi label="Scorte (min / ideale / max)" value={`${n(c?.minQty) ?? 0} / ${n(c?.idealQty) ?? '—'} / ${n(c?.maxQty) ?? '—'}`} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Prezzo medio e ultimo prezzo derivano dai prezzi fornitore qui accanto; il valore giacenza si aggiorna di conseguenza.
        </p>
      </section>

      <section className="rounded-lg border border-border p-4">
        <h3 className="mb-2 font-semibold">Prezzi fornitore</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr><th className="py-1">Fornitore</th><th>Prezzo</th><th><AutoAcronyms>MOQ</AutoAcronyms></th><th>Lead (gg)</th></tr>
          </thead>
          <tbody>
            {parts.data?.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-1">{p.supplier?.name ?? '—'}</td>
                <td>{p.unitPrice != null ? `${Number(p.unitPrice).toLocaleString('it-IT')} ${p.currency || currency}` : '—'}</td>
                <td>{p.moq ?? '—'}</td>
                <td>{p.leadTimeDays ?? '—'}</td>
              </tr>
            ))}
            {parts.data?.length === 0 && <tr><td colSpan={4} className="py-2 text-muted-foreground">Nessun prezzo fornitore.</td></tr>}
          </tbody>
        </table>
        <form onSubmit={(e) => { e.preventDefault(); if (supplierId) add.mutate(); }} className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Fornitore</span>
            <select className={inp} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">—</option>
              {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Prezzo</span><input className={`${inp} w-24`} type="number" step="0.0001" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground"><AutoAcronyms>MOQ</AutoAcronyms></span><input className={`${inp} w-20`} type="number" value={moq} onChange={(e) => setMoq(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Lead</span><input className={`${inp} w-20`} type="number" value={lead} onChange={(e) => setLead(e.target.value)} /></label>
          <button type="submit" disabled={!supplierId || add.isPending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Aggiungi</button>
          {suppliers.data?.length === 0 && <span className="text-xs text-muted-foreground">Crea prima un fornitore.</span>}
        </form>
      </section>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

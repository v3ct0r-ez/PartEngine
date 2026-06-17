'use client';

import {
  createBom,
  createBomVersion,
  getBom,
  importBomCsv,
  listBoms,
  type AvailabilityStatus,
} from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const inp = 'rounded border border-border bg-background px-2 py-1.5 text-sm';
const STATUS_STYLE: Record<AvailabilityStatus, string> = {
  AVAILABLE: 'bg-green-500/15 text-green-600',
  PARTIAL: 'bg-amber-500/15 text-amber-600',
  MISSING: 'bg-red-500/15 text-red-600',
};
const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  AVAILABLE: 'Disponibile',
  PARTIAL: 'Parziale',
  MISSING: 'Mancante',
};

export default function BomsPage() {
  const qc = useQueryClient();
  const { data: boms = [] } = useQuery({ queryKey: ['boms'], queryFn: listBoms });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => createBom({ code, name }),
    onSuccess: (b) => {
      setCode('');
      setName('');
      qc.invalidateQueries({ queryKey: ['boms'] });
      setSelectedId(b.id);
    },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Distinte base (BOM)</h1>

      <form
        onSubmit={(e) => { e.preventDefault(); if (code && name) create.mutate(); }}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-4"
      >
        <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Codice</span>
          <input className={inp} value={code} onChange={(e) => setCode(e.target.value)} placeholder="BOM-001" /></label>
        <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Nome</span>
          <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Scheda alimentatore" /></label>
        <button type="submit" disabled={!code || !name || create.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">+ Nuova BOM</button>
        {create.isError && <span className="text-xs text-red-500">{(create.error as Error).message}</span>}
      </form>

      <div className="flex gap-6">
        <ul className="w-64 shrink-0 space-y-0.5 border-r border-border pr-3 text-sm">
          {boms.map((b) => (
            <li key={b.id}>
              <button onClick={() => setSelectedId(b.id)}
                className={`w-full rounded px-2 py-1.5 text-left hover:bg-muted ${selectedId === b.id ? 'bg-muted font-medium' : ''}`}>
                <span className="font-mono text-xs">{b.code}</span> v{b.version}
                <span className="ml-1 text-xs text-muted-foreground">· {b.name}</span>
              </button>
            </li>
          ))}
          {boms.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">Nessuna BOM.</li>}
        </ul>
        <div className="flex-1">
          {selectedId ? <BomDetailView id={selectedId} onChanged={() => qc.invalidateQueries({ queryKey: ['boms'] })} /> : (
            <p className="text-sm text-muted-foreground">Seleziona o crea una BOM.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function BomDetailView({ id, onChanged }: { id: string; onChanged: () => void }) {
  const qc = useQueryClient();
  const { data: bom } = useQuery({ queryKey: ['bom', id], queryFn: () => getBom(id) });
  const [csv, setCsv] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['bom', id] });
  const importMut = useMutation({
    mutationFn: () => importBomCsv(id, csv, true),
    onSuccess: () => { setCsv(''); refresh(); },
  });
  const versionMut = useMutation({
    mutationFn: () => createBomVersion(id, prompt('Nuova versione (es. 1.1):') || ''),
    onSuccess: () => onChanged(),
  });

  if (!bom) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          <span className="font-mono text-sm">{bom.code}</span> v{bom.version} — {bom.name}
          <span className={`ml-3 rounded px-2 py-0.5 text-xs ${STATUS_STYLE[bom.status]}`}>{STATUS_LABEL[bom.status]}</span>
        </h2>
        <button onClick={() => versionMut.mutate()} className="rounded-md border border-border px-3 py-1.5 text-xs">Nuova versione</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Componente</th><th className="px-3 py-2">Rif.</th><th className="px-3 py-2">Richiesti</th><th className="px-3 py-2">Disp.</th><th className="px-3 py-2">Stato</th></tr>
          </thead>
          <tbody>
            {bom.lines.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-3 py-2">{l.component ? (<><span className="font-mono text-xs">{l.component.internalCode}</span> {l.component.name}</>) : (<span className="text-amber-600">{l.rawMpn ?? '—'} (non associato)</span>)}</td>
                <td className="px-3 py-2 text-xs">{l.reference ?? '—'}</td>
                <td className="px-3 py-2 font-mono">{l.required}</td>
                <td className="px-3 py-2 font-mono">{l.available}</td>
                <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[l.status]}`}>{STATUS_LABEL[l.status]}</span></td>
              </tr>
            ))}
            {bom.lines.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">Nessuna riga. Importa un CSV.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-2 text-sm font-semibold">Importa CSV (sostituisce le righe)</h3>
        <p className="mb-2 text-xs text-muted-foreground">Colonne: MPN, Reference, Quantity (i componenti vengono associati per MPN/codice).</p>
        <textarea className={`${inp} h-28 w-full font-mono`} value={csv} onChange={(e) => setCsv(e.target.value)}
          placeholder={'MPN,Reference,Quantity\nRC0603FR-0710KL,"R1,R2",2'} />
        <button onClick={() => importMut.mutate()} disabled={!csv || importMut.isPending}
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Importa</button>
        {importMut.data && <span className="ml-3 text-xs text-muted-foreground">Importate {importMut.data.imported} ({importMut.data.matched} associate, {importMut.data.unmatched} no).</span>}
      </div>
    </div>
  );
}

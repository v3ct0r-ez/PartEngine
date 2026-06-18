'use client';

import {
  createManufacturer,
  deleteManufacturer,
  getMe,
  listManufacturers,
  updateManufacturer,
  type Manufacturer,
} from '@/lib/api';
import { confirmDialog, toast } from '@/components/ui-dialogs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const inp = 'rounded border border-border bg-background px-2 py-1.5 text-sm';

export default function ManufacturersPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const canWrite = me.data ? me.data.role !== 'VIEWER' : false;
  const canDelete = me.data?.role === 'SUPER_ADMIN' || me.data?.role === 'WAREHOUSE_MANAGER';

  const { data, isLoading } = useQuery({ queryKey: ['manufacturers'], queryFn: listManufacturers });
  const refresh = () => qc.invalidateQueries({ queryKey: ['manufacturers'] });

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [editing, setEditing] = useState<Manufacturer | null>(null);

  const create = useMutation({
    mutationFn: () => createManufacturer({ name, website: website || undefined }),
    onSuccess: () => { setName(''); setWebsite(''); refresh(); },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteManufacturer(id),
    onSuccess: refresh,
    onError: (e) => toast((e as Error).message, 'error'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produttori</h1>
        {!canWrite && <span className="text-xs text-muted-foreground">Sola lettura</span>}
      </div>

      {canWrite && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (name) create.mutate(); }}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
        >
          <Field l="Nome"><input className={inp} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field l="Sito web (opzionale)"><input className={inp} placeholder="https://…" value={website} onChange={(e) => setWebsite(e.target.value)} /></Field>
          <button type="submit" disabled={!name || create.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">+ Aggiungi produttore</button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Sito web</th><th className="px-3 py-2">Componenti</th>{canWrite && <th className="px-3 py-2">Azioni</th>}</tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-3 py-3 text-muted-foreground" colSpan={4}>Caricamento…</td></tr>}
            {data?.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{m.name}</td>
                <td className="px-3 py-2">
                  {m.website ? <a href={m.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{m.website}</a> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{m._count?.components ?? 0}</td>
                {canWrite && (
                  <td className="px-3 py-2">
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => setEditing(m)} className="rounded border border-border px-2 py-1 hover:bg-muted">Modifica</button>
                      {canDelete && (
                        <button
                          onClick={async () => { if (await confirmDialog(`Eliminare il produttore "${m.name}"?`)) del.mutate(m.id); }}
                          disabled={(m._count?.components ?? 0) > 0}
                          title={(m._count?.components ?? 0) > 0 ? 'Riassegna prima i componenti' : 'Elimina'}
                          className="rounded border border-border px-2 py-1 text-red-600 hover:bg-muted disabled:opacity-40"
                        >Elimina</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {data?.length === 0 && !isLoading && <tr><td className="px-3 py-3 text-muted-foreground" colSpan={4}>Nessun produttore.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditModal manufacturer={editing} onClose={() => setEditing(null)} onSaved={() => { refresh(); setEditing(null); }} />
      )}
    </div>
  );
}

function EditModal({ manufacturer, onClose, onSaved }: { manufacturer: Manufacturer; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(manufacturer.name);
  const [website, setWebsite] = useState(manufacturer.website ?? '');
  const save = useMutation({
    mutationFn: () => updateManufacturer(manufacturer.id, { name, website: website || undefined }),
    onSuccess: onSaved,
    onError: (e) => toast((e as Error).message, 'error'),
  });

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (name) save.mutate(); }}
        className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-background p-6 shadow-xl">
        <h2 className="text-lg font-bold">Modifica produttore</h2>
        <input className={`${inp} w-full`} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <input className={`${inp} w-full`} placeholder="Sito web" value={website} onChange={(e) => setWebsite(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Annulla</button>
          <button type="submit" disabled={!name || save.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{save.isPending ? '…' : 'Salva'}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{l}</span>{children}</label>;
}

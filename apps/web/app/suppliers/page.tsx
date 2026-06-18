'use client';

import {
  createSupplier,
  deleteSupplier,
  getMe,
  listSuppliers,
  updateSupplier,
  type Supplier,
} from '@/lib/api';
import { confirmDialog, toast } from '@/components/ui-dialogs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const inp = 'rounded border border-border bg-background px-2 py-1.5 text-sm';

export default function SuppliersPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const canWrite = me.data ? ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'PURCHASING'].includes(me.data.role) : false;
  const canDelete = me.data?.role === 'SUPER_ADMIN' || me.data?.role === 'WAREHOUSE_MANAGER';

  const { data, isLoading } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });
  const refresh = () => qc.invalidateQueries({ queryKey: ['suppliers'] });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [lead, setLead] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createSupplier({ name, contactEmail: email || undefined, avgLeadTimeDays: lead ? Number(lead) : undefined }),
    onSuccess: () => { setName(''); setEmail(''); setLead(''); refresh(); },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: refresh,
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const inUse = (s: Supplier) => (s._count?.orders ?? 0) > 0 || (s._count?.supplierParts ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fornitori</h1>
        {!canWrite && <span className="text-xs text-muted-foreground">Sola lettura</span>}
      </div>

      {canWrite && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (name) create.mutate(); }}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
        >
          <Field label="Nome" value={name} onChange={setName} />
          <Field label="Email" value={email} onChange={setEmail} />
          <Field label="Lead time (gg)" value={lead} onChange={setLead} type="number" />
          <button type="submit" disabled={!name || create.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            Aggiungi fornitore
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Lead time</th>
              <th className="px-3 py-2">Affidabilità</th>
              <th className="px-3 py-2">Ordini</th>
              <th className="px-3 py-2">Listini</th>
              {canWrite && <th className="px-3 py-2">Azioni</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Caricamento…</td></tr>
            )}
            {data?.map((s) => (
              <tr key={s.id} className="border-t border-border hover:bg-muted/40">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2">{s.contactEmail ?? '—'}</td>
                <td className="px-3 py-2">{s.avgLeadTimeDays ? `${s.avgLeadTimeDays} gg` : '—'}</td>
                <td className="px-3 py-2">{s.reliability ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{s._count?.orders ?? 0}</td>
                <td className="px-3 py-2 text-muted-foreground">{s._count?.supplierParts ?? 0}</td>
                {canWrite && (
                  <td className="px-3 py-2">
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => setEditing(s)} className="rounded border border-border px-2 py-1 hover:bg-muted">Modifica</button>
                      {canDelete && (
                        <button
                          onClick={async () => { if (await confirmDialog(`Eliminare il fornitore "${s.name}"?`)) del.mutate(s.id); }}
                          disabled={inUse(s)}
                          title={inUse(s) ? 'Fornitore usato in ordini o listini' : 'Elimina'}
                          className="rounded border border-border px-2 py-1 text-red-600 hover:bg-muted disabled:opacity-40"
                        >Elimina</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {data?.length === 0 && !isLoading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nessun fornitore.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditModal supplier={editing} onClose={() => setEditing(null)} onSaved={() => { refresh(); setEditing(null); }} />
      )}
    </div>
  );
}

function EditModal({ supplier, onClose, onSaved }: { supplier: Supplier; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(supplier.name);
  const [email, setEmail] = useState(supplier.contactEmail ?? '');
  const [phone, setPhone] = useState(supplier.contactPhone ?? '');
  const [website, setWebsite] = useState(supplier.website ?? '');
  const [lead, setLead] = useState(supplier.avgLeadTimeDays?.toString() ?? '');
  const [reliability, setReliability] = useState(supplier.reliability ?? '');
  const [notes, setNotes] = useState(supplier.notes ?? '');

  const save = useMutation({
    mutationFn: () =>
      updateSupplier(supplier.id, {
        name,
        contactEmail: email || undefined,
        contactPhone: phone || undefined,
        website: website || undefined,
        avgLeadTimeDays: lead ? Number(lead) : undefined,
        reliability: reliability ? Number(reliability) : undefined,
        notes: notes || undefined,
      }),
    onSuccess: onSaved,
    onError: (e) => toast((e as Error).message, 'error'),
  });

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (name) save.mutate(); }}
        className="w-full max-w-md space-y-3 rounded-xl border border-border bg-background p-6 shadow-xl">
        <h2 className="text-lg font-bold">Modifica fornitore</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" value={name} onChange={setName} />
          <Field label="Email" value={email} onChange={setEmail} />
          <Field label="Telefono" value={phone} onChange={setPhone} />
          <Field label="Sito web" value={website} onChange={setWebsite} />
          <Field label="Lead time (gg)" value={lead} onChange={setLead} type="number" />
          <Field label="Affidabilità (0-100)" value={reliability} onChange={setReliability} type="number" />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Note</span>
          <textarea className={`${inp} w-full`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Annulla</button>
          <button type="submit" disabled={!name || save.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{save.isPending ? '…' : 'Salva'}</button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inp} />
    </div>
  );
}

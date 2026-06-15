'use client';

import { createSupplier, listSuppliers } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export default function SuppliersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [lead, setLead] = useState('');

  const create = useMutation({
    mutationFn: () =>
      createSupplier({
        name,
        contactEmail: email || undefined,
        avgLeadTimeDays: lead ? Number(lead) : undefined,
      }),
    onSuccess: () => {
      setName('');
      setEmail('');
      setLead('');
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Fornitori</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name) create.mutate();
        }}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
      >
        <Field label="Nome" value={name} onChange={setName} />
        <Field label="Email" value={email} onChange={setEmail} />
        <Field label="Lead time (gg)" value={lead} onChange={setLead} type="number" />
        <button
          type="submit"
          disabled={!name || create.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Aggiungi fornitore
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Lead time</th>
              <th className="px-3 py-2">Affidabilità</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Caricamento…
                </td>
              </tr>
            )}
            {data?.map((s) => (
              <tr key={s.id} className="border-t border-border hover:bg-muted/40">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2">{s.contactEmail ?? '—'}</td>
                <td className="px-3 py-2">{s.avgLeadTimeDays ? `${s.avgLeadTimeDays} gg` : '—'}</td>
                <td className="px-3 py-2">{s.reliability ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-border bg-background px-2 py-1.5 text-sm"
      />
    </div>
  );
}

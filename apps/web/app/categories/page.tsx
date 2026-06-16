'use client';

import {
  addCategoryField,
  createCategory,
  deleteCategory,
  deleteCategoryField,
  listCategories,
  type Category,
  type FieldType,
} from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const FIELD_TYPES: FieldType[] = ['STRING', 'TEXT', 'NUMBER', 'QUANTITY', 'BOOLEAN', 'ENUM', 'DATE'];
const inp = 'rounded border border-border bg-background px-2 py-1.5 text-sm';

export default function CategoriesPage() {
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = categories.find((c) => c.id === selectedId) ?? categories[0] ?? null;

  const refresh = () => qc.invalidateQueries({ queryKey: ['categories'] });

  // create category
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const createCat = useMutation({
    mutationFn: () => createCategory({ slug, name }),
    onSuccess: () => {
      setSlug('');
      setName('');
      refresh();
    },
  });
  const delCat = useMutation({ mutationFn: deleteCategory, onSuccess: refresh });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categorie & parametri</h1>
        <a href="/components" className="text-sm text-primary hover:underline">← Componenti</a>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); if (slug && name) createCat.mutate(); }}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Slug (es. relays)</span>
          <input className={inp} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="lowercase_only" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Nome</span>
          <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Relè" />
        </label>
        <button type="submit" disabled={!slug || !name || createCat.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          + Nuova categoria
        </button>
        {createCat.isError && <span className="text-xs text-red-500">{(createCat.error as Error).message}</span>}
      </form>

      <div className="flex gap-6">
        <ul className="w-56 shrink-0 space-y-0.5 border-r border-border pr-3 text-sm">
          {categories.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelectedId(c.id)}
                className={`w-full rounded px-2 py-1.5 text-left hover:bg-muted ${selected?.id === c.id ? 'bg-muted font-medium' : ''}`}
              >
                {c.name}
                <span className="ml-1 text-xs text-muted-foreground">({c._count?.components ?? 0})</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex-1">
          {selected ? (
            <CategoryFields key={selected.id} category={selected} onChange={refresh} onDelete={() => delCat.mutate(selected.id)} delError={(delCat.error as Error)?.message} />
          ) : (
            <p className="text-sm text-muted-foreground">Nessuna categoria. Creane una sopra.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryFields({ category, onChange, onDelete, delError }: { category: Category; onChange: () => void; onDelete: () => void; delError?: string }) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>('QUANTITY');
  const [unit, setUnit] = useState('');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);

  const add = useMutation({
    mutationFn: () =>
      addCategoryField(category.id, {
        key,
        label,
        type,
        unit: unit || undefined,
        options: type === 'ENUM' ? options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
        required,
      }),
    onSuccess: () => { setKey(''); setLabel(''); setUnit(''); setOptions(''); setRequired(false); onChange(); },
  });
  const del = useMutation({ mutationFn: deleteCategoryField, onSuccess: onChange });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{category.name} <span className="font-mono text-xs text-muted-foreground">/{category.slug}</span></h2>
        <button onClick={onDelete} className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-600">Elimina categoria</button>
      </div>
      {delError && <p className="text-xs text-red-500">{delError}</p>}

      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr><th className="px-3 py-2">Chiave</th><th className="px-3 py-2">Etichetta</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Unità</th><th className="px-3 py-2">Obbl.</th><th /></tr>
        </thead>
        <tbody>
          {category.fields.map((f) => (
            <tr key={f.id} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-xs">{f.key}</td>
              <td className="px-3 py-2">{f.label}</td>
              <td className="px-3 py-2">{f.type}</td>
              <td className="px-3 py-2">{f.unit ?? '—'}</td>
              <td className="px-3 py-2">{f.required ? '✓' : ''}</td>
              <td className="px-3 py-2 text-right"><button onClick={() => del.mutate(f.id)} className="text-xs text-red-600 hover:underline">elimina</button></td>
            </tr>
          ))}
          {category.fields.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">Nessun parametro.</td></tr>}
        </tbody>
      </table>

      <form onSubmit={(e) => { e.preventDefault(); if (key && label) add.mutate(); }} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-4">
        <Field l="Chiave"><input className={inp} value={key} onChange={(e) => setKey(e.target.value)} placeholder="resistance" /></Field>
        <Field l="Etichetta"><input className={inp} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Valore" /></Field>
        <Field l="Tipo"><select className={inp} value={type} onChange={(e) => setType(e.target.value as FieldType)}>{FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        {type === 'QUANTITY' && <Field l="Unità"><input className={inp} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Ω" /></Field>}
        {type === 'ENUM' && <Field l="Opzioni (virgola)"><input className={inp} value={options} onChange={(e) => setOptions(e.target.value)} placeholder="N, P" /></Field>}
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> obbligatorio</label>
        <button type="submit" disabled={!key || !label || add.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">+ Parametro</button>
        {add.isError && <span className="text-xs text-red-500">{(add.error as Error).message}</span>}
      </form>
    </div>
  );
}

function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{l}</span>{children}</label>;
}

'use client';

import {
  addCategoryField,
  createCategory,
  deleteCategory,
  deleteCategoryField,
  listCategories,
  updateCategory,
  updateCategoryField,
  type Category,
  type CategoryField,
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
  const selected = categories.find((c) => c.id === selectedId) ?? null;
  const groups = categories.filter((c) => c.isGroup).sort((a, b) => a.name.localeCompare(b.name));
  const leavesOf = (gid: string) => categories.filter((c) => !c.isGroup && c.parentId === gid).sort((a, b) => a.name.localeCompare(b.name));
  const refresh = () => qc.invalidateQueries({ queryKey: ['categories'] });

  // create
  const [kind, setKind] = useState<'group' | 'leaf'>('leaf');
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [codePrefix, setCodePrefix] = useState('');
  const create = useMutation({
    mutationFn: () =>
      createCategory({
        slug,
        name,
        isGroup: kind === 'group',
        parentId: kind === 'leaf' ? parentId || undefined : undefined,
        codePrefix: kind === 'leaf' ? codePrefix || undefined : undefined,
      }),
    onSuccess: () => { setSlug(''); setName(''); setCodePrefix(''); refresh(); },
  });
  const delCat = useMutation({ mutationFn: deleteCategory, onSuccess: () => { setSelectedId(null); refresh(); } });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categorie & parametri</h1>
        <a href="/components" className="text-sm text-primary hover:underline">← Componenti</a>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); if (slug && name && (kind === 'group' || parentId)) create.mutate(); }}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-4">
        <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Tipo</span>
          <select className={inp} value={kind} onChange={(e) => setKind(e.target.value as 'group' | 'leaf')}>
            <option value="leaf">Categoria</option><option value="group">Gruppo</option>
          </select></label>
        <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Slug</span>
          <input className={inp} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="crystals" /></label>
        <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Nome</span>
          <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Quarzi" /></label>
        {kind === 'leaf' && (
          <>
            <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Gruppo</span>
              <select className={inp} value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">—</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select></label>
            <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Prefisso codice</span>
              <input className={`${inp} w-24`} value={codePrefix} onChange={(e) => setCodePrefix(e.target.value.toUpperCase())} placeholder="Y" /></label>
          </>
        )}
        <button type="submit" disabled={!slug || !name || (kind === 'leaf' && !parentId) || create.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">+ Crea</button>
        {create.isError && <span className="text-xs text-red-500">{(create.error as Error).message}</span>}
      </form>

      <div className="flex gap-6">
        <div className="w-64 shrink-0 space-y-2 border-r border-border pr-3 text-sm">
          {groups.map((g) => (
            <div key={g.id}>
              <button onClick={() => setSelectedId(g.id)}
                className={`w-full rounded px-2 py-1 text-left text-[11px] font-semibold uppercase text-muted-foreground hover:bg-muted ${selected?.id === g.id ? 'bg-muted' : ''}`}>
                {g.name}
              </button>
              <ul className="space-y-0.5">
                {leavesOf(g.id).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setSelectedId(c.id)}
                      className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-muted ${selected?.id === c.id ? 'bg-muted font-medium' : ''}`}>
                      <span>{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c._count?.components ?? 0}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {groups.length === 0 && <p className="px-2 text-xs text-muted-foreground">Nessun gruppo.</p>}
        </div>

        <div className="flex-1">
          {selected ? (
            <CategoryDetail key={selected.id} category={selected} onChange={refresh} onDelete={() => delCat.mutate(selected.id)} delError={(delCat.error as Error)?.message} />
          ) : (
            <p className="text-sm text-muted-foreground">Seleziona una categoria.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryDetail({ category, onChange, onDelete, delError }: { category: Category; onChange: () => void; onDelete: () => void; delError?: string }) {
  const [catName, setCatName] = useState(category.name);
  const [prefix, setPrefix] = useState(category.codePrefix ?? '');
  const save = useMutation({ mutationFn: () => updateCategory(category.id, { name: catName, codePrefix: prefix || undefined }), onSuccess: onChange });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Nome {category.isGroup ? '(gruppo)' : ''}</span>
            <input className={inp} value={catName} onChange={(e) => setCatName(e.target.value)} /></label>
          {!category.isGroup && (
            <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Prefisso</span>
              <input className={`${inp} w-24`} value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} /></label>
          )}
          {(catName !== category.name || prefix !== (category.codePrefix ?? '')) && (
            <button onClick={() => save.mutate()} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">Salva</button>
          )}
          <span className="font-mono text-xs text-muted-foreground">/{category.slug}</span>
        </div>
        <button onClick={onDelete} className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-600">Elimina</button>
      </div>
      {delError && <p className="text-xs text-red-500">{delError}</p>}
      {!category.isGroup && <CategoryFields category={category} onChange={onChange} />}
      {category.isGroup && <p className="text-sm text-muted-foreground">I gruppi non hanno parametri; contengono categorie.</p>}
    </div>
  );
}

function CategoryFields({ category, onChange }: { category: Category; onChange: () => void }) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>('QUANTITY');
  const [unit, setUnit] = useState('');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);

  const add = useMutation({
    mutationFn: () => addCategoryField(category.id, {
      key, label, type, unit: unit || undefined,
      options: type === 'ENUM' ? options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
      required,
    }),
    onSuccess: () => { setKey(''); setLabel(''); setUnit(''); setOptions(''); setRequired(false); onChange(); },
  });
  const del = useMutation({ mutationFn: deleteCategoryField, onSuccess: onChange });

  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr><th className="px-3 py-2">Chiave</th><th className="px-3 py-2">Etichetta</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Unità</th><th className="px-3 py-2">Opzioni/Obbl.</th><th /></tr>
        </thead>
        <tbody>
          {category.fields.map((f) => <EditableFieldRow key={f.id} field={f} onSaved={onChange} onDelete={() => del.mutate(f.id)} />)}
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

function EditableFieldRow({ field, onSaved, onDelete }: { field: CategoryField; onSaved: () => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(field.label);
  const [type, setType] = useState<FieldType>(field.type);
  const [unit, setUnit] = useState(field.unit ?? '');
  const [options, setOptions] = useState((field.options ?? []).join(', '));
  const [required, setRequired] = useState(field.required);

  const save = useMutation({
    mutationFn: () => updateCategoryField(field.id, {
      label, type, unit: type === 'QUANTITY' ? unit || undefined : undefined,
      options: type === 'ENUM' ? options.split(',').map((o) => o.trim()).filter(Boolean) : [],
      required,
    }),
    onSuccess: () => { setEditing(false); onSaved(); },
  });

  if (!editing) {
    return (
      <tr className="border-t border-border">
        <td className="px-3 py-2 font-mono text-xs">{field.key}</td>
        <td className="px-3 py-2">{field.label}</td>
        <td className="px-3 py-2">{field.type}</td>
        <td className="px-3 py-2">{field.unit ?? '—'}</td>
        <td className="px-3 py-2 text-xs">{field.type === 'ENUM' ? (field.options ?? []).join(', ') : field.required ? 'obbligatorio' : '—'}</td>
        <td className="px-3 py-2 text-right">
          <button onClick={() => setEditing(true)} className="mr-3 text-xs text-primary hover:underline">modifica</button>
          <button onClick={onDelete} className="text-xs text-red-600 hover:underline">elimina</button>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t border-border bg-muted/30">
      <td className="px-3 py-2 font-mono text-xs">{field.key}</td>
      <td className="px-2 py-2"><input className={inp} value={label} onChange={(e) => setLabel(e.target.value)} /></td>
      <td className="px-2 py-2"><select className={inp} value={type} onChange={(e) => setType(e.target.value as FieldType)}>{FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}</select></td>
      <td className="px-2 py-2">{type === 'QUANTITY' && <input className={inp} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Ω" />}</td>
      <td className="px-2 py-2">{type === 'ENUM'
        ? <input className={inp} value={options} onChange={(e) => setOptions(e.target.value)} placeholder="N, P" />
        : <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> obblig.</label>}</td>
      <td className="px-3 py-2 text-right">
        <button onClick={() => save.mutate()} disabled={save.isPending} className="mr-2 text-xs text-primary hover:underline">salva</button>
        <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:underline">annulla</button>
      </td>
    </tr>
  );
}

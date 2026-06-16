'use client';

import {
  createComponent,
  deleteComponent,
  updateComponent,
  type Category,
  type CategoryField,
} from '@/lib/api';
import { validateParameters, type FieldTemplate } from '@partengine/core';
import { useMemo, useState } from 'react';

interface EditingComponent {
  id: string;
  internalCode: string;
  name: string;
  categoryId?: string;
  mpn?: string | null;
  footprint?: string | null;
  tags?: string[];
  parameters?: Record<string, unknown>;
}

/** Modal to create / edit / delete a component. Dynamic fields come from the
 * selected category (data-driven), so user-created categories work too. */
export function ComponentEditor({
  categories,
  component,
  onClose,
  onSaved,
}: {
  categories: Category[];
  component?: EditingComponent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!component;
  const [categoryId, setCategoryId] = useState(
    component?.categoryId ?? categories[0]?.id ?? '',
  );
  const [internalCode, setInternalCode] = useState(component?.internalCode ?? '');
  const [name, setName] = useState(component?.name ?? '');
  const [mpn, setMpn] = useState(component?.mpn ?? '');
  const [footprint, setFootprint] = useState(component?.footprint ?? '');
  const [tags, setTags] = useState((component?.tags ?? []).join(', '));
  const [params, setParams] = useState<Record<string, unknown>>(component?.parameters ?? {});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const category = categories.find((c) => c.id === categoryId);
  const fields = category?.fields ?? [];

  const templates: FieldTemplate[] = useMemo(
    () =>
      fields.map((f: CategoryField) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        unit: f.unit ?? undefined,
        options: f.options ?? undefined,
        required: f.required,
      })),
    [fields],
  );

  const fieldErrors = useMemo(() => {
    const list = validateParameters(templates, params);
    return Object.fromEntries(list.map((e) => [e.field, e.message]));
  }, [templates, params]);

  const canSave = internalCode && name && categoryId && Object.keys(fieldErrors).length === 0;

  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      internalCode,
      name,
      categoryId,
      mpn: mpn || undefined,
      footprint: footprint || undefined,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      parameters: params,
    };
    try {
      if (editing) await updateComponent(component!.id, body);
      else await createComponent(body);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing || !confirm('Eliminare questo componente?')) return;
    setBusy(true);
    try {
      await deleteComponent(component!.id);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{editing ? 'Modifica componente' : 'Nuovo componente'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Codice interno *"><input className={inp} value={internalCode} onChange={(e) => setInternalCode(e.target.value)} /></Field>
          <Field label="Nome *"><input className={inp} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Categoria *">
            <select className={inp} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setParams({}); }}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="MPN"><input className={inp} value={mpn ?? ''} onChange={(e) => setMpn(e.target.value)} /></Field>
          <Field label="Footprint"><input className={inp} value={footprint ?? ''} onChange={(e) => setFootprint(e.target.value)} /></Field>
          <Field label="Tag (separati da virgola)"><input className={inp} value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
        </div>

        {templates.length > 0 && (
          <>
            <h3 className="mb-2 mt-5 text-xs font-semibold uppercase text-muted-foreground">Parametri ({category?.name})</h3>
            <div className="grid grid-cols-2 gap-3">
              {templates.map((f) => (
                <Field key={f.key} label={`${f.label}${f.required ? ' *' : ''}${f.unit && f.type === 'QUANTITY' ? ` (${f.unit})` : ''}`} err={fieldErrors[f.key]}>
                  <FieldInput field={f} value={params[f.key]} onChange={(v) => setParams((p) => ({ ...p, [f.key]: v }))} />
                </Field>
              ))}
            </div>
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          {editing ? (
            <button onClick={remove} disabled={busy} className="rounded-md border border-red-500/40 px-4 py-2 text-sm text-red-600 disabled:opacity-50">Elimina</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Annulla</button>
            <button onClick={save} disabled={!canSave || busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {busy ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inp = 'w-full rounded border border-border bg-background px-2 py-1.5 text-sm';

function Field({ label, err, children }: { label: string; err?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
      {err && <span className="text-xs text-red-500">{err}</span>}
    </label>
  );
}

function FieldInput({ field, value, onChange }: { field: FieldTemplate; value: unknown; onChange: (v: unknown) => void }) {
  if (field.type === 'BOOLEAN')
    return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" />;
  if (field.type === 'ENUM')
    return (
      <select className={inp} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  return (
    <input
      className={inp}
      placeholder={field.type === 'QUANTITY' && field.unit ? `es. 4.7k${field.unit}` : ''}
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

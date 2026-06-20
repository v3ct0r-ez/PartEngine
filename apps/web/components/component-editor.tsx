'use client';

import {
  createComponent,
  createManufacturer,
  deleteAttachment,
  deleteComponent,
  listAttachments,
  listManufacturers,
  openAttachment,
  suggestAttachmentFields,
  updateComponent,
  uploadAttachment,
  type Category,
  type CategoryField,
} from '@/lib/api';
import { getComponent } from '@/lib/api';
import {
  categoryCodePrefix,
  composeNaming,
  validateParameters,
  type FieldTemplate,
} from '@partengine/core';
import { confirmDialog, promptDialog } from '@/components/ui-dialogs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

interface EditingComponent {
  id: string;
  internalCode: string;
  name: string;
  categoryId?: string;
  manufacturerId?: string | null;
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
  const leaves = categories.filter((c) => !c.isGroup);
  const groups = categories.filter((c) => c.isGroup);
  const [categoryId, setCategoryId] = useState(
    component?.categoryId ?? leaves[0]?.id ?? '',
  );
  const [internalCode, setInternalCode] = useState(component?.internalCode ?? '');
  const [name, setName] = useState(component?.name ?? '');
  const [mpn, setMpn] = useState(component?.mpn ?? '');
  const [manufacturerId, setManufacturerId] = useState(component?.manufacturerId ?? '');
  const [tags, setTags] = useState((component?.tags ?? []).join(', '));
  // Alternative manufacturers / MPNs for the same logical part (single stock).
  const [aliases, setAliases] = useState('');
  const [params, setParams] = useState<Record<string, unknown>>(component?.parameters ?? {});
  // Economic / stock thresholds.
  const [minQty, setMinQty] = useState('');
  const [idealQty, setIdealQty] = useState('');
  const [maxQty, setMaxQty] = useState('');
  const [lastPrice, setLastPrice] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Load the authoritative record on a DEDICATED key. Using the shared
  // ['component-eco'] key (EconomicPanel registers it too, with a different
  // queryFn) made the editor reuse that cached query, so the seeding side-effect
  // never ran and the form kept the stale parameters passed in. A separate key +
  // seeding via useEffect (not inside queryFn) loads the live values reliably.
  const full = useQuery({
    queryKey: ['component-edit', component?.id],
    enabled: editing,
    staleTime: 0,
    queryFn: () => getComponent(component!.id),
  });
  // Seed the form from the fetched record. Keyed on full.data so that when a
  // re-open serves a stale cache entry first and then the fresh refetch lands,
  // the fresh values win (an id guard would have frozen the stale ones).
  useEffect(() => {
    const c = full.data;
    if (!c) return;
    const s = (v: unknown) => (v == null ? '' : String(v));
    setMinQty(s(c.minQty)); setIdealQty(s(c.idealQty)); setMaxQty(s(c.maxQty));
    setLastPrice(s(c.lastPrice)); setAvgPrice(s(c.avgPrice)); setCurrency(c.currency || 'EUR');
    setParams(c.parameters ?? {});
    setName(c.name); setInternalCode(c.internalCode); setMpn(c.mpn ?? '');
    setTags((c.tags ?? []).join(', '));
    setAliases((c.aliases ?? []).join(', '));
  }, [full.data]);
  // Once the user edits code/name manually we stop auto-generating them.
  // When editing an existing component we never auto-overwrite.
  const [codeTouched, setCodeTouched] = useState(editing);
  const [nameTouched, setNameTouched] = useState(editing);

  const qc = useQueryClient();
  const { data: manufacturers = [] } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: listManufacturers,
  });

  async function addManufacturer() {
    const name = (await promptDialog('Nome del nuovo produttore:'))?.trim();
    if (!name) return;
    try {
      const m = await createManufacturer({ name });
      await qc.invalidateQueries({ queryKey: ['manufacturers'] });
      setManufacturerId(m.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

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

  // When editing, decide ONCE whether the loaded name/code are auto-generated
  // (match what the generator produces for the loaded params) or hand-customised.
  // If they're auto, clear the "touched" flags so they keep tracking parameter
  // edits; if custom, leave them frozen. (New components always auto-generate.)
  const decidedFor = useRef<string | null>(null);
  useEffect(() => {
    const c = full.data;
    if (!c || !category || category.slug !== c.category?.slug || decidedFor.current === c.id) return;
    decidedFor.current = c.id;
    try {
      const prefix = category.codePrefix || categoryCodePrefix(category.slug, category.name);
      const gen = composeNaming({
        categoryName: category.name,
        prefix,
        fields: templates.map((f) => ({ key: f.key, type: f.type, unit: f.unit })),
        params: (c.parameters ?? {}) as Record<string, unknown>,
      });
      setNameTouched(c.name !== gen.name);
      setCodeTouched(c.internalCode !== gen.code);
    } catch {
      /* keep them frozen on any parse edge case */
    }
  }, [full.data, category, templates]);

  // Footprint has no separate top-level input: it lives in the per-category
  // parameters. Whichever key the category defines — `footprint` (e.g. 0603) or
  // `package` (e.g. SOT-23) — is the single source used for the name/code and
  // for the denormalised Component.footprint column (listing + search).
  const footprintKey = useMemo(
    () => templates.find((f) => f.key === 'footprint' || f.key === 'package')?.key,
    [templates],
  );
  const footprintValue =
    footprintKey && params[footprintKey] != null ? String(params[footprintKey]) : '';

  // Auto-generate the name + code from the category's recognition parameters
  // (data-driven via composeNaming, so colour/dielectric/channel/footprint… all
  // flow in). A best-effort, editable suggestion that stops once the user edits.
  useEffect(() => {
    if (codeTouched && nameTouched) return;
    try {
      const { name: autoName, code: autoCode } = composeNaming({
        categoryName: category?.name,
        prefix: category?.codePrefix || categoryCodePrefix(category?.slug, category?.name),
        fields: templates.map((f) => ({ key: f.key, type: f.type, unit: f.unit })),
        params,
      });
      if (!nameTouched) setName(autoName);
      if (!codeTouched) setInternalCode(autoCode);
    } catch {
      // Auto-suggestion is best-effort — never let a parse edge case crash the editor.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, JSON.stringify(params), JSON.stringify(templates), codeTouched, nameTouched, category?.name, category?.slug]);

  const canSave = internalCode && name && categoryId && Object.keys(fieldErrors).length === 0;

  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      internalCode,
      name,
      categoryId,
      mpn: mpn || undefined,
      footprint: footprintValue || undefined,
      manufacturerId: manufacturerId || undefined,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      aliases: aliases ? aliases.split(',').map((a) => a.trim()).filter(Boolean) : [],
      parameters: params,
      minQty: minQty !== '' ? Number(minQty) : undefined,
      idealQty: idealQty !== '' ? Number(idealQty) : undefined,
      maxQty: maxQty !== '' ? Number(maxQty) : undefined,
      lastPrice: lastPrice !== '' ? Number(lastPrice) : undefined,
      avgPrice: avgPrice !== '' ? Number(avgPrice) : undefined,
      currency: currency || undefined,
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
    if (!editing || !(await confirmDialog('Eliminare questo componente?'))) return;
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
          <Field label="Codice interno *"><input className={inp} value={internalCode} onChange={(e) => { setCodeTouched(true); setInternalCode(e.target.value); }} /></Field>
          <Field label="Nome *"><input className={inp} value={name} onChange={(e) => { setNameTouched(true); setName(e.target.value); }} /></Field>
          <Field label="Categoria *">
            <select className={inp} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setParams({}); }}>
              {groups.map((g) => {
                const opts = leaves.filter((l) => l.parentId === g.id);
                if (opts.length === 0) return null;
                return (
                  <optgroup key={g.id} label={g.name}>
                    {opts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                );
              })}
              {leaves.filter((l) => !l.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="MPN"><input className={inp} value={mpn ?? ''} onChange={(e) => setMpn(e.target.value)} /></Field>
          <Field label="Produttore">
            <div className="flex gap-1">
              <select className={inp} value={manufacturerId ?? ''} onChange={(e) => setManufacturerId(e.target.value)}>
                <option value="">—</option>
                {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button type="button" onClick={addManufacturer} className="rounded border border-border px-2 text-sm" title="Nuovo produttore">+</button>
            </div>
          </Field>
          <Field label="Tag (separati da virgola)"><input className={inp} value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
          <Field label="Produttori / MPN alternativi (separati da virgola)"><input className={inp} value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="es. Yageo RC0603, Vishay CRCW0603" /></Field>
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

        <h3 className="mb-2 mt-5 text-xs font-semibold uppercase text-muted-foreground">Economia & scorte</h3>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Scorta minima"><input className={inp} type="number" value={minQty} onChange={(e) => setMinQty(e.target.value)} /></Field>
          <Field label="Scorta ideale"><input className={inp} type="number" value={idealQty} onChange={(e) => setIdealQty(e.target.value)} /></Field>
          <Field label="Scorta massima"><input className={inp} type="number" value={maxQty} onChange={(e) => setMaxQty(e.target.value)} /></Field>
          <Field label="Ultimo prezzo"><input className={inp} type="number" step="0.0001" value={lastPrice} onChange={(e) => setLastPrice(e.target.value)} /></Field>
          <Field label="Prezzo medio"><input className={inp} type="number" step="0.0001" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} /></Field>
          <Field label="Valuta"><input className={inp} value={currency} onChange={(e) => setCurrency(e.target.value)} /></Field>
        </div>

        {editing && component && (
          <AttachmentsPanel
            componentId={component.id}
            onSuggest={(s) => {
              setParams((p) => {
                const next = { ...p };
                for (const [k, v] of Object.entries(s.suggestions)) next[k] = String(v);
                if (s.tolerance != null && 'tolerance' in next) next.tolerance = String(s.tolerance);
                if (s.footprint && footprintKey) next[footprintKey] = s.footprint;
                return next;
              });
            }}
          />
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

function AttachmentsPanel({
  componentId,
  onSuggest,
}: {
  componentId: string;
  onSuggest: (s: { suggestions: Record<string, number>; footprint?: string; tolerance?: number }) => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: files = [] } = useQuery({
    queryKey: ['attachments', componentId],
    queryFn: () => listAttachments(componentId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['attachments', componentId] });

  const upload = useMutation({
    mutationFn: (file: File) => uploadAttachment(componentId, file),
    onSuccess: refresh,
  });
  const del = useMutation({ mutationFn: deleteAttachment, onSuccess: refresh });
  const suggest = useMutation({
    mutationFn: suggestAttachmentFields,
    onSuccess: (s) => onSuggest(s),
  });

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Allegati / datasheet</h3>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-border px-3 py-1 text-xs"
        >
          + Carica file
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = '';
          }}
        />
      </div>
      {upload.isPending && <p className="text-xs text-muted-foreground">Caricamento…</p>}
      <ul className="space-y-1 text-sm">
        {files.map((a) => (
          <li key={a.id} className="flex items-center gap-2">
            <button type="button" onClick={() => openAttachment(a.id)} className="text-primary hover:underline">
              {a.fileName}
            </button>
            <span className="text-xs text-muted-foreground">{(a.sizeBytes / 1024).toFixed(0)} KB · {a.kind}</span>
            {a.kind === 'DATASHEET' && (
              <button type="button" onClick={() => suggest.mutate(a.id)} className="text-xs text-primary hover:underline">
                suggerisci parametri
              </button>
            )}
            <button type="button" onClick={() => del.mutate(a.id)} className="ml-auto text-xs text-red-600 hover:underline">
              elimina
            </button>
          </li>
        ))}
        {files.length === 0 && <li className="text-xs text-muted-foreground">Nessun allegato.</li>}
      </ul>
      {suggest.isSuccess && Object.keys(suggest.data.suggestions).length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">Nessun parametro riconosciuto nel testo.</p>
      )}
    </div>
  );
}

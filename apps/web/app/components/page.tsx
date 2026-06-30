'use client';

import Link from 'next/link';
import { ComponentEditor } from '@/components/component-editor';
import { ComponentsTable } from '@/components/components-table';
import { EconomicPanel } from '@/components/economic-panel';
import { FilterSidebar } from '@/components/filter-sidebar';
import { LabelButton } from '@/components/label-button';
import { ParametersPanel } from '@/components/parameters-panel';
import { SavedViews } from '@/components/saved-views';
import { WarehouseOperations } from '@/components/warehouse-operations';
import { getComponent, listCategories, listRecent, recordRecent, searchComponents, type Category, type ComponentRow } from '@/lib/api';
import { usePrefs } from '@/lib/preferences';
import { useUiStore } from '@/lib/store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export default function ComponentsPage() {
  const { query, setQuery } = useUiStore();
  const [text, setText] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(text);
      // Remember non-trivial searches (Memoria Utente).
      if (text.trim().length >= 2) recordRecent({ kind: 'search', label: text.trim() }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [text, setQuery]);

  const prefs = usePrefs();

  // Track a component as "recent" whenever its card is opened, and start on the
  // user's preferred detail tab.
  function openComponent(c: ComponentRow) {
    setSelected(c);
    setTab(prefs.defaultComponentTab);
    recordRecent({ kind: 'component', refId: c.id, label: `${c.internalCode} · ${c.name}` }).catch(() => {});
  }

  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const [selected, setSelected] = useState<ComponentRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ComponentRow | null>(null);
  const [tab, setTab] = useState<'warehouse' | 'params' | 'eco'>('warehouse');

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(c: ComponentRow) {
    setEditing(c);
    setEditorOpen(true);
  }
  function onSaved() {
    setEditorOpen(false);
    qc.invalidateQueries({ queryKey: ['components'] });
    qc.invalidateQueries({ queryKey: ['stock'] });
    // Prices/thresholds changed → refresh the component's economic tab, the
    // category counts and the dashboard total value.
    qc.invalidateQueries({ queryKey: ['component-eco'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  }

  // USB/keyboard-wedge QR scanner: types the code then Enter → open the match.
  async function onScan(code: string) {
    const c = code.trim();
    if (!c) return;
    const res = await searchComponents({ q: c, limit: 5 });
    const hit = res.items.find((x) => x.internalCode.toLowerCase() === c.toLowerCase()) ?? res.items[0];
    if (hit) openComponent(hit);
  }

  const toEditing = (c: ComponentRow | null) =>
    c
      ? {
          id: c.id,
          internalCode: c.internalCode,
          name: c.name,
          categoryId: categories.find((cat: Category) => cat.slug === c.category?.slug)?.id,
          manufacturerId: c.manufacturerId,
          mpn: c.mpn,
          footprint: c.footprint,
          parameters: c.parameters,
        }
      : null;

  // ── Detail (warehouse) view for a selected component ─────────
  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="text-sm text-primary hover:underline">
          ← Torna all'elenco
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{selected.name}</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{selected.internalCode}</span>
              {selected.category ? ` · ${selected.category.name}` : ''}
              {selected.mpn ? ` · MPN ${selected.mpn}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <LabelButton internalCode={selected.internalCode} name={selected.name} />
            <button
              onClick={() => openEdit(selected)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Modifica componente
            </button>
          </div>
        </div>

        {/* Auto-sized tabs (sized to their label, not stretched). */}
        <div className="flex flex-wrap gap-1 border-b border-border">
          {([
            ['params', 'Parametri'],
            ['warehouse', 'Ubicazioni'],
            ['eco', 'Economia'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                tab === k
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'warehouse' && <WarehouseOperations componentId={selected.id} />}
        {tab === 'params' && <ParametersPanel component={selected} categories={categories} />}
        {tab === 'eco' && <EconomicPanel componentId={selected.id} />}

        {editorOpen && (
          <ComponentEditor
            categories={categories}
            component={toEditing(editing)}
            onClose={() => setEditorOpen(false)}
            onSaved={async () => {
              onSaved();
              // Refresh the header (name/code/mpn/category) with the saved data.
              if (selected) {
                try { setSelected(await getComponent(selected.id)); } catch { /* keep current */ }
              }
            }}
          />
        )}
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Componenti</h1>
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Ricerca — es. "resistenza 10k 1% 0603"'
            className="w-80 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void onScan((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
            placeholder="⌖ Scansiona QR…"
            className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm"
            title="Scanner USB: inquadra il QR del componente"
          />
          <Link href="/categories" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Categorie</Link>
          <button onClick={openNew} disabled={categories.length === 0}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">+ Nuovo</button>
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RecentSearches onPick={(q) => setText(q)} />
        <SavedViews />
      </div>
      <div className="flex gap-6">
        <FilterSidebar />
        <div className="flex-1">
          <ComponentsTable onRowClick={openComponent} />
        </div>
      </div>

      {editorOpen && (
        <ComponentEditor
          categories={categories}
          component={toEditing(editing)}
          onClose={() => setEditorOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

/** Quick chips of the user's recent searches (Memoria Utente). */
function RecentSearches({ onPick }: { onPick: (q: string) => void }) {
  const recent = useQuery({ queryKey: ['recent', 'search'], queryFn: () => listRecent('search', 6) });
  if (!recent.data || recent.data.length === 0) return <span />;
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <span>Recenti:</span>
      {recent.data.map((r) => (
        <button key={r.id} onClick={() => onPick(r.label)} className="rounded-full border border-border px-2 py-0.5 hover:bg-muted">
          {r.label}
        </button>
      ))}
    </div>
  );
}

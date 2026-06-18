'use client';

import { ComponentEditor } from '@/components/component-editor';
import { ComponentsTable } from '@/components/components-table';
import { EconomicPanel } from '@/components/economic-panel';
import { FilterSidebar } from '@/components/filter-sidebar';
import { LabelButton } from '@/components/label-button';
import { WarehouseOperations } from '@/components/warehouse-operations';
import { listCategories, searchComponents, type Category, type ComponentRow } from '@/lib/api';
import { useUiStore } from '@/lib/store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export default function ComponentsPage() {
  const { query, setQuery } = useUiStore();
  const [text, setText] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setQuery(text), 300);
    return () => clearTimeout(t);
  }, [text, setQuery]);

  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const [selected, setSelected] = useState<ComponentRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ComponentRow | null>(null);

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
    if (hit) setSelected(hit);
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

        <EconomicPanel componentId={selected.id} />
        <WarehouseOperations componentId={selected.id} />

        {editorOpen && (
          <ComponentEditor
            categories={categories}
            component={toEditing(editing)}
            onClose={() => setEditorOpen(false)}
            onSaved={() => {
              onSaved();
              // reflect edits in the header
              if (editing && editing.id === selected.id) {
                qc.invalidateQueries({ queryKey: ['components'] });
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
          <a href="/categories" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Categorie</a>
          <button onClick={openNew} disabled={categories.length === 0}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">+ Nuovo</button>
        </div>
      </header>
      <div className="flex gap-6">
        <FilterSidebar />
        <div className="flex-1">
          <ComponentsTable onRowClick={(c) => setSelected(c)} />
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

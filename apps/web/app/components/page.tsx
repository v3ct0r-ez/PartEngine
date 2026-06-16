'use client';

import { ComponentEditor } from '@/components/component-editor';
import { ComponentsTable } from '@/components/components-table';
import { FilterSidebar } from '@/components/filter-sidebar';
import { listCategories, type Category, type ComponentRow } from '@/lib/api';
import { useUiStore } from '@/lib/store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export default function ComponentsPage() {
  const { query, setQuery } = useUiStore();
  // Local input state debounced into the store, so typing doesn't trigger a
  // query refetch + global re-render on every keystroke.
  const [text, setText] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setQuery(text), 300);
    return () => clearTimeout(t);
  }, [text, setQuery]);

  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

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
  }

  // Resolve the editing row to the editor's expected shape (categoryId from slug).
  const editingComponent = editing
    ? {
        id: editing.id,
        internalCode: editing.internalCode,
        name: editing.name,
        categoryId: categories.find((c: Category) => c.slug === editing.category?.slug)?.id,
        manufacturerId: editing.manufacturerId,
        mpn: editing.mpn,
        footprint: editing.footprint,
        parameters: editing.parameters,
      }
    : null;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Componenti</h1>
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Ricerca intelligente — es. "resistenza 10k 1% 0603"'
            className="w-96 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <a href="/categories" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
            Categorie
          </a>
          <button
            onClick={openNew}
            disabled={categories.length === 0}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            + Nuovo
          </button>
        </div>
      </header>
      <div className="flex gap-6">
        <FilterSidebar />
        <div className="flex-1">
          <ComponentsTable onRowClick={openEdit} />
        </div>
      </div>

      {editorOpen && (
        <ComponentEditor
          categories={categories}
          component={editingComponent}
          onClose={() => setEditorOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

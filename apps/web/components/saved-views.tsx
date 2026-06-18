'use client';

import {
  createSavedView,
  deleteSavedView,
  listSavedViews,
  type RangeFilter,
  type SavedView,
} from '@/lib/api';
import { confirmDialog, promptDialog, toast } from '@/components/ui-dialogs';
import { useUiStore } from '@/lib/store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface ViewConfig {
  query?: string;
  category?: string;
  ranges?: RangeFilter[];
  sortField?: string;
  sortDir?: 'asc' | 'desc';
}

/** Saved views (Memoria Utente) for the components list: persist the current
 *  search + filters + sort under a name and re-apply with one click. */
export function SavedViews({ scope = 'components' }: { scope?: string }) {
  const qc = useQueryClient();
  const { query, category, ranges, sortField, sortDir, applyView } = useUiStore();
  const views = useQuery({ queryKey: ['saved-views', scope], queryFn: () => listSavedViews(scope) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['saved-views', scope] });

  const save = useMutation({
    mutationFn: (name: string) =>
      createSavedView({ name, scope, config: { query, category, ranges, sortField, sortDir } }),
    onSuccess: () => { toast('Vista salvata'); refresh(); },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteSavedView(id),
    onSuccess: refresh,
    onError: (e) => toast((e as Error).message, 'error'),
  });

  async function onSave() {
    const name = (await promptDialog('Nome della vista:'))?.trim();
    if (name) save.mutate(name);
  }

  function apply(v: SavedView) {
    const c = v.config as ViewConfig;
    applyView({ query: c.query, category: c.category, ranges: c.ranges, sortField: c.sortField, sortDir: c.sortDir });
  }

  return (
    <div className="flex items-center gap-2">
      {views.data && views.data.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {views.data.map((v) => (
            <span key={v.id} className="inline-flex items-center rounded-full border border-border bg-background text-xs">
              <button onClick={() => apply(v)} className="rounded-l-full px-2 py-1 hover:bg-muted" title="Applica vista">{v.name}</button>
              <button
                onClick={async () => { if (await confirmDialog(`Eliminare la vista "${v.name}"?`)) del.mutate(v.id); }}
                className="rounded-r-full px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-red-600"
                title="Elimina vista"
              >×</button>
            </span>
          ))}
        </div>
      )}
      <button onClick={onSave} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">★ Salva vista</button>
    </div>
  );
}

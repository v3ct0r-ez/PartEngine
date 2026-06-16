'use client';

import { listCategories, type Category } from '@/lib/api';
import { useUiStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';

/**
 * Advanced filter sidebar — fully API-driven. The category list and the
 * per-category numeric range filters come from the live categories/fields
 * (including admin-created ones), so customizing a category in `/categories`
 * immediately updates the filters here. Range inputs accept engineering
 * notation ("100", "10k", "4.7µF").
 */
export function FilterSidebar() {
  const { category, setCategory, setRange, ranges, clearRanges } = useUiStore();
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const active: Category | undefined = categories.find((c) => c.slug === category);
  const quantityFields = (active?.fields ?? []).filter((f) => f.type === 'QUANTITY' && f.isFilterable !== false);

  function selectCategory(slug?: string) {
    clearRanges(); // ranges are per-category (keyed by field) — reset on switch
    setCategory(slug);
  }

  return (
    <div className="w-64 shrink-0 space-y-6 border-r border-border pr-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Categoria</h3>
        <ul className="space-y-0.5 text-sm">
          <li>
            <button
              onClick={() => selectCategory(undefined)}
              className={`w-full rounded px-2 py-1 text-left hover:bg-muted ${!category ? 'bg-muted font-medium' : ''}`}
            >
              Tutte
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => selectCategory(c.slug)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-muted ${category === c.slug ? 'bg-muted font-medium' : ''}`}
              >
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground">{c._count?.components ?? 0}</span>
              </button>
            </li>
          ))}
          {categories.length === 0 && (
            <li className="px-2 py-1 text-xs text-muted-foreground">Nessuna categoria.</li>
          )}
        </ul>
      </section>

      {active && quantityFields.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Filtri numerici
          </h3>
          <div className="space-y-3">
            {quantityFields.map((f) => {
              const current = ranges.find((r) => r.field === f.key);
              return (
                <div key={f.id}>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    {f.label} {f.unit ? `(${f.unit})` : ''}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      placeholder="Da"
                      defaultValue={current?.from}
                      onBlur={(e) => setRange(f.key, e.target.value, current?.to)}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                    <span className="text-muted-foreground">→</span>
                    <input
                      placeholder="A"
                      defaultValue={current?.to}
                      onBlur={(e) => setRange(f.key, current?.from, e.target.value)}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

'use client';

import { CATEGORY_TEMPLATES, type CategoryTemplate } from '@partengine/core';
import { useUiStore } from '@/lib/store';

/**
 * Advanced filter sidebar. The category list and the per-category numeric range
 * filters are generated from the same data-driven templates that drive the
 * dynamic form — add a category/field once and it appears everywhere.
 * Range inputs accept engineering notation ("100", "10k", "4.7µF").
 */
export function FilterSidebar() {
  const { category, setCategory, setRange, ranges } = useUiStore();
  const active: CategoryTemplate | undefined = CATEGORY_TEMPLATES.find((c) => c.slug === category);
  const quantityFields = active?.fields.filter((f) => f.type === 'QUANTITY') ?? [];

  return (
    <div className="w-64 shrink-0 space-y-6 border-r border-border pr-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Categoria</h3>
        <ul className="space-y-0.5 text-sm">
          <li>
            <button
              onClick={() => setCategory(undefined)}
              className={`w-full rounded px-2 py-1 text-left hover:bg-muted ${!category ? 'bg-muted font-medium' : ''}`}
            >
              Tutte
            </button>
          </li>
          {CATEGORY_TEMPLATES.map((c) => (
            <li key={c.slug}>
              <button
                onClick={() => setCategory(c.slug)}
                className={`w-full rounded px-2 py-1 text-left hover:bg-muted ${category === c.slug ? 'bg-muted font-medium' : ''}`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {quantityFields.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Filtri numerici
          </h3>
          <div className="space-y-3">
            {quantityFields.map((f) => {
              const current = ranges.find((r) => r.field === f.key);
              return (
                <div key={f.key}>
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

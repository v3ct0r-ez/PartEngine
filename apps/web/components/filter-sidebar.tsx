'use client';

import { listCategories, type Category } from '@/lib/api';
import { useUiStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

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

  // Build group → leaf tree from the flat list.
  const groups = categories.filter((c) => c.isGroup).sort((a, b) => a.name.localeCompare(b.name));
  const leavesByParent = new Map<string, Category[]>();
  for (const c of categories) {
    if (c.isGroup) continue;
    const key = c.parentId ?? '_';
    leavesByParent.set(key, [...(leavesByParent.get(key) ?? []), c]);
  }

  // Collapsed by default so the sidebar stays short; a group auto-expands when
  // it contains the active category, and the user can toggle any header.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const activeGroupId = active && !active.isGroup ? active.parentId : undefined;
  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  function selectCategory(slug?: string) {
    clearRanges(); // ranges are per-category (keyed by field) — reset on switch
    setCategory(slug);
  }

  return (
    <div className="w-64 shrink-0 space-y-6 border-r border-border pr-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Categoria</h3>
        <div className="space-y-2 text-sm">
          <button
            onClick={() => selectCategory(undefined)}
            className={`w-full rounded px-2 py-1 text-left hover:bg-muted ${!category ? 'bg-muted font-medium' : ''}`}
          >
            Tutte
          </button>
          {groups.map((g) => {
            const leaves = (leavesByParent.get(g.id) ?? []).sort((a, b) => a.name.localeCompare(b.name));
            if (leaves.length === 0) return null;
            const isOpen = openGroups.has(g.id) || activeGroupId === g.id;
            const total = leaves.reduce((sum, c) => sum + (c._count?.components ?? 0), 0);
            return (
              <div key={g.id}>
                <button
                  onClick={() => toggleGroup(g.id)}
                  className="flex w-full items-center gap-1 rounded px-2 pt-1 text-left text-[11px] font-semibold uppercase text-muted-foreground hover:bg-muted"
                >
                  <span className={`inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}>▸</span>
                  <span className="flex-1">{g.name}</span>
                  <span className="font-normal lowercase">{total}</span>
                </button>
                {isOpen && (
                  <ul className="space-y-0.5">
                    {leaves.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => selectCategory(c.slug)}
                          className={`flex w-full items-center justify-between rounded px-2 py-1 pl-5 text-left hover:bg-muted ${category === c.slug ? 'bg-muted font-medium' : ''}`}
                        >
                          <span>{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c._count?.components ?? 0}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {categories.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Nessuna categoria.</p>}
        </div>
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

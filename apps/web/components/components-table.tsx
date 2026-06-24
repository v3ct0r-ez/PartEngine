'use client';

import { AutoAcronyms } from '@/components/info-dot';
import { listCategories, searchComponents, type Category, type ComponentRow } from '@/lib/api';
import { usePrefs } from '@/lib/preferences';
import { useUiStore } from '@/lib/store';
import { formatEngineering, parseQuantity } from '@partengine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

type ValueField = { key: string; unit?: string | null };

/**
 * Server-side-paginated components table. Sorting and range filtering happen on
 * the API against the indexed parameter projection, so "100Ω < 1kΩ < 1MΩ"
 * ordering is correct even across millions of rows. Quantity cells are rendered
 * with engineering formatting for readability. The visible columns, their order
 * and the page size come from the user's preferences.
 */
export function ComponentsTable({ onRowClick }: { onRowClick?: (c: ComponentRow) => void }) {
  const { query, category, ranges, sortField, sortDir, setSort } = useUiStore();
  const prefs = usePrefs();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['components', query, category, ranges, sortField, sortDir, prefs.pageSize],
    queryFn: () =>
      searchComponents({ q: query, categorySlug: category, ranges, sortField, sortDir, limit: prefs.pageSize }),
    placeholderData: keepPreviousData,
  });

  // The active category's primary QUANTITY field drives the sortable "Valore"
  // column (unit-aware sort by magnitude on the server).
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const activeCat = categories.find((c: Category) => c.slug === category);
  const valueField = activeCat?.fields.find((f) => f.type === 'QUANTITY');

  const columns = prefs.componentColumns;
  const colCount = columns.length;

  if (isError) return <div className="p-4 text-sm text-red-500">Errore nel caricamento.</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            {columns.map((key) => {
              const h = header(key, valueField);
              return h.sortField ? (
                <Th key={key} label={h.label} field={h.sortField} {...{ sortField, sortDir, setSort }} />
              ) : (
                <th key={key} className="px-3 py-2"><AutoAcronyms>{h.label}</AutoAcronyms></th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={colCount} className="px-3 py-6 text-center text-muted-foreground">
                Caricamento…
              </td>
            </tr>
          )}
          {data?.items.map((c) => (
            <tr
              key={c.id}
              onClick={() => {
                // Don't open the component if the click was actually a text
                // selection (e.g. the user is selecting the code to copy it).
                if (window.getSelection()?.toString()) return;
                onRowClick?.(c);
              }}
              className={`border-t border-border hover:bg-muted/40 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((key) => (
                <td key={key} className="px-3 py-2">{cell(key, c, valueField)}</td>
              ))}
            </tr>
          ))}
          {data && data.items.length === 0 && !isLoading && (
            <tr>
              <td colSpan={colCount} className="px-3 py-6 text-center text-muted-foreground">
                Nessun componente trovato.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Header label + (optional) server sort field for a column key. */
function header(key: string, valueField?: ValueField): { label: string; sortField?: string } {
  switch (key) {
    case 'internalCode': return { label: 'Codice', sortField: 'internalCode' };
    case 'name': return { label: 'Nome', sortField: 'name' };
    case 'category': return { label: 'Categoria', sortField: 'category' };
    case 'mpn': return { label: 'MPN', sortField: 'mpn' };
    case 'manufacturer': return { label: 'Produttore', sortField: 'manufacturer' };
    case 'value': return { label: `Valore${valueField?.unit ? ` (${valueField.unit})` : ''}`, sortField: valueField?.key };
    case 'footprint': return { label: 'Footprint', sortField: 'footprint' };
    case 'stock': return { label: 'Q.tà magazzino' };
    default: return { label: key };
  }
}

function cell(key: string, c: ComponentRow, valueField?: ValueField): ReactNode {
  switch (key) {
    case 'internalCode': return <span className="font-mono text-xs">{c.internalCode}</span>;
    case 'name': return c.name;
    case 'category': return c.category?.name ?? '—';
    case 'mpn': return c.mpn ?? '—';
    case 'manufacturer': return c.manufacturer?.name ?? '—';
    case 'value': return primaryValue(c, valueField);
    case 'footprint': return c.footprint ?? '—';
    case 'stock': return c.onHand ?? 0;
    default: return '—';
  }
}

function Th({
  label,
  field,
  sortField,
  sortDir,
  setSort,
}: {
  label: string;
  field: string;
  sortField?: string;
  sortDir: 'asc' | 'desc';
  setSort: (f: string, d?: 'asc' | 'desc') => void;
}) {
  const active = sortField === field;
  return (
    <th className="px-3 py-2">
      <button
        onClick={() => setSort(field)}
        className="flex items-center gap-1 hover:text-foreground"
        title="Ordina (clic: crescente → decrescente → predefinito)"
      >
        <AutoAcronyms>{label}</AutoAcronyms>
        <span className={active ? 'text-foreground' : 'text-muted-foreground/30'}>{active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

/** Render the active category's primary quantity parameter in engineering
 * notation. Works for any (incl. custom) category via its first QUANTITY field;
 * falls back to a built-in guess when no category is selected. */
function primaryValue(c: ComponentRow, valueField?: ValueField): string {
  const key =
    valueField?.key ??
    { resistors: 'resistance', capacitors: 'capacitance', inductors: 'inductance' }[
      c.category?.slug ?? ''
    ];
  if (!key) return '—';
  const raw = c.parameters?.[key];
  if (raw == null) return '—';
  const unit =
    valueField?.unit ?? { resistance: 'Ω', capacitance: 'F', inductance: 'H' }[key] ?? '';
  const q = parseQuantity(String(raw), unit ?? '');
  return q ? formatEngineering(q.magnitude, unit ?? '') : String(raw);
}

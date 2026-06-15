'use client';

import { searchComponents, type ComponentRow } from '@/lib/api';
import { useUiStore } from '@/lib/store';
import { formatEngineering, parseQuantity } from '@partengine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

/**
 * Server-side-paginated components table. Sorting and range filtering happen on
 * the API against the indexed parameter projection, so "100Ω < 1kΩ < 1MΩ"
 * ordering is correct even across millions of rows. Quantity cells are rendered
 * with engineering formatting for readability.
 */
export function ComponentsTable() {
  const { query, ranges, sortField, sortDir, setSort } = useUiStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['components', query, ranges, sortField, sortDir],
    queryFn: () => searchComponents({ q: query, ranges, sortField, sortDir, limit: 50 }),
    placeholderData: keepPreviousData,
  });

  if (isError) return <div className="p-4 text-sm text-red-500">Errore nel caricamento.</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <Th label="Codice" field="internalCode" {...{ sortField, sortDir, setSort }} />
            <Th label="Nome" field="name" {...{ sortField, sortDir, setSort }} />
            <th className="px-3 py-2">Categoria</th>
            <th className="px-3 py-2">MPN</th>
            <th className="px-3 py-2">Valore</th>
            <th className="px-3 py-2">Footprint</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                Caricamento…
              </td>
            </tr>
          )}
          {data?.items.map((c) => (
            <tr key={c.id} className="border-t border-border hover:bg-muted/40">
              <td className="px-3 py-2 font-mono text-xs">{c.internalCode}</td>
              <td className="px-3 py-2">{c.name}</td>
              <td className="px-3 py-2">{c.category?.name ?? '—'}</td>
              <td className="px-3 py-2">{c.mpn ?? '—'}</td>
              <td className="px-3 py-2">{primaryValue(c)}</td>
              <td className="px-3 py-2">{c.footprint ?? '—'}</td>
            </tr>
          ))}
          {data && data.items.length === 0 && !isLoading && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                Nessun componente trovato.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
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
      <button onClick={() => setSort(field)} className="flex items-center gap-1 hover:text-foreground">
        {label}
        {active && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  );
}

/** Render the category's primary quantity parameter in engineering notation. */
function primaryValue(c: ComponentRow): string {
  const key = { resistors: 'resistance', capacitors: 'capacitance', inductors: 'inductance' }[
    c.category?.slug ?? ''
  ];
  if (!key) return '—';
  const raw = c.parameters?.[key];
  if (raw == null) return '—';
  const unit = { resistance: 'Ω', capacitance: 'F', inductance: 'H' }[key] ?? '';
  const q = parseQuantity(String(raw), unit);
  return q ? formatEngineering(q.magnitude, unit) : String(raw);
}

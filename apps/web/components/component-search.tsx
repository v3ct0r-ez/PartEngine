'use client';

import { searchComponents, type ComponentRow } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

/** Reusable inline component search/picker. Calls onPick with the chosen row. */
export function ComponentSearch({
  onPick,
  placeholder = 'Cerca componente…',
}: {
  onPick: (c: ComponentRow) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const { data } = useQuery({
    queryKey: ['comp-search', q],
    queryFn: () => searchComponents({ q, limit: 8 }),
    enabled: q.length >= 1,
  });

  return (
    <div className="relative">
      <input
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
      />
      {q && data && data.items.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-background shadow-lg">
          {data.items.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => {
                  onPick(c);
                  setQ('');
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-mono text-xs">{c.internalCode}</span>
                <span>{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

'use client';

import { ComponentsTable } from '@/components/components-table';
import { FilterSidebar } from '@/components/filter-sidebar';
import { useUiStore } from '@/lib/store';

export default function ComponentsPage() {
  const { query, setQuery } = useUiStore();
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Componenti</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Ricerca intelligente — es. "resistenza 10k 1% 0603"'
          className="w-96 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </header>
      <div className="flex gap-6">
        <FilterSidebar />
        <div className="flex-1">
          <ComponentsTable />
        </div>
      </div>
    </div>
  );
}

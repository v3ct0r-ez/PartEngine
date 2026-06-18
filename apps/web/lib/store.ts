import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RangeFilter } from './api';

/**
 * UI-only state (Zustand). Durable user preferences (saved views, columns)
 * live server-side via the persistent-memory API — this store just holds the
 * current working view, persisted to localStorage for fast reloads.
 */
interface UiState {
  query: string;
  category?: string;
  ranges: RangeFilter[];
  sortField?: string;
  sortDir: 'asc' | 'desc';
  setQuery: (q: string) => void;
  setCategory: (c?: string) => void;
  setRange: (field: string, from?: string, to?: string) => void;
  clearRanges: () => void;
  setSort: (field: string, dir?: 'asc' | 'desc') => void;
  applyView: (v: Partial<Pick<UiState, 'query' | 'category' | 'ranges' | 'sortField' | 'sortDir'>>) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      query: '',
      ranges: [],
      sortDir: 'asc',
      setQuery: (query) => set({ query }),
      setCategory: (category) => set({ category }),
      setRange: (field, from, to) => {
        const ranges = get().ranges.filter((r) => r.field !== field);
        if (from || to) ranges.push({ field, from, to });
        set({ ranges });
      },
      clearRanges: () => set({ ranges: [] }),
      setSort: (sortField, sortDir) =>
        set({ sortField, sortDir: sortDir ?? (get().sortDir === 'asc' ? 'desc' : 'asc') }),
      applyView: (v) =>
        set({
          query: v.query ?? '',
          category: v.category,
          ranges: v.ranges ?? [],
          sortField: v.sortField,
          sortDir: v.sortDir ?? 'asc',
        }),
    }),
    { name: 'partengine-ui' },
  ),
);

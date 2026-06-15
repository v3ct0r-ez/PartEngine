/** Thin typed client for the PartEngine API. */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ComponentRow {
  id: string;
  internalCode: string;
  name: string;
  mpn?: string | null;
  footprint?: string | null;
  parameters: Record<string, unknown>;
  category?: { slug: string; name: string };
  manufacturer?: { name: string } | null;
}

export interface SearchResult {
  items: ComponentRow[];
  nextCursor: string | null;
  parsed: unknown;
}

export interface RangeFilter {
  field: string;
  from?: string;
  to?: string;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function searchComponents(params: {
  q?: string;
  ranges?: RangeFilter[];
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  cursor?: string;
  limit?: number;
}): Promise<SearchResult> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.sortField) search.set('sortField', params.sortField);
  if (params.sortDir) search.set('sortDir', params.sortDir);
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit) search.set('limit', String(params.limit));
  (params.ranges ?? []).forEach((r, i) => {
    search.set(`ranges[${i}][field]`, r.field);
    if (r.from) search.set(`ranges[${i}][from]`, r.from);
    if (r.to) search.set(`ranges[${i}][to]`, r.to);
  });

  const res = await fetch(`${BASE}/api/components/search?${search}`, {
    headers: { ...authHeaders() },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

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

export type MovementType = 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT';

export interface StockSummary {
  componentId: string;
  quantity: number;
  reserved: number;
  onOrder: number;
  available: number;
  minQty: number;
  health: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'OK';
  byLocation: {
    locationId: string;
    locationCode: string;
    quantity: number;
    reserved: number;
    available: number;
  }[];
}

export interface Movement {
  id: string;
  type: MovementType;
  quantity: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  reason?: string | null;
  reference?: string | null;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...init?.headers },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface Notification {
  id: string;
  kind: 'LOW_STOCK' | 'CRITICAL_STOCK' | 'OUT_OF_STOCK' | 'ORDER_LATE' | 'MISSING_DATASHEET';
  entity: string;
  entityId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function listNotifications(unreadOnly = false) {
  return request<Notification[]>(`/notifications${unreadOnly ? '?unread=true' : ''}`);
}

export function markNotificationRead(id: string) {
  return request<Notification>(`/notifications/${id}/read`, { method: 'POST' });
}

export function markAllNotificationsRead() {
  return request<{ success: boolean }>(`/notifications/read-all`, { method: 'POST' });
}

export interface Supplier {
  id: string;
  name: string;
  contactEmail?: string | null;
  avgLeadTimeDays?: number | null;
  reliability?: string | null;
}

export function listSuppliers() {
  return request<Supplier[]>('/suppliers');
}

export function createSupplier(body: {
  name: string;
  contactEmail?: string;
  avgLeadTimeDays?: number;
}) {
  return request<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(body) });
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseNotes: string | null;
  publishedAt: string | null;
  checkedAt: string | null;
  applying: boolean;
  error: string | null;
}

export function getUpdateStatus() {
  return request<UpdateInfo>('/updates/status');
}

export function applyUpdate() {
  return request<{ started: boolean; targetVersion: string | null }>('/updates/apply', {
    method: 'POST',
  });
}

export function getComponentStock(id: string) {
  return request<StockSummary>(`/inventory/components/${id}/stock`);
}

export function getComponentMovements(id: string) {
  return request<Movement[]>(`/inventory/components/${id}/movements`);
}

export function createMovement(body: {
  type: MovementType;
  componentId: string;
  quantity: number;
  fromLocationId?: string;
  toLocationId?: string;
  reason?: string;
  reference?: string;
}) {
  return request<Movement>(`/inventory/movements`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
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

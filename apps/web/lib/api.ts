/** Thin typed client for the PartEngine API.
 *
 * Default is RELATIVE (same-origin): the browser calls `/api/...` on the Next
 * server, which proxies to the API via next.config rewrites. This avoids the
 * build-time-frozen NEXT_PUBLIC_API_URL pointing at the wrong port (the desktop
 * API is on 47600, not 4000) and sidesteps CORS. Override only if you really
 * want cross-origin calls. */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export interface ComponentRow {
  id: string;
  internalCode: string;
  name: string;
  mpn?: string | null;
  footprint?: string | null;
  parameters: Record<string, unknown>;
  manufacturerId?: string | null;
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

// ── Categories & fields (admin) ──────────────────────────────
export type FieldType = 'STRING' | 'TEXT' | 'NUMBER' | 'QUANTITY' | 'BOOLEAN' | 'ENUM' | 'DATE';

export interface CategoryField {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  unit?: string | null;
  options?: string[] | null;
  required: boolean;
  isFilterable?: boolean;
  isSortable?: boolean;
  sortOrder?: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon?: string | null;
  fields: CategoryField[];
  _count?: { components: number };
}

export function listCategories() {
  return request<Category[]>('/categories');
}
export function createCategory(body: { slug: string; name: string; icon?: string }) {
  return request<Category>('/categories', { method: 'POST', body: JSON.stringify(body) });
}
export function updateCategory(id: string, body: { name?: string; icon?: string }) {
  return request<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteCategory(id: string) {
  return request<{ deleted: boolean }>(`/categories/${id}`, { method: 'DELETE' });
}
export function addCategoryField(categoryId: string, body: Partial<CategoryField> & { key: string; label: string; type: FieldType }) {
  return request<CategoryField>(`/categories/${categoryId}/fields`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
export function updateCategoryField(fieldId: string, body: Partial<CategoryField>) {
  return request<CategoryField>(`/categories/fields/${fieldId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
export function deleteCategoryField(fieldId: string) {
  return request<{ deleted: boolean }>(`/categories/fields/${fieldId}`, { method: 'DELETE' });
}

// ── Manufacturers ─────────────────────────────────────────────
export interface Manufacturer {
  id: string;
  name: string;
  website?: string | null;
}
export function listManufacturers() {
  return request<Manufacturer[]>('/manufacturers');
}
export function createManufacturer(body: { name: string; website?: string }) {
  return request<Manufacturer>('/manufacturers', { method: 'POST', body: JSON.stringify(body) });
}

// ── Component CRUD ────────────────────────────────────────────
export interface ComponentInput {
  internalCode: string;
  name: string;
  categoryId: string;
  description?: string;
  mpn?: string;
  footprint?: string;
  manufacturerId?: string;
  tags?: string[];
  parameters?: Record<string, unknown>;
}

export function getComponent(id: string) {
  return request<ComponentRow & { parameters: Record<string, unknown>; categoryId?: string }>(
    `/components/${id}`,
  );
}
export function createComponent(body: ComponentInput) {
  return request<{ id: string }>('/components', { method: 'POST', body: JSON.stringify(body) });
}
export function updateComponent(id: string, body: Partial<ComponentInput>) {
  return request<{ id: string }>(`/components/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
export function deleteComponent(id: string) {
  return request<{ deleted: boolean }>(`/components/${id}`, { method: 'DELETE' });
}

export async function searchComponents(params: {
  q?: string;
  categorySlug?: string;
  ranges?: RangeFilter[];
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  cursor?: string;
  limit?: number;
}): Promise<SearchResult> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.categorySlug) search.set('categorySlug', params.categorySlug);
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

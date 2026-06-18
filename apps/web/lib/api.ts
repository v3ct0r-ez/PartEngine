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

// ── Authentication ────────────────────────────────────────────
export function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
}

export async function getAuthStatus(): Promise<{ needsSetup: boolean }> {
  const res = await fetch(`${BASE}/api/auth/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Impossibile contattare il server');
  return res.json();
}

function storeTokens(data: { accessToken: string; refreshToken?: string }) {
  localStorage.setItem('accessToken', data.accessToken);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
}

function getRefreshToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
}

// Single-flight refresh: concurrent 401s share one /auth/refresh call so the
// rotating refresh token isn't consumed (and invalidated) multiple times.
let refreshPromise: Promise<boolean> | null = null;
async function attemptRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      storeTokens(await res.json());
      return true;
    } catch {
      return false;
    }
  })();
  const ok = await refreshPromise;
  refreshPromise = null;
  return ok;
}

/**
 * Runs an authenticated fetch and, on a 401, transparently refreshes the access
 * token once and retries. Only if the refresh itself fails do we hard-logout —
 * so an expired access token no longer bounces the user to the login screen.
 * `doFetch` must read the auth header lazily so the retry uses the new token.
 */
async function withAuthRetry(doFetch: () => Promise<Response>): Promise<Response> {
  let res = await doFetch();
  if (res.status === 401) {
    if (await attemptRefresh()) res = await doFetch();
    else handleUnauthorized();
  }
  return res;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Credenziali non valide');
  const data = await res.json();
  storeTokens(data);
  return data;
}

/** First-run: create the initial administrator and log in. */
export async function setupAdmin(email: string, fullName: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, fullName, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Creazione account non riuscita');
  }
  const data = await res.json();
  storeTokens(data);
  return data;
}

export function logout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  location.reload();
}

// ── Users & access (SUPER_ADMIN) ──────────────────────────────
export type UserRole = 'SUPER_ADMIN' | 'WAREHOUSE_MANAGER' | 'TECHNICIAN' | 'PURCHASING' | 'VIEWER';
export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
}
export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  access: { warehouseId: string; warehouse: string; canWrite: boolean }[];
}
export function getMe() {
  return request<CurrentUser>('/auth/me');
}
export function listUsers() {
  return request<AdminUser[]>('/auth/users');
}
export function createUser(body: { email: string; fullName: string; password: string; role: UserRole }) {
  return request<AdminUser>('/auth/users', { method: 'POST', body: JSON.stringify(body) });
}
export function grantWarehouseAccess(body: { userId: string; warehouseId: string; canWrite: boolean }) {
  return request<unknown>('/auth/warehouse-access', { method: 'POST', body: JSON.stringify(body) });
}
export function changeMyPassword(currentPassword: string, newPassword: string) {
  return request<{ success: boolean }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
export function adminResetPassword(userId: string, newPassword: string) {
  return request<{ success: boolean }>(`/auth/users/${userId}/password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
}
export function setUserActive(userId: string, isActive: boolean) {
  return request<{ success: boolean }>(`/auth/users/${userId}/active`, {
    method: 'POST',
    body: JSON.stringify({ isActive }),
  });
}
export function setUserRole(userId: string, role: UserRole) {
  return request<{ success: boolean }>(`/auth/users/${userId}/role`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

/** Drop the token and bounce to the login gate when the session is invalid. */
function handleUnauthorized() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  location.reload();
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

/** Build a human-readable message from an API error body. Surfaces per-field
 *  validation details (e.g. "Valore: valore fuori intervallo") and class-
 *  validator arrays instead of a bare "Validation failed". */
function formatApiError(body: unknown, status: number): string {
  const b = body as { message?: unknown; errors?: Array<{ field?: string; message?: string }> };
  if (Array.isArray(b?.errors) && b.errors.length) {
    return b.errors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).join('; ');
  }
  if (Array.isArray(b?.message)) return (b.message as string[]).join('; ');
  if (typeof b?.message === 'string') return b.message;
  return `Richiesta non riuscita (${status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await withAuthRetry(() =>
    fetch(`${BASE}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...init?.headers },
      cache: 'no-store',
    }),
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(formatApiError(body, res.status));
  }
  // 204/empty body: a successful mutation with no payload — don't choke on JSON.parse.
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
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
  contactPhone?: string | null;
  website?: string | null;
  avgLeadTimeDays?: number | null;
  reliability?: string | null;
  notes?: string | null;
  _count?: { supplierParts: number; orders: number };
}

export interface SupplierInput {
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  avgLeadTimeDays?: number;
  reliability?: number;
  notes?: string;
}

export function listSuppliers() {
  return request<Supplier[]>('/suppliers');
}

export function createSupplier(body: SupplierInput & { name: string }) {
  return request<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(body) });
}
export function updateSupplier(id: string, body: SupplierInput) {
  return request<Supplier>(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteSupplier(id: string) {
  return request<{ deleted: boolean }>(`/suppliers/${id}`, { method: 'DELETE' });
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

export const LOCATION_KINDS = ['zone', 'shelf', 'cabinet', 'drawer', 'box'] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export interface WarehouseWithLocations {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  locations: { id: string; code: string; kind: string }[];
  _count?: { locations: number };
}
export function listWarehouses() {
  return request<WarehouseWithLocations[]>('/inventory/warehouses');
}

export function createWarehouse(body: { code: string; name: string; address?: string }) {
  return request<WarehouseWithLocations>('/inventory/warehouses', { method: 'POST', body: JSON.stringify(body) });
}
export function updateWarehouse(id: string, body: { code?: string; name?: string; address?: string }) {
  return request<WarehouseWithLocations>(`/inventory/warehouses/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteWarehouse(id: string) {
  return request<{ deleted: boolean }>(`/inventory/warehouses/${id}`, { method: 'DELETE' });
}

export interface LocationNode {
  id: string;
  code: string;
  kind: string;
  barcode: string | null;
  children: LocationNode[];
}
export function getLocationTree(warehouseId: string) {
  return request<LocationNode[]>(`/inventory/warehouses/${warehouseId}/locations`);
}
export function createLocation(body: {
  warehouseId: string;
  kind: LocationKind;
  code?: string; // required for a main location ("A-01"); derived for a slot
  parentId?: string; // set to create a slot inside a main location
  slot?: number; // explicit slot number; auto-assigned if omitted
  barcode?: string;
}) {
  return request<LocationNode>('/inventory/locations', { method: 'POST', body: JSON.stringify(body) });
}
export function updateLocation(id: string, body: { code?: string; kind?: LocationKind; barcode?: string }) {
  return request<LocationNode>(`/inventory/locations/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteLocation(id: string) {
  return request<{ deleted: boolean }>(`/inventory/locations/${id}`, { method: 'DELETE' });
}

export interface MovementRow extends Movement {
  componentId: string;
  unitPrice?: string | null;
  component?: { internalCode: string; name: string };
}
export function listRecentMovements(limit = 200) {
  return request<MovementRow[]>(`/inventory/movements?limit=${limit}`);
}

export function reserveStock(body: { componentId: string; locationId: string; quantity: number }) {
  return request<{ reserved: boolean }>(`/inventory/reserve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
export function releaseStock(body: { componentId: string; locationId: string; quantity: number }) {
  return request<{ released: boolean }>(`/inventory/release`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
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
  parentId?: string | null;
  isGroup?: boolean;
  codePrefix?: string | null;
  sortOrder?: number;
  fields: CategoryField[];
  _count?: { components: number };
}

export function listCategories() {
  return request<Category[]>('/categories');
}
export function createCategory(body: { slug: string; name: string; icon?: string; parentId?: string; isGroup?: boolean; codePrefix?: string }) {
  return request<Category>('/categories', { method: 'POST', body: JSON.stringify(body) });
}
export function updateCategory(id: string, body: { name?: string; icon?: string; codePrefix?: string; parentId?: string }) {
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
  _count?: { components: number };
}
export function listManufacturers() {
  return request<Manufacturer[]>('/manufacturers');
}
export function createManufacturer(body: { name: string; website?: string }) {
  return request<Manufacturer>('/manufacturers', { method: 'POST', body: JSON.stringify(body) });
}
export function updateManufacturer(id: string, body: { name?: string; website?: string }) {
  return request<Manufacturer>(`/manufacturers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteManufacturer(id: string) {
  return request<{ deleted: boolean }>(`/manufacturers/${id}`, { method: 'DELETE' });
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
  minQty?: number;
  maxQty?: number;
  idealQty?: number;
  avgPrice?: number;
  lastPrice?: number;
  currency?: string;
}

export interface ComponentDetail extends ComponentRow {
  parameters: Record<string, unknown>;
  categoryId?: string;
  minQty?: string | number | null;
  maxQty?: string | number | null;
  idealQty?: string | number | null;
  avgPrice?: string | number | null;
  lastPrice?: string | number | null;
  currency?: string | null;
}

export function getComponent(id: string) {
  return request<ComponentDetail>(`/components/${id}`);
}

// ── Supplier prices (per component) ───────────────────────────
export interface SupplierPart {
  id: string;
  supplierId: string;
  supplier?: { name: string };
  supplierSku?: string | null;
  unitPrice?: string | number | null;
  currency?: string | null;
  moq?: number | null;
  leadTimeDays?: number | null;
  isPreferred?: boolean;
}
export function listSupplierParts(componentId: string) {
  return request<SupplierPart[]>(`/components/${componentId}/supplier-parts`);
}
export function upsertSupplierPart(body: {
  supplierId: string;
  componentId: string;
  supplierSku?: string;
  unitPrice?: number;
  moq?: number;
  leadTimeDays?: number;
}) {
  return request<SupplierPart>('/supplier-parts', { method: 'POST', body: JSON.stringify(body) });
}

// ── Purchase orders ───────────────────────────────────────────
export interface PoSummary {
  id: string;
  code: string;
  status: string;
  supplier?: { name: string };
  expectedAt?: string | null;
  _count?: { lines: number };
}
export interface PoLine {
  id: string;
  componentId: string;
  quantity: string;
  received: string;
  unitPrice?: string | null;
  component?: { internalCode: string; name: string } | null;
}
export interface PoDetail extends PoSummary {
  lines: PoLine[];
}
export function listPurchaseOrders() {
  return request<PoSummary[]>('/purchase-orders');
}
export function getPurchaseOrder(id: string) {
  return request<PoDetail>(`/purchase-orders/${id}`);
}
export function createPurchaseOrder(body: {
  code: string;
  supplierId: string;
  expectedAt?: string;
  lines: { componentId: string; quantity: number; unitPrice?: number }[];
}) {
  return request<PoDetail>('/purchase-orders', { method: 'POST', body: JSON.stringify(body) });
}
export function submitPurchaseOrder(id: string, receivingLocationId: string) {
  return request<PoDetail>(`/purchase-orders/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ receivingLocationId }),
  });
}
export function receivePurchaseOrder(id: string, locationId: string, lines: { lineId: string; quantity: number }[]) {
  return request<PoDetail>(`/purchase-orders/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify({ locationId, lines }),
  });
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

// ── Attachments / datasheets ──────────────────────────────────
export interface Attachment {
  id: string;
  kind: 'DATASHEET' | 'IMAGE' | 'LABEL' | 'OTHER';
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}
export function listAttachments(componentId: string) {
  return request<Attachment[]>(`/components/${componentId}/attachments`);
}
export async function uploadAttachment(componentId: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await withAuthRetry(() =>
    fetch(`${BASE}/api/components/${componentId}/attachments`, {
      method: 'POST',
      headers: authHeaders(), // no Content-Type: the browser sets the multipart boundary
      body: fd,
    }),
  );
  if (!res.ok) throw new Error('Upload non riuscito');
  return res.json();
}
export function deleteAttachment(id: string) {
  return request<{ deleted: boolean }>(`/attachments/${id}`, { method: 'DELETE' });
}
export function suggestAttachmentFields(id: string) {
  return request<{ suggestions: Record<string, number>; footprint?: string; tolerance?: number }>(
    `/attachments/${id}/suggest-fields`,
  );
}
/** Fetch (with auth) and open an attachment in a new tab. */
export async function openAttachment(id: string) {
  const res = await withAuthRetry(() =>
    fetch(`${BASE}/api/attachments/${id}/download`, { headers: authHeaders() }),
  );
  if (!res.ok) throw new Error('Download non riuscito');
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank');
}

// ── Reports & dashboard ───────────────────────────────────────
export interface Dashboard {
  totalComponents: number;
  totalCategories: number;
  totalSuppliers: number;
  stockValue: number;
  currency: string;
  lowStock: number;
  outOfStock: number;
  movements30d: number;
  byCategory: { category: string; count: number }[];
}
export function getDashboard() {
  return request<Dashboard>('/reports/dashboard');
}
/** Fetch a CSV report with auth and trigger a browser download. */
export async function downloadReport(name: 'inventory' | 'value' | 'movements', filename: string) {
  const res = await withAuthRetry(() =>
    fetch(`${BASE}/api/reports/${name}.csv`, { headers: authHeaders() }),
  );
  if (!res.ok) throw new Error('Download non riuscito');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── BOM ───────────────────────────────────────────────────────
export type AvailabilityStatus = 'AVAILABLE' | 'PARTIAL' | 'MISSING';
export interface BomSummary {
  id: string;
  code: string;
  name: string;
  version: string;
  _count?: { lines: number };
}
export interface BomLineDetail {
  id: string;
  reference?: string | null;
  rawMpn?: string | null;
  required: number;
  available: number;
  matched: boolean;
  status: AvailabilityStatus;
  component?: { internalCode: string; name: string } | null;
}
export interface BomDetail extends BomSummary {
  notes?: string | null;
  status: AvailabilityStatus;
  lines: BomLineDetail[];
}

export function listBoms() {
  return request<BomSummary[]>('/boms');
}
export function getBom(id: string) {
  return request<BomDetail>(`/boms/${id}`);
}
export function createBom(body: { code: string; name: string; version?: string; lines?: unknown[] }) {
  return request<BomDetail>('/boms', { method: 'POST', body: JSON.stringify({ lines: [], ...body }) });
}
export function importBomCsv(id: string, csv: string, replace = true) {
  return request<{ imported: number; matched: number; unmatched: number }>(`/boms/${id}/import-csv`, {
    method: 'POST',
    body: JSON.stringify({ csv, replace }),
  });
}
export function createBomVersion(id: string, version: string) {
  return request<BomDetail>(`/boms/${id}/version`, { method: 'POST', body: JSON.stringify({ version }) });
}

// ── Kits ──────────────────────────────────────────────────────
export interface KitSummary {
  id: string;
  code: string;
  name: string;
  _count?: { lines: number };
}
export interface KitDetail extends KitSummary {
  lines: { id: string; componentId: string; quantity: string; component?: { internalCode: string; name: string } }[];
}
export function listKits() {
  return request<KitSummary[]>('/kits');
}
export function getKit(id: string) {
  return request<KitDetail>(`/kits/${id}`);
}
export function createKit(body: { code: string; name: string; lines: { componentId: string; quantity: number }[] }) {
  return request<KitDetail>('/kits', { method: 'POST', body: JSON.stringify(body) });
}
export function buildKit(id: string, body: { locationId: string; quantity: number }) {
  return request<{ built: number }>(`/kits/${id}/build`, { method: 'POST', body: JSON.stringify(body) });
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

  const res = await withAuthRetry(() =>
    fetch(`${BASE}/api/components/search?${search}`, {
      headers: { ...authHeaders() },
      cache: 'no-store',
    }),
  );
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

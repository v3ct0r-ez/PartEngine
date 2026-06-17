# Delivery plan — sprints

Two-week sprints, vertical slices (DB → API → UI → tests) so each ends with something usable.
Each story carries acceptance criteria; "Done" = code + tests (≥80% on touched modules) + docs.

## Sprint 0 — Foundations ✅ (this repo)
- Monorepo, Prisma schema, Docker infra, CI skeleton.
- `@partengine/core`: unit parser/sorter, search parser, dynamic fields, validation (tested).
- **AC:** `pnpm test` green; `docker compose up` brings up Postgres + MinIO.

## Sprint 1 — Auth, RBAC & audit ✅
- JWT access + rotating refresh, argon2 hashing, login/refresh/logout. ✅
- Roles (SUPER_ADMIN … VIEWER) via RolesGuard/@Roles + global JwtAuthGuard/@Public. ✅
- **Per-warehouse access guards**: WarehouseAccessService enforced on inventory
  movements / reserve / release / location create and PO receiving
  (SUPER_ADMIN & WAREHOUSE_MANAGER global; others need WarehouseAccess.canWrite). ✅
- Admin user management: `/auth/users` (create/list), `/auth/warehouse-access`
  (grant), `/auth/me`. ✅
- Global audit interceptor (user/op/new/reason/ip on every mutation). ✅
- **AC met:** unauthorized requests rejected (401/403); every mutation writes an
  `AuditLog` row.

## Sprint 2 — Components & categories CRUD ✅
- Category + CategoryField admin (data-driven), seed built-in categories. ✅
- Component CRUD with dynamic parameter validation + indexed projection. ✅
- Manufacturers: list/create API + inline "Produttore" select in the component editor. ✅
- **AC met:** create a resistor with `parameters` → `ComponentParameterValue` populated;
  components can be associated to a manufacturer (created on the fly).

## Sprint 3 — Search, filters & listing ✅
- FTS + trgm migration (trigger-maintained search_vector + gin_trgm indexes) ✅
- `/components/search`: NL parsing (built-in + custom categories), explicit
  category filter, numeric range filters, cursor pagination ✅
- **Unit-aware server-side sort**: sorting by a QUANTITY parameter orders by the
  indexed base-SI magnitude in ComponentParameterValue (100Ω < 1kΩ < 1MΩ), not
  lexically; scalar columns sort directly ✅
- Web: server-side sort/filter table, API-driven filter sidebar, sortable
  unit-aware "Valore" column (active category's primary QUANTITY field) ✅
- **AC met:** "resistenza 10k 1% 0603" returns expected rows; value sort is by
  magnitude.

## Sprint 4 — Inventory & movements ✅
- StockLevel per location; INBOUND/OUTBOUND/TRANSFER/ADJUSTMENT in transactions.
- Location tree (warehouse → zone → … → box).
- Reserve/release (reserved never exceeds physical qty); stock rollup + health.
- **AC met:** reserved/available correct; no oversell (atomic guarded decrements
  prevent it even under concurrency); StockMovement ledger is append-only.

## Sprint 5 — Suppliers, purchasing & notifications ✅
- Suppliers + SupplierPart upsert; PO create → submit (onOrder) → receive.
- Receiving stocks goods via the Sprint-4 transactional movement service, consumes
  onOrder, updates last/avg price, and recomputes PARTIAL/RECEIVED status.
- Alert engine: low/critical/out-of-stock, late orders, missing datasheet —
  event-driven (after receiving) + periodic sweep; auto-resolves stale alerts.
- **AC met:** receiving a PO raises stock; crossing min qty raises a notification
  (verified by the +5 core alert tests; UI bell + suppliers page).

## Sprint 6 — BOM, kits & assemblies ✅
- BOM CRUD + **versioning** + **CSV import** (matches components by MPN/code) +
  **availability check** per line (available/partial/missing) and overall.
- Kits/assemblies with **atomic** component consumption: building N kits
  decrements every line in one transaction (rolls back if any is short) and
  writes OUTBOUND movements referencing the kit.
- core (+4 tests, 40 total): lineStatus / bomOverallStatus / parseBomCsv (quoted
  fields, `;`/`,` delimiters).
- UI: `/boms` (create, CSV import, availability table, new version) and `/kits`
  (create with component lines, build from a location).
- **AC met:** building a kit decrements stock atomically; BOM shows the shortage
  list (PARTIAL/MISSING per line + overall status).

## Sprint 7 — Attachments, datasheets & OCR ✅
- Upload/list/download/delete attachments via a pluggable StorageService
  (local FS — works in the all-in-one desktop, no MinIO needed; S3 adapter is the
  server alternative).
- Datasheet text extraction: **PDF text layer via pdf-parse** (pure JS, no native
  deps) + `.txt`; stored in `Attachment.ocrText` and made **searchable** (component
  search also matches attachment ocrText). Manual `ocr-text` endpoint lets a
  server-side tesseract/BullMQ worker fill text for scanned/image PDFs.
- **Field suggestion** from the datasheet text (reuses the unit-aware NL parser)
  → fills category parameters + footprint in the editor.
- UI: attachments panel in the component editor (upload, open, delete, "suggerisci
  parametri").
- **AC met:** uploaded datasheet text is searchable; suggestions populate fields.

## Sprint 8 — Barcode/QR, reports & dashboard
- Label generation + print sheets; webcam + USB scanner input.
- Reports (inventory, value, movements, consumption) → PDF/Excel/CSV.
- Dashboard KPIs + charts.
- **AC:** scan a QR → component opens; export inventory to Excel.

## Sprint 10 — Component CRUD & category management ✅
- Components: full create / edit / delete from the UI (modal editor, dynamic
  per-category parameters, shared client/server validation, audited).
- Categories: admin CRUD — create new categories and add/edit/delete their
  "recognition" fields (the data-driven parameters) without code, via a
  dedicated UI (`/categories`). API: `categories` + `categories/:id/fields`.
- **AC:** add/modify/remove a stocked component; create a category and define
  its parameters, then use it when creating a component.

## Sprint 11 — Warehouse operations UI ✅
- Operations console (`/inventory`): pick a component (search) + warehouse/location
  selectors, then **carico/scarico/trasferimento/correzione**, **allocazione**
  (prenota/rilascia), live availability per location, and per-component history.
- Global **storico movimenti** (`/movements`) across all components.
- API: `GET /inventory/warehouses` (with locations) and `GET /inventory/movements`
  (global) added; movement/reserve/release logic reused from Sprint 4.
- **AC met:** load/unload/transfer/adjust a component and allocate stock from the
  UI without typing raw IDs; see the movement history.

## Sprint 9 — Hardening
- Performance pass (1M-row seed, partitioning, query plans), rate limiting, backups,
  E2E (Playwright), accessibility (WCAG) audit.
- **AC:** search <100ms at 1M rows; coverage ≥80%; a11y checks pass.

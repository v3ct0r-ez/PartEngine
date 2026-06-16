# Delivery plan — sprints

Two-week sprints, vertical slices (DB → API → UI → tests) so each ends with something usable.
Each story carries acceptance criteria; "Done" = code + tests (≥80% on touched modules) + docs.

## Sprint 0 — Foundations ✅ (this repo)
- Monorepo, Prisma schema, Docker infra, CI skeleton.
- `@partengine/core`: unit parser/sorter, search parser, dynamic fields, validation (tested).
- **AC:** `pnpm test` green; `docker compose up` brings up Postgres + MinIO.

## Sprint 1 — Auth, RBAC & audit
- JWT access/refresh, password hashing, login/refresh/logout.
- Roles (SUPER_ADMIN … VIEWER) + per-warehouse access guards.
- Global audit interceptor (old/new/reason/ip).
- **AC:** unauthorized requests rejected; every mutation produces an `AuditLog` row.

## Sprint 2 — Components & categories CRUD
- Category + CategoryField admin (data-driven), seed built-in categories.
- Component CRUD with dynamic parameter validation + indexed projection.
- Manufacturers.
- **AC:** create a resistor with `parameters`, see `ComponentParameterValue` populated.

## Sprint 3 — Search, filters & listing
- FTS + trgm migration; `/components/search` with NL parsing, range filters, keyset pagination.
- Web: components table (server-side sort/filter), filter sidebar, unit-aware sort.
- **AC:** "resistenza 10k 1% 0603" returns expected rows; sort is by magnitude; <100ms on seed.

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

## Sprint 6 — BOM, kits & assemblies
- BOM CRUD + versioning + CSV import; availability check (available/partial/missing).
- Kits/assemblies with automatic component consumption (transactional build).
- **AC:** building a kit decrements stock atomically; BOM shows shortage list.

## Sprint 7 — Attachments, datasheets & OCR
- S3 presigned upload; datasheet PDF + images; OCR worker → `Attachment.ocrText` into FTS.
- Field suggestion from extracted metadata.
- **AC:** uploaded datasheet text is searchable.

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

## Sprint 9 — Hardening
- Performance pass (1M-row seed, partitioning, query plans), rate limiting, backups,
  E2E (Playwright), accessibility (WCAG) audit.
- **AC:** search <100ms at 1M rows; coverage ≥80%; a11y checks pass.

# Implementation status — honest matrix

This repo is a **foundation**. Below is exactly what exists vs. what is scaffolded vs. todo,
mapped to the original spec. No vaporware.

Legend: ✅ implemented & tested · 🟡 scaffolded (structure + key code, not feature-complete) · ⬜ designed, not built

| Area | State | Notes |
|------|-------|-------|
| Monorepo, tooling, Docker infra | ✅ | workspace, compose (Postgres+MinIO), Dockerfiles present |
| Prisma data model (all entities) | ✅ | full schema; FTS/trgm via raw-SQL migration (documented) |
| Engineering-unit parser & sorter | ✅ | `packages/core`, 10 tests; Ω/kΩ/MΩ, pF/nF/µF, EIA notation |
| Natural-language search parser | ✅ | `packages/core`, 5 tests; "resistenza 10k 1% 0603"; aware of custom categories |
| Data-driven category taxonomy | ✅ | 2-level groups→categories (10 groups, ~45 categories, English slugs) with per-category recognition fields + code prefix; variant types as ENUM (dielectric/diode type/motor type); seeded, fully editable (add/edit groups, categories, fields, prefix) |
| Parameter validation + projection | ✅ | `packages/core`, drives forms + indexed sort |
| NestJS app skeleton + modules | ✅ | bootstrap, config, global validation + Prisma exception filter, all feature modules implemented |
| Auth (JWT + refresh) & RBAC guard | ✅ | Sprint 1: JWT+rotating refresh, argon2, RolesGuard, per-warehouse access (WarehouseAccessService), admin users/grant endpoints, /auth/me |
| Audit interceptor | ✅ | global interceptor persists user/op/new/reason/ip on every mutation |
| Component CRUD + search endpoint | ✅ | Sprint 10: create/update/delete + search; unified Components hub (list → component card with Warehouse tab + Edit); auto-generated internal code & name (editable); dynamic per-category params |
| Search, filters & listing | ✅ | Sprint 3: category + range filters, cursor pagination, unit-aware server-side sort (orders by indexed base-SI magnitude); sortable "Valore" column |
| Category management (admin) | ✅ | Sprint 10: create categories + add/edit/delete recognition fields, no code; UI at /categories; API categories(+fields) CRUD |
| Manufacturers | ✅ | list/create API (upsert by name) + inline "Produttore" select in the component editor (closes Sprint 2) |
| Next.js app + key components | ✅ | full App-Router UI: components hub, categories, ubicazioni, movimenti, BOM, fornitori, produttori, ordini, utenti, impostazioni; in-app dialog/toast + error boundary |
| Persistent memory (prefs/views/recent) | ✅ | `/me` API: preferences (theme/language/uiState), saved views (CRUD + default, per scope), recent items (deduped, capped); UI: theme selector in the account menu, saved views + recent searches on the Components page |
| Inventory & movements | ✅ | Sprint 4: IN/OUT/TRANSFER/ADJUST txns, concurrency-safe no-oversell, reserve/release, location tree, stock rollup + health; UI page; 10 tests |
| Auto-update system | ✅ | notify + one-click apply via GitHub Releases; semver compare (6 tests), gated/audited apply, backup-first updater script, admin banner; see docs/UPDATES.md |
| Update verifier (`.exe`) | ✅ | standalone CLI → Windows .exe (PE32+ verified); logic/mock/check/gating commands; tools/update-verifier |
| Desktop all-in-one (Electron) | ✅ | apps/desktop launcher fully implemented (embedded Postgres → migrate → API health-gated → Next → window/tray, local/LAN, graceful shutdown) + electron-updater wired (check/download/install via GitHub Releases, IPC bridge, desktop-aware banner); installer built in CI on a Windows runner. See docs/DESKTOP.md |
| Suppliers / purchasing | ✅ | Sprint 5 + economic UI: suppliers page, **Ordini** page (create→submit→receive, updates stock + avg/last price), per-supplier prices on the component card |
| Economic data | ✅ | component prices (avg/last/currency) + stock thresholds (min/ideal/max) editable; on-hand value; dashboard warehouse value; CSV value report |
| BOM / kits | ✅ | Sprint 6: BOM CRUD + versioning + CSV import + add/remove lines by hand (component search) + per-line availability; UI /boms; kits build API retained but UI removed as redundant; +4 core tests |
| Attachments / datasheet OCR | ✅ | Sprint 7: upload/list/download/delete (local FS storage), PDF/txt text extraction (pdf-parse) → searchable ocrText, field suggestion from datasheet; UI panel in editor. Image-OCR (tesseract) remains a server worker |
| Barcode/QR, reports, dashboard | ✅ | Sprint 8: QR labels + print, USB-scan to open, CSV reports (inventory/value/movements), dashboard KPIs + category chart. Webcam scan & xlsx/PDF = future |
| Notifications/alert engine | ✅ | Sprint 5: pure rules (5 tests) + service (event-driven + periodic sweep, dedupe + auto-resolve); list/read endpoints; UI bell |
| E2E (Playwright), 80% coverage | 🟡 | unit tests green; E2E config to add in Sprint 9 |

See [`SPRINTS.md`](SPRINTS.md) for the build-out order.

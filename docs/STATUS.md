# Implementation status — honest matrix

This repo is a **foundation**. Below is exactly what exists vs. what is scaffolded vs. todo,
mapped to the original spec. No vaporware.

Legend: ✅ implemented & tested · 🟡 scaffolded (structure + key code, not feature-complete) · ⬜ designed, not built

| Area | State | Notes |
|------|-------|-------|
| Monorepo, tooling, Docker infra | ✅ / 🟡 | workspace, compose (Postgres+MinIO), Dockerfiles present |
| Prisma data model (all entities) | ✅ | full schema; FTS/trgm via raw-SQL migration (documented) |
| Engineering-unit parser & sorter | ✅ | `packages/core`, 10 tests; Ω/kΩ/MΩ, pF/nF/µF, EIA notation |
| Natural-language search parser | ✅ | `packages/core`, 4 tests; "resistenza 10k 1% 0603" etc. |
| Data-driven category templates | ✅ | resistors, caps, inductors, MOSFET, buck, MCU built-in |
| Parameter validation + projection | ✅ | `packages/core`, drives forms + indexed sort |
| NestJS app skeleton + modules | 🟡 | bootstrap, config, auth/RBAC/audit/components module stubs |
| Auth (JWT + refresh) & RBAC guard | 🟡 | guard + decorators + strategy scaffolded |
| Audit interceptor | 🟡 | interceptor wired; persists old/new/reason/ip |
| Component CRUD + search endpoint | ✅ | Sprint 10: create/update/delete + search; UI modal editor (dynamic per-category params) |
| Category management (admin) | ✅ | Sprint 10: create categories + add/edit/delete recognition fields, no code; UI at /categories; API categories(+fields) CRUD |
| Manufacturers | ✅ | list/create API (upsert by name) + inline "Produttore" select in the component editor (closes Sprint 2) |
| Next.js app + key components | 🟡 | layout, components table, filter sidebar, dynamic form |
| Persistent memory (prefs/views/recent) | 🟡 | schema ✅; endpoints/UI scaffolded |
| Inventory & movements | ✅ | Sprint 4: IN/OUT/TRANSFER/ADJUST txns, concurrency-safe no-oversell, reserve/release, location tree, stock rollup + health; UI page; 10 tests |
| Auto-update system | ✅ | notify + one-click apply via GitHub Releases; semver compare (6 tests), gated/audited apply, backup-first updater script, admin banner; see docs/UPDATES.md |
| Update verifier (`.exe`) | ✅ | standalone CLI → Windows .exe (PE32+ verified); logic/mock/check/gating commands; tools/update-verifier |
| Desktop all-in-one (Electron) | 🟡 | apps/desktop launcher fully implemented (embedded Postgres → migrate → API health-gated → Next → window/tray, local/LAN, graceful shutdown) + electron-updater wired (check/download/install via GitHub Releases, IPC bridge, desktop-aware banner); installer built in CI on a Windows runner. See docs/DESKTOP.md |
| Suppliers / purchasing | ✅ | Sprint 5: suppliers + supplier parts, PO create/submit/receive (receiving stocks via transactional movements, onOrder + avg/last price + status); UI suppliers page |
| BOM / kits | ⬜ | schema ✅; Sprint 6 |
| Attachments / datasheet OCR | ⬜ | schema ✅ + S3 in compose; Sprint 7 |
| Barcode/QR, reports, dashboard | ⬜ | Sprint 8 |
| Notifications/alert engine | ✅ | Sprint 5: pure rules (5 tests) + service (event-driven + periodic sweep, dedupe + auto-resolve); list/read endpoints; UI bell |
| E2E (Playwright), 80% coverage | 🟡 | unit tests green; E2E config to add in Sprint 9 |

See [`SPRINTS.md`](SPRINTS.md) for the build-out order.

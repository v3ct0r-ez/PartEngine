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
| Component CRUD + search endpoint | 🟡 | service/controller stubs using core engine |
| Next.js app + key components | 🟡 | layout, components table, filter sidebar, dynamic form |
| Persistent memory (prefs/views/recent) | 🟡 | schema ✅; endpoints/UI scaffolded |
| Inventory & movements | ✅ | Sprint 4: IN/OUT/TRANSFER/ADJUST txns, concurrency-safe no-oversell, reserve/release, location tree, stock rollup + health; UI page; 10 tests |
| Suppliers / purchasing | ⬜ | schema ✅; Sprint 5 |
| BOM / kits | ⬜ | schema ✅; Sprint 6 |
| Attachments / datasheet OCR | ⬜ | schema ✅ + S3 in compose; Sprint 7 |
| Barcode/QR, reports, dashboard | ⬜ | Sprint 8 |
| Notifications/alert engine | ⬜ | schema ✅; Sprint 5 |
| E2E (Playwright), 80% coverage | 🟡 | unit tests green; E2E config to add in Sprint 9 |

See [`SPRINTS.md`](SPRINTS.md) for the build-out order.

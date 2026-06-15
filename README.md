# PartEngine

**Enterprise Warehouse Management System for electronic components.**

PartEngine is a modern, multi-user, multi-warehouse system for managing inventories of
electronic components — from a few hundred parts on a Makerspace shelf to **1M+ SKUs**
in a manufacturing operation. It is designed to replace spreadsheets and rival commercial
ERP/WMS tooling, with first-class support for the things that make *electronics* inventory
hard: engineering-unit values (Ω/kΩ/MΩ, pF/nF/µF), per-category technical parameters,
BOMs, and datasheet management.

> **Status — read this first.** This repository is a **production-grade foundation**, not a
> finished 6-month product. The hard, distinctive parts of the spec are *fully implemented and
> tested* (engineering-unit parsing & sorting, natural-language search parsing, the data-driven
> dynamic-form/category engine), the complete data model exists as a Prisma schema, and the
> backend/frontend/infra are scaffolded to be runnable and extended sprint-by-sprint. See
> [`docs/STATUS.md`](docs/STATUS.md) for the honest "done vs. scaffolded vs. todo" matrix.

---

## Monorepo layout

```
partengine/
├── apps/
│   ├── api/          # NestJS + Prisma backend (REST, RBAC, audit, search)
│   ├── web/          # Next.js (App Router) + Tailwind + shadcn/ui frontend
│   └── desktop/      # Electron all-in-one Windows app (bundles PostgreSQL+API+UI)
├── packages/
│   └── core/         # Framework-agnostic domain logic (units, search, schemas)
│                     #   ← the "smart engine", fully unit-tested, shared by api & web
├── infra/            # Docker Compose, Dockerfiles, init scripts
└── docs/             # Architecture, ER diagram, sprint plan, security
```

The `packages/core` split is deliberate: the engineering-unit math and the
search-query parser must produce **identical** results on the server (for sorting/filtering
in SQL) and in the browser (for instant UI feedback). Putting them in a shared, dependency-free
package guarantees one source of truth and lets us test the tricky logic in isolation.

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm docker:up          # Postgres + MinIO (S3)
pnpm db:migrate         # apply Prisma migrations
pnpm db:seed            # categories, field templates, demo data
pnpm dev                # api on :4000, web on :3000
```

## Documentation

| Document | Covers |
|----------|--------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture & **rationale for every tech choice** |
| [`docs/ER.md`](docs/ER.md) | Entity-relationship diagram (Mermaid) |
| [`docs/SEARCH.md`](docs/SEARCH.md) | Intelligent search + unit-aware sorting design |
| [`docs/DYNAMIC_FIELDS.md`](docs/DYNAMIC_FIELDS.md) | Data-driven category/parameter engine |
| [`docs/SPRINTS.md`](docs/SPRINTS.md) | Delivery plan (sprints, with acceptance criteria) |
| [`docs/SECURITY.md`](docs/SECURITY.md) | RBAC, audit, backup, encryption, rate-limiting |
| [`docs/UPDATES.md`](docs/UPDATES.md) | Auto-update (notify + one-click apply via GitHub Releases) |
| [`docs/DESKTOP.md`](docs/DESKTOP.md) | All-in-one Windows `.exe` (Electron: bundled PostgreSQL+API+UI) |
| [`docs/STATUS.md`](docs/STATUS.md) | What is implemented vs. scaffolded |

## Tech stack (summary)

Frontend: **Next.js · TypeScript · Tailwind · shadcn/ui · TanStack Query · Zustand**
Backend: **NestJS · TypeScript · Prisma · PostgreSQL** (FTS + `pg_trgm` fuzzy search)
Infra: **Docker Compose · MinIO (S3)** · JWT + RBAC · Vitest + Playwright

Full rationale in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

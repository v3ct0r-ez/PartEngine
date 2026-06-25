# Architecture & Technical Rationale

This document describes the PartEngine architecture and **justifies each major technical
choice** (a requirement of the spec: *"Ogni scelta tecnica deve essere motivata"*).

## 1. High-level architecture

```
                  ┌─────────────────────────────────────────────┐
   Browser ◄────► │  Next.js (App Router, RSC)                   │
   / Scanner      │  Tailwind + shadcn/ui · TanStack Query       │
                  │  Zustand (UI/session state)                  │
                  └───────────────┬─────────────────────────────┘
                                  │  REST/JSON (+ JWT)
                  ┌───────────────▼─────────────────────────────┐
                  │  NestJS API (modular)                        │
                  │  Auth/RBAC · Components · Inventory · BOM     │
                  │  Search · Audit · Notifications · Reports     │
                  └───┬──────────────────┬─────────────────┬─────┘
                      │ Prisma           │ S3 SDK          │ events
              ┌───────▼──────┐   ┌───────▼───────┐  ┌──────▼──────┐
              │ PostgreSQL    │   │ S3 / MinIO    │  │ BullMQ /    │
              │ FTS + pg_trgm │   │ datasheets,   │  │ Redis (jobs:│
              │ partitioning  │   │ images, label │  │ reports,    │
              │               │   │               │  │ alerts)     │
              └───────────────┘   └───────────────┘  └─────────────┘
```

A **modular monolith** is chosen over microservices. Rationale: a single team and a single
transactional domain (inventory must be strongly consistent — you cannot oversell a reserved
part) benefit far more from ACID transactions and local calls than from network boundaries.
NestJS modules give us clean seams so individual modules (e.g. reporting, exports) can be extracted
into separate services later *if* scale demands it, without rewriting the domain.

## 2. Frontend

| Choice | Why |
|--------|-----|
| **Next.js (App Router)** | Server Components stream large tables fast; file-based routing; built-in image optimization for component photos; same framework can host print-friendly label/report pages (SSR → PDF). |
| **TypeScript** | The domain is parameter-heavy and error-prone (units, voltages). End-to-end types from Prisma → DTO → client eliminate a whole class of bugs. |
| **Tailwind + shadcn/ui** | Industrial density UIs need tight control over spacing/typography. shadcn gives accessible (Radix) primitives we *own* (copied in, not a black-box dependency), so we can theme dark/light and meet WCAG. |
| **TanStack Query** | Server state ≠ client state. Query handles caching, background refetch, pagination, and optimistic updates for inventory moves — exactly the "open screen < 1s" + "search < 100ms perceived" goals. |
| **Zustand** | Tiny, unopinionated store for *UI* state only (open panels, selected columns, scanner mode). Persistent user prefs live in the DB (see Memory system), not in global JS state. |

## 3. Backend

| Choice | Why |
|--------|-----|
| **NestJS** | Opinionated DI + modules map 1:1 to the domain; guards/interceptors are the natural home for RBAC, audit logging, and rate limiting (cross-cutting concerns done once). |
| **Prisma** | Type-safe schema → client, painless migrations, and a readable single-file data model — critical for a 40+ table schema. We drop to raw SQL only where Prisma can't express it (FTS ranking, trigram similarity). |
| **PostgreSQL** | One database does everything we need: ACID inventory, JSONB for dynamic per-category parameters, **Full-Text Search** + **`pg_trgm`** for fuzzy search, partitioning for the 1M-row + audit/movement tables. Avoids bolting on Elasticsearch for v1. |

### Why PostgreSQL for search (not Elasticsearch)

The spec wants name/MPN/manufacturer/tag search, fuzzy matching, and natural-language queries
("resistenza 10k 1% 0603"). Postgres covers all three:

- **FTS** (`tsvector`/`tsquery`) with a generated `search_vector` column + GIN index for ranked text search.
- **`pg_trgm`** (`gin_trgm_ops`) for typo-tolerant fuzzy matching on MPN/codes.
- **Structured filtering** on the parsed tokens (10k → 10000 Ω, 1% tolerance, 0603 footprint) done in SQL against indexed columns.

A single store keeps inventory and search transactionally consistent and removes an entire
piece of infrastructure. Elasticsearch becomes a *later* optimization if/when scale or
relevance tuning demands it.

### Dynamic parameters: JSONB + a metadata registry

Per-category technical fields (resistor tolerance, MOSFET RDS(on), MCU flash size…) are stored
in a `parameters JSONB` column on `Component`, **described** by a data-driven
`CategoryField` registry (type, unit, validation, required, default). The frequently-filtered
numeric values are *also* projected into a normalized, indexed `ComponentParameterValue`
table (value + base-unit magnitude) so range filters and unit-aware sorting hit a B-tree index
instead of scanning JSONB. This hybrid gives schema flexibility **and** query speed. See
[`DYNAMIC_FIELDS.md`](DYNAMIC_FIELDS.md).

## 4. Scaling to 1M+ components

- **Server-side pagination** everywhere (keyset/cursor for deep pages, not OFFSET).
- **Indexes** chosen per access path: GIN (FTS, trgm, JSONB), B-tree (codes, FKs, parameter magnitudes), partial indexes (low-stock alerts).
- **Table partitioning** for append-heavy tables: `StockMovement` and `AuditLog` partitioned by month.
- **Read-after-write** kept inside transactions for inventory; everything else is cache-friendly via Query.
- **Connection pooling** (PgBouncer in prod).

## 5. Async work — Redis + BullMQ

Label batch generation, report exports, and alert evaluation are
offloaded to a job queue so API requests stay fast. This is the one place we add Redis;
it doubles as the rate-limit store.

## 6. Object storage

Datasheets (PDF), component images, and generated label sheets go to **S3-compatible** storage
(MinIO in dev, any S3 in prod) via presigned URLs — the API never proxies large blobs.

## 7. Observability & ops

Structured JSON logs (pino), health/readiness endpoints, OpenAPI (Swagger) generated from
Nest DTOs, and Prisma migration history as the schema source of truth. Backups & DR in
[`SECURITY.md`](SECURITY.md).

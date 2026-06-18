# Performance & hardening (Sprint 9)

Target (spec AC): **search < 100 ms at 1M rows**, **coverage ≥ 80 %**, **a11y checks pass**.

## Coverage
`packages/core` (the pure domain logic — units, search parsing, taxonomy,
validation, projection, inventory, BOM, alerts, versioning) is covered by
Vitest with a hard **80 % line threshold** enforced in
`packages/core/vitest.config.ts`. CI runs `pnpm --filter @partengine/core test
--coverage`; the build fails if coverage drops below the gate. Current line
coverage is ~97 %.

## End-to-end (Playwright)
`apps/web/e2e` drives the real app in Chromium:

- `auth.spec.ts` — the auth gate renders a usable form, the OS-replacement
  desktop title bar is absent in a browser, and the screen has **no
  serious/critical WCAG 2 A/AA violations** (axe-core).
- `components.spec.ts` — an authenticated journey: first-run admin setup →
  dashboard → navigate to the Components hub → natural-language search; plus an
  axe a11y scan of the dashboard.

The CI `e2e` job provisions Postgres, runs migrations, builds, starts the API
(`:47600`) and Next (`:3000`), then runs the suite with `E2E_NO_SERVER=1`.
Locally: `pnpm dev` (full stack) then `pnpm --filter @partengine/web test:e2e`.

## Accessibility (WCAG)
Accessibility is asserted in CI via `@axe-core/playwright` against the
`wcag2a`/`wcag2aa` rule sets, failing on any `serious`/`critical` violation.

## Search performance at scale
Search latency is held under the target by indexing rather than scanning:

| Query path | Index (migration `0_init`) |
|------------|----------------------------|
| Full-text (name/MPN/description/tags) | `search_vector tsvector` maintained by trigger + **GIN** index |
| Substring MPN / internal code | **GIN `gin_trgm_ops`** (`pg_trgm`) |
| JSON parameter containment | **GIN `jsonb_path_ops`** on `parameters` |
| Unit-aware range/sort on a parameter | B-tree `("fieldKey", "numeric")` on `ComponentParameterValue` (values stored as base-SI magnitude) |
| Category / manufacturer / stock joins | B-tree FK indexes on every hot column |

Because every range filter sorts and filters on the precomputed base-SI
`numeric` column through a B-tree, "resistenza 10k…1MΩ, ordina per valore"
stays an index range scan as the table grows — not a sequential scan.

To benchmark on a populated cluster: seed bulk rows, then
`EXPLAIN (ANALYZE, BUFFERS)` the search query and confirm Index/Bitmap scans
(no `Seq Scan` on `Component`).

## Rate limiting & backups
- Rate limiting: global `ThrottlerGuard` (configurable via
  `API_RATE_LIMIT_TTL` / `API_RATE_LIMIT_MAX`).
- Backups: the desktop build takes a consistent cold backup on graceful
  shutdown (see `docs/DESKTOP.md`).

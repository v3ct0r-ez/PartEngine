# Intelligent search, filters & unit-aware sorting

## Three layers

1. **Full-text search (FTS)** — name, internal code, MPN, manufacturer, tags, and aliases
   are concatenated into a maintained `search_vector tsvector` column with a GIN index.
   Ranked with `ts_rank`.
2. **Fuzzy search (`pg_trgm`)** — typo-tolerant matching on `mpn` / `internalCode` via
   `gin_trgm_ops` indexes and `similarity()` / `%`. Catches "STM32F013" → "STM32F103".
3. **Structured / natural-language parsing** — `parseSearchQuery` (`@partengine/core`) turns
   "resistenza 10k 1% 0603" into `{ category: 'resistors', params: { resistance: 10000 },
   tolerance: 1, footprint: '0603' }`, which becomes indexed predicates against
   `ComponentParameterValue`. It recognises both built-in category keywords **and
   admin-created categories**: the API builds a keyword→slug map from the live
   categories (`buildCategoryKeywords`, slug + name + name-words) and passes it via
   `parseSearchQuery(q, { categoryKeywords })` (cached ~60s).

A query string flows through all three: recognised tokens become structured predicates, the
remainder becomes an FTS/trgm query, and results are ranked and paginated server-side.

## Numeric range filters

Filters carry `{ from, to }` in base-SI units. Examples from the spec:

| Category | Range |
|----------|-------|
| Resistenze | 100 Ω → 10 MΩ |
| Condensatori | 1 pF → 10 mF |
| MOSFET (VDS) | 20 V → 100 V |

The UI accepts engineering notation ("10k", "4.7µF"); `parseQuantity` converts to magnitude,
and the API filters `ComponentParameterValue.numeric BETWEEN :from AND :to`.

## Unit-aware sorting

Sorting by a `QUANTITY` field orders by `ComponentParameterValue.numeric` (already in base SI),
so `100Ω, 220Ω, 470Ω, 1kΩ, 2.2kΩ, 4.7kΩ, 10kΩ, 100kΩ, 1MΩ` is correct — never alphabetical.
For client-side lists the identical logic is available via `sortByEngineeringValue`.

## Performance

- All searches are **server-side paginated** (keyset/cursor for deep pages).
- GIN indexes for FTS + trgm; B-tree on `(fieldKey, numeric)` for ranges/sort.
- Target: ranked search under ~100 ms on 1M components (single Postgres, no external engine).
- Migration path: if relevance/scale demands, project to Elasticsearch — the parser output is
  engine-agnostic.

## Example SQL (resistance range + FTS)

```sql
SELECT c.*, ts_rank(c.search_vector, q) AS rank
FROM "Component" c
JOIN "ComponentParameterValue" pv
  ON pv."componentId" = c.id AND pv."fieldKey" = 'resistance'
   , plainto_tsquery('simple', :text) q
WHERE c."deletedAt" IS NULL
  AND c."categoryId" = :categoryId
  AND pv.numeric BETWEEN :from AND :to        -- 100 .. 10_000_000
  AND (:text = '' OR c.search_vector @@ q)
ORDER BY pv.numeric ASC                        -- unit-aware
LIMIT :limit;
```

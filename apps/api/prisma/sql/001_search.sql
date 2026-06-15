-- Full-text search + fuzzy search setup for Component.
-- Apply after `prisma migrate` (Prisma can't express generated tsvector columns
-- or trigram indexes natively). See docs/SEARCH.md.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Generated tsvector aggregating the searchable text fields.
ALTER TABLE "Component"
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("internalCode", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("mpn", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'C') ||
    setweight(to_tsvector('simple', array_to_string("tags", ' ')), 'C') ||
    setweight(to_tsvector('simple', array_to_string("aliases", ' ')), 'C')
  ) STORED;

-- Ranked full-text search.
CREATE INDEX IF NOT EXISTS component_search_vector_idx
  ON "Component" USING GIN (search_vector);

-- Typo-tolerant fuzzy matching on identifiers.
CREATE INDEX IF NOT EXISTS component_mpn_trgm_idx
  ON "Component" USING GIN ("mpn" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS component_code_trgm_idx
  ON "Component" USING GIN ("internalCode" gin_trgm_ops);

-- JSONB containment queries on dynamic parameters.
CREATE INDEX IF NOT EXISTS component_parameters_gin_idx
  ON "Component" USING GIN ("parameters" jsonb_path_ops);

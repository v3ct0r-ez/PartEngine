-- Full-text search + fuzzy search setup for Component.
-- (Server/Docker path; the desktop app applies the same via prisma/migrations.)
--
-- search_vector is maintained by a TRIGGER, not a GENERATED column: the
-- text->regconfig cast inside to_tsvector(...) is STABLE, which Postgres rejects
-- in a generated/immutable expression. A BEFORE trigger has no such constraint.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Component" ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION pe_component_search_vector() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW."name", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW."internalCode", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW."mpn", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW."description", '')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(NEW."tags", ' ')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(NEW."aliases", ' ')), 'C');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS component_search_vector_trg ON "Component";
CREATE TRIGGER component_search_vector_trg
  BEFORE INSERT OR UPDATE ON "Component"
  FOR EACH ROW EXECUTE FUNCTION pe_component_search_vector();

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

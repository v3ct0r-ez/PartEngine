-- Category groups (2-level taxonomy) + per-category code prefix.
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "isGroup" boolean NOT NULL DEFAULT false;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "codePrefix" text;

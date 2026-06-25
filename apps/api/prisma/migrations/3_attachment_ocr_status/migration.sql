-- Track datasheet/image text-extraction state for the attachments UI.
-- NONE (n/a), PENDING (image/scanned-PDF OCR running), DONE, FAILED.
ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "ocrStatus" text NOT NULL DEFAULT 'NONE';

-- Backfill existing rows: those with text are DONE, the rest stay NONE.
UPDATE "Attachment" SET "ocrStatus" = 'DONE' WHERE "ocrText" IS NOT NULL AND length("ocrText") > 0;

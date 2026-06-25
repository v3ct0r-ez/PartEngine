-- Attachments are upload-only again: drop the datasheet text-extraction columns.
ALTER TABLE "Attachment" DROP COLUMN IF EXISTS "ocrText";
ALTER TABLE "Attachment" DROP COLUMN IF EXISTS "ocrStatus";

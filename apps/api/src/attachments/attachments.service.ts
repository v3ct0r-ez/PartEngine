import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { parseSearchQuery } from '@partengine/core';
import { AttachmentKind } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private kindFor(mimetype: string): AttachmentKind {
    if (mimetype === 'application/pdf') return 'DATASHEET';
    if (mimetype.startsWith('image/')) return 'IMAGE';
    return 'OTHER';
  }

  /** Best-effort text extraction so datasheet content becomes searchable. */
  private async extractText(file: UploadedFile): Promise<string | null> {
    try {
      if (file.mimetype === 'text/plain') return file.buffer.toString('utf8');
      if (file.mimetype === 'application/pdf') {
        // Use the internal entry to avoid pdf-parse's debug harness.
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        const data = await pdfParse(file.buffer);
        return (data.text as string)?.trim() || null;
      }
    } catch {
      // Scanned/image-only PDFs have no text layer; OCR fills ocrText instead.
      // Not fatal.
    }
    return null;
  }

  /**
   * OCR an image buffer with tesseract.js (lazy-loaded so it never weighs on
   * startup; the wasm core is bundled, only the language data is fetched once
   * and cached). Returns null on any failure (offline first run, undecodable
   * image, …) — OCR is best-effort, never fatal to the upload.
   */
  private async ocrImage(buffer: Buffer): Promise<string | null> {
    try {
      const tesseract = (await import('tesseract.js')) as unknown as {
        createWorker: (langs?: string, oem?: number, opts?: Record<string, unknown>) => Promise<{
          recognize: (img: Buffer) => Promise<{ data: { text: string } }>;
          terminate: () => Promise<unknown>;
        }>;
      };
      const cachePath = path.join(os.tmpdir(), 'partengine-ocr');
      const worker = await tesseract.createWorker('eng', 1, { cachePath });
      try {
        const { data } = await worker.recognize(buffer);
        return data.text?.trim() || null;
      } finally {
        await worker.terminate();
      }
    } catch (err) {
      this.logger.warn(`image OCR failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Background OCR for an uploaded image; fills ocrText when it completes. */
  private async runImageOcr(attachmentId: string, buffer: Buffer): Promise<void> {
    const text = await this.ocrImage(buffer);
    if (!text) return;
    try {
      await this.setOcrText(attachmentId, text);
    } catch {
      /* attachment may have been deleted meanwhile — ignore */
    }
  }

  async upload(componentId: string, file: UploadedFile) {
    const component = await this.prisma.component.findUnique({ where: { id: componentId } });
    if (!component) throw new NotFoundException('Component not found');

    const storageKey = `${componentId}/${randomUUID()}-${file.originalname}`.replace(/\s+/g, '_');
    await this.storage.save(storageKey, file.buffer);
    const ocrText = await this.extractText(file);

    const attachment = await this.prisma.attachment.create({
      data: {
        componentId,
        kind: this.kindFor(file.mimetype),
        fileName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
        ocrText,
      },
    });

    // Images have no extractable text layer: OCR them in the background so the
    // upload returns immediately and ocrText (searchable + suggestions) is
    // filled when the recognition finishes.
    if (!ocrText && file.mimetype.startsWith('image/')) {
      void this.runImageOcr(attachment.id, file.buffer);
    }

    return attachment;
  }

  list(componentId: string) {
    return this.prisma.attachment.findMany({
      where: { componentId },
      orderBy: { createdAt: 'desc' },
      // Don't ship the (possibly large) ocrText in the list.
      select: { id: true, kind: true, fileName: true, contentType: true, sizeBytes: true, createdAt: true },
    });
  }

  async getForDownload(id: string) {
    const att = await this.prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundException('Attachment not found');
    const buffer = await this.storage.read(att.storageKey);
    return { att, buffer };
  }

  async remove(id: string) {
    const att = await this.prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundException('Attachment not found');
    await this.storage.remove(att.storageKey);
    await this.prisma.attachment.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Set/replace the searchable text (e.g. from an external OCR worker). */
  async setOcrText(id: string, text: string) {
    return this.prisma.attachment.update({ where: { id }, data: { ocrText: text } });
  }

  /**
   * Suggest component parameter values from a datasheet's extracted text by
   * reusing the natural-language parser (unit-aware): returns { fieldKey: value }
   * for the component's category fields it can confidently fill, plus footprint.
   */
  async suggestFields(id: string) {
    const att = await this.prisma.attachment.findUnique({
      where: { id },
      include: { component: { include: { category: { include: { fields: true } } } } },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    if (!att.ocrText) return { suggestions: {}, footprint: undefined };

    const parsed = parseSearchQuery(att.ocrText.slice(0, 8000));
    const fieldKeys = new Set(att.component.category.fields.map((f) => f.key));
    const suggestions: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed.params)) {
      if (fieldKeys.has(key)) suggestions[key] = value;
    }
    return { suggestions, footprint: parsed.footprint, tolerance: parsed.tolerance };
  }
}

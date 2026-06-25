import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { decodeMpn, parseSearchQuery } from '@partengine/core';
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
   * Run OCR over one or more image buffers with tesseract.js, reusing a single
   * worker. Lazy-loaded so it never weighs on startup; the wasm core is bundled
   * and only the language data is fetched once and cached. Returns null on any
   * failure (offline first run, undecodable image, …) — OCR is best-effort.
   */
  private async ocrImages(images: Buffer[]): Promise<string | null> {
    if (!images.length) return null;
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
        const parts: string[] = [];
        for (const img of images) {
          const { data } = await worker.recognize(img);
          const t = data.text?.trim();
          if (t) parts.push(t);
        }
        return parts.join('\n').trim() || null;
      } finally {
        await worker.terminate();
      }
    } catch (err) {
      this.logger.warn(`image OCR failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * OCR a scanned (image-only) PDF: rasterize each page with pdf.js + a Node
   * canvas, then OCR the page images. Capped at a few pages to bound the work.
   */
  private async ocrPdf(buffer: Buffer): Promise<string | null> {
    try {
      const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as any;
      const { createCanvas } = (await import('@napi-rs/canvas')) as any;
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
      const maxPages = Math.min(doc.numPages as number, 5);
      const pages: Buffer[] = [];
      for (let i = 1; i <= maxPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2 }); // upscale for legible OCR
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push(canvas.toBuffer('image/png'));
      }
      await doc.destroy();
      return this.ocrImages(pages);
    } catch (err) {
      this.logger.warn(`PDF OCR failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Background OCR for an image or scanned PDF; sets ocrText + ocrStatus. */
  private async runOcr(attachmentId: string, buffer: Buffer, mimetype: string): Promise<void> {
    const text = mimetype === 'application/pdf' ? await this.ocrPdf(buffer) : await this.ocrImages([buffer]);
    try {
      await this.prisma.attachment.update({
        where: { id: attachmentId },
        data: { ocrText: text, ocrStatus: text ? 'DONE' : 'FAILED' },
      });
    } catch {
      /* attachment may have been deleted meanwhile — ignore */
    }
  }

  async upload(componentId: string, file: UploadedFile) {
    const component = await this.prisma.component.findUnique({ where: { id: componentId } });
    if (!component) throw new NotFoundException('Component not found');

    const storageKey = `${componentId}/${randomUUID()}-${file.originalname}`.replace(/\s+/g, '_');
    await this.storage.save(storageKey, file.buffer);
    const ocrText = await this.extractText(file); // text layer (txt / PDF with text)

    // Decide the extraction state. Images and text-less PDFs are OCR'd in the
    // background (status PENDING) so the upload returns immediately.
    const isImage = file.mimetype.startsWith('image/');
    const isPdf = file.mimetype === 'application/pdf';
    const willOcr = !ocrText && (isImage || isPdf);
    const ocrStatus = ocrText
      ? 'DONE'
      : willOcr
        ? 'PENDING'
        : file.mimetype === 'text/plain'
          ? 'FAILED'
          : 'NONE';

    const attachment = await this.prisma.attachment.create({
      data: {
        componentId,
        kind: this.kindFor(file.mimetype),
        fileName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
        ocrText,
        ocrStatus,
      },
    });

    if (willOcr) void this.runOcr(attachment.id, file.buffer, file.mimetype);

    return attachment;
  }

  list(componentId: string) {
    return this.prisma.attachment.findMany({
      where: { componentId },
      orderBy: { createdAt: 'desc' },
      // Don't ship the (possibly large) ocrText in the list.
      select: { id: true, kind: true, fileName: true, contentType: true, sizeBytes: true, createdAt: true, ocrStatus: true },
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
    return this.prisma.attachment.update({ where: { id }, data: { ocrText: text, ocrStatus: text ? 'DONE' : 'FAILED' } });
  }

  /**
   * Suggest component parameter values from a datasheet's extracted text by
   * reusing the natural-language parser (unit-aware): returns { fieldKey: value }
   * for the component's category fields it can confidently fill, plus footprint.
   *
   * Family datasheets list many values (a resistor family varies only by
   * resistance), and the parser keeps the last value per unit — meaningless for
   * a family. When an `mpn` is given and found in the text, we narrow parsing to
   * the window around that occurrence, so the values belonging to that specific
   * variant win.
   */
  async suggestFields(id: string, mpn?: string) {
    const att = await this.prisma.attachment.findUnique({
      where: { id },
      include: { component: { include: { category: { include: { fields: true } } } } },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    const fieldKeys = new Set(att.component.category.fields.map((f) => f.key));

    // 1) MPN decoding first — deterministic and reliable for passive families,
    // where a family datasheet wouldn't state the variant's values in text.
    const decoded = mpn ? decodeMpn(mpn) : null;
    if (decoded) {
      const suggestions: Record<string, number> = {};
      for (const [key, value] of Object.entries(decoded.params)) {
        if (fieldKeys.has(key)) suggestions[key] = value;
      }
      return {
        suggestions,
        footprint: decoded.footprint,
        tolerance: decoded.tolerance,
        dielectric: decoded.dielectric,
        source: 'mpn' as const,
        family: decoded.family,
      };
    }

    // 2) Fall back to parsing the datasheet text (scoped to the MPN occurrence).
    if (!att.ocrText) return { suggestions: {}, footprint: undefined, source: 'ocr' as const };
    const text = this.scopeToMpn(att.ocrText, mpn).slice(0, 8000);
    const parsed = parseSearchQuery(text);
    const suggestions: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed.params)) {
      if (fieldKeys.has(key)) suggestions[key] = value;
    }
    return { suggestions, footprint: parsed.footprint, tolerance: parsed.tolerance, source: 'ocr' as const };
  }

  /**
   * Narrow the OCR text to the neighbourhood of the MPN occurrence (the table
   * row / paragraph for that specific part), so a family datasheet resolves to
   * the variant's values. Falls back to the full text if the MPN isn't found.
   */
  private scopeToMpn(text: string, mpn?: string): string {
    const needle = mpn?.trim();
    if (!needle) return text;
    const idx = text.toLowerCase().indexOf(needle.toLowerCase());
    if (idx < 0) return text;
    const start = Math.max(0, idx - 200);
    const end = Math.min(text.length, idx + needle.length + 400);
    return text.slice(start, end);
  }
}

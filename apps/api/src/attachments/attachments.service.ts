import { Injectable, NotFoundException } from '@nestjs/common';
import { parseSearchQuery } from '@partengine/core';
import { AttachmentKind } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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
      // Scanned/image-only PDFs have no text layer; OCR (tesseract worker) would
      // fill ocrText in the server deployment. Not fatal.
    }
    return null;
  }

  async upload(componentId: string, file: UploadedFile) {
    const component = await this.prisma.component.findUnique({ where: { id: componentId } });
    if (!component) throw new NotFoundException('Component not found');

    const storageKey = `${componentId}/${randomUUID()}-${file.originalname}`.replace(/\s+/g, '_');
    await this.storage.save(storageKey, file.buffer);
    const ocrText = await this.extractText(file);

    return this.prisma.attachment.create({
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

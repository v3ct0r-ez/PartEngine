import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
   * Extract parameters from the datasheet with an LLM (provider-agnostic via an
   * OpenAI-compatible chat-completions endpoint, e.g. Google Gemini's free tier).
   * The model uses the MPN to pick the right variant out of a family datasheet
   * and returns each category field's value, which we map straight into the
   * editor's params. Best-effort: provider/parse errors surface as a 400.
   */
  async aiExtract(id: string, opts: { apiKey: string; model: string; baseUrl: string; mpn?: string }) {
    const att = await this.prisma.attachment.findUnique({
      where: { id },
      include: { component: { include: { category: { include: { fields: true } } } } },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    if (!att.ocrText) return { suggestions: {}, paramValues: {}, source: 'ai' as const };

    const fields = att.component.category.fields;
    const fieldList = fields
      .map((f) => {
        const options = Array.isArray(f.options) ? (f.options as string[]) : [];
        const meta = `${f.type}${f.unit ? `, unit ${f.unit}` : ''}${options.length ? `, options: ${options.join(' | ')}` : ''}`;
        return `- ${f.key} (${f.label}) [${meta}]`;
      })
      .join('\n');
    const text = att.ocrText.slice(0, 12000);

    const system =
      'You extract electronic-component parameters from a datasheet for ONE specific manufacturer part number (MPN). ' +
      'Datasheets often describe a whole family of variants — use the given MPN to select the correct values. ' +
      'Only return a value when the datasheet supports it for THIS MPN; omit fields you are unsure about. Reply with a single JSON object and no prose.';
    const user =
      `MPN: ${opts.mpn?.trim() || '(unknown — infer from the text if possible)'}\n\n` +
      `Fields to fill. For QUANTITY include the unit (e.g. "100kΩ", "25V", "100mW"). For ENUM use exactly one of the listed options. For footprint/package use the package code (e.g. "0603", "SOT-23").\n${fieldList}\n\n` +
      `Return JSON shaped exactly as {"values": {"<fieldKey>": "<value>"}} using only the field keys above.\n\n` +
      `--- DATASHEET TEXT ---\n${text}`;

    const url = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const payload = JSON.stringify({
      model: opts.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const doFetch = () =>
      fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
        body: payload,
      });

    let res: globalThis.Response;
    try {
      res = await doFetch();
      // A 429 is often a transient per-minute limit — wait once and retry.
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 6000));
        res = await doFetch();
      }
    } catch (err) {
      throw new BadRequestException(`AI provider unreachable: ${(err as Error).message}`);
    }
    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      // Pull the provider's human message out of the JSON error envelope, if any.
      let providerMsg = '';
      try {
        const j = JSON.parse(raw);
        providerMsg = (Array.isArray(j) ? j[0]?.error?.message : j?.error?.message) || '';
      } catch {
        providerMsg = raw;
      }
      if (res.status === 429) {
        throw new BadRequestException(
          'Quota AI esaurita (piano gratuito): hai superato il limite di richieste. Attendi qualche minuto e riprova, oppure cambia modello in Impostazioni. Dettagli: https://ai.google.dev/gemini-api/docs/rate-limits',
        );
      }
      if (res.status === 401 || res.status === 403) {
        throw new BadRequestException('Chiave AI non valida o senza permessi. Controlla la API key in Impostazioni.');
      }
      if (res.status === 404) {
        throw new BadRequestException(`Modello AI non trovato ("${opts.model}"). Correggi il nome del modello in Impostazioni.`);
      }
      throw new BadRequestException(`Errore provider AI (${res.status}): ${providerMsg.slice(0, 200)}`);
    }
    const data: any = await res.json().catch(() => null);
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    const parsed = this.parseJsonLoose(content);
    const values = parsed && typeof parsed.values === 'object' && parsed.values ? parsed.values : parsed;

    const fieldKeys = new Set(fields.map((f) => f.key));
    const paramValues: Record<string, string> = {};
    if (values && typeof values === 'object') {
      for (const [key, value] of Object.entries(values)) {
        if (fieldKeys.has(key) && value != null && String(value).trim() !== '') {
          paramValues[key] = String(value).trim();
        }
      }
    }
    return { suggestions: {}, paramValues, source: 'ai' as const, model: opts.model };
  }

  /** Parse a JSON object out of an LLM reply, tolerating ```json fences / prose. */
  private parseJsonLoose(s: string): any {
    if (!s) return null;
    const fenced = s.replace(/```(?:json)?/gi, '');
    const start = fenced.indexOf('{');
    const end = fenced.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(fenced.slice(start, end + 1));
    } catch {
      return null;
    }
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

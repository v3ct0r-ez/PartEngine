import { Injectable, NotFoundException } from '@nestjs/common';
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

  async upload(componentId: string, file: UploadedFile) {
    const component = await this.prisma.component.findUnique({ where: { id: componentId } });
    if (!component) throw new NotFoundException('Component not found');

    const storageKey = `${componentId}/${randomUUID()}-${file.originalname}`.replace(/\s+/g, '_');
    await this.storage.save(storageKey, file.buffer);

    return this.prisma.attachment.create({
      data: {
        componentId,
        kind: this.kindFor(file.mimetype),
        fileName: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
      },
    });
  }

  list(componentId: string) {
    return this.prisma.attachment.findMany({
      where: { componentId },
      orderBy: { createdAt: 'desc' },
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
}

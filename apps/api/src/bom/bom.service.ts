import { Injectable, NotFoundException } from '@nestjs/common';
import { bomOverallStatus, lineStatus, parseBomCsv } from '@partengine/core';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBomDto, ImportCsvDto } from './bom.dto';

@Injectable()
export class BomService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateBomDto) {
    return this.prisma.bom.create({
      data: {
        code: dto.code,
        name: dto.name,
        version: dto.version ?? '1.0',
        notes: dto.notes,
        lines: {
          create: (dto.lines ?? []).map((l) => ({
            componentId: l.componentId,
            rawMpn: l.rawMpn,
            reference: l.reference,
            quantity: l.quantity,
          })),
        },
      },
      include: { lines: true },
    });
  }

  findAll() {
    return this.prisma.bom.findMany({
      orderBy: [{ code: 'asc' }, { version: 'asc' }],
      include: { _count: { select: { lines: true } } },
    });
  }

  /** BOM with per-line availability computed from current stock. */
  async findOne(id: string) {
    const bom = await this.prisma.bom.findUnique({
      where: { id },
      include: { lines: { include: { component: { select: { internalCode: true, name: true } } } } },
    });
    if (!bom) throw new NotFoundException('BOM not found');

    const componentIds = bom.lines.map((l) => l.componentId).filter((x): x is string => !!x);
    const availability = await this.availableByComponent(componentIds);

    const lines = bom.lines.map((l) => {
      const required = Number(l.quantity);
      const available = l.componentId ? (availability.get(l.componentId) ?? 0) : 0;
      return {
        ...l,
        required,
        available,
        matched: !!l.componentId,
        status: l.componentId ? lineStatus(required, available) : 'MISSING',
      };
    });

    return { ...bom, lines, status: bomOverallStatus(lines.map((l) => l.status)) };
  }

  async importCsv(id: string, dto: ImportCsvDto) {
    const bom = await this.prisma.bom.findUnique({ where: { id } });
    if (!bom) throw new NotFoundException('BOM not found');

    const parsed = parseBomCsv(dto.csv);
    // Match each parsed line to a component by MPN or internal code.
    const lines = await Promise.all(
      parsed.map(async (p) => {
        const component = p.mpn
          ? await this.prisma.component.findFirst({
              where: { deletedAt: null, OR: [{ mpn: p.mpn }, { internalCode: p.mpn }] },
              select: { id: true },
            })
          : null;
        return {
          bomId: id,
          componentId: component?.id,
          rawMpn: p.mpn,
          reference: p.reference,
          quantity: p.quantity,
        };
      }),
    );

    await this.prisma.$transaction(async (tx) => {
      if (dto.replace !== false) await tx.bomLine.deleteMany({ where: { bomId: id } });
      if (lines.length) await tx.bomLine.createMany({ data: lines });
    });

    const matched = lines.filter((l) => l.componentId).length;
    return { imported: lines.length, matched, unmatched: lines.length - matched };
  }

  /** Add a single component line by hand (component picked from the warehouse). */
  async addLine(id: string, input: { componentId: string; reference?: string; quantity: number }) {
    const bom = await this.prisma.bom.findUnique({ where: { id } });
    if (!bom) throw new NotFoundException('BOM not found');
    const component = await this.prisma.component.findFirst({
      where: { id: input.componentId, deletedAt: null },
      select: { id: true, mpn: true },
    });
    if (!component) throw new NotFoundException('Componente non trovato');
    return this.prisma.bomLine.create({
      data: {
        bomId: id,
        componentId: component.id,
        rawMpn: component.mpn,
        reference: input.reference,
        quantity: input.quantity,
      },
    });
  }

  /** Remove a single line from a BOM. */
  async removeLine(id: string, lineId: string) {
    const line = await this.prisma.bomLine.findFirst({ where: { id: lineId, bomId: id } });
    if (!line) throw new NotFoundException('Riga non trovata');
    await this.prisma.bomLine.delete({ where: { id: lineId } });
    return { deleted: true };
  }

  /** Create a new version of a BOM, copying its lines. */
  async createVersion(id: string, version: string) {
    const src = await this.prisma.bom.findUnique({ where: { id }, include: { lines: true } });
    if (!src) throw new NotFoundException('BOM not found');
    return this.prisma.bom.create({
      data: {
        code: src.code,
        name: src.name,
        version,
        notes: src.notes,
        lines: {
          create: src.lines.map((l) => ({
            componentId: l.componentId,
            rawMpn: l.rawMpn,
            reference: l.reference,
            quantity: l.quantity,
          })),
        },
      },
      include: { lines: true },
    });
  }

  /** Total available (quantity − reserved) per component across all locations. */
  private async availableByComponent(componentIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (componentIds.length === 0) return map;
    const levels = await this.prisma.stockLevel.findMany({
      where: { componentId: { in: componentIds } },
      select: { componentId: true, quantity: true, reserved: true },
    });
    for (const l of levels) {
      const avail = Number(l.quantity) - Number(l.reserved);
      map.set(l.componentId, (map.get(l.componentId) ?? 0) + avail);
    }
    return map;
  }
}

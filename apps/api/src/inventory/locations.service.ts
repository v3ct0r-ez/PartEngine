import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLocationDto, UpdateLocationDto } from './inventory.dto';

export interface LocationNode {
  id: string;
  code: string;
  kind: string;
  barcode: string | null;
  children: LocationNode[];
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Coding convention:
  //   • Main location  →  "A-01"      (one+ letters, dash, two digits)
  //   • Slot inside it →  "A-01-1"    (parent code + "-" + slot number)
  static readonly MAIN_CODE = /^[A-Z]+-\d{2}$/;

  async create(dto: CreateLocationDto) {
    if (dto.parentId) {
      // Slot: must hang off a *main* location in the same warehouse; the code is
      // derived as `${parentCode}-${slot}` so the last number is the slot index.
      const parent = await this.prisma.location.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.warehouseId !== dto.warehouseId) {
        throw new BadRequestException("L'ubicazione padre deve appartenere allo stesso magazzino");
      }
      if (parent.parentId) {
        throw new BadRequestException('Gli slot si creano solo dentro un’ubicazione principale (es. A-01)');
      }
      const slot = dto.slot ?? (await this.nextSlot(parent.id));
      return this.prisma.location.create({
        data: {
          warehouseId: dto.warehouseId,
          parentId: parent.id,
          kind: dto.kind,
          code: `${parent.code}-${slot}`,
          barcode: dto.barcode,
        },
      });
    }

    // Main location: enforce the "A-01" format.
    const code = this.normalizeMainCode(dto.code);
    return this.prisma.location.create({
      data: { warehouseId: dto.warehouseId, kind: dto.kind, code, barcode: dto.barcode },
    });
  }

  private normalizeMainCode(raw?: string): string {
    const code = (raw ?? '').trim().toUpperCase();
    if (!LocationsService.MAIN_CODE.test(code)) {
      throw new BadRequestException(
        'Ubicazione principale: usa il formato Lettera-NN (una lettera e due cifre), es. A-01',
      );
    }
    return code;
  }

  /** Next free slot number inside a main location (max trailing number + 1). */
  private async nextSlot(parentId: string): Promise<number> {
    const children = await this.prisma.location.findMany({
      where: { parentId },
      select: { code: true },
    });
    let max = 0;
    for (const c of children) {
      const m = c.code.match(/-(\d+)$/);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return max + 1;
  }

  async update(id: string, dto: UpdateLocationDto) {
    const loc = await this.prisma.location.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException('Ubicazione non trovata');

    // Slots can't be renamed freely — their code is derived from the parent.
    if (loc.parentId) {
      return this.prisma.location.update({
        where: { id },
        data: { kind: dto.kind, barcode: dto.barcode },
      });
    }

    // Main location: validate the new code and cascade-rename its slots
    // (A-01-* → NEW-*) so the convention stays consistent.
    if (dto.code !== undefined && dto.code.trim().toUpperCase() !== loc.code) {
      const newCode = this.normalizeMainCode(dto.code);
      return this.prisma.$transaction(async (tx) => {
        const slots = await tx.location.findMany({ where: { parentId: id }, select: { id: true, code: true } });
        for (const s of slots) {
          const suffix = s.code.slice(loc.code.length); // keeps the "-1" part
          await tx.location.update({ where: { id: s.id }, data: { code: `${newCode}${suffix}` } });
        }
        return tx.location.update({ where: { id }, data: { code: newCode, kind: dto.kind, barcode: dto.barcode } });
      });
    }

    return this.prisma.location.update({
      where: { id },
      data: { kind: dto.kind, barcode: dto.barcode },
    });
  }

  /** Delete a location only when it has no children and no stock on it. */
  async remove(id: string) {
    const loc = await this.prisma.location.findUnique({
      where: { id },
      include: {
        _count: { select: { children: true } },
        stockLevels: { select: { quantity: true, reserved: true } },
      },
    });
    if (!loc) throw new NotFoundException('Ubicazione non trovata');
    if (loc._count.children > 0) {
      throw new ConflictException('Rimuovi prima le sotto-ubicazioni');
    }
    const hasStock = loc.stockLevels.some((s) => Number(s.quantity) !== 0 || Number(s.reserved) !== 0);
    if (hasStock) {
      throw new ConflictException('Ubicazione non vuota: sposta o azzera la giacenza prima di eliminarla');
    }
    await this.prisma.location.delete({ where: { id } });
    return { deleted: true };
  }

  /** Build the nested location tree (warehouse → zone → … → box) in one query. */
  async tree(warehouseId: string): Promise<LocationNode[]> {
    const flat = await this.prisma.location.findMany({
      where: { warehouseId },
      orderBy: { code: 'asc' },
    });

    const byId = new Map<string, LocationNode>();
    for (const l of flat) {
      byId.set(l.id, { id: l.id, code: l.code, kind: l.kind, barcode: l.barcode, children: [] });
    }

    const roots: LocationNode[] = [];
    for (const l of flat) {
      const node = byId.get(l.id)!;
      if (l.parentId && byId.has(l.parentId)) byId.get(l.parentId)!.children.push(node);
      else roots.push(node);
    }
    return roots;
  }
}

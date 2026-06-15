import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLocationDto } from './inventory.dto';

interface LocationNode {
  id: string;
  code: string;
  kind: string;
  barcode: string | null;
  children: LocationNode[];
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLocationDto) {
    // A parent must live in the same warehouse, keeping the tree consistent.
    if (dto.parentId) {
      const parent = await this.prisma.location.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.warehouseId !== dto.warehouseId) {
        throw new BadRequestException('Parent location must be in the same warehouse');
      }
    }
    return this.prisma.location.create({
      data: {
        warehouseId: dto.warehouseId,
        parentId: dto.parentId,
        kind: dto.kind,
        code: dto.code,
        barcode: dto.barcode,
      },
    });
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

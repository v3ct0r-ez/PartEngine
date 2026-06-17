import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BuildKitDto, CreateKitDto } from './kits.dto';

@Injectable()
export class KitsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateKitDto) {
    return this.prisma.kit.create({
      data: {
        code: dto.code,
        name: dto.name,
        notes: dto.notes,
        lines: { create: dto.lines.map((l) => ({ componentId: l.componentId, quantity: l.quantity })) },
      },
      include: { lines: true },
    });
  }

  findAll() {
    return this.prisma.kit.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { lines: true } } },
    });
  }

  findOne(id: string) {
    return this.prisma.kit.findUnique({
      where: { id },
      include: { lines: { include: { component: { select: { internalCode: true, name: true } } } } },
    });
  }

  /**
   * Build `quantity` kits from a location, consuming components ATOMICALLY:
   * every line is decremented with a guarded update inside one transaction, so
   * if any component is short the whole build rolls back (no partial consumption).
   * Each consumption writes an OUTBOUND movement referencing the kit.
   */
  async build(kitId: string, dto: BuildKitDto, userId?: string) {
    if (dto.quantity <= 0) throw new BadRequestException('Build quantity must be > 0');
    const kit = await this.prisma.kit.findUnique({ where: { id: kitId }, include: { lines: true } });
    if (!kit) throw new NotFoundException('Kit not found');
    if (kit.lines.length === 0) throw new BadRequestException('Kit has no components');

    return this.prisma.$transaction(async (tx) => {
      for (const line of kit.lines) {
        const need = Number(line.quantity) * dto.quantity;
        const res = await tx.stockLevel.updateMany({
          where: { componentId: line.componentId, locationId: dto.locationId, quantity: { gte: need } },
          data: { quantity: { decrement: need } },
        });
        if (res.count === 0) {
          // Throwing rolls back every decrement done so far in this transaction.
          throw new ConflictException(
            `Insufficient stock to build: component ${line.componentId} needs ${need}`,
          );
        }
        await tx.stockMovement.create({
          data: {
            type: 'OUTBOUND',
            componentId: line.componentId,
            fromLocationId: dto.locationId,
            quantity: need,
            reference: `KIT ${kit.code}`,
            reason: `Assemblaggio kit ${kit.code} ×${dto.quantity}`,
            userId,
          },
        });
      }
      return { kitId, built: dto.quantity, lines: kit.lines.length };
    });
  }
}

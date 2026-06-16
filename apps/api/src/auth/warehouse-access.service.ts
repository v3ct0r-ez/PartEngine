import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface Actor {
  id: string;
  role: string;
}

/**
 * Per-warehouse access enforcement (on top of the global Role). SUPER_ADMIN and
 * WAREHOUSE_MANAGER have global write access; other roles need an explicit
 * WarehouseAccess row with canWrite=true for the target warehouse.
 */
@Injectable()
export class WarehouseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanWrite(actor: Actor | undefined, warehouseId: string): Promise<void> {
    if (!actor) return; // internal call (no HTTP actor) — not access-gated here
    if (actor.role === 'SUPER_ADMIN' || actor.role === 'WAREHOUSE_MANAGER') return;
    const access = await this.prisma.warehouseAccess.findUnique({
      where: { userId_warehouseId: { userId: actor.id, warehouseId } },
    });
    if (!access?.canWrite) {
      throw new ForbiddenException('No write access to this warehouse');
    }
  }

  async warehouseOfLocation(locationId: string): Promise<string> {
    const loc = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { warehouseId: true },
    });
    if (!loc) throw new NotFoundException(`Location ${locationId} not found`);
    return loc.warehouseId;
  }

  /** Check write access for every warehouse touched by a stock movement. */
  async assertMovementAccess(
    actor: Actor | undefined,
    dto: { fromLocationId?: string; toLocationId?: string },
  ): Promise<void> {
    if (!actor) return;
    const warehouses = new Set<string>();
    for (const loc of [dto.fromLocationId, dto.toLocationId]) {
      if (loc) warehouses.add(await this.warehouseOfLocation(loc));
    }
    for (const wh of warehouses) await this.assertCanWrite(actor, wh);
  }
}

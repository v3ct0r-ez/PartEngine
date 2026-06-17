import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  assertMovementInput,
  InventoryError,
  stockHealth,
  summarizeStock,
  type MovementType,
} from '@partengine/core';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateMovementDto, ReservationDto } from './inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a stock movement and update affected StockLevels atomically.
   *
   * Oversell is prevented *concurrently*: decrements run as guarded
   * `updateMany`/raw updates that only apply when enough stock exists, so two
   * simultaneous OUTBOUNDs can never drive a location negative. The
   * StockMovement row is the immutable ledger.
   */
  async createMovement(dto: CreateMovementDto, userId?: string) {
    try {
      assertMovementInput({
        type: dto.type,
        quantity: dto.quantity,
        fromLocationId: dto.fromLocationId,
        toLocationId: dto.toLocationId,
        reason: dto.reason,
      });
    } catch (err) {
      if (err instanceof InventoryError) throw new BadRequestException(err.message);
      throw err;
    }

    return this.prisma.$transaction(async (tx) => {
      const qty = dto.quantity;

      switch (dto.type as MovementType) {
        case 'INBOUND':
          await this.increment(tx, dto.componentId, dto.toLocationId!, qty);
          break;
        case 'OUTBOUND':
          await this.decrementOrThrow(tx, dto.componentId, dto.fromLocationId!, qty);
          break;
        case 'TRANSFER':
          await this.decrementOrThrow(tx, dto.componentId, dto.fromLocationId!, qty);
          await this.increment(tx, dto.componentId, dto.toLocationId!, qty);
          break;
        case 'ADJUSTMENT': {
          const locationId = (dto.fromLocationId ?? dto.toLocationId)!;
          if (qty >= 0) await this.increment(tx, dto.componentId, locationId, qty);
          else await this.decrementOrThrow(tx, dto.componentId, locationId, -qty);
          break;
        }
      }

      return tx.stockMovement.create({
        data: {
          type: dto.type,
          componentId: dto.componentId,
          fromLocationId: dto.fromLocationId,
          toLocationId: dto.toLocationId,
          quantity: qty,
          unitPrice: dto.unitPrice,
          reference: dto.reference,
          reason: dto.reason,
          userId,
        },
      });
    });
  }

  private async increment(
    tx: Prisma.TransactionClient,
    componentId: string,
    locationId: string,
    qty: number,
  ) {
    await tx.stockLevel.upsert({
      where: { componentId_locationId: { componentId, locationId } },
      create: { componentId, locationId, quantity: qty },
      update: { quantity: { increment: qty } },
    });
  }

  /** Atomic guarded decrement; throws if it would oversell. */
  private async decrementOrThrow(
    tx: Prisma.TransactionClient,
    componentId: string,
    locationId: string,
    qty: number,
  ) {
    const res = await tx.stockLevel.updateMany({
      where: { componentId, locationId, quantity: { gte: qty } },
      data: { quantity: { decrement: qty } },
    });
    if (res.count === 0) {
      throw new ConflictException(
        `Insufficient stock for component ${componentId} at location ${locationId}`,
      );
    }
  }

  /** Soft hold: reserved may never exceed physically present quantity. */
  async reserve(dto: ReservationDto) {
    const affected = await this.prisma.$executeRaw`
      UPDATE "StockLevel" SET reserved = reserved + ${dto.quantity}
      WHERE "componentId" = ${dto.componentId}
        AND "locationId" = ${dto.locationId}
        AND quantity - reserved >= ${dto.quantity}`;
    if (affected === 0) throw new ConflictException('Not enough available to reserve');
    return { reserved: true };
  }

  async release(dto: ReservationDto) {
    const affected = await this.prisma.$executeRaw`
      UPDATE "StockLevel" SET reserved = reserved - ${dto.quantity}
      WHERE "componentId" = ${dto.componentId}
        AND "locationId" = ${dto.locationId}
        AND reserved >= ${dto.quantity}`;
    if (affected === 0) throw new ConflictException('Cannot release more than reserved');
    return { released: true };
  }

  /** Component-level rollup across all locations, with health classification. */
  async componentStock(componentId: string) {
    const component = await this.prisma.component.findUnique({
      where: { id: componentId },
      include: { stockLevels: { include: { location: true } } },
    });
    if (!component) throw new NotFoundException('Component not found');

    const levels = component.stockLevels.map((l) => ({
      quantity: Number(l.quantity),
      reserved: Number(l.reserved),
      onOrder: Number(l.onOrder),
    }));
    const summary = summarizeStock(levels);
    return {
      componentId,
      ...summary,
      minQty: Number(component.minQty),
      health: stockHealth(summary.available, Number(component.minQty)),
      byLocation: component.stockLevels.map((l) => ({
        locationId: l.locationId,
        locationCode: l.location.code,
        quantity: Number(l.quantity),
        reserved: Number(l.reserved),
        available: Number(l.quantity) - Number(l.reserved),
      })),
    };
  }

  async movementHistory(componentId: string, limit = 100) {
    return this.prisma.stockMovement.findMany({
      where: { componentId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  /** Warehouses with their (flat) locations — for the operations UI selectors. */
  listWarehouses() {
    return this.prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
      include: { locations: { orderBy: { code: 'asc' } } },
    });
  }

  /** Global recent movement history across all components. */
  async recentMovements(limit = 100) {
    return this.prisma.stockMovement.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      include: { component: { select: { internalCode: true, name: true } } },
    });
  }
}

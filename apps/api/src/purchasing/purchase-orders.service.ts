import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreatePurchaseOrderDto,
  ReceiveOrderDto,
  SubmitOrderDto,
} from './purchasing.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly notifications: NotificationsService,
  ) {}

  create(dto: CreatePurchaseOrderDto) {
    return this.prisma.purchaseOrder.create({
      data: {
        code: dto.code,
        supplierId: dto.supplierId,
        expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : undefined,
        status: 'DRAFT',
        lines: {
          create: dto.lines.map((l) => ({
            componentId: l.componentId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        },
      },
      include: { lines: true },
    });
  }

  findAll() {
    return this.prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: { supplier: { select: { name: true } }, _count: { select: { lines: true } } },
    });
  }

  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true, supplier: true },
    });
    if (!po) return null;
    // PurchaseOrderLine has no Prisma relation to Component — enrich names here.
    const ids = po.lines.map((l) => l.componentId).filter((x): x is string => !!x);
    const comps = await this.prisma.component.findMany({
      where: { id: { in: ids } },
      select: { id: true, internalCode: true, name: true },
    });
    const byId = new Map(comps.map((c) => [c.id, c]));
    return {
      ...po,
      lines: po.lines.map((l) => ({ ...l, component: l.componentId ? byId.get(l.componentId) ?? null : null })),
    };
  }

  /** Mark a draft as ordered and record the expected incoming stock (onOrder). */
  async submit(id: string, dto: SubmitOrderDto) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id }, include: { lines: true } });
    if (!po) throw new NotFoundException('Order not found');
    if (po.status !== 'DRAFT') throw new BadRequestException('Only DRAFT orders can be submitted');

    await this.prisma.$transaction(async (tx) => {
      for (const line of po.lines) {
        await tx.stockLevel.upsert({
          where: {
            componentId_locationId: {
              componentId: line.componentId!,
              locationId: dto.receivingLocationId,
            },
          },
          create: {
            componentId: line.componentId!,
            locationId: dto.receivingLocationId,
            onOrder: line.quantity,
          },
          update: { onOrder: { increment: line.quantity } },
        });
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'ORDERED', orderedAt: new Date() },
      });
    });

    return this.findOne(id);
  }

  /**
   * Receive (fully or partially) into a location. Each received line creates an
   * INBOUND stock movement via the Sprint-4 transactional InventoryService
   * (immutable ledger, correct stock), decrements onOrder, updates the line and
   * the component's last/average price, then recomputes the order status and
   * re-evaluates stock alerts for the affected components.
   */
  async receive(id: string, dto: ReceiveOrderDto, userId?: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id }, include: { lines: true } });
    if (!po) throw new NotFoundException('Order not found');
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
      throw new BadRequestException(`Order is ${po.status}`);
    }

    const affected = new Set<string>();

    for (const recv of dto.lines) {
      const line = po.lines.find((l) => l.id === recv.lineId);
      if (!line || !line.componentId) throw new BadRequestException(`Unknown line ${recv.lineId}`);
      const outstanding = Number(line.quantity) - Number(line.received);
      if (recv.quantity <= 0 || recv.quantity > outstanding) {
        throw new BadRequestException(
          `Invalid received quantity for line ${recv.lineId} (outstanding ${outstanding})`,
        );
      }

      // Stock in via the transactional movement service (immutable ledger).
      await this.inventory.createMovement(
        {
          type: 'INBOUND',
          componentId: line.componentId,
          quantity: recv.quantity,
          toLocationId: dto.locationId,
          unitPrice: line.unitPrice ? Number(line.unitPrice) : undefined,
          reference: po.code,
        },
        userId,
      );

      // Consume the matching onOrder at the receiving location (never below 0).
      await this.prisma.$executeRaw`
        UPDATE "StockLevel" SET "onOrder" = GREATEST("onOrder" - ${recv.quantity}, 0)
        WHERE "componentId" = ${line.componentId} AND "locationId" = ${dto.locationId}`;

      await this.prisma.purchaseOrderLine.update({
        where: { id: line.id },
        data: { received: { increment: recv.quantity } },
      });

      if (line.unitPrice) await this.updatePricing(line.componentId, Number(line.unitPrice), recv.quantity);
      affected.add(line.componentId);
    }

    await this.recomputeStatus(id);
    for (const componentId of affected) await this.notifications.evaluateComponent(componentId);

    return this.findOne(id);
  }

  /** lastPrice = received price; avgPrice = quantity-weighted moving average. */
  private async updatePricing(componentId: string, price: number, qty: number) {
    const component = await this.prisma.component.findUnique({
      where: { id: componentId },
      include: { stockLevels: true },
    });
    if (!component) return;
    const onHand = component.stockLevels.reduce((s, l) => s + Number(l.quantity), 0);
    const prevQty = Math.max(onHand - qty, 0);
    const prevAvg = component.avgPrice ? Number(component.avgPrice) : price;
    const newAvg = prevQty + qty > 0 ? (prevAvg * prevQty + price * qty) / (prevQty + qty) : price;
    await this.prisma.component.update({
      where: { id: componentId },
      data: { lastPrice: price, avgPrice: newAvg },
    });
  }

  private async recomputeStatus(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id }, include: { lines: true } });
    if (!po) return;
    const fully = po.lines.every((l) => Number(l.received) >= Number(l.quantity));
    const any = po.lines.some((l) => Number(l.received) > 0);
    const status = fully ? 'RECEIVED' : any ? 'PARTIAL' : po.status;
    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status, receivedAt: fully ? new Date() : po.receivedAt },
    });
  }
}

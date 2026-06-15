import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  evaluateComponentAlerts,
  isOrderLate,
  stockAlertMessage,
  summarizeStock,
  type NotificationKind,
} from '@partengine/core';
import { PrismaService } from '../prisma/prisma.service';

const STOCK_KINDS: NotificationKind[] = ['LOW_STOCK', 'CRITICAL_STOCK', 'OUT_OF_STOCK'];

/**
 * Alert engine. Evaluation rules live in @partengine/core; this service decides
 * *what to scan* and persists/clears Notification rows.
 *
 * Two trigger paths:
 *  - event-driven: evaluateComponent(id) is called right after stock changes
 *    (e.g. PO receiving) so alerts react immediately ("crossing min qty raises
 *    a notification").
 *  - periodic: a background sweep (re-evaluates low-min components + late orders).
 *    In production this is a BullMQ/Redis job; here it's a bounded interval.
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer?: NodeJS.Timeout;
  private readonly intervalMin = Number(process.env.ALERT_SCAN_INTERVAL_MIN ?? 15);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (this.intervalMin > 0) {
      this.timer = setInterval(
        () => void this.evaluateAll().catch((e) => this.logger.warn(e.message)),
        this.intervalMin * 60_000,
      );
      this.timer.unref?.();
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Re-evaluate a single component and reconcile its stock/datasheet alerts. */
  async evaluateComponent(componentId: string) {
    const component = await this.prisma.component.findUnique({
      where: { id: componentId },
      include: { stockLevels: true, attachments: { where: { kind: 'DATASHEET' } } },
    });
    if (!component || component.deletedAt) return;

    const levels = component.stockLevels.map((l) => ({
      quantity: Number(l.quantity),
      reserved: Number(l.reserved),
      onOrder: Number(l.onOrder),
    }));
    const { available } = summarizeStock(levels);
    const minQty = Number(component.minQty);
    const hasDatasheet = component.attachments.length > 0 || !!component.datasheetUrl;

    const active = evaluateComponentAlerts({ available, minQty, hasDatasheet });

    // Raise newly-active alerts (deduped against existing unread ones)…
    for (const kind of active) {
      await this.createIfAbsent(
        kind,
        'Component',
        component.id,
        stockAlertMessage(kind, component.name, available, minQty),
      );
    }
    // …and auto-resolve stock alerts that no longer apply.
    const staleStock = STOCK_KINDS.filter((k) => !active.includes(k));
    if (staleStock.length) {
      await this.prisma.notification.updateMany({
        where: { entityId: component.id, kind: { in: staleStock }, isRead: false },
        data: { isRead: true },
      });
    }
  }

  /** Flag open purchase orders whose expected date has passed. */
  async evaluateLateOrders() {
    const open = await this.prisma.purchaseOrder.findMany({
      where: { status: { in: ['ORDERED', 'PARTIAL'] }, expectedAt: { not: null } },
      include: { supplier: true },
    });
    const now = new Date();
    for (const po of open) {
      if (isOrderLate(po.status, po.expectedAt, now)) {
        await this.createIfAbsent(
          'ORDER_LATE',
          'PurchaseOrder',
          po.id,
          `Ordine ${po.code} (${po.supplier.name}) in ritardo.`,
        );
      }
    }
  }

  /** Bounded periodic sweep. Production: batch via a queue across all components. */
  async evaluateAll(limit = 1000) {
    const candidates = await this.prisma.component.findMany({
      where: { deletedAt: null, minQty: { gt: 0 } },
      select: { id: true },
      take: limit,
    });
    for (const c of candidates) await this.evaluateComponent(c.id);
    await this.evaluateLateOrders();
  }

  list(params: { unreadOnly?: boolean; kind?: NotificationKind } = {}) {
    return this.prisma.notification.findMany({
      where: {
        ...(params.unreadOnly ? { isRead: false } : {}),
        ...(params.kind ? { kind: params.kind } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  markRead(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead() {
    await this.prisma.notification.updateMany({ where: { isRead: false }, data: { isRead: true } });
    return { success: true };
  }

  private async createIfAbsent(
    kind: NotificationKind,
    entity: string,
    entityId: string,
    message: string,
  ) {
    const existing = await this.prisma.notification.findFirst({
      where: { kind, entityId, isRead: false },
    });
    if (!existing) {
      await this.prisma.notification.create({ data: { kind, entity, entityId, message } });
    }
  }
}

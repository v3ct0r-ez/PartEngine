import { Injectable } from '@nestjs/common';
import { stockHealth } from '@partengine/core';
import { PrismaService } from '../prisma/prisma.service';

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Aggregate available (quantity − reserved) and on-hand per component. */
  private async stockByComponent() {
    const grouped = await this.prisma.stockLevel.groupBy({
      by: ['componentId'],
      _sum: { quantity: true, reserved: true, onOrder: true },
    });
    const map = new Map<string, { qty: number; reserved: number; onOrder: number }>();
    for (const g of grouped) {
      map.set(g.componentId, {
        qty: Number(g._sum.quantity ?? 0),
        reserved: Number(g._sum.reserved ?? 0),
        onOrder: Number(g._sum.onOrder ?? 0),
      });
    }
    return map;
  }

  async dashboard() {
    const [components, stock, byCatRaw, categories, suppliers, since] = await Promise.all([
      this.prisma.component.findMany({
        where: { deletedAt: null },
        select: { id: true, avgPrice: true, lastPrice: true, minQty: true, categoryId: true },
      }),
      this.stockByComponent(),
      this.prisma.component.groupBy({ by: ['categoryId'], where: { deletedAt: null }, _count: true }),
      this.prisma.category.findMany({ select: { id: true, name: true } }),
      this.prisma.supplier.count(),
      this.prisma.stockMovement.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
      }),
    ]);

    let stockValue = 0;
    let lowStock = 0;
    let outOfStock = 0;
    for (const c of components) {
      const s = stock.get(c.id) ?? { qty: 0, reserved: 0, onOrder: 0 };
      // Average price, falling back to the last price.
      const unitPrice = c.avgPrice != null ? Number(c.avgPrice) : c.lastPrice != null ? Number(c.lastPrice) : 0;
      stockValue += s.qty * unitPrice;
      const health = stockHealth(s.qty - s.reserved, Number(c.minQty));
      if (health === 'OUT_OF_STOCK') outOfStock++;
      else if (health === 'LOW' || health === 'CRITICAL') lowStock++;
    }

    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const byCategory = byCatRaw
      .map((g) => ({ category: catName.get(g.categoryId) ?? '—', count: g._count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalComponents: components.length,
      totalCategories: categories.length,
      totalSuppliers: suppliers,
      stockValue: Math.round(stockValue * 100) / 100,
      currency: 'EUR',
      lowStock,
      outOfStock,
      movements30d: since,
      byCategory,
    };
  }

  async inventoryCsv(): Promise<string> {
    const components = await this.prisma.component.findMany({
      where: { deletedAt: null },
      include: { category: true },
      orderBy: { internalCode: 'asc' },
    });
    const stock = await this.stockByComponent();
    const rows = components.map((c) => {
      const s = stock.get(c.id) ?? { qty: 0, reserved: 0, onOrder: 0 };
      return [c.internalCode, c.name, c.category?.name, c.mpn, s.qty, s.reserved, s.onOrder, Number(c.minQty)];
    });
    return toCsv(['Codice', 'Nome', 'Categoria', 'MPN', 'Disponibile', 'Riservato', 'In ordine', 'Minimo'], rows);
  }

  async valueCsv(): Promise<string> {
    const components = await this.prisma.component.findMany({
      where: { deletedAt: null },
      orderBy: { internalCode: 'asc' },
    });
    const stock = await this.stockByComponent();
    const rows = components.map((c) => {
      const qty = stock.get(c.id)?.qty ?? 0;
      const avg = c.avgPrice != null ? Number(c.avgPrice) : c.lastPrice != null ? Number(c.lastPrice) : 0;
      return [c.internalCode, c.name, avg, qty, Math.round(avg * qty * 100) / 100, c.currency];
    });
    return toCsv(['Codice', 'Nome', 'Prezzo medio', 'Giacenza', 'Valore', 'Valuta'], rows);
  }

  async movementsCsv(): Promise<string> {
    const movements = await this.prisma.stockMovement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5000,
      include: { component: { select: { internalCode: true, name: true } } },
    });
    const rows = movements.map((m) => [
      m.createdAt.toISOString(),
      m.component?.internalCode,
      m.component?.name,
      m.type,
      Number(m.quantity),
      m.reference,
      m.reason,
    ]);
    return toCsv(['Data', 'Codice', 'Nome', 'Tipo', 'Quantità', 'Riferimento', 'Motivo'], rows);
  }
}

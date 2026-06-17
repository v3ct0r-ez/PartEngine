import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSupplierDto, UpdateSupplierDto, UpsertSupplierPartDto } from './purchasing.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  findAll() {
    return this.prisma.supplier.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { supplierParts: true, orders: true } } },
    });
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Fornitore non trovato');
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  /** Delete a supplier only when no orders or price records reference it. */
  async remove(id: string) {
    const [orders, parts] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { supplierId: id } }),
      this.prisma.supplierPart.count({ where: { supplierId: id } }),
    ]);
    if (orders > 0) {
      throw new ConflictException(`Fornitore usato in ${orders} ordini: non può essere eliminato`);
    }
    if (parts > 0) {
      throw new ConflictException(`Fornitore con ${parts} listini prezzi: rimuovili prima di eliminarlo`);
    }
    await this.prisma.supplier.delete({ where: { id } });
    return { deleted: true };
  }

  findOne(id: string) {
    return this.prisma.supplier.findUnique({
      where: { id },
      include: { supplierParts: true, orders: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  }

  /** Per-supplier sourcing/prices for a component. */
  partsForComponent(componentId: string) {
    return this.prisma.supplierPart.findMany({
      where: { componentId },
      include: { supplier: { select: { name: true } } },
      orderBy: { unitPrice: 'asc' },
    });
  }

  /** Create or update the per-supplier sourcing record for a component. */
  upsertPart(dto: UpsertSupplierPartDto) {
    return this.prisma.supplierPart.upsert({
      where: {
        supplierId_componentId_supplierSku: {
          supplierId: dto.supplierId,
          componentId: dto.componentId,
          supplierSku: dto.supplierSku ?? '',
        },
      },
      create: { ...dto, supplierSku: dto.supplierSku ?? '' },
      update: {
        unitPrice: dto.unitPrice,
        moq: dto.moq,
        leadTimeDays: dto.leadTimeDays,
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSupplierDto, UpsertSupplierPartDto } from './purchasing.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  findAll() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.supplier.findUnique({
      where: { id },
      include: { supplierParts: true, orders: { orderBy: { createdAt: 'desc' }, take: 20 } },
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

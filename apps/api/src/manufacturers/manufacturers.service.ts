import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateManufacturerDto, UpdateManufacturerDto } from './manufacturers.dto';

@Injectable()
export class ManufacturersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.manufacturer.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { components: true } } },
    });
  }

  /** Create, or return the existing manufacturer with the same (unique) name. */
  create(dto: CreateManufacturerDto) {
    return this.prisma.manufacturer.upsert({
      where: { name: dto.name },
      update: { website: dto.website },
      create: { name: dto.name, website: dto.website },
    });
  }

  async update(id: string, dto: UpdateManufacturerDto) {
    const manufacturer = await this.prisma.manufacturer.findUnique({ where: { id } });
    if (!manufacturer) throw new NotFoundException('Produttore non trovato');
    return this.prisma.manufacturer.update({
      where: { id },
      data: { name: dto.name, website: dto.website },
    });
  }

  /** Delete a manufacturer only when no component references it. */
  async remove(id: string) {
    const components = await this.prisma.component.count({ where: { manufacturerId: id } });
    if (components > 0) {
      throw new ConflictException(`Produttore usato da ${components} componenti: riassegnali prima di eliminarlo`);
    }
    await this.prisma.manufacturer.delete({ where: { id } });
    return { deleted: true };
  }
}

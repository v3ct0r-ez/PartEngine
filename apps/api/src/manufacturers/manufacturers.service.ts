import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateManufacturerDto } from './manufacturers.dto';

@Injectable()
export class ManufacturersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.manufacturer.findMany({ orderBy: { name: 'asc' } });
  }

  /** Create, or return the existing manufacturer with the same (unique) name. */
  create(dto: CreateManufacturerDto) {
    return this.prisma.manufacturer.upsert({
      where: { name: dto.name },
      update: { website: dto.website },
      create: { name: dto.name, website: dto.website },
    });
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  parseQuantity,
  parseSearchQuery,
  projectParameters,
  validateParameters,
  type FieldTemplate,
} from '@partengine/core';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateComponentDto, SearchComponentsDto } from './components.dto';

@Injectable()
export class ComponentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Load a category's field definitions as core FieldTemplates. */
  private async fieldsFor(categoryId: string): Promise<FieldTemplate[]> {
    const fields = await this.prisma.categoryField.findMany({ where: { categoryId } });
    return fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type as FieldTemplate['type'],
      unit: f.unit ?? undefined,
      options: (f.options as string[] | null) ?? undefined,
      required: f.required,
      validation: (f.validation as FieldTemplate['validation']) ?? undefined,
    }));
  }

  async create(dto: CreateComponentDto, userId?: string) {
    const fields = await this.fieldsFor(dto.categoryId);
    const params = dto.parameters ?? {};

    const errors = validateParameters(fields, params);
    if (errors.length) throw new BadRequestException({ message: 'Validation failed', errors });

    const projected = projectParameters(fields, params);

    return this.prisma.$transaction(async (tx) => {
      const fieldByKey = new Map(
        (await tx.categoryField.findMany({ where: { categoryId: dto.categoryId } })).map((f) => [
          f.key,
          f,
        ]),
      );

      const component = await tx.component.create({
        data: {
          internalCode: dto.internalCode,
          name: dto.name,
          description: dto.description,
          aliases: dto.aliases ?? [],
          tags: dto.tags ?? [],
          categoryId: dto.categoryId,
          manufacturerId: dto.manufacturerId,
          mpn: dto.mpn,
          footprint: dto.footprint,
          package: dto.package,
          parameters: params as Prisma.InputJsonValue,
          parameterValues: {
            create: projected
              .filter((p) => fieldByKey.has(p.fieldKey))
              .map((p) => ({
                fieldId: fieldByKey.get(p.fieldKey)!.id,
                fieldKey: p.fieldKey,
                numeric: p.numeric ?? undefined,
                text: p.text ?? undefined,
                boolean: p.boolean ?? undefined,
              })),
          },
        },
      });
      return component;
    });
  }

  async findOne(id: string) {
    const component = await this.prisma.component.findFirst({
      where: { id, deletedAt: null },
      include: { category: true, manufacturer: true, stockLevels: true, attachments: true },
    });
    if (!component) throw new NotFoundException('Component not found');
    return component;
  }

  /**
   * Intelligent search: parses the natural-language query into category +
   * parameter ranges + leftover full-text, then filters on the indexed
   * projection. (FTS/trgm ranking is applied via raw SQL — see docs/SEARCH.md.)
   */
  async search(dto: SearchComponentsDto) {
    const parsed = parseSearchQuery(dto.q ?? '');
    const take = Math.min(dto.limit ?? 50, 200);

    const where: Prisma.ComponentWhereInput = { deletedAt: null };
    if (parsed.category) where.category = { slug: parsed.category };
    if (parsed.footprint) where.footprint = { equals: parsed.footprint, mode: 'insensitive' };

    // Structured numeric parameters become projection filters.
    const paramFilters: Prisma.ComponentParameterValueListRelationFilter[] = [];
    for (const [key, value] of Object.entries(parsed.params)) {
      paramFilters.push({ some: { fieldKey: key, numeric: value as unknown as Prisma.Decimal } });
    }

    // Explicit range filters from the UI (already in base SI units).
    for (const range of dto.ranges ?? []) {
      const from = range.from != null ? parseQuantity(String(range.from))?.magnitude : undefined;
      const to = range.to != null ? parseQuantity(String(range.to))?.magnitude : undefined;
      paramFilters.push({
        some: {
          fieldKey: range.field,
          numeric: {
            gte: from as unknown as Prisma.Decimal,
            lte: to as unknown as Prisma.Decimal,
          },
        },
      });
    }
    if (paramFilters.length) where.AND = paramFilters.map((parameterValues) => ({ parameterValues }));

    // Leftover words → name/MPN/tags contains (FTS-ranked in the raw-SQL variant).
    if (parsed.text.length) {
      const text = parsed.text.join(' ');
      where.OR = [
        { name: { contains: text, mode: 'insensitive' } },
        { mpn: { contains: text, mode: 'insensitive' } },
        { internalCode: { contains: text, mode: 'insensitive' } },
        { tags: { has: text } },
      ];
    }

    const items = await this.prisma.component.findMany({
      where,
      take: take + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      orderBy: dto.sortField
        ? undefined // unit-aware sort handled by joining the projection (raw SQL)
        : { internalCode: 'asc' },
      include: { category: true, manufacturer: true },
    });

    const nextCursor = items.length > take ? items[take].id : null;
    return { items: items.slice(0, take), nextCursor, parsed };
  }

  async remove(id: string) {
    await this.prisma.component.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }
}

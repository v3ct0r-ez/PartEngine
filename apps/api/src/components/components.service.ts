import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  buildCategoryKeywords,
  parseQuantity,
  parseSearchQuery,
  projectParameters,
  validateParameters,
  type FieldTemplate,
} from '@partengine/core';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateComponentDto,
  SearchComponentsDto,
  UpdateComponentDto,
} from './components.dto';

/** Scalar Component columns that can be sorted directly; anything else is
 * treated as a (unit-aware) parameter sort against the indexed projection. */
const SCALAR_SORT_FIELDS = new Set(['internalCode', 'name', 'mpn', 'footprint', 'createdAt', 'updatedAt']);

/** Sort fields that map to a related record's name rather than a scalar column. */
const RELATION_SORT_FIELDS: Record<string, 'category' | 'manufacturer'> = {
  category: 'category',
  manufacturer: 'manufacturer',
};

/** Collapse per-location stockLevels into a single `onHand` total (and drop the
 * raw rows from the payload) so the list can show a warehouse-quantity column. */
function withOnHand<T extends { stockLevels?: { quantity: unknown }[] }>(items: T[]) {
  return items.map(({ stockLevels, ...rest }) => ({
    ...rest,
    onHand: (stockLevels ?? []).reduce((sum, l) => sum + Number(l.quantity), 0),
  }));
}

@Injectable()
export class ComponentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Short-lived cache of category keywords so the NL search parser recognises
  // admin-created categories without a DB hit on every keystroke.
  private catKeywordsCache?: { at: number; keywords: Record<string, string> };

  private async categoryKeywords(): Promise<Record<string, string>> {
    if (this.catKeywordsCache && Date.now() - this.catKeywordsCache.at < 60_000) {
      return this.catKeywordsCache.keywords;
    }
    // Only leaf categories — group names shouldn't hijack the search.
    const cats = await this.prisma.category.findMany({ where: { isGroup: false }, select: { slug: true, name: true } });
    const keywords = buildCategoryKeywords(cats);
    this.catKeywordsCache = { at: Date.now(), keywords };
    return keywords;
  }

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
          minQty: dto.minQty,
          maxQty: dto.maxQty,
          idealQty: dto.idealQty,
          avgPrice: dto.avgPrice,
          lastPrice: dto.lastPrice,
          currency: dto.currency ?? undefined,
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
   * Update a component. Parameters are re-validated against the (possibly
   * changed) category's fields and the indexed projection is rebuilt. Only the
   * provided fields are changed. The audit interceptor records the change.
   */
  async update(id: string, dto: UpdateComponentDto) {
    const existing = await this.prisma.component.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Component not found');

    const categoryId = dto.categoryId ?? existing.categoryId;
    // If parameters (or the category) change, validate + reproject them.
    const reproject = dto.parameters !== undefined || dto.categoryId !== undefined;
    const params = (dto.parameters ?? (existing.parameters as Record<string, unknown>)) ?? {};

    if (reproject) {
      const fields = await this.fieldsFor(categoryId);
      const errors = validateParameters(fields, params);
      if (errors.length) throw new BadRequestException({ message: 'Validation failed', errors });
    }

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.ComponentUpdateInput = {
        name: dto.name,
        description: dto.description,
        aliases: dto.aliases,
        tags: dto.tags,
        mpn: dto.mpn,
        footprint: dto.footprint,
        package: dto.package,
        minQty: dto.minQty,
        maxQty: dto.maxQty,
        idealQty: dto.idealQty,
        avgPrice: dto.avgPrice,
        lastPrice: dto.lastPrice,
        currency: dto.currency,
        ...(dto.internalCode ? { internalCode: dto.internalCode } : {}),
        ...(dto.categoryId ? { category: { connect: { id: dto.categoryId } } } : {}),
        ...(dto.manufacturerId
          ? { manufacturer: { connect: { id: dto.manufacturerId } } }
          : {}),
        ...(reproject ? { parameters: params as Prisma.InputJsonValue } : {}),
      };

      if (reproject) {
        const fields = await this.fieldsFor(categoryId);
        const projected = projectParameters(fields, params);
        const fieldByKey = new Map(
          (await tx.categoryField.findMany({ where: { categoryId } })).map((f) => [f.key, f]),
        );
        // Replace the indexed projection wholesale.
        await tx.componentParameterValue.deleteMany({ where: { componentId: id } });
        data.parameterValues = {
          create: projected
            .filter((p) => fieldByKey.has(p.fieldKey))
            .map((p) => ({
              fieldId: fieldByKey.get(p.fieldKey)!.id,
              fieldKey: p.fieldKey,
              numeric: p.numeric ?? undefined,
              text: p.text ?? undefined,
              boolean: p.boolean ?? undefined,
            })),
        };
      }

      return tx.component.update({ where: { id }, data });
    });
  }

  /**
   * Intelligent search: parses the natural-language query into category +
   * parameter ranges + leftover full-text, then filters on the indexed
   * projection. (FTS/trgm ranking is applied via raw SQL — see docs/SEARCH.md.)
   */
  async search(dto: SearchComponentsDto) {
    const parsed = parseSearchQuery(dto.q ?? '', { categoryKeywords: await this.categoryKeywords() });
    const take = Math.min(dto.limit ?? 50, 200);

    const where: Prisma.ComponentWhereInput = { deletedAt: null };
    // Explicit category from the filter sidebar takes precedence over a category
    // keyword parsed out of the free-text query.
    const categorySlug = dto.categorySlug ?? parsed.category;
    if (categorySlug) where.category = { slug: categorySlug };
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
        // Alternative manufacturers/MPNs (single logical part) are searchable.
        { aliases: { has: text } },
      ];
    }

    const dir: Prisma.SortOrder = dto.sortDir === 'desc' ? 'desc' : 'asc';
    const include = {
      category: true,
      manufacturer: true,
      stockLevels: { select: { quantity: true } },
    };

    // Sorting by a QUANTITY parameter must be UNIT-AWARE: order by the indexed
    // base-SI magnitude in ComponentParameterValue, not by the lexical string.
    // We query the projection (whose `numeric` is already in base units) with the
    // component filter applied, so 100Ω < 1kΩ < 1MΩ comes out correctly.
    if (dto.sortField && !SCALAR_SORT_FIELDS.has(dto.sortField) && !RELATION_SORT_FIELDS[dto.sortField]) {
      const rows = await this.prisma.componentParameterValue.findMany({
        where: { fieldKey: dto.sortField, numeric: { not: null }, component: where },
        orderBy: { numeric: dir },
        take: take + 1,
        ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
        include: { component: { include } },
      });
      const items = rows.map((r) => r.component);
      const nextCursor = rows.length > take ? rows[take].id : null;
      return { items: withOnHand(items.slice(0, take)), nextCursor, parsed };
    }

    // Scalar column sort, related-record name sort, or the default order.
    const orderBy: Prisma.ComponentOrderByWithRelationInput = dto.sortField
      ? RELATION_SORT_FIELDS[dto.sortField]
        ? { [RELATION_SORT_FIELDS[dto.sortField]]: { name: dir } }
        : { [dto.sortField]: dir }
      : { internalCode: 'asc' };

    const items = await this.prisma.component.findMany({
      where,
      take: take + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      orderBy,
      include,
    });

    const nextCursor = items.length > take ? items[take].id : null;
    return { items: withOnHand(items.slice(0, take)), nextCursor, parsed };
  }

  async remove(id: string) {
    await this.prisma.component.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }
}

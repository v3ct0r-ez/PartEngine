import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateCategoryDto,
  FieldDto,
  UpdateCategoryDto,
  UpdateFieldDto,
} from './categories.dto';

/**
 * Admin management of categories and their data-driven "recognition" fields
 * (the per-category parameters). Lets an administrator add new component
 * categories and edit their parameters without code (spec: "senza scrivere
 * codice").
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      // Complexity order (passive → semiconductors → ICs → …) lives in
      // sortOrder, seeded from the taxonomy declaration; name breaks ties.
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { fields: { orderBy: { sortOrder: 'asc' } }, _count: { select: { components: true } } },
    });
  }

  async get(idOrSlug: string) {
    const category = await this.prisma.category.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const exists = await this.prisma.category.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new BadRequestException(`Category slug '${dto.slug}' already exists`);
    return this.prisma.category.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        icon: dto.icon,
        parentId: dto.parentId,
        isGroup: dto.isGroup ?? false,
        codePrefix: dto.codePrefix,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.assertExists(id);
    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name, icon: dto.icon, codePrefix: dto.codePrefix, parentId: dto.parentId },
    });
  }

  async remove(id: string) {
    const count = await this.prisma.component.count({ where: { categoryId: id, deletedAt: null } });
    if (count > 0) {
      throw new BadRequestException(
        `Cannot delete: ${count} component(s) still use this category`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Fields (recognition parameters) ──────────────────────
  async addField(categoryId: string, dto: FieldDto) {
    await this.assertExists(categoryId);
    const dup = await this.prisma.categoryField.findUnique({
      where: { categoryId_key: { categoryId, key: dto.key } },
    });
    if (dup) throw new BadRequestException(`Field '${dto.key}' already exists in this category`);
    return this.prisma.categoryField.create({
      data: {
        categoryId,
        key: dto.key,
        label: dto.label,
        type: dto.type,
        unit: dto.unit,
        options: (dto.options as Prisma.InputJsonValue) ?? undefined,
        required: dto.required ?? false,
        validation: (dto.validation as Prisma.InputJsonValue) ?? undefined,
        isFilterable: dto.isFilterable ?? true,
        isSortable: dto.isSortable ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateField(fieldId: string, dto: UpdateFieldDto) {
    const field = await this.prisma.categoryField.findUnique({ where: { id: fieldId } });
    if (!field) throw new NotFoundException('Field not found');
    return this.prisma.categoryField.update({
      where: { id: fieldId },
      data: {
        label: dto.label,
        type: dto.type,
        unit: dto.unit,
        options: dto.options !== undefined ? (dto.options as Prisma.InputJsonValue) : undefined,
        required: dto.required,
        validation:
          dto.validation !== undefined ? (dto.validation as Prisma.InputJsonValue) : undefined,
        isFilterable: dto.isFilterable,
        isSortable: dto.isSortable,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async removeField(fieldId: string) {
    const field = await this.prisma.categoryField.findUnique({ where: { id: fieldId } });
    if (!field) throw new NotFoundException('Field not found');
    // Drop any indexed projection rows for this field, then the field itself.
    await this.prisma.componentParameterValue.deleteMany({ where: { fieldId } });
    await this.prisma.categoryField.delete({ where: { id: fieldId } });
    return { id: fieldId, deleted: true };
  }

  /** Persist a new display order for a category's fields (drag-and-drop). */
  async reorderFields(categoryId: string, fieldIds: string[]) {
    await this.assertExists(categoryId);
    const fields = await this.prisma.categoryField.findMany({
      where: { categoryId },
      select: { id: true },
    });
    const owned = new Set(fields.map((f) => f.id));
    if (fieldIds.length !== owned.size || !fieldIds.every((id) => owned.has(id))) {
      throw new BadRequestException('fieldIds must list exactly this category’s fields');
    }
    await this.prisma.$transaction(
      fieldIds.map((id, i) =>
        this.prisma.categoryField.update({ where: { id }, data: { sortOrder: i } }),
      ),
    );
    return { ok: true };
  }

  private async assertExists(id: string) {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Category not found');
  }
}

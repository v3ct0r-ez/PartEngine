import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { projectParameters, TAXONOMY } from '@partengine/core';
import { PrismaService } from '../prisma/prisma.service';

/**
 * First-run seeder. When the database is empty it creates an admin user, the
 * built-in 2-level taxonomy (groups → categories with their recognition fields
 * + code prefixes) and a little demo stock. Idempotent (skips if a user exists).
 * Disable with AUTO_SEED=false.
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.AUTO_SEED === 'false') return;
    try {
      // Seed the catalog when empty. The admin account is NOT seeded — it's
      // created by the user at first launch (see /auth/setup), so no default
      // password is ever shipped.
      if ((await this.prisma.category.count()) > 0) return;
      await this.seed();
    } catch (err) {
      this.logger.warn(`Seed skipped: ${(err as Error).message}`);
    }
  }

  private async seed() {
    this.logger.log('Empty catalog — seeding taxonomy + demo…');

    await this.prisma.$transaction(async (tx) => {
      // 2-level taxonomy: groups, then leaf categories with fields.
      for (const [gi, group] of TAXONOMY.entries()) {
        const g = await tx.category.create({
          data: { slug: group.slug, name: group.name, isGroup: true, isSystem: true, sortOrder: gi },
        });
        for (const [ci, cat] of group.categories.entries()) {
          const category = await tx.category.create({
            data: {
              slug: cat.slug,
              name: cat.name,
              parentId: g.id,
              codePrefix: cat.codePrefix,
              isSystem: true,
              sortOrder: ci,
            },
          });
          await tx.categoryField.createMany({
            data: cat.fields.map((f, i) => ({
              categoryId: category.id,
              key: f.key,
              label: f.label,
              type: f.type,
              unit: f.unit,
              options: (f.options as object) ?? undefined,
              required: f.required ?? false,
              sortOrder: i,
            })),
          });
        }
      }

      // Demo warehouse + a few resistors so the app isn't empty.
      const warehouse = await tx.warehouse.create({ data: { code: 'WH1', name: 'Lab principale' } });
      const location = await tx.location.create({
        data: { warehouseId: warehouse.id, code: 'A-01-1', kind: 'drawer' },
      });
      const resistors = await tx.category.findUniqueOrThrow({ where: { slug: 'resistors' } });
      const resistorFields = TAXONOMY.flatMap((g) => g.categories).find((c) => c.slug === 'resistors')!.fields;
      const fieldRows = await tx.categoryField.findMany({ where: { categoryId: resistors.id } });
      const byKey = new Map(fieldRows.map((f) => [f.key, f]));

      const demo = [
        { code: 'R-100R-0603', name: '100Ω 1% 0603', params: { resistance: '100', tolerance: '1', footprint: '0603' } },
        { code: 'R-1K-0603', name: '1kΩ 1% 0603', params: { resistance: '1k', tolerance: '1', footprint: '0603' } },
        { code: 'R-10K-0603', name: '10kΩ 1% 0603', params: { resistance: '10k', tolerance: '1', footprint: '0603' } },
        { code: 'R-1M-0603', name: '1MΩ 1% 0603', params: { resistance: '1M', tolerance: '1', footprint: '0603' } },
      ];
      for (const d of demo) {
        const projected = projectParameters(resistorFields, d.params);
        const component = await tx.component.create({
          data: {
            internalCode: d.code,
            name: d.name,
            categoryId: resistors.id,
            footprint: '0603',
            tags: ['demo', 'resistor'],
            parameters: d.params,
            parameterValues: {
              create: projected
                .filter((p) => byKey.has(p.fieldKey))
                .map((p) => ({
                  fieldId: byKey.get(p.fieldKey)!.id,
                  fieldKey: p.fieldKey,
                  numeric: p.numeric ?? undefined,
                  text: p.text ?? undefined,
                  boolean: p.boolean ?? undefined,
                })),
            },
          },
        });
        await tx.stockLevel.create({ data: { componentId: component.id, locationId: location.id, quantity: 500 } });
      }
    });

    this.logger.log('Seed complete. Login: admin@partengine.local / changeme123');
  }
}

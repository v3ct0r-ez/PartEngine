import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TAXONOMY } from '@partengine/core';
import { PrismaService } from '../prisma/prisma.service';

/**
 * First-run seeder. When the catalog is empty it creates the built-in 2-level
 * taxonomy (groups → categories with their recognition fields + code prefixes).
 * No demo components, warehouse or admin user are seeded — the install starts
 * clean and the user creates their own warehouse/locations and the first admin
 * at launch. Idempotent (skips if any category exists). Disable with
 * AUTO_SEED=false.
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
    this.logger.log('Empty catalog — seeding taxonomy…');

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

      // Single-site is the common case: provision one default warehouse so the
      // user can add locations and stock immediately (multi-warehouse stays an
      // advanced option). No demo locations/components are seeded.
      await tx.warehouse.create({ data: { code: 'WH1', name: 'Magazzino principale' } });
    });

    this.logger.log('Seed complete: taxonomy + default warehouse. Create locations and the first admin at launch.');
  }
}


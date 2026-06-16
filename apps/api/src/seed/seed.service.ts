import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CATEGORY_TEMPLATES, projectParameters, type FieldTemplate } from '@partengine/core';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

/**
 * First-run seeder. Runs on API startup and, only when the database is empty,
 * creates an admin user, the built-in categories + their data-driven fields, a
 * demo warehouse/location and a few demo resistors so the app is usable
 * immediately (login + populated catalog). Idempotent: skips if any user exists.
 * Disable with AUTO_SEED=false.
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.AUTO_SEED === 'false') return;
    try {
      const users = await this.prisma.user.count();
      if (users > 0) return; // already seeded
      await this.seed();
    } catch (err) {
      this.logger.warn(`Seed skipped: ${(err as Error).message}`);
    }
  }

  private async seed() {
    this.logger.log('Empty database — seeding initial data…');
    const passwordHash = await argon2.hash('changeme123');

    // Atomic: if anything fails (e.g. a bad cluster encoding) nothing is
    // committed, so the seeder re-runs cleanly on the next start.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          email: 'admin@partengine.local',
          fullName: 'Super Admin',
          role: 'SUPER_ADMIN',
          passwordHash,
        },
      });

      const fieldsByCategory = new Map<string, FieldTemplate[]>();
      for (const tpl of CATEGORY_TEMPLATES) {
        const category = await tx.category.create({
          data: { slug: tpl.slug, name: tpl.name, icon: tpl.icon, isSystem: true },
        });
        fieldsByCategory.set(category.id, tpl.fields);
        await tx.categoryField.createMany({
          data: tpl.fields.map((f, i) => ({
            categoryId: category.id,
            key: f.key,
            label: f.label,
            type: f.type,
            unit: f.unit,
            options: (f.options as object) ?? undefined,
            required: f.required ?? false,
            validation: (f.validation as object) ?? undefined,
            sortOrder: i,
          })),
        });
      }

      const warehouse = await tx.warehouse.create({
        data: { code: 'WH1', name: 'Lab principale' },
      });
      const location = await tx.location.create({
        data: { warehouseId: warehouse.id, code: 'A-01-1', kind: 'drawer' },
      });

      const resistors = await tx.category.findUniqueOrThrow({ where: { slug: 'resistors' } });
      const resistorFields = fieldsByCategory.get(resistors.id)!;
      const fieldRows = await tx.categoryField.findMany({ where: { categoryId: resistors.id } });
      const byKey = new Map(fieldRows.map((f) => [f.key, f]));

      const demo = [
        { code: 'R-100R-0603', name: '100Ω 1% 0603', params: { resistance: '100', tolerance: '1', footprint: '0603' } },
        { code: 'R-1K-0603', name: '1kΩ 1% 0603', params: { resistance: '1k', tolerance: '1', footprint: '0603' } },
        { code: 'R-4K7-0603', name: '4.7kΩ 1% 0603', params: { resistance: '4.7k', tolerance: '1', footprint: '0603' } },
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
        await tx.stockLevel.create({
          data: { componentId: component.id, locationId: location.id, quantity: 500 },
        });
      }
    });

    this.logger.log('Seed complete. Login: admin@partengine.local / changeme123');
  }
}

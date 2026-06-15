/**
 * Seeds built-in categories + their data-driven fields, a demo warehouse,
 * an admin user, and a handful of components so search/sort work immediately.
 */
import { CATEGORY_TEMPLATES, projectParameters, type FieldTemplate } from '@partengine/core';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // ── Admin user ───────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: 'admin@partengine.local' },
    update: {},
    create: {
      email: 'admin@partengine.local',
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
      passwordHash: await argon2.hash('changeme123'),
    },
  });

  // ── Categories + fields (data-driven) ────────────────────
  const fieldsByCategory = new Map<string, FieldTemplate[]>();
  for (const tpl of CATEGORY_TEMPLATES) {
    const category = await prisma.category.upsert({
      where: { slug: tpl.slug },
      update: { name: tpl.name, icon: tpl.icon },
      create: { slug: tpl.slug, name: tpl.name, icon: tpl.icon, isSystem: true },
    });
    fieldsByCategory.set(category.id, tpl.fields);

    for (const [i, f] of tpl.fields.entries()) {
      await prisma.categoryField.upsert({
        where: { categoryId_key: { categoryId: category.id, key: f.key } },
        update: {},
        create: {
          categoryId: category.id,
          key: f.key,
          label: f.label,
          type: f.type,
          unit: f.unit,
          options: f.options ?? undefined,
          required: f.required ?? false,
          validation: f.validation ?? undefined,
          sortOrder: i,
        },
      });
    }
  }

  // ── Demo warehouse + a drawer location ───────────────────
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'WH1' },
    update: {},
    create: { code: 'WH1', name: 'Lab principale' },
  });
  const location = await prisma.location.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: 'A-01-1' } },
    update: {},
    create: { warehouseId: warehouse.id, code: 'A-01-1', kind: 'drawer' },
  });

  // ── Demo resistors (so unit-aware sort is visible) ───────
  const resistors = await prisma.category.findUniqueOrThrow({ where: { slug: 'resistors' } });
  const resistorFields = fieldsByCategory.get(resistors.id)!;
  const resFieldRows = await prisma.categoryField.findMany({ where: { categoryId: resistors.id } });
  const byKey = new Map(resFieldRows.map((f) => [f.key, f]));

  const demo = [
    { code: 'R-100R-0603', name: '100Ω 1% 0603', params: { resistance: '100', tolerance: '1', footprint: '0603' } },
    { code: 'R-1K-0603', name: '1kΩ 1% 0603', params: { resistance: '1k', tolerance: '1', footprint: '0603' } },
    { code: 'R-4K7-0603', name: '4.7kΩ 1% 0603', params: { resistance: '4.7k', tolerance: '1', footprint: '0603' } },
    { code: 'R-10K-0603', name: '10kΩ 1% 0603', params: { resistance: '10k', tolerance: '1', footprint: '0603' } },
    { code: 'R-1M-0603', name: '1MΩ 1% 0603', params: { resistance: '1M', tolerance: '1', footprint: '0603' } },
  ];

  for (const d of demo) {
    const projected = projectParameters(resistorFields, d.params);
    const component = await prisma.component.upsert({
      where: { internalCode: d.code },
      update: {},
      create: {
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
    await prisma.stockLevel.upsert({
      where: { componentId_locationId: { componentId: component.id, locationId: location.id } },
      update: {},
      create: { componentId: component.id, locationId: location.id, quantity: 500 },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete. Login: admin@partengine.local / changeme123');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

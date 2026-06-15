/**
 * Stages the API + web production bundles for electron-builder.
 *
 * The API is staged by `pnpm deploy` (run by the workflow BEFORE this script),
 * which produces a self-contained node_modules with all transitive deps — the
 * cpSync-of-pnpm-symlinks approach was incomplete (missing peers like
 * @prisma/engines and the generated client). This script then:
 *   1. copies the generated Prisma client (.prisma) into the deployed API
 *      node_modules — `prisma generate` writes it into the pnpm store, and
 *      `pnpm deploy` doesn't carry generated (untracked) output;
 *   2. stages the Next.js standalone web bundle.
 *
 * Build order (see .github/workflows/desktop-release.yml):
 *   pnpm --filter @partengine/api prisma:generate
 *   pnpm --filter @partengine/api build
 *   pnpm --filter @partengine/web build
 *   pnpm --filter @partengine/api deploy --prod apps/desktop/staging/api
 *   node apps/desktop/scripts/prepare-bundles.mjs
 */
import { cpSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..', '..');
const staging = resolve(here, '..', 'staging');

function copy(from, to, label = '') {
  if (!existsSync(from)) {
    console.warn(`! missing ${from} — ${label || 'build the workspace first'}`);
    return false;
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, dereference: true });
  console.log(`✓ ${from} -> ${to}`);
  return true;
}

// 0) The compiled API (dist/) — pnpm deploy skips it because dist/ is
// gitignored, so copy it in explicitly. (prisma/ is carried by deploy.)
copy(join(repo, 'apps/api/dist'), join(staging, 'api/dist'), 'run the api build first');

// 1) Generated Prisma client (.prisma) → deployed API node_modules.
// Resolve where `prisma generate` actually wrote it (inside the pnpm store).
try {
  const clientReal = realpathSync(join(repo, 'apps/api/node_modules/@prisma/client'));
  const dotPrisma = join(dirname(dirname(clientReal)), '.prisma'); // .../node_modules/.prisma
  copy(dotPrisma, join(staging, 'api/node_modules/.prisma'), 'run prisma:generate first');
} catch (e) {
  console.warn(`! could not resolve generated Prisma client: ${e.message}`);
}

// 2) Web standalone bundle (self-contained Next server) + static/public.
copy(join(repo, 'apps/web/.next/standalone'), join(staging, 'web'));
copy(join(repo, 'apps/web/.next/static'), join(staging, 'web/apps/web/.next/static'));
copy(join(repo, 'apps/web/public'), join(staging, 'web/apps/web/public'));

console.log('\nStaging complete. Now run: pnpm --filter @partengine/desktop dist:win');

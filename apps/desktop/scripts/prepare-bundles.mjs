/**
 * Stages the API and web production bundles for electron-builder.
 *
 * Run AFTER building the workspace:
 *   pnpm --filter @partengine/api build           # nest build  -> apps/api/dist
 *   pnpm --filter @partengine/api prisma:generate  # prisma client
 *   pnpm --filter @partengine/web build            # next build (standalone)
 *
 * It copies:
 *   - apps/api/dist        -> staging/api            (NestJS entry: main.js)
 *   - apps/api/prisma      -> staging/api/prisma     (migrations + 001_search.sql)
 *   - api node_modules     -> staging/api/node_modules (prisma + @prisma/client + runtime deps)
 *   - apps/web/.next/standalone -> staging/web        (self-contained Next server)
 *   - apps/web/.next/static, public -> staging/web/...
 *
 * Kept as a Node script (no extra deps) so it runs in CI on any OS.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..', '..');
const staging = resolve(here, '..', 'staging');

function copy(from, to) {
  if (!existsSync(from)) {
    console.warn(`! missing ${from} — build the workspace first`);
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  // dereference: resolve pnpm's symlinked node_modules into real files so the
  // packaged app is self-contained and works on Windows (no symlink support).
  cpSync(from, to, { recursive: true, dereference: true });
  console.log(`✓ ${from} -> ${to}`);
}

rmSync(staging, { recursive: true, force: true });

// API bundle
copy(join(repo, 'apps/api/dist'), join(staging, 'api'));
copy(join(repo, 'apps/api/prisma'), join(staging, 'api/prisma'));
copy(join(repo, 'apps/api/node_modules'), join(staging, 'api/node_modules'));

// Web standalone bundle
copy(join(repo, 'apps/web/.next/standalone'), join(staging, 'web'));
copy(join(repo, 'apps/web/.next/static'), join(staging, 'web/apps/web/.next/static'));
copy(join(repo, 'apps/web/public'), join(staging, 'web/apps/web/public'));

console.log('\nStaging complete. Now run: pnpm --filter @partengine/desktop dist:win');

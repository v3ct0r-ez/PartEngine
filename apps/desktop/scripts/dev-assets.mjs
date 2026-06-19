// Stages the web static assets next to the standalone server for a NON-packaged
// desktop run (`pnpm desktop:dev`). Next's standalone output doesn't include
// .next/static or public, and in dev the desktop launches the standalone
// server directly (apps/web/.next/standalone/apps/web/server.js), so without
// this the in-window UI would load unstyled and /logo.png etc. would 404.
import { cpSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, '..', '..', '..', 'apps', 'web');
const standalone = join(web, '.next', 'standalone', 'apps', 'web');

if (!existsSync(join(standalone, 'server.js'))) {
  console.error('! Standalone server not found — run `pnpm --filter @partengine/web build` first.');
  process.exit(1);
}

cpSync(join(web, '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true });
if (existsSync(join(web, 'public'))) {
  cpSync(join(web, 'public'), join(standalone, 'public'), { recursive: true });
}
console.log('✓ Web static + public staged into the standalone bundle for dev.');

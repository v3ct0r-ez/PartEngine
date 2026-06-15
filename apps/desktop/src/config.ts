import { app } from 'electron';
import * as path from 'node:path';

/**
 * Runtime configuration for the all-in-one desktop build.
 *
 * In a packaged app the API/web bundles and Prisma assets are shipped as
 * electron-builder "extraResources" under process.resourcesPath; in dev we read
 * them from the monorepo. The Postgres data directory lives under the per-user
 * app data folder so multiple Windows users don't clash and updates don't wipe data.
 */
const isPackaged = app.isPackaged;
const resourcesRoot = isPackaged
  ? process.resourcesPath
  : path.resolve(__dirname, '..', '..', '..');

export interface DesktopConfig {
  isPackaged: boolean;
  /** Bind to 0.0.0.0 (LAN-accessible) when true, else 127.0.0.1 (local only). */
  lanEnabled: boolean;
  host: string;
  apiPort: number;
  webPort: number;
  pgPort: number;
  pgUser: string;
  pgPassword: string;
  pgDatabase: string;
  dataDir: string;
  apiEntry: string;
  webEntry: string;
  prismaDir: string;
  databaseUrl: string;
}

export function loadConfig(): DesktopConfig {
  const lanEnabled = process.env.PARTENGINE_LAN === 'true';
  const host = lanEnabled ? '0.0.0.0' : '127.0.0.1';
  const apiPort = Number(process.env.PARTENGINE_API_PORT ?? 47600);
  const webPort = Number(process.env.PARTENGINE_WEB_PORT ?? 47700);
  const pgPort = Number(process.env.PARTENGINE_PG_PORT ?? 47532);
  const pgUser = 'partengine';
  const pgPassword = 'partengine-local';
  const pgDatabase = 'partengine';

  const dataDir = path.join(app.getPath('userData'), 'pgdata');

  return {
    isPackaged,
    lanEnabled,
    host,
    apiPort,
    webPort,
    pgPort,
    pgUser,
    pgPassword,
    pgDatabase,
    dataDir,
    // Packaged: resources/app.api/main.js · Dev: monorepo dist.
    apiEntry: isPackaged
      ? path.join(resourcesRoot, 'app.api', 'main.js')
      : path.join(resourcesRoot, 'apps', 'api', 'dist', 'main.js'),
    webEntry: isPackaged
      ? path.join(resourcesRoot, 'app.web', 'server.js')
      : path.join(resourcesRoot, 'apps', 'web', '.next', 'standalone', 'apps', 'web', 'server.js'),
    prismaDir: isPackaged
      ? path.join(resourcesRoot, 'app.api', 'prisma')
      : path.join(resourcesRoot, 'apps', 'api', 'prisma'),
    databaseUrl: `postgresql://${pgUser}:${pgPassword}@127.0.0.1:${pgPort}/${pgDatabase}?schema=public`,
  };
}

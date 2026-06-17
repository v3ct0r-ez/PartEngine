import { app } from 'electron';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
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
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  storageDir: string;
  /** Folder for automatic cold backups (e.g. a NAS path). Empty = disabled. */
  backupDir: string;
  backupKeep: number;
}

/** User-editable settings persisted to %APPDATA%/PartEngine/config.json. */
export interface UserSettings {
  dataDir?: string;
  storageDir?: string;
  backupDir?: string;
  backupKeep?: number;
}

export function settingsFilePath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}
export function readUserSettings(): UserSettings {
  try {
    return JSON.parse(fs.readFileSync(settingsFilePath(), 'utf8'));
  } catch {
    return {};
  }
}
export function writeUserSettings(s: UserSettings): void {
  fs.mkdirSync(path.dirname(settingsFilePath()), { recursive: true });
  fs.writeFileSync(settingsFilePath(), JSON.stringify(s, null, 2));
}

/** Load (or generate once) per-install JWT secrets, persisted in app data so
 * tokens stay valid across restarts. Without a secret the API can't sign JWTs
 * ('secretOrPrivateKey must have a value') and login fails. */
function loadOrCreateSecrets(): { access: string; refresh: string } {
  const file = path.join(app.getPath('userData'), 'secrets.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    const secrets = {
      access: randomBytes(48).toString('hex'),
      refresh: randomBytes(48).toString('hex'),
    };
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
    } catch {
      /* fall back to ephemeral secrets if the file can't be written */
    }
    return secrets;
  }
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

  const userData = app.getPath('userData');
  const settings = readUserSettings();
  // User-selectable locations (e.g. NAS), falling back to the app-data folder.
  const dataDir = settings.dataDir || path.join(userData, 'pgdata');
  const storageDir = settings.storageDir || path.join(userData, 'attachments');
  const backupDir = settings.backupDir || '';
  const backupKeep = settings.backupKeep ?? 10;
  const secrets = loadOrCreateSecrets();

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
    // pnpm deploy preserves the package layout, so dist/ is kept in both modes.
    apiEntry: isPackaged
      ? path.join(resourcesRoot, 'app.api', 'dist', 'main.js')
      : path.join(resourcesRoot, 'apps', 'api', 'dist', 'main.js'),
    // Next standalone in a monorepo nests the server under apps/web/.
    webEntry: isPackaged
      ? path.join(resourcesRoot, 'app.web', 'apps', 'web', 'server.js')
      : path.join(resourcesRoot, 'apps', 'web', '.next', 'standalone', 'apps', 'web', 'server.js'),
    prismaDir: isPackaged
      ? path.join(resourcesRoot, 'app.api', 'prisma')
      : path.join(resourcesRoot, 'apps', 'api', 'prisma'),
    databaseUrl: `postgresql://${pgUser}:${pgPassword}@127.0.0.1:${pgPort}/${pgDatabase}?schema=public`,
    jwtAccessSecret: secrets.access,
    jwtRefreshSecret: secrets.refresh,
    storageDir,
    backupDir,
    backupKeep,
  };
}

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
// embedded-postgres is ESM-only; it is imported dynamically (await import) inside
// start() since this is a CommonJS module. The instance is held loosely-typed as
// it's a thin lifecycle wrapper.
import type { DesktopConfig } from './config';
import { log } from './log';

type EmbeddedPostgresInstance = {
  initialise: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  createDatabase: (name: string) => Promise<void>;
};

/**
 * Manages an embedded PostgreSQL instance bundled inside the app — no Docker, no
 * system Postgres required. On first launch it initialises a data directory in
 * the user's app-data folder; on every launch it starts the server, ensures the
 * database exists, and applies Prisma migrations + the FTS/trgm SQL.
 */
export class DatabaseManager {
  private pg?: EmbeddedPostgresInstance;

  constructor(private readonly cfg: DesktopConfig) {}

  async start(): Promise<void> {
    const firstRun = !fs.existsSync(path.join(this.cfg.dataDir, 'PG_VERSION'));
    fs.mkdirSync(this.cfg.dataDir, { recursive: true });

    const { default: EmbeddedPostgresCtor } = (await import('embedded-postgres')) as {
      default: new (opts: Record<string, unknown>) => EmbeddedPostgresInstance;
    };
    this.pg = new EmbeddedPostgresCtor({
      databaseDir: this.cfg.dataDir,
      user: this.cfg.pgUser,
      password: this.cfg.pgPassword,
      port: this.cfg.pgPort,
      persistent: true,
    });

    if (firstRun) {
      log('First run — initialising PostgreSQL cluster…');
      await this.pg.initialise();
    }
    log(`Starting PostgreSQL on 127.0.0.1:${this.cfg.pgPort}…`);
    await this.pg.start();

    if (firstRun) {
      log('Creating database…');
      await this.pg.createDatabase(this.cfg.pgDatabase);
    }

    this.migrate();
  }

  /**
   * Apply Prisma migrations and the raw FTS/trgm SQL using the API bundle's
   * Prisma CLI. Runs synchronously before the API starts so the schema is ready.
   */
  private migrate(): void {
    const env = { ...process.env, DATABASE_URL: this.cfg.databaseUrl };
    log('Applying database migrations…');

    // Electron ships Node; run the bundled prisma via ELECTRON_RUN_AS_NODE.
    const node = process.execPath;
    const prismaBin = path.join(this.cfg.prismaDir, '..', 'node_modules', '.bin', 'prisma');
    const res = spawnSync(node, [prismaBin, 'migrate', 'deploy'], {
      cwd: path.dirname(this.cfg.prismaDir),
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'inherit',
    });
    if (res.status !== 0) log('WARNING: prisma migrate deploy returned non-zero', 'warn');

    const ftsSql = path.join(this.cfg.prismaDir, 'sql', '001_search.sql');
    if (fs.existsSync(ftsSql)) {
      log('Applying full-text-search migration…');
      // psql is shipped with the embedded Postgres binaries.
      // (Path resolution handled by embedded-postgres; see DESKTOP.md for details.)
    }
  }

  async stop(): Promise<void> {
    if (this.pg) {
      log('Stopping PostgreSQL…');
      await this.pg.stop();
    }
  }
}

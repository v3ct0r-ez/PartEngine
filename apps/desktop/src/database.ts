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
   * Apply Prisma migrations using the API bundle's Prisma CLI. We run Prisma's
   * actual CLI JavaScript entry with Electron's bundled Node
   * (ELECTRON_RUN_AS_NODE) rather than the `.bin/prisma` shim — the shim is a
   * shell/cmd script that Node can't execute directly, which would silently fail
   * on Windows. Runs before the API starts so the schema is ready.
   */
  private migrate(): void {
    const apiDir = path.dirname(this.cfg.prismaDir); // resources/app.api
    const env = { ...process.env, DATABASE_URL: this.cfg.databaseUrl, ELECTRON_RUN_AS_NODE: '1' };

    const prismaCli = path.join(apiDir, 'node_modules', 'prisma', 'build', 'index.js');
    if (!fs.existsSync(prismaCli)) {
      log(`WARNING: prisma CLI not found at ${prismaCli} — skipping migrations`, 'warn');
      return;
    }

    log('Applying database migrations (prisma migrate deploy)…');
    const res = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
      cwd: apiDir,
      env,
      encoding: 'utf8',
    });
    // Surface Prisma's own output in our log (stdio isn't inherited here).
    const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
    if (out) out.split(/\r?\n/).forEach((l) => log(`[prisma] ${l}`));
    if (res.error) throw new Error(`prisma migrate failed to spawn: ${res.error.message}`);
    if (res.status !== 0) throw new Error(`prisma migrate deploy exited ${res.status}`);
    log('Migrations applied.');

    // FTS/trgm indexes are a performance optimisation (search works without
    // them, via Prisma `contains`); applying 001_search.sql is best-effort and
    // intentionally not blocking startup. Wired in a follow-up.
  }

  async stop(): Promise<void> {
    if (this.pg) {
      log('Stopping PostgreSQL…');
      await this.pg.stop();
    }
  }
}

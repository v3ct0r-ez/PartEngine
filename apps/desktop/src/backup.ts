import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import * as path from 'node:path';
import type { DesktopConfig } from './config';
import { log } from './log';

const PREFIX = 'partengine-backup-';

/**
 * Cold backups of the embedded PostgreSQL data directory to a user-chosen folder
 * (e.g. a NAS). Done while the server is STOPPED (on shutdown) so the copied
 * cluster is consistent — pg_dump isn't shipped with embedded-postgres, and
 * copying a live cluster (or hosting it on SMB) would be unsafe. Keeps the last N.
 */
export class BackupService {
  constructor(private readonly cfg: DesktopConfig) {}

  get enabled(): boolean {
    return !!this.cfg.backupDir;
  }

  list(): { name: string; at: Date; sizeHint: number }[] {
    if (!this.cfg.backupDir || !existsSync(this.cfg.backupDir)) return [];
    return readdirSync(this.cfg.backupDir)
      .filter((d) => d.startsWith(PREFIX))
      .map((d) => ({ name: d, at: statSync(path.join(this.cfg.backupDir, d)).mtime, sizeHint: 0 }))
      .sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  /** Copy the (stopped) data dir into backupDir; prune to backupKeep. */
  backupColdSync(): string | null {
    if (!this.enabled) return null;
    if (!existsSync(this.cfg.dataDir)) return null;
    try {
      mkdirSync(this.cfg.backupDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const dest = path.join(this.cfg.backupDir, `${PREFIX}${ts}`);
      log(`Backup: copying data dir → ${dest}`);
      cpSync(this.cfg.dataDir, dest, { recursive: true });
      this.prune();
      log('Backup complete.');
      return dest;
    } catch (err) {
      log(`Backup failed: ${(err as Error).message}`, 'error');
      return null;
    }
  }

  private prune() {
    const backups = this.list();
    for (const old of backups.slice(this.cfg.backupKeep)) {
      rmSync(path.join(this.cfg.backupDir, old.name), { recursive: true, force: true });
    }
  }
}

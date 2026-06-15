import { app } from 'electron';
import { appendFileSync, mkdirSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function logDir(): string {
  // app.getPath('logs') throws before the app is ready; fall back to a temp dir
  // so the earliest startup crashes are still captured.
  try {
    return app.getPath('logs');
  } catch {
    return path.join(os.tmpdir(), 'PartEngine-logs');
  }
}

/**
 * Append a timestamped line to console and the app log.
 *
 * Writes are SYNCHRONOUS (appendFileSync): a buffered stream would lose its
 * contents if the process crashes hard during startup, which is exactly when we
 * most need the log. Synchronous append guarantees each line is on disk.
 */
export function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  // eslint-disable-next-line no-console
  console[level === 'info' ? 'log' : level](line);
  try {
    const dir = logDir();
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, 'partengine.log'), line + '\n');
  } catch {
    /* logging must never crash the launcher */
  }
}

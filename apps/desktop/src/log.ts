import { app } from 'electron';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

let stream: fs.WriteStream | undefined;

function logDir(): string {
  // app.getPath('logs') throws before the app is ready; fall back to a temp dir
  // so early-startup crashes are still captured.
  try {
    return app.getPath('logs');
  } catch {
    return path.join(os.tmpdir(), 'PartEngine-logs');
  }
}

function file(): fs.WriteStream {
  if (!stream) {
    const dir = logDir();
    fs.mkdirSync(dir, { recursive: true });
    stream = fs.createWriteStream(path.join(dir, 'partengine.log'), { flags: 'a' });
  }
  return stream;
}

/** Append a timestamped line to console and the rotating app log. */
export function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  // eslint-disable-next-line no-console
  console[level === 'info' ? 'log' : level](line);
  try {
    file().write(line + '\n');
  } catch {
    /* logging must never crash the launcher */
  }
}

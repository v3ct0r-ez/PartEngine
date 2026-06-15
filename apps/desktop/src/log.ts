import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

let stream: fs.WriteStream | undefined;

function file(): fs.WriteStream {
  if (!stream) {
    const dir = app.getPath('logs');
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

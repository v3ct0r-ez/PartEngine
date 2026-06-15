import { ChildProcess, spawn } from 'node:child_process';
import * as http from 'node:http';
import type { DesktopConfig } from './config';
import { log } from './log';

/**
 * Starts the NestJS API and the Next.js server as child Node processes, using
 * the Node runtime bundled inside Electron (ELECTRON_RUN_AS_NODE=1) so the
 * machine needs no separate Node install. Waits for each to become healthy.
 */
export class ServiceManager {
  private api?: ChildProcess;
  private web?: ChildProcess;

  constructor(private readonly cfg: DesktopConfig) {}

  get webUrl(): string {
    return `http://127.0.0.1:${this.cfg.webPort}`;
  }

  async start(): Promise<void> {
    const baseEnv = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      DATABASE_URL: this.cfg.databaseUrl,
      APP_VERSION: process.env.APP_VERSION ?? '0.1.0',
    };

    log('Starting API…');
    this.api = spawn(
      process.execPath,
      [this.cfg.apiEntry],
      {
        env: {
          ...baseEnv,
          API_PORT: String(this.cfg.apiPort),
          // Bind host controls local-only vs LAN exposure.
          HOST: this.cfg.host,
          WEB_ORIGIN: `http://localhost:${this.cfg.webPort},http://127.0.0.1:${this.cfg.webPort}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    this.pipeOutput('api', this.api);
    this.api.on('exit', (code) => log(`API exited (${code})`, code ? 'error' : 'info'));

    await this.waitForHealth(`http://127.0.0.1:${this.cfg.apiPort}/api/health`, 60_000);
    log('API is healthy.');

    log('Starting web UI…');
    this.web = spawn(
      process.execPath,
      [this.cfg.webEntry],
      {
        env: {
          ...baseEnv,
          PORT: String(this.cfg.webPort),
          HOSTNAME: this.cfg.host,
          NEXT_PUBLIC_API_URL: `http://127.0.0.1:${this.cfg.apiPort}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    this.pipeOutput('web', this.web);
    this.web.on('exit', (code) => log(`Web exited (${code})`, code ? 'error' : 'info'));

    await this.waitForHttp(this.webUrl, 60_000);
    log('Web UI is up.');
  }

  stop(): void {
    this.web?.kill();
    this.api?.kill();
  }

  /** Forward a child's stdout/stderr into the app log so failures are diagnosable. */
  private pipeOutput(name: string, child: ChildProcess): void {
    const forward = (level: 'info' | 'error') => (buf: Buffer) => {
      buf
        .toString()
        .split(/\r?\n/)
        .filter((l) => l.trim())
        .forEach((l) => log(`[${name}] ${l}`, level));
    };
    child.stdout?.on('data', forward('info'));
    child.stderr?.on('data', forward('error'));
  }

  /** Poll an API health endpoint until it reports the DB is reachable. */
  private waitForHealth(url: string, timeoutMs: number): Promise<void> {
    return this.poll(url, timeoutMs, (body) => {
      try {
        return JSON.parse(body).db === true;
      } catch {
        return false;
      }
    });
  }

  private waitForHttp(url: string, timeoutMs: number): Promise<void> {
    return this.poll(url, timeoutMs, () => true);
  }

  private poll(url: string, timeoutMs: number, accept: (body: string) => boolean): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const attempt = () => {
        const req = http.get(url, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            if (res.statusCode && res.statusCode < 500 && accept(body)) resolve();
            else retry();
          });
        });
        req.on('error', retry);
        req.setTimeout(2000, () => req.destroy());
      };
      const retry = () => {
        if (Date.now() > deadline) reject(new Error(`Timed out waiting for ${url}`));
        else setTimeout(attempt, 700);
      };
      attempt();
    });
  }
}

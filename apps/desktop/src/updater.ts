import { BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { log } from './log';

/**
 * Desktop auto-update via electron-updater (NSIS differential updates from
 * GitHub Releases) — the desktop counterpart of the server's docker updater.
 *
 * Model matches the rest of PartEngine: **notify + one-click apply**. We disable
 * autoDownload so the in-app banner controls the flow:
 *   check → (update-available) → download → (downloaded) → install & restart.
 *
 * State + events are bridged to the renderer over IPC (see preload.ts), so the
 * existing web UpdateBanner drives it with no server round-trip on desktop.
 */
export type UpdaterPhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdaterState {
  phase: UpdaterPhase;
  currentVersion: string;
  latestVersion: string | null;
  releaseNotes: string | null;
  percent: number;
  error: string | null;
}

export class UpdaterManager {
  private state: UpdaterState = {
    phase: 'idle',
    currentVersion: autoUpdater.currentVersion?.version ?? '0.1.0',
    latestVersion: null,
    releaseNotes: null,
    percent: 0,
    error: null,
  };

  constructor(private readonly getWindow: () => BrowserWindow | undefined) {}

  init(isPackaged: boolean) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = {
      info: (m: string) => log(`[updater] ${m}`),
      warn: (m: string) => log(`[updater] ${m}`, 'warn'),
      error: (m: string) => log(`[updater] ${m}`, 'error'),
      debug: () => undefined,
    } as never;

    autoUpdater.on('checking-for-update', () => this.set({ phase: 'checking', error: null }));
    autoUpdater.on('update-available', (info) =>
      this.set({
        phase: 'available',
        latestVersion: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
      }),
    );
    autoUpdater.on('update-not-available', () => this.set({ phase: 'not-available' }));
    autoUpdater.on('download-progress', (p) =>
      this.set({ phase: 'downloading', percent: Math.round(p.percent) }),
    );
    autoUpdater.on('update-downloaded', (info) =>
      this.set({ phase: 'downloaded', latestVersion: info.version, percent: 100 }),
    );
    autoUpdater.on('error', (err) => {
      const msg = err?.message ?? String(err);
      // No published release yet (or private repo without a token) → 404 on the
      // releases feed. That's "nothing to update to", not a real error.
      if (/404/.test(msg)) {
        log('[updater] no published release yet (404) — nothing to update');
        this.set({ phase: 'not-available', error: null });
        return;
      }
      this.set({ phase: 'error', error: msg });
    });

    // IPC surface consumed by the renderer (web UI) via the preload bridge.
    ipcMain.handle('updater:status', () => this.state);
    ipcMain.handle('updater:check', () => this.check(isPackaged));
    ipcMain.handle('updater:download', () => this.download());
    ipcMain.handle('updater:install', () => this.install());

    // A check shortly after startup so the banner is ready (packaged only).
    if (isPackaged) setTimeout(() => void this.check(isPackaged), 8_000);
  }

  async check(isPackaged: boolean): Promise<UpdaterState> {
    if (!isPackaged) {
      // electron-updater requires a packaged app; in dev we no-op cleanly.
      this.set({ phase: 'not-available', error: null });
      return this.state;
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      this.set({ phase: 'error', error: (err as Error).message });
    }
    return this.state;
  }

  async download(): Promise<UpdaterState> {
    try {
      this.set({ phase: 'downloading', percent: 0 });
      await autoUpdater.downloadUpdate();
    } catch (err) {
      this.set({ phase: 'error', error: (err as Error).message });
    }
    return this.state;
  }

  /** Quit and install the downloaded update (restarts the app). */
  install(): void {
    if (this.state.phase === 'downloaded') autoUpdater.quitAndInstall();
  }

  private set(patch: Partial<UpdaterState>) {
    this.state = { ...this.state, ...patch };
    this.getWindow()?.webContents.send('updater:event', this.state);
  }
}

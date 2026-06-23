import { app, BrowserWindow, dialog, ipcMain, Menu, shell, Tray } from 'electron';
import * as os from 'node:os';
import * as path from 'node:path';
import { BackupService } from './backup';
import {
  loadConfig,
  readUserSettings,
  settingsFilePath,
  writeUserSettings,
  type DesktopConfig,
  type UserSettings,
} from './config';
import { DatabaseManager } from './database';
import { log } from './log';
import { ServiceManager } from './services';
import { UpdaterManager } from './updater';

// Set the app name BEFORE any getPath() call so userData/logs live under
// %APPDATA%/PartEngine (not the npm-scoped package name, "@partengine…").
app.setName('PartEngine');

// VERY FIRST thing: prove the process started and install crash handlers, so
// any failure from here on is logged + shown rather than disappearing silently.
log(`main process started (electron ${process.versions.electron}, pid ${process.pid})`);
process.on('uncaughtException', (err) => onUnexpected(err));
process.on('unhandledRejection', (reason) =>
  onUnexpected(reason instanceof Error ? reason : new Error(String(reason))),
);

// During shutdown, embedded-postgres (beta) can throw asynchronously
// ("done is not a function"); don't let teardown noise pop a fatal dialog.
function onUnexpected(err: Error) {
  if (shuttingDown) {
    log(`Ignored error during shutdown: ${err.message}`, 'warn');
    return;
  }
  fatal(err);
}

// Managers are created during bootstrap (after app is ready) so that any error
// in their construction is caught and logged.
let cfg: DesktopConfig;
let db: DatabaseManager | undefined;
let services: ServiceManager | undefined;
let updater: UpdaterManager | undefined;
let backup: BackupService | undefined;

let mainWindow: BrowserWindow | undefined;
let loadingWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let shuttingDown = false;

// ── Progress reporting to the loading window ─────────────────
let loadingReady = false;
const pendingStatus: Array<{ label: string; state: 'active' | 'done' | 'error' }> = [];
let lastStepLabel: string | undefined;

function sendStatus(label: string, state: 'active' | 'done' | 'error') {
  const payload = { label, state };
  if (loadingWindow && loadingReady) loadingWindow.webContents.send('pe:status', payload);
  else pendingStatus.push(payload);
}

/** Mark the previous step done and start a new active step (also logged). */
function progress(label: string) {
  log(label);
  if (lastStepLabel && lastStepLabel !== label) sendStatus(lastStepLabel, 'done');
  lastStepLabel = label;
  sendStatus(label, 'active');
}
function progressDone() {
  if (lastStepLabel) sendStatus(lastStepLabel, 'done');
}

// Single-instance: a second launch focuses the existing window instead of
// starting a second Postgres against the same data dir.
if (!app.requestSingleInstanceLock()) {
  log('Another PartEngine instance is already running — exiting.', 'warn');
  app.quit();
} else {
  app.on('second-instance', () => mainWindow?.focus());
  app.whenReady().then(bootstrap).catch(fatal);
}

async function bootstrap() {
  log('app ready — bootstrapping');
  createLoadingWindow(); // show something immediately, before the heavy work

  cfg = loadConfig();
  log(`config: packaged=${cfg.isPackaged} apiPort=${cfg.apiPort} webPort=${cfg.webPort}`);
  db = new DatabaseManager(cfg, progress);
  services = new ServiceManager(cfg, progress);
  updater = new UpdaterManager(() => mainWindow);
  backup = new BackupService(cfg);
  registerIpc();

  await db.start(); // embedded Postgres + migrations
  await services.start(); // API (health-gated) then Next.js
  progress('Apertura applicazione…');
  progressDone();
  createMainWindow();
  createTray();
  updater.init(cfg.isPackaged); // electron-updater (GitHub Releases, NSIS)
  log('PartEngine is ready.');
}

// Validate a renderer-supplied settings patch into a safe UserSettings subset.
function sanitizeSettings(patch: unknown): UserSettings {
  const out: UserSettings = {};
  if (typeof patch !== 'object' || patch === null) return out;
  const p = patch as Record<string, unknown>;
  for (const key of ['dataDir', 'storageDir', 'backupDir'] as const) {
    const v = p[key];
    if (typeof v === 'string' && v.trim() && path.isAbsolute(v)) out[key] = v;
  }
  if (p.backupKeep !== undefined) {
    const n = Math.floor(Number(p.backupKeep));
    if (Number.isFinite(n) && n >= 0) out.backupKeep = Math.min(n, 1000);
  }
  return out;
}

// Settings bridge (consumed by the web /settings page via the preload).
function registerIpc() {
  // Window controls for the frameless main window (custom title bar).
  ipcMain.handle('win:minimize', () => mainWindow?.minimize());
  ipcMain.handle('win:maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('win:close', () => mainWindow?.close());
  // Non-toggling: ensure the window is maximized (used to go full-size on login).
  ipcMain.handle('win:enterFullscreen', () => {
    if (mainWindow && !mainWindow.isMaximized()) mainWindow.maximize();
    return true;
  });

  ipcMain.handle('settings:get', () => ({
    settings: readUserSettings(),
    paths: {
      dataDir: cfg.dataDir,
      storageDir: cfg.storageDir,
      backupDir: cfg.backupDir,
      configFile: settingsFilePath(),
    },
    backupEnabled: backup?.enabled ?? false,
    backups: backup?.list().map((b) => ({ name: b.name, at: b.at.toISOString() })) ?? [],
  }));
  ipcMain.handle('settings:save', (_e, patch: unknown) => {
    // The renderer is web content; never trust the patch shape. Whitelist the
    // four known keys, require absolute directory paths, and clamp backupKeep —
    // a bad dataDir/backupDir would otherwise brick startup (it's used as the
    // Postgres data dir and the cold-backup source) or corrupt config.json.
    const clean = sanitizeSettings(patch);
    writeUserSettings({ ...readUserSettings(), ...clean });
    return { ok: true };
  });
  ipcMain.handle('settings:pickFolder', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('settings:openPath', (_e, p: unknown) => {
    // Only allow opening the directories we actually expose to the renderer,
    // not an arbitrary renderer-supplied path.
    const allowed = [cfg.dataDir, cfg.storageDir, cfg.backupDir, path.dirname(settingsFilePath())];
    if (typeof p !== 'string' || !allowed.some((a) => a && path.resolve(p) === path.resolve(a))) {
      return { ok: false };
    }
    void shell.openPath(p);
    return { ok: true };
  });

  // Silent label printing: render the HTML in an offscreen window and print to
  // the default printer with no dialog, at the 50×30 mm label page size.
  ipcMain.handle('print:label', async (_e, html: unknown) => {
    if (typeof html !== 'string') return { ok: false, error: 'invalid html' };
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    try {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      await new Promise((r) => setTimeout(r, 200)); // let the QR/logo image paint
      await new Promise<void>((resolve, reject) => {
        win.webContents.print(
          {
            silent: true,
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize: { width: 50000, height: 30000 }, // microns: 50×30 mm
          },
          (success, reason) => (success ? resolve() : reject(new Error(reason || 'print failed'))),
        );
      });
      return { ok: true };
    } catch (err) {
      log(`print:label failed — ${(err as Error).message}`, 'warn');
      return { ok: false, error: (err as Error).message };
    } finally {
      if (!win.isDestroyed()) win.close();
    }
  });
}

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 600,
    height: 560,
    useContentSize: true,
    frame: false,
    resizable: false,
    show: true,
    icon: path.join(__dirname, '..', 'static', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'loading-preload.js'),
    },
  });
  loadingWindow.loadFile(path.join(__dirname, '..', 'static', 'loading.html'));
  // Flush any progress emitted before the page finished loading.
  loadingWindow.webContents.on('did-finish-load', () => {
    loadingReady = true;
    for (const p of pendingStatus) loadingWindow?.webContents.send('pe:status', p);
    pendingStatus.length = 0;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    title: 'PartEngine',
    icon: path.join(__dirname, '..', 'static', 'icon.ico'),
    // Frameless: the OS title bar is removed and replaced by an in-app,
    // theme-aware title bar (see DesktopTitleBar in the web UI) that provides
    // the drag region and minimize/maximize/close controls via IPC.
    frame: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Open external links in the system browser, never inside the app shell.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(services!.webUrl);
  mainWindow.once('ready-to-show', () => {
    loadingWindow?.close();
    loadingWindow = undefined;
    mainWindow?.show();
  });
}

function createTray() {
  // Tray lets the all-in-one server keep running in the background and exposes
  // the LAN address so other machines can connect when LAN mode is enabled.
  try {
    tray = new Tray(path.join(__dirname, '..', 'static', 'tray.png'));
  } catch {
    return; // icon optional in dev / when missing
  }
  const lanAddr = cfg.lanEnabled ? `http://${firstLanIp()}:${cfg.webPort}` : 'solo locale';
  tray.setToolTip(`PartEngine — ${lanAddr}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Apri PartEngine', click: () => mainWindow?.show() },
      { label: `Indirizzo LAN: ${lanAddr}`, enabled: false },
      { type: 'separator' },
      { label: 'Esci', click: () => app.quit() },
    ]),
  );
}

function firstLanIp(): string {
  const nets = os.networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const n of ifaces ?? []) {
      if (n.family === 'IPv4' && !n.internal) return n.address;
    }
  }
  return '127.0.0.1';
}

function fatal(err: Error) {
  log(`FATAL: ${err.stack ?? err.message}`, 'error');
  try {
    dialog.showErrorBox(
      'PartEngine — avvio fallito',
      `${err.message}\n\nLog: %APPDATA%\\PartEngine\\logs\\partengine.log`,
    );
  } catch {
    /* dialog may be unavailable very early */
  }
  app.quit();
}

async function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log('Shutting down…');
  services?.stop();
  // Only run the cold backup if Postgres actually stopped — copying a live
  // cluster yields an inconsistent (corrupt) backup, the very thing the
  // cold-copy design avoids.
  let stopped = true;
  if (db) {
    try {
      await db.stop();
    } catch (err) {
      stopped = false;
      log(`DB stop failed; skipping cold backup: ${(err as Error).message}`, 'error');
    }
  }
  if (stopped) {
    try {
      backup?.backupColdSync();
    } catch {
      /* backup must never block shutdown */
    }
  }
}

app.on('before-quit', (e) => {
  if (!shuttingDown) {
    e.preventDefault();
    void gracefulShutdown().finally(() => app.exit(0));
  }
});

app.on('window-all-closed', () => {
  // Keep running in the tray (all-in-one server) unless the user explicitly quits.
  if (process.platform !== 'darwin' && !tray) app.quit();
});

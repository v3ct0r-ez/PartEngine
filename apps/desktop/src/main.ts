import { app, BrowserWindow, dialog, Menu, shell, Tray } from 'electron';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfig, type DesktopConfig } from './config';
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

  await db.start(); // embedded Postgres + migrations
  await services.start(); // API (health-gated) then Next.js
  progress('Apertura applicazione…');
  progressDone();
  createMainWindow();
  createTray();
  updater.init(cfg.isPackaged); // electron-updater (GitHub Releases, NSIS)
  log('PartEngine is ready.');
}

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 480,
    height: 380,
    frame: false,
    resizable: false,
    show: true,
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
  await db?.stop().catch(() => undefined);
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

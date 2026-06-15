import { app, BrowserWindow, dialog, Menu, shell, Tray } from 'electron';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfig } from './config';
import { DatabaseManager } from './database';
import { log } from './log';
import { ServiceManager } from './services';

const cfg = loadConfig();
const db = new DatabaseManager(cfg);
const services = new ServiceManager(cfg);

let mainWindow: BrowserWindow | undefined;
let loadingWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let shuttingDown = false;

// Single-instance: a second launch focuses the existing window instead of
// starting a second Postgres against the same data dir.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => mainWindow?.focus());
  app.whenReady().then(bootstrap).catch(fatal);
}

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    resizable: false,
    show: true,
    webPreferences: { contextIsolation: true },
  });
  loadingWindow.loadFile(path.join(__dirname, '..', 'static', 'loading.html'));
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

  mainWindow.loadURL(services.webUrl);
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
    return; // icon optional in dev
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

async function bootstrap() {
  createLoadingWindow();
  try {
    await db.start(); // embedded Postgres + migrations
    await services.start(); // API (health-gated) then Next.js
    createMainWindow();
    createTray();
    log('PartEngine is ready.');
  } catch (err) {
    fatal(err as Error);
  }
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
  log(`FATAL: ${err.message}`, 'error');
  dialog.showErrorBox('PartEngine — avvio fallito', `${err.message}\n\nConsulta il log applicativo.`);
  app.quit();
}

async function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log('Shutting down…');
  services.stop();
  await db.stop().catch(() => undefined);
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

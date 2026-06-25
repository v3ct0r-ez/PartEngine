import { contextBridge, ipcRenderer } from 'electron';

/**
 * Minimal, locked-down preload. contextIsolation is on and nodeIntegration is
 * off, so the web UI gets only this small, explicit surface — no raw Node/IPC
 * access from the renderer.
 *
 * The `updater` bridge lets the existing web UpdateBanner drive the desktop
 * auto-updater (electron-updater) with no server round-trip.
 */
contextBridge.exposeInMainWorld('partengine', {
  isDesktop: true,
  platform: process.platform,
  version: process.env.APP_VERSION ?? '0.0.1',
  updater: {
    status: () => ipcRenderer.invoke('updater:status'),
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    /** Subscribe to live updater state; returns an unsubscribe function. */
    onEvent: (cb: (state: unknown) => void) => {
      const listener = (_e: unknown, state: unknown) => cb(state);
      ipcRenderer.on('updater:event', listener);
      return () => ipcRenderer.removeListener('updater:event', listener);
    },
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (patch: unknown) => ipcRenderer.invoke('settings:save', patch),
    pickFolder: () => ipcRenderer.invoke('settings:pickFolder'),
    openPath: (p: string) => ipcRenderer.invoke('settings:openPath', p),
  },
  window: {
    minimize: () => ipcRenderer.invoke('win:minimize'),
    maximize: () => ipcRenderer.invoke('win:maximize'),
    close: () => ipcRenderer.invoke('win:close'),
    enterFullscreen: () => ipcRenderer.invoke('win:enterFullscreen'),
  },
  print: {
    /** Print a label HTML document silently to the chosen/default printer (no dialog). */
    label: (html: string) => ipcRenderer.invoke('print:label', html),
    /** List the installed printers (name + default flag). */
    listPrinters: () => ipcRenderer.invoke('print:listPrinters'),
  },
  /** Open an external https URL in the user's default browser. */
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
});

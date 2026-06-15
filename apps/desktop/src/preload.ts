import { contextBridge } from 'electron';

/**
 * Minimal, locked-down preload. contextIsolation is on and nodeIntegration is
 * off, so the web UI gets only this small, explicit surface — no raw Node/IPC
 * access from the renderer.
 */
contextBridge.exposeInMainWorld('partengine', {
  isDesktop: true,
  platform: process.platform,
  version: process.env.APP_VERSION ?? '0.1.0',
});

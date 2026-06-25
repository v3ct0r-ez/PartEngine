// Shape of the `window.partengine` bridge injected by the Electron preload.
// Absent when running as a plain web app (the banner falls back to the HTTP API).

export interface DesktopUpdaterState {
  phase: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  currentVersion: string;
  latestVersion: string | null;
  releaseNotes: string | null;
  percent: number;
  error: string | null;
}

export interface DesktopSettings {
  settings: { dataDir?: string; storageDir?: string; backupDir?: string; backupKeep?: number; printerName?: string };
  paths: { dataDir: string; storageDir: string; backupDir: string; configFile: string };
  backupEnabled: boolean;
  backups: { name: string; at: string }[];
}

export interface DesktopPrinter {
  name: string;
  displayName: string;
  isDefault: boolean;
}

export interface PartEngineBridge {
  isDesktop: true;
  platform: string;
  version: string;
  updater: {
    status: () => Promise<DesktopUpdaterState>;
    check: () => Promise<DesktopUpdaterState>;
    download: () => Promise<DesktopUpdaterState>;
    install: () => Promise<void>;
    onEvent: (cb: (state: DesktopUpdaterState) => void) => () => void;
  };
  settings: {
    get: () => Promise<DesktopSettings>;
    save: (patch: { dataDir?: string; storageDir?: string; backupDir?: string; backupKeep?: number; printerName?: string }) => Promise<{ ok: boolean }>;
    pickFolder: () => Promise<string | null>;
    openPath: (p: string) => Promise<string>;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    enterFullscreen: () => void;
  };
  print: {
    label: (html: string) => Promise<{ ok: boolean; error?: string }>;
    listPrinters: () => Promise<DesktopPrinter[]>;
  };
}

declare global {
  interface Window {
    partengine?: PartEngineBridge;
  }
}

export {};

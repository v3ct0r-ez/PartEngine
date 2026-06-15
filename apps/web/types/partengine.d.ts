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
}

declare global {
  interface Window {
    partengine?: PartEngineBridge;
  }
}

export {};

'use client';

import { useEffect, useState } from 'react';

interface DesktopBridge {
  isDesktop?: boolean;
  window?: { minimize: () => void; maximize: () => void; close: () => void };
}
function bridge(): DesktopBridge | undefined {
  return typeof window !== 'undefined' ? (window as unknown as { partengine?: DesktopBridge }).partengine : undefined;
}

/**
 * Theme-aware replacement for the OS window title bar. The Electron main window
 * is frameless (frame:false); this thin bar provides the drag region (so the
 * window can still be moved) and the minimize/maximize/close controls via the
 * preload `window` bridge. Rendered only inside the desktop shell — in a plain
 * browser `partengine` is undefined and nothing shows.
 */
export function DesktopTitleBar() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => setIsDesktop(!!bridge()?.isDesktop), []);
  if (!isDesktop) return null;

  const win = bridge()?.window;
  const btn = 'app-no-drag flex h-8 w-11 items-center justify-center text-muted-foreground hover:bg-muted';

  return (
    <div className="app-drag flex h-8 shrink-0 items-center justify-between border-b border-border bg-muted/40 pl-3 select-none">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground">PartEngine</span>
      <div className="flex items-stretch">
        <button className={btn} title="Riduci a icona" onClick={() => win?.minimize()} aria-label="Riduci">
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="4.5" width="10" height="1" fill="currentColor" /></svg>
        </button>
        <button className={btn} title="Ingrandisci" onClick={() => win?.maximize()} aria-label="Ingrandisci">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" /></svg>
        </button>
        <button
          className="app-no-drag flex h-8 w-11 items-center justify-center text-muted-foreground hover:bg-red-600 hover:text-white"
          title="Chiudi"
          onClick={() => win?.close()}
          aria-label="Chiudi"
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0 L10 10 M10 0 L0 10" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
      </div>
    </div>
  );
}

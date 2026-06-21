'use client';

import { APP_VERSION } from '@/lib/version';
import { useEffect, useState } from 'react';

/**
 * Small version label for the sidebar footer. Prefers the desktop bridge's
 * version (tag-derived in packaged builds) and falls back to the build-time
 * constant in the browser. Rendered after mount to avoid a hydration mismatch
 * (the desktop bridge only exists client-side).
 */
export function AppVersion() {
  const [version, setVersion] = useState(APP_VERSION);
  useEffect(() => {
    const v = typeof window !== 'undefined' ? window.partengine?.version : undefined;
    if (v) setVersion(v);
  }, []);
  return (
    <div className="border-t border-border/60 pt-3">
      <div className="flex items-center gap-2 px-1">
        <span className="h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-indigo-400" />
        <span className="text-xs font-semibold tracking-tight">PartEngine</span>
        <span className="ml-auto rounded-full border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
          v{version}
        </span>
      </div>
    </div>
  );
}

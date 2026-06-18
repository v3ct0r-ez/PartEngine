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
  return <div className="text-xs text-muted-foreground">v{version}</div>;
}

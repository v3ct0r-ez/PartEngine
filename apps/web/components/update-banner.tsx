'use client';

import { applyUpdate, getUpdateStatus } from '@/lib/api';
import type { DesktopUpdaterState } from '@/types/partengine';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * Update banner — notify + one-click apply, in both deployment modes:
 *  - Desktop (Electron): drives electron-updater over the window.partengine
 *    bridge (check → download → install & restart), with live progress.
 *  - Web/Docker: polls the API's cached update status and triggers the
 *    server-side apply endpoint.
 */
export function UpdateBanner() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => setIsDesktop(typeof window !== 'undefined' && !!window.partengine?.isDesktop), []);
  return isDesktop ? <DesktopBanner /> : <WebBanner />;
}

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-primary/30 bg-primary/10 px-6 py-2 text-sm">
      {children}
    </div>
  );
}

// ── Desktop: electron-updater via the preload bridge ─────────
function DesktopBanner() {
  const [state, setState] = useState<DesktopUpdaterState | null>(null);

  useEffect(() => {
    const u = window.partengine!.updater;
    void u.status().then(setState);
    const off = u.onEvent(setState);
    return off;
  }, []);

  if (!state) return null;
  const u = window.partengine!.updater;

  if (state.phase === 'downloading') {
    return (
      <Bar>
        <span>Download aggiornamento {state.latestVersion}… {state.percent}%</span>
      </Bar>
    );
  }
  if (state.phase === 'downloaded') {
    return (
      <Bar>
        <span className="font-medium">Aggiornamento {state.latestVersion} pronto.</span>
        <button
          onClick={() => void u.install()}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Installa e riavvia
        </button>
      </Bar>
    );
  }
  if (state.phase === 'available') {
    return (
      <Bar>
        <span>
          <span className="font-medium">Aggiornamento disponibile:</span>{' '}
          <span className="font-mono">{state.currentVersion}</span> →{' '}
          <span className="font-mono">{state.latestVersion}</span>
        </span>
        <button
          onClick={() => void u.download()}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Scarica aggiornamento
        </button>
      </Bar>
    );
  }
  return null;
}

// ── Web/Docker: API status + server-side apply ───────────────
function WebBanner() {
  const { data } = useQuery({
    queryKey: ['update-status'],
    queryFn: getUpdateStatus,
    refetchInterval: 5 * 60_000,
    retry: false,
  });
  const apply = useMutation({ mutationFn: applyUpdate });

  if (!data?.updateAvailable && !apply.isSuccess) return null;

  if (apply.isSuccess || data?.applying) {
    return (
      <div className="border-b border-amber-500/40 bg-amber-500/10 px-6 py-2 text-sm text-amber-700">
        Aggiornamento in corso… il sistema si riavvierà a breve. Ricarica tra qualche istante.
      </div>
    );
  }

  return (
    <Bar>
      <div>
        <span className="font-medium">Aggiornamento disponibile:</span>{' '}
        <span className="font-mono">{data!.currentVersion}</span> →{' '}
        <span className="font-mono">{data!.latestVersion}</span>
        {data!.releaseUrl && (
          <a href={data!.releaseUrl} target="_blank" rel="noreferrer" className="ml-2 text-primary underline">
            note di rilascio
          </a>
        )}
      </div>
      <button
        onClick={() => apply.mutate()}
        disabled={apply.isPending}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        {apply.isPending ? 'Avvio…' : 'Aggiorna ora'}
      </button>
    </Bar>
  );
}

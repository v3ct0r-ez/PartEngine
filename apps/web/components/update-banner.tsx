'use client';

import { applyUpdate, getUpdateStatus } from '@/lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';

/**
 * Update banner (notify + one-click apply). Polls the API's cached update
 * status; when a newer GitHub release exists it surfaces a banner with release
 * notes and an "Aggiorna ora" button (server-side restricted to SUPER_ADMIN and
 * the UPDATE_ALLOW_APPLY flag — the button simply triggers the gated endpoint).
 */
export function UpdateBanner() {
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
    <div className="flex items-center justify-between gap-4 border-b border-primary/30 bg-primary/10 px-6 py-2 text-sm">
      <div>
        <span className="font-medium">Aggiornamento disponibile:</span>{' '}
        <span className="font-mono">{data!.currentVersion}</span> →{' '}
        <span className="font-mono">{data!.latestVersion}</span>
        {data!.releaseUrl && (
          <a
            href={data!.releaseUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-2 text-primary underline"
          >
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
      {apply.isError && (
        <span className="text-xs text-red-500">{(apply.error as Error).message}</span>
      )}
    </div>
  );
}

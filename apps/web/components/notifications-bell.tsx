'use client';

import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const KIND_STYLES: Record<string, string> = {
  OUT_OF_STOCK: 'text-red-600',
  CRITICAL_STOCK: 'text-orange-600',
  LOW_STOCK: 'text-amber-600',
  ORDER_LATE: 'text-purple-600',
  MISSING_DATASHEET: 'text-blue-600',
};
const KIND_LABEL: Record<string, string> = {
  OUT_OF_STOCK: 'Esaurito',
  CRITICAL_STOCK: 'Scorta critica',
  LOW_STOCK: 'Scorta bassa',
  ORDER_LATE: 'Ordine in ritardo',
  MISSING_DATASHEET: 'Datasheet mancante',
};

/** Notification bell with unread badge and a dropdown list. Polls the alert engine. */
export function NotificationsBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications(false),
    refetchInterval: 60_000,
    retry: false,
  });

  const read = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = data?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md px-3 py-2 text-sm hover:bg-muted"
      >
        Notifiche
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-xs text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 max-h-96 w-80 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium">Notifiche</span>
            <button onClick={() => readAll.mutate()} className="text-xs text-primary hover:underline">
              Segna tutte lette
            </button>
          </div>
          {(data ?? []).length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nessuna notifica.
            </div>
          )}
          {data?.map((n) => (
            <button
              key={n.id}
              onClick={() => read.mutate(n.id)}
              className={`flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2 text-left text-sm hover:bg-muted ${n.isRead ? 'opacity-50' : ''}`}
            >
              <span className={`rounded-full border border-current/30 px-2 py-0.5 text-xs font-semibold ${KIND_STYLES[n.kind] ?? ''}`}>{KIND_LABEL[n.kind] ?? n.kind.replace(/_/g, ' ')}</span>
              <span>{n.message}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

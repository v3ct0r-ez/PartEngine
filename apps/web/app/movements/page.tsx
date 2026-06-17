'use client';

import { listRecentMovements } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

const TYPE_LABEL: Record<string, string> = {
  INBOUND: 'Carico',
  OUTBOUND: 'Scarico',
  TRANSFER: 'Trasferimento',
  ADJUSTMENT: 'Correzione',
};

export default function MovementsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['recent-movements'], queryFn: () => listRecentMovements(200) });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Storico movimenti</h1>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Componente</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Qtà</th>
              <th className="px-3 py-2">Riferimento</th>
              <th className="px-3 py-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Caricamento…</td></tr>
            )}
            {data?.map((m) => (
              <tr key={m.id} className="border-t border-border hover:bg-muted/40">
                <td className="px-3 py-2 text-xs">{new Date(m.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className="font-mono text-xs">{m.component?.internalCode}</span> {m.component?.name}
                </td>
                <td className="px-3 py-2">{TYPE_LABEL[m.type] ?? m.type}</td>
                <td className="px-3 py-2 font-mono">{m.quantity}</td>
                <td className="px-3 py-2">{m.reference ?? '—'}</td>
                <td className="px-3 py-2">{m.reason ?? '—'}</td>
              </tr>
            ))}
            {data && data.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nessun movimento registrato.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

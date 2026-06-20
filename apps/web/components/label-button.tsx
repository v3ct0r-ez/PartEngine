'use client';

import { printLabel } from '@/lib/label';
import QRCode from 'qrcode';
import { useState } from 'react';

/**
 * Generates a QR label (encoding the internal code) and prints it on a 50×30 mm
 * thermal label via the shared printLabel() helper. Shows an in-app preview
 * first; the actual print uses a hidden <iframe> (window.open is blocked in the
 * Electron shell).
 */
export function LabelButton({ internalCode, name }: { internalCode: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    try {
      setDataUrl(await QRCode.toDataURL(internalCode, { margin: 1, width: 240 }));
    } finally {
      setBusy(false);
    }
  }

  function print() {
    void printLabel({ code: internalCode, name, qr: true });
  }

  return (
    <>
      <button onClick={open} disabled={busy} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
        {busy ? '…' : 'Etichetta QR'}
      </button>
      {dataUrl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={() => setDataUrl(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xs space-y-4 rounded-xl border border-border bg-background p-6 text-center shadow-xl">
            <h2 className="text-lg font-bold">Etichetta QR</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt={internalCode} className="mx-auto h-40 w-40" />
            <div>
              <div className="font-mono font-bold">{internalCode}</div>
              <div className="text-xs text-muted-foreground">{name}</div>
            </div>
            <div className="flex justify-center gap-2">
              <button onClick={() => setDataUrl(null)} className="rounded-md border border-border px-4 py-2 text-sm">Chiudi</button>
              <button onClick={print} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Stampa</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

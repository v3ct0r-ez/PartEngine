'use client';

import QRCode from 'qrcode';
import { useState } from 'react';

/**
 * Generates a QR label (encoding the internal code) and prints it.
 *
 * Uses an in-app modal preview + a hidden <iframe> for printing instead of
 * window.open: the Electron shell denies every window.open call (it routes
 * external URLs to the system browser), so a popup-based label would silently
 * do nothing on the desktop build. An iframe stays inside the renderer and
 * prints in both Electron and the browser.
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
    if (!dataUrl) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!doctype html><html><head><title>${escapeHtml(internalCode)}</title>
      <style>
        @page { size: 50mm 30mm; margin: 2mm; }
        body { font-family: system-ui, sans-serif; margin: 0; display: flex; gap: 10px; align-items: center; padding: 6px; }
        img { width: 110px; height: 110px; }
        .t { font-size: 13px; }
        .code { font-family: monospace; font-weight: 700; }
        .name { color: #444; font-size: 11px; }
      </style></head><body>
        <img src="${dataUrl}" />
        <div class="t"><div class="code">${escapeHtml(internalCode)}</div><div class="name">${escapeHtml(name)}</div></div>
      </body></html>`);
    doc.close();
    const win = iframe.contentWindow!;
    const fire = () => {
      win.focus();
      win.print();
      setTimeout(() => iframe.remove(), 500);
    };
    // Wait for the QR image to decode before printing, else it prints blank.
    const img = doc.querySelector('img');
    if (img && !img.complete) img.onload = fire;
    else setTimeout(fire, 50);
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

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

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
      // Higher resolution than the printed size so the QR stays crisp on a
      // 203-dpi thermal head (26mm ≈ 207px).
      setDataUrl(await QRCode.toDataURL(internalCode, { margin: 1, width: 360 }));
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
        @page { size: 50mm 30mm; margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; }
        /* 2mm safe padding inside the 50x30 label (printers clip the very edge). */
        .label { width: 50mm; height: 30mm; padding: 2mm; display: flex; align-items: center; gap: 2mm; }
        .qr { width: 26mm; height: 26mm; flex: 0 0 26mm; image-rendering: pixelated; }
        .info { flex: 1; min-width: 0; overflow: hidden; }
        .code { font-family: ui-monospace, monospace; font-weight: 700; font-size: 3.2mm; line-height: 1.1; word-break: break-all; }
        .name { font-family: system-ui, sans-serif; font-size: 2.3mm; line-height: 1.15; margin-top: 1mm;
                display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      </style></head><body>
        <div class="label">
          <img class="qr" src="${dataUrl}" />
          <div class="info"><div class="code">${escapeHtml(internalCode)}</div><div class="name">${escapeHtml(name)}</div></div>
        </div>
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

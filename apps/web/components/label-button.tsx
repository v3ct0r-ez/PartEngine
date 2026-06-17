'use client';

import QRCode from 'qrcode';
import { useState } from 'react';

/**
 * Generates a QR label (encoding the internal code) and opens a print window.
 * A USB scanner reading the QR yields the internal code, which the scan box
 * looks up — closing the "scan a QR → component opens" loop.
 */
export function LabelButton({ internalCode, name }: { internalCode: string; name: string }) {
  const [busy, setBusy] = useState(false);

  async function print() {
    setBusy(true);
    try {
      const dataUrl = await QRCode.toDataURL(internalCode, { margin: 1, width: 240 });
      const w = window.open('', '_blank', 'width=420,height=320');
      if (!w) return;
      w.document.write(`<!doctype html><html><head><title>${internalCode}</title>
        <style>
          @page { size: 50mm 30mm; margin: 2mm; }
          body { font-family: system-ui, sans-serif; margin: 0; display: flex; gap: 10px; align-items: center; padding: 6px; }
          img { width: 110px; height: 110px; }
          .t { font-size: 13px; }
          .code { font-family: monospace; font-weight: 700; }
          .name { color: #444; font-size: 11px; }
        </style></head><body>
          <img src="${dataUrl}" />
          <div class="t"><div class="code">${internalCode}</div><div class="name">${name.replace(/</g, '&lt;')}</div></div>
          <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };<\/script>
        </body></html>`);
      w.document.close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={print} disabled={busy} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
      {busy ? '…' : 'Etichetta QR'}
    </button>
  );
}

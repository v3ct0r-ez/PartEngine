'use client';

import { LabelPreviewModal } from '@/components/label-preview';
import { useState } from 'react';

/** Small QR-code glyph used in place of the literal text "QR". */
function QrIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" className={className}>
      {/* three finder squares */}
      <path d="M3 3h7v7H3V3zm2 2v3h3V5H5z" />
      <path d="M14 3h7v7h-7V3zm2 2v3h3V5h-3z" />
      <path d="M3 14h7v7H3v-7zm2 2v3h3v-3H5z" />
      {/* data modules */}
      <path d="M14 14h2v2h-2v-2zm3 0h2v2h-2v-2zm2 2v2h-2v-2h2zm-3 1h-2v2h2v-2zm0 3h2v2h-2v-2zm3 0v2h-2v-2h2z" />
    </svg>
  );
}

/**
 * Opens a faithful preview of the 50×30 mm QR label (encoding the internal code);
 * the user prints from the preview. The actual print uses a hidden <iframe>
 * (window.open is blocked in the Electron shell).
 */
export function LabelButton({ internalCode, name }: { internalCode: string; name: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
        Etichetta
        <QrIcon />
      </button>
      {open && (
        <LabelPreviewModal spec={{ code: internalCode, name, qr: true, showCode: false }} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

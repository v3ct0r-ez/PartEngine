'use client';

import { LabelPreviewModal } from '@/components/label-preview';
import { useState } from 'react';

/**
 * Opens a faithful preview of the 50×30 mm QR label (encoding the internal code);
 * the user prints from the preview. The actual print uses a hidden <iframe>
 * (window.open is blocked in the Electron shell).
 */
export function LabelButton({ internalCode, name }: { internalCode: string; name: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
        Etichetta QR
      </button>
      {open && (
        <LabelPreviewModal spec={{ code: internalCode, name, qr: true, showCode: false }} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

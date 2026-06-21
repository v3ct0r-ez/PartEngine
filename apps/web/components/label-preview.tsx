'use client';

import { buildLabelHtml, printLabelHtml, type LabelSpec } from '@/lib/label';
import { useEffect, useState } from 'react';

/**
 * Shows a faithful render of the 50×30 mm label (the exact document that will be
 * printed, rendered in an iframe and scaled up) and only prints when the user
 * confirms with "Stampa". Render-first, then print.
 */
export function LabelPreviewModal({ spec, onClose }: { spec: LabelSpec; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    buildLabelHtml(spec).then((h) => { if (alive) setHtml(h); });
    return () => { alive = false; };
  }, [spec.code, spec.name, spec.qr]); // eslint-disable-line react-hooks/exhaustive-deps

  // The label is 50×30 mm; scale it ~3.4× so the preview is comfortably readable.
  const scale = 3.4;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="space-y-4 rounded-xl border border-border bg-background p-6 text-center shadow-xl">
        <h2 className="text-lg font-bold">Anteprima etichetta</h2>
        <p className="text-xs text-muted-foreground">Etichetta 50×30 mm — anteprima fedele alla stampa.</p>
        <div className="mx-auto bg-white" style={{ width: `calc(50mm * ${scale})`, height: `calc(30mm * ${scale})` }}>
          {html && (
            <iframe
              title={`Anteprima ${spec.code}`}
              srcDoc={html}
              scrolling="no"
              className="border border-border bg-white"
              style={{ width: '50mm', height: '30mm', transform: `scale(${scale})`, transformOrigin: 'top left' }}
            />
          )}
        </div>
        <div className="flex justify-center gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Chiudi</button>
          <button
            onClick={() => { if (html) printLabelHtml(html); }}
            disabled={!html}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Stampa
          </button>
        </div>
      </div>
    </div>
  );
}

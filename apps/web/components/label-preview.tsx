'use client';

import { buildLabelHtml, printLabelHtml, type LabelSpec } from '@/lib/label';
import { usePrefs } from '@/lib/preferences';
import { useEffect, useState } from 'react';

/**
 * Shows a faithful render of the label (the exact document that will be printed,
 * rendered in an iframe and scaled up) and only prints when the user confirms
 * with "Stampa". Render-first, then print. Size and styling come from the user's
 * label preferences (see /preferences).
 */
export function LabelPreviewModal({ spec, onClose }: { spec: LabelSpec; onClose: () => void }) {
  const { label } = usePrefs();
  const [html, setHtml] = useState<string | null>(null);

  const labelKey = JSON.stringify(label);
  useEffect(() => {
    let alive = true;
    buildLabelHtml(spec, label).then((h) => { if (alive) setHtml(h); });
    return () => { alive = false; };
  }, [spec.code, spec.name, spec.qr, labelKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scale the label up for a comfortable on-screen preview, but keep the modal a
  // sensible width regardless of the configured label size.
  const scale = Math.min(3.4, 170 / label.widthMm);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="space-y-4 rounded-xl border border-border bg-background p-6 text-center shadow-xl">
        <h2 className="text-lg font-bold">Anteprima etichetta</h2>
        <p className="text-xs text-muted-foreground">
          Etichetta {label.widthMm}×{label.heightMm} mm — anteprima fedele alla stampa.
        </p>
        <div className="mx-auto bg-white" style={{ width: `calc(${label.widthMm}mm * ${scale})`, height: `calc(${label.heightMm}mm * ${scale})` }}>
          {html && (
            <iframe
              title={`Anteprima ${spec.code}`}
              srcDoc={html}
              scrolling="no"
              className="border border-border bg-white"
              style={{ width: `${label.widthMm}mm`, height: `${label.heightMm}mm`, transform: `scale(${scale})`, transformOrigin: 'top left' }}
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

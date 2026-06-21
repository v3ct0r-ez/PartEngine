import QRCode from 'qrcode';

export type LabelSpec = {
  code: string;
  name?: string;
  qr?: boolean;
  /** Show the human-readable code text next to the QR (default true). The QR
   *  always encodes `code`; set false to print only the name (e.g. components). */
  showCode?: boolean;
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/**
 * Builds the full HTML document for a 50×30 mm thermal label. With `qr` (default)
 * it's the horizontal layout — a 26 mm QR (encoding `code`) on the left, `code` +
 * `name` on the right. With `qr: false` it's a text-only label: a large centred
 * `code` (+ optional `name`), used for root locations (e.g. "A-01").
 *
 * The exact same document is used both for the on-screen preview (rendered in an
 * iframe and scaled up) and for printing, so what the user sees is what prints.
 */
export async function buildLabelHtml({ code, name = '', qr = true, showCode = true }: LabelSpec): Promise<string> {
  // Higher resolution than the print size so the QR stays crisp at 203 dpi.
  const dataUrl = qr ? await QRCode.toDataURL(code, { margin: 1, width: 360 }) : '';

  const body = qr
    ? `<div class="label">
         <img class="qr" src="${dataUrl}" />
         <div class="info">${showCode ? `<div class="code mono">${escapeHtml(code)}</div>` : ''}${name ? `<div class="name sans${showCode ? '' : ' only'}">${escapeHtml(name)}</div>` : ''}</div>
       </div>`
    : `<div class="label center">
         <div class="bigcode mono">${escapeHtml(code)}</div>${name ? `<div class="name sans">${escapeHtml(name)}</div>` : ''}
       </div>`;

  return `<!doctype html><html><head><title>${escapeHtml(code)}</title>
    <style>
      @page { size: 50mm 30mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0;
        /* Crisp, high-contrast glyphs for both the screen preview and the printer. */
        -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
      /* Monospace stack with a true tabular, high-legibility face first. */
      .mono { font-family: "JetBrains Mono", "Roboto Mono", "SF Mono", "DejaVu Sans Mono", ui-monospace, Menlo, Consolas, monospace;
        font-feature-settings: "tnum" 1, "zero" 1; font-variant-ligatures: none; }
      .sans { font-family: "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", sans-serif; }
      /* 2mm safe padding inside the 50x30 label (printers clip the very edge). */
      .label { width: 50mm; height: 30mm; padding: 2mm; display: flex; align-items: center; gap: 2mm; }
      .label.center { flex-direction: column; justify-content: center; text-align: center; gap: 1mm; }
      .qr { width: 26mm; height: 26mm; flex: 0 0 26mm; image-rendering: pixelated; }
      .info { flex: 1; min-width: 0; overflow: hidden; }
      .code { font-weight: 700; font-size: 3.6mm; line-height: 1.05; letter-spacing: 0.01em; overflow-wrap: anywhere; }
      .bigcode { font-weight: 800; font-size: 10mm; line-height: 0.95; letter-spacing: 0.02em; }
      .name { font-weight: 500; font-size: 2.5mm; line-height: 1.2; margin-top: 1.2mm; color: #111;
              display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      /* When the name is the only text (no code), give it more room and weight. */
      .name.only { font-weight: 600; font-size: 3.4mm; line-height: 1.2; margin-top: 0; -webkit-line-clamp: 6; }
    </style></head><body>${body}</body></html>`;
}

/**
 * Prints a previously-built label document via a hidden <iframe> (not
 * window.open, which the Electron shell blocks).
 */
export function printLabelHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow!;
  const fire = () => {
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 500);
  };
  const img = doc.querySelector('img');
  if (img && !img.complete) img.onload = fire; // wait for the QR to decode, else blank
  else setTimeout(fire, 50);
}

/** Builds and immediately prints a label (no preview). */
export async function printLabel(spec: LabelSpec): Promise<void> {
  printLabelHtml(await buildLabelHtml(spec));
}


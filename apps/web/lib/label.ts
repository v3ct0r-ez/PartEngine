import QRCode from 'qrcode';

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/**
 * Print a 50×30 mm thermal label. With `qr` (default) it's the horizontal layout
 * — a 26 mm QR (encoding `code`) on the left, `code` + `name` on the right. With
 * `qr: false` it's a text-only label: a large centred `code` (+ optional `name`),
 * used for root locations (e.g. "A-01") where no QR is wanted.
 *
 * Uses a hidden <iframe> (not window.open, which the Electron shell blocks).
 */
export async function printLabel({
  code,
  name = '',
  qr = true,
}: {
  code: string;
  name?: string;
  qr?: boolean;
}): Promise<void> {
  // Higher resolution than the print size so the QR stays crisp at 203 dpi.
  const dataUrl = qr ? await QRCode.toDataURL(code, { margin: 1, width: 360 }) : '';

  const body = qr
    ? `<div class="label">
         <img class="qr" src="${dataUrl}" />
         <div class="info"><div class="code">${escapeHtml(code)}</div>${name ? `<div class="name">${escapeHtml(name)}</div>` : ''}</div>
       </div>`
    : `<div class="label center">
         <div class="bigcode">${escapeHtml(code)}</div>${name ? `<div class="name">${escapeHtml(name)}</div>` : ''}
       </div>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(`<!doctype html><html><head><title>${escapeHtml(code)}</title>
    <style>
      @page { size: 50mm 30mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; }
      /* 2mm safe padding inside the 50x30 label (printers clip the very edge). */
      .label { width: 50mm; height: 30mm; padding: 2mm; display: flex; align-items: center; gap: 2mm; }
      .label.center { flex-direction: column; justify-content: center; text-align: center; gap: 1mm; }
      .qr { width: 26mm; height: 26mm; flex: 0 0 26mm; image-rendering: pixelated; }
      .info { flex: 1; min-width: 0; overflow: hidden; }
      .code { font-family: ui-monospace, monospace; font-weight: 700; font-size: 3.2mm; line-height: 1.1; word-break: break-all; }
      .bigcode { font-family: ui-monospace, monospace; font-weight: 700; font-size: 9mm; line-height: 1; }
      .name { font-family: system-ui, sans-serif; font-size: 2.3mm; line-height: 1.15; margin-top: 1mm;
              display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    </style></head><body>${body}</body></html>`);
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

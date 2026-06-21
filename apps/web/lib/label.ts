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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Render a QR for `text` with the app logo composited in the centre. Uses the
 * highest error-correction level (H, ~30%) and keeps the logo small (~26%) so
 * the code stays reliably scannable. Falls back to a plain QR if the logo or
 * canvas isn't available.
 */
async function qrDataUrlWithLogo(text: string, size: number): Promise<string> {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, text, { margin: 1, width: size, errorCorrectionLevel: 'H' });
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');
  try {
    const logo = await loadImage('/logo.png');
    const lw = canvas.width * 0.26;
    const lh = lw * (logo.naturalHeight / logo.naturalWidth || 1);
    const lx = (canvas.width - lw) / 2;
    const ly = (canvas.height - lh) / 2;
    const pad = canvas.width * 0.02;
    ctx.fillStyle = '#fff';
    roundRectPath(ctx, lx - pad, ly - pad, lw + pad * 2, lh + pad * 2, (lh + pad * 2) * 0.22);
    ctx.fill();
    ctx.drawImage(logo, lx, ly, lw, lh);
  } catch {
    /* logo failed to load — keep the plain QR */
  }
  return canvas.toDataURL('image/png');
}

/**
 * Pick a font size (mm) so a name-only label fills the ~17.5×25 mm text column
 * without clipping: bounded both by the longest word (must fit one line) and by
 * the total length (must fit the area). Generalises to every category — long
 * names like "Guaine termorestringenti" simply shrink to fit.
 */
function fitNameFontMm(name: string): number {
  const W = 17.5, H = 25; // usable text column (mm), next to the 26mm QR
  const charW = 0.55, lineH = 1.25; // approx Inter metrics relative to font size
  const len = Math.max(name.length, 1);
  const longest = name.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 1);
  const byWord = W / (charW * longest); // longest word fits on a line
  const byArea = Math.sqrt((W * H * 0.82) / (charW * lineH * len)); // total text fits the area
  return Math.max(1.8, Math.min(3.4, byWord, byArea));
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
  const dataUrl = qr ? await qrDataUrlWithLogo(code, 360) : '';

  const body = qr
    ? `<div class="label">
         <img class="qr" src="${dataUrl}" />
         <div class="info">${showCode ? `<div class="code mono">${escapeHtml(code)}</div>` : ''}${name ? `<div class="name sans${showCode ? '' : ' only'}"${!showCode ? ` style="font-size:${fitNameFontMm(name)}mm"` : ''}>${escapeHtml(name)}</div>` : ''}</div>
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
              overflow-wrap: anywhere; /* break over-long words instead of clipping */
              display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      /* When the name is the only text (no code), it fills the column; the font
         size is set inline (auto-fit) and it may use more lines. */
      .name.only { font-weight: 600; line-height: 1.2; margin-top: 0; -webkit-line-clamp: 8; }
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


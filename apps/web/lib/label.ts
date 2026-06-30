import QRCode from 'qrcode';

export type LabelSpec = {
  code: string;
  name?: string;
  /** Structural: a QR-type label (component, slot) vs a text-only label (root
   *  location). The QR itself can still be turned off globally via LabelPrefs. */
  qr?: boolean;
};

/** User-configurable print-label styling (persisted in preferences). */
export interface LabelPrefs {
  /** Label size in millimetres. */
  widthMm: number;
  heightMm: number;
  /** Safe inner margin (padding) in millimetres on every side. */
  marginMm: number;
  /** Include the QR on QR-type labels. */
  qrEnabled: boolean;
  /** Side the QR sits on. */
  qrPosition: 'left' | 'right';
  /** QR square size in millimetres. */
  qrSizeMm: number;
  /** Error-correction level: L 7% · M 15% · Q 25% · H 30% (H needed for a logo). */
  qrEcLevel: 'L' | 'M' | 'Q' | 'H';
  /** Quiet-zone width around the QR, in modules. */
  qrMarginModules: number;
  /** Module (foreground) colour as #rrggbb. */
  qrColor: string;
  /** Print the human-readable code text. */
  showCode: boolean;
  /** Print the name text. */
  showName: boolean;
  /** Composite the app logo in the QR centre. */
  logoInQr: boolean;
  /** Logo size as a percentage of the QR width (when logoInQr). */
  qrLogoScale: number;
  /** Space between the QR and the text column, in millimetres. */
  gapMm: number;
  /** Horizontal alignment of the text column. */
  textAlign: 'left' | 'center' | 'right';
  /** Text colour as #rrggbb (code + name). */
  textColor: string;
  /** Code text size in millimetres. */
  codeFontMm: number;
  /** Name text size in millimetres (when shown alongside the code). */
  nameFontMm: number;
  /** Auto-fit the name to the column when it's the only text (no code). */
  nameAutoFit: boolean;
  /** Draw a thin border around the label. */
  border: boolean;
}

export const DEFAULT_LABEL_PREFS: LabelPrefs = {
  widthMm: 50,
  heightMm: 30,
  marginMm: 2,
  qrEnabled: true,
  qrPosition: 'left',
  qrSizeMm: 26,
  qrEcLevel: 'H',
  qrMarginModules: 1,
  qrColor: '#000000',
  showCode: true,
  showName: true,
  logoInQr: true,
  qrLogoScale: 26,
  gapMm: 2,
  textAlign: 'left',
  textColor: '#111111',
  codeFontMm: 3.6,
  nameFontMm: 2.5,
  nameAutoFit: true,
  border: false,
};

const clampNum = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

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
 * Render a QR for `text` with (optionally) the app logo composited in the centre.
 * Uses the highest error-correction level (H, ~30%) and keeps the logo small
 * (~26%) so the code stays reliably scannable. Falls back to a plain QR if the
 * logo or canvas isn't available.
 */
async function qrDataUrlWithLogo(
  text: string,
  size: number,
  opts: { withLogo: boolean; logoScale: number; margin: number; ecLevel: 'L' | 'M' | 'Q' | 'H'; color: string },
): Promise<string> {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, text, {
    margin: opts.margin,
    width: size,
    errorCorrectionLevel: opts.ecLevel,
    color: { dark: opts.color, light: '#ffffff' },
  });
  const ctx = canvas.getContext('2d');
  if (!ctx || !opts.withLogo) return canvas.toDataURL('image/png');
  try {
    const logo = await loadImage('/logo.png');
    const lw = canvas.width * (opts.logoScale / 100);
    const lh = lw * (logo.naturalHeight / logo.naturalWidth || 1);
    const lx = (canvas.width - lw) / 2;
    const ly = (canvas.height - lh) / 2;
    const pad = canvas.width * 0.02;
    ctx.fillStyle = '#fff';
    roundRectPath(ctx, lx - pad, ly - pad, lw + pad * 2, lh + pad * 2, (lh + pad * 2) * 0.22);
    ctx.fill();
    ctx.filter = 'grayscale(100%)'; // logo in greyscale
    ctx.drawImage(logo, lx, ly, lw, lh);
    ctx.filter = 'none';
  } catch {
    /* logo failed to load — keep the plain QR */
  }
  return canvas.toDataURL('image/png');
}

/**
 * Pick a font size (mm) so a name-only label fills the given text column without
 * clipping: bounded both by the longest word (must fit one line) and by the
 * total length (must fit the area). Generalises to any label/column size.
 */
function fitNameFontMm(name: string, colW: number, colH: number): number {
  const charW = 0.55, lineH = 1.25; // approx Inter metrics relative to font size
  const len = Math.max(name.length, 1);
  const longest = name.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 1);
  const byWord = colW / (charW * longest); // longest word fits on a line
  const byArea = Math.sqrt((colW * colH * 0.82) / (charW * lineH * len)); // total text fits the area
  return Math.max(1.6, Math.min(4, byWord, byArea));
}

/** The shared HTML document shell (page size + font/layout CSS). */
function labelDoc(widthMm: number, heightMm: number, title: string, body: string): string {
  return `<!doctype html><html><head><title>${escapeHtml(title)}</title>
    <style>
      @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0;
        /* Crisp, high-contrast glyphs for both the screen preview and the printer. */
        -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
      /* Monospace stack with a true tabular, high-legibility face first. */
      .mono { font-family: "JetBrains Mono", "Roboto Mono", "SF Mono", "DejaVu Sans Mono", ui-monospace, Menlo, Consolas, monospace;
        font-feature-settings: "tnum" 1, "zero" 1; font-variant-ligatures: none; }
      .sans { font-family: "Inter", "Roboto", system-ui, -apple-system, "Segoe UI", sans-serif; }
      .label { display: flex; align-items: center; }
      .label.center { flex-direction: column; justify-content: center; text-align: center; gap: 1mm; }
      .qr { image-rendering: pixelated; }
      .info { min-width: 0; overflow: hidden; }
      .code { font-weight: 700; line-height: 1.05; letter-spacing: 0.01em; overflow-wrap: anywhere; }
      .bigcode { font-weight: 800; font-size: 10mm; line-height: 0.95; letter-spacing: 0.02em; }
      .name { font-weight: 500; line-height: 1.2; margin-top: 1.2mm;
              overflow-wrap: anywhere; /* break over-long words instead of clipping */
              display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      /* When the name is the only text (no code), it fills the column; the font
         size is set inline (auto-fit) and it may use more lines. */
      .name.only { font-weight: 600; line-height: 1.2; margin-top: 0; -webkit-line-clamp: 8; }
    </style></head><body>${body}</body></html>`;
}

/**
 * Builds the full HTML document for a thermal label, honouring the user's
 * LabelPrefs (size, QR on/off + side + size, which texts to print, logo). The
 * exact same document drives the on-screen preview and the print, so what the
 * user sees is what prints.
 */
export async function buildLabelHtml(spec: LabelSpec, prefs: LabelPrefs = DEFAULT_LABEL_PREFS): Promise<string> {
  const W = clampNum(prefs.widthMm, 20, 120);
  const H = clampNum(prefs.heightMm, 15, 120);
  // Configurable safe margin; never larger than half the smallest side.
  const pad = clampNum(prefs.marginMm ?? 2, 0, Math.min(W, H) / 2 - 1);
  const gap = clampNum(prefs.gapMm ?? 2, 0, Math.max(W - pad * 2 - 8, 0));
  const useQr = spec.qr !== false && prefs.qrEnabled;
  const showCode = prefs.showCode;
  const showName = prefs.showName && !!spec.name;
  const color = prefs.textColor ?? '#111111';
  const align = prefs.textAlign ?? 'left';
  const codeMm = clampNum(prefs.codeFontMm ?? 3.6, 1.2, 12);
  const nameMm = clampNum(prefs.nameFontMm ?? 2.5, 1, 12);
  // Optional border, inside the W×H box (box-sizing: border-box) so it never
  // grows the label past its physical size.
  const border = prefs.border ? `;border:0.2mm solid ${color}` : '';

  if (useQr) {
    const qrMm = clampNum(prefs.qrSizeMm, 8, Math.min(H - pad * 2, W - pad * 2 - 8));
    const colW = Math.max(W - pad * 2 - qrMm - gap, 6);
    const colH = H - pad * 2;
    // Higher resolution than the print size so the QR stays crisp at 203 dpi.
    const dataUrl = await qrDataUrlWithLogo(spec.code, 360, {
      withLogo: prefs.logoInQr,
      logoScale: prefs.qrLogoScale ?? 26,
      margin: prefs.qrMarginModules ?? 1,
      ecLevel: prefs.qrEcLevel ?? 'H',
      color: prefs.qrColor ?? '#000000',
    });
    const nameOnly = !showCode;
    const nameSize = nameOnly && (prefs.nameAutoFit ?? true) ? fitNameFontMm(spec.name ?? '', colW, colH) : nameMm;
    const info = `<div class="info" style="flex:1;width:${colW}mm;text-align:${align}">${
      showCode ? `<div class="code mono" style="font-size:${codeMm}mm;color:${color}">${escapeHtml(spec.code)}</div>` : ''
    }${
      showName
        ? `<div class="name sans${nameOnly ? ' only' : ''}" style="font-size:${nameSize}mm;color:${color}">${escapeHtml(spec.name ?? '')}</div>`
        : ''
    }</div>`;
    const qrImg = `<img class="qr" style="width:${qrMm}mm;height:${qrMm}mm;flex:0 0 ${qrMm}mm" src="${dataUrl}" />`;
    const body = `<div class="label" style="width:${W}mm;height:${H}mm;padding:${pad}mm;gap:${gap}mm${
      prefs.qrPosition === 'right' ? ';flex-direction:row-reverse' : ''
    }${border}">${qrImg}${info}</div>`;
    return labelDoc(W, H, spec.code, body);
  }

  // Text-only label (e.g. root locations): big centred code (+ optional name).
  const body = `<div class="label center" style="width:${W}mm;height:${H}mm;padding:${pad}mm${border}">${
    showCode ? `<div class="bigcode mono" style="color:${color}">${escapeHtml(spec.code)}</div>` : ''
  }${showName ? `<div class="name sans" style="font-size:${nameMm}mm;color:${color}">${escapeHtml(spec.name ?? '')}</div>` : ''}</div>`;
  return labelDoc(W, H, spec.code, body);
}

/**
 * Prints a label document. On the desktop it prints **silently** to the default
 * printer via the Electron bridge (no system print dialog). In a plain browser
 * — or if silent printing fails — it falls back to the dialog-based print
 * through a hidden <iframe> (window.open is blocked in the Electron shell).
 */
export function printLabelHtml(html: string): void {
  const bridge = typeof window !== 'undefined' ? window.partengine : undefined;
  if (bridge?.print?.label) {
    bridge.print
      .label(html)
      .then((r) => { if (!r?.ok) browserPrintHtml(html); }) // fall back to the dialog
      .catch(() => browserPrintHtml(html));
    return;
  }
  browserPrintHtml(html);
}

/** Dialog-based print via a hidden <iframe> (browser fallback). */
function browserPrintHtml(html: string): void {
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
export async function printLabel(spec: LabelSpec, prefs?: LabelPrefs): Promise<void> {
  printLabelHtml(await buildLabelHtml(spec, prefs));
}

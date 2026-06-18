// Regenerates every icon/logo asset from the single source logo
// (apps/desktop/static/logo.png) using sharp. Idempotent — re-run after the
// logo changes:  node apps/desktop/scripts/make-icons.mjs
//
// Produces:
//   apps/desktop/static/icon.ico   Windows app icon (electron-builder), multi-size
//   apps/desktop/static/tray.png   system-tray icon (referenced by main.ts)
//   apps/web/public/logo.png       UI logo (sidebar, auth screen, splash)
//   apps/web/public/favicon.ico    browser tab icon
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const SRC = path.join(repo, 'apps/desktop/static/logo.png');
const desktopStatic = path.join(repo, 'apps/desktop/static');
const webPublic = path.join(repo, 'apps/web/public');

/** Render the source logo onto a transparent square PNG of the given size. */
function pngAt(size) {
  return sharp(SRC)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/** Pack PNG buffers into a single .ico (modern PNG-compressed icon directory). */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  const bodies = [];
  entries.forEach((e, i) => {
    const o = i * 16;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o); // width  (0 = 256)
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1); // height (0 = 256)
    dir.writeUInt8(0, o + 2); // palette
    dir.writeUInt8(0, o + 3); // reserved
    dir.writeUInt16LE(1, o + 4); // color planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(e.data.length, o + 8); // size of image data
    dir.writeUInt32LE(offset, o + 12); // offset of image data
    offset += e.data.length;
    bodies.push(e.data);
  });
  return Buffer.concat([header, dir, ...bodies]);
}

async function ico(sizes) {
  const entries = [];
  for (const size of sizes) entries.push({ size, data: await pngAt(size) });
  return buildIco(entries);
}

async function main() {
  await mkdir(webPublic, { recursive: true });

  await writeFile(path.join(desktopStatic, 'icon.ico'), await ico([16, 24, 32, 48, 64, 128, 256]));
  await writeFile(path.join(desktopStatic, 'tray.png'), await pngAt(32));
  await writeFile(path.join(webPublic, 'logo.png'), await pngAt(512));
  await writeFile(path.join(webPublic, 'favicon.ico'), await ico([16, 32, 48]));

  console.log('Icons regenerated from', path.relative(repo, SRC));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

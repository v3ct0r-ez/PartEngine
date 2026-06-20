'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

// Stable default so the effect deps don't change every render (a fresh
// [0,255,0] literal would re-run the effect on each keystroke and restart the clip).
const GREEN: [number, number, number] = [0, 255, 0];

/**
 * Plays a video with a real-time green-screen chroma key (#00FF00 by default) and
 * auto-crops the result to the logo's content, so the surrounding transparent
 * margins of the source clip don't add uneven whitespace. The clip plays once and
 * freezes on the last frame. Same-origin source only (canvas pixel read would
 * otherwise taint). Falls back to `fallback` if the video can't load/play.
 */
export function ChromaLogo({
  src,
  height = 112,
  keyColor = GREEN,
  threshold = 0.45,
  className = '',
  fallback = null,
}: {
  src: string; // played once, then frozen on the last frame
  height?: number;
  keyColor?: [number, number, number];
  threshold?: number; // 0..1 colour distance to the key for full transparency
  className?: string;
  fallback?: ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current; // visible (cropped) output
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    const buf = document.createElement('canvas'); // offscreen full-frame buffer
    const bctx = buf.getContext('2d', { willReadFrequently: true });
    if (!ctx || !bctx) return;

    let raf = 0;
    let sized = false;
    let done = false; // freeze after the clip ends
    const [kr, kg, kb] = keyColor;
    const tFull = threshold * 255;
    const tEdge = tFull * 1.35;
    // Union bounding box of opaque pixels across frames (never shrinks, so the
    // crop is stable and never clips an intro frame).
    let x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;

    const draw = () => {
      if (!done) raf = requestAnimationFrame(draw);
      if (video.readyState < 2 || !video.videoWidth) return;
      if (!sized) {
        buf.width = video.videoWidth;
        buf.height = video.videoHeight;
        sized = true;
      }
      const w = buf.width, h = buf.height;
      bctx.drawImage(video, 0, 0, w, h);
      let img: ImageData;
      try {
        img = bctx.getImageData(0, 0, w, h);
      } catch {
        setFailed(true);
        cancelAnimationFrame(raf);
        return;
      }
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const dist = Math.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2);
        let a = 255;
        if (dist < tFull) a = 0;
        else if (dist < tEdge) a = Math.round(((dist - tFull) / (tEdge - tFull)) * 255);
        d[i + 3] = a;
        if (g > r && g > b) d[i + 1] = Math.max(r, b); // green-spill suppression
        if (a > 16) {
          const px = (i / 4) % w;
          const py = (i / 4 / w) | 0;
          if (px < x0) x0 = px;
          if (px > x1) x1 = px;
          if (py < y0) y0 = py;
          if (py > y1) y1 = py;
        }
      }
      bctx.putImageData(img, 0, 0);

      if (x1 >= x0 && y1 >= y0) {
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw;
          canvas.height = ch;
        }
        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(buf, x0, y0, cw, ch, 0, 0, cw, ch);
      }
    };

    const onErr = () => setFailed(true);
    const onEnded = () => { done = true; };
    video.addEventListener('error', onErr);
    video.addEventListener('ended', onEnded);
    video.play?.().catch(() => {});
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener('error', onErr);
      video.removeEventListener('ended', onEnded);
    };
    // Depend on the key colour by value (not array reference) so re-renders
    // (e.g. typing in a form) don't restart the clip.
  }, [src, height, threshold, keyColor[0], keyColor[1], keyColor[2]]);

  if (failed) return <>{fallback}</>;
  return (
    <>
      <video ref={videoRef} src={src} muted playsInline autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} className={className} style={{ height, width: 'auto' }} />
    </>
  );
}

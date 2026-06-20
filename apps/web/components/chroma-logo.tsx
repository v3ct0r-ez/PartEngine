'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Plays a video with a real-time chroma key: each frame is drawn to a canvas and
 * the green-screen background (#00FF00 by default) is made transparent, so a logo
 * on a green background floats on the page. Includes green-spill suppression on
 * the edges. Same-origin source only (canvas pixel read would otherwise taint).
 * Falls back to `fallback` if the video can't load/play.
 */
export function ChromaLogo({
  src,
  height = 112,
  keyColor = [0, 255, 0],
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
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let raf = 0;
    let sized = false;
    let done = false; // stop drawing after the clip ends (freeze last frame)
    const [kr, kg, kb] = keyColor;
    const tFull = threshold * 255;
    const tEdge = tFull * 1.35;

    const onEnded = () => { done = true; }; // play once, then hold the last frame

    const draw = () => {
      if (!done) raf = requestAnimationFrame(draw);
      if (video.readyState < 2 || !video.videoWidth) return;
      if (!sized) {
        // Match the canvas bitmap to the video's native size (CSS scales it to
        // `height` with width:auto), so the aspect ratio is preserved.
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        sized = true;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      let img: ImageData;
      try {
        img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch {
        setFailed(true);
        cancelAnimationFrame(raf);
        return;
      }
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const dist = Math.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2);
        if (dist < tFull) d[i + 3] = 0;
        else if (dist < tEdge) d[i + 3] = Math.round(((dist - tFull) / (tEdge - tFull)) * 255);
        // Green-spill suppression: pull a dominant green channel down to the
        // brighter of red/blue so edges don't keep a green fringe.
        if (g > r && g > b) d[i + 1] = Math.max(r, b);
      }
      ctx.putImageData(img, 0, 0);
    };

    const onErr = () => setFailed(true);
    video.addEventListener('error', onErr);
    video.addEventListener('ended', onEnded);
    video.play?.().catch(() => {});
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener('error', onErr);
      video.removeEventListener('ended', onEnded);
    };
  }, [src, height, threshold, keyColor]);

  if (failed) return <>{fallback}</>;
  return (
    <>
      <video ref={videoRef} src={src} muted playsInline autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} className={className} style={{ height, width: 'auto' }} />
    </>
  );
}

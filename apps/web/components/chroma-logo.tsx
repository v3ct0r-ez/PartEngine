'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Plays a video with a real-time chroma key: each frame is drawn to a canvas and
 * the background colour (auto-sampled from the top-left pixel) is made
 * transparent, so a logo on a solid (green/blue/black) background floats on the
 * page. Same-origin source only (canvas pixel read would otherwise taint).
 * Falls back to `fallback` if the video can't load/play.
 */
export function ChromaLogo({
  src,
  height = 112,
  threshold = 0.2,
  className = '',
  fallback = null,
}: {
  src: string;
  height?: number;
  threshold?: number; // 0..1 colour distance for full transparency
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
    let key: [number, number, number] | null = null;
    const tFull = threshold * 255;
    const tEdge = tFull * 1.7;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (video.readyState < 2 || !video.videoWidth) return;
      if (!canvas.width) {
        const ratio = video.videoWidth / video.videoHeight || 1;
        canvas.width = Math.max(1, Math.round(height * ratio));
        canvas.height = height;
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
      if (!key) key = [d[0], d[1], d[2]]; // top-left pixel = background colour
      const [kr, kg, kb] = key;
      for (let i = 0; i < d.length; i += 4) {
        const dist = Math.sqrt((d[i] - kr) ** 2 + (d[i + 1] - kg) ** 2 + (d[i + 2] - kb) ** 2);
        if (dist < tFull) d[i + 3] = 0;
        else if (dist < tEdge) d[i + 3] = Math.round(((dist - tFull) / (tEdge - tFull)) * 255);
      }
      ctx.putImageData(img, 0, 0);
    };

    const onErr = () => setFailed(true);
    video.addEventListener('error', onErr);
    video.play?.().catch(() => {});
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener('error', onErr);
    };
  }, [src, height, threshold]);

  if (failed) return <>{fallback}</>;
  return (
    <>
      <video ref={videoRef} src={src} muted loop playsInline autoPlay style={{ display: 'none' }} />
      <canvas ref={canvasRef} className={className} style={{ height, width: 'auto' }} />
    </>
  );
}

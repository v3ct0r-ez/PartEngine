'use client';

import { usePrefs } from '@/lib/preferences';
import { configureSound, unlockAudio } from '@/lib/sound';
import { useEffect } from 'react';

/** Keeps the UI sound engine in sync with the user's saved preferences. */
export function SoundSync() {
  const { soundEnabled, soundVolume } = usePrefs();
  useEffect(() => {
    configureSound({ enabled: soundEnabled, volume: soundVolume });
  }, [soundEnabled, soundVolume]);

  // Warm up the audio context on the first user gesture (capture phase, so it
  // runs before any handler that plays a sound) → the first tone is full volume.
  useEffect(() => {
    const h = () => unlockAudio();
    const opts = { once: true, capture: true } as const;
    window.addEventListener('pointerdown', h, opts);
    window.addEventListener('keydown', h, opts);
    return () => {
      window.removeEventListener('pointerdown', h, true);
      window.removeEventListener('keydown', h, true);
    };
  }, []);
  return null;
}

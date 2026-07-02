'use client';

import { usePrefs } from '@/lib/preferences';
import { configureSound } from '@/lib/sound';
import { useEffect } from 'react';

/** Keeps the UI sound engine in sync with the user's saved preferences. */
export function SoundSync() {
  const { soundEnabled, soundVolume } = usePrefs();
  useEffect(() => {
    configureSound({ enabled: soundEnabled, volume: soundVolume });
  }, [soundEnabled, soundVolume]);
  return null;
}

'use client';

import { getPreferences, updatePreferences, type ThemePref } from '@/lib/api';
import { useEffect, useState } from 'react';

const KEY = 'pe-theme';

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

/** Apply a theme by toggling the `dark` class (tailwind darkMode: 'class'). */
export function applyTheme(theme: ThemePref) {
  if (typeof document === 'undefined') return;
  const dark = theme === 'dark' || (theme === 'system' && systemDark());
  document.documentElement.classList.toggle('dark', dark);
}

export function getLocalTheme(): ThemePref {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem(KEY) as ThemePref) || 'system';
}

/** Mounted once at the app root: applies the stored theme immediately (no flash)
 *  then syncs the server-side preference, and tracks OS changes in system mode. */
export function ThemeApplier() {
  useEffect(() => {
    applyTheme(getLocalTheme());
    // Pull the durable preference and reconcile.
    getPreferences()
      .then((p) => {
        if (p?.theme) {
          localStorage.setItem(KEY, p.theme);
          applyTheme(p.theme);
        }
      })
      .catch(() => {});
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => { if (getLocalTheme() === 'system') applyTheme('system'); };
    mq?.addEventListener?.('change', onChange);
    return () => mq?.removeEventListener?.('change', onChange);
  }, []);
  return null;
}

/** Theme selector hook: current value + setter that applies + persists (local + server). */
export function useTheme(): [ThemePref, (t: ThemePref) => void] {
  const [theme, setThemeState] = useState<ThemePref>('system');
  useEffect(() => setThemeState(getLocalTheme()), []);
  const setTheme = (t: ThemePref) => {
    setThemeState(t);
    localStorage.setItem(KEY, t);
    applyTheme(t);
    updatePreferences({ theme: t }).catch(() => {});
  };
  return [theme, setTheme];
}

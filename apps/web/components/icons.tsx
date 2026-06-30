import type { ReactNode } from 'react';

/**
 * Single source of truth for the app's stroke icons (Lucide-style, 24-box,
 * currentColor). Both the side navigation and the dashboard render from here so
 * the same concept (Componenti, Fornitori, Movimenti…) always shows the same
 * glyph. Keys map 1:1 to nav routes where one exists, plus a few dashboard-only
 * concepts (value, low/out of stock, download).
 */
const PATHS: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  components: <><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2" /></>,
  categories: <><path d="M3 7a2 2 0 0 1 2-2h5l9 9-7 7-9-9V7z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  locations: <><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  movements: <><path d="M7 7h12l-3-3M17 17H5l3 3" /></>,
  boms: <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  manufacturers: <><path d="M3 21V10l6 4V10l6 4V7l6 4v10z" /><path d="M3 21h18" /></>,
  suppliers: <><rect x="1" y="6" width="13" height="10" rx="1" /><path d="M14 9h4l3 3v4h-7z" /><circle cx="6" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  orders: <><path d="M6 6h15l-1.5 8h-12z" /><path d="M6 6 5 3H3" /><circle cx="8" cy="19" r="1.6" /><circle cx="18" cy="19" r="1.6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.5-1.5-4.6-3.5-5.5" /></>,
  preferences: <><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M18 18h2" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 4.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  // Dashboard-only concepts (no nav route):
  value: <><circle cx="12" cy="12" r="9" /><path d="M14.5 9a3 3 0 0 0-2.5-1.2c-1.7 0-3 1-3 2.2s1.3 2 3 2 3 .8 3 2-1.3 2.2-3 2.2A3 3 0 0 1 9.5 15M12 6v1.8M12 16.2V18" /></>,
  lowStock: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  outOfStock: <><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></>,
};

/** A stroke icon by name. Defaults to the 18px size used in the side nav. */
export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className ?? ''}`}
    >
      {PATHS[name]}
    </svg>
  );
}

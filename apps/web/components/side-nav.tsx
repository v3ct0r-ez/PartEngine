'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Minimal Lucide-style stroke icons (18px, currentColor). */
const I = (p: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{p}</svg>
);
const ICONS: Record<string, ReactNode> = {
  '/': I(<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>),
  '/components': I(<><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2" /></>),
  '/categories': I(<><path d="M3 7a2 2 0 0 1 2-2h5l9 9-7 7-9-9V7z" /><circle cx="7.5" cy="7.5" r="1" /></>),
  '/locations': I(<><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
  '/movements': I(<><path d="M7 7h12l-3-3M17 17H5l3 3" /></>),
  '/boms': I(<><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>),
  '/manufacturers': I(<><path d="M3 21V10l6 4V10l6 4V7l6 4v10z" /><path d="M3 21h18" /></>),
  '/suppliers': I(<><rect x="1" y="6" width="13" height="10" rx="1" /><path d="M14 9h4l3 3v4h-7z" /><circle cx="6" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>),
  '/orders': I(<><path d="M6 6h15l-1.5 8h-12z" /><path d="M6 6 5 3H3" /><circle cx="8" cy="19" r="1.6" /><circle cx="18" cy="19" r="1.6" /></>),
  '/users': I(<><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.5-1.5-4.6-3.5-5.5" /></>),
  '/preferences': I(<><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M18 18h2" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></>),
  '/settings': I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 4.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
};

const SECTIONS: Array<{ heading?: string; items: Array<[string, string]> }> = [
  { items: [['Dashboard', '/'], ['Componenti', '/components'], ['Categorie', '/categories'], ['Ubicazioni', '/locations'], ['Movimenti', '/movements'], ['BOM', '/boms']] },
  { heading: 'Anagrafiche', items: [['Produttori', '/manufacturers'], ['Fornitori', '/suppliers'], ['Ordini', '/orders']] },
  { heading: 'Sistema', items: [['Utenti', '/users'], ['Preferenze', '/preferences'], ['Impostazioni', '/settings']] },
];

export function SideNav() {
  const pathname = usePathname() || '/';
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));

  return (
    <nav className="space-y-4 text-sm">
      {SECTIONS.map((section, i) => (
        <div key={i} className="space-y-1">
          {section.heading && (
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{section.heading}</div>
          )}
          {section.items.map(([label, href]) => {
            const active = isActive(href);
            return (
              <a
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  active
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {/* active accent bar */}
                <span className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
                <span className={active ? 'text-primary' : 'text-muted-foreground/80 group-hover:text-foreground'}>{ICONS[href]}</span>
                {label}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

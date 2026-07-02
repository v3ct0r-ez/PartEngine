'use client';

import { Icon } from '@/components/icons';
import { playSound } from '@/lib/sound';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Route → shared icon name (see components/icons.tsx).
const ICON_NAME: Record<string, string> = {
  '/': 'dashboard',
  '/components': 'components',
  '/categories': 'categories',
  '/locations': 'locations',
  '/movements': 'movements',
  '/boms': 'boms',
  '/manufacturers': 'manufacturers',
  '/suppliers': 'suppliers',
  '/orders': 'orders',
  '/users': 'users',
  '/preferences': 'preferences',
  '/settings': 'settings',
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
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{section.heading}</div>
          )}
          {section.items.map(([label, href]) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => { if (!active) playSound('click'); }}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  active
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {/* active accent bar */}
                <span className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
                <span className={active ? 'text-primary' : 'text-muted-foreground/80 group-hover:text-foreground'}><Icon name={ICON_NAME[href]} /></span>
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

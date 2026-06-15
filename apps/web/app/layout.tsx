import type { Metadata } from 'next';
import './globals.css';
import { NotificationsBell } from '@/components/notifications-bell';
import { UpdateBanner } from '@/components/update-banner';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'PartEngine — Gestione magazzino componenti',
  description: 'Enterprise WMS for electronic components',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>
          <div className="flex min-h-screen">
            <aside className="hidden w-60 shrink-0 border-r border-border bg-muted/30 p-4 md:block">
              <div className="mb-6 text-lg font-bold">PartEngine</div>
              <nav className="space-y-1 text-sm">
                {[
                  ['Dashboard', '/'],
                  ['Componenti', '/components'],
                  ['Magazzino', '/inventory'],
                  ['BOM', '/boms'],
                  ['Fornitori', '/suppliers'],
                  ['Report', '/reports'],
                ].map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    className="block rounded-md px-3 py-2 hover:bg-muted"
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </aside>
            <div className="flex-1">
              <UpdateBanner />
              <div className="flex items-center justify-end border-b border-border px-6 py-2">
                <NotificationsBell />
              </div>
              <main className="p-6">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}

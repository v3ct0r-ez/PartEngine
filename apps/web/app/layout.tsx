import type { Metadata } from 'next';
import './globals.css';
import { AccountMenu } from '@/components/account-menu';
import { AuthGate } from '@/components/auth-gate';
import { DialogHost } from '@/components/ui-dialogs';
import { ErrorBoundary } from '@/components/error-boundary';
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
          <AuthGate>
          <div className="flex min-h-screen">
            <aside className="hidden w-60 shrink-0 border-r border-border bg-muted/30 p-4 md:block">
              <div className="mb-6 text-lg font-bold">PartEngine</div>
              <nav className="space-y-1 text-sm">
                {[
                  ['Dashboard', '/'],
                  ['Componenti', '/components'],
                  ['Categorie', '/categories'],
                  ['Ubicazioni', '/locations'],
                  ['Movimenti', '/movements'],
                  ['BOM', '/boms'],
                  ['Produttori', '/manufacturers'],
                  ['Fornitori', '/suppliers'],
                  ['Ordini', '/orders'],
                  ['Utenti', '/users'],
                  ['Impostazioni', '/settings'],
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
              <div className="flex items-center justify-end gap-1 border-b border-border px-6 py-2">
                <NotificationsBell />
                <AccountMenu />
              </div>
              <main className="p-6">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
          </div>
          </AuthGate>
          <DialogHost />
        </Providers>
      </body>
    </html>
  );
}

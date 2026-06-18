import type { Metadata } from 'next';
import './globals.css';
import { AccountMenu } from '@/components/account-menu';
import { AppVersion } from '@/components/app-version';
import { AuthGate } from '@/components/auth-gate';
import { DesktopTitleBar } from '@/components/desktop-titlebar';
import { DialogHost } from '@/components/ui-dialogs';
import { ErrorBoundary } from '@/components/error-boundary';
import { Logo } from '@/components/logo';
import { NotificationsBell } from '@/components/notifications-bell';
import { ThemeApplier } from '@/components/theme';
import { UpdateBanner } from '@/components/update-banner';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'PartEngine — Gestione magazzino componenti',
  description: 'Enterprise WMS for electronic components',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <ThemeApplier />
          <div className="flex h-screen flex-col overflow-hidden">
            <DesktopTitleBar />
            <div className="min-h-0 flex-1 overflow-auto">
          <AuthGate>
          <div className="flex min-h-full">
            <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-muted/30 p-4 md:flex">
              <Logo size={30} className="mb-6" />
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
              <div className="mt-auto pt-4">
                <AppVersion />
              </div>
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
            </div>
          </div>
          <DialogHost />
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { AccountMenu } from '@/components/account-menu';
import { AppVersion } from '@/components/app-version';
import { AuthGate } from '@/components/auth-gate';
import { SideNav } from '@/components/side-nav';
import { DesktopTitleBar } from '@/components/desktop-titlebar';
import { DialogHost } from '@/components/ui-dialogs';
import { ErrorBoundary } from '@/components/error-boundary';
import { Logo } from '@/components/logo';
import { NotificationsBell } from '@/components/notifications-bell';
import { SoundSync } from '@/components/sound-sync';
import { ThemeApplier } from '@/components/theme';
import { UpdateBanner } from '@/components/update-banner';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'PartEngine — Gestione magazzino componenti',
  description: 'Enterprise WMS for electronic components',
  // Favicon is provided by app/favicon.ico (Next app-router convention).
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <ThemeApplier />
          <div className="flex h-screen flex-col overflow-hidden">
            <DesktopTitleBar />
            <div className="min-h-0 flex-1 overflow-hidden">
          <AuthGate>
          <SoundSync />
          <div className="flex h-full">
            <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-card px-3 py-4 md:flex">
              <Logo size={44} className="mb-6 px-2" />
              <SideNav />
              <div className="mt-auto px-2 pt-4">
                <AppVersion />
              </div>
            </aside>
            <div className="flex-1 overflow-auto">
              <UpdateBanner />
              <div className="flex items-center justify-end gap-1 border-b border-border bg-card px-6 py-2">
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

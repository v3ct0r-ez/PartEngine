'use client';

import { ChromaLogo } from '@/components/chroma-logo';
import { LogoMark } from '@/components/logo';
import { getAuthStatus, getMe, getToken, login, setupAdmin } from '@/lib/api';
import { useEffect, useState } from 'react';

type Phase = 'loading' | 'setup' | 'login' | 'authed';

/**
 * Auth gate with first-run setup. If the app has no users yet (fresh install),
 * it shows a "create administrator" form instead of login — so no default
 * password is ever shipped. Otherwise: login, then the app.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');

  useEffect(() => {
    // Validate the stored token rather than trusting its mere presence: a stale
    // token would otherwise show the app, then bounce on the first API 401.
    // getMe() goes through the refresh-on-401 flow, so an expired access token
    // is silently renewed when a valid refresh token exists.
    if (getToken()) {
      getMe()
        .then(() => setPhase('authed'))
        .catch(() => setPhase('login'));
      return;
    }
    getAuthStatus()
      .then((s) => setPhase(s.needsSetup ? 'setup' : 'login'))
      .catch(() => setPhase('login'));
  }, []);

  // On the desktop, go full-size (maximized) once the user is in — the login
  // shows in a normal window, the app itself uses the whole screen.
  useEffect(() => {
    if (phase === 'authed') window.partengine?.window?.enterFullscreen?.();
  }, [phase]);

  if (phase === 'loading') return null;
  if (phase === 'authed') return <>{children}</>;
  if (phase === 'setup') return <SetupForm onDone={() => setPhase('authed')} />;
  return <LoginForm onSuccess={() => setPhase('authed')} />;
}

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-full items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(900px 500px at 50% -15%, hsl(var(--primary) / 0.18), transparent 70%), hsl(var(--muted) / 0.35)',
      }}
    >
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-background/95 p-10 shadow-xl backdrop-blur">
        <div className="text-center">
          <AnimatedLogo />
          <div className="text-2xl font-bold tracking-tight">PartEngine</div>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Animated logo (logo.mp4) with its background chroma-keyed out, falling back
 * to the static mark if the video can't play. */
function AnimatedLogo() {
  return (
    <ChromaLogo
      src="/logo.mp4"
      loopSrc="/logo_loop.mp4"
      height={168}
      className="mx-auto mb-4 drop-shadow"
      fallback={<LogoMark size={168} className="mb-4 drop-shadow" />}
    />
  );
}

const fld =
  'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';
const btn =
  'w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50';

function SetupForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError('Le password non coincidono');
    if (password.length < 8) return setError('La password deve avere almeno 8 caratteri');
    setBusy(true);
    setError(null);
    try {
      await setupAdmin(email.trim(), fullName.trim(), password);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Setup" subtitle="Primo avvio: crea l'account amministratore">
      <form onSubmit={submit} className="space-y-3">
        <input className={fld} name="fullName" autoComplete="name" placeholder="Nome completo (es. Mario Rossi)" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input className={fld} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <input className={fld} type="password" placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <input className={fld} type="password" placeholder="Conferma password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={busy || !email || !fullName || !password}
          className={btn}>
          {busy ? 'Creazione…' : "Crea amministratore e accedi"}
        </button>
        <p className="text-center text-xs text-muted-foreground">Questo account avrà ruolo SUPER_ADMIN.</p>
      </form>
    </Shell>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Accesso" subtitle="Accedi per continuare">
      <form onSubmit={submit} className="space-y-3">
        <input className={fld} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <input className={fld} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={busy || !email || !password}
          className={btn}>
          {busy ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
    </Shell>
  );
}

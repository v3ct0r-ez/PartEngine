'use client';

import { getToken, login } from '@/lib/api';
import { useEffect, useState } from 'react';

/**
 * Authentication gate. If there's no stored token it shows the login form;
 * otherwise it renders the app. The API requires a JWT on every protected
 * route, so without this the app can't read/write anything (401 Unauthorized).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => setAuthed(!!getToken()), []);

  if (authed === null) return null; // brief: deciding
  if (!authed) return <LoginForm onSuccess={() => setAuthed(true)} />;
  return <>{children}</>;
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('admin@partengine.local');
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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-8 shadow-sm"
      >
        <div className="text-center">
          <div className="text-2xl font-bold">PartEngine</div>
          <p className="mt-1 text-sm text-muted-foreground">Accedi per continuare</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            autoComplete="username"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={busy || !email || !password}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Accesso…' : 'Accedi'}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Primo avvio: admin@partengine.local / changeme123
        </p>
      </form>
    </div>
  );
}

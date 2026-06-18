'use client';

import { changeMyPassword, getMe, logout, type ThemePref } from '@/lib/api';
import { useTheme } from '@/components/theme';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro' },
];

export function AccountMenu() {
  const me = useQuery({ queryKey: ['me'], queryFn: getMe, retry: false });
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(false);
  const [theme, setTheme] = useTheme();

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-md px-3 py-2 text-sm hover:bg-muted">
        {me.data?.email ?? 'Account'} ▾
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-border bg-background py-1 shadow-lg">
          <div className="px-3 py-1.5 text-xs text-muted-foreground">{me.data?.role}</div>
          <div className="px-3 py-2">
            <div className="mb-1 text-xs text-muted-foreground">Tema</div>
            <div className="flex gap-1">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={`flex-1 rounded border px-2 py-1 text-xs ${theme === t.value ? 'border-primary bg-muted font-medium' : 'border-border hover:bg-muted'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => { setPw(true); setOpen(false); }} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted">Cambia password</button>
          <button onClick={() => logout()} className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-muted">Esci</button>
        </div>
      )}
      {pw && <ChangePasswordModal onClose={() => setPw(false)} />}
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const fld = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) return setError('Le nuove password non coincidono');
    if (next.length < 8) return setError('Minimo 8 caratteri');
    setBusy(true); setError(null);
    try {
      await changeMyPassword(current, next);
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-background p-6 shadow-xl">
        <h2 className="text-lg font-bold">Cambia password</h2>
        {done ? (
          <>
            <p className="text-sm text-green-600">Password aggiornata.</p>
            <button type="button" onClick={onClose} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Chiudi</button>
          </>
        ) : (
          <>
            <input className={fld} type="password" placeholder="Password attuale" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            <input className={fld} type="password" placeholder="Nuova password (min 8)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            <input className={fld} type="password" placeholder="Conferma nuova password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Annulla</button>
              <button type="submit" disabled={busy || !current || !next} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? '…' : 'Aggiorna'}</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
